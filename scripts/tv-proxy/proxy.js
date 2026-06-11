#!/usr/bin/env node
/**
 * Smart Life TV Proxy
 * Bridges the PWA (HTTPS) to local TV devices (HTTP/WebSocket)
 *
 * Usage:
 *   npm install    (first time only)
 *   node proxy.js  [port]  (default: 7654)
 *
 * Supports: Roku (ECP), Samsung Smart TV (Tizen), LG webOS
 */
const http    = require('http');
const https   = require('https');
const net     = require('net');
const os      = require('os');
const WebSocket = require('ws');

const PORT = parseInt(process.argv[2] || '7654', 10);

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(res, status, body) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// ── Fetch helper (Node 18+ built-in fetch, or fallback to http module) ────────
async function localFetch(url, opts = {}) {
  if (typeof fetch !== 'undefined') return fetch(url, opts);
  // Fallback for older Node
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, { method: opts.method || 'GET' }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ ok: res.statusCode < 400, status: res.statusCode, text: () => Promise.resolve(data), json: () => Promise.resolve(JSON.parse(data)) }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ── Samsung WebSocket pool ────────────────────────────────────────────────────
const samsungConnections = new Map(); // ip → { ws, queue, ready }

function getSamsungConnection(ip) {
  if (samsungConnections.has(ip)) return samsungConnections.get(ip);

  const conn = { ws: null, ready: false, queue: [] };
  samsungConnections.set(ip, conn);

  const appInfo = Buffer.from(JSON.stringify({ method: 'ms.channel.connect', params: { name: Buffer.from('Smart Life').toString('base64') } })).toString();
  const wsUrl = `ws://${ip}:8001/api/v2/channels/samsung.remote.control?name=${Buffer.from('Smart Life').toString('base64')}`;

  function connect() {
    const ws = new WebSocket(wsUrl, { handshakeTimeout: 5000 });
    conn.ws = ws;

    ws.on('open', () => {
      conn.ready = true;
      conn.queue.forEach(({ key, resolve, reject }) => sendSamsungKey(ip, key).then(resolve).catch(reject));
      conn.queue = [];
    });
    ws.on('error', () => {
      conn.ready = false;
      setTimeout(connect, 5000);
    });
    ws.on('close', () => {
      conn.ready = false;
      setTimeout(connect, 3000);
    });
  }
  connect();
  return conn;
}

function sendSamsungKey(ip, key) {
  return new Promise((resolve, reject) => {
    const conn = getSamsungConnection(ip);
    const cmd = JSON.stringify({
      method: 'ms.remote.control',
      params: { Cmd: 'Click', DataOfCmd: key, Option: false, TypeOfRemote: 'SendRemoteKey' },
    });
    if (conn.ready && conn.ws?.readyState === WebSocket.OPEN) {
      conn.ws.send(cmd);
      resolve();
    } else {
      conn.queue.push({ key, resolve, reject });
      setTimeout(() => reject(new Error('Samsung connection timeout')), 8000);
    }
  });
}

// ── LG webOS pool ─────────────────────────────────────────────────────────────
const lgConnections = new Map();

function getLgConnection(ip) {
  if (lgConnections.has(ip)) return lgConnections.get(ip);
  const conn = { ws: null, ready: false, clientKey: null, queue: [], msgId: 1 };
  lgConnections.set(ip, conn);

  function connect() {
    const ws = new WebSocket(`ws://${ip}:3000`, { handshakeTimeout: 5000 });
    conn.ws = ws;
    ws.on('open', () => {
      // Register the app (get client key)
      const reg = { id: 'register_0', type: 'register', payload: {
        forcePairing: false, pairingType: 'PROMPT',
        manifest: { manifestVersion: 1, appVersion: '1.1', signed: { created: '20140509', appId: 'com.smart.life.remote', vendorId: 'com.smart.life', localizedAppNames: { '': 'Smart Life Remote' }, localizedVendorNames: { '': 'Smart Life' }, permissions: ['TEST_SECURE','CONTROL_INPUT_TEXT','CONTROL_MOUSE_AND_KEYBOARD','READ_INSTALLED_APPS','READ_LGE_SDX','READ_NOTIFICATIONS','SEARCH','WRITE_SETTINGS','WRITE_NOTIFICATION_ALERT','CONTROL_POWER','READ_CURRENT_CHANNEL','READ_RUNNING_APPS','READ_UPDATE_INFO','UPDATE_FROM_REMOTE_APP','READ_LGE_TV_INPUT_EVENTS','READ_TV_CURRENT_TIME'], signatures: [] },
        clientKey: conn.clientKey || undefined,
      }};
      ws.send(JSON.stringify(reg));
    });
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'registered' && msg.payload?.['client-key']) {
          conn.clientKey = msg.payload['client-key'];
          conn.ready = true;
          conn.queue.forEach(({ key, resolve, reject }) => sendLgKey(ip, key).then(resolve).catch(reject));
          conn.queue = [];
        }
      } catch {}
    });
    ws.on('error', () => { conn.ready = false; setTimeout(connect, 5000); });
    ws.on('close', () => { conn.ready = false; setTimeout(connect, 3000); });
  }
  connect();
  return conn;
}

function sendLgKey(ip, key) {
  return new Promise((resolve, reject) => {
    const conn = getLgConnection(ip);
    const cmd = JSON.stringify({ id: `key_${conn.msgId++}`, type: 'request', uri: 'ssap://com.webos.service.ime/sendEnterKey', payload: { keyCode: key } });
    // Use the button API for most keys
    const btnCmd = JSON.stringify({ id: `btn_${conn.msgId++}`, type: 'request', uri: 'ssap://com.webos.service.networkinput/sendButtonEvent', payload: { button: key } });
    if (conn.ready && conn.ws?.readyState === WebSocket.OPEN) {
      conn.ws.send(btnCmd);
      resolve();
    } else {
      conn.queue.push({ key, resolve, reject });
      setTimeout(() => reject(new Error('LG connection timeout')), 8000);
    }
  });
}

// ── Network discovery ─────────────────────────────────────────────────────────

// Get the most likely local subnet (e.g. "192.168.1")
function getLocalSubnet() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address.split('.').slice(0, 3).join('.');
      }
    }
  }
  return '192.168.1';
}

// Fast TCP reachability check
function tcpOpen(ip, port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const finish = (v) => { if (!done) { done = true; s.destroy(); resolve(v); } };
    s.setTimeout(timeoutMs);
    s.once('connect', () => finish(true));
    s.once('timeout', () => finish(false));
    s.once('error',   () => finish(false));
    s.connect(port, ip);
  });
}

// Confirm Roku and get its friendly name
async function probeRoku(ip) {
  try {
    const r = await localFetch(`http://${ip}:8060/query/device-info`, { signal: AbortSignal.timeout?.(1500) });
    if (!r.ok) return null;
    const xml = await r.text();
    const m = xml.match(/<friendly-device-name>([^<]+)<\/friendly-device-name>/);
    return { type: 'roku', ip, name: m?.[1] || `Roku (${ip})` };
  } catch { return null; }
}

// Confirm Samsung
async function probeSamsung(ip) {
  for (const port of [8001, 8002]) {
    try {
      const r = await localFetch(`http://${ip}:${port}/api/v2/`, { signal: AbortSignal.timeout?.(1500) });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        return { type: 'samsung', ip, name: d.device?.name || d.DeviceName || `Samsung TV (${ip})` };
      }
    } catch {}
  }
  return null;
}

// Scan the whole subnet for TVs (runs in ~1-2 seconds over typical home WiFi)
async function discoverTVs() {
  const subnet = getLocalSubnet();
  const found = [];

  // Build all scan tasks: for each IP check ports 8060 (Roku), 8001/8002 (Samsung), 3000 (LG)
  const scanTasks = [];
  for (let i = 1; i <= 254; i++) {
    const ip = `${subnet}.${i}`;
    scanTasks.push(async () => {
      const [rokuOpen, samsungOpen, lgOpen] = await Promise.all([
        tcpOpen(ip, 8060),
        tcpOpen(ip, 8001),
        tcpOpen(ip, 3000),
      ]);
      const results = [];
      if (rokuOpen)   { const d = await probeRoku(ip);    if (d) results.push(d); }
      if (samsungOpen){ const d = await probeSamsung(ip); if (d) results.push(d); }
      if (lgOpen)     results.push({ type: 'lg', ip, name: `LG TV (${ip})` });
      return results;
    });
  }

  // Run 40 at a time to avoid flooding the home router
  const BATCH = 40;
  for (let i = 0; i < scanTasks.length; i += BATCH) {
    const batch = scanTasks.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(fn => fn()));
    for (const r of results) {
      if (r.status === 'fulfilled') found.push(...r.value);
    }
  }
  return found;
}

// ── Request router ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // /status
  if (path === '/status') return json(res, 200, { ok: true, version: '1.2.0', port: PORT });

  // /discover — scan local network for TVs automatically
  if (path === '/discover') {
    try {
      console.log('Scanning local network for TVs...');
      const devices = await discoverTVs();
      console.log(`Found ${devices.length} TV(s):`, devices.map(d => `${d.name} (${d.ip})`).join(', ') || 'none');
      return json(res, 200, { ok: true, devices });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // /roku/{ip}/keypress/{key}  or  /roku/{ip}/query/apps  etc.
  const rokuMatch = path.match(/^\/roku\/([^/]+)(\/.*)/);
  if (rokuMatch) {
    const [, ip, rokuPath] = rokuMatch;
    try {
      const rokuRes = await localFetch(`http://${ip}:8060${rokuPath}`, {
        method: req.method === 'GET' ? 'GET' : 'POST',
        signal: AbortSignal.timeout?.(5000),
      });
      const text = await rokuRes.text();
      res.writeHead(rokuRes.status, { ...CORS, 'Content-Type': 'text/xml' });
      res.end(text);
    } catch (e) {
      json(res, 502, { error: e.message });
    }
    return;
  }

  // /samsung/{ip}/key/{keyCode}
  const samsungMatch = path.match(/^\/samsung\/([^/]+)\/key\/(.+)/);
  if (samsungMatch) {
    const [, ip, key] = samsungMatch;
    try {
      await sendSamsungKey(ip, key);
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 502, { error: e.message });
    }
    return;
  }

  // /samsung/{ip}/test
  const samsungTest = path.match(/^\/samsung\/([^/]+)\/test/);
  if (samsungTest) {
    getSamsungConnection(samsungTest[1]);
    json(res, 200, { ok: true, message: 'Connection initiated — check TV for pairing prompt' });
    return;
  }

  // /lg/{ip}/key/{key}
  const lgMatch = path.match(/^\/lg\/([^/]+)\/key\/(.+)/);
  if (lgMatch) {
    const [, ip, key] = lgMatch;
    try {
      await sendLgKey(ip, key);
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 502, { error: e.message });
    }
    return;
  }

  // /lg/{ip}/test
  const lgTest = path.match(/^\/lg\/([^/]+)\/test/);
  if (lgTest) {
    getLgConnection(lgTest[1]);
    json(res, 200, { ok: true, message: 'Connection initiated — check TV for pairing prompt' });
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, 'localhost', () => {
  console.log('\n📺 Smart Life TV Proxy v1.1.0');
  console.log(`   Running at http://localhost:${PORT}`);
  console.log('   Keep this terminal open while using the TV remote.\n');
  console.log('   Supports: Roku · Samsung Smart TV · LG webOS');
  console.log('   Press Ctrl+C to stop.\n');
});

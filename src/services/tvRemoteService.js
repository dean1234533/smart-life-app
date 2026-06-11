// ── Device persistence (localStorage — device-specific) ──────────────────────
export function getDevices() {
  try { return JSON.parse(localStorage.getItem('tv_devices') || '[]'); } catch { return []; }
}
export function saveDevices(devices) {
  localStorage.setItem('tv_devices', JSON.stringify(devices));
}
export function getActiveDeviceId() {
  return localStorage.getItem('tv_active_device') || null;
}
export function setActiveDeviceId(id) {
  localStorage.setItem('tv_active_device', id);
}

// ── Local proxy (same pattern as Ollama — runs on user's machine) ─────────────
const PROXY = 'http://localhost:7654';

export async function isProxyRunning() {
  try {
    const res = await fetch(`${PROXY}/status`, { signal: AbortSignal.timeout(2000) });
    const json = await res.json();
    return !!json.ok;
  } catch { return false; }
}

// Scan local network for TVs via the proxy — returns array of { type, ip, name }
export async function discoverDevices() {
  const res = await fetch(`${PROXY}/discover`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('Discovery failed');
  const { devices } = await res.json();
  return devices || [];
}

// ── Chromecast / Google Cast (Chrome-only native API) ─────────────────────────
export function isCastAvailable() {
  return typeof window !== 'undefined' && !!window.chrome?.cast?.isAvailable;
}

// ── Roku ECP (via proxy) ───────────────────────────────────────────────────────
export async function rokuSendKey(ip, key) {
  const rokuKey = ROKU_KEY_MAP[key] ?? key;
  const res = await fetch(`${PROXY}/roku/${ip}/keypress/${rokuKey}`, {
    method: 'POST',
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Roku error ${res.status}`);
}
export async function rokuGetApps(ip) {
  const res = await fetch(`${PROXY}/roku/${ip}/query/apps`, { signal: AbortSignal.timeout(4000) });
  const text = await res.text();
  return [...text.matchAll(/<app id="([^"]+)"[^>]*>([^<]+)<\/app>/g)]
    .map(([, id, name]) => ({ id, name }));
}
export async function rokuLaunchApp(ip, appId) {
  await fetch(`${PROXY}/roku/${ip}/launch/${appId}`, { method: 'POST', signal: AbortSignal.timeout(4000) });
}
export async function testRoku(ip) {
  const res = await fetch(`${PROXY}/roku/${ip}/query/device-info`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error('Device not responding');
}

// ── Samsung Tizen (via proxy WebSocket bridge) ────────────────────────────────
export async function samsungSendKey(ip, key) {
  const samsungKey = SAMSUNG_KEY_MAP[key] ?? key;
  const res = await fetch(`${PROXY}/samsung/${ip}/key/${samsungKey}`, {
    method: 'POST',
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Samsung error ${res.status}`);
  }
}
export async function testSamsung(ip) {
  const res = await fetch(`${PROXY}/samsung/${ip}/test`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('Device not responding');
}

// ── LG webOS (via proxy WebSocket bridge) ────────────────────────────────────
export async function lgSendKey(ip, key) {
  const lgKey = LG_KEY_MAP[key] ?? key;
  const res = await fetch(`${PROXY}/lg/${ip}/key/${lgKey}`, {
    method: 'POST',
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `LG error ${res.status}`);
  }
}
export async function testLg(ip) {
  const res = await fetch(`${PROXY}/lg/${ip}/test`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('Device not responding');
}

// ── Unified dispatch ──────────────────────────────────────────────────────────
export async function sendKey(device, key) {
  if (!device) throw new Error('No device selected');
  switch (device.type) {
    case 'roku':    return rokuSendKey(device.ip, key);
    case 'samsung': return samsungSendKey(device.ip, key);
    case 'lg':      return lgSendKey(device.ip, key);
    default: throw new Error(`Unknown device type: ${device.type}`);
  }
}

export async function testDevice(device) {
  switch (device.type) {
    case 'roku':    return testRoku(device.ip);
    case 'samsung': return testSamsung(device.ip);
    case 'lg':      return testLg(device.ip);
    default: throw new Error('Unknown device type');
  }
}

// ── Key maps — all normalised to the same action names ───────────────────────
const ROKU_KEY_MAP = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  ok: 'Select', back: 'Back', home: 'Home', options: 'Info',
  volUp: 'VolumeUp', volDown: 'VolumeDown', mute: 'VolumeMute',
  play: 'Play', pause: 'Play', fwd: 'Fwd', rev: 'Rev', stop: 'Stop',
  power: 'PowerOff',
  chUp: 'ChannelUp', chDown: 'ChannelDown',
  num0:'Lit_0', num1:'Lit_1', num2:'Lit_2', num3:'Lit_3', num4:'Lit_4',
  num5:'Lit_5', num6:'Lit_6', num7:'Lit_7', num8:'Lit_8', num9:'Lit_9',
  red: 'InstantReplay', green: 'Info', yellow: 'Info', blue: 'Rev',
};

const SAMSUNG_KEY_MAP = {
  up: 'KEY_UP', down: 'KEY_DOWN', left: 'KEY_LEFT', right: 'KEY_RIGHT',
  ok: 'KEY_ENTER', back: 'KEY_RETURN', home: 'KEY_HOME', options: 'KEY_MENU',
  volUp: 'KEY_VOLUMEUP', volDown: 'KEY_VOLUMEDOWN', mute: 'KEY_MUTE',
  play: 'KEY_PLAY', pause: 'KEY_PAUSE', fwd: 'KEY_FF', rev: 'KEY_REWIND', stop: 'KEY_STOP',
  power: 'KEY_POWER',
  chUp: 'KEY_CHUP', chDown: 'KEY_CHDOWN',
  num0:'KEY_0', num1:'KEY_1', num2:'KEY_2', num3:'KEY_3', num4:'KEY_4',
  num5:'KEY_5', num6:'KEY_6', num7:'KEY_7', num8:'KEY_8', num9:'KEY_9',
  red: 'KEY_RED', green: 'KEY_GREEN', yellow: 'KEY_YELLOW', blue: 'KEY_BLUE',
};

const LG_KEY_MAP = {
  up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
  ok: 'ENTER', back: 'BACK', home: 'EXIT', options: 'INFO',
  volUp: 'VOLUMEUP', volDown: 'VOLUMEDOWN', mute: 'MUTE',
  play: 'PLAY', pause: 'PAUSE', fwd: 'FASTFORWARD', rev: 'REWIND', stop: 'STOP',
  power: 'POWER',
  chUp: 'CHANNELUP', chDown: 'CHANNELDOWN',
  num0:'0', num1:'1', num2:'2', num3:'3', num4:'4',
  num5:'5', num6:'6', num7:'7', num8:'8', num9:'9',
  red: 'RED', green: 'GREEN', yellow: 'YELLOW', blue: 'BLUE',
};

// ── Streaming services (deep-link on mobile, web fallback) ────────────────────
export const STREAMING_SERVICES = [
  { id: 'netflix',     name: 'Netflix',      color: '#E50914', emoji: '🎬', url: 'https://netflix.com',                   deep: 'netflix://' },
  { id: 'youtube',     name: 'YouTube',      color: '#FF0000', emoji: '▶️',  url: 'https://youtube.com',                   deep: 'youtube://' },
  { id: 'disney',      name: 'Disney+',      color: '#113CCF', emoji: '✨', url: 'https://disneyplus.com',                deep: 'disneyplus://' },
  { id: 'prime',       name: 'Prime Video',  color: '#00A8E0', emoji: '📦', url: 'https://primevideo.com',                deep: 'aiv://' },
  { id: 'hulu',        name: 'Hulu',         color: '#1CE783', emoji: '📺', url: 'https://hulu.com',                      deep: 'hulu://' },
  { id: 'max',         name: 'Max',          color: '#002BE7', emoji: '🎭', url: 'https://max.com',                       deep: 'hbomax://' },
  { id: 'appletv',     name: 'Apple TV+',    color: '#555555', emoji: '🍎', url: 'https://tv.apple.com',                  deep: 'videos://' },
  { id: 'peacock',     name: 'Peacock',      color: '#FFC000', emoji: '🦚', url: 'https://peacocktv.com',                 deep: 'peacocktv://' },
  { id: 'paramount',   name: 'Paramount+',   color: '#0064FF', emoji: '⭐', url: 'https://paramountplus.com',             deep: 'paramountplus://' },
  { id: 'spotify',     name: 'Spotify',      color: '#1DB954', emoji: '🎵', url: 'https://open.spotify.com',             deep: 'spotify://' },
  { id: 'twitch',      name: 'Twitch',       color: '#9147FF', emoji: '🎮', url: 'https://twitch.tv',                    deep: 'twitch://' },
  { id: 'iplayer',     name: 'BBC iPlayer',  color: '#FF4800', emoji: '🇬🇧', url: 'https://bbc.co.uk/iplayer',            deep: null },
  { id: 'itvx',        name: 'ITVX',         color: '#2E1F6B', emoji: '📡', url: 'https://itv.com',                       deep: null },
  { id: 'channel4',    name: 'Channel 4',    color: '#6600CC', emoji: '4️⃣', url: 'https://channel4.com',                  deep: null },
  { id: 'ch5',         name: 'My5',          color: '#E5007E', emoji: '5️⃣', url: 'https://channel5.com',                  deep: null },
  { id: 'plex',        name: 'Plex',         color: '#E5A00D', emoji: '🗂️', url: 'https://app.plex.tv',                   deep: 'plex://' },
];

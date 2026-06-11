/**
 * Smart Life SMS Auto-Reply Worker
 *
 * Endpoints:
 *   POST /register          — save user config (requires Firebase auth token)
 *   DELETE /register        — remove user config (requires Firebase auth token)
 *   POST /webhook/:uid      — Twilio webhook: receive SMS → AI reply
 *
 * Deploy:
 *   1. Create a KV namespace: wrangler kv namespace create SMS_CONFIGS
 *   2. Paste the namespace ID into wrangler.toml
 *   3. wrangler deploy
 *   4. Copy the deployed URL into VITE_SMS_WORKER_URL in your .env
 */

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// ── Firebase token verification (same approach as google-calendar worker) ──

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  return atob(padded + '='.repeat(pad));
}

async function verifyFirebaseToken(idToken, projectId) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const header = JSON.parse(b64urlDecode(parts[0]));
  const payload = JSON.parse(b64urlDecode(parts[1]));
  if (payload.aud !== projectId) throw new Error('Wrong audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Wrong issuer');
  if (Math.floor(Date.now() / 1000) > payload.exp) throw new Error('Token expired');
  const keysResp = await fetch(FIREBASE_JWKS_URL, { cf: { cacheTtl: 3600 } });
  const { keys } = await keysResp.json();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key');
  const cryptoKey = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const input = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const sig = Uint8Array.from(b64urlDecode(parts[2]), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sig, input);
  if (!valid) throw new Error('Signature mismatch');
  return payload.sub;
}

// ── Gemini call ─────────────────────────────────────────────────────────────

async function callGemini(apiKey, systemPrompt, history, userMessage) {
  const contents = [
    ...history,
    { role: 'user', parts: [{ text: userMessage }] },
  ];
  const body = {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini error ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a reply.";
}

// ── CORS helper ─────────────────────────────────────────────────────────────

const ALLOWED_ORIGIN = 'https://smart-life-app.pages.dev';

function cors(response, origin) {
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowed);
  headers.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

// ── Rate limiting (KV, 20 req/min per UID) ───────────────────────────────────

async function checkRateLimit(kv, uid) {
  const key = `ratelimit:${uid}:${Math.floor(Date.now() / 60000)}`;
  const count = parseInt((await kv.get(key)) || '0', 10);
  if (count >= 20) return false;
  await kv.put(key, String(count + 1), { expirationTtl: 120 });
  return true;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }), origin);
    }

    // POST /register — save user config
    if (url.pathname === '/register' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) return cors(new Response('Unauthorized', { status: 401 }), origin);

      let uid;
      try {
        uid = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
      } catch (e) {
        return cors(new Response(`Auth failed: ${e.message}`, { status: 401 }), origin);
      }

      if (!(await checkRateLimit(env.SMS_CONFIGS, uid))) {
        return cors(new Response('Too Many Requests', { status: 429 }), origin);
      }

      const config = await request.json();
      await env.SMS_CONFIGS.put(uid, JSON.stringify({
        enabled: !!config.enabled,
        accountSid: config.accountSid || '',
        authToken: config.authToken || '',
        fromPhone: config.fromPhone || '',
        geminiKey: config.geminiKey || '',
        systemPrompt: config.systemPrompt || 'You are a helpful assistant. Keep replies concise.',
      }));
      return cors(new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      }), origin);
    }

    // DELETE /register — remove user config
    if (url.pathname === '/register' && request.method === 'DELETE') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) return cors(new Response('Unauthorized', { status: 401 }), origin);
      let uid;
      try { uid = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID); } catch (e) {
        return cors(new Response(`Auth failed: ${e.message}`, { status: 401 }), origin);
      }
      if (!(await checkRateLimit(env.SMS_CONFIGS, uid))) {
        return cors(new Response('Too Many Requests', { status: 429 }), origin);
      }
      await env.SMS_CONFIGS.delete(uid);
      return cors(new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      }), origin);
    }

    // POST /webhook/:uid — Twilio SMS webhook
    const webhookMatch = url.pathname.match(/^\/webhook\/([^/]+)$/);
    if (webhookMatch && request.method === 'POST') {
      const uid = webhookMatch[1];
      const config = await env.SMS_CONFIGS.get(uid, 'json');

      // If not configured or disabled, return empty TwiML (no reply)
      if (!config?.enabled) {
        return new Response('<Response></Response>', {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      const formText = await request.text();
      const params = new URLSearchParams(formText);
      const senderNumber = params.get('From') || '';
      const messageBody = params.get('Body') || '';

      if (!messageBody.trim()) {
        return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
      }

      const apiKey = config.geminiKey || env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response('<Response><Message>Auto-reply unavailable.</Message></Response>', {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      // Per-sender conversation history stored in KV (keyed by uid:senderNumber)
      const historyKey = `history:${uid}:${senderNumber}`;
      const history = (await env.SMS_CONFIGS.get(historyKey, 'json')) || [];

      let replyText;
      try {
        replyText = await callGemini(apiKey, config.systemPrompt, history, messageBody);
      } catch {
        replyText = "Sorry, I couldn't process your message right now.";
      }

      // Update conversation history (keep last 10 turns)
      const updatedHistory = [
        ...history,
        { role: 'user', parts: [{ text: messageBody }] },
        { role: 'model', parts: [{ text: replyText }] },
      ].slice(-20);
      await env.SMS_CONFIGS.put(historyKey, JSON.stringify(updatedHistory), { expirationTtl: 86400 });

      const twiml = `<Response><Message>${replyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message></Response>`;
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    return new Response('Not found', { status: 404 });
  },
};

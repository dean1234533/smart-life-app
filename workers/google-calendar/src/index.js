const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CAL_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - padded.length % 4) % 4;
  const b64 = padded + '='.repeat(pad);
  return atob(b64);
}

// Verify Firebase ID token using Google's public JWK — no API key needed
async function verifyFirebaseToken(idToken, projectId) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid Firebase token format');

  let header, payload;
  try {
    header = JSON.parse(b64urlDecode(parts[0]));
    payload = JSON.parse(b64urlDecode(parts[1]));
  } catch {
    throw new Error('Invalid Firebase token: malformed JWT');
  }

  if (payload.aud !== projectId) throw new Error('Invalid Firebase token: wrong audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Invalid Firebase token: wrong issuer');
  if (Math.floor(Date.now() / 1000) > payload.exp) throw new Error('Firebase token expired');

  // Fetch Google's public signing keys (cached for 1 hour by Cloudflare CDN)
  const keysResp = await fetch(FIREBASE_JWKS_URL, { cf: { cacheTtl: 3600 } });
  if (!keysResp.ok) throw new Error('Failed to fetch Firebase public keys');
  const { keys } = await keysResp.json();

  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Invalid Firebase token: unknown signing key');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  );

  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const sigBytes = Uint8Array.from(b64urlDecode(parts[2]), (c) => c.charCodeAt(0));

  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, signingInput);
  if (!valid) throw new Error('Invalid Firebase token: signature mismatch');

  return payload.sub; // UID
}

// Get or refresh a valid Google access token for a user
async function getAccessToken(uid, env) {
  const stored = await env.GOOGLE_TOKENS.get(uid, 'json');
  if (!stored?.refreshToken) throw new Error('Not connected to Google Calendar');

  if (stored.accessToken && Date.now() < stored.expiresAt - 60_000) {
    return stored.accessToken;
  }

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
    }),
  });
  if (!resp.ok) {
    await env.GOOGLE_TOKENS.delete(uid);
    throw new Error('Token refresh failed — please reconnect');
  }
  const tokens = await resp.json();
  const updated = {
    accessToken: tokens.access_token,
    refreshToken: stored.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  await env.GOOGLE_TOKENS.put(uid, JSON.stringify(updated));
  return tokens.access_token;
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.APP_ORIGIN || 'https://smart-life-app.pages.dev',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status = 200, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function extractIdToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Firebase ')) throw new Error('Missing Firebase auth header');
  return auth.slice(9);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const projectId = env.FIREBASE_PROJECT_ID || 'lifeos-b7205';

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      // ── Step 1: Start OAuth flow ────────────────────────────────────────
      if (path === '/auth/google/start' && request.method === 'GET') {
        const idToken = url.searchParams.get('idToken');
        if (!idToken) return json({ error: 'Missing idToken' }, 400, env);

        const uid = await verifyFirebaseToken(idToken, projectId);
        const redirectUri = `${url.origin}/auth/google/callback`;

        const params = new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',
          prompt: 'consent',
          state: uid,
        });

        return Response.redirect(`${GOOGLE_AUTH_URL}?${params}`, 302);
      }

      // ── Step 2: OAuth callback ──────────────────────────────────────────
      if (path === '/auth/google/callback' && request.method === 'GET') {
        const code = url.searchParams.get('code');
        const uid = url.searchParams.get('state');
        if (!code || !uid) return json({ error: 'Missing code or state' }, 400, env);

        const redirectUri = `${url.origin}/auth/google/callback`;
        const resp = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (!resp.ok) {
          const err = await resp.text();
          return json({ error: `Token exchange failed: ${err}` }, 500, env);
        }

        const tokens = await resp.json();
        if (!tokens.refresh_token) {
          return json({ error: 'No refresh token returned — re-authorize with prompt=consent' }, 400, env);
        }

        await env.GOOGLE_TOKENS.put(uid, JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        }));

        const appOrigin = env.APP_ORIGIN || 'https://smart-life-app.pages.dev';
        return Response.redirect(`${appOrigin}/settings?calendar=connected`, 302);
      }

      // ── Check connection status ─────────────────────────────────────────
      if (path === '/calendar/status' && request.method === 'GET') {
        const uid = await verifyFirebaseToken(extractIdToken(request), projectId);
        const stored = await env.GOOGLE_TOKENS.get(uid, 'json');
        return json({ connected: !!stored?.refreshToken }, 200, env);
      }

      // ── Disconnect ──────────────────────────────────────────────────────
      if (path === '/calendar/disconnect' && request.method === 'DELETE') {
        const uid = await verifyFirebaseToken(extractIdToken(request), projectId);
        await env.GOOGLE_TOKENS.delete(uid);
        return json({ success: true }, 200, env);
      }

      // ── Fetch events ────────────────────────────────────────────────────
      if (path === '/calendar/events' && request.method === 'GET') {
        const uid = await verifyFirebaseToken(extractIdToken(request), projectId);
        const token = await getAccessToken(uid, env);

        const timeMin = url.searchParams.get('timeMin') || new Date().toISOString();
        const timeMax = url.searchParams.get('timeMax') || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

        const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
        const resp = await fetch(`${GOOGLE_CAL_URL}?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return json({ error: `Google Calendar error ${resp.status}` }, resp.status, env);
        const data = await resp.json();
        return json({ events: data.items || [] }, 200, env);
      }

      // ── Create event ────────────────────────────────────────────────────
      if (path === '/calendar/events' && request.method === 'POST') {
        const uid = await verifyFirebaseToken(extractIdToken(request), projectId);
        const token = await getAccessToken(uid, env);
        const body = await request.json();

        const resp = await fetch(GOOGLE_CAL_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!resp.ok) return json({ error: `Failed to create event: ${resp.status}` }, resp.status, env);
        return json(await resp.json(), 201, env);
      }

      // Public: get busy times (no auth — booking page calls this)
      if (path.startsWith('/calendar/freebusy/') && request.method === 'GET') {
        const uid = decodeURIComponent(path.split('/')[3] || '');
        if (!uid) return json({ error: 'Missing uid' }, 400, env);
        try {
          const token = await getAccessToken(uid, env);
          const timeMin = url.searchParams.get('timeMin') || new Date().toISOString();
          const timeMax = url.searchParams.get('timeMax') || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
          const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
          const resp = await fetch(`${GOOGLE_CAL_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) return json({ busyTimes: [] }, 200, env);
          const data = await resp.json();
          const busyTimes = (data.items || []).map(e => ({
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
          }));
          return json({ busyTimes }, 200, env);
        } catch {
          return json({ busyTimes: [] }, 200, env);
        }
      }

      // Public: create a booking in the owner's Google Calendar
      if (path === '/booking/public' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body?.ownerUid || !body?.start || !body?.end) return json({ error: 'Missing required fields' }, 400, env);
        try {
          const token = await getAccessToken(body.ownerUid, env);
          const eventBody = {
            summary: body.summary || 'Booking',
            description: body.description || '',
            start: { dateTime: body.start },
            end: { dateTime: body.end },
          };
          if (body.attendeeEmail) eventBody.attendees = [{ email: body.attendeeEmail }];
          const resp = await fetch(GOOGLE_CAL_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(eventBody),
          });
          if (!resp.ok) return json({ error: 'Failed to create calendar event' }, 500, env);
          return json(await resp.json(), 201, env);
        } catch (err) {
          return json({ error: err.message }, 500, env);
        }
      }

      return json({ error: 'Not found' }, 404, env);
    } catch (err) {
      return json({ error: err.message }, err.message.includes('Firebase') ? 401 : 500, env);
    }
  },
};

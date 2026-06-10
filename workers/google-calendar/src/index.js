const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CAL_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const FIREBASE_LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

// Verify Firebase ID token and return UID
async function getUidFromToken(idToken, firebaseApiKey) {
  const resp = await fetch(`${FIREBASE_LOOKUP_URL}?key=${firebaseApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!resp.ok) throw new Error('Invalid Firebase token');
  const data = await resp.json();
  const uid = data.users?.[0]?.localId;
  if (!uid) throw new Error('Token has no UID');
  return uid;
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

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      // ── Step 1: Start OAuth flow ────────────────────────────────────────
      // Frontend sends user's Firebase ID token; we verify and start the redirect
      if (path === '/auth/google/start' && request.method === 'GET') {
        const idToken = url.searchParams.get('idToken');
        if (!idToken) return json({ error: 'Missing idToken' }, 400, env);

        const uid = await getUidFromToken(idToken, env.FIREBASE_API_KEY);
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
        const uid = await getUidFromToken(extractIdToken(request), env.FIREBASE_API_KEY);
        const stored = await env.GOOGLE_TOKENS.get(uid, 'json');
        return json({ connected: !!stored?.refreshToken }, 200, env);
      }

      // ── Disconnect ──────────────────────────────────────────────────────
      if (path === '/calendar/disconnect' && request.method === 'DELETE') {
        const uid = await getUidFromToken(extractIdToken(request), env.FIREBASE_API_KEY);
        await env.GOOGLE_TOKENS.delete(uid);
        return json({ success: true }, 200, env);
      }

      // ── Fetch events ────────────────────────────────────────────────────
      if (path === '/calendar/events' && request.method === 'GET') {
        const uid = await getUidFromToken(extractIdToken(request), env.FIREBASE_API_KEY);
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
        const uid = await getUidFromToken(extractIdToken(request), env.FIREBASE_API_KEY);
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

      return json({ error: 'Not found' }, 404, env);
    } catch (err) {
      return json({ error: err.message }, err.message.includes('Firebase') ? 401 : 500, env);
    }
  },
};

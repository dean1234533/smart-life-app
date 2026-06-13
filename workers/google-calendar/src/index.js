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

// ── VAPID Web Push helpers ──────────────────────────────────────────────────

function b64urlDec(str) {
  const pad = '='.repeat((4 - str.length % 4) % 4);
  return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad), c => c.charCodeAt(0));
}

function b64urlEnc(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function vapidAuthHeader(endpoint, pubKeyB64, privKeyB64, contact) {
  const audience = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 43200;
  const encB64 = s => btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const hdr = encB64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const pay = encB64(JSON.stringify({ aud: audience, exp, sub: contact }));
  const sigInput = `${hdr}.${pay}`;

  const pubBytes = b64urlDec(pubKeyB64);
  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: b64urlEnc(pubBytes.slice(1, 33).buffer),
    y: b64urlEnc(pubBytes.slice(33, 65).buffer),
    d: privKeyB64,
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(sigInput));
  return `vapid t=${sigInput}.${b64urlEnc(sig)},k=${pubKeyB64}`;
}

async function sendWebPush(subscription, payload, env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  const { endpoint } = subscription;
  const contact = `mailto:${env.VAPID_SUBJECT || 'admin@smart-life-app.pages.dev'}`;
  try {
    const auth = await vapidAuthHeader(endpoint, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, contact);
    const body = JSON.stringify(payload);
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        'Content-Encoding': 'aesgcm',
        TTL: '86400',
      },
      body,
    });
    return resp.ok || resp.status === 201;
  } catch { return false; }
}

async function verifyStripeSignature(rawBody, sigHeader, secret) {
  const parts = sigHeader.split(',');
  const timestamp = (parts.find(p => p.startsWith('t=')) || '').slice(2);
  const v1sigs = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  if (!timestamp || !v1sigs.length) return false;
  const payload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return v1sigs.includes(hex);
}

// ───────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://smart-life-app.pages.dev',
  'https://dbworkouts.co.uk',
  'https://www.dbworkouts.co.uk',
];

function corsHeaders(env, request) {
  const origin = request?.headers?.get('Origin') || '';
  const appOrigin = env.APP_ORIGIN || 'https://smart-life-app.pages.dev';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : appOrigin;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status = 200, env, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env, request) },
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
      return new Response(null, { headers: corsHeaders(env, request) });
    }

    try {
      // ── Step 1: Start OAuth flow ────────────────────────────────────────
      if (path === '/auth/google/start' && request.method === 'GET') {
        const idToken = url.searchParams.get('idToken');
        if (!idToken) return json({ error: 'Missing idToken' }, 400, env, request);

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
        if (!code || !uid) return json({ error: 'Missing code or state' }, 400, env, request);

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
          return json({ error: `Token exchange failed: ${err}` }, 500, env, request);
        }

        const tokens = await resp.json();
        if (!tokens.refresh_token) {
          return json({ error: 'No refresh token returned — re-authorize with prompt=consent' }, 400, env, request);
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
        return json({ connected: !!stored?.refreshToken }, 200, env, request);
      }

      // ── Disconnect ──────────────────────────────────────────────────────
      if (path === '/calendar/disconnect' && request.method === 'DELETE') {
        const uid = await verifyFirebaseToken(extractIdToken(request), projectId);
        await env.GOOGLE_TOKENS.delete(uid);
        return json({ success: true }, 200, env, request);
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
        return json({ events: data.items || [] }, 200, env, request);
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
        return json(await resp.json(), 201, env, request);
      }

      // ── Save availability settings (authenticated) ────────────────────────
      if (path === '/availability/settings' && request.method === 'PUT') {
        const uid = await verifyFirebaseToken(extractIdToken(request), projectId);
        const body = await request.json().catch(() => null);
        if (!body) return json({ error: 'Invalid body' }, 400, env, request);
        // Merge with existing entry so schedule and hiddenSlots can be written
        // independently without overwriting each other.
        const existing = await env.GOOGLE_TOKENS.get(`avail:${uid}`, 'json').catch(() => null) || {};
        const merged = {
          workingHours: body.workingHours !== undefined ? body.workingHours : existing.workingHours,
          hiddenSlots:  body.hiddenSlots  !== undefined ? body.hiddenSlots  : existing.hiddenSlots,
        };
        await env.GOOGLE_TOKENS.put(`avail:${uid}`, JSON.stringify(merged));
        return json({ ok: true }, 200, env, request);
      }

      // ── Get availability settings (public — booking page reads this) ───────
      if (path.startsWith('/availability/settings/') && request.method === 'GET') {
        const uid = decodeURIComponent(path.split('/')[3] || '');
        if (!uid) return json({ error: 'Missing uid' }, 400, env, request);
        const stored = await env.GOOGLE_TOKENS.get(`avail:${uid}`, 'json').catch(() => null);
        return json(stored || { workingHours: null, hiddenSlots: [] }, 200, env, request);
      }

      // ── Store push subscription (authenticated) ────────────────────────────
      if (path === '/push/subscription' && request.method === 'PUT') {
        const uid = await verifyFirebaseToken(extractIdToken(request), projectId);
        const sub = await request.json().catch(() => null);
        if (!sub?.endpoint) return json({ error: 'Invalid subscription' }, 400, env, request);
        await env.GOOGLE_TOKENS.put(`push_sub:${uid}`, JSON.stringify(sub));
        return json({ ok: true }, 200, env, request);
      }

      // ── Remove push subscription (authenticated) ────────────────────────
      if (path === '/push/subscription' && request.method === 'DELETE') {
        const uid = await verifyFirebaseToken(extractIdToken(request), projectId);
        await env.GOOGLE_TOKENS.delete(`push_sub:${uid}`);
        return json({ ok: true }, 200, env, request);
      }

      // Public: get busy times (no auth — booking page calls this)
      if (path.startsWith('/calendar/freebusy/') && request.method === 'GET') {
        const uid = decodeURIComponent(path.split('/')[3] || '');
        if (!uid) return json({ error: 'Missing uid' }, 400, env, request);
        try {
          const token = await getAccessToken(uid, env);
          const timeMin = url.searchParams.get('timeMin') || new Date().toISOString();
          const timeMax = url.searchParams.get('timeMax') || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
          const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
          const resp = await fetch(`${GOOGLE_CAL_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) return json({ busyTimes: [] }, 200, env, request);
          const data = await resp.json();
          const busyTimes = (data.items || []).map(e => ({
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
          }));
          return json({ busyTimes }, 200, env, request);
        } catch {
          return json({ busyTimes: [] }, 200, env, request);
        }
      }

      // Public: create a booking in the owner's Google Calendar
      if (path === '/booking/public' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body?.ownerUid || !body?.start || !body?.end) return json({ error: 'Missing required fields' }, 400, env, request);
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
          if (!resp.ok) return json({ error: 'Failed to create calendar event' }, 500, env, request);
          const created = await resp.json();

          // Notify the owner via push if they have a subscription
          const pushSub = await env.GOOGLE_TOKENS.get(`push_sub:${body.ownerUid}`, 'json').catch(() => null);
          if (pushSub) {
            const startTime = new Date(body.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const startDate = new Date(body.start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            await sendWebPush(pushSub, {
              title: 'New Booking!',
              body: `${body.summary || 'Someone'} booked ${startDate} at ${startTime}`,
              url: '/booking-links',
              tag: 'booking',
            }, env).catch(() => {});
          }

          return json(created, 201, env, request);
        } catch (err) {
          return json({ error: err.message }, 500, env, request);
        }
      }

      // ── Stripe: webhook (must read raw body before any JSON parse) ─────────
      if (path === '/stripe/webhook' && request.method === 'POST') {
        const rawBody = await request.text();
        const sigHeader = request.headers.get('Stripe-Signature') || '';

        if (env.STRIPE_WEBHOOK_SECRET) {
          const valid = await verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
          if (!valid) return new Response('Invalid signature', { status: 400 });
        }

        let event;
        try { event = JSON.parse(rawBody); } catch { return new Response('Bad JSON', { status: 400 }); }

        const planFromId = (id) => (id || '').includes('pro') ? 'pro' : 'starter';

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          const email = (session.customer_email || session.customer_details?.email || '').toLowerCase();
          const customerId = session.customer;
          const planId = session.metadata?.planId || session.subscription_data?.metadata?.planId || '';
          if (email) {
            const sub = { plan: planFromId(planId), planId, status: 'active', customerId, subscriptionId: session.subscription, updatedAt: Date.now() };
            await env.GOOGLE_TOKENS.put(`stripe_sub:${email}`, JSON.stringify(sub));
            if (customerId) await env.GOOGLE_TOKENS.put(`stripe_customer:${customerId}`, email);
          }
        }

        if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
          const obj = event.data.object;
          const customerId = obj.customer;
          if (customerId) {
            const email = await env.GOOGLE_TOKENS.get(`stripe_customer:${customerId}`);
            if (email) {
              const existing = await env.GOOGLE_TOKENS.get(`stripe_sub:${email}`, 'json') || {};
              const status = event.type === 'invoice.payment_failed' ? 'past_due'
                : event.type === 'customer.subscription.deleted' ? 'cancelled'
                : obj.status || existing.status || 'active';
              const planId = obj.metadata?.planId || existing.planId || '';
              const periodEnd = obj.current_period_end ? obj.current_period_end * 1000 : existing.periodEnd;
              await env.GOOGLE_TOKENS.put(`stripe_sub:${email}`, JSON.stringify({ ...existing, status, periodEnd, planId, plan: planFromId(planId), updatedAt: Date.now() }));
            }
          }
        }

        return new Response('ok', { status: 200 });
      }

      // ── Stripe: claim subscription after registration ────────────────────
      if (path === '/stripe/claim' && request.method === 'POST') {
        const uid = await verifyFirebaseToken(extractIdToken(request), projectId);
        const { email } = await request.json().catch(() => ({}));
        if (!email) return json({ plan: null }, 200, env, request);
        const normalEmail = email.toLowerCase();
        const sub = await env.GOOGLE_TOKENS.get(`stripe_sub:${normalEmail}`, 'json');
        if (sub) {
          await env.GOOGLE_TOKENS.put(`stripe_uid:${uid}`, normalEmail);
        }
        return json(sub ? { plan: sub.plan, status: sub.status, periodEnd: sub.periodEnd } : { plan: null }, 200, env, request);
      }

      // ── Stripe: get subscription status (authenticated) ──────────────────
      if (path === '/stripe/subscription' && request.method === 'GET') {
        const uid = await verifyFirebaseToken(extractIdToken(request), projectId);
        const email = await env.GOOGLE_TOKENS.get(`stripe_uid:${uid}`);
        if (!email) return json({ plan: null, status: null }, 200, env, request);
        const sub = await env.GOOGLE_TOKENS.get(`stripe_sub:${email}`, 'json');
        return json(sub || { plan: null, status: null }, 200, env, request);
      }

      // ── Stripe: create checkout session ────────────────────────────────────
      if (path === '/stripe/checkout' && request.method === 'POST') {
        if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe not configured' }, 503, env, request);
        const body = await request.json().catch(() => null);
        if (!body?.planId || !body?.successUrl || !body?.cancelUrl) {
          return json({ error: 'Missing planId, successUrl, or cancelUrl' }, 400, env, request);
        }
        const priceMap = {
          monthly_starter: env.STRIPE_PRICE_MONTHLY_STARTER,
          monthly_pro:     env.STRIPE_PRICE_MONTHLY_PRO,
          annual_starter:  env.STRIPE_PRICE_ANNUAL_STARTER,
          annual_pro:      env.STRIPE_PRICE_ANNUAL_PRO,
        };
        const priceId = priceMap[body.planId];
        if (!priceId) return json({ error: `Unknown planId: ${body.planId}` }, 400, env, request);

        const params = new URLSearchParams({
          mode: 'subscription',
          'line_items[0][price]': priceId,
          'line_items[0][quantity]': '1',
          success_url: body.successUrl,
          cancel_url: body.cancelUrl,
          'subscription_data[metadata][planId]': body.planId,
        });

        const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        });

        if (!stripeResp.ok) {
          const err = await stripeResp.json().catch(() => ({}));
          return json({ error: err.error?.message || 'Stripe checkout failed' }, 500, env, request);
        }

        const session = await stripeResp.json();
        return json({ url: session.url }, 200, env, request);
      }

      return json({ error: 'Not found' }, 404, env, request);
    } catch (err) {
      return json({ error: err.message }, err.message.includes('Firebase') ? 401 : 500, env);
    }
  },
};

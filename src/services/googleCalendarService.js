const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

let _token = null;
let _expiry = 0;
let _tokenClient = null;

export function hasValidToken() {
  return !!_token && Date.now() < _expiry;
}

function waitForGIS() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    let tries = 0;
    const id = setInterval(() => {
      if (window.google?.accounts?.oauth2) { clearInterval(id); resolve(); }
      else if (++tries > 40) { clearInterval(id); reject(new Error('Google Identity Services failed to load')); }
    }, 250);
  });
}

export async function connectGoogleCalendar() {
  await waitForGIS();
  return new Promise((resolve, reject) => {
    _tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        _token = resp.access_token;
        _expiry = Date.now() + (resp.expires_in - 60) * 1000;
        resolve(_token);
      },
    });
    _tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export async function silentRefresh() {
  if (hasValidToken()) return _token;
  if (!_tokenClient) return null;
  return new Promise((resolve) => {
    _tokenClient.callback = (resp) => {
      if (resp.error) return resolve(null);
      _token = resp.access_token;
      _expiry = Date.now() + (resp.expires_in - 60) * 1000;
      resolve(_token);
    };
    _tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function disconnectGoogleCalendar() {
  if (_token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(_token);
  }
  _token = null;
  _expiry = 0;
}

export async function fetchGoogleEvents(monthStart, monthEnd) {
  const token = await silentRefresh();
  if (!token) throw new Error('Not connected to Google Calendar');

  const params = new URLSearchParams({
    timeMin: monthStart.toISOString(),
    timeMax: monthEnd.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Google Calendar error ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((e) => ({
    id: `gcal_${e.id}`,
    title: e.summary || '(No title)',
    event_date: e.start?.dateTime || e.start?.date,
    end_date: e.end?.dateTime || e.end?.date,
    location: e.location || '',
    source: 'google',
    htmlLink: e.htmlLink,
  }));
}

export async function pushEventToGoogle(event) {
  const token = await silentRefresh();
  if (!token) return null;

  const startDt = event.event_date || event.date;
  const endDt = event.end_date || new Date(new Date(startDt).getTime() + 60 * 60 * 1000).toISOString();

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: event.title,
      description: event.description || '',
      location: event.location || '',
      start: { dateTime: startDt },
      end: { dateTime: endDt },
      attendees: (event.attendees || [])
        .filter((a) => typeof a === 'string' && a.includes('@'))
        .map((email) => ({ email })),
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

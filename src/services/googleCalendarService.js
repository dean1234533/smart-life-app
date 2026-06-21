import { firebaseAuth } from '@/lib/firebase';

const WORKER_URL = import.meta.env.VITE_CALENDAR_WORKER_URL;

async function getIdToken() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not signed in');
  return user.getIdToken();
}

function workerHeaders(idToken) {
  return { Authorization: `Firebase ${idToken}`, 'Content-Type': 'application/json' };
}

// Redirect the browser to start Google OAuth2 (worker handles the flow)
export async function connectGoogleCalendar() {
  if (!WORKER_URL) throw new Error('VITE_CALENDAR_WORKER_URL not configured');
  const idToken = await getIdToken();
  window.location.href = `${WORKER_URL}/auth/google/start?idToken=${encodeURIComponent(idToken)}`;
}

export async function disconnectGoogleCalendar() {
  if (!WORKER_URL) return;
  const idToken = await getIdToken();
  await fetch(`${WORKER_URL}/calendar/disconnect`, {
    method: 'DELETE',
    headers: workerHeaders(idToken),
  });
}

export async function checkGoogleCalendarStatus() {
  if (!WORKER_URL) return false;
  try {
    const idToken = await getIdToken();
    const resp = await fetch(`${WORKER_URL}/calendar/status`, {
      headers: workerHeaders(idToken),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.connected === true;
  } catch {
    return false;
  }
}

export async function fetchGoogleEvents(monthStart, monthEnd) {
  if (!WORKER_URL) return [];
  const idToken = await getIdToken();
  const params = new URLSearchParams({
    timeMin: monthStart.toISOString(),
    timeMax: monthEnd.toISOString(),
  });
  const resp = await fetch(`${WORKER_URL}/calendar/events?${params}`, {
    headers: workerHeaders(idToken),
  });
  if (!resp.ok) throw new Error(`Calendar fetch failed: ${resp.status}`);
  const data = await resp.json();
  return (data.events || []).map((e) => ({
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
  if (!WORKER_URL) return null;
  try {
    const idToken = await getIdToken();
    const startDt = event.event_date || event.date;
    const endDt = event.end_date || new Date(new Date(startDt).getTime() + 60 * 60 * 1000).toISOString();

    const reminderMinutes = event.reminder_minutes || 30;
    const resp = await fetch(`${WORKER_URL}/calendar/events`, {
      method: 'POST',
      headers: workerHeaders(idToken),
      body: JSON.stringify({
        summary: event.title,
        description: event.description || '',
        location: event.location || '',
        start: { dateTime: startDt },
        end: { dateTime: endDt },
        attendees: (event.attendees || [])
          .filter((a) => typeof a === 'string' && a.includes('@'))
          .map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: reminderMinutes },
          ],
        },
      }),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

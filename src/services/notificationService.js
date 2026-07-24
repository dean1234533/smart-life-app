const WORKER_URL = import.meta.env.VITE_CALENDAR_WORKER_URL || '';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function notificationsSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function notificationPermission() {
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestPermission() {
  if (!notificationsSupported()) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function subscribeToPush(idToken) {
  if (!notificationsSupported() || !VAPID_PUBLIC_KEY) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await fetch(`${WORKER_URL}/push/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Firebase ${idToken}` },
      body: JSON.stringify(sub.toJSON()),
    });
    return true;
  } catch (err) {
    console.error('Push subscribe failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(idToken) {
  if (!notificationsSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await fetch(`${WORKER_URL}/push/subscription`, {
      method: 'DELETE',
      headers: { Authorization: `Firebase ${idToken}` },
    });
  } catch {}
}

export async function isPushSubscribed() {
  if (!notificationsSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}

// Show a local notification via the service worker (works when app is open/backgrounded)
export async function showLocalNotification(title, body, url = '/') {
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'smart-life-local',
      data: { url },
    });
  } catch {}
}

const WEATHER_STATE_KEY = 'weather_last_state';
const WEATHER_CHECK_KEY = 'weather_last_check';
const WEATHER_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

function wmoCategory(code) {
  if (code === 0) return { label: 'Clear skies', emoji: '☀️', severity: 0 };
  if (code <= 2) return { label: 'Partly cloudy', emoji: '⛅', severity: 0 };
  if (code <= 3) return { label: 'Overcast', emoji: '☁️', severity: 1 };
  if (code <= 48) return { label: 'Foggy', emoji: '🌫️', severity: 2 };
  if (code <= 55) return { label: 'Drizzle', emoji: '🌦️', severity: 2 };
  if (code <= 67) return { label: 'Rain', emoji: '🌧️', severity: 3 };
  if (code <= 77) return { label: 'Snow', emoji: '❄️', severity: 3 };
  if (code <= 82) return { label: 'Heavy showers', emoji: '🌧️', severity: 3 };
  if (code <= 94) return { label: 'Hail', emoji: '🌨️', severity: 4 };
  return { label: 'Thunderstorm', emoji: '⛈️', severity: 5 };
}

export async function checkWeatherAlerts() {
  if (Notification.permission !== 'granted') return;

  // Rate-limit: don't check more than once per 30 mins
  const lastCheck = parseInt(localStorage.getItem(WEATHER_CHECK_KEY) || '0', 10);
  if (Date.now() - lastCheck < WEATHER_CHECK_INTERVAL) return;

  try {
    const coords = localStorage.getItem('weather_location_enabled')
      ? await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
        ).then((p) => ({ lat: p.coords.latitude, lon: p.coords.longitude }))
      : null;
    if (!coords) return;

    const { lat, lon } = coords;
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
    );
    if (!resp.ok) return;
    const data = await resp.json();

    const code = data.current?.weather_code ?? -1;
    const temp = Math.round(data.current?.temperature_2m ?? 0);
    const wind = Math.round(data.current?.wind_speed_10m ?? 0);
    const condition = wmoCategory(code);

    localStorage.setItem(WEATHER_CHECK_KEY, String(Date.now()));

    const lastRaw = localStorage.getItem(WEATHER_STATE_KEY);
    const last = lastRaw ? JSON.parse(lastRaw) : null;

    const currentState = { code, temp, wind, time: Date.now() };
    localStorage.setItem(WEATHER_STATE_KEY, JSON.stringify(currentState));

    if (!last) return; // first check — just store, no alert

    const prevCondition = wmoCategory(last.code);
    const conditionChanged = prevCondition.label !== condition.label;
    const tempDrop = last.temp - temp >= 4;
    const tempRise = temp - last.temp >= 4;
    const windSpike = wind >= 50 && last.wind < 50;

    let title = null;
    let body = null;

    if (condition.severity >= 5 && prevCondition.severity < 5) {
      title = `Thunderstorm developing ${condition.emoji}`;
      body = 'Severe weather — take cover and stay safe.';
    } else if (condition.severity >= 3 && prevCondition.severity < 3) {
      title = `${condition.label} starting ${condition.emoji}`;
      body = condition.label.toLowerCase().includes('snow')
        ? 'Snow on the way — wrap up warm!'
        : 'Rain on the way — grab an umbrella!';
    } else if (prevCondition.severity >= 3 && condition.severity < 2) {
      title = `Weather clearing up ${condition.emoji}`;
      body = `It's ${condition.label.toLowerCase()} now — ${temp}°C outside.`;
    } else if (conditionChanged && condition.severity !== prevCondition.severity) {
      title = `Weather update ${condition.emoji}`;
      body = `Now ${condition.label.toLowerCase()}, ${temp}°C.`;
    } else if (tempDrop) {
      title = `Temperature dropping 🌡️`;
      body = `Down to ${temp}°C — was ${last.temp}°C. Layer up!`;
    } else if (tempRise) {
      title = `Warming up outside 🌡️`;
      body = `Now ${temp}°C — up from ${last.temp}°C.`;
    } else if (windSpike) {
      title = `Strong winds picking up 💨`;
      body = `Wind speed at ${wind} km/h — be careful outside.`;
    }

    if (title) {
      await showLocalNotification(title, body, '/');
    }
  } catch {} // location denied or fetch failed — silent
}

// Check for tasks due today and fire local notifications
export async function checkTaskReminders(uid) {
  if (Notification.permission !== 'granted') return;
  try {
    const { tasksService } = await import('@/lib/firestoreService');
    const tasks = await tasksService.list(uid);
    const today = new Date().toISOString().slice(0, 10);
    const due = tasks.filter(
      (t) => t.status !== 'done' && t.due_date && String(t.due_date).slice(0, 10) === today
    );
    if (due.length === 0) return;
    await showLocalNotification(
      due.length === 1 ? `Task due today: ${due[0].title}` : `${due.length} tasks due today`,
      due.length === 1 ? 'Tap to open your tasks' : due.map((t) => t.title).slice(0, 3).join(', '),
      '/tasks'
    );
  } catch {}
}

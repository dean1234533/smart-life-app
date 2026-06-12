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

// Check today's weather and alert for rain / storms
export async function checkWeatherAlerts() {
  if (Notification.permission !== 'granted') return;
  const alertedKey = `weather_alert_${new Date().toISOString().slice(0, 10)}`;
  if (localStorage.getItem(alertedKey)) return; // already alerted today

  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
    );
    const { latitude: lat, longitude: lon } = pos.coords;
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weather_code,precipitation_sum&timezone=auto&forecast_days=1`
    );
    if (!res.ok) return;
    const data = await res.json();
    const code = data.daily?.weather_code?.[0];
    const rain = data.daily?.precipitation_sum?.[0] || 0;

    let title = null;
    let body = null;
    if (code >= 95) {
      title = 'Thunderstorm forecast today ⛈️';
      body = 'Take cover and stay safe — storms expected.';
    } else if (code >= 80 || (code >= 51 && code <= 67)) {
      title = 'Rain expected today 🌧️';
      body = rain > 0 ? `${rain.toFixed(1)}mm of rain forecast — bring an umbrella!` : 'Showers likely today — bring an umbrella!';
    }

    if (title) {
      await showLocalNotification(title, body, '/');
      localStorage.setItem(alertedKey, '1');
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

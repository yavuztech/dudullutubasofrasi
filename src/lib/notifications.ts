/**
 * Notification + Vibration helpers
 *
 * Strategy:
 *  - Foreground: Firestore listeners detect changes → browser Notification + vibrate
 *  - Background: FCM push via Firebase Functions (firebase-messaging-sw.js)
 *
 * Permission is requested once and stored in localStorage.
 */

export const NOTIF_PERMISSION_KEY = 'notif_permission_asked';

/** Request Web Push permission once per device */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') {
    localStorage.setItem(NOTIF_PERMISSION_KEY, 'true');
    return Notification.permission;
  }
  const result = await Notification.requestPermission();
  localStorage.setItem(NOTIF_PERMISSION_KEY, 'true');
  return result;
}

export function hasAskedPermission(): boolean {
  return localStorage.getItem(NOTIF_PERMISSION_KEY) === 'true';
}

/** Show a local browser notification */
export function showNotification(title: string, body: string, icon = '/icons/icon-192.svg') {
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') {
    // App is in foreground — we rely on toast UI instead of system notification
    return;
  }
  new Notification(title, { body, icon, badge: icon });
}

/** Vibrate the device (pattern in ms: vibrate, pause, vibrate …) */
export function vibrate(pattern: number | number[] = [200, 100, 200]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/** Get FCM registration token (requires service worker) */
export async function getFCMToken(): Promise<string | null> {
  try {
    // Lazy-import to avoid loading firebase/messaging on pages that don't need it
    const [{ getMessagingInstance }, { getToken }] = await Promise.all([
      import('./firebase'),
      import('firebase/messaging'),
    ]);
    const messaging = await getMessagingInstance();
    if (!messaging) return null;
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });
    return token;
  } catch {
    return null;
  }
}

// Firebase Messaging Service Worker
// Must be at the root of the hosted domain

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Config is injected at build time via __FIREBASE_CONFIG__ or hardcoded here
// For security, these are public/read-only Firebase client keys (safe to expose)
firebase.initializeApp(self.__FIREBASE_CONFIG__ || {
  apiKey:            '__VITE_FIREBASE_API_KEY__',
  authDomain:        '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId:         '__VITE_FIREBASE_PROJECT_ID__',
  storageBucket:     '__VITE_FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId:             '__VITE_FIREBASE_APP_ID__',
});

const messaging = firebase.messaging();

// Handle background push notifications
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  const notificationTitle = title || 'Tuba Sofrası';
  const notificationOptions = {
    body: body || '',
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: payload.data,
    requireInteraction: true,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click → focus/open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

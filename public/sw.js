/* TruckWys service worker — Web Push delivery.
 * Receives pushes sent by the backend (core/services/web_push.py) and shows
 * OS notifications; clicking focuses/opens the app at the event's link.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'TruckWys', message: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'TruckWys';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.message || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: data.event_id || undefined, // collapses duplicate pushes
      data: { link: data.link || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(link);
          return;
        }
      }
      return self.clients.openWindow(link);
    })
  );
});

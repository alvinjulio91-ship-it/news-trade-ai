/* XAU NEWS AI — Push Notification Service Worker (WIB / Asia/Jakarta) */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: '🔔 XAU NEWS AI',
    body: 'Economic News Update (WIB)',
    tag: 'xau-news-ai-push',
    silent: false,
    vibrate: [120, 60, 120],
    data: {
      url: '/',
    },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    tag: payload.tag || 'xau-news-ai-push',
    renotify: false,
    silent: Boolean(payload.silent),
    vibrate: payload.vibrate && Array.isArray(payload.vibrate) ? payload.vibrate : undefined,
    data: payload.data || { url: '/' },
    badge: '/icon.svg',
    icon: '/icon.svg',
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

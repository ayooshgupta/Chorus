// Chorus service worker — web push only. No offline caching.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  // Pass the title through as-is when it's a string (including ''), so the
  // payload can send an empty title and let iOS show just the app name — this
  // avoids iOS appending " from Chorus" to a custom title in the banner.
  const title = typeof data.title === 'string' ? data.title : 'Chorus';
  const options = {
    body: data.body || '',
    icon: '/chorus-192.png',
    badge: '/chorus-192.png',
    tag: data.tag || 'chorus-daily',
    renotify: true,
    data: { url: data.url || '/home' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const url = new URL(client.url);
        if (url.pathname === target && 'focus' in client) return client.focus();
      }
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

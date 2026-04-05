const CACHE = 'coach-hours-v5';
const ASSETS = [
  './index.html', './manifest.json',
  './css/main.css',
  './js/main.js',
  './js/modules/firebase.js',
  './js/modules/state.js',
  './js/modules/i18n.js',
  './js/modules/utils.js',
  './js/modules/data.js',
  './js/modules/ui.js',
  './js/modules/calendar.js',
  './js/modules/sessions.js',
  './js/modules/groups.js',
  './js/modules/summary.js',
  './js/modules/settings.js',
  './js/modules/admin.js',
  './js/modules/auth.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Network-first: always fetch fresh when online, fall back to cache when offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

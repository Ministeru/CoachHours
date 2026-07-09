const CACHE = 'coach-hours-v11';
const ASSETS = [
  './index.html', './manifest.json',
  './css/main.css',
  './js/main.js',
  './js/modules/firebase.js',
  './js/modules/state.js',
  './js/modules/i18n.js',
  './js/modules/utils.js',
  './js/modules/data.js',
  './js/modules/qrcode-lib.js',
  './js/modules/ui.js',
  './js/modules/calendar.js',
  './js/modules/sessions.js',
  './js/modules/groups.js',
  './js/modules/summary.js',
  './js/modules/settings.js',
  './js/modules/admin.js',
  './js/modules/daypicker.js',
  './js/modules/events.js',
  './js/modules/auth.js',
];
// PDF export (summary.js) loads these from a CDN — warm the cache for offline use too, but as a
// best-effort side step, not part of the critical install path: a CDN hiccup here should never
// be able to fail the whole app-shell install the way a rejected addAll(ASSETS) would.
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  caches.open(CACHE).then(c => c.addAll(CDN_ASSETS)).catch(() => {});
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
        if (response.ok && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone).catch(() => {}));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

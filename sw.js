/* Service worker — precaches the whole game so it runs fully offline.
   Strategy: stale-while-revalidate. Guests get the cached copy instantly;
   any updated file (e.g. edited content.js) is fetched in the background
   and used on the NEXT load. Bump VERSION to force a clean re-cache. */
const VERSION = 'v6';
const CACHE = `zellv-nad-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/main.js',
  './js/drag.js',
  './js/shield.js',
  './js/content.js',
  './assets/body.svg',
  './assets/fonts/syne-latin.woff2',
  './assets/fonts/syne-latin-ext.woff2',
  './assets/fonts/inter-latin.woff2',
  './assets/fonts/inter-latin-ext.woff2',
  './assets/icons/icon.svg',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('zellv-nad-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/tests/')) return; // never cache the test pages

  const isNav = req.mode === 'navigate';
  const key = isNav ? new URL('./index.html', self.registration.scope).href : req;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });
    const network = fetch(isNav ? key : req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
        return res;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    const res = await network;
    return res || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});

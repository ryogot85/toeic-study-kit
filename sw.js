/* sw.js — offline cache for TOEIC Study Kit. The build stamps VERSION so every deploy refreshes the cache. */
const VERSION = 'kit-20260926-221206';
const FONTS = 'kit-fonts';
const CORE = ['./', 'index.html', 'drill.html', 'recall.html', 'phrase.html', 'reading.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: keep a copy of whatever was loaded once, so the typefaces also work offline
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      } catch (err) {
        return new Response('', { status: 503 });
      }
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Own files: answer from the cache at once (works offline), refresh the copy in the background
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    let hit = await cache.match(req, { ignoreSearch: true });
    if (!hit && req.mode === 'navigate') hit = await cache.match('index.html');
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); cache.put(req, copy); }
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    return res || new Response('オフラインです。いちどオンラインで開いてから使ってください。', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  })());
});

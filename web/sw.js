// Service worker v2.4 : l'application s'ouvre depuis le cache (rapide, même sans réseau), puis se met à jour en arrière-plan.
const V = 'ceni-hl-v18';
const FILES = ['./', './index.html', './app.js', './kv.js', './jszip.min.js', './tadidy.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  // tout le jeu de fichiers est mis en cache AVANT l'activation : jamais de mélange ancienne/nouvelle version
  e.waitUntil(caches.open(V).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'ceni-hl-data').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const nav = req.mode === 'navigate';
  e.respondWith((async () => {
    const cache = await caches.open(V);
    const hit = await cache.match(nav ? './index.html' : req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && r.ok && !nav) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    return r || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});

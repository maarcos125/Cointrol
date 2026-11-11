// Cointrol: funciona sin conexión. Solo guarda en caché los archivos de la app;
// tus datos viven en el almacenamiento local del móvil y nunca salen de él.
const CACHE = 'cointrol-v2';
const ASSETS = [
  './', 'index.html', 'css/game.css', 'js/core.js', 'js/game.js', 'js/views.js', 'js/forms.js', 'js/main.js',
  'manifest.webmanifest', 'fonts/vt323.woff2', 'fonts/press-start-2p.woff2',
  'icons/logo-pixel.png', 'icons/favicon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/maskable-192.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => /^cointrol-v\d/.test(k) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});

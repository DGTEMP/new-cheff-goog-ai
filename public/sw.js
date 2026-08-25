/* Chef Cozinha — Service Worker
   Necessário para o navegador oferecer a instalação do PWA (beforeinstallprompt).
   Estratégia: network-first com cache fallback (o PDV precisa sempre de dados frescos). */
const CACHE = 'chef-cozinha-v1';
const PRECACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => { })).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Socket.io e APIs: sempre rede, sem cache
  if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(req).then((res) => {
      // Atualiza o cache em background para páginas/estáticos
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => { });
      return res;
    }).catch(() =>
      caches.match(req).then((hit) => hit || caches.match('/'))
    )
  );
});

/* Background Sync (upsell offline-first): o navegador acorda o SW quando
   a conexão volta, mesmo sem a aba em foco. O SW repassa para a página,
   que esvazia a fila IndexedDB via /api/pedidos/offline-sync. */
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-pedidos') {
    e.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then((clientes) => {
        clientes.forEach((c) => c.postMessage({ tipo: 'flush-offline' }));
        return Promise.resolve();
      })
    );
  }
});

// Service worker do Milagres PMS — cache conservador.
// Cache-first apenas para assets estáticos imutáveis; todo o resto
// (páginas, API, Supabase) vai direto à rede para nunca servir dado velho.
const CACHE = "milagres-static-v1";
const STATIC_PATTERNS = [/^\/_next\/static\//, /^\/icons\//, /^\/images\//];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isStatic =
    event.request.method === "GET" &&
    url.origin === self.location.origin &&
    STATIC_PATTERNS.some((p) => p.test(url.pathname));

  if (!isStatic) return; // rede normal (páginas, API, auth)

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
    )
  );
});

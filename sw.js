const CACHE_NAME = "apr-digital-viatec-v13";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const file of APP_SHELL) {
        try {
          await cache.add(file);
        } catch (e) {
          console.warn("Falha ao cachear:", file, e);
        }
      }
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Não tentar cachear Supabase
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.com")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Para navegação/página principal:
  // tenta internet; se falhar, entrega index.html do cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put("./index.html", clone);
            cache.put("./", clone.clone());
          });
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match("./index.html")) ||
            (await cache.match("./")) ||
            new Response("APR offline não encontrado no cache. Abra o sistema uma vez com internet.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" }
            })
          );
        })
    );
    return;
  }

  // Para arquivos estáticos: cache first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return await cache.match("./index.html");
        });
    })
  );
});

const CACHE_NAME = "apr-digital-viatec-v18-icons";

const APP_SHELL = [
  "/Apr/",
  "/Apr/index.html",
  "/Apr/manifest.json",
  "/Apr/logo.png",
  "/Apr/icon-192.png",
  "/Apr/icon-512.png",
  "/Apr/apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
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

  // Não cachear chamadas reais do Supabase/API
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.com")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Página principal: cache primeiro.
  // Isso ajuda principalmente no celular ao atualizar a página sem internet.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedIndex =
          (await cache.match("/Apr/index.html")) ||
          (await cache.match("/Apr/"));

        // Se tiver index no cache, entrega ele imediatamente.
        // Depois, se tiver internet, tenta atualizar o cache em segundo plano.
        if (cachedIndex) {
          fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put("/Apr/", response.clone());
                cache.put("/Apr/index.html", response.clone());
              }
            })
            .catch(() => {});

          return cachedIndex;
        }

        // Se ainda não tiver cache, tenta internet.
        try {
          const response = await fetch(request);
          if (response && response.status === 200) {
            await cache.put("/Apr/", response.clone());
            await cache.put("/Apr/index.html", response.clone());
          }
          return response;
        } catch (e) {
          return new Response(
            "APR offline não encontrado no cache. Abra o sistema uma vez com internet.",
            {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" }
            }
          );
        }
      })
    );
    return;
  }

  // Arquivos estáticos e biblioteca do Supabase: cache first
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

          if (request.destination === "script") {
            return await cache.match("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
          }

          return await cache.match("/Apr/index.html");
        });
    })
  );
});

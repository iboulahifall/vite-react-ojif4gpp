/* KËR — Service Worker
   Stratégie :
   - App-shell (HTML/CSS/JS/icônes) : cache-first, pour un démarrage rapide même
     sur connexion sénégalaise faible (§34).
   - Requêtes Supabase (API/données) : toujours réseau, JAMAIS servies depuis le
     cache — on ne veut pas afficher un loyer périmé comme s'il était à jour.
*/
const CACHE = "ker-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ne jamais mettre en cache les appels de données/API ni l'auth.
  const isData =
    url.hostname.endsWith("supabase.co") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/storage/");

  if (isData || event.request.method !== "GET") {
    event.respondWith(fetch(event.request));
    return;
  }

  // App-shell : cache d'abord, réseau en secours (et on met à jour le cache).
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("/index.html"));
    })
  );
});

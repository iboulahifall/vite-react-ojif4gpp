/* WALLU — Service Worker
   Stratégie :
   - Navigation / document HTML : NETWORK-FIRST. On va d'abord chercher la
     version fraîche en ligne (pour qu'une nouvelle mise en prod s'affiche
     tout de suite), et on ne retombe sur le cache que hors-ligne.
   - Assets statiques (icônes, manifest) : cache-first, pour un démarrage
     rapide même sur connexion faible.
   - Requêtes Supabase (API/données/auth/storage) : toujours réseau, JAMAIS
     servies depuis le cache — on ne veut pas afficher un loyer périmé.
*/
const CACHE = "wallu-shell-v2";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
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
  const req = event.request;
  const url = new URL(req.url);

  // Ne jamais mettre en cache les appels de données/API ni l'auth.
  const isData =
    url.hostname.endsWith("supabase.co") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/storage/");

  if (isData || req.method !== "GET") {
    event.respondWith(fetch(req));
    return;
  }

  // Navigation (le document HTML de l'app) : NETWORK-FIRST.
  // On sert la version fraîche si le réseau répond, sinon le cache.
  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/index.html")))
    );
    return;
  }

  // Assets statiques (icônes, manifest, JS/CSS hashés) : cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("/index.html"));
    })
  );
});
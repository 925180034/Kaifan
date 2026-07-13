const CACHE_NAME = "kaifan-pwa-20260712-generation-status";
const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/styles.css",
  "/manifest.webmanifest",
  "/assets/favicon.svg",
  "/src/app.js",
  "/src/sampleData.js",
  "/src/appState.js",
  "/src/decisionEngine.js",
  "/src/platformLinks.js",
  "/src/profile.js",
  "/src/learning.js",
  "/src/history.js",
  "/src/storage.js",
  "/src/memorySync.js",
  "/src/actionPlan.js",
  "/src/favorites.js",
  "/src/prepTimeline.js",
  "/src/servings.js",
  "/src/apiClient.js",
  "/src/html.js",
  "/src/generationStatus.js",
  "/src/pwa.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("kaifan-pwa-") && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/", { ignoreSearch: true }).then((cached) =>
          cached || caches.match("/index.html", { ignoreSearch: true })
        )
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (url.origin === self.location.origin && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

const CACHE_NAME = "kaifan-pwa";
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
  "/src/pwa.js",
  "/src/weather.js"
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

  event.respondWith(networkFirst(request, url));
});

async function networkFirst(request, url) {
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (url.origin === self.location.origin && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      return (await caches.match("/")) || caches.match("/index.html");
    }
    return Response.error();
  }
}

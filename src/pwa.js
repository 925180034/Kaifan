export const serviceWorkerCacheFiles = [
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

export async function registerServiceWorker(navigatorObj = globalThis.navigator) {
  if (!navigatorObj?.serviceWorker?.register) return false;

  try {
    await navigatorObj.serviceWorker.register("/sw.js", { scope: "/" });
    return true;
  } catch {
    return false;
  }
}

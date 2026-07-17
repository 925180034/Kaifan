const LEGACY_CACHE_PREFIX = "kaifan-pwa-";

export async function clearLegacyPwa({
  cacheStorage = globalThis.caches,
  serviceWorker = globalThis.navigator?.serviceWorker,
  reload = () => globalThis.window?.location?.reload()
} = {}) {
  if (!cacheStorage || !serviceWorker) return false;

  const cacheNames = await cacheStorage.keys();
  const legacyCaches = cacheNames.filter((name) => name.startsWith(LEGACY_CACHE_PREFIX));
  if (!legacyCaches.length) return false;

  await Promise.all(legacyCaches.map((name) => cacheStorage.delete(name)));
  const registrations = await serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  reload();
  return true;
}

clearLegacyPwa().catch(() => {});

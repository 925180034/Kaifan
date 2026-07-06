const memoryStore = new Map();

function getStorage() {
  try {
    const key = "__kaifan_storage_test__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return window.localStorage;
  } catch {
    return {
      getItem: (key) => memoryStore.get(key) ?? null,
      setItem: (key, value) => memoryStore.set(key, value),
      removeItem: (key) => memoryStore.delete(key)
    };
  }
}

const storage = getStorage();

export function loadState(key, fallback) {
  const raw = storage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveState(key, value) {
  storage.setItem(key, JSON.stringify(value));
}

export function clearState(key) {
  storage.removeItem(key);
}

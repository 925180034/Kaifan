export function createLatestSync(saveSnapshot) {
  let isSaving = false;
  let pending = null;
  let drainPromise = Promise.resolve();

  return function sync(userId, snapshot) {
    pending = { userId, snapshot: cloneSnapshot(snapshot) };
    if (!isSaving) {
      drainPromise = drain();
    }
    return drainPromise;
  };

  async function drain() {
    isSaving = true;
    let lastError = null;

    try {
      while (pending) {
        const next = pending;
        pending = null;
        try {
          await saveSnapshot(next.userId, next.snapshot);
          lastError = null;
        } catch (error) {
          lastError = error;
        }
      }
    } finally {
      isSaving = false;
      if (pending) {
        drainPromise = drain();
        return drainPromise;
      }
    }

    if (lastError) {
      throw lastError;
    }
  }
}

export function createMemorySync(saveMemory) {
  return createLatestSync(saveMemory);
}

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot ?? {}));
}

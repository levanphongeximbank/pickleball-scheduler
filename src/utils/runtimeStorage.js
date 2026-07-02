const MEMORY_KEY = "__pickleballRuntimeStorage";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

/**
 * Browser localStorage when available; otherwise in-memory (Node/Vercel serverless).
 */
export function getRuntimeStorage() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      return localStorage;
    }
  } catch {
    // Some environments throw when touching localStorage.
  }

  if (!globalThis[MEMORY_KEY]) {
    globalThis[MEMORY_KEY] = createMemoryStorage();
  }
  return globalThis[MEMORY_KEY];
}

export function resetRuntimeStorage() {
  if (globalThis[MEMORY_KEY]) {
    globalThis[MEMORY_KEY].clear();
  }
}

function getStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

function getCollectionKey(collection) {
  return `pickleball-billing-${collection}-v1`;
}

export function createLocalStorageBillingStore(storage = getStorage()) {
  return {
    mode: "local",
    read(collection) {
      if (!storage) {
        return [];
      }

      try {
        const raw = storage.getItem(getCollectionKey(collection));
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    write(collection, value) {
      if (!storage) {
        return value;
      }

      storage.setItem(getCollectionKey(collection), JSON.stringify(value));
      return value;
    },
  };
}

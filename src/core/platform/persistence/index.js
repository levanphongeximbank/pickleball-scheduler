function createMemoryPersistenceAdapter({ namespace = "core-platform" } = {}) {
  const stores = new Map();

  return {
    namespace,
    read(collection) {
      if (!stores.has(collection)) {
        stores.set(collection, []);
      }
      return stores.get(collection);
    },
    write(collection, value) {
      stores.set(collection, value);
      return value;
    },
    append(collection, item) {
      const current = this.read(collection, []);
      current.push(item);
      this.write(collection, current);
      return item;
    },
  };
}

export function createPlatformPersistenceAdapter(options = {}) {
  return createMemoryPersistenceAdapter(options);
}

export function createBrowserPlatformPersistenceAdapter({ namespace = "core-platform" } = {}) {
  const storage = typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  const memoryStore = new Map();

  function getStorageKey(collection) {
    return `${namespace}:${collection}`;
  }

  return {
    namespace,
    read(collection, defaultValue = []) {
      if (storage) {
        const raw = storage.getItem(getStorageKey(collection));
        if (!raw) {
          return defaultValue;
        }

        try {
          return JSON.parse(raw);
        } catch {
          return defaultValue;
        }
      }

      const cached = memoryStore.get(getStorageKey(collection));
      return cached === undefined ? defaultValue : cached;
    },
    write(collection, value) {
      if (storage) {
        storage.setItem(getStorageKey(collection), JSON.stringify(value));
        return value;
      }

      memoryStore.set(getStorageKey(collection), value);
      return value;
    },
    append(collection, item) {
      const current = this.read(collection, []);
      current.push(item);
      this.write(collection, current);
      return item;
    },
  };
}

export function migrateLegacyV4Tenant(input = {}) {
  return {
    id: input.tenant_id || input.clubId || `tenant-${Date.now()}`,
    tenant_id: input.tenant_id || input.clubId || `tenant-${Date.now()}`,
    name: input.name || input.clubName || "Unnamed tenant",
    plan: input.plan || "trial",
    status: input.status || "active",
    created_at: input.created_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString(),
  };
}

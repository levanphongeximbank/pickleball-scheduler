/**
 * Phase 42K — in-memory registry cache (React Query–style keys, no localStorage SoT).
 */

const registryCache = new Map();
const inflightControllers = new Map();

export const CLUB_REGISTRY_SCOPE = Object.freeze({
  TENANT: "tenant",
  PLATFORM: "platform",
  DISCOVER: "discover",
});

export function buildClubRegistryCacheKey(scope, tenantId = null, filters = {}) {
  const f = filters && typeof filters === "object" ? filters : {};
  const normalized = {
    includeInactive: Boolean(f.includeInactive),
    search: String(f.search || "").trim().toLowerCase(),
    status: String(f.status || "all"),
    tenantFilter: String(f.tenantFilter || "").trim(),
  };
  return JSON.stringify({
    scope: String(scope || ""),
    tenantId: tenantId ? String(tenantId) : null,
    filters: normalized,
  });
}

export function readClubRegistryCache(cacheKey) {
  const entry = registryCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  return entry;
}

export function writeClubRegistryCache(cacheKey, clubs) {
  registryCache.set(cacheKey, {
    clubs: Array.isArray(clubs) ? clubs : [],
    at: Date.now(),
  });
}

export function cancelClubRegistryInflight(cacheKey) {
  const controller = inflightControllers.get(cacheKey);
  if (controller) {
    controller.abort();
    inflightControllers.delete(cacheKey);
  }
}

export function registerClubRegistryInflight(cacheKey, controller) {
  cancelClubRegistryInflight(cacheKey);
  inflightControllers.set(cacheKey, controller);
}

export function clearClubRegistryInflight(cacheKey) {
  inflightControllers.delete(cacheKey);
}

/** Invalidate tenant and platform caches (not discover). */
export function invalidateClubRegistryCache({ tenantId = null, scope = null } = {}) {
  const tid = tenantId ? String(tenantId) : null;
  const scopeFilter = scope ? String(scope) : null;

  for (const key of [...registryCache.keys()]) {
    try {
      const parsed = JSON.parse(key);
      if (scopeFilter && parsed.scope !== scopeFilter) {
        continue;
      }
      if (tid && parsed.tenantId && parsed.tenantId !== tid && parsed.scope === CLUB_REGISTRY_SCOPE.TENANT) {
        continue;
      }
      if (tid && parsed.scope === CLUB_REGISTRY_SCOPE.PLATFORM && parsed.filters?.tenantFilter) {
        if (parsed.filters.tenantFilter !== tid) {
          continue;
        }
      }
      registryCache.delete(key);
      cancelClubRegistryInflight(key);
    } catch {
      registryCache.delete(key);
    }
  }
}

export function invalidateAllClubRegistryCache() {
  for (const key of [...inflightControllers.keys()]) {
    cancelClubRegistryInflight(key);
  }
  registryCache.clear();
}

/** Test helper */
export function resetClubRegistryCacheForTests() {
  invalidateAllClubRegistryCache();
}

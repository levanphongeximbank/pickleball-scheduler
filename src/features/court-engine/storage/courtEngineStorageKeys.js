/**
 * Court Engine storage key builders (shared; no localStorage side effects).
 */

const STORAGE_KEY_PREFIX = "pickleball-court-engine-v1";
const ACTIVE_KEY_PREFIX = "pickleball-court-engine-active-v1";

/** Legacy key before Phase 20 tenant scoping (club-only). */
export function legacyStorageKey(clubId) {
  return `${STORAGE_KEY_PREFIX}::${clubId}`;
}

export function legacyActiveKey(clubId) {
  return `${ACTIVE_KEY_PREFIX}::${clubId}`;
}

export function buildCourtEngineStorageKey(clubId, tenantId) {
  const club = String(clubId || "").trim();
  const tenant = String(tenantId || "").trim();
  if (!club) {
    return `${STORAGE_KEY_PREFIX}::`;
  }
  if (!tenant) {
    return legacyStorageKey(club);
  }
  return `${STORAGE_KEY_PREFIX}::${tenant}::${club}`;
}

export function buildCourtEngineActiveKey(clubId, tenantId) {
  const club = String(clubId || "").trim();
  const tenant = String(tenantId || "").trim();
  if (!club) {
    return `${ACTIVE_KEY_PREFIX}::`;
  }
  if (!tenant) {
    return legacyActiveKey(club);
  }
  return `${ACTIVE_KEY_PREFIX}::${tenant}::${club}`;
}

export { STORAGE_KEY_PREFIX, ACTIVE_KEY_PREFIX };

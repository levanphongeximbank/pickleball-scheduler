/**
 * In-module inbox storage for Phase 1.1.
 * Keeps notification records + idempotency index (tenantId + idempotencyKey).
 * Not exported from the public module API.
 */

const INBOX_KEY = "pickleball-notification-inbox-v1";
const IDEMPOTENCY_KEY = "pickleball-notification-idempotency-v1";

function readJson(key, fallback) {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadInboxRecords() {
  const items = readJson(INBOX_KEY, []);
  return Array.isArray(items) ? items : [];
}

export function saveInboxRecords(items) {
  writeJson(INBOX_KEY, Array.isArray(items) ? items : []);
}

/**
 * Map of `${tenantId}::${idempotencyKey}` → notification record id
 */
export function loadIdempotencyIndex() {
  const index = readJson(IDEMPOTENCY_KEY, {});
  return index && typeof index === "object" && !Array.isArray(index) ? index : {};
}

export function saveIdempotencyIndex(index) {
  writeJson(IDEMPOTENCY_KEY, index && typeof index === "object" ? index : {});
}

export function makeIdempotencyIndexKey(tenantId, idempotencyKey) {
  return `${tenantId}::${idempotencyKey}`;
}

export function clearNotificationInboxStorage() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(INBOX_KEY);
  localStorage.removeItem(IDEMPOTENCY_KEY);
}

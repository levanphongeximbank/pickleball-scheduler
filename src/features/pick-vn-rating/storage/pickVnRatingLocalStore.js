const KEYS = {
  ratings: "pickleball-pick-vn-ratings-v1",
  audit: "pickleball-pick-vn-rating-audit-v1",
};

function readJson(key, fallback) {
  if (typeof localStorage === "undefined") {
    return fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota in tests
  }
}

let memoryStore = null;

function ensureMemoryStore() {
  if (!memoryStore) {
    memoryStore = { ratings: [], audit: [] };
  }
  return memoryStore;
}

function useMemory() {
  return typeof localStorage === "undefined";
}

export function resetPickVnRatingLocalStoreForTests() {
  memoryStore = null;
  if (typeof localStorage !== "undefined") {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  }
}

export function listPickVnRatings() {
  if (useMemory()) {
    return [...ensureMemoryStore().ratings];
  }
  return readJson(KEYS.ratings, []);
}

export function upsertPickVnRating(record) {
  const rows = listPickVnRatings();
  const index = rows.findIndex((item) => String(item.id) === String(record.id));
  const next = index >= 0 ? rows.map((item, i) => (i === index ? record : item)) : [...rows, record];

  if (useMemory()) {
    ensureMemoryStore().ratings = next;
  } else {
    writeJson(KEYS.ratings, next);
  }
  return record;
}

export function findPickVnRatingByAuthUserId(authUserId) {
  if (!authUserId) {
    return null;
  }
  return (
    listPickVnRatings().find((item) => String(item.authUserId) === String(authUserId)) || null
  );
}

export function appendPickVnRatingAuditLog(entry) {
  const row = {
    id: `pvn-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  };

  if (useMemory()) {
    ensureMemoryStore().audit = [...ensureMemoryStore().audit, row].slice(-500);
  } else {
    const audit = readJson(KEYS.audit, []);
    writeJson(KEYS.audit, [...audit, row].slice(-500));
  }
  return row;
}

export function listPickVnRatingAuditLogs() {
  if (useMemory()) {
    return [...ensureMemoryStore().audit];
  }
  return readJson(KEYS.audit, []);
}

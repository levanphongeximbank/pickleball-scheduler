const STORAGE_KEY = "pickleball-player-rating-assessment-v1";

function readJson(fallback) {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(value) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota in tests
  }
}

let memoryRows = null;

export function resetPlayerRatingAssessmentStoreForTests() {
  memoryRows = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function listRows() {
  if (memoryRows) return [...memoryRows];
  const data = readJson({ byAuthUserId: {} });
  return Object.values(data.byAuthUserId || {});
}

function writeRows(byAuthUserId) {
  if (memoryRows) {
    memoryRows = Object.values(byAuthUserId);
    return;
  }
  writeJson({ byAuthUserId });
}

export function getPlayerAssessmentByAuthUserId(authUserId) {
  if (!authUserId) return null;
  const rows = listRows();
  return rows.find((row) => String(row.authUserId) === String(authUserId)) || null;
}

export function savePlayerAssessment(record) {
  if (!record?.authUserId) return null;
  const map = {};
  for (const row of listRows()) {
    map[String(row.authUserId)] = row;
  }
  const now = new Date().toISOString();
  const next = {
    ...record,
    authUserId: String(record.authUserId),
    updatedAt: now,
    createdAt: record.createdAt || now,
  };
  map[String(record.authUserId)] = next;
  writeRows(map);
  return next;
}

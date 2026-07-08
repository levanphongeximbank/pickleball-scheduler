import { DEFAULT_VPR_POINT_TABLE } from "../constants/defaultPointConfig.js";

const KEYS = {
  pointConfig: "pickleball-vpr-point-config-v1",
  certifications: "pickleball-vpr-certifications-v1",
  athletes: "pickleball-vpr-athletes-v1",
  links: "pickleball-vpr-athlete-links-v1",
  ledger: "pickleball-vpr-ledger-v1",
  leaderboard: "pickleball-vpr-leaderboard-v1",
  audit: "pickleball-vpr-audit-v1",
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
    // ignore quota errors in tests
  }
}

let memoryStore = null;

function ensureMemoryStore() {
  if (!memoryStore) {
    memoryStore = {
      pointConfig: structuredClone(DEFAULT_VPR_POINT_TABLE),
      certifications: [],
      athletes: [],
      links: [],
      ledger: [],
      leaderboard: [],
      audit: [],
    };
  }
  return memoryStore;
}

function useMemory() {
  return typeof localStorage === "undefined";
}

export function resetVprLocalStoreForTests() {
  memoryStore = null;
  if (typeof localStorage !== "undefined") {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  }
}

export function getVprPointConfig() {
  if (useMemory()) {
    return ensureMemoryStore().pointConfig;
  }
  const stored = readJson(KEYS.pointConfig, null);
  if (!stored) {
    writeJson(KEYS.pointConfig, DEFAULT_VPR_POINT_TABLE);
    return structuredClone(DEFAULT_VPR_POINT_TABLE);
  }
  return stored;
}

export function setVprPointConfig(table) {
  if (useMemory()) {
    ensureMemoryStore().pointConfig = table;
    return;
  }
  writeJson(KEYS.pointConfig, table);
}

export function listCertifications() {
  if (useMemory()) {
    return [...ensureMemoryStore().certifications];
  }
  return readJson(KEYS.certifications, []);
}

export function saveCertifications(rows) {
  if (useMemory()) {
    ensureMemoryStore().certifications = rows;
    return;
  }
  writeJson(KEYS.certifications, rows);
}

export function upsertCertification(row) {
  const rows = listCertifications();
  const idx = rows.findIndex(
    (item) =>
      item.clubId === row.clubId && String(item.tournamentId) === String(row.tournamentId)
  );
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...row, updatedAt: new Date().toISOString() };
  } else {
    rows.push({
      id: row.id || `vpr-cert-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...row,
    });
  }
  saveCertifications(rows);
  return rows.find(
    (item) =>
      item.clubId === row.clubId && String(item.tournamentId) === String(row.tournamentId)
  );
}

export function listAthletes() {
  if (useMemory()) {
    return [...ensureMemoryStore().athletes];
  }
  return readJson(KEYS.athletes, []);
}

export function saveAthletes(rows) {
  if (useMemory()) {
    ensureMemoryStore().athletes = rows;
    return;
  }
  writeJson(KEYS.athletes, rows);
}

export function listAthleteLinks() {
  if (useMemory()) {
    return [...ensureMemoryStore().links];
  }
  return readJson(KEYS.links, []);
}

export function saveAthleteLinks(rows) {
  if (useMemory()) {
    ensureMemoryStore().links = rows;
    return;
  }
  writeJson(KEYS.links, rows);
}

export function listLedgerEntries() {
  if (useMemory()) {
    return [...ensureMemoryStore().ledger];
  }
  return readJson(KEYS.ledger, []);
}

export function saveLedgerEntries(rows) {
  if (useMemory()) {
    ensureMemoryStore().ledger = rows;
    return;
  }
  writeJson(KEYS.ledger, rows);
}

export function appendLedgerEntries(entries) {
  const rows = listLedgerEntries();
  rows.unshift(...entries);
  saveLedgerEntries(rows);
  return entries;
}

export function removeLedgerByTournament(clubId, tournamentId) {
  const rows = listLedgerEntries().filter(
    (item) =>
      !(item.clubId === clubId && String(item.tournamentId) === String(tournamentId))
  );
  saveLedgerEntries(rows);
  return rows;
}

export function listLeaderboardRows() {
  if (useMemory()) {
    return [...ensureMemoryStore().leaderboard];
  }
  const stored = readJson(KEYS.leaderboard, []);
  return Array.isArray(stored) ? stored : [];
}

export function saveLeaderboardRows(rows) {
  if (useMemory()) {
    ensureMemoryStore().leaderboard = rows;
    return;
  }
  writeJson(KEYS.leaderboard, rows);
}

export function listVprAuditLogs() {
  if (useMemory()) {
    return [...ensureMemoryStore().audit];
  }
  return readJson(KEYS.audit, []);
}

export function appendVprAuditLog(entry) {
  const rows = listVprAuditLogs();
  rows.unshift({
    id: `vpr-audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  });
  const capped = rows.slice(0, 500);
  if (useMemory()) {
    ensureMemoryStore().audit = capped;
    return capped[0];
  }
  writeJson(KEYS.audit, capped);
  return capped[0];
}

/** Phase 42 — bump LocalStorage schema; wipe business keys, no migrate. */

export const STORAGE_SCHEMA_VERSION_KEY = "pickleball-storage-schema-version";
export const STORAGE_SCHEMA_VERSION = 42;

const EXACT_KEYS_TO_REMOVE = [
  "pickleball-clubs-v1",
  "pickleball-active-club-v1",
  "pickleball-athlete-club-link-v1",
  "pickleball-cloud-db-v1",
  "pickleball-offline-queue-v1",
  "pickleball-offline-queue-meta-v1",
  "pickleball-offline-queue-lock-v1",
  "pickleball-ai",
  "pickleball-director",
  "pickleball-active-slot",
  "pickleball-tournament-rounds",
  "pickleball-tournament-bracket-winners",
  "pickleball_history",
  "pickleball_waiting",
  "pickleball_ai_waiting",
  "players",
  "courts",
];

const PREFIXES_TO_REMOVE = [
  "pickleball-club-data-v3::",
  "pickleball-club-cloud-version-v1::",
  "pickleball-club-sync-meta-v1::",
  "pickleball-club-extension-v1::",
  "pickleball-ai::",
  "pickleball-ai-backup-snapshots::",
  "pickleball-court-engine-v1::",
  "pickleball-court-engine-active-v1::",
];

function shouldRemoveKey(key) {
  if (EXACT_KEYS_TO_REMOVE.includes(key)) {
    return true;
  }
  return PREFIXES_TO_REMOVE.some((prefix) => key.startsWith(prefix));
}

/**
 * If schema < 42, delete business LocalStorage keys (no merge).
 * Keeps auth session / UI prefs.
 * @returns {{ bumped: boolean, removed: number }}
 */
export function ensureStorageSchemaV42() {
  if (typeof localStorage === "undefined") {
    return { bumped: false, removed: 0 };
  }

  const current = Number(localStorage.getItem(STORAGE_SCHEMA_VERSION_KEY) || 0);
  if (current >= STORAGE_SCHEMA_VERSION) {
    return { bumped: false, removed: 0 };
  }

  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key) {
      keys.push(key);
    }
  }

  let removed = 0;
  for (const key of keys) {
    if (shouldRemoveKey(key)) {
      localStorage.removeItem(key);
      removed += 1;
    }
  }

  localStorage.setItem(STORAGE_SCHEMA_VERSION_KEY, String(STORAGE_SCHEMA_VERSION));
  return { bumped: true, removed };
}

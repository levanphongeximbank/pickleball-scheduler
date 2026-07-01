const DB_NAME = "pickleball-offline-v1";
const DB_VERSION = 1;
const STORE_CACHE = "cache";
const CACHE_KEYS = Object.freeze({
  COURTS: "courts",
  PLAYERS: "players",
  MATCHES: "matches",
  TOURNAMENTS: "tournaments",
  CHECKINS: "checkins",
});

let dbPromise = null;

/** Test-only: reset cached DB connection between test cases. */
export function resetOfflineDbForTests() {
  dbPromise = null;
}

function openDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function withStore(mode, callback) {
  const db = await openDb();
  if (!db) {
    return null;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, mode);
    const store = tx.objectStore(STORE_CACHE);
    const result = callback(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function setOfflineCache(key, data) {
  const payload = {
    data,
    cachedAt: new Date().toISOString(),
  };
  await withStore("readwrite", (store) => store.put(payload, key));
  return { ok: true };
}

export async function getOfflineCache(key) {
  const entry = await withStore("readonly", (store) => store.get(key));
  if (!entry) {
    return { ok: false, data: null };
  }
  return { ok: true, ...entry };
}

export async function clearOfflineCache(key) {
  await withStore("readwrite", (store) => store.delete(key));
  return { ok: true };
}

/** Snapshot important club data for offline viewing. */
export async function snapshotClubDataForOffline({ clubId, courts, players, tournaments, matches, checkins }) {
  const prefix = `club:${clubId}:`;
  const tasks = [];
  if (courts !== undefined) {
    tasks.push(setOfflineCache(`${prefix}${CACHE_KEYS.COURTS}`, courts));
  }
  if (players !== undefined) {
    tasks.push(setOfflineCache(`${prefix}${CACHE_KEYS.PLAYERS}`, players));
  }
  if (tournaments !== undefined) {
    tasks.push(setOfflineCache(`${prefix}${CACHE_KEYS.TOURNAMENTS}`, tournaments));
  }
  if (matches !== undefined) {
    tasks.push(setOfflineCache(`${prefix}${CACHE_KEYS.MATCHES}`, matches));
  }
  if (checkins !== undefined) {
    tasks.push(setOfflineCache(`${prefix}${CACHE_KEYS.CHECKINS}`, checkins));
  }
  await Promise.all(tasks);
  return { ok: true };
}

export async function loadClubOfflineSnapshot(clubId) {
  const prefix = `club:${clubId}:`;
  const [courts, players, tournaments, matches, checkins] = await Promise.all([
    getOfflineCache(`${prefix}${CACHE_KEYS.COURTS}`),
    getOfflineCache(`${prefix}${CACHE_KEYS.PLAYERS}`),
    getOfflineCache(`${prefix}${CACHE_KEYS.TOURNAMENTS}`),
    getOfflineCache(`${prefix}${CACHE_KEYS.MATCHES}`),
    getOfflineCache(`${prefix}${CACHE_KEYS.CHECKINS}`),
  ]);
  return {
    courts: courts.data || [],
    players: players.data || [],
    tournaments: tournaments.data || [],
    matches: matches.data || [],
    checkins: checkins.data || [],
    cachedAt: courts.cachedAt || players.cachedAt || null,
  };
}

export async function getOfflineSnapshotSummary(clubId) {
  const snapshot = await loadClubOfflineSnapshot(clubId);
  const entries = [
    [CACHE_KEYS.COURTS, snapshot.courts],
    [CACHE_KEYS.PLAYERS, snapshot.players],
    [CACHE_KEYS.TOURNAMENTS, snapshot.tournaments],
    [CACHE_KEYS.MATCHES, snapshot.matches],
    [CACHE_KEYS.CHECKINS, snapshot.checkins],
  ];

  const populated = entries.filter(([, value]) => Array.isArray(value) && value.length > 0);
  return {
    ok: true,
    clubId,
    hasSnapshot: populated.length > 0,
    itemCount: populated.reduce((sum, [, value]) => sum + value.length, 0),
    cachedAt: snapshot.cachedAt,
    sections: populated.map(([key, value]) => ({ key, count: value.length })),
  };
}

export { CACHE_KEYS };

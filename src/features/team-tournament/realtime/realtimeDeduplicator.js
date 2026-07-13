/**
 * TT-6B event deduplication with TTL and max size.
 */

export const DEDUPE_OUTCOMES = Object.freeze({
  ACCEPT: "accept",
  DUPLICATE_DISCARDED: "duplicate_discarded",
  STALE_DISCARDED: "stale_discarded",
  PAYLOAD_CONFLICT: "payload_conflict",
  NO_OP: "no_op",
});

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * @param {{ maxEntries?: number, ttlMs?: number }} [options]
 */
export function createRealtimeDeduplicator(options = {}) {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  /** @type {Map<string, { seenAt: number, entityVersion: number, payloadHash: string }>} */
  const eventIds = new Map();
  /** @type {Map<string, { version: number, hash: string }>} */
  const entityVersions = new Map();

  function pruneExpired(now = Date.now()) {
    for (const [key, entry] of eventIds.entries()) {
      if (now - entry.seenAt > ttlMs) {
        eventIds.delete(key);
      }
    }
  }

  function enforceMaxSize() {
    if (eventIds.size <= maxEntries) {
      return;
    }
    const sorted = [...eventIds.entries()].sort((a, b) => a[1].seenAt - b[1].seenAt);
    const removeCount = eventIds.size - maxEntries;
    for (let i = 0; i < removeCount; i += 1) {
      eventIds.delete(sorted[i][0]);
    }
  }

  /**
   * @param {object} event
   * @param {number} [localVersion]
   * @returns {{ outcome: string, reload?: boolean, reason?: string }}
   */
  function evaluate(event, localVersion = 0) {
    const now = Date.now();
    pruneExpired(now);

    const eventId = String(event?.eventId ?? "");
    const entityKey = `${event?.entityType}:${event?.entityId}`;
    const remoteVersion = Number(event?.entityVersion ?? 0);
    const remoteHash = String(event?.payloadHash ?? "");
    const local = Number(localVersion ?? 0);

    if (!eventId) {
      return { outcome: DEDUPE_OUTCOMES.STALE_DISCARDED, reason: "missing_event_id" };
    }

    const priorEvent = eventIds.get(eventId);
    if (priorEvent) {
      return { outcome: DEDUPE_OUTCOMES.DUPLICATE_DISCARDED, reason: "duplicate_event_id" };
    }

    const priorEntity = entityVersions.get(entityKey);
    if (priorEntity && remoteVersion < priorEntity.version) {
      return { outcome: DEDUPE_OUTCOMES.STALE_DISCARDED, reason: "stale_entity_version" };
    }
    if (remoteVersion < local) {
      return { outcome: DEDUPE_OUTCOMES.STALE_DISCARDED, reason: "stale_local_version" };
    }
    if (priorEntity && remoteVersion === priorEntity.version) {
      if (priorEntity.hash === remoteHash) {
        eventIds.set(eventId, { seenAt: now, entityVersion: remoteVersion, payloadHash: remoteHash });
        enforceMaxSize();
        return { outcome: DEDUPE_OUTCOMES.NO_OP, reason: "same_version_same_hash" };
      }
      return { outcome: DEDUPE_OUTCOMES.PAYLOAD_CONFLICT, reload: true, reason: "same_version_diff_hash" };
    }

    eventIds.set(eventId, { seenAt: now, entityVersion: remoteVersion, payloadHash: remoteHash });
    entityVersions.set(entityKey, { version: remoteVersion, hash: remoteHash });
    enforceMaxSize();

    if (remoteVersion > local + 1) {
      return { outcome: DEDUPE_OUTCOMES.ACCEPT, reload: true, reason: "version_gap" };
    }
    return { outcome: DEDUPE_OUTCOMES.ACCEPT, reload: true, reason: "next_version" };
  }

  function clearScope(entityType, entityId) {
    const entityKey = `${entityType}:${entityId}`;
    entityVersions.delete(entityKey);
  }

  function reset() {
    eventIds.clear();
    entityVersions.clear();
  }

  function size() {
    return eventIds.size;
  }

  return {
    evaluate,
    clearScope,
    reset,
    size,
    maxEntries,
    ttlMs,
  };
}

export const RECONNECT_BACKOFF_MS = Object.freeze([1000, 2000, 5000, 10000, 30000]);

/**
 * @param {number} attempt 1-based
 * @param {number[]} [schedule]
 * @returns {number}
 */
export function computeReconnectBackoffMs(attempt, schedule = RECONNECT_BACKOFF_MS) {
  const index = Math.max(0, Math.min(schedule.length - 1, attempt - 1));
  const base = schedule[index];
  const jitter = Math.floor(Math.random() * Math.min(250, base * 0.1));
  return base + jitter;
}

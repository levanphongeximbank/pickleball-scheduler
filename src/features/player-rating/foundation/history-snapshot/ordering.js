/**
 * Deterministic ordering helpers for history and snapshots (Phase 1D).
 * Ascending: primary timestamp → secondary timestamp → id.
 */

/**
 * @param {string|number} value
 * @returns {number}
 */
export function timestampSortValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/**
 * Ascending compare: effectiveAt → recordedAt → eventId
 * @param {{ effectiveAt: string|number, recordedAt: string|number, eventId: string }} a
 * @param {{ effectiveAt: string|number, recordedAt: string|number, eventId: string }} b
 * @returns {number}
 */
export function compareHistoryEntriesAscending(a, b) {
  const ea = timestampSortValue(a.effectiveAt);
  const eb = timestampSortValue(b.effectiveAt);
  if (ea !== eb) return ea < eb ? -1 : 1;

  const ra = timestampSortValue(a.recordedAt);
  const rb = timestampSortValue(b.recordedAt);
  if (ra !== rb) return ra < rb ? -1 : 1;

  if (a.eventId < b.eventId) return -1;
  if (a.eventId > b.eventId) return 1;
  return 0;
}

/**
 * Ascending compare: effectiveAt → createdAt → snapshotId
 * @param {{ effectiveAt: string|number, createdAt: string|number, snapshotId: string }} a
 * @param {{ effectiveAt: string|number, createdAt: string|number, snapshotId: string }} b
 * @returns {number}
 */
export function compareSnapshotsAscending(a, b) {
  const ea = timestampSortValue(a.effectiveAt);
  const eb = timestampSortValue(b.effectiveAt);
  if (ea !== eb) return ea < eb ? -1 : 1;

  const ca = timestampSortValue(a.createdAt);
  const cb = timestampSortValue(b.createdAt);
  if (ca !== cb) return ca < cb ? -1 : 1;

  if (a.snapshotId < b.snapshotId) return -1;
  if (a.snapshotId > b.snapshotId) return 1;
  return 0;
}

/**
 * @template T
 * @param {T[]} entries
 * @param {(a: T, b: T) => number} compare
 * @returns {T[]}
 */
export function sortDeterministically(entries, compare) {
  return [...entries].sort(compare);
}

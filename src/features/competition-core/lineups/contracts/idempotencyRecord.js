/**
 * CORE-06 Phase 1E — normalized idempotency record contract.
 * In-memory / test double only — no Production persistence.
 */

/**
 * @typedef {Object} LineupIdempotencyRecordV2
 * @property {string} idempotencyKey
 * @property {string|null} aggregateIdentity
 * @property {string|null} commandType
 * @property {string} canonicalPayloadFingerprint
 * @property {string|null} resultFingerprint
 * @property {unknown} actor
 * @property {string|null} source
 * @property {number|null} expectedVersion
 * @property {number|null} resultingVersion
 * @property {string|null} createdAt
 * @property {boolean} replayed
 * @property {unknown} [result]
 */

/**
 * @param {Partial<LineupIdempotencyRecordV2>} [partial]
 * @returns {LineupIdempotencyRecordV2}
 */
export function createLineupIdempotencyRecord(partial = {}) {
  return Object.freeze({
    idempotencyKey: String(partial.idempotencyKey || "").trim(),
    aggregateIdentity:
      partial.aggregateIdentity != null &&
      String(partial.aggregateIdentity).trim() !== ""
        ? String(partial.aggregateIdentity).trim()
        : null,
    commandType:
      partial.commandType != null && String(partial.commandType).trim() !== ""
        ? String(partial.commandType).trim()
        : null,
    canonicalPayloadFingerprint: String(
      partial.canonicalPayloadFingerprint || ""
    ).trim(),
    resultFingerprint:
      partial.resultFingerprint != null &&
      String(partial.resultFingerprint).trim() !== ""
        ? String(partial.resultFingerprint).trim()
        : null,
    actor:
      partial.actor && typeof partial.actor === "object"
        ? Object.freeze({ ...partial.actor })
        : partial.actor ?? null,
    source:
      partial.source != null && String(partial.source).trim() !== ""
        ? String(partial.source).trim()
        : null,
    expectedVersion:
      typeof partial.expectedVersion === "number" &&
      Number.isInteger(partial.expectedVersion)
        ? partial.expectedVersion
        : null,
    resultingVersion:
      typeof partial.resultingVersion === "number" &&
      Number.isInteger(partial.resultingVersion)
        ? partial.resultingVersion
        : null,
    createdAt:
      partial.createdAt != null && String(partial.createdAt).trim() !== ""
        ? String(partial.createdAt).trim()
        : null,
    replayed: partial.replayed === true,
    result: partial.result ?? null,
  });
}

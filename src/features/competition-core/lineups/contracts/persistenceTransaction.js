/**
 * CORE-06 Phase 1F — Production-ready persistence transaction contract.
 * Specification + test doubles only. No SQL. No RPC. No Production storage.
 */

export const LINEUP_PERSISTENCE_TX_METHODS = Object.freeze([
  "loadForUpdate",
  "lookupIdempotency",
  "claimIdempotency",
  "completeIdempotency",
  "releaseIdempotency",
  "commitCommand",
]);

/**
 * @typedef {Object} LineupPersistenceTransactionPort
 * @property {(identity: object) => Promise<object|null>} loadForUpdate
 * @property {(identity: object) => Promise<object>} lookupIdempotency
 * @property {(identity: object) => Promise<object>} claimIdempotency
 * @property {(identity: object, result: unknown) => Promise<object>} completeIdempotency
 * @property {(identity: object) => Promise<boolean>} releaseIdempotency
 * @property {(tx: object) => Promise<object>} commitCommand
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesLineupPersistenceTransactionPort(port) {
  if (!port || typeof port !== "object") return false;
  return LINEUP_PERSISTENCE_TX_METHODS.every(
    (name) => typeof /** @type {Record<string, unknown>} */ (port)[name] === "function"
  );
}

/**
 * Required Production database guarantees (documentary contract).
 */
export const LINEUP_PERSISTENCE_GUARANTEES = Object.freeze({
  uniqueIdempotencyIdentity: true,
  compareAndSwapOrRowLock: true,
  transactionIsolation: "READ_COMMITTED_OR_STRONGER",
  noPartialAuditWrite: true,
  noVersionBumpWithoutResultPersistence: true,
  noIdempotencyCompletionWithoutAggregateCommit: true,
  replaySafeResponseRetrieval: true,
  atomicBundle: Object.freeze([
    "aggregate_read_with_version",
    "expectedVersion_validation",
    "aggregate_mutation",
    "version_increment",
    "audit_append",
    "lifecycle_event_append",
    "idempotency_claim",
    "idempotency_completion",
    "idempotency_release_on_failure",
  ]),
});

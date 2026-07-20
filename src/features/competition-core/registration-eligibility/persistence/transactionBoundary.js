/**
 * Phase 1F — transaction boundary helpers + partial-success / reconciliation metadata.
 */

import { cloneJsonSafe, isNonEmptyString, PERSISTENCE_FOUNDATION_VERSION } from "../contracts/shared.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";

/**
 * @typedef {Object} PersistencePartialSuccess
 * @property {boolean} partialSuccess
 * @property {boolean} reconciliationRequired
 * @property {string[]} completedSteps
 * @property {string[]} failedSteps
 * @property {string|null} reconciliationId
 * @property {string|null} message
 * @property {string} persistenceVersion
 */

/**
 * @param {Partial<PersistencePartialSuccess>} partial
 * @returns {PersistencePartialSuccess}
 */
export function createPersistencePartialSuccess(partial = {}) {
  return Object.freeze({
    partialSuccess: partial.partialSuccess !== false,
    reconciliationRequired: partial.reconciliationRequired !== false,
    completedSteps: Array.isArray(partial.completedSteps)
      ? partial.completedSteps.map((s) => String(s))
      : [],
    failedSteps: Array.isArray(partial.failedSteps)
      ? partial.failedSteps.map((s) => String(s))
      : [],
    reconciliationId:
      partial.reconciliationId != null && String(partial.reconciliationId).trim() !== ""
        ? String(partial.reconciliationId).trim()
        : null,
    message:
      partial.message != null && String(partial.message).trim() !== ""
        ? String(partial.message).trim()
        : null,
    persistenceVersion: String(
      partial.persistenceVersion || PERSISTENCE_FOUNDATION_VERSION
    ),
  });
}

/**
 * @typedef {Object} PersistenceTransactionResult
 * @property {boolean} ok
 * @property {boolean} rolledBack
 * @property {boolean} atomic
 * @property {unknown} [result]
 * @property {PersistencePartialSuccess|null} [partialSuccess]
 * @property {Error|null} [error]
 */

/**
 * Run steps inside a store transaction when supported.
 *
 * Known transaction boundaries (Phase 1F):
 * - create draft + idempotency + audit
 * - submit + audit
 * - eligibility evidence + evaluation idempotency + audit
 * - reserve capacity + counters + idempotency + audit
 * - release capacity + counters + audit
 * - waitlist placement + registration transition + waitlist entry + audit
 * - promotion + reservation + registration transition + waitlist mutation + audit
 *
 * @param {{
 *   store: {
 *     supportsTransactions?: boolean,
 *     beginTransaction?: Function,
 *     commitTransaction?: Function,
 *     rollbackTransaction?: Function,
 *     saveReconciliationRecord?: Function,
 *   },
 *   operation: string,
 *   steps: Array<() => Promise<unknown>|unknown>,
 *   reconciliationId?: string|null,
 * }} input
 * @returns {Promise<PersistenceTransactionResult>}
 */
export async function runPersistenceTransaction(input) {
  const store = input?.store;
  const operation = String(input?.operation || "unknown");
  const steps = Array.isArray(input?.steps) ? input.steps : [];
  const supports =
    store &&
    store.supportsTransactions === true &&
    typeof store.beginTransaction === "function" &&
    typeof store.commitTransaction === "function" &&
    typeof store.rollbackTransaction === "function";

  /** @type {string[]} */
  const completedSteps = [];

  if (!supports) {
    // No real transaction — execute sequentially and surface reconciliation when a mid-step fails.
    try {
      let last = null;
      for (let i = 0; i < steps.length; i += 1) {
        last = await steps[i]();
        completedSteps.push(`${operation}:step-${i + 1}`);
      }
      return {
        ok: true,
        rolledBack: false,
        atomic: false,
        result: last,
        partialSuccess: null,
        error: null,
      };
    } catch (error) {
      const reconciliationId = isNonEmptyString(input.reconciliationId)
        ? String(input.reconciliationId).trim()
        : null;
      if (reconciliationId && typeof store?.saveReconciliationRecord === "function") {
        await store.saveReconciliationRecord({
          id: reconciliationId,
          operation,
          completedSteps: completedSteps.slice(),
          failedSteps: [`${operation}:step-${completedSteps.length + 1}`],
          reconciliationRequired: true,
          errorMessage: error instanceof Error ? error.message : String(error),
          persistenceVersion: PERSISTENCE_FOUNDATION_VERSION,
        });
      }
      return {
        ok: false,
        rolledBack: false,
        atomic: false,
        result: null,
        partialSuccess: createPersistencePartialSuccess({
          partialSuccess: completedSteps.length > 0,
          reconciliationRequired: true,
          completedSteps,
          failedSteps: [`${operation}:step-${completedSteps.length + 1}`],
          reconciliationId,
          message:
            "Transaction adapter unavailable; partial writes may require reconciliation",
        }),
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  store.beginTransaction();
  try {
    let last = null;
    for (let i = 0; i < steps.length; i += 1) {
      last = await steps[i]();
      completedSteps.push(`${operation}:step-${i + 1}`);
    }
    store.commitTransaction();
    return {
      ok: true,
      rolledBack: false,
      atomic: true,
      result: last,
      partialSuccess: null,
      error: null,
    };
  } catch (error) {
    store.rollbackTransaction();
    return {
      ok: false,
      rolledBack: true,
      atomic: true,
      result: null,
      partialSuccess: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Map store/port errors into structured persistence failure metadata.
 * @param {unknown} error
 * @param {string} step
 */
export function mapPersistenceError(error, step) {
  const err = error instanceof Error ? error : new Error(String(error));
  const code =
    /** @type {any} */ (err).code ||
    REGISTRATION_ELIGIBILITY_ERROR_CODE.PERSISTENCE_TRANSACTION_FAILED;
  return Object.freeze({
    code,
    step: String(step),
    message: err.message,
    metadata: cloneJsonSafe(/** @type {any} */ (err).metadata || null),
  });
}

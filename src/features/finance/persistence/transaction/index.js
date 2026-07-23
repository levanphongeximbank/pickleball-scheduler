/**
 * Finance unit-of-work / transaction boundary contract (Phase 1E).
 *
 * Explicit begin/commit/rollback (callback form). No real DB implementation.
 * Nested transactions are NOT supported.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";

export const FINANCE_UNIT_OF_WORK_VERSION = 1;

/**
 * Operations that MUST be atomic in a future durable adapter.
 */
export const FINANCE_ATOMIC_OPERATION_GROUPS = Object.freeze([
  Object.freeze({
    name: "createObligationWithEvent",
    steps: Object.freeze(["obligation.create", "event.append"]),
  }),
  Object.freeze({
    name: "issueInvoiceWithEvent",
    steps: Object.freeze(["invoice.update", "event.append"]),
  }),
  Object.freeze({
    name: "confirmPaymentSettlement",
    steps: Object.freeze([
      "payment.update",
      "obligation.update",
      "invoice.update",
      "receipt.create",
      "event.append",
      "idempotency.complete",
    ]),
  }),
  Object.freeze({
    name: "completeRefund",
    steps: Object.freeze([
      "refund.update",
      "payment.update",
      "event.append",
      "idempotency.complete",
    ]),
  }),
  Object.freeze({
    name: "consumeIdempotencyWithEffect",
    steps: Object.freeze(["idempotency.begin", "effect", "idempotency.complete"]),
  }),
]);

/**
 * @typedef {object} FinanceUnitOfWork
 * @property {() => Promise<void>|void} begin
 * @property {() => Promise<void>|void} commit
 * @property {(reason?: unknown) => Promise<void>|void} rollback
 * @property {boolean} isActive
 * @property {boolean} isNestedSupported
 */

/**
 * Create an in-process unit-of-work contract harness (not durable).
 * Used to prove callback semantics for tests and future adapters.
 *
 * @param {{ onCommit?: Function, onRollback?: Function }} [hooks]
 * @returns {FinanceUnitOfWork & { run: Function }}
 */
export function createFinanceUnitOfWork(hooks = {}) {
  let active = false;
  let committed = false;
  let rolledBack = false;
  /** @type {Array<() => void>} */
  const staged = [];

  const uow = {
    get isActive() {
      return active;
    },
    get isNestedSupported() {
      return false;
    },
    begin() {
      if (active) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.TRANSACTION_FAILED,
          "Nested Finance transactions are not supported.",
          { nested: true }
        );
      }
      active = true;
      committed = false;
      rolledBack = false;
      staged.length = 0;
    },
    /**
     * Stage a side-effect that applies only on commit.
     * @param {() => void} effect
     */
    stage(effect) {
      if (!active) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.TRANSACTION_FAILED,
          "Cannot stage work outside an active Finance unit of work."
        );
      }
      if (typeof effect !== "function") {
        throw new FinanceError(
          FINANCE_ERROR_CODES.TRANSACTION_FAILED,
          "Staged effect must be a function."
        );
      }
      staged.push(effect);
    },
    commit() {
      if (!active) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.TRANSACTION_FAILED,
          "Cannot commit inactive Finance unit of work."
        );
      }
      try {
        for (const effect of staged) {
          effect();
        }
        if (typeof hooks.onCommit === "function") {
          hooks.onCommit();
        }
        committed = true;
        active = false;
        staged.length = 0;
      } catch (err) {
        try {
          this.rollback(err);
        } catch (rollbackErr) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.TRANSACTION_ROLLBACK_FAILED,
            "Finance unit of work commit failed and rollback also failed.",
            {
              commitError:
                err instanceof Error ? err.message : String(err),
              rollbackError:
                rollbackErr instanceof Error
                  ? rollbackErr.message
                  : String(rollbackErr),
            }
          );
        }
        throw new FinanceError(
          FINANCE_ERROR_CODES.TRANSACTION_FAILED,
          "Finance unit of work commit failed; changes rolled back.",
          {
            causeMessage: err instanceof Error ? err.message : String(err),
          }
        );
      }
    },
    rollback(reason) {
      if (!active && !committed) {
        // already rolled back or never started
        if (rolledBack) return;
      }
      if (committed) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.TRANSACTION_ROLLBACK_FAILED,
          "Cannot rollback an already committed Finance unit of work."
        );
      }
      staged.length = 0;
      active = false;
      rolledBack = true;
      if (typeof hooks.onRollback === "function") {
        try {
          hooks.onRollback(reason);
        } catch (err) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.TRANSACTION_ROLLBACK_FAILED,
            "Finance unit of work rollback hook failed.",
            {
              causeMessage: err instanceof Error ? err.message : String(err),
            }
          );
        }
      }
    },
    get wasCommitted() {
      return committed;
    },
    get wasRolledBack() {
      return rolledBack;
    },
  };

  /**
   * Preferred callback contract: run(work) begins, executes, commits, or rolls back.
   * Partial success is never returned — either full result or thrown error after rollback.
   *
   * @template T
   * @param {(tx: typeof uow) => T|Promise<T>} work
   * @returns {Promise<T>}
   */
  async function run(work) {
    if (active) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.TRANSACTION_FAILED,
        "Nested Finance transactions are not supported.",
        { nested: true }
      );
    }
    uow.begin();
    try {
      const result = await work(uow);
      uow.commit();
      return result;
    } catch (err) {
      if (uow.isActive) {
        try {
          uow.rollback(err);
        } catch (rollbackErr) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.TRANSACTION_ROLLBACK_FAILED,
            "Finance unit of work failed and rollback also failed.",
            {
              workError: err instanceof Error ? err.message : String(err),
              rollbackError:
                rollbackErr instanceof Error
                  ? rollbackErr.message
                  : String(rollbackErr),
            }
          );
        }
      }
      if (err instanceof FinanceError) throw err;
      throw new FinanceError(
        FINANCE_ERROR_CODES.TRANSACTION_FAILED,
        "Finance unit of work failed; no partial success retained.",
        {
          causeMessage: err instanceof Error ? err.message : String(err),
        }
      );
    }
  }

  return Object.freeze({
    begin: uow.begin.bind(uow),
    stage: uow.stage.bind(uow),
    commit: uow.commit.bind(uow),
    rollback: uow.rollback.bind(uow),
    run,
    get isActive() {
      return uow.isActive;
    },
    get isNestedSupported() {
      return false;
    },
    get wasCommitted() {
      return uow.wasCommitted;
    },
    get wasRolledBack() {
      return uow.wasRolledBack;
    },
    version: FINANCE_UNIT_OF_WORK_VERSION,
    atomicOperationGroups: FINANCE_ATOMIC_OPERATION_GROUPS,
  });
}

/**
 * @param {unknown} adapter
 */
export function assertFinanceUnitOfWork(adapter) {
  if (!adapter || typeof adapter.run !== "function") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
      "Finance unit of work adapter must expose run(callback)."
    );
  }
  if (adapter.isNestedSupported === true) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
      "Nested Finance transactions are not authorized in Phase 1E."
    );
  }
}

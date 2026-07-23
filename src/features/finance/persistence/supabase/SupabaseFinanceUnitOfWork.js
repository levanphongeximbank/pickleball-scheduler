/**
 * Finance unit-of-work capability boundary for Supabase adapter (Phase 1G).
 *
 * Ordinary multi-call Supabase JS operations are NOT atomic.
 * Multi-record financial effects fail closed unless an injected transactional
 * executor is provided (future RPC / server-side transaction).
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import {
  FINANCE_ATOMIC_OPERATION_GROUPS,
  FINANCE_UNIT_OF_WORK_VERSION,
} from "../transaction/index.js";

/**
 * @param {{
 *   transactionalExecutor?: (work: Function) => Promise<any>,
 *   supportsAtomicMultiRecord?: boolean
 * }} [config]
 */
export function createSupabaseFinanceUnitOfWork(config = {}) {
  const hasExecutor = typeof config.transactionalExecutor === "function";
  const supportsAtomicMultiRecord = Boolean(
    config.supportsAtomicMultiRecord ?? hasExecutor
  );

  const capabilities = Object.freeze({
    version: FINANCE_UNIT_OF_WORK_VERSION,
    isDurable: true,
    isSupabaseCompatible: true,
    supportsSingleStatementWrites: true,
    supportsAtomicMultiRecord,
    atomicityClaim: supportsAtomicMultiRecord ? "injected-executor" : "none",
    isNestedSupported: false,
    atomicOperationGroups: FINANCE_ATOMIC_OPERATION_GROUPS,
  });

  /**
   * @param {string} [groupName]
   */
  function assertAtomicCapability(groupName) {
    if (!supportsAtomicMultiRecord) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
        "Atomic multi-record Finance operation is not available without an injected transactional executor.",
        {
          operation: groupName || "atomicGroup",
          atomicityClaim: capabilities.atomicityClaim,
        }
      );
    }
  }

  /**
   * Run a single-statement-safe callback without claiming multi-record atomicity.
   * @template T
   * @param {(tx: object) => T|Promise<T>} work
   * @returns {Promise<T>}
   */
  async function runSingleStatement(work) {
    return work({
      mode: "single-statement",
      capabilities,
      assertAtomicCapability,
    });
  }

  /**
   * Preferred entry: fails closed for atomic groups when unsupported.
   * @template T
   * @param {(tx: object) => T|Promise<T>} work
   * @param {{ requireAtomic?: boolean, atomicGroup?: string }} [options]
   * @returns {Promise<T>}
   */
  async function run(work, options = {}) {
    const requireAtomic = options.requireAtomic === true || options.atomicGroup != null;
    if (requireAtomic) {
      assertAtomicCapability(options.atomicGroup);
      return config.transactionalExecutor(async () =>
        work({
          mode: "atomic",
          capabilities,
          atomicGroup: options.atomicGroup,
          assertAtomicCapability,
        })
      );
    }
    return runSingleStatement(work);
  }

  /**
   * Explicit helper for known atomic operation groups.
   * @param {string} groupName
   * @param {Function} work
   */
  async function runAtomicGroup(groupName, work) {
    const known = FINANCE_ATOMIC_OPERATION_GROUPS.some((g) => g.name === groupName);
    if (!known) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
        `Unknown Finance atomic operation group: ${groupName}`,
        { operation: groupName }
      );
    }
    return run(work, { requireAtomic: true, atomicGroup: groupName });
  }

  return Object.freeze({
    capabilities,
    run,
    runSingleStatement,
    runAtomicGroup,
    assertAtomicCapability,
    get isNestedSupported() {
      return false;
    },
    get supportsAtomicMultiRecord() {
      return supportsAtomicMultiRecord;
    },
    version: FINANCE_UNIT_OF_WORK_VERSION,
    atomicOperationGroups: FINANCE_ATOMIC_OPERATION_GROUPS,
  });
}

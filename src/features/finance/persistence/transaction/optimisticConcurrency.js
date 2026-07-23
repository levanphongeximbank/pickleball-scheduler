/**
 * Optimistic concurrency helpers (Phase 1E).
 *
 * Every mutable aggregate record has a version. Updates require expectedVersion.
 * Successful updates increment version by exactly 1.
 * This contract does NOT claim database-level safety without later constraints.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import { requireOptimisticVersion } from "../validation/recordValidation.js";
import { assertMutableAggregateStatus } from "../mappers/index.js";

/**
 * @param {object} current
 * @param {number} expectedVersion
 * @param {string} entity
 * @returns {void}
 */
export function assertExpectedVersion(current, expectedVersion, entity) {
  const expected = requireOptimisticVersion(expectedVersion, "expectedVersion");
  const actual = requireOptimisticVersion(current?.version, "version");
  if (actual !== expected) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.OPTIMISTIC_CONCURRENCY_CONFLICT,
      `${entity} version conflict.`,
      { entity, expectedVersion: expected, actualVersion: actual, id: current?.id }
    );
  }
}

/**
 * @param {object} current
 * @param {object} nextFields
 * @param {number} expectedVersion
 * @param {{ entity: string, aggregate?: string, statusField?: string }} options
 * @returns {Readonly<object>}
 */
export function applyOptimisticUpdate(current, nextFields, expectedVersion, options) {
  const entity = options.entity;
  assertExpectedVersion(current, expectedVersion, entity);

  if (options.aggregate) {
    assertMutableAggregateStatus(
      options.aggregate,
      current[options.statusField || "status"]
    );
  }

  return Object.freeze({
    ...current,
    ...nextFields,
    id: current.id,
    tenantId: current.tenantId,
    version: current.version + 1,
  });
}

/**
 * Idempotent replay must not create a concurrency side effect.
 * Callers should short-circuit before update when replay is detected.
 *
 * @returns {never}
 */
export function rejectConcurrencySideEffectOnReplay() {
  throw new FinanceError(
    FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
    "Idempotent replay must not perform optimistic version updates.",
    { field: "idempotency" }
  );
}

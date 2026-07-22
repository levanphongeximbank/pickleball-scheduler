/**
 * CORE-10 — OptimizationContext + snapshot refs.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import {
  cloneFreezeObject,
  rejectUnknownFields,
  requireStableId,
} from "./shared.js";

const SNAPSHOT_ALLOWED = Object.freeze([
  "snapshotId",
  "snapshotVersion",
  "fingerprint",
  "kind",
]);

const CONTEXT_ALLOWED = Object.freeze([
  "tenantId",
  "competitionId",
  "snapshotRefs",
  "metadata",
]);

/**
 * @param {object} partial
 * @returns {Readonly<{
 *   snapshotId: string,
 *   snapshotVersion: string,
 *   fingerprint: string,
 *   kind: string|null,
 * }>}
 */
export function createSnapshotRef(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    SNAPSHOT_ALLOWED,
    "SnapshotRef",
    OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT
  );

  return Object.freeze({
    snapshotId: requireStableId(
      partial.snapshotId,
      "SnapshotRef.snapshotId",
      OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT
    ),
    snapshotVersion: requireStableId(
      partial.snapshotVersion,
      "SnapshotRef.snapshotVersion",
      OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT
    ),
    fingerprint: requireStableId(
      partial.fingerprint,
      "SnapshotRef.fingerprint",
      OPTIMIZATION_FAILURE_CODE.SNAPSHOT_FINGERPRINT_MISMATCH
    ),
    kind:
      partial.kind == null || partial.kind === ""
        ? null
        : requireStableId(
            partial.kind,
            "SnapshotRef.kind",
            OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT
          ),
  });
}

/**
 * @param {object} partial
 * @returns {Readonly<{
 *   tenantId: string,
 *   competitionId: string,
 *   snapshotRefs: ReadonlyArray<ReturnType<typeof createSnapshotRef>>,
 *   metadata: Readonly<Record<string, unknown>>,
 * }>}
 */
export function createOptimizationContext(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    CONTEXT_ALLOWED,
    "OptimizationContext",
    OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT
  );

  if (!Array.isArray(partial.snapshotRefs) || partial.snapshotRefs.length === 0) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT,
      "OptimizationContext.snapshotRefs must be a non-empty array",
      {}
    );
  }

  const snapshotRefs = partial.snapshotRefs.map((ref, i) => {
    if (!ref || typeof ref !== "object") {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT,
        `snapshotRefs[${i}] must be an object`,
        { index: i }
      );
    }
    return createSnapshotRef(ref);
  });

  return Object.freeze({
    tenantId: requireStableId(
      partial.tenantId,
      "OptimizationContext.tenantId",
      OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT
    ),
    competitionId: requireStableId(
      partial.competitionId,
      "OptimizationContext.competitionId",
      OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT
    ),
    snapshotRefs: Object.freeze(snapshotRefs),
    metadata: cloneFreezeObject(
      partial.metadata || {},
      "OptimizationContext.metadata"
    ),
  });
}

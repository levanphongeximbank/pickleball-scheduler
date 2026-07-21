import { deepFreeze, deepFreezeClone } from "./deepFreeze.js";
import {
  FINALIZATION_STATE,
  FINALIZATION_STATE_VALUES,
} from "./constants.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "./normalizeHelpers.js";

/**
 * Clone a SeedingResult into a new immutable lifecycle document.
 * Preserves assignment collections and fingerprints; never mutates input.
 *
 * @param {import('./createSeedingResult.js').SeedingResult} result
 * @param {Record<string, unknown>} lifecyclePatch
 * @returns {Readonly<Record<string, unknown>>}
 */
export function cloneSeedingResultWithLifecycle(result, lifecyclePatch) {
  if (!result || typeof result !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "SeedingResult is required for lifecycle clone"
    );
  }
  if (!lifecyclePatch || typeof lifecyclePatch !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "lifecyclePatch is required"
    );
  }

  const nextState = lifecyclePatch.finalizationState;
  if (
    typeof nextState !== "string" ||
    !FINALIZATION_STATE_VALUES.has(nextState)
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "lifecyclePatch.finalizationState is invalid",
      { finalizationState: nextState }
    );
  }

  // Preserve assignment content exactly — do not re-sort or reallocate.
  const orderedAssignments = deepFreezeClone(
    Array.isArray(result.orderedAssignments) ? result.orderedAssignments : []
  );
  const eligibleUnseededEntries = deepFreezeClone(
    Array.isArray(result.eligibleUnseededEntries)
      ? result.eligibleUnseededEntries
      : []
  );
  const excludedEntries = deepFreezeClone(
    Array.isArray(result.excludedEntries) ? result.excludedEntries : []
  );
  const rejectedOverrides = deepFreezeClone(
    Array.isArray(result.rejectedOverrides) ? result.rejectedOverrides : []
  );
  const warnings = deepFreezeClone(
    Array.isArray(result.warnings) ? result.warnings : []
  );
  const acceptedClears = deepFreezeClone(
    Array.isArray(result.acceptedClears) ? result.acceptedClears : []
  );

  const base = {
    contractVersion: result.contractVersion,
    requestId: result.requestId,
    resultId: result.resultId,
    resultVersion: result.resultVersion,
    scope: deepFreezeClone(result.scope),
    orderedAssignments,
    eligibleUnseededEntries,
    excludedEntries,
    rejectedOverrides,
    warnings,
    acceptedClears,
    policyProvenance: deepFreezeClone(result.policyProvenance || {}),
    snapshotProvenance:
      result.snapshotProvenance == null
        ? null
        : deepFreezeClone(result.snapshotProvenance),
    deterministicContext:
      result.deterministicContext == null
        ? null
        : deepFreezeClone(result.deterministicContext),
    deterministicFingerprint: result.deterministicFingerprint,
    fingerprintPayload:
      result.fingerprintPayload == null
        ? undefined
        : deepFreezeClone(result.fingerprintPayload),
    generatedAt: result.generatedAt,
    finalizationState: FINALIZATION_STATE.DRAFT,
  };

  // Carry through any prior lifecycle provenance fields when not overwritten.
  const carryKeys = [
    "finalizedAt",
    "finalizationActor",
    "finalizationAuthorization",
    "finalizationRequestId",
    "finalizationIdempotencyKey",
    "cancelledAt",
    "cancellationReason",
    "cancellationActor",
    "cancellationAuthorization",
    "cancellationRequestId",
    "supersededAt",
    "supersededByResultId",
    "supersededResultId",
    "supersedeRequestId",
  ];
  for (let i = 0; i < carryKeys.length; i += 1) {
    const key = carryKeys[i];
    if (result[key] !== undefined && lifecyclePatch[key] === undefined) {
      base[key] = deepFreezeClone(result[key]);
    }
  }

  const merged = { ...base, ...lifecyclePatch };
  return deepFreeze(merged);
}

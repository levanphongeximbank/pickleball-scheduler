/**
 * CORE-23 — RecoveryEvidence, RecoveryExplanation, ManualInterventionRequirement,
 * RecoveryPrecondition, PartialOperationAssessment.
 */

import { RecoveryError, RECOVERY_ERROR_CODE } from "../errors.js";
import {
  PARTIAL_OPERATION_STATUS,
  isPartialOperationStatus,
  RECOVERY_MODE,
  isRecoveryMode,
} from "../enums.js";
import {
  deepFreezeClone,
  isPlainObject,
  normalizeIdList,
  requireNonEmptyString,
} from "../utils/helpers.js";

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryEvidence(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoveryEvidence must be a plain object"
    );
  }

  if (partial.evidenceKind === "IN_MEMORY" || partial.evidenceKind === "UI") {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.IN_MEMORY_EVIDENCE_REJECTED,
      "In-memory or UI-only state is not valid recovery evidence",
      { evidenceKind: partial.evidenceKind }
    );
  }

  return Object.freeze(
    deepFreezeClone({
      evidenceKind: requireNonEmptyString(
        partial.evidenceKind ?? "SERIALIZABLE",
        "evidenceKind"
      ),
      completionMarkerPresent: partial.completionMarkerPresent === true,
      effectMarkers: Object.freeze(
        Array.isArray(partial.effectMarkers)
          ? normalizeIdList(partial.effectMarkers)
          : []
      ),
      eventHistoryComplete:
        partial.eventHistoryComplete === true
          ? true
          : partial.eventHistoryComplete === false
            ? false
            : null,
      eventHistoryReference:
        partial.eventHistoryReference == null
          ? null
          : deepFreezeClone(partial.eventHistoryReference),
      replayEvidence:
        partial.replayEvidence == null
          ? null
          : deepFreezeClone(partial.replayEvidence),
      seedEvidence:
        partial.seedEvidence == null
          ? null
          : deepFreezeClone(partial.seedEvidence),
      importPlanReference:
        partial.importPlanReference == null
          ? null
          : deepFreezeClone(partial.importPlanReference),
      importRestorePartial: partial.importRestorePartial === true,
      outcomeKnown:
        partial.outcomeKnown === true
          ? true
          : partial.outcomeKnown === false
            ? false
            : null,
      notes:
        partial.notes == null || partial.notes === ""
          ? null
          : String(partial.notes).trim(),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createPartialOperationAssessment(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "PartialOperationAssessment must be a plain object"
    );
  }
  const status = isPartialOperationStatus(partial.status)
    ? partial.status
    : PARTIAL_OPERATION_STATUS.AMBIGUOUS;

  return Object.freeze(
    deepFreezeClone({
      status,
      completedStepIds: Object.freeze(
        Array.isArray(partial.completedStepIds)
          ? normalizeIdList(partial.completedStepIds)
          : []
      ),
      pendingStepIds: Object.freeze(
        Array.isArray(partial.pendingStepIds)
          ? normalizeIdList(partial.pendingStepIds)
          : []
      ),
      completedEffectIds: Object.freeze(
        Array.isArray(partial.completedEffectIds)
          ? normalizeIdList(partial.completedEffectIds)
          : []
      ),
      pendingEffectIds: Object.freeze(
        Array.isArray(partial.pendingEffectIds)
          ? normalizeIdList(partial.pendingEffectIds)
          : []
      ),
      ambiguous: status === PARTIAL_OPERATION_STATUS.AMBIGUOUS,
      reasonCodes: Object.freeze(
        Array.isArray(partial.reasonCodes)
          ? [...partial.reasonCodes].map(String)
          : []
      ),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryPrecondition(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoveryPrecondition must be a plain object"
    );
  }
  return Object.freeze(
    deepFreezeClone({
      code: requireNonEmptyString(partial.code, "code"),
      satisfied: partial.satisfied === true,
      message:
        partial.message == null || partial.message === ""
          ? null
          : String(partial.message).trim(),
      details:
        partial.details == null ? null : deepFreezeClone(partial.details),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createManualInterventionRequirement(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.MANUAL_INTERVENTION_REQUIRED,
      "ManualInterventionRequirement must be a plain object"
    );
  }
  return Object.freeze(
    deepFreezeClone({
      required: partial.required !== false,
      reasonCode: requireNonEmptyString(partial.reasonCode, "reasonCode"),
      evidenceGaps: Object.freeze(
        Array.isArray(partial.evidenceGaps)
          ? [...partial.evidenceGaps].map(String)
          : []
      ),
      recommendedOperatorAction: requireNonEmptyString(
        partial.recommendedOperatorAction ??
          "Inspect checkpoint evidence and authorize a safe recovery mode",
        "recommendedOperatorAction"
      ),
      blockingCodes: Object.freeze(
        Array.isArray(partial.blockingCodes)
          ? [...partial.blockingCodes].map(String)
          : []
      ),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryExplanation(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoveryExplanation must be a plain object"
    );
  }
  const mode =
    partial.mode == null
      ? null
      : isRecoveryMode(partial.mode)
        ? partial.mode
        : (() => {
            throw new RecoveryError(
              RECOVERY_ERROR_CODE.INVALID_REQUEST,
              "explanation.mode must be a valid RecoveryMode"
            );
          })();

  return Object.freeze(
    deepFreezeClone({
      decision: requireNonEmptyString(partial.decision, "decision"),
      mode,
      message: requireNonEmptyString(partial.message, "message"),
      reasonCodes: Object.freeze(
        Array.isArray(partial.reasonCodes)
          ? [...partial.reasonCodes].map(String)
          : []
      ),
      allowedBecause: Object.freeze(
        Array.isArray(partial.allowedBecause)
          ? [...partial.allowedBecause].map(String)
          : []
      ),
      rejectedBecause: Object.freeze(
        Array.isArray(partial.rejectedBecause)
          ? [...partial.rejectedBecause].map(String)
          : []
      ),
      escalatedBecause: Object.freeze(
        Array.isArray(partial.escalatedBecause)
          ? [...partial.escalatedBecause].map(String)
          : []
      ),
      details:
        partial.details == null ? null : deepFreezeClone(partial.details),
    })
  );
}

export { RECOVERY_MODE, PARTIAL_OPERATION_STATUS };

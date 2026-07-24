/**
 * CORE-23 — classify partial-operation state from checkpoint + evidence.
 */

import {
  PARTIAL_OPERATION_STATUS,
  isPartialOperationStatus,
} from "../enums.js";
import { createPartialOperationAssessment } from "../contracts/index.js";
import { isPlainObject } from "../utils/helpers.js";

/**
 * @param {object} [input]
 * @param {object} [input.checkpoint]
 * @param {object} [input.evidence]
 * @returns {Readonly<object>}
 */
export function classifyPartialOperation(input = {}) {
  const checkpoint = isPlainObject(input.checkpoint) ? input.checkpoint : null;
  const evidence = isPlainObject(input.evidence) ? input.evidence : {};

  const completedStepIds = checkpoint?.completedStepIds ?? [];
  const pendingStepIds = checkpoint?.pendingStepIds ?? [];
  const completedEffectIds = checkpoint?.completedEffectIds ?? [];
  const pendingEffectIds = checkpoint?.pendingEffectIds ?? [];

  if (evidence.outcomeKnown === false) {
    return createPartialOperationAssessment({
      status: PARTIAL_OPERATION_STATUS.OUTCOME_UNKNOWN,
      completedStepIds,
      pendingStepIds,
      completedEffectIds,
      pendingEffectIds,
      reasonCodes: ["OUTCOME_UNKNOWN"],
    });
  }

  if (evidence.eventHistoryComplete === false) {
    return createPartialOperationAssessment({
      status: PARTIAL_OPERATION_STATUS.AMBIGUOUS,
      completedStepIds,
      pendingStepIds,
      completedEffectIds,
      pendingEffectIds,
      reasonCodes: ["EVENT_HISTORY_INCOMPLETE"],
    });
  }

  if (evidence.importRestorePartial === true) {
    return createPartialOperationAssessment({
      status: PARTIAL_OPERATION_STATUS.PARTIAL_EFFECTS_APPLIED,
      completedStepIds,
      pendingStepIds,
      completedEffectIds,
      pendingEffectIds,
      reasonCodes: ["IMPORT_RESTORE_PARTIAL"],
    });
  }

  if (isPartialOperationStatus(checkpoint?.partialOperationStatus)) {
    const status = checkpoint.partialOperationStatus;
    if (status === PARTIAL_OPERATION_STATUS.AMBIGUOUS) {
      return createPartialOperationAssessment({
        status,
        completedStepIds,
        pendingStepIds,
        completedEffectIds,
        pendingEffectIds,
        reasonCodes: ["CHECKPOINT_MARKED_AMBIGUOUS"],
      });
    }
    if (status === PARTIAL_OPERATION_STATUS.COMPLETED) {
      return createPartialOperationAssessment({
        status,
        completedStepIds,
        pendingStepIds,
        completedEffectIds,
        pendingEffectIds,
        reasonCodes: ["CHECKPOINT_MARKED_COMPLETED"],
      });
    }
  }

  if (evidence.completionMarkerPresent === true) {
    return createPartialOperationAssessment({
      status: PARTIAL_OPERATION_STATUS.COMPLETED,
      completedStepIds,
      pendingStepIds,
      completedEffectIds,
      pendingEffectIds,
      reasonCodes: ["COMPLETION_MARKER_PRESENT"],
    });
  }

  if (
    completedEffectIds.length > 0 &&
    (pendingEffectIds.length > 0 || pendingStepIds.length > 0)
  ) {
    return createPartialOperationAssessment({
      status: PARTIAL_OPERATION_STATUS.PARTIAL_EFFECTS_APPLIED,
      completedStepIds,
      pendingStepIds,
      completedEffectIds,
      pendingEffectIds,
      reasonCodes: ["SOME_EFFECTS_APPLIED"],
    });
  }

  if (
    completedEffectIds.length === 0 &&
    pendingEffectIds.length === 0 &&
    completedStepIds.length > 0 &&
    pendingStepIds.length > 0
  ) {
    // Validated / progressed steps without effects — typical pre-effect stop.
    return createPartialOperationAssessment({
      status: PARTIAL_OPERATION_STATUS.VALIDATED_NO_EFFECTS,
      completedStepIds,
      pendingStepIds,
      completedEffectIds,
      pendingEffectIds,
      reasonCodes: ["VALIDATED_BEFORE_EFFECTS"],
    });
  }

  if (
    completedStepIds.length === 0 &&
    completedEffectIds.length === 0 &&
    (pendingStepIds.length > 0 || pendingEffectIds.length > 0)
  ) {
    return createPartialOperationAssessment({
      status: PARTIAL_OPERATION_STATUS.NOT_STARTED,
      completedStepIds,
      pendingStepIds,
      completedEffectIds,
      pendingEffectIds,
      reasonCodes: ["NO_COMPLETED_WORK"],
    });
  }

  if (
    completedEffectIds.length > 0 &&
    pendingEffectIds.length === 0 &&
    pendingStepIds.length === 0
  ) {
    return createPartialOperationAssessment({
      status: PARTIAL_OPERATION_STATUS.COMPLETED,
      completedStepIds,
      pendingStepIds,
      completedEffectIds,
      pendingEffectIds,
      reasonCodes: ["ALL_EFFECTS_COMPLETE"],
    });
  }

  if (checkpoint?.partialOperationStatus) {
    return createPartialOperationAssessment({
      status: checkpoint.partialOperationStatus,
      completedStepIds,
      pendingStepIds,
      completedEffectIds,
      pendingEffectIds,
      reasonCodes: ["CHECKPOINT_STATUS"],
    });
  }

  return createPartialOperationAssessment({
    status: PARTIAL_OPERATION_STATUS.AMBIGUOUS,
    completedStepIds,
    pendingStepIds,
    completedEffectIds,
    pendingEffectIds,
    reasonCodes: ["INSUFFICIENT_EVIDENCE"],
  });
}

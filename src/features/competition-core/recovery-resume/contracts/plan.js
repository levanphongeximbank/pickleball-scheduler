/**
 * CORE-23 — RecoveryPlan / ResumePlan / RecoveryStep / RecoveryOutcome / RecoveryRequest.
 */

import {
  RECOVERY_PLAN_SCHEMA_VERSION,
  RECOVERY_OUTCOME_SCHEMA_VERSION,
  RECOVERY_REQUEST_SCHEMA_VERSION,
} from "../constants.js";
import { RecoveryError, RECOVERY_ERROR_CODE } from "../errors.js";
import {
  RECOVERY_MODE,
  RECOVERY_OUTCOME_KIND,
  isRecoveryMode,
  isRecoveryEligibility,
  isRecoveryOutcomeKind,
  isRecoveryStepKind,
} from "../enums.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
  normalizeIdList,
  requireNonEmptyString,
} from "../utils/helpers.js";
import { fingerprintValue } from "../utils/fingerprint.js";
import {
  createRecoveryOperationReference,
  createRecoverySubjectReference,
  createIdempotencyReference,
  createDuplicatePreventionReference,
} from "./references.js";
import { createResumeToken, createResumeContext } from "./resume.js";
import {
  createRecoveryEvidence,
  createRecoveryExplanation,
  createManualInterventionRequirement,
  createPartialOperationAssessment,
  createRecoveryPrecondition,
} from "./evidence.js";

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryStep(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoveryStep must be a plain object"
    );
  }
  const kind = isRecoveryStepKind(partial.kind)
    ? partial.kind
    : (() => {
        throw new RecoveryError(
          RECOVERY_ERROR_CODE.INVALID_REQUEST,
          "RecoveryStep.kind is required",
          { kind: partial.kind }
        );
      })();

  return Object.freeze(
    deepFreezeClone({
      stepId: requireNonEmptyString(partial.stepId, "stepId"),
      kind,
      targetId:
        partial.targetId == null || partial.targetId === ""
          ? null
          : String(partial.targetId).trim(),
      alreadyCompleted: partial.alreadyCompleted === true,
      description:
        partial.description == null || partial.description === ""
          ? null
          : String(partial.description).trim(),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryPlan(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoveryPlan must be a plain object"
    );
  }
  const mode = isRecoveryMode(partial.mode)
    ? partial.mode
    : (() => {
        throw new RecoveryError(
          RECOVERY_ERROR_CODE.MODE_NOT_PERMITTED,
          "RecoveryPlan.mode is required"
        );
      })();

  const steps = Array.isArray(partial.steps)
    ? partial.steps.map((s) => createRecoveryStep(s))
    : [];

  return Object.freeze(
    deepFreezeClone({
      schemaVersion: RECOVERY_PLAN_SCHEMA_VERSION,
      mode,
      steps: Object.freeze(steps),
      skipCompletedEffectIds: Object.freeze(
        Array.isArray(partial.skipCompletedEffectIds)
          ? normalizeIdList(partial.skipCompletedEffectIds)
          : []
      ),
      pendingEffectIds: Object.freeze(
        Array.isArray(partial.pendingEffectIds)
          ? normalizeIdList(partial.pendingEffectIds)
          : []
      ),
      duplicateProtected: partial.duplicateProtected !== false,
      sideEffectFreeEvaluation: true,
    })
  );
}

/**
 * ResumePlan is a RecoveryPlan constrained to RESUME mode.
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createResumePlan(partial = {}) {
  return createRecoveryPlan({
    ...partial,
    mode: RECOVERY_MODE.RESUME,
  });
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryValidationResult(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoveryValidationResult must be a plain object"
    );
  }
  return Object.freeze(
    deepFreezeClone({
      valid: partial.valid === true,
      code:
        partial.code == null || partial.code === ""
          ? null
          : String(partial.code),
      message:
        partial.message == null || partial.message === ""
          ? null
          : String(partial.message),
      preconditions: Object.freeze(
        Array.isArray(partial.preconditions)
          ? partial.preconditions.map((p) => createRecoveryPrecondition(p))
          : []
      ),
      details:
        partial.details == null ? null : deepFreezeClone(partial.details),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryFailureReason(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoveryFailureReason must be a plain object"
    );
  }
  return Object.freeze(
    deepFreezeClone({
      code: requireNonEmptyString(partial.code, "code"),
      message: requireNonEmptyString(partial.message, "message"),
      details:
        partial.details == null ? null : deepFreezeClone(partial.details),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryOutcome(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoveryOutcome must be a plain object"
    );
  }

  const kind = isRecoveryOutcomeKind(partial.kind)
    ? partial.kind
    : (() => {
        throw new RecoveryError(
          RECOVERY_ERROR_CODE.INVALID_REQUEST,
          "RecoveryOutcome.kind is required"
        );
      })();

  const eligibility = isRecoveryEligibility(partial.eligibility)
    ? partial.eligibility
    : (() => {
        throw new RecoveryError(
          RECOVERY_ERROR_CODE.INVALID_REQUEST,
          "RecoveryOutcome.eligibility is required"
        );
      })();

  const mode =
    partial.mode == null
      ? null
      : isRecoveryMode(partial.mode)
        ? partial.mode
        : (() => {
            throw new RecoveryError(
              RECOVERY_ERROR_CODE.INVALID_REQUEST,
              "RecoveryOutcome.mode must be a valid RecoveryMode"
            );
          })();

  const explanation = createRecoveryExplanation(
    partial.explanation ?? {
      decision: kind,
      mode,
      message: String(partial.message ?? kind),
      reasonCodes: partial.reasonCodes ?? [],
    }
  );

  const outcome = Object.freeze(
    deepFreezeClone({
      schemaVersion: RECOVERY_OUTCOME_SCHEMA_VERSION,
      kind,
      eligibility,
      mode,
      ok: kind === RECOVERY_OUTCOME_KIND.ALLOWED ||
        kind === RECOVERY_OUTCOME_KIND.DUPLICATE_NOOP,
      wouldApplyEffects:
        kind === RECOVERY_OUTCOME_KIND.ALLOWED &&
        mode !== RECOVERY_MODE.MANUAL_RECOVERY &&
        partial.wouldApplyEffects !== false,
      duplicateEffectsPrevented: partial.duplicateEffectsPrevented === true,
      validation:
        partial.validation == null
          ? null
          : createRecoveryValidationResult(partial.validation),
      partialOperation:
        partial.partialOperation == null
          ? null
          : createPartialOperationAssessment(partial.partialOperation),
      plan: partial.plan == null ? null : createRecoveryPlan(partial.plan),
      failure:
        partial.failure == null
          ? null
          : createRecoveryFailureReason(partial.failure),
      manualIntervention:
        partial.manualIntervention == null
          ? null
          : createManualInterventionRequirement(partial.manualIntervention),
      explanation,
      evidence:
        partial.evidence == null
          ? null
          : createRecoveryEvidence(partial.evidence),
    })
  );

  const outcomeFingerprint =
    isNonEmptyString(partial.outcomeFingerprint)
      ? String(partial.outcomeFingerprint).trim()
      : fingerprintValue(outcome);

  return Object.freeze({
    ...outcome,
    outcomeFingerprint,
  });
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryRequest(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoveryRequest must be a plain object"
    );
  }

  const requestedMode = isRecoveryMode(partial.requestedMode)
    ? partial.requestedMode
    : (() => {
        throw new RecoveryError(
          RECOVERY_ERROR_CODE.MODE_NOT_PERMITTED,
          "requestedMode must be a valid RecoveryMode",
          { requestedMode: partial.requestedMode }
        );
      })();

  const subject = createRecoverySubjectReference(partial.subject);
  const operation = createRecoveryOperationReference(partial.operation);

  return Object.freeze(
    deepFreezeClone({
      schemaVersion: RECOVERY_REQUEST_SCHEMA_VERSION,
      requestedMode,
      subject,
      operation,
      checkpoint: partial.checkpoint == null ? null : partial.checkpoint,
      resumeToken:
        partial.resumeToken == null
          ? null
          : createResumeToken(partial.resumeToken),
      context: createResumeContext(partial.context ?? {}),
      evidence: createRecoveryEvidence(partial.evidence ?? {}),
      idempotency:
        partial.idempotency == null
          ? null
          : createIdempotencyReference(partial.idempotency),
      duplicatePrevention:
        partial.duplicatePrevention == null
          ? null
          : createDuplicatePreventionReference(partial.duplicatePrevention),
    })
  );
}

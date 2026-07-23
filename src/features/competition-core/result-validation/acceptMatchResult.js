/**
 * CORE-17 — explicit acceptance command (no default auto-accept).
 */

import {
  ACCEPTANCE_FORBIDDEN_RESULT_TYPES,
  ACCEPTANCE_STATUS,
  ACTOR_TYPE_VALUES,
  ELEVATED_ACTOR_TYPES,
  EVIDENCE_SEVERITY,
  LIFECYCLE_STATUS,
  LINEAGE_STATUS,
  RESULT_TYPE,
  TECHNICAL_RESULT_TYPES,
  requiredCompletionReasonForResultType,
} from "./resultValidationConstants.js";
import {
  RESULT_ERROR_CODE,
  ResultValidationError,
} from "./resultValidationErrors.js";
import {
  computeValidatedResultFingerprint,
  finalizeValidatedResult,
} from "./validatedResult.js";

/**
 * @param {() => string} [now]
 * @returns {string}
 */
function defaultNow(now) {
  return typeof now === "function" ? now() : new Date().toISOString();
}

/**
 * @param {object} result
 */
function assertNoBlockingEvidence(result) {
  const blocking = (result.validationEvidence || []).filter(
    (item) =>
      item.severity === EVIDENCE_SEVERITY.ERROR ||
      item.severity === EVIDENCE_SEVERITY.CRITICAL
  );
  if (blocking.length > 0) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_ACCEPTANCE_NOT_ALLOWED,
      "ERROR/CRITICAL validation evidence blocks acceptance",
      {
        codes: blocking.map((b) => b.code),
      }
    );
  }
}

/**
 * @param {object} result
 * @param {string} lifecycleStatus
 * @param {string} completionReason
 */
function assertLifecycleCompatible(result, lifecycleStatus, completionReason) {
  const resultType = result.resultType;

  if (ACCEPTANCE_FORBIDDEN_RESULT_TYPES.includes(resultType)) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_ACCEPTANCE_NOT_ALLOWED,
      "ABANDONED, CANCELLED, and VOID cannot be ACCEPTED",
      { resultType }
    );
  }

  if (resultType === RESULT_TYPE.CANCELLED) {
    // Defensive — also covered by ACCEPTANCE_FORBIDDEN
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_ACCEPTANCE_NOT_ALLOWED,
      "CANCELLED cannot be ACCEPTED",
      {}
    );
  }

  if (resultType === RESULT_TYPE.COMPLETED) {
    if (lifecycleStatus !== LIFECYCLE_STATUS.COMPLETED) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_ACCEPTANCE_NOT_ALLOWED,
        "COMPLETED result requires CORE-15 lifecycle status COMPLETED",
        { lifecycleStatus }
      );
    }
  } else if (TECHNICAL_RESULT_TYPES.includes(resultType)) {
    if (resultType === RESULT_TYPE.CANCELLED) {
      // unreachable due to forbidden list
    } else if (lifecycleStatus !== LIFECYCLE_STATUS.COMPLETED) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_ACCEPTANCE_NOT_ALLOWED,
        "Competitive technical results require CORE-15 lifecycle status COMPLETED",
        { lifecycleStatus, resultType }
      );
    }
  }

  const expectedReason = requiredCompletionReasonForResultType(resultType);
  if (String(completionReason) !== expectedReason) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_ACCEPTANCE_NOT_ALLOWED,
      "Lifecycle completionReason is incompatible with resultType",
      { completionReason, expectedReason, resultType }
    );
  }
}

/**
 * Explicitly accept a PENDING validated result.
 * Does not auto-accept on validation pass.
 *
 * Idempotent: re-accepting the same active ACCEPTED id + fingerprint is a no-op.
 *
 * @param {object} validatedResult
 * @param {{
 *   actor: { actorType: string, actorId?: string|null },
 *   lifecycleStatus: string,
 *   completionReason: string,
 *   now?: () => string,
 *   currentActiveAccepted?: object|null,
 * }} deps
 * @returns {Readonly<object>}
 */
export function acceptMatchResult(validatedResult, deps) {
  if (!validatedResult || typeof validatedResult !== "object") {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      "validatedResult is required",
      {}
    );
  }
  if (!deps || typeof deps !== "object") {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_ACTOR_REQUIRED,
      "accept deps are required",
      {}
    );
  }
  if (!deps.actor || !ACTOR_TYPE_VALUES.has(deps.actor.actorType)) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_ACTOR_REQUIRED,
      "Accepting actor with valid actorType is required",
      { actor: deps.actor }
    );
  }

  // Idempotent replay against already-active accepted result
  if (deps.currentActiveAccepted) {
    const current = deps.currentActiveAccepted;
    if (
      current.acceptanceStatus === ACCEPTANCE_STATUS.ACCEPTED &&
      current.lineageStatus === LINEAGE_STATUS.ACTIVE &&
      String(current.validatedResultId) ===
        String(validatedResult.validatedResultId)
    ) {
      const incomingFp =
        validatedResult.deterministicFingerprint ||
        computeValidatedResultFingerprint(validatedResult);
      if (String(current.deterministicFingerprint) !== String(incomingFp)) {
        throw new ResultValidationError(
          RESULT_ERROR_CODE.RESULT_IDEMPOTENT_REPLAY_MISMATCH,
          "Idempotent accept replay fingerprint mismatch",
          {
            validatedResultId: current.validatedResultId,
            expectedFingerprint: current.deterministicFingerprint,
            actualFingerprint: incomingFp,
          }
        );
      }
      return current;
    }

    if (
      current.acceptanceStatus === ACCEPTANCE_STATUS.ACCEPTED &&
      current.lineageStatus === LINEAGE_STATUS.ACTIVE &&
      String(current.validatedResultId) !==
        String(validatedResult.validatedResultId)
    ) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_ALREADY_ACCEPTED_ACTIVE,
        "Match already has an ACTIVE ACCEPTED validated result",
        {
          activeValidatedResultId: current.validatedResultId,
          attemptedValidatedResultId: validatedResult.validatedResultId,
        }
      );
    }
  }

  if (validatedResult.lineageStatus !== LINEAGE_STATUS.ACTIVE) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_ACCEPTANCE_TRANSITION,
      "Only ACTIVE results can be accepted",
      { lineageStatus: validatedResult.lineageStatus }
    );
  }

  if (validatedResult.acceptanceStatus === ACCEPTANCE_STATUS.ACCEPTED) {
    return validatedResult;
  }

  if (validatedResult.acceptanceStatus !== ACCEPTANCE_STATUS.PENDING) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_ACCEPTANCE_TRANSITION,
      "Only PENDING validated results can transition to ACCEPTED",
      { acceptanceStatus: validatedResult.acceptanceStatus }
    );
  }

  if (TECHNICAL_RESULT_TYPES.includes(validatedResult.resultType)) {
    if (!ELEVATED_ACTOR_TYPES.includes(deps.actor.actorType)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_ACTOR_REQUIRED,
        "Technical result acceptance requires an elevated actor",
        { actorType: deps.actor.actorType }
      );
    }
  }

  assertNoBlockingEvidence(validatedResult);
  assertLifecycleCompatible(
    validatedResult,
    deps.lifecycleStatus,
    deps.completionReason
  );

  const timestamp = defaultNow(deps.now);
  return finalizeValidatedResult({
    ...validatedResult,
    acceptanceStatus: ACCEPTANCE_STATUS.ACCEPTED,
    acceptedAt: timestamp,
    actor: {
      actorType: deps.actor.actorType,
      actorId: deps.actor.actorId ?? validatedResult.actor?.actorId ?? null,
    },
  });
}

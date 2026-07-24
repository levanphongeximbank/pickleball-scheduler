/**
 * CORE-23 — evaluateRecovery: deterministic eligibility + mode planning.
 * Pure. No persistence, network, UI, or side effects.
 */

import { RecoveryError, RECOVERY_ERROR_CODE } from "../errors.js";
import {
  RECOVERY_MODE,
  RECOVERY_ELIGIBILITY,
  RECOVERY_OUTCOME_KIND,
  PARTIAL_OPERATION_STATUS,
} from "../enums.js";
import {
  createRecoveryRequest,
  createRecoveryOutcome,
  createRecoveryExplanation,
  createManualInterventionRequirement,
  createRecoveryFailureReason,
  assertRecoveryCheckpoint,
} from "../contracts/index.js";
import { validateRecoveryCheckpoint } from "./validateCheckpoint.js";
import { classifyPartialOperation } from "./classifyPartialOperation.js";
import { buildRecoveryPlan } from "./buildRecoveryPlan.js";
import { isPlainObject } from "../utils/helpers.js";

/**
 * @param {object} args
 * @returns {Readonly<object>}
 */
function rejectOutcome(args) {
  return createRecoveryOutcome({
    kind: args.kind ?? RECOVERY_OUTCOME_KIND.REJECTED,
    eligibility: args.eligibility ?? RECOVERY_ELIGIBILITY.INELIGIBLE,
    mode: args.mode ?? null,
    wouldApplyEffects: false,
    duplicateEffectsPrevented: args.duplicateEffectsPrevented === true,
    validation: args.validation ?? null,
    partialOperation: args.partialOperation ?? null,
    plan: args.plan ?? null,
    failure: createRecoveryFailureReason({
      code: args.code,
      message: args.message,
      details: args.details ?? null,
    }),
    manualIntervention: args.manualIntervention ?? null,
    explanation: createRecoveryExplanation({
      decision: args.kind ?? RECOVERY_OUTCOME_KIND.REJECTED,
      mode: args.mode ?? null,
      message: args.message,
      reasonCodes: [args.code],
      rejectedBecause: args.rejectedBecause ?? [args.message],
      escalatedBecause: args.escalatedBecause ?? [],
      allowedBecause: [],
      details: args.details ?? null,
    }),
    evidence: args.evidence ?? null,
  });
}

/**
 * @param {object} args
 * @returns {Readonly<object>}
 */
function manualOutcome(args) {
  return createRecoveryOutcome({
    kind: RECOVERY_OUTCOME_KIND.MANUAL_INTERVENTION,
    eligibility: RECOVERY_ELIGIBILITY.MANUAL_REQUIRED,
    mode: RECOVERY_MODE.MANUAL_RECOVERY,
    wouldApplyEffects: false,
    validation: args.validation ?? null,
    partialOperation: args.partialOperation ?? null,
    plan: buildRecoveryPlan({
      mode: RECOVERY_MODE.MANUAL_RECOVERY,
      partialOperation: args.partialOperation,
      checkpoint: args.checkpoint,
    }),
    failure: createRecoveryFailureReason({
      code: args.code ?? RECOVERY_ERROR_CODE.MANUAL_INTERVENTION_REQUIRED,
      message: args.message,
      details: args.details ?? null,
    }),
    manualIntervention: createManualInterventionRequirement({
      required: true,
      reasonCode: args.code ?? RECOVERY_ERROR_CODE.MANUAL_INTERVENTION_REQUIRED,
      evidenceGaps: args.evidenceGaps ?? [],
      recommendedOperatorAction:
        args.recommendedOperatorAction ??
        "Inspect evidence gaps and authorize an explicit recovery mode",
      blockingCodes: args.blockingCodes ?? [args.code],
    }),
    explanation: createRecoveryExplanation({
      decision: RECOVERY_OUTCOME_KIND.MANUAL_INTERVENTION,
      mode: RECOVERY_MODE.MANUAL_RECOVERY,
      message: args.message,
      reasonCodes: [args.code ?? RECOVERY_ERROR_CODE.MANUAL_INTERVENTION_REQUIRED],
      escalatedBecause: [args.message],
      rejectedBecause: [],
      allowedBecause: [],
      details: args.details ?? null,
    }),
    evidence: args.evidence ?? null,
  });
}

/**
 * @param {object} requestInput
 * @returns {Readonly<object>}
 */
export function evaluateRecovery(requestInput = {}) {
  let request;
  try {
    request = createRecoveryRequest(requestInput);
  } catch (err) {
    const code =
      err instanceof RecoveryError
        ? err.code
        : RECOVERY_ERROR_CODE.INVALID_REQUEST;
    return rejectOutcome({
      code,
      message: err instanceof Error ? err.message : "Invalid recovery request",
      details: err instanceof RecoveryError ? err.details : null,
    });
  }

  const context = request.context;
  const evidence = request.evidence;
  const requestedMode = request.requestedMode;

  // --- Duplicate / concurrent recovery protection ---
  const dupKey =
    request.duplicatePrevention?.duplicatePreventionKey ??
    request.idempotency?.idempotencyKey ??
    null;

  if (dupKey && context.seenDuplicatePreventionKeys.includes(dupKey)) {
    const priorFp =
      context.priorRecoveryOutcomeFingerprints[dupKey] ??
      request.duplicatePrevention?.priorOutcomeFingerprint ??
      null;
    if (priorFp) {
      return createRecoveryOutcome({
        kind: RECOVERY_OUTCOME_KIND.DUPLICATE_NOOP,
        eligibility: RECOVERY_ELIGIBILITY.DUPLICATE_NOOP,
        mode: requestedMode,
        wouldApplyEffects: false,
        duplicateEffectsPrevented: true,
        explanation: createRecoveryExplanation({
          decision: RECOVERY_OUTCOME_KIND.DUPLICATE_NOOP,
          mode: requestedMode,
          message:
            "Repeated recovery request with same duplicate-prevention reference — no duplicate effects",
          reasonCodes: ["DUPLICATE_RECOVERY_IDEMPOTENT"],
          allowedBecause: [
            "Duplicate-prevention key already evaluated",
            "Prior outcome fingerprint retained",
          ],
          rejectedBecause: [],
          escalatedBecause: [],
          details: { duplicatePreventionKey: dupKey, priorFp },
        }),
        evidence,
        outcomeFingerprint: priorFp,
      });
    }
    return rejectOutcome({
      code: RECOVERY_ERROR_CODE.DUPLICATE_RECOVERY_CONFLICT,
      message:
        "Concurrent or repeated recovery shares duplicate-prevention key without prior outcome fingerprint",
      details: { duplicatePreventionKey: dupKey },
      duplicateEffectsPrevented: true,
      evidence,
    });
  }

  // --- Resume token reuse ---
  if (request.resumeToken) {
    const token = request.resumeToken;
    const seen = context.seenResumeTokenIds.includes(token.tokenId);
    if (seen) {
      if (token.idempotentRepeatEvaluation === true || token.reusable === true) {
        // Fall through — allow deterministic re-evaluation only.
      } else {
        return rejectOutcome({
          code: RECOVERY_ERROR_CODE.RESUME_TOKEN_REUSED,
          message:
            "Resume token is not reusable and has already been consumed",
          details: { tokenId: token.tokenId },
          mode: RECOVERY_MODE.RESUME,
          evidence,
        });
      }
    }

    if (
      token.subject.subjectId !== request.subject.subjectId ||
      token.operation.operationId !== request.operation.operationId
    ) {
      return rejectOutcome({
        code: RECOVERY_ERROR_CODE.RESUME_TOKEN_INVALID,
        message: "Resume token subject/operation does not match request",
        details: { tokenId: token.tokenId },
        mode: RECOVERY_MODE.RESUME,
        evidence,
      });
    }
  }

  // --- MANUAL_RECOVERY requested explicitly ---
  if (requestedMode === RECOVERY_MODE.MANUAL_RECOVERY) {
    const partialOperation = classifyPartialOperation({
      checkpoint: request.checkpoint,
      evidence,
    });
    return manualOutcome({
      code: RECOVERY_ERROR_CODE.MANUAL_INTERVENTION_REQUIRED,
      message: "Manual recovery explicitly requested",
      evidenceGaps: ["OPERATOR_APPROVAL"],
      recommendedOperatorAction:
        "Authorize a concrete RETRY, RESUME, REPLAY, or ROLLBACK mode after review",
      blockingCodes: [RECOVERY_ERROR_CODE.MANUAL_INTERVENTION_REQUIRED],
      partialOperation,
      evidence,
      checkpoint: request.checkpoint,
    });
  }

  // --- ROLLBACK ---
  if (requestedMode === RECOVERY_MODE.ROLLBACK) {
    if (!context.compensationCapability?.available) {
      return createRecoveryOutcome({
        kind: RECOVERY_OUTCOME_KIND.UNSUPPORTED,
        eligibility: RECOVERY_ELIGIBILITY.MANUAL_REQUIRED,
        mode: RECOVERY_MODE.ROLLBACK,
        wouldApplyEffects: false,
        failure: createRecoveryFailureReason({
          code: RECOVERY_ERROR_CODE.ROLLBACK_UNSUPPORTED,
          message:
            "Rollback requested without a canonical compensation contract",
        }),
        manualIntervention: createManualInterventionRequirement({
          required: true,
          reasonCode: RECOVERY_ERROR_CODE.COMPENSATION_CONTRACT_MISSING,
          evidenceGaps: ["COMPENSATION_CONTRACT"],
          recommendedOperatorAction:
            "Do not invent rollback; use owning-module compensation or manual recovery",
          blockingCodes: [
            RECOVERY_ERROR_CODE.ROLLBACK_UNSUPPORTED,
            RECOVERY_ERROR_CODE.COMPENSATION_CONTRACT_MISSING,
          ],
        }),
        explanation: createRecoveryExplanation({
          decision: RECOVERY_OUTCOME_KIND.UNSUPPORTED,
          mode: RECOVERY_MODE.ROLLBACK,
          message:
            "Rollback is unsupported without an explicit public compensation capability",
          reasonCodes: [
            RECOVERY_ERROR_CODE.ROLLBACK_UNSUPPORTED,
            RECOVERY_ERROR_CODE.COMPENSATION_CONTRACT_MISSING,
          ],
          rejectedBecause: [
            "No canonical compensation contract exposed by owning module",
          ],
          escalatedBecause: ["Automated rollback safety cannot be proven"],
          allowedBecause: [],
        }),
        evidence,
      });
    }
    const partialOperation = classifyPartialOperation({
      checkpoint: request.checkpoint,
      evidence,
    });
    const plan = buildRecoveryPlan({
      mode: RECOVERY_MODE.ROLLBACK,
      partialOperation,
      checkpoint: request.checkpoint,
    });
    return createRecoveryOutcome({
      kind: RECOVERY_OUTCOME_KIND.ALLOWED,
      eligibility: RECOVERY_ELIGIBILITY.ELIGIBLE,
      mode: RECOVERY_MODE.ROLLBACK,
      wouldApplyEffects: true,
      partialOperation,
      plan,
      explanation: createRecoveryExplanation({
        decision: RECOVERY_OUTCOME_KIND.ALLOWED,
        mode: RECOVERY_MODE.ROLLBACK,
        message: "Rollback permitted via caller-supplied compensation capability",
        reasonCodes: ["COMPENSATION_CONTRACT_PRESENT"],
        allowedBecause: [
          "Explicit compensationCapability.available === true",
        ],
        rejectedBecause: [],
        escalatedBecause: [],
      }),
      evidence,
    });
  }

  // --- REPLAY ---
  if (requestedMode === RECOVERY_MODE.REPLAY) {
    const hasReplay =
      evidence.replayEvidence != null ||
      (evidence.seedEvidence != null &&
        evidence.eventHistoryComplete === true);
    if (!hasReplay) {
      return rejectOutcome({
        code: RECOVERY_ERROR_CODE.REPLAY_EVIDENCE_MISSING,
        message:
          "Replay requested without canonical CORE-20/CORE-21 replay evidence",
        mode: RECOVERY_MODE.REPLAY,
        evidence,
      });
    }
    if (evidence.eventHistoryComplete === false) {
      return manualOutcome({
        code: RECOVERY_ERROR_CODE.PARTIAL_OPERATION_AMBIGUOUS,
        message: "Event history is incomplete — replay cannot be proven safe",
        evidenceGaps: ["EVENT_HISTORY_COMPLETE"],
        recommendedOperatorAction:
          "Restore complete event history before authorizing replay",
        evidence,
      });
    }
    const partialOperation = classifyPartialOperation({
      checkpoint: request.checkpoint,
      evidence,
    });
    return createRecoveryOutcome({
      kind: RECOVERY_OUTCOME_KIND.ALLOWED,
      eligibility: RECOVERY_ELIGIBILITY.ELIGIBLE,
      mode: RECOVERY_MODE.REPLAY,
      wouldApplyEffects: false,
      partialOperation,
      plan: buildRecoveryPlan({
        mode: RECOVERY_MODE.REPLAY,
        partialOperation,
        checkpoint: request.checkpoint,
      }),
      explanation: createRecoveryExplanation({
        decision: RECOVERY_OUTCOME_KIND.ALLOWED,
        mode: RECOVERY_MODE.REPLAY,
        message:
          "Replay permitted using canonical seed/replay evidence (verification only; not rollback)",
        reasonCodes: ["REPLAY_EVIDENCE_PRESENT"],
        allowedBecause: [
          "Canonical replay or seed+complete history evidence provided",
        ],
        rejectedBecause: [],
        escalatedBecause: [],
      }),
      evidence,
    });
  }

  // --- RETRY / RESUME require checkpoint ---
  const validation = validateRecoveryCheckpoint(request.checkpoint, {
    expectedSubject: request.subject,
    expectedOperation: request.operation,
    currentSubjectVersion: context.currentSubjectVersion,
    currentDependencyEvidence: context.currentDependencyEvidence,
  });

  if (!validation.valid) {
    if (
      validation.code === RECOVERY_ERROR_CODE.CHECKPOINT_MISSING ||
      validation.code === RECOVERY_ERROR_CODE.CHECKPOINT_INTEGRITY_FAILED ||
      validation.code === RECOVERY_ERROR_CODE.INVALID_CHECKPOINT ||
      validation.code === RECOVERY_ERROR_CODE.CHECKPOINT_CORRUPT ||
      validation.code === RECOVERY_ERROR_CODE.CHECKPOINT_INCOMPLETE
    ) {
      return rejectOutcome({
        code: validation.code,
        message: validation.message ?? "Checkpoint validation failed",
        validation,
        mode: requestedMode,
        evidence,
        details: validation.details,
      });
    }
    if (
      validation.code === RECOVERY_ERROR_CODE.SUBJECT_MISMATCH ||
      validation.code === RECOVERY_ERROR_CODE.OPERATION_MISMATCH
    ) {
      return rejectOutcome({
        code: validation.code,
        message: validation.message ?? validation.code,
        validation,
        mode: requestedMode,
        evidence,
        details: validation.details,
      });
    }
    if (
      validation.code === RECOVERY_ERROR_CODE.CHECKPOINT_STALE ||
      validation.code === RECOVERY_ERROR_CODE.VERSION_MISMATCH ||
      validation.code === RECOVERY_ERROR_CODE.DEPENDENCY_STATE_CHANGED
    ) {
      return rejectOutcome({
        code: validation.code,
        message: validation.message ?? validation.code,
        validation,
        mode: requestedMode,
        evidence,
        details: validation.details,
      });
    }
    return rejectOutcome({
      code: validation.code ?? RECOVERY_ERROR_CODE.INVALID_CHECKPOINT,
      message: validation.message ?? "Checkpoint validation failed",
      validation,
      mode: requestedMode,
      evidence,
    });
  }

  let checkpoint;
  try {
    checkpoint = assertRecoveryCheckpoint(request.checkpoint);
  } catch (err) {
    return rejectOutcome({
      code:
        err instanceof RecoveryError
          ? err.code
          : RECOVERY_ERROR_CODE.INVALID_CHECKPOINT,
      message: err instanceof Error ? err.message : "Invalid checkpoint",
      mode: requestedMode,
      evidence,
    });
  }

  if (request.resumeToken) {
    if (request.resumeToken.checkpointId !== checkpoint.checkpointId) {
      return rejectOutcome({
        code: RECOVERY_ERROR_CODE.RESUME_TOKEN_INVALID,
        message: "Resume token checkpointId does not match checkpoint",
        mode: RECOVERY_MODE.RESUME,
        evidence,
      });
    }
  }

  // Idempotency evidence for RETRY/RESUME
  const idempotency = request.idempotency ?? checkpoint.idempotency;
  if (!idempotency || !idempotency.idempotencyKey) {
    return rejectOutcome({
      code: RECOVERY_ERROR_CODE.IDEMPOTENCY_INVALID,
      message:
        "Idempotency or duplicate-prevention reference is required for recovery",
      mode: requestedMode,
      evidence,
      validation,
    });
  }

  const partialOperation = classifyPartialOperation({
    checkpoint,
    evidence,
  });

  if (
    partialOperation.status === PARTIAL_OPERATION_STATUS.AMBIGUOUS ||
    partialOperation.status === PARTIAL_OPERATION_STATUS.OUTCOME_UNKNOWN
  ) {
    return manualOutcome({
      code:
        partialOperation.status === PARTIAL_OPERATION_STATUS.OUTCOME_UNKNOWN
          ? RECOVERY_ERROR_CODE.PARTIAL_OPERATION_AMBIGUOUS
          : RECOVERY_ERROR_CODE.PARTIAL_OPERATION_AMBIGUOUS,
      message:
        partialOperation.status === PARTIAL_OPERATION_STATUS.OUTCOME_UNKNOWN
          ? "Operation outcome is unknown — automated recovery is unsafe"
          : "Partial-operation state is ambiguous — manual intervention required",
      evidenceGaps: partialOperation.reasonCodes,
      recommendedOperatorAction:
        "Reconcile completion markers and effect evidence before retry/resume",
      blockingCodes: [RECOVERY_ERROR_CODE.PARTIAL_OPERATION_AMBIGUOUS],
      partialOperation,
      validation,
      evidence,
      checkpoint,
    });
  }

  if (evidence.seedEvidence != null && evidence.completionMarkerPresent !== true) {
    // Seed present but no completion — still recoverable if partial status is clear.
    if (
      partialOperation.status === PARTIAL_OPERATION_STATUS.AMBIGUOUS
    ) {
      return manualOutcome({
        code: RECOVERY_ERROR_CODE.PARTIAL_OPERATION_AMBIGUOUS,
        message:
          "Deterministic seed evidence exists without completion evidence",
        evidenceGaps: ["COMPLETION_MARKER", "SEED_WITHOUT_COMPLETION"],
        partialOperation,
        validation,
        evidence,
        checkpoint,
      });
    }
  }

  // --- RETRY ---
  if (requestedMode === RECOVERY_MODE.RETRY) {
    if (partialOperation.status === PARTIAL_OPERATION_STATUS.COMPLETED) {
      return rejectOutcome({
        code: RECOVERY_ERROR_CODE.OPERATION_ALREADY_COMPLETED,
        message:
          "Completed operation incorrectly requested for retry — use duplicate-noop path or do not retry",
        mode: RECOVERY_MODE.RETRY,
        partialOperation,
        validation,
        evidence,
        eligibility: RECOVERY_ELIGIBILITY.ALREADY_COMPLETED,
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
      });
    }
    if (
      partialOperation.status === PARTIAL_OPERATION_STATUS.PARTIAL_EFFECTS_APPLIED
    ) {
      return rejectOutcome({
        code: RECOVERY_ERROR_CODE.RETRY_UNSAFE,
        message:
          "Retry is unsafe after partial effects — use RESUME from checkpoint instead",
        mode: RECOVERY_MODE.RETRY,
        partialOperation,
        validation,
        evidence,
      });
    }
    // RETRY allowed for NOT_STARTED or VALIDATED_NO_EFFECTS with idempotency.
    const plan = buildRecoveryPlan({
      mode: RECOVERY_MODE.RETRY,
      partialOperation,
      checkpoint,
    });
    return createRecoveryOutcome({
      kind: RECOVERY_OUTCOME_KIND.ALLOWED,
      eligibility: RECOVERY_ELIGIBILITY.ELIGIBLE,
      mode: RECOVERY_MODE.RETRY,
      wouldApplyEffects: true,
      duplicateEffectsPrevented: true,
      validation,
      partialOperation,
      plan,
      explanation: createRecoveryExplanation({
        decision: RECOVERY_OUTCOME_KIND.ALLOWED,
        mode: RECOVERY_MODE.RETRY,
        message:
          "Retry permitted: prior attempt did not complete effects; idempotency protection present",
        reasonCodes: ["RETRY_SAFE"],
        allowedBecause: [
          `partialOperation=${partialOperation.status}`,
          `idempotencyKey=${idempotency.idempotencyKey}`,
          "No completed effects would be repeated unsafely",
        ],
        rejectedBecause: [],
        escalatedBecause: [],
      }),
      evidence,
    });
  }

  // --- RESUME ---
  if (requestedMode === RECOVERY_MODE.RESUME) {
    if (!request.checkpoint) {
      return rejectOutcome({
        code: RECOVERY_ERROR_CODE.CHECKPOINT_MISSING,
        message: "Resume requires a valid checkpoint",
        mode: RECOVERY_MODE.RESUME,
        evidence,
      });
    }
    if (partialOperation.status === PARTIAL_OPERATION_STATUS.COMPLETED) {
      return createRecoveryOutcome({
        kind: RECOVERY_OUTCOME_KIND.DUPLICATE_NOOP,
        eligibility: RECOVERY_ELIGIBILITY.ALREADY_COMPLETED,
        mode: RECOVERY_MODE.RESUME,
        wouldApplyEffects: false,
        duplicateEffectsPrevented: true,
        validation,
        partialOperation,
        plan: buildRecoveryPlan({
          mode: RECOVERY_MODE.RESUME,
          partialOperation,
          checkpoint,
        }),
        explanation: createRecoveryExplanation({
          decision: RECOVERY_OUTCOME_KIND.DUPLICATE_NOOP,
          mode: RECOVERY_MODE.RESUME,
          message:
            "Operation already complete — resume produces no duplicate effects",
          reasonCodes: ["ALREADY_COMPLETED_NOOP"],
          allowedBecause: ["Completion evidence present"],
          rejectedBecause: [],
          escalatedBecause: [],
        }),
        evidence,
      });
    }
    if (
      partialOperation.status === PARTIAL_OPERATION_STATUS.NOT_STARTED &&
      !request.resumeToken
    ) {
      // Resume without progress — still valid if checkpoint proves safe start point.
    }

    const plan = buildRecoveryPlan({
      mode: RECOVERY_MODE.RESUME,
      partialOperation,
      checkpoint,
    });

    // Ensure completed effects are never in pending actionable set.
    const overlap = plan.pendingEffectIds.filter((id) =>
      plan.skipCompletedEffectIds.includes(id)
    );
    if (overlap.length > 0) {
      return rejectOutcome({
        code: RECOVERY_ERROR_CODE.RESUME_UNSAFE,
        message: "Resume plan would repeat completed effects",
        mode: RECOVERY_MODE.RESUME,
        details: { overlap },
        validation,
        partialOperation,
        evidence,
      });
    }

    return createRecoveryOutcome({
      kind: RECOVERY_OUTCOME_KIND.ALLOWED,
      eligibility: RECOVERY_ELIGIBILITY.ELIGIBLE,
      mode: RECOVERY_MODE.RESUME,
      wouldApplyEffects: plan.pendingEffectIds.length > 0 ||
        plan.steps.some((s) => s.kind === "APPLY_PENDING"),
      duplicateEffectsPrevented: true,
      validation,
      partialOperation,
      plan,
      explanation: createRecoveryExplanation({
        decision: RECOVERY_OUTCOME_KIND.ALLOWED,
        mode: RECOVERY_MODE.RESUME,
        message:
          "Resume permitted from validated checkpoint; completed effects skipped",
        reasonCodes: ["RESUME_SAFE"],
        allowedBecause: [
          "Checkpoint integrity verified",
          "Subject and operation identities match",
          `partialOperation=${partialOperation.status}`,
          "Completed effects excluded from resume plan",
          `idempotencyKey=${idempotency.idempotencyKey}`,
        ],
        rejectedBecause: [],
        escalatedBecause: [],
        details: {
          checkpointId: checkpoint.checkpointId,
          pendingEffectIds: plan.pendingEffectIds,
          skipCompletedEffectIds: plan.skipCompletedEffectIds,
        },
      }),
      evidence,
    });
  }

  return rejectOutcome({
    code: RECOVERY_ERROR_CODE.MODE_NOT_PERMITTED,
    message: `Unsupported recovery mode: ${requestedMode}`,
    mode: requestedMode,
    evidence,
  });
}

/**
 * Convenience: assess eligibility only (thin wrapper).
 * @param {object} requestInput
 * @returns {Readonly<object>}
 */
export function assessRecoveryEligibility(requestInput = {}) {
  const outcome = evaluateRecovery(requestInput);
  return Object.freeze({
    eligibility: outcome.eligibility,
    mode: outcome.mode,
    ok: outcome.ok,
    kind: outcome.kind,
    explanation: outcome.explanation,
    outcome,
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRecoveryRequest(value) {
  return isPlainObject(value) && typeof value.requestedMode === "string";
}

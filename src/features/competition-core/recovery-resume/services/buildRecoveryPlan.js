/**
 * CORE-23 — build recovery / resume plans from classified state.
 * Pure planning only — never executes effects.
 */

import {
  RECOVERY_MODE,
  RECOVERY_STEP_KIND,
  PARTIAL_OPERATION_STATUS,
} from "../enums.js";
import {
  createRecoveryPlan,
  createResumePlan,
  createRecoveryStep,
} from "../contracts/index.js";

/**
 * @param {object} input
 * @param {string} input.mode
 * @param {object} input.partialOperation
 * @param {object} [input.checkpoint]
 * @returns {Readonly<object>}
 */
export function buildRecoveryPlan(input) {
  const { mode, partialOperation, checkpoint } = input;
  const completedEffectIds = partialOperation?.completedEffectIds ?? [];
  const pendingEffectIds = partialOperation?.pendingEffectIds ?? [];
  const pendingStepIds = partialOperation?.pendingStepIds ?? [];
  const completedStepIds = partialOperation?.completedStepIds ?? [];

  if (mode === RECOVERY_MODE.MANUAL_RECOVERY) {
    return createRecoveryPlan({
      mode,
      steps: [
        createRecoveryStep({
          stepId: "manual-operator",
          kind: RECOVERY_STEP_KIND.REQUIRE_OPERATOR,
          description: "Authorized operator must choose a safe recovery path",
        }),
      ],
      skipCompletedEffectIds: completedEffectIds,
      pendingEffectIds: [],
      duplicateProtected: true,
    });
  }

  if (mode === RECOVERY_MODE.ROLLBACK) {
    return createRecoveryPlan({
      mode,
      steps: [
        createRecoveryStep({
          stepId: "compensate",
          kind: RECOVERY_STEP_KIND.COMPENSATE,
          description: "Apply canonical compensation contract if available",
        }),
      ],
      skipCompletedEffectIds: completedEffectIds,
      pendingEffectIds: [],
      duplicateProtected: true,
    });
  }

  if (mode === RECOVERY_MODE.REPLAY) {
    return createRecoveryPlan({
      mode,
      steps: [
        createRecoveryStep({
          stepId: "replay-verify",
          kind: RECOVERY_STEP_KIND.REPLAY_VERIFY,
          description:
            "Verify deterministic replay using CORE-20/CORE-21 public evidence",
        }),
      ],
      skipCompletedEffectIds: completedEffectIds,
      pendingEffectIds: [],
      duplicateProtected: true,
    });
  }

  if (mode === RECOVERY_MODE.RETRY) {
    return createRecoveryPlan({
      mode,
      steps: [
        createRecoveryStep({
          stepId: "retry-operation",
          kind: RECOVERY_STEP_KIND.RETRY_OPERATION,
          targetId: checkpoint?.operation?.operationId ?? null,
          description: "Re-execute operation under idempotent/duplicate protection",
        }),
      ],
      skipCompletedEffectIds: completedEffectIds,
      pendingEffectIds: pendingEffectIds,
      duplicateProtected: true,
    });
  }

  // RESUME — never include completed effects as actionable steps.
  /** @type {ReturnType<typeof createRecoveryStep>[]} */
  const steps = [
    createRecoveryStep({
      stepId: "validate-resume",
      kind: RECOVERY_STEP_KIND.VALIDATE,
      description: "Re-validate checkpoint and last-known-safe state",
    }),
  ];

  for (const stepId of pendingStepIds) {
    if (completedStepIds.includes(stepId)) continue;
    steps.push(
      createRecoveryStep({
        stepId: `resume-step:${stepId}`,
        kind: RECOVERY_STEP_KIND.APPLY_PENDING,
        targetId: stepId,
        alreadyCompleted: false,
        description: `Continue pending step ${stepId}`,
      })
    );
  }

  for (const effectId of pendingEffectIds) {
    if (completedEffectIds.includes(effectId)) continue;
    steps.push(
      createRecoveryStep({
        stepId: `resume-effect:${effectId}`,
        kind: RECOVERY_STEP_KIND.APPLY_PENDING,
        targetId: effectId,
        alreadyCompleted: false,
        description: `Apply pending effect ${effectId}`,
      })
    );
  }

  if (
    pendingStepIds.length === 0 &&
    pendingEffectIds.length === 0 &&
    partialOperation?.status === PARTIAL_OPERATION_STATUS.COMPLETED
  ) {
    steps.push(
      createRecoveryStep({
        stepId: "noop-complete",
        kind: RECOVERY_STEP_KIND.NO_OP,
        alreadyCompleted: true,
        description: "Operation already complete — no effects to apply",
      })
    );
  }

  return createResumePlan({
    steps,
    skipCompletedEffectIds: completedEffectIds,
    pendingEffectIds: pendingEffectIds.filter(
      (id) => !completedEffectIds.includes(id)
    ),
    duplicateProtected: true,
  });
}

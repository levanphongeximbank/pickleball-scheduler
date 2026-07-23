/**
 * CORE-19 — evaluate transition effects from descriptors + supplied pure outcomes.
 * Never executes network, persistence, or dependency mutation.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { createTransitionExplanation } from "../contracts/transitionExplanation.js";
import {
  WORKFLOW_EFFECT_STATUS,
  createWorkflowEffectDescriptor,
  createWorkflowEffectResult,
  sortWorkflowEffectDescriptors,
} from "../contracts/workflowEffect.js";
import {
  compareStableString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";
import { createSuppliedWorkflowEffectPort } from "../ports/workflowEffectPort.js";

/**
 * @typedef {Object} TransitionEffectsEvaluation
 * @property {boolean} ok
 * @property {boolean} canComplete
 * @property {string|null} code
 * @property {ReadonlyArray<object>} descriptors
 * @property {ReadonlyArray<object>} results
 * @property {ReadonlyArray<string>} failedEffectIds
 * @property {ReadonlyArray<string>} warnings
 * @property {Readonly<object>} explanation
 */

/**
 * @param {object} [input]
 * @param {unknown} [input.effects]
 * @param {unknown} [input.descriptors]
 * @param {unknown} [input.outcomes]
 * @param {unknown} [input.effectPort]
 * @param {boolean} [input.allowOptionalEffectFailure]
 * @returns {Readonly<TransitionEffectsEvaluation>}
 */
export function evaluateTransitionEffects(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const rawList = Array.isArray(source.effects)
    ? source.effects
    : Array.isArray(source.descriptors)
      ? source.descriptors
      : [];

  let descriptors;
  try {
    descriptors = sortWorkflowEffectDescriptors(
      rawList.map((item) => createWorkflowEffectDescriptor(item))
    );
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String(err.code)
        : WORKFLOW_ERROR_CODE.INVALID_EFFECT_DEFINITION;
    return Object.freeze({
      ok: false,
      canComplete: false,
      code,
      descriptors: Object.freeze([]),
      results: Object.freeze([]),
      failedEffectIds: Object.freeze([]),
      warnings: Object.freeze([]),
      explanation: createTransitionExplanation({
        code,
        message: err instanceof Error ? err.message : "Invalid effect definition",
        details: {},
      }),
    });
  }

  const port =
    source.effectPort && typeof source.effectPort.resolveOutcome === "function"
      ? source.effectPort
      : createSuppliedWorkflowEffectPort(
          isPlainObject(source.outcomes) ? source.outcomes : {}
        );

  const allowOptionalFailure = source.allowOptionalEffectFailure === true;
  const results = [];
  const failedRequired = [];
  const warnings = [];

  for (const descriptor of descriptors) {
    const outcome = port.resolveOutcome(descriptor, source.context || {});
    const result = createWorkflowEffectResult({
      effectId: descriptor.effectId,
      ...(isPlainObject(outcome) ? outcome : {}),
    });
    results.push(result);

    if (result.status === WORKFLOW_EFFECT_STATUS.PENDING) {
      if (descriptor.required) {
        failedRequired.push(descriptor.effectId);
        warnings.push(
          result.explanation || `Required effect ${descriptor.effectId} not ready`
        );
      } else if (allowOptionalFailure) {
        warnings.push(
          result.warning ||
            result.explanation ||
            `Optional effect ${descriptor.effectId} pending`
        );
      } else {
        failedRequired.push(descriptor.effectId);
      }
      continue;
    }

    if (result.status === WORKFLOW_EFFECT_STATUS.FAILED || result.ok !== true) {
      if (descriptor.required) {
        failedRequired.push(descriptor.effectId);
      } else if (allowOptionalFailure) {
        warnings.push(
          result.warning ||
            result.explanation ||
            result.dependencyCode ||
            `Optional effect ${descriptor.effectId} failed`
        );
      } else {
        failedRequired.push(descriptor.effectId);
      }
      continue;
    }

    if (result.warning) warnings.push(result.warning);
  }

  const failedEffectIds = Object.freeze(
    [...new Set(failedRequired)].sort(compareStableString)
  );
  const stableWarnings = Object.freeze(
    [...new Set(warnings.map(String))].sort(compareStableString)
  );
  const canComplete = failedEffectIds.length === 0;
  const code = canComplete
    ? null
    : descriptors.some((d) =>
        results.find(
          (r) =>
            r.effectId === d.effectId &&
            r.status === WORKFLOW_EFFECT_STATUS.PENDING &&
            d.required
        )
      )
      ? WORKFLOW_ERROR_CODE.EFFECT_NOT_READY
      : WORKFLOW_ERROR_CODE.TRANSITION_EFFECT_FAILED;

  return Object.freeze({
    ok: canComplete,
    canComplete,
    code,
    descriptors,
    results: Object.freeze([...results]),
    failedEffectIds,
    warnings: stableWarnings,
    explanation: createTransitionExplanation({
      code: code || "EFFECTS_EVALUATED",
      message: canComplete
        ? "Transition effects permit completion"
        : "Required transition effects are not satisfied",
      details: {
        failedEffectIds,
        warnings: stableWarnings,
        results: results.map((r) => ({
          effectId: r.effectId,
          status: r.status,
          ok: r.ok,
          dependencyCode: r.dependencyCode,
        })),
      },
    }),
  });
}

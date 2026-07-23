/**
 * CORE-19 — apply supplied pure effect outcomes (composition only).
 * Does not execute external effects. Returns composed results + completion gate.
 */

import { evaluateTransitionEffects } from "./evaluateTransitionEffects.js";
import { isPlainObject } from "../utils/canonicalizeWorkflowPayload.js";

/**
 * @param {object} [input]
 * @returns {Readonly<object>}
 */
export function applyTransitionEffects(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const evaluation = evaluateTransitionEffects(source);

  return Object.freeze({
    ok: evaluation.canComplete === true,
    canComplete: evaluation.canComplete === true,
    code: evaluation.code,
    descriptors: evaluation.descriptors,
    results: evaluation.results,
    failedEffectIds: evaluation.failedEffectIds,
    warnings: evaluation.warnings,
    explanation: evaluation.explanation,
    applied: true,
    // Explicit: no external execution occurred.
    externalEffectsExecuted: false,
  });
}

/**
 * CORE-19 — pure effect port contract.
 *
 * Callers supply pure effect outcomes. This port never performs network I/O,
 * persistence, or dependency mutation. External effect execution is out of scope.
 */

import { isPlainObject } from "../utils/canonicalizeWorkflowPayload.js";
import { createWorkflowEffectResult } from "../contracts/workflowEffect.js";

/**
 * @typedef {Object} WorkflowEffectPort
 * @property {(descriptor: object, context?: object) => object} resolveOutcome
 */

/**
 * Create a port that resolves outcomes from a supplied map keyed by effectId.
 * Missing required outcomes remain PENDING / not ready at evaluation time.
 *
 * @param {Record<string, unknown>} [outcomesByEffectId]
 * @returns {Readonly<WorkflowEffectPort>}
 */
export function createSuppliedWorkflowEffectPort(outcomesByEffectId = {}) {
  const map = isPlainObject(outcomesByEffectId) ? outcomesByEffectId : {};
  return Object.freeze({
    resolveOutcome(descriptor) {
      const effectId = String(descriptor?.effectId || "");
      const supplied = map[effectId];
      if (supplied == null) {
        return createWorkflowEffectResult({
          effectId,
          status: "PENDING",
          ok: false,
          explanation: "Effect outcome not supplied",
          dependencyCode: "EFFECT_NOT_READY",
        });
      }
      return createWorkflowEffectResult({
        effectId,
        ...(isPlainObject(supplied) ? supplied : { output: { value: supplied } }),
        ok: isPlainObject(supplied) ? supplied.ok === true : true,
        status:
          isPlainObject(supplied) && supplied.status
            ? supplied.status
            : isPlainObject(supplied) && supplied.ok === false
              ? "FAILED"
              : "SUCCEEDED",
      });
    },
  });
}

/**
 * Null port — all effects resolve as PENDING (not ready).
 * @returns {Readonly<WorkflowEffectPort>}
 */
export function createNullWorkflowEffectPort() {
  return createSuppliedWorkflowEffectPort({});
}

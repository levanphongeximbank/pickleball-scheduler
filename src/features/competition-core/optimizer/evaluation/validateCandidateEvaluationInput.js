/**
 * CORE-10 Phase 1C-B1 — structural CandidateEvaluationInput validation.
 * Classifies failures with Phase 1C-B codes. Replay-safe failure shape uses
 * code + messageCode + canonical details only (no free-text ranking material).
 * Does not create HardViolations, call the port, evaluate objectives, or
 * build CandidateEvaluationResult.
 */

import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createCandidateEvaluationInput } from "../contracts/candidateEvaluationInput.js";

/**
 * @param {unknown} partial
 * @returns {{
 *   ok: true,
 *   input: Readonly<object>,
 * } | {
 *   ok: false,
 *   code: string,
 *   messageCode: string,
 *   details: Readonly<Record<string, unknown>>,
 * }}
 */
export function validateCandidateEvaluationInput(partial) {
  try {
    const input = createCandidateEvaluationInput(
      partial && typeof partial === "object"
        ? /** @type {object} */ (partial)
        : {}
    );
    return Object.freeze({ ok: true, input });
  } catch (err) {
    if (err instanceof OptimizerContractError) {
      return Object.freeze({
        ok: false,
        code: err.code,
        messageCode: err.code,
        details: Object.freeze({ ...(err.details || {}) }),
      });
    }
    throw err;
  }
}

import { deepFreeze } from "../domain/deepFreeze.js";
import {
  FINALIZATION_STATE,
  FINALIZATION_STATE_VALUES,
} from "../domain/constants.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";

/**
 * Explicit CORE-07 Phase 1E transition matrix.
 *
 * Keys: `${from}->${to}`
 * Values:
 * - ALLOWED: structural transition permitted (service may still apply preconditions)
 * - IDEMPOTENT_ONLY: only identical finalization replay (not a new transition)
 * - REJECTED: fail closed
 *
 * Idempotent FINALIZED handling is separate from a new FINALIZED transition.
 */
export const SEEDING_STATE_TRANSITION_MATRIX = Object.freeze({
  "DRAFT->FINALIZED": "ALLOWED",
  "DRAFT->CANCELLED": "ALLOWED",
  "DRAFT->SUPERSEDED": "REJECTED",
  "DRAFT->DRAFT": "REJECTED",
  "FINALIZED->FINALIZED": "IDEMPOTENT_ONLY",
  "FINALIZED->SUPERSEDED": "ALLOWED",
  "FINALIZED->CANCELLED": "REJECTED",
  "FINALIZED->DRAFT": "REJECTED",
  "SUPERSEDED->DRAFT": "REJECTED",
  "SUPERSEDED->FINALIZED": "REJECTED",
  "SUPERSEDED->SUPERSEDED": "REJECTED",
  "SUPERSEDED->CANCELLED": "REJECTED",
  "CANCELLED->DRAFT": "REJECTED",
  "CANCELLED->FINALIZED": "REJECTED",
  "CANCELLED->SUPERSEDED": "REJECTED",
  "CANCELLED->CANCELLED": "REJECTED",
});

/**
 * @param {string} fromState
 * @param {string} toState
 * @returns {"ALLOWED"|"IDEMPOTENT_ONLY"|"REJECTED"}
 */
export function getSeedingStateTransitionDecision(fromState, toState) {
  if (
    !FINALIZATION_STATE_VALUES.has(fromState) ||
    !FINALIZATION_STATE_VALUES.has(toState)
  ) {
    return "REJECTED";
  }
  const key = `${fromState}->${toState}`;
  return SEEDING_STATE_TRANSITION_MATRIX[key] || "REJECTED";
}

/**
 * Validate a requested state transition.
 * Idempotent finalization must pass `allowIdempotentFinalizedReplay=true`.
 *
 * @param {{
 *   fromState: string,
 *   toState: string,
 *   allowIdempotentFinalizedReplay?: boolean,
 * }} input
 * @returns {Readonly<{ fromState: string, toState: string, decision: string }>}
 */
export function validateSeedingStateTransition(input) {
  if (!input || typeof input !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "validateSeedingStateTransition input is required"
    );
  }
  const fromState = String(input.fromState || "");
  const toState = String(input.toState || "");
  if (
    !FINALIZATION_STATE_VALUES.has(fromState) ||
    !FINALIZATION_STATE_VALUES.has(toState)
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_STATE_TRANSITION,
      "Unknown finalization state in transition",
      { fromState, toState }
    );
  }

  const decision = getSeedingStateTransitionDecision(fromState, toState);
  if (decision === "ALLOWED") {
    return deepFreeze({ fromState, toState, decision });
  }
  if (
    decision === "IDEMPOTENT_ONLY" &&
    input.allowIdempotentFinalizedReplay === true &&
    fromState === FINALIZATION_STATE.FINALIZED &&
    toState === FINALIZATION_STATE.FINALIZED
  ) {
    return deepFreeze({ fromState, toState, decision });
  }

  const code =
    fromState === FINALIZATION_STATE.FINALIZED &&
    toState !== FINALIZATION_STATE.SUPERSEDED
      ? SEEDING_ERROR_CODE.RESULT_FINALIZED
      : SEEDING_ERROR_CODE.INVALID_STATE_TRANSITION;

  throwSeedingError(code, `Invalid state transition ${fromState} → ${toState}`, {
    fromState,
    toState,
    decision,
  });
}

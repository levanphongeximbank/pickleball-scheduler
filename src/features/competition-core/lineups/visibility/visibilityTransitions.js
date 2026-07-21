/**
 * CORE-06 Phase 1E — visibility transition validation (monotonic by default).
 */

import {
  compareVisibilityRank,
  isLineupVisibilityState,
  LINEUP_VISIBILITY_STATE,
} from "../contracts/lineupVisibilityState.js";
import { createLineupPolicyResult } from "../contracts/lineupPolicy.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * Adjacent default progression (policy may authorize skips).
 */
export const DEFAULT_VISIBILITY_PROGRESSION = Object.freeze([
  LINEUP_VISIBILITY_STATE.PRIVATE,
  LINEUP_VISIBILITY_STATE.TEAM_VISIBLE,
  LINEUP_VISIBILITY_STATE.OFFICIALS_VISIBLE,
  LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE,
  LINEUP_VISIBILITY_STATE.PUBLIC,
]);

/**
 * @param {object} params
 * @param {string} params.from
 * @param {string} params.to
 * @param {import('../contracts/lineupHardeningPolicy.js').LineupHardeningPolicy} [params.policy]
 * @param {boolean} [params.revealAuthorized]
 * @param {boolean} [params.revealReady]
 * @returns {import('../contracts/lineupPolicy.js').LineupPolicyResult}
 */
export function assertVisibilityTransitionAllowed({
  from,
  to,
  policy = null,
  revealAuthorized = false,
  revealReady = false,
}) {
  if (!isLineupVisibilityState(from) || !isLineupVisibilityState(to)) {
    return createLineupPolicyResult({
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_VISIBILITY_TRANSITION_NOT_ALLOWED,
      message: "Unknown visibility state",
      details: { from, to },
    });
  }

  if (from === to) {
    return createLineupPolicyResult({ ok: true, details: { from, to } });
  }

  const delta = compareVisibilityRank(from, to);
  if (delta == null) {
    return createLineupPolicyResult({
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_VISIBILITY_TRANSITION_NOT_ALLOWED,
      message: "Visibility states are not comparable",
      details: { from, to },
    });
  }

  if (delta < 0) {
    const allowsRegression =
      policy && typeof policy.allowsVisibilityRegression === "function"
        ? policy.allowsVisibilityRegression({ from, to }) === true
        : false;
    if (!allowsRegression) {
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_VISIBILITY_TRANSITION_NOT_ALLOWED,
        message: "Visibility regression is blocked by default",
        details: { from, to },
      });
    }
  }

  const fromRank =
    DEFAULT_VISIBILITY_PROGRESSION.indexOf(/** @type {string} */ (from));
  const toRank =
    DEFAULT_VISIBILITY_PROGRESSION.indexOf(/** @type {string} */ (to));
  if (fromRank >= 0 && toRank >= 0 && toRank - fromRank > 1) {
    const allowsSkip =
      policy && typeof policy.allowsVisibilityStageSkip === "function"
        ? policy.allowsVisibilityStageSkip({ from, to }) === true
        : false;
    if (!allowsSkip) {
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_VISIBILITY_TRANSITION_NOT_ALLOWED,
        message: "Visibility stage skip requires explicit policy authorization",
        details: { from, to },
      });
    }
  }

  if (
    to === LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE ||
    to === LINEUP_VISIBILITY_STATE.PUBLIC
  ) {
    if (revealAuthorized !== true) {
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVEAL_NOT_AUTHORIZED,
        message: "Reveal/public visibility requires policy authorization",
        details: { from, to },
      });
    }
    if (revealReady !== true) {
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVEAL_NOT_AUTHORIZED,
        message: "Reveal is not eligible yet (revealAt / policy)",
        details: { from, to },
      });
    }
  }

  if (policy && typeof policy.authorizeVisibilityTransition === "function") {
    const decision = policy.authorizeVisibilityTransition({ from, to });
    if (decision && decision.ok !== true) {
      return createLineupPolicyResult({
        ok: false,
        code:
          decision.code ||
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_VISIBILITY_TRANSITION_NOT_ALLOWED,
        message: decision.message || "Visibility transition denied by policy",
        details: { from, to, ...(decision.details || {}) },
      });
    }
  }

  return createLineupPolicyResult({ ok: true, details: { from, to } });
}

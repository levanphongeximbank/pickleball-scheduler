/**
 * CORE-06 Phase 1E — deterministic deadline evaluation.
 * Explicit evaluation time only — never Date.now / system clock.
 */

import {
  createLineupDeadlineTimestamps,
  LINEUP_DEADLINE_PHASE,
} from "../contracts/lineupDeadlinePhase.js";
import { createLineupPolicyResult } from "../contracts/lineupPolicy.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LINEUP_ACTION } from "../services/transitions.js";

/**
 * Parse ISO-8601-ish timestamp to epoch ms. Invalid → null (fail closed).
 * @param {unknown} value
 * @returns {number|null}
 */
export function parsePolicyTimeMs(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  return ms;
}

/**
 * Resolve explicit evaluation time from command/request fields.
 * @param {object} [input]
 * @returns {string|null}
 */
export function resolveExplicitEvaluationTime(input = {}) {
  const candidates = [
    input.evaluatedAt,
    input.commandTime,
    input.policyTime,
    input.now,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== "") {
      return String(c).trim();
    }
  }
  return null;
}

/**
 * Evaluate deadline phase from injected timestamps + explicit evaluatedAt.
 * Does NOT publish, reveal, forfeit, or randomize.
 *
 * @param {object} params
 * @param {import('../contracts/lineupDeadlinePhase.js').LineupDeadlineTimestamps|object|null} params.timestamps
 * @param {string} params.evaluatedAt
 * @returns {{ ok: true, phase: string, evaluatedAt: string, timestamps: object, revealEligible: boolean } | { ok: false, code: string, message: string, phase: null }}
 */
export function evaluateDeadlinePhase({ timestamps = null, evaluatedAt }) {
  const at = resolveExplicitEvaluationTime({ evaluatedAt });
  if (!at) {
    return {
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_CLOCK_REQUIRED,
      message: "Deadline evaluation requires explicit evaluatedAt",
      phase: null,
    };
  }
  const evaluatedMs = parsePolicyTimeMs(at);
  if (evaluatedMs == null) {
    return {
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_CLOCK_REQUIRED,
      message: "evaluatedAt is not a valid timestamp",
      phase: null,
    };
  }

  const ts = createLineupDeadlineTimestamps(timestamps || {});
  const opensMs = parsePolicyTimeMs(ts.opensAt);
  const submitMs = parsePolicyTimeMs(ts.submitBy);
  const graceMs = parsePolicyTimeMs(ts.graceUntil);
  const lockMs = parsePolicyTimeMs(ts.lockAt);
  const revealMs = parsePolicyTimeMs(ts.revealAt);

  let phase;
  if (opensMs != null && evaluatedMs < opensMs) {
    phase = LINEUP_DEADLINE_PHASE.NOT_OPEN;
  } else if (lockMs != null && evaluatedMs >= lockMs) {
    phase = LINEUP_DEADLINE_PHASE.LOCKED;
  } else if (graceMs != null && submitMs != null) {
    if (evaluatedMs >= graceMs) {
      phase = LINEUP_DEADLINE_PHASE.CLOSED;
    } else if (evaluatedMs >= submitMs) {
      phase = LINEUP_DEADLINE_PHASE.GRACE_PERIOD;
    } else {
      phase = LINEUP_DEADLINE_PHASE.OPEN;
    }
  } else if (submitMs != null && evaluatedMs >= submitMs) {
    phase = LINEUP_DEADLINE_PHASE.CLOSED;
  } else {
    phase = LINEUP_DEADLINE_PHASE.OPEN;
  }

  const revealEligible =
    revealMs != null && evaluatedMs >= revealMs;

  // Mutation phase and reveal eligibility are independent dimensions.
  // REVEAL_READY is reported via revealPhase only — never erases LOCKED/CLOSED.
  // Does NOT auto-transition visibility.
  return {
    ok: true,
    phase,
    mutationPhase: phase,
    underlyingPhase: phase,
    revealEligible,
    revealPhase: revealEligible
      ? LINEUP_DEADLINE_PHASE.REVEAL_READY
      : null,
    evaluatedAt: at,
    timestamps: ts,
  };
}

/**
 * Map deadline phase + action to allow/deny with typed codes.
 * @param {object} params
 * @returns {import('../contracts/lineupPolicy.js').LineupPolicyResult}
 */
export function assertDeadlineAllowsMutation({
  phase,
  action,
  allowsLateMutation = false,
  correctionUntil = null,
  evaluatedAt = null,
  isCorrection = false,
}) {
  const act = String(action || "").trim();

  if (isCorrection) {
    const correctionMs = parsePolicyTimeMs(correctionUntil);
    const evalMs = parsePolicyTimeMs(evaluatedAt);
    if (
      correctionMs != null &&
      evalMs != null &&
      evalMs > correctionMs
    ) {
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_CORRECTION_WINDOW_CLOSED,
        message: "Correction window has closed",
        details: { phase, action: act, correctionUntil, evaluatedAt },
      });
    }
    return createLineupPolicyResult({ ok: true, details: { phase, action: act } });
  }

  if (phase === LINEUP_DEADLINE_PHASE.NOT_OPEN) {
    return createLineupPolicyResult({
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_DEADLINE_NOT_OPEN,
      message: "Lineup window is not open yet",
      details: { phase, action: act },
    });
  }

  if (
    phase === LINEUP_DEADLINE_PHASE.LOCKED ||
    phase === LINEUP_DEADLINE_PHASE.REVEAL_READY
  ) {
    if (
      act === LINEUP_ACTION.SAVE_DRAFT ||
      act === LINEUP_ACTION.SUBMIT ||
      act === "create" ||
      act === "createLineup" ||
      act === "random_overwrite"
    ) {
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_ALREADY_LOCKED,
        message: "Ordinary mutation blocked at or after lockAt",
        details: { phase, action: act },
      });
    }
  }

  if (phase === LINEUP_DEADLINE_PHASE.CLOSED) {
    if (
      act === LINEUP_ACTION.SAVE_DRAFT ||
      act === LINEUP_ACTION.SUBMIT ||
      act === "create" ||
      act === "createLineup"
    ) {
      if (allowsLateMutation === true) {
        return createLineupPolicyResult({
          ok: true,
          details: { phase, action: act, late: true },
        });
      }
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_SUBMISSION_DEADLINE_PASSED,
        message: "Submission deadline has passed",
        details: { phase, action: act },
      });
    }
  }

  if (phase === LINEUP_DEADLINE_PHASE.GRACE_PERIOD) {
    if (
      act === LINEUP_ACTION.SAVE_DRAFT ||
      act === LINEUP_ACTION.SUBMIT ||
      act === "create" ||
      act === "createLineup"
    ) {
      if (allowsLateMutation === true) {
        return createLineupPolicyResult({
          ok: true,
          details: { phase, action: act, grace: true },
        });
      }
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_GRACE_PERIOD_EXPIRED,
        message: "Grace period does not permit this mutation under policy",
        details: { phase, action: act },
      });
    }
  }

  return createLineupPolicyResult({ ok: true, details: { phase, action: act } });
}

/**
 * CORE-06 Phase 1E — locked-state mutation guards + correction boundary.
 */

import { COMPETITION_LINEUP_STATUS } from "../../participants/enums/statuses.js";
import { createLineupPolicyResult } from "../contracts/lineupPolicy.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LINEUP_ACTION, LINEUP_IMMUTABLE_STATUSES } from "../services/transitions.js";

/** Ordinary mutations blocked once LOCKED/PUBLISHED (except explicit correction). */
export const LOCKED_BLOCKED_ACTIONS = Object.freeze([
  LINEUP_ACTION.SAVE_DRAFT,
  LINEUP_ACTION.SUBMIT,
  "create",
  "createLineup",
  "random_overwrite",
  "replace_participant",
  "reassign_slot",
  "roster_substitution",
  "visibility_regression",
]);

/**
 * @param {object} params
 * @param {object} params.lineup
 * @param {string} params.action
 * @param {boolean} [params.isCorrection]
 * @param {boolean} [params.correctionAuthorized]
 * @param {string|null} [params.correctionReason]
 * @returns {import('../contracts/lineupPolicy.js').LineupPolicyResult}
 */
export function assertLockedMutationAllowed({
  lineup,
  action,
  isCorrection = false,
  correctionAuthorized = false,
  correctionReason = null,
}) {
  const status = String(lineup?.status || "")
    .trim()
    .toUpperCase();
  const act = String(action || "").trim();

  const isImmutable =
    LINEUP_IMMUTABLE_STATUSES.has(status) ||
    status === COMPETITION_LINEUP_STATUS.LOCKED ||
    status === COMPETITION_LINEUP_STATUS.PUBLISHED;

  if (!isImmutable) {
    return createLineupPolicyResult({ ok: true, details: { status, action: act } });
  }

  if (act === LINEUP_ACTION.OVERRIDE || isCorrection) {
    if (correctionAuthorized !== true) {
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_MUTATION_NOT_ALLOWED,
        message: "Locked correction requires explicit policy authorization",
        details: { status, action: act },
      });
    }
    const reason =
      correctionReason != null ? String(correctionReason).trim() : "";
    if (!reason) {
      return createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_OVERRIDE_REASON_REQUIRED,
        message: "Correction requires an explicit reason",
        details: { status, action: act },
      });
    }
    return createLineupPolicyResult({
      ok: true,
      details: { status, action: act, correction: true },
    });
  }

  if (
    act === LINEUP_ACTION.PUBLISH ||
    act === LINEUP_ACTION.VOID ||
    act === "transition_visibility"
  ) {
    // Publish / void / visibility remain separate authorized workflows.
    return createLineupPolicyResult({ ok: true, details: { status, action: act } });
  }

  if (LOCKED_BLOCKED_ACTIONS.includes(act) || act === "random_overwrite") {
    return createLineupPolicyResult({
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_ALREADY_LOCKED,
      message: "Ordinary mutation blocked on locked lineup",
      details: { status, action: act },
    });
  }

  return createLineupPolicyResult({
    ok: false,
    code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_MUTATION_NOT_ALLOWED,
    message: "Mutation not allowed in locked state",
    details: { status, action: act },
  });
}

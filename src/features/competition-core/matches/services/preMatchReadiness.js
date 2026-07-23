/**
 * CORE-15 — pre-match readiness (pure).
 * Inspects lifecycle input facts and optional MatchPolicy.canStart only.
 * Does not schedule, assign court/referee, generate lineups, or call engines.
 */

import { MATCH_STATUS } from "../enums/matchStatuses.js";
import { createMatchPolicyResult, isMatchPolicy } from "../contracts/matchPolicy.js";
import { isNonEmptyString } from "../../participants/contracts/shared.js";

/**
 * @typedef {Object} MatchReadinessBlocker
 * @property {string} code
 * @property {string} message
 * @property {string|null} [field]
 */

/**
 * @typedef {Object} PreMatchReadinessResult
 * @property {boolean} readyToStart
 * @property {MatchReadinessBlocker[]} blockers
 * @property {string[]} requiredRefs
 * @property {import('../contracts/matchPolicy.js').MatchPolicyResult|null} policyResult
 */

/**
 * @param {import('../contracts/competitionMatch.js').CompetitionMatch|Record<string, unknown>|null|undefined} match
 * @param {{
 *   matchPolicy?: import('../contracts/matchPolicy.js').MatchPolicy|null,
 *   requireScheduledAt?: boolean,
 *   requireCourtAssignmentRef?: boolean,
 *   requireRefereeAssignmentRef?: boolean,
 *   requireLineupReferences?: boolean,
 *   now?: string|Date|null,
 * }} [options]
 * @returns {PreMatchReadinessResult}
 */
export function evaluatePreMatchReadiness(match, options = {}) {
  /** @type {MatchReadinessBlocker[]} */
  const blockers = [];
  /** @type {string[]} */
  const requiredRefs = [];

  if (!match || typeof match !== "object") {
    return {
      readyToStart: false,
      blockers: [
        {
          code: "MATCH_MISSING",
          message: "Match is required for readiness evaluation",
          field: null,
        },
      ],
      requiredRefs: [],
      policyResult: null,
    };
  }

  const status = String(match.status || "").trim().toUpperCase();
  const startable =
    status === MATCH_STATUS.READY_TO_START || status === MATCH_STATUS.SCHEDULED;

  if (!startable) {
    blockers.push({
      code: "STATUS_NOT_STARTABLE",
      message: `Status "${status || "UNKNOWN"}" is not startable`,
      field: "status",
    });
  }

  if (options.requireScheduledAt === true) {
    requiredRefs.push("scheduledAt");
    if (
      !(match.scheduledAt instanceof Date) &&
      !isNonEmptyString(match.scheduledAt)
    ) {
      blockers.push({
        code: "SCHEDULED_AT_MISSING",
        message: "scheduledAt is required",
        field: "scheduledAt",
      });
    }
  }

  if (options.requireCourtAssignmentRef === true) {
    requiredRefs.push("courtAssignmentRef");
    if (!isNonEmptyString(match.courtAssignmentRef)) {
      blockers.push({
        code: "COURT_ASSIGNMENT_REF_MISSING",
        message: "courtAssignmentRef is required",
        field: "courtAssignmentRef",
      });
    }
  }

  if (options.requireRefereeAssignmentRef === true) {
    requiredRefs.push("refereeAssignmentRef");
    if (!isNonEmptyString(match.refereeAssignmentRef)) {
      blockers.push({
        code: "REFEREE_ASSIGNMENT_REF_MISSING",
        message: "refereeAssignmentRef is required",
        field: "refereeAssignmentRef",
      });
    }
  }

  if (options.requireLineupReferences === true) {
    requiredRefs.push("lineupReference");
    const sides = Array.isArray(match.sides) ? match.sides : [];
    const missingLineup = sides.some(
      (side) => side && !isNonEmptyString(side.lineupReference)
    );
    if (sides.length === 0 || missingLineup) {
      blockers.push({
        code: "LINEUP_REFERENCE_MISSING",
        message: "lineup references are required on sides",
        field: "sides.lineupReference",
      });
    }
  }

  /** @type {import('../contracts/matchPolicy.js').MatchPolicyResult|null} */
  let policyResult = null;
  if (isMatchPolicy(options.matchPolicy) && typeof options.matchPolicy.canStart === "function") {
    const raw = options.matchPolicy.canStart({
      match: /** @type {import('../contracts/competitionMatch.js').CompetitionMatch} */ (match),
      action: "start",
      now: options.now ?? null,
      extras: {},
    });
    policyResult =
      raw && typeof raw.then !== "function"
        ? createMatchPolicyResult(raw)
        : createMatchPolicyResult({
            ok: false,
            code: "POLICY_ASYNC_UNSUPPORTED",
            message: "Async MatchPolicy.canStart is not supported in pure readiness",
          });
    if (policyResult.ok !== true) {
      blockers.push({
        code: policyResult.code || "POLICY_CAN_START_DENIED",
        message: policyResult.message || "MatchPolicy.canStart denied start",
        field: "policy",
      });
    }
  }

  return {
    readyToStart: blockers.length === 0,
    blockers,
    requiredRefs,
    policyResult,
  };
}

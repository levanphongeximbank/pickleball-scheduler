/**
 * CORE-15 — scoring eligibility for CORE-16 (pure).
 * scoringAllowed === true only when lifecycle status is IN_PROGRESS.
 * Does not implement point/game/set/match scoring.
 */

import { MATCH_STATUS, isMatchStatus } from "../enums/matchStatuses.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";

/**
 * @typedef {Object} ScoringEligibilityResult
 * @property {boolean} scoringAllowed
 * @property {string|null} matchStatus
 * @property {string|null} reasonCode
 * @property {{ code: string, message: string, details?: Record<string, unknown> }|null} error
 */

/**
 * @param {unknown} matchOrStatus
 * @returns {string|null}
 */
function resolveStatus(matchOrStatus) {
  if (typeof matchOrStatus === "string") {
    return String(matchOrStatus).trim().toUpperCase() || null;
  }
  if (matchOrStatus && typeof matchOrStatus === "object") {
    const status = /** @type {{ status?: unknown }} */ (matchOrStatus).status;
    if (status == null || status === "") return null;
    return String(status).trim().toUpperCase();
  }
  return null;
}

/**
 * @param {unknown} matchOrStatus CompetitionMatch or status string
 * @returns {ScoringEligibilityResult}
 */
export function evaluateScoringEligibility(matchOrStatus) {
  const matchStatus = resolveStatus(matchOrStatus);

  if (!matchStatus) {
    return {
      scoringAllowed: false,
      matchStatus: null,
      reasonCode: MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      error: {
        code: MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
        message: "Match status is required for scoring eligibility",
        details: {},
      },
    };
  }

  if (!isMatchStatus(matchStatus)) {
    return {
      scoringAllowed: false,
      matchStatus,
      reasonCode: MATCH_RUNTIME_ERROR_CODE.MATCH_UNSUPPORTED_STATUS,
      error: {
        code: MATCH_RUNTIME_ERROR_CODE.MATCH_UNSUPPORTED_STATUS,
        message: "Unknown or unsupported lifecycle status",
        details: { matchStatus },
      },
    };
  }

  if (matchStatus === MATCH_STATUS.IN_PROGRESS) {
    return {
      scoringAllowed: true,
      matchStatus,
      reasonCode: null,
      error: null,
    };
  }

  const preStart = new Set([
    MATCH_STATUS.DRAFT,
    MATCH_STATUS.READY,
    MATCH_STATUS.SCHEDULED,
    MATCH_STATUS.LINEUPS_PENDING,
    MATCH_STATUS.READY_TO_START,
    MATCH_STATUS.POSTPONED,
  ]);

  const reasonCode = preStart.has(matchStatus)
    ? MATCH_RUNTIME_ERROR_CODE.MATCH_NOT_READY
    : MATCH_RUNTIME_ERROR_CODE.MATCH_SCORING_NOT_ALLOWED;

  const message =
    reasonCode === MATCH_RUNTIME_ERROR_CODE.MATCH_NOT_READY
      ? "Scoring is not allowed before the match is in progress"
      : `Scoring is not allowed when match status is ${matchStatus}`;

  return {
    scoringAllowed: false,
    matchStatus,
    reasonCode,
    error: {
      code: reasonCode,
      message,
      details: { matchStatus },
    },
  };
}

/**
 * @param {unknown} matchOrStatus
 * @returns {{ ok: true, matchStatus: string }}
 */
export function assertScoringAllowed(matchOrStatus) {
  const result = evaluateScoringEligibility(matchOrStatus);
  if (result.scoringAllowed === true && result.matchStatus) {
    return { ok: true, matchStatus: result.matchStatus };
  }
  throw new MatchRuntimeError(
    result.reasonCode || MATCH_RUNTIME_ERROR_CODE.MATCH_SCORING_NOT_ALLOWED,
    result.error?.message || "Scoring is not allowed",
    result.error?.details || { matchStatus: result.matchStatus }
  );
}

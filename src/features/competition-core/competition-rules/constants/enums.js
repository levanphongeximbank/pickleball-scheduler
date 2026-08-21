/**
 * Canonical Competition Rules & Format — shared enums.
 * Aligns with CORE-16 scoring systems and CORE-18 tie-break types where possible.
 */

import { SCORING_SYSTEM } from "../../scoring/enums/scoringSystems.js";
import { TIEBREAK_TYPE } from "../../standings/standingsConstants.js";

export const COMPETITION_UNIT_KIND = Object.freeze({
  SINGLES: "SINGLES",
  DOUBLES: "DOUBLES",
  TEAM: "TEAM",
});

export const REGISTRATION_UNIT_KIND = Object.freeze({
  PLAYER: "PLAYER",
  PAIR: "PAIR",
  TEAM: "TEAM",
});

/** Re-export CORE-16 scoring systems as shared scoringMethod vocabulary. */
export const SCORING_METHOD = Object.freeze({
  RALLY: SCORING_SYSTEM.RALLY,
  SIDE_OUT: SCORING_SYSTEM.SIDE_OUT,
});

export const MATCH_SERIES = Object.freeze({
  BEST_OF_1: "BEST_OF_1",
  BEST_OF_3: "BEST_OF_3",
  BEST_OF_5: "BEST_OF_5",
});

export const GROUP_SIZING_POLICY = Object.freeze({
  FIXED_GROUP_COUNT: "FIXED_GROUP_COUNT",
  TARGET_GROUP_SIZE: "TARGET_GROUP_SIZE",
});

export const ROUND_ROBIN_POLICY = Object.freeze({
  SINGLE: "SINGLE",
  DOUBLE: "DOUBLE",
});

export const KNOCKOUT_ENTRY_ROUND = Object.freeze({
  FINAL: "FINAL",
  SEMIFINAL: "SEMIFINAL",
  QUARTERFINAL: "QUARTERFINAL",
  ROUND_OF_16: "ROUND_OF_16",
  ROUND_OF_32: "ROUND_OF_32",
});

export const KNOCKOUT_PAIRING_POLICY = Object.freeze({
  CROSS_GROUP: "CROSS_GROUP",
  SEEDED: "SEEDED",
  RANDOM: "RANDOM",
});

/**
 * In-group tie-break criteria (policy labels).
 * Mapped to CORE-18 TIEBREAK_TYPE for execution composition.
 */
export const IN_GROUP_TIEBREAK_CRITERION = Object.freeze({
  MATCH_WINS: "MATCH_WINS",
  HEAD_TO_HEAD: "HEAD_TO_HEAD",
  POINT_DIFFERENTIAL: "POINT_DIFFERENTIAL",
  POINTS_SCORED: "POINTS_SCORED",
  DRAW_LOTS: "DRAW_LOTS",
  /** CORE-18 compatible aliases preserved for composition */
  TOTAL_POINTS: TIEBREAK_TYPE.TOTAL_POINTS,
  MINI_TABLE: TIEBREAK_TYPE.MINI_TABLE,
});

export const CROSS_GROUP_RANKING_CRITERION = Object.freeze({
  WIN_PERCENTAGE: "WIN_PERCENTAGE",
  POINT_DIFFERENTIAL_PER_MATCH: "POINT_DIFFERENTIAL_PER_MATCH",
  POINTS_SCORED_PER_MATCH: "POINTS_SCORED_PER_MATCH",
  DRAW_LOTS: "DRAW_LOTS",
});

export const WITHDRAWAL_HANDLING = Object.freeze({
  KEEP_COMPLETED_RESULTS: "KEEP_COMPLETED_RESULTS",
  VOID_ALL_RESULTS: "VOID_ALL_RESULTS",
  KEEP_COMPLETED_AND_WO_REMAINING: "KEEP_COMPLETED_AND_WO_REMAINING",
});

export const NO_CHECK_IN_POLICY = Object.freeze({
  WARN: "WARN",
  BLOCK_START: "BLOCK_START",
  DIRECTOR_REVIEW: "DIRECTOR_REVIEW",
});

export const REFEREE_REQUIREMENT = Object.freeze({
  OPTIONAL: "OPTIONAL",
  REQUIRED: "REQUIRED",
});

export const REFEREE_FALLBACK_POLICY = Object.freeze({
  PLAYER_SELF_SCORE: "PLAYER_SELF_SCORE",
  BLOCK_START: "BLOCK_START",
  DIRECTOR_DECISION: "DIRECTOR_DECISION",
});

export const PUBLICATION_POLICY = Object.freeze({
  IMMEDIATE: "IMMEDIATE",
  DIRECTOR_APPROVAL: "DIRECTOR_APPROVAL",
  AFTER_STAGE_COMPLETE: "AFTER_STAGE_COMPLETE",
  AFTER_ACCEPTED_RESULT: "AFTER_ACCEPTED_RESULT",
  PRIVATE: "PRIVATE",
  PUBLIC: "PUBLIC",
});

export const RULE_CLASS = Object.freeze({
  COMPETITION_UNIT: "COMPETITION_UNIT",
  ELIGIBILITY: "ELIGIBILITY",
  GROUP_FORMAT: "GROUP_FORMAT",
  GROUP_ALLOCATION: "GROUP_ALLOCATION",
  SCORING_FORMAT: "SCORING_FORMAT",
  QUALIFICATION: "QUALIFICATION",
  WILDCARD: "WILDCARD",
  TIEBREAK: "TIEBREAK",
  KNOCKOUT: "KNOCKOUT",
  CHANGE_END: "CHANGE_END",
  WALKOVER: "WALKOVER",
  CHECK_IN: "CHECK_IN",
  SCHEDULE: "SCHEDULE",
  COURT: "COURT",
  REFEREE: "REFEREE",
  PUBLICATION: "PUBLICATION",
});

/**
 * Map policy matchSeries → CORE-16 bestOfGames.
 * @param {string} matchSeries
 * @returns {number|null}
 */
export function matchSeriesToBestOfGames(matchSeries) {
  switch (matchSeries) {
    case MATCH_SERIES.BEST_OF_1:
      return 1;
    case MATCH_SERIES.BEST_OF_3:
      return 3;
    case MATCH_SERIES.BEST_OF_5:
      return 5;
    default:
      return null;
  }
}

/**
 * Map CORE-16 bestOfGames → policy matchSeries.
 * @param {number} bestOfGames
 * @returns {string|null}
 */
export function bestOfGamesToMatchSeries(bestOfGames) {
  const n = Number(bestOfGames);
  if (n === 1) return MATCH_SERIES.BEST_OF_1;
  if (n === 3) return MATCH_SERIES.BEST_OF_3;
  if (n === 5) return MATCH_SERIES.BEST_OF_5;
  return null;
}

/**
 * Map in-group policy criterion → CORE-18 execution type when known.
 * @param {string} criterion
 * @returns {string|null}
 */
export function mapInGroupCriterionToCore18(criterion) {
  switch (criterion) {
    case IN_GROUP_TIEBREAK_CRITERION.MATCH_WINS:
    case IN_GROUP_TIEBREAK_CRITERION.TOTAL_POINTS:
      return TIEBREAK_TYPE.TOTAL_POINTS;
    case IN_GROUP_TIEBREAK_CRITERION.HEAD_TO_HEAD:
      return TIEBREAK_TYPE.HEAD_TO_HEAD;
    case IN_GROUP_TIEBREAK_CRITERION.POINT_DIFFERENTIAL:
      return TIEBREAK_TYPE.POINT_DIFFERENCE;
    case IN_GROUP_TIEBREAK_CRITERION.POINTS_SCORED:
      return TIEBREAK_TYPE.SCORE_FOR;
    case IN_GROUP_TIEBREAK_CRITERION.DRAW_LOTS:
      return TIEBREAK_TYPE.DRAW_LOT;
    case IN_GROUP_TIEBREAK_CRITERION.MINI_TABLE:
      return TIEBREAK_TYPE.MINI_TABLE;
    default:
      return null;
  }
}

/**
 * Derive knockout entry round from qualifier count.
 * @param {number} qualifierCount
 * @returns {string|null}
 */
export function deriveKnockoutEntryRound(qualifierCount) {
  const n = Number(qualifierCount);
  if (n === 2) return KNOCKOUT_ENTRY_ROUND.FINAL;
  if (n === 4) return KNOCKOUT_ENTRY_ROUND.SEMIFINAL;
  if (n === 8) return KNOCKOUT_ENTRY_ROUND.QUARTERFINAL;
  if (n === 16) return KNOCKOUT_ENTRY_ROUND.ROUND_OF_16;
  if (n === 32) return KNOCKOUT_ENTRY_ROUND.ROUND_OF_32;
  return null;
}

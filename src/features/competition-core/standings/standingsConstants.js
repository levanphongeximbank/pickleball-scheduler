export const STANDINGS_ENGINE_VERSION = "cc08-v1";

export const DEFAULT_SCORING_RULE_ID = "legacy-group-default";
export const DEFAULT_SCORING_RULE_VERSION = "1";
export const DEFAULT_TIEBREAK_RULE_SET_ID = "legacy-default-tiebreak";
export const DEFAULT_TIEBREAK_RULE_SET_VERSION = "1";

/** @typedef {import('./standingsTypes.js').MatchResultTypeValue} MatchResultTypeValue */
/** @typedef {import('./standingsTypes.js').TieBreakTypeValue} TieBreakTypeValue */

export const MATCH_RESULT_TYPE = Object.freeze({
  COMPLETED: "COMPLETED",
  BYE: "BYE",
  WALKOVER: "WALKOVER",
  FORFEIT_BEFORE_START: "FORFEIT_BEFORE_START",
  FORFEIT_AFTER_START: "FORFEIT_AFTER_START",
  ADMINISTRATIVE_FORFEIT: "ADMINISTRATIVE_FORFEIT",
  CANCELLED: "CANCELLED",
  VOID: "VOID",
  UNVERIFIED: "UNVERIFIED",
  LEGACY_FORFEIT: "LEGACY_FORFEIT",
});

export const TIEBREAK_TYPE = Object.freeze({
  TOTAL_POINTS: "TOTAL_POINTS",
  HEAD_TO_HEAD: "HEAD_TO_HEAD",
  MINI_TABLE: "MINI_TABLE",
  SET_DIFFERENCE: "SET_DIFFERENCE",
  GAME_DIFFERENCE: "GAME_DIFFERENCE",
  POINT_DIFFERENCE: "POINT_DIFFERENCE",
  SCORE_FOR: "SCORE_FOR",
  FEWER_FORFEITS: "FEWER_FORFEITS",
  ORIGINAL_SEED: "ORIGINAL_SEED",
  DRAW_LOT: "DRAW_LOT",
  CUSTOM: "CUSTOM",
});

export const QUALIFICATION_STATUS = Object.freeze({
  QUALIFIED: "QUALIFIED",
  ELIMINATED: "ELIMINATED",
  PENDING: "PENDING",
  TIE_BREAK_REQUIRED: "TIE_BREAK_REQUIRED",
});

export const STANDINGS_SCOPE = Object.freeze({
  INDIVIDUAL_GROUP: "individual_group",
  TEAM_TOURNAMENT: "team_tournament",
  SEASON_LEAGUE: "season_league",
});

export const DEFAULT_SCORING_RULE = Object.freeze({
  scoringRuleId: DEFAULT_SCORING_RULE_ID,
  scoringRuleVersion: DEFAULT_SCORING_RULE_VERSION,
  winPoints: 2,
  lossPoints: 1,
  drawPoints: 1,
  forfeitPoints: 0,
  walkoverPoints: 2,
  byePoints: 0,
  completedMatchRequired: true,
  verifiedResultRequired: false,
});

export const DEFAULT_TIEBREAK_ORDER = Object.freeze([
  TIEBREAK_TYPE.TOTAL_POINTS,
  TIEBREAK_TYPE.HEAD_TO_HEAD,
  TIEBREAK_TYPE.MINI_TABLE,
  TIEBREAK_TYPE.GAME_DIFFERENCE,
  TIEBREAK_TYPE.POINT_DIFFERENCE,
  TIEBREAK_TYPE.SCORE_FOR,
  TIEBREAK_TYPE.FEWER_FORFEITS,
  TIEBREAK_TYPE.ORIGINAL_SEED,
  TIEBREAK_TYPE.DRAW_LOT,
]);

export const LEGACY_GROUP_TIEBREAK_ORDER = Object.freeze([
  TIEBREAK_TYPE.TOTAL_POINTS,
  TIEBREAK_TYPE.POINT_DIFFERENCE,
  TIEBREAK_TYPE.SCORE_FOR,
  TIEBREAK_TYPE.CUSTOM,
]);

export const LEGACY_TEAM_TIEBREAK_ORDER = Object.freeze([
  TIEBREAK_TYPE.CUSTOM,
  TIEBREAK_TYPE.CUSTOM,
  TIEBREAK_TYPE.SCORE_FOR,
  TIEBREAK_TYPE.CUSTOM,
]);

/**
 * @param {string} value
 * @returns {value is MatchResultTypeValue}
 */
export function isMatchResultType(value) {
  return Object.values(MATCH_RESULT_TYPE).includes(value);
}

/**
 * @param {string} value
 * @returns {value is TieBreakTypeValue}
 */
export function isTieBreakType(value) {
  return Object.values(TIEBREAK_TYPE).includes(value);
}

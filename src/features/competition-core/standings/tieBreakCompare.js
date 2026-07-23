import { TIEBREAK_TYPE } from "./standingsConstants.js";
import { compareHeadToHeadRows } from "./headToHead.js";
import { orderRowsByDrawLot } from "./drawLot.js";
import { compareCanonicalIdentity } from "./canonicalResultAdapter.js";
import {
  STANDINGS_ERROR_CODE,
  createStandingsIssue,
} from "./standingsErrors.js";

/**
 * @param {import('./standingsTypes.js').StandingsRow} left
 * @param {import('./standingsTypes.js').StandingsRow} right
 * @param {import('./standingsTypes.js').TieBreakRule} rule
 * @param {import('./standingsTypes.js').StandingsMatchRecord[]} matches
 * @param {Partial<import('./standingsTypes.js').StandingsConfiguration>} configuration
 * @returns {number}
 */
export function compareRowsByTieBreakRule(left, right, rule, matches = [], configuration = {}) {
  switch (rule.type) {
    case TIEBREAK_TYPE.TOTAL_POINTS:
    case TIEBREAK_TYPE.CUSTOM:
      if (rule.legacyKey === "wins") {
        return right.wins - left.wins;
      }
      if (rule.legacyKey === "subMatchDiff") {
        return Number(right.gameDifference ?? 0) - Number(left.gameDifference ?? 0);
      }
      if (rule.legacyKey === "manual") {
        return compareCanonicalIdentity(left.entryId, right.entryId);
      }
      return right.points - left.points;
    case TIEBREAK_TYPE.POINT_DIFFERENCE:
      return Number(right.scoreDifference ?? 0) - Number(left.scoreDifference ?? 0);
    case TIEBREAK_TYPE.GAME_DIFFERENCE:
      return Number(right.gameDifference ?? 0) - Number(left.gameDifference ?? 0);
    case TIEBREAK_TYPE.SET_DIFFERENCE:
      return Number(right.setDifference ?? 0) - Number(left.setDifference ?? 0);
    case TIEBREAK_TYPE.SCORE_FOR:
      return Number(right.scoreFor ?? 0) - Number(left.scoreFor ?? 0);
    case TIEBREAK_TYPE.FEWER_FORFEITS:
      return left.forfeits - right.forfeits;
    case TIEBREAK_TYPE.ORIGINAL_SEED:
      return Number(left.seed ?? 9999) - Number(right.seed ?? 9999);
    case TIEBREAK_TYPE.HEAD_TO_HEAD:
      return compareHeadToHeadRows(left, right, matches, configuration.scoringRule || {});
    case TIEBREAK_TYPE.DRAW_LOT: {
      const seed = configuration.drawLotSeed;
      if (seed == null || String(seed).trim() === "") {
        // Invalid draw-lot config: do not invent a seed; leave unresolved (0).
        return 0;
      }
      const [first] = orderRowsByDrawLot([left, right], String(seed));
      return first.entryId === left.entryId ? -1 : 1;
    }
    default:
      return 0;
  }
}

/**
 * @param {string} type
 * @returns {ReturnType<typeof createStandingsIssue>|null}
 */
export function unsupportedTieBreakIssue(type) {
  if (Object.values(TIEBREAK_TYPE).includes(type)) {
    return null;
  }
  return createStandingsIssue(
    STANDINGS_ERROR_CODE.STANDINGS_UNSUPPORTED_TIEBREAK_CRITERION,
    `Unsupported tie-break criterion: ${type}`,
    { type }
  );
}

import { TIEBREAK_TYPE } from "./standingsConstants.js";
import { compareHeadToHeadRows } from "./headToHead.js";
import { orderRowsByDrawLot } from "./drawLot.js";

/**
 * @param {import('./standingsTypes.js').StandingsRow} left
 * @param {import('./standingsTypes.js').StandingsRow} right
 * @param {import('./standingsTypes.js').TieBreakRule} rule
 * @param {import('./standingsTypes.js').StandingsMatchRecord[]} matches
 * @param {Partial<import('./standingsTypes.js').StandingsConfiguration>} configuration
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
        return String(left.entryId).localeCompare(String(right.entryId));
      }
      return right.points - left.points;
    case TIEBREAK_TYPE.POINT_DIFFERENCE:
    case TIEBREAK_TYPE.GAME_DIFFERENCE:
      return right.scoreDifference - left.scoreDifference;
    case TIEBREAK_TYPE.SET_DIFFERENCE:
      return right.setDifference - left.setDifference;
    case TIEBREAK_TYPE.SCORE_FOR:
      return right.scoreFor - left.scoreFor;
    case TIEBREAK_TYPE.FEWER_FORFEITS:
      return left.forfeits - right.forfeits;
    case TIEBREAK_TYPE.ORIGINAL_SEED:
      return Number(left.seed ?? 9999) - Number(right.seed ?? 9999);
    case TIEBREAK_TYPE.HEAD_TO_HEAD:
      return compareHeadToHeadRows(left, right, matches, configuration.scoringRule || {});
    case TIEBREAK_TYPE.DRAW_LOT: {
      const seed = configuration.drawLotSeed || "cc08-default-seed";
      const [first] = orderRowsByDrawLot([left, right], seed);
      return first.entryId === left.entryId ? -1 : 1;
    }
    default:
      return 0;
  }
}

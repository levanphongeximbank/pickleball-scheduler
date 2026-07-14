import { PRIVATE_PAIRING_CONSTRAINT_TYPE } from "../constants/constraintTypes.js";
import { RELATION_MODE } from "../constants/enums.js";
import {
  areOpponents,
  normalizeTeamsToIdMatrix,
  playerIdOf,
  shareTeam,
} from "./evaluateHardOnCandidate.js";

/**
 * @param {number|null|undefined} weight
 * @returns {number}
 */
function weightOf(weight) {
  const value = Number(weight);
  if (!Number.isFinite(value)) {
    return 50;
  }
  return Math.min(100, Math.max(1, value));
}

/**
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} rule
 * @param {(targetId: string) => boolean} predicate
 */
function anyOrAll(rule, predicate) {
  const targets = (rule.targetPlayerIds || []).map(String);
  if (!targets.length) {
    return false;
  }
  if (rule.relationMode === RELATION_MODE.ALL_OF) {
    return targets.every((target) => predicate(target));
  }
  return targets.some((target) => predicate(target));
}

/**
 * Soft scoring — never decides feasibility.
 *
 * @param {Object} candidate
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule[]} softRules
 * @param {Object} [history]
 * @param {Record<string, Record<string, number>>} [history.partnerRepeatCounts]
 * @param {Record<string, Record<string, number>>} [history.opponentRepeatCounts]
 * @returns {{
 *   constraintScore: number,
 *   softConstraintsSatisfied: Array<{ ruleId: string, constraintType: string }>,
 *   softConstraintsMissed: Array<{ ruleId: string, constraintType: string }>,
 * }}
 */
export function scoreSoftPrivatePairingRules(candidate, softRules = [], history = {}) {
  const teams =
    candidate.teamsIdMatrix ||
    normalizeTeamsToIdMatrix(
      candidate.teams || [
        { members: candidate.matchOption?.teamA || [] },
        { members: candidate.matchOption?.teamB || [] },
      ]
    );
  const matchOption = candidate.matchOption || null;
  const partnerRepeats = history.partnerRepeatCounts || {};
  const opponentRepeats = history.opponentRepeatCounts || {};

  let constraintScore = 0;
  /** @type {Array<{ ruleId: string, constraintType: string }>} */
  const softConstraintsSatisfied = [];
  /** @type {Array<{ ruleId: string, constraintType: string }>} */
  const softConstraintsMissed = [];

  softRules.forEach((rule) => {
    const primary = String(rule.primaryPlayerId || "");
    if (!primary) {
      return;
    }
    const w = weightOf(rule.weight);
    let satisfied = false;
    let applicable = true;

    switch (rule.constraintType) {
      case PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER: {
        satisfied = anyOrAll(rule, (target) => shareTeam(primary, target, teams));
        constraintScore += satisfied ? w : -Math.round(w * 0.35);
        break;
      }
      case PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER: {
        const violated = anyOrAll(rule, (target) => shareTeam(primary, target, teams));
        satisfied = !violated;
        constraintScore += violated ? -w : Math.round(w * 0.25);
        break;
      }
      case PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT: {
        if (!matchOption) {
          applicable = false;
          break;
        }
        satisfied = anyOrAll(rule, (target) => areOpponents(primary, target, matchOption));
        constraintScore += satisfied ? w : -Math.round(w * 0.35);
        break;
      }
      case PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT: {
        if (!matchOption) {
          applicable = false;
          break;
        }
        const violated = anyOrAll(rule, (target) => areOpponents(primary, target, matchOption));
        satisfied = !violated;
        constraintScore += violated ? -w : Math.round(w * 0.25);
        break;
      }
      case PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT: {
        const limit = Number(rule.metadata?.maxCount ?? 1);
        let exceeded = false;
        (rule.targetPlayerIds || []).forEach((target) => {
          const count =
            partnerRepeats[primary]?.[String(target)] ??
            partnerRepeats[String(target)]?.[primary] ??
            0;
          if (count > limit) {
            exceeded = true;
          }
        });
        satisfied = !exceeded;
        constraintScore += exceeded ? -w : Math.round(w * 0.2);
        break;
      }
      case PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT: {
        const limit = Number(rule.metadata?.maxCount ?? 1);
        let exceeded = false;
        (rule.targetPlayerIds || []).forEach((target) => {
          const count =
            opponentRepeats[primary]?.[String(target)] ??
            opponentRepeats[String(target)]?.[primary] ??
            0;
          if (count > limit) {
            exceeded = true;
          }
        });
        satisfied = !exceeded;
        constraintScore += exceeded ? -w : Math.round(w * 0.2);
        break;
      }
      default:
        applicable = false;
        break;
    }

    if (!applicable) {
      return;
    }
    const entry = { ruleId: rule.id, constraintType: rule.constraintType };
    if (satisfied) {
      softConstraintsSatisfied.push(entry);
    } else {
      softConstraintsMissed.push(entry);
    }
  });

  return { constraintScore, softConstraintsSatisfied, softConstraintsMissed };
}

/**
 * Balance / fairness / history helpers for ranking explanation.
 */
export function computeBalanceScore(teams, playersById = {}) {
  const totals = (teams || []).map((team) =>
    (team.members || team.playerIds || []).reduce((sum, player) => {
      const id = playerIdOf(player);
      const snapshot = playersById[id] || (typeof player === "object" ? player : {});
      return sum + Number(snapshot.rating ?? snapshot.level ?? snapshot.skillLevel ?? 3.5);
    }, 0)
  );
  if (totals.length < 2) {
    return 100;
  }
  const max = Math.max(...totals);
  const min = Math.min(...totals);
  const diff = max - min;
  return Math.max(0, Math.round(100 - diff * 40));
}

export function computeFairnessScore(teams) {
  const sizes = (teams || []).map(
    (team) => (team.members || team.playerIds || []).length
  );
  if (!sizes.length) {
    return 100;
  }
  const max = Math.max(...sizes);
  const min = Math.min(...sizes);
  return max === min ? 100 : Math.max(0, 100 - (max - min) * 50);
}

export function computeHistoryScore(softResult) {
  // History contribution is folded into constraintScore for repeat rules;
  // expose a non-negative summary for explanation.
  const missed = softResult.softConstraintsMissed.filter((item) =>
    String(item.constraintType).includes("repeat")
  ).length;
  const hit = softResult.softConstraintsSatisfied.filter((item) =>
    String(item.constraintType).includes("repeat")
  ).length;
  return Math.max(0, 50 + hit * 10 - missed * 15);
}

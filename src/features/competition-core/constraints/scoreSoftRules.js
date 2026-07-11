import { COMPETITION_CONSTRAINT_TYPE } from "../constants/constraintType.js";
import { CONSTRAINT_SEVERITY } from "../constants/constraintSeverity.js";
import { createEngineExplanation } from "../contracts/engineContracts.js";
import { createEngineScoreBreakdown } from "../contracts/engineContracts.js";
import { RULE_ERROR_CODE, RULE_SOFT_SCORE } from "./ruleConstants.js";
import {
  getPartnerParams,
  shareGroup,
  shareTeam,
} from "./evaluateHardRules.js";

/**
 * @typedef {import('./evaluateHardRules.js').RuleEvaluationContext} RuleEvaluationContext
 * @typedef {import('../types/index.js').ConstraintDefinition} ConstraintDefinition
 * @typedef {import('../types/index.js').EngineScoreBreakdown} EngineScoreBreakdown
 */

/**
 * @typedef {Object} SoftRuleEvaluationResult
 * @property {number} total
 * @property {EngineScoreBreakdown} breakdown
 * @property {import('../types/index.js').EngineExplanation[]} notes
 */

function findOpposingTeamIndex(playerId, teams) {
  const teamIndex = findTeamIndexForPlayer(teams, playerId);
  if (teamIndex < 0) {
    return -1;
  }
  return teams.findIndex((_, index) => index !== teamIndex);
}

function findTeamIndexForPlayer(teams, playerId) {
  return teams.findIndex((team) => team.map(String).includes(String(playerId)));
}

function getRepeatCount(store, playerA, playerB) {
  const a = String(playerA);
  const b = String(playerB);
  return Number(store?.[a]?.[b] ?? store?.[b]?.[a] ?? 0);
}

function parseTime(value) {
  if (!value) {
    return null;
  }
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
}

/**
 * Score soft constraints only — never rejects candidates.
 *
 * @param {ConstraintDefinition[]} constraints
 * @param {RuleEvaluationContext} context
 * @returns {SoftRuleEvaluationResult}
 */
export function scoreSoftRules(constraints = [], context) {
  const active = (constraints || []).filter(
    (item) => item?.enabled !== false && item.severity === CONSTRAINT_SEVERITY.SOFT
  );

  const teams =
    context.teams ||
    (context.matchOption
      ? [context.matchOption.teamA || [], context.matchOption.teamB || []]
      : []);
  const groups = context.groups || [];
  const playersById = context.playersById || {};

  /** @type {Record<string, number>} */
  const components = {};
  /** @type {import('../types/index.js').EngineExplanation[]} */
  const notes = [];
  let total = 0;

  active.forEach((constraint) => {
    const key = constraint.id || constraint.type;

    if (
      constraint.type === COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER ||
      constraint.type === COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER
    ) {
      const { anchor, targets } = getPartnerParams(constraint);
      if (!anchor || !targets.length) {
        return;
      }

      let delta = 0;
      targets.forEach((target) => {
        const sameTeam = shareTeam(anchor, target, teams);
        if (constraint.type === COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER) {
          if (sameTeam) {
            delta += RULE_SOFT_SCORE.preferPartnerMatchBonus;
          } else {
            delta -= RULE_SOFT_SCORE.preferPartnerMissPenalty;
            notes.push(
              createEngineExplanation({
                code: RULE_ERROR_CODE.PREFER_PARTNER_MISSED,
                message: `${anchor} preferred partner ${target} not matched.`,
                details: { constraintId: constraint.id },
              })
            );
          }
        } else if (sameTeam) {
          delta -= RULE_SOFT_SCORE.avoidPartnerViolationPenalty;
          notes.push(
            createEngineExplanation({
              code: RULE_ERROR_CODE.AVOID_PARTNER_VIOLATED,
              message: `${anchor} should avoid partner ${target}.`,
              details: { constraintId: constraint.id, soft: true },
            })
          );
        }
      });

      components[key] = (components[key] || 0) + delta;
      total += delta;
      return;
    }

    if (constraint.type === COMPETITION_CONSTRAINT_TYPE.SAME_CLUB_SEPARATION && groups.length) {
      let penalty = 0;
      groups.forEach((group) => {
        const ids = (group.playerIds || []).map(String);
        const clubs = new Map();
        ids.forEach((playerId) => {
          const clubId = String(getPlayerSnapshot(playersById, playerId).clubId || "").trim();
          if (!clubId) {
            return;
          }
          clubs.set(clubId, (clubs.get(clubId) || 0) + 1);
        });
        clubs.forEach((count) => {
          if (count > 1) {
            penalty -= RULE_SOFT_SCORE.sameClubSeparationPenalty * (count - 1);
          }
        });
      });
      components[key] = penalty;
      total += penalty;
      return;
    }

    if (
      constraint.type === COMPETITION_CONSTRAINT_TYPE.SAME_ORGANIZATION_SEPARATION &&
      groups.length
    ) {
      let penalty = 0;
      groups.forEach((group) => {
        const ids = (group.playerIds || []).map(String);
        const orgs = new Map();
        ids.forEach((playerId) => {
          const orgId = String(
            getPlayerSnapshot(playersById, playerId).organizationId || ""
          ).trim();
          if (!orgId) {
            return;
          }
          orgs.set(orgId, (orgs.get(orgId) || 0) + 1);
        });
        orgs.forEach((count) => {
          if (count > 1) {
            penalty -= RULE_SOFT_SCORE.sameOrganizationSeparationPenalty * (count - 1);
          }
        });
      });
      components[key] = penalty;
      total += penalty;
      return;
    }

    if (constraint.type === COMPETITION_CONSTRAINT_TYPE.SKILL_CAP) {
      const maxDiff = Number(constraint.params?.maxDiff ?? 0.5);
      if (teams.length >= 2) {
        const totalA = teams[0].reduce(
          (sum, id) => sum + Number(getPlayerSnapshot(playersById, id).skillLevel ?? 0),
          0
        );
        const totalB = teams[1].reduce(
          (sum, id) => sum + Number(getPlayerSnapshot(playersById, id).skillLevel ?? 0),
          0
        );
        const diff = Math.abs(totalA - totalB);
        if (diff > maxDiff) {
          const over = diff - maxDiff;
          const penalty =
            -1 * Math.ceil(over / 0.1) * RULE_SOFT_SCORE.skillCapOverPenaltyPerStep;
          components[key] = penalty;
          total += penalty;
        }
      }
      return;
    }

    if (constraint.type === COMPETITION_CONSTRAINT_TYPE.TEAM_SKILL_DIFFERENCE && teams.length >= 2) {
      const maxDiff = Number(constraint.params?.maxDiff ?? 0.5);
      const totalA = teams[0].reduce(
        (sum, id) => sum + Number(getPlayerSnapshot(playersById, id).skillLevel ?? 0),
        0
      );
      const totalB = teams[1].reduce(
        (sum, id) => sum + Number(getPlayerSnapshot(playersById, id).skillLevel ?? 0),
        0
      );
      const diff = Math.abs(totalA - totalB);
      if (diff > maxDiff) {
        const over = diff - maxDiff;
        const penalty =
          -1 * Math.ceil(over / 0.1) * RULE_SOFT_SCORE.teamSkillDiffPenaltyPerStep;
        components[key] = penalty;
        total += penalty;
      }
      return;
    }

    if (constraint.type === COMPETITION_CONSTRAINT_TYPE.AVOID_OPPONENT && teams.length >= 2) {
      const { anchor, targets } = getPartnerParams(constraint);
      if (!anchor || !targets.length) {
        return;
      }
      let penalty = 0;
      targets.forEach((target) => {
        const anchorTeam = findTeamIndexForPlayer(teams, anchor);
        const targetTeam = findTeamIndexForPlayer(teams, target);
        if (anchorTeam >= 0 && targetTeam >= 0 && anchorTeam !== targetTeam) {
          penalty -= RULE_SOFT_SCORE.avoidOpponentViolationPenalty;
          notes.push(
            createEngineExplanation({
              code: RULE_ERROR_CODE.AVOID_OPPONENT_VIOLATED,
              message: `${anchor} should avoid opponent ${target}.`,
              details: { constraintId: constraint.id, soft: true },
            })
          );
        }
      });
      components[key] = penalty;
      total += penalty;
      return;
    }

    if (constraint.type === COMPETITION_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT) {
      const maxRepeat = Number(constraint.params?.maxRepeat ?? 1);
      let penalty = 0;
      teams.forEach((team) => {
        for (let i = 0; i < team.length; i += 1) {
          for (let j = i + 1; j < team.length; j += 1) {
            const count = getRepeatCount(
              context.partnerRepeatCounts,
              team[i],
              team[j]
            );
            if (count > maxRepeat) {
              penalty -= RULE_SOFT_SCORE.maxPartnerRepeatPenalty * (count - maxRepeat);
              notes.push(
                createEngineExplanation({
                  code: RULE_ERROR_CODE.MAX_PARTNER_REPEAT_EXCEEDED,
                  message: `${team[i]} and ${team[j]} exceeded partner repeat limit.`,
                  details: { constraintId: constraint.id, count, maxRepeat, soft: true },
                })
              );
            }
          }
        }
      });
      components[key] = penalty;
      total += penalty;
      return;
    }

    if (constraint.type === COMPETITION_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT && teams.length >= 2) {
      const maxRepeat = Number(constraint.params?.maxRepeat ?? 1);
      let penalty = 0;
      teams[0].forEach((playerA) => {
        teams[1].forEach((playerB) => {
          const count = getRepeatCount(context.opponentRepeatCounts, playerA, playerB);
          if (count > maxRepeat) {
            penalty -= RULE_SOFT_SCORE.maxOpponentRepeatPenalty * (count - maxRepeat);
            notes.push(
              createEngineExplanation({
                code: RULE_ERROR_CODE.MAX_OPPONENT_REPEAT_EXCEEDED,
                message: `${playerA} and ${playerB} exceeded opponent repeat limit.`,
                details: { constraintId: constraint.id, count, maxRepeat, soft: true },
              })
            );
          }
        });
      });
      components[key] = penalty;
      total += penalty;
      return;
    }

    if (constraint.type === COMPETITION_CONSTRAINT_TYPE.MIN_REST_TIME) {
      const minMinutes = Number(constraint.params?.minMinutes ?? 30);
      const evaluatedAt = parseTime(context.evaluatedAt) ?? Date.now();
      let penalty = 0;
      teams.flat().forEach((playerId) => {
        const lastMatchAt = parseTime(getPlayerSnapshot(playersById, playerId).lastMatchAt);
        if (lastMatchAt != null) {
          const elapsedMinutes = (evaluatedAt - lastMatchAt) / 60000;
          if (elapsedMinutes < minMinutes) {
            penalty -= RULE_SOFT_SCORE.minRestTimePenalty;
            notes.push(
              createEngineExplanation({
                code: RULE_ERROR_CODE.MIN_REST_TIME_VIOLATED,
                message: `Player ${playerId} has insufficient rest (${elapsedMinutes.toFixed(0)}m).`,
                details: { constraintId: constraint.id, playerId, soft: true },
              })
            );
          }
        }
      });
      components[key] = penalty;
      total += penalty;
    }
  });

  return {
    total,
    breakdown: createEngineScoreBreakdown({ total, components }),
    notes,
  };
}

function getPlayerSnapshot(playersById, playerId) {
  return playersById?.[String(playerId)] || {};
}

export { shareGroup };

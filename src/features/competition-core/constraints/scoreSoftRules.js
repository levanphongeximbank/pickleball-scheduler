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

function getPlayerSnapshot(playersById, playerId) {
  return playersById?.[String(playerId)] || {};
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
    }
  });

  return {
    total,
    breakdown: createEngineScoreBreakdown({ total, components }),
    notes,
  };
}

export { shareGroup };

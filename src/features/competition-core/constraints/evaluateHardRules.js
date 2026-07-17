import { COMPETITION_CONSTRAINT_TYPE } from "../constants/constraintType.js";
import { CONSTRAINT_SEVERITY } from "../constants/constraintSeverity.js";
import { createEngineExplanation } from "../contracts/engineContracts.js";
import { RULE_ERROR_CODE } from "./ruleConstants.js";
import {
  OPPONENT_GEOMETRY_TYPES,
  GROUP_GEOMETRY_TYPES,
  SUPPORTED_HARD_CONSTRAINT_TYPES,
} from "./constraintSupport.js";

const HARD_SUPPORT_SET = new Set(SUPPORTED_HARD_CONSTRAINT_TYPES);
const OPPONENT_SET = new Set(OPPONENT_GEOMETRY_TYPES);
const GROUP_SET = new Set(GROUP_GEOMETRY_TYPES);

/**
 * @typedef {import('../types/index.js').ConstraintDefinition} ConstraintDefinition
 * @typedef {import('../types/index.js').EngineExplanation} EngineExplanation
 */

/**
 * @typedef {Object} RulePlayerSnapshot
 * @property {string} [gender]
 * @property {string} [clubId]
 * @property {string} [organizationId]
 * @property {boolean} [checkedIn]
 * @property {boolean} [available]
 * @property {boolean} [busy]
 * @property {number} [skillLevel]
 * @property {string} [lastMatchAt]
 */

/**
 * @typedef {Object} RuleEvaluationContext
 * @property {'pairing'|'group'|'match'|'draw'|'lineup'|'entry'} scope
 * @property {string[][]} [teams]
 * @property {Array<{ id?: string, label?: string, playerIds?: string[] }>} [groups]
 * @property {{ teamA?: string[], teamB?: string[] }} [matchOption]
 * @property {Record<string, RulePlayerSnapshot>} [playersById]
 * @property {number} [teamSize]
 * @property {Array<{ playerId: string, position?: string, required?: boolean }>} [lineupSlots]
 * @property {Record<string, { eligible?: boolean, reason?: string }>} [entriesByPlayerId]
 * @property {Record<string, Record<string, number>>} [partnerRepeatCounts]
 * @property {Record<string, Record<string, number>>} [opponentRepeatCounts]
 * @property {string} [evaluatedAt]
 */

/**
 * @typedef {Object} HardRuleEvaluationResult
 * @property {boolean} feasible
 * @property {EngineExplanation[]} violations
 */

function normalizeGender(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["nam", "male", "m"].includes(raw)) {
    return "male";
  }
  if (["nữ", "nu", "female", "f"].includes(raw)) {
    return "female";
  }
  return "unknown";
}

function getPartnerParams(constraint) {
  const params = constraint.params || {};
  return {
    anchor: String(params.anchorPlayerId || ""),
    targets: Array.isArray(params.targetPlayerIds)
      ? params.targetPlayerIds.map(String).filter(Boolean)
      : [],
  };
}

function findTeamIndexForPlayer(teams, playerId) {
  return teams.findIndex((team) => team.map(String).includes(String(playerId)));
}

function shareTeam(playerA, playerB, teams) {
  const indexA = findTeamIndexForPlayer(teams, playerA);
  const indexB = findTeamIndexForPlayer(teams, playerB);
  return indexA >= 0 && indexB >= 0 && indexA === indexB;
}

function shareGroup(playerA, playerB, groups) {
  return groups.some((group) => {
    const ids = (group.playerIds || []).map(String);
    return ids.includes(String(playerA)) && ids.includes(String(playerB));
  });
}

function getPlayerSnapshot(playersById, playerId) {
  return playersById?.[String(playerId)] || {};
}

function teamSkillTotal(team, playersById) {
  return team.reduce((sum, playerId) => {
    const snapshot = getPlayerSnapshot(playersById, playerId);
    return sum + Number(snapshot.skillLevel ?? 0);
  }, 0);
}

function evaluateGroupAnchorTargetRule(constraint, groups = []) {
  const { anchor, targets } = getPartnerParams(constraint);
  if (!anchor || !targets.length) {
    return [];
  }

  /** @type {EngineExplanation[]} */
  const violations = [];

  targets.forEach((target) => {
    if (!shareGroup(anchor, target, groups)) {
      return;
    }

    const mustBeApart =
      constraint.type === COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER ||
      constraint.type === COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER;

    if (mustBeApart) {
      violations.push(
        createEngineExplanation({
          code:
            constraint.type === COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER
              ? RULE_ERROR_CODE.MUST_NOT_PARTNER_VIOLATED
              : RULE_ERROR_CODE.AVOID_PARTNER_VIOLATED,
          message: `${anchor} and ${target} must not share a group.`,
          details: { constraintId: constraint.id, anchor, target },
        })
      );
    }
  });

  return violations;
}

function areOpponentsOnTeams(playerA, playerB, teams) {
  if (!Array.isArray(teams) || teams.length < 2) {
    return false;
  }
  const indexA = findTeamIndexForPlayer(teams, playerA);
  const indexB = findTeamIndexForPlayer(teams, playerB);
  return indexA >= 0 && indexB >= 0 && indexA !== indexB;
}

function missingContextViolation(constraint, reason) {
  return createEngineExplanation({
    code: RULE_ERROR_CODE.RULE_NOT_APPLICABLE,
    message: `Constraint ${constraint.type} cannot be evaluated: ${reason}.`,
    details: {
      constraintId: constraint.id,
      type: constraint.type,
      missingContext: reason,
    },
  });
}

function unsupportedHardViolation(constraint) {
  return createEngineExplanation({
    code: RULE_ERROR_CODE.UNSUPPORTED_CONSTRAINT_EVALUATION,
    message: `Hard constraint type "${constraint.type}" is not evaluated by Competition Core.`,
    details: { constraintId: constraint.id, type: constraint.type },
  });
}

function evaluatePartnerHardRule(constraint, teams) {
  const { anchor, targets } = getPartnerParams(constraint);
  if (!anchor || !targets.length) {
    return null;
  }

  /** @type {EngineExplanation[]} */
  const violations = [];

  targets.forEach((target) => {
    const sameTeam = shareTeam(anchor, target, teams);

    const mustTogether =
      constraint.type === COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER ||
      constraint.type === COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER ||
      constraint.type === COMPETITION_CONSTRAINT_TYPE.SAME_TEAM;

    if (mustTogether && !sameTeam) {
      violations.push(
        createEngineExplanation({
          code:
            constraint.type === COMPETITION_CONSTRAINT_TYPE.SAME_TEAM
              ? RULE_ERROR_CODE.SAME_TEAM_VIOLATED
              : RULE_ERROR_CODE.MUST_PARTNER_UNSATISFIED,
          message: `${anchor} and ${target} must share a team.`,
          details: { constraintId: constraint.id, anchor, target },
        })
      );
    }

    const mustBeApart =
      constraint.type === COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER ||
      constraint.type === COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER ||
      constraint.type === COMPETITION_CONSTRAINT_TYPE.DIFFERENT_TEAM;

    if (mustBeApart && sameTeam) {
      const code =
        constraint.type === COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER
          ? RULE_ERROR_CODE.MUST_NOT_PARTNER_VIOLATED
          : constraint.type === COMPETITION_CONSTRAINT_TYPE.DIFFERENT_TEAM
            ? RULE_ERROR_CODE.DIFFERENT_TEAM_VIOLATED
            : RULE_ERROR_CODE.AVOID_PARTNER_VIOLATED;
      violations.push(
        createEngineExplanation({
          code,
          message: `${anchor} and ${target} must not share a team.`,
          details: { constraintId: constraint.id, anchor, target },
        })
      );
    }
  });

  return violations;
}

function evaluateOpponentHardRule(constraint, teams) {
  const { anchor, targets } = getPartnerParams(constraint);
  if (!anchor || !targets.length) {
    return [];
  }
  if (!Array.isArray(teams) || teams.length < 2) {
    return [missingContextViolation(constraint, "missing_opponent_geometry")];
  }

  /** @type {EngineExplanation[]} */
  const violations = [];
  targets.forEach((target) => {
    const opposing = areOpponentsOnTeams(anchor, target, teams);
    if (
      (constraint.type === COMPETITION_CONSTRAINT_TYPE.MUST_OPPONENT ||
        constraint.type === COMPETITION_CONSTRAINT_TYPE.PREFER_OPPONENT) &&
      !opposing
    ) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.MUST_OPPONENT_UNSATISFIED,
          message: `${anchor} and ${target} must be opponents.`,
          details: { constraintId: constraint.id, anchor, target },
        })
      );
    }
    if (
      (constraint.type === COMPETITION_CONSTRAINT_TYPE.MUST_NOT_OPPONENT ||
        constraint.type === COMPETITION_CONSTRAINT_TYPE.AVOID_OPPONENT) &&
      opposing
    ) {
      violations.push(
        createEngineExplanation({
          code:
            constraint.type === COMPETITION_CONSTRAINT_TYPE.MUST_NOT_OPPONENT
              ? RULE_ERROR_CODE.MUST_NOT_OPPONENT_VIOLATED
              : RULE_ERROR_CODE.AVOID_OPPONENT_VIOLATED,
          message: `${anchor} and ${target} must not be opponents.`,
          details: { constraintId: constraint.id, anchor, target },
        })
      );
    }
  });
  return violations;
}

function evaluateGroupMembershipHardRule(constraint, groups) {
  const { anchor, targets } = getPartnerParams(constraint);
  if (!anchor || !targets.length) {
    return [];
  }
  if (!Array.isArray(groups) || !groups.length) {
    return [missingContextViolation(constraint, "missing_groups_context")];
  }

  /** @type {EngineExplanation[]} */
  const violations = [];
  targets.forEach((target) => {
    const together = shareGroup(anchor, target, groups);
    if (constraint.type === COMPETITION_CONSTRAINT_TYPE.SAME_GROUP && !together) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.SAME_GROUP_VIOLATED,
          message: `${anchor} and ${target} must share a group.`,
          details: { constraintId: constraint.id, anchor, target },
        })
      );
    }
    if (constraint.type === COMPETITION_CONSTRAINT_TYPE.DIFFERENT_GROUP && together) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.DIFFERENT_GROUP_VIOLATED,
          message: `${anchor} and ${target} must not share a group.`,
          details: { constraintId: constraint.id, anchor, target },
        })
      );
    }
  });
  return violations;
}

function getRepeatCount(store, playerA, playerB) {
  const a = String(playerA);
  const b = String(playerB);
  return Number(store?.[a]?.[b] ?? store?.[b]?.[a] ?? 0);
}

function evaluateRepeatHardRule(constraint, context, teams) {
  const { anchor, targets } = getPartnerParams(constraint);
  const isPartner =
    constraint.type === COMPETITION_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT ||
    constraint.type === COMPETITION_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT;
  const store = isPartner
    ? context.partnerRepeatCounts
    : context.opponentRepeatCounts;
  const limitKey =
    constraint.type === COMPETITION_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT ||
    constraint.type === COMPETITION_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT
      ? "max"
      : "min";
  const limit = Number(
    constraint.params?.[limitKey === "max" ? "maxRepeat" : "minRepeat"] ??
      constraint.params?.maxCount ??
      constraint.params?.minCount ??
      1
  );

  /** @type {EngineExplanation[]} */
  const violations = [];

  if (isPartner) {
    const pairs = [];
    if (anchor && targets.length) {
      targets.forEach((target) => pairs.push([anchor, target]));
    } else {
      (teams || []).forEach((team) => {
        for (let i = 0; i < team.length; i += 1) {
          for (let j = i + 1; j < team.length; j += 1) {
            pairs.push([team[i], team[j]]);
          }
        }
      });
    }
    pairs.forEach(([a, b]) => {
      const count = getRepeatCount(store, a, b);
      if (limitKey === "max" && count > limit) {
        violations.push(
          createEngineExplanation({
            code: RULE_ERROR_CODE.MAX_PARTNER_REPEAT_EXCEEDED,
            message: `${a} and ${b} exceeded partner repeat limit.`,
            details: { constraintId: constraint.id, count, limit },
          })
        );
      }
      if (limitKey === "min" && count < limit) {
        violations.push(
          createEngineExplanation({
            code: RULE_ERROR_CODE.MIN_PARTNER_REPEAT_UNSATISFIED,
            message: `${a} and ${b} below minimum partner repeat.`,
            details: { constraintId: constraint.id, count, limit },
          })
        );
      }
    });
    return violations;
  }

  if (!Array.isArray(teams) || teams.length < 2) {
    return [missingContextViolation(constraint, "missing_opponent_geometry")];
  }
  const pairs = [];
  if (anchor && targets.length) {
    targets.forEach((target) => pairs.push([anchor, target]));
  } else {
    teams[0].forEach((a) => {
      teams[1].forEach((b) => pairs.push([a, b]));
    });
  }
  pairs.forEach(([a, b]) => {
    const count = getRepeatCount(store, a, b);
    if (limitKey === "max" && count > limit) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.MAX_OPPONENT_REPEAT_EXCEEDED,
          message: `${a} and ${b} exceeded opponent repeat limit.`,
          details: { constraintId: constraint.id, count, limit },
        })
      );
    }
    if (limitKey === "min" && count < limit) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.MIN_OPPONENT_REPEAT_UNSATISFIED,
          message: `${a} and ${b} below minimum opponent repeat.`,
          details: { constraintId: constraint.id, count, limit },
        })
      );
    }
  });
  return violations;
}

function evaluateMinRestHardRule(constraint, context, teams) {
  const minMinutes = Number(constraint.params?.minMinutes ?? 30);
  const evaluatedAt = Date.parse(String(context.evaluatedAt || "")) || Date.now();
  const playersById = context.playersById || {};
  /** @type {EngineExplanation[]} */
  const violations = [];
  (teams || []).flat().forEach((playerId) => {
    const last = Date.parse(String(playersById[String(playerId)]?.lastMatchAt || ""));
    if (!Number.isFinite(last)) {
      return;
    }
    const elapsed = (evaluatedAt - last) / 60000;
    if (elapsed < minMinutes) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.MIN_REST_TIME_VIOLATED,
          message: `Player ${playerId} has insufficient rest.`,
          details: { constraintId: constraint.id, playerId, elapsed, minMinutes },
        })
      );
    }
  });
  return violations;
}

function evaluateGenderEligibility(constraint, context) {
  const params = constraint.params || {};
  const eventType = String(params.eventType || "mixed_double").toLowerCase();
  if (eventType !== "mixed_double") {
    return [];
  }

  const teams =
    context.teams ||
    (context.matchOption
      ? [context.matchOption.teamA || [], context.matchOption.teamB || []]
      : []);

  /** @type {EngineExplanation[]} */
  const violations = [];

  teams.forEach((team, index) => {
    if (team.length !== 2) {
      return;
    }
    const genders = team.map((playerId) =>
      normalizeGender(getPlayerSnapshot(context.playersById, playerId).gender)
    );
    const males = genders.filter((item) => item === "male").length;
    const females = genders.filter((item) => item === "female").length;
    if (males !== 1 || females !== 1) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.GENDER_ELIGIBILITY_VIOLATED,
          message: `Team ${index + 1} must contain exactly one male and one female for mixed doubles.`,
          details: { constraintId: constraint.id, team, genders },
        })
      );
    }
  });

  return violations;
}

function evaluateSkillCap(constraint, context) {
  const params = constraint.params || {};
  const maxDiff = Number(params.maxDiff ?? 0.5);
  const teams =
    context.teams ||
    (context.matchOption
      ? [context.matchOption.teamA || [], context.matchOption.teamB || []]
      : []);

  if (teams.length < 2) {
    return [];
  }

  const totals = teams.map((team) => teamSkillTotal(team, context.playersById || {}));
  const diff = Math.abs(totals[0] - totals[1]);

  if (diff > maxDiff) {
    return [
      createEngineExplanation({
        code: RULE_ERROR_CODE.SKILL_CAP_EXCEEDED,
        message: `Team skill difference ${diff.toFixed(2)} exceeds cap ${maxDiff}.`,
        details: { constraintId: constraint.id, diff, maxDiff, totals },
      }),
    ];
  }

  return [];
}

function evaluateCheckinAndAvailability(constraint, context) {
  const playerIds = new Set();
  (context.teams || []).forEach((team) => team.forEach((id) => playerIds.add(String(id))));
  (context.groups || []).forEach((group) =>
    (group.playerIds || []).forEach((id) => playerIds.add(String(id)))
  );
  if (context.matchOption) {
    (context.matchOption.teamA || []).forEach((id) => playerIds.add(String(id)));
    (context.matchOption.teamB || []).forEach((id) => playerIds.add(String(id)));
  }

  /** @type {EngineExplanation[]} */
  const violations = [];

  playerIds.forEach((playerId) => {
    const snapshot = getPlayerSnapshot(context.playersById, playerId);
    if (
      constraint.type === COMPETITION_CONSTRAINT_TYPE.CHECKIN_REQUIRED &&
      snapshot.checkedIn !== true
    ) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.CHECKIN_REQUIRED_MISSING,
          message: `Player ${playerId} is not checked in.`,
          details: { constraintId: constraint.id, playerId },
        })
      );
    }

    if (
      constraint.type === COMPETITION_CONSTRAINT_TYPE.AVAILABILITY_REQUIRED &&
      snapshot.available === false
    ) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.AVAILABILITY_REQUIRED_MISSING,
          message: `Player ${playerId} is not available.`,
          details: { constraintId: constraint.id, playerId },
        })
      );
    }
  });

  return violations;
}

function evaluateSeparationRule(constraint, groups, code, field, playersById = {}) {
  /** @type {EngineExplanation[]} */
  const violations = [];

  groups.forEach((group) => {
    const ids = (group.playerIds || []).map(String);
    const buckets = new Map();

    ids.forEach((playerId) => {
      const value = String(getPlayerSnapshot(playersById, playerId)[field] || "").trim();
      if (!value) {
        return;
      }
      const bucket = buckets.get(value) || [];
      bucket.push(playerId);
      buckets.set(value, bucket);
    });

    buckets.forEach((players, bucketKey) => {
      if (players.length > 1) {
        violations.push(
          createEngineExplanation({
            code,
            message: `Group ${group.label || group.id || "?"} contains multiple players from ${field} ${bucketKey}.`,
            details: {
              constraintId: constraint.id,
              groupId: group.id,
              players,
              bucketKey,
            },
          })
        );
      }
    });
  });

  return violations;
}

function evaluateMixedTeamComposition(constraint, context) {
  const params = constraint.params || {};
  const composition = String(params.composition || params.eventType || "mixed_double").toLowerCase();
  if (composition !== "mixed_double") {
    return [];
  }
  return evaluateGenderEligibility(
    { ...constraint, params: { ...params, eventType: "mixed_double" } },
    context
  ).map((item) => ({
    ...item,
    code: RULE_ERROR_CODE.MIXED_TEAM_COMPOSITION_VIOLATED,
    message: item.message.replace("gender eligibility", "mixed team composition"),
  }));
}

function collectCandidatePlayerIds(context) {
  const playerIds = new Set();
  (context.teams || []).forEach((team) => team.forEach((id) => playerIds.add(String(id))));
  (context.groups || []).forEach((group) =>
    (group.playerIds || []).forEach((id) => playerIds.add(String(id)))
  );
  if (context.matchOption) {
    (context.matchOption.teamA || []).forEach((id) => playerIds.add(String(id)));
    (context.matchOption.teamB || []).forEach((id) => playerIds.add(String(id)));
  }
  return playerIds;
}

function evaluatePlayerNotBusy(constraint, context) {
  /** @type {EngineExplanation[]} */
  const violations = [];
  collectCandidatePlayerIds(context).forEach((playerId) => {
    const snapshot = getPlayerSnapshot(context.playersById, playerId);
    if (snapshot.busy === true) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.PLAYER_BUSY,
          message: `Player ${playerId} is busy.`,
          details: { constraintId: constraint.id, playerId, affectedPlayers: [playerId] },
        })
      );
    }
  });
  return violations;
}

function evaluateLineupValidity(constraint, context) {
  const slots = context.lineupSlots || [];
  /** @type {EngineExplanation[]} */
  const violations = [];
  const requiredPositions = slots.filter((slot) => slot.required !== false);

  requiredPositions.forEach((slot) => {
    if (!slot.playerId) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.LINEUP_VALIDITY_VIOLATED,
          message: `Required lineup slot ${slot.position || "?"} is empty.`,
          details: { constraintId: constraint.id, slot },
        })
      );
    }
  });

  const assigned = new Set(
    slots.map((slot) => String(slot.playerId || "")).filter(Boolean)
  );
  if (assigned.size !== slots.filter((slot) => slot.playerId).length) {
    violations.push(
      createEngineExplanation({
        code: RULE_ERROR_CODE.LINEUP_VALIDITY_VIOLATED,
        message: "Duplicate player assignment in lineup.",
        details: { constraintId: constraint.id },
      })
    );
  }

  return violations;
}

function evaluateEntryEligibility(constraint, context) {
  /** @type {EngineExplanation[]} */
  const violations = [];
  collectCandidatePlayerIds(context).forEach((playerId) => {
    const entry = context.entriesByPlayerId?.[playerId];
    if (entry && entry.eligible === false) {
      violations.push(
        createEngineExplanation({
          code: RULE_ERROR_CODE.ENTRY_ELIGIBILITY_VIOLATED,
          message: entry.reason || `Player ${playerId} is not eligible to enter.`,
          details: {
            constraintId: constraint.id,
            playerId,
            affectedPlayers: [playerId],
          },
        })
      );
    }
  });
  return violations;
}

function evaluateTeamSkillDifferenceHard(constraint, context) {
  const params = constraint.params || {};
  const maxDiff = Number(params.maxDiff ?? 0.5);
  const teams =
    context.teams ||
    (context.matchOption
      ? [context.matchOption.teamA || [], context.matchOption.teamB || []]
      : []);

  if (teams.length < 2) {
    return [];
  }

  const totals = teams.map((team) => teamSkillTotal(team, context.playersById || {}));
  const diff = Math.abs(totals[0] - totals[1]);

  if (diff > maxDiff) {
    return [
      createEngineExplanation({
        code: RULE_ERROR_CODE.TEAM_SKILL_DIFFERENCE_EXCEEDED,
        message: `Team skill difference ${diff.toFixed(2)} exceeds limit ${maxDiff}.`,
        details: { constraintId: constraint.id, diff, maxDiff, totals },
      }),
    ];
  }

  return [];
}

/**
 * Evaluate hard constraints — infeasible candidates are rejected, not penalized.
 *
 * @param {ConstraintDefinition[]} constraints
 * @param {RuleEvaluationContext} context
 * @returns {HardRuleEvaluationResult}
 */
export function evaluateHardRules(constraints = [], context) {
  const active = (constraints || []).filter(
    (item) => item?.enabled !== false && item.severity === CONSTRAINT_SEVERITY.HARD
  );

  const teams =
    context.teams ||
    (context.matchOption
      ? [context.matchOption.teamA || [], context.matchOption.teamB || []]
      : []);
  const groups = context.groups || [];

  /** @type {EngineExplanation[]} */
  const violations = [];

  active.forEach((constraint) => {
    if (!HARD_SUPPORT_SET.has(constraint.type)) {
      violations.push(unsupportedHardViolation(constraint));
      return;
    }

    switch (constraint.type) {
      case COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER:
      case COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER:
      case COMPETITION_CONSTRAINT_TYPE.SAME_TEAM:
        violations.push(...(evaluatePartnerHardRule(constraint, teams) || []));
        break;
      case COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER:
      case COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER:
        if (context.scope === "group" && groups.length) {
          violations.push(...evaluateGroupAnchorTargetRule(constraint, groups));
        } else {
          violations.push(...(evaluatePartnerHardRule(constraint, teams) || []));
        }
        break;
      case COMPETITION_CONSTRAINT_TYPE.DIFFERENT_TEAM:
        violations.push(...(evaluatePartnerHardRule(constraint, teams) || []));
        break;
      case COMPETITION_CONSTRAINT_TYPE.MUST_OPPONENT:
      case COMPETITION_CONSTRAINT_TYPE.PREFER_OPPONENT:
      case COMPETITION_CONSTRAINT_TYPE.MUST_NOT_OPPONENT:
      case COMPETITION_CONSTRAINT_TYPE.AVOID_OPPONENT:
        violations.push(...evaluateOpponentHardRule(constraint, teams));
        break;
      case COMPETITION_CONSTRAINT_TYPE.SAME_GROUP:
      case COMPETITION_CONSTRAINT_TYPE.DIFFERENT_GROUP:
        violations.push(...evaluateGroupMembershipHardRule(constraint, groups));
        break;
      case COMPETITION_CONSTRAINT_TYPE.GENDER_ELIGIBILITY:
        violations.push(...evaluateGenderEligibility(constraint, context));
        break;
      case COMPETITION_CONSTRAINT_TYPE.MIXED_TEAM_COMPOSITION:
        violations.push(...evaluateMixedTeamComposition(constraint, context));
        break;
      case COMPETITION_CONSTRAINT_TYPE.SKILL_CAP:
        violations.push(...evaluateSkillCap(constraint, context));
        break;
      case COMPETITION_CONSTRAINT_TYPE.TEAM_SKILL_DIFFERENCE:
        violations.push(...evaluateTeamSkillDifferenceHard(constraint, context));
        break;
      case COMPETITION_CONSTRAINT_TYPE.CHECKIN_REQUIRED:
      case COMPETITION_CONSTRAINT_TYPE.AVAILABILITY_REQUIRED:
        violations.push(...evaluateCheckinAndAvailability(constraint, context));
        break;
      case COMPETITION_CONSTRAINT_TYPE.PLAYER_NOT_BUSY:
        violations.push(...evaluatePlayerNotBusy(constraint, context));
        break;
      case COMPETITION_CONSTRAINT_TYPE.LINEUP_VALIDITY:
        violations.push(...evaluateLineupValidity(constraint, context));
        break;
      case COMPETITION_CONSTRAINT_TYPE.ENTRY_ELIGIBILITY:
        violations.push(...evaluateEntryEligibility(constraint, context));
        break;
      case COMPETITION_CONSTRAINT_TYPE.SAME_CLUB_SEPARATION:
        if (groups.length) {
          violations.push(
            ...evaluateSeparationRule(
              constraint,
              groups.map((group) => ({
                ...group,
                playerIds: (group.playerIds || []).map(String),
              })),
              RULE_ERROR_CODE.SAME_CLUB_SEPARATION_VIOLATED,
              "clubId",
              context.playersById || {}
            )
          );
        } else if (GROUP_SET.has(constraint.type)) {
          violations.push(missingContextViolation(constraint, "missing_groups_context"));
        }
        break;
      case COMPETITION_CONSTRAINT_TYPE.SAME_ORGANIZATION_SEPARATION:
        if (groups.length) {
          violations.push(
            ...evaluateSeparationRule(
              constraint,
              groups,
              RULE_ERROR_CODE.SAME_ORGANIZATION_SEPARATION_VIOLATED,
              "organizationId",
              context.playersById || {}
            )
          );
        } else {
          violations.push(missingContextViolation(constraint, "missing_groups_context"));
        }
        break;
      case COMPETITION_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT:
      case COMPETITION_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT:
      case COMPETITION_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT:
      case COMPETITION_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT:
        violations.push(...evaluateRepeatHardRule(constraint, context, teams));
        break;
      case COMPETITION_CONSTRAINT_TYPE.MIN_REST_TIME:
        violations.push(...evaluateMinRestHardRule(constraint, context, teams));
        break;
      default:
        // Known support-set members must have an explicit case above.
        if (OPPONENT_SET.has(constraint.type)) {
          violations.push(missingContextViolation(constraint, "unhandled_opponent_case"));
        } else {
          violations.push(unsupportedHardViolation(constraint));
        }
        break;
    }
  });

  return {
    feasible: violations.length === 0,
    violations,
  };
}

export { shareTeam, shareGroup, getPartnerParams };

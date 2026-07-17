import { PRIVATE_PAIRING_CONSTRAINT_TYPE } from "../constants/constraintTypes.js";
import { RELATION_MODE } from "../constants/enums.js";
import { PRIVATE_PAIRING_RUNTIME_CODE } from "./runtimeCodes.js";

/**
 * Hard types evaluated by private pairing runtime.
 * Any other hard severity rule emits UNSUPPORTED_HARD_CONSTRAINT (never silent).
 */
export const PP_HARD_EVALUATED_TYPES = Object.freeze([
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_TEAM,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT,
]);

const PP_HARD_SET = new Set(PP_HARD_EVALUATED_TYPES);

/**
 * @param {unknown} player
 * @returns {string}
 */
export function playerIdOf(player) {
  if (player == null) {
    return "";
  }
  if (typeof player === "object") {
    return String(player.id ?? "");
  }
  return String(player);
}

/**
 * @param {Array<{ members?: unknown[], playerIds?: unknown[] }>} teams
 * @returns {string[][]}
 */
export function normalizeTeamsToIdMatrix(teams = []) {
  return (teams || []).map((team) => {
    if (Array.isArray(team?.playerIds) && team.playerIds.length) {
      return team.playerIds.map(String);
    }
    return (team?.members || []).map(playerIdOf).filter(Boolean);
  });
}

/**
 * @param {string} playerA
 * @param {string} playerB
 * @param {string[][]} teams
 */
export function shareTeam(playerA, playerB, teams) {
  return teams.some(
    (team) => team.includes(String(playerA)) && team.includes(String(playerB))
  );
}

/**
 * Opponents: same match, different teams.
 * @param {string} playerA
 * @param {string} playerB
 * @param {{ teamA?: unknown[], teamB?: unknown[] }|null} matchOption
 */
export function areOpponents(playerA, playerB, matchOption) {
  if (!matchOption) {
    return false;
  }
  const teamA = (matchOption.teamA || []).map(playerIdOf);
  const teamB = (matchOption.teamB || []).map(playerIdOf);
  const aInA = teamA.includes(String(playerA));
  const aInB = teamB.includes(String(playerA));
  const bInA = teamA.includes(String(playerB));
  const bInB = teamB.includes(String(playerB));
  return (aInA && bInB) || (aInB && bInA);
}

/**
 * Normalize group candidates to player-id lists.
 * Supports entry-based groups and prebuilt playerIds / teamPlayerIds.
 *
 * @param {Array<Record<string, unknown>>} [groups]
 * @returns {Array<{ id: string, playerIds: string[] }>}
 */
export function normalizeGroupsToPlayerIds(groups = []) {
  return (groups || []).map((group, index) => {
    if (Array.isArray(group?.playerIds) && group.playerIds.length) {
      return {
        id: String(group.id || `group-${index}`),
        playerIds: group.playerIds.map(String),
      };
    }
    if (Array.isArray(group?.teamPlayerIds) && group.teamPlayerIds.length) {
      return {
        id: String(group.id || `group-${index}`),
        playerIds: group.teamPlayerIds.map(String),
      };
    }
    const playerIds = new Set();
    (group?.entries || []).forEach((entry) => {
      (entry?.playerIds || []).forEach((id) => playerIds.add(String(id)));
    });
    (group?.teams || []).forEach((team) => {
      (team?.playerIds || []).forEach((id) => playerIds.add(String(id)));
      (team?.members || []).forEach((member) => {
        const id = playerIdOf(member);
        if (id) playerIds.add(id);
      });
    });
    return {
      id: String(group?.id || `group-${index}`),
      playerIds: [...playerIds],
    };
  });
}

/**
 * @param {string} playerA
 * @param {string} playerB
 * @param {Array<{ playerIds?: string[] }>} groups
 */
export function shareGroup(playerA, playerB, groups = []) {
  return groups.some((group) => {
    const ids = (group.playerIds || []).map(String);
    return ids.includes(String(playerA)) && ids.includes(String(playerB));
  });
}

/**
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} rule
 * @param {(targetId: string) => boolean} predicate
 */
function relationSatisfied(rule, predicate) {
  const targets = (rule.targetPlayerIds || []).map(String);
  if (!targets.length) {
    return true;
  }
  if (rule.relationMode === RELATION_MODE.ALL_OF) {
    return targets.every((target) => predicate(target));
  }
  return targets.some((target) => predicate(target));
}

/**
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} rule
 * @param {(targetId: string) => boolean} predicate true when forbidden relation holds for target
 */
function relationForbidden(rule, predicate) {
  const targets = (rule.targetPlayerIds || []).map(String);
  if (!targets.length) {
    return false;
  }
  if (rule.relationMode === RELATION_MODE.ALL_OF) {
    return targets.every((target) => predicate(target));
  }
  return targets.some((target) => predicate(target));
}

function getRepeatCount(store, a, b) {
  const left = String(a);
  const right = String(b);
  return Number(store?.[left]?.[right] ?? store?.[right]?.[left] ?? 0);
}

/**
 * Evaluate hard private pairing rules against a candidate.
 * Opponent rules defer when matchOption is absent (team-formation only).
 * Group rules defer when groups are absent (pairing / matchup only).
 *
 * @param {Object} candidate
 * @param {Array} [candidate.teams]
 * @param {{ teamA?: unknown[], teamB?: unknown[] }} [candidate.matchOption]
 * @param {Array} [candidate.groups]
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule[]} hardRules
 * @param {Object} [history]
 * @returns {{
 *   feasible: boolean,
 *   violations: Array<{ code: string, ruleId: string, playerIds: string[] }>,
 *   deferred: Array<{ code: string, ruleId: string, playerIds: string[], reason: string }>
 * }}
 */
export function evaluateHardPrivatePairingRules(candidate, hardRules = [], history = {}) {
  const teams =
    candidate.teamsIdMatrix ||
    normalizeTeamsToIdMatrix(candidate.teams || deriveTeamsFromMatch(candidate.matchOption));
  const matchOption = candidate.matchOption || null;
  const groups =
    candidate.groupsIdMatrix || normalizeGroupsToPlayerIds(candidate.groups || []);
  const partnerRepeats = history.partnerRepeatCounts || {};
  const opponentRepeats = history.opponentRepeatCounts || {};

  /** @type {Array<{ code: string, ruleId: string, playerIds: string[] }>} */
  const violations = [];
  /** @type {Array<{ code: string, ruleId: string, playerIds: string[], reason: string }>} */
  const deferred = [];

  hardRules.forEach((rule) => {
    const primary = String(rule.primaryPlayerId || "");
    if (!primary) {
      return;
    }

    if (!PP_HARD_SET.has(rule.constraintType)) {
      violations.push({
        code: PRIVATE_PAIRING_RUNTIME_CODE.UNSUPPORTED_HARD_CONSTRAINT,
        ruleId: rule.id,
        playerIds: [primary, ...rule.targetPlayerIds],
      });
      return;
    }

    if (
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER ||
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER ||
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM
    ) {
      if (!teams.length) {
        return;
      }
      const ok = relationSatisfied(rule, (target) => shareTeam(primary, target, teams));
      if (!ok) {
        violations.push({
          code:
            rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM
              ? PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_SAME_TEAM
              : PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MUST_PARTNER,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
      return;
    }

    if (
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER ||
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER ||
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_TEAM
    ) {
      if (!teams.length) {
        return;
      }
      const bad = relationForbidden(rule, (target) => shareTeam(primary, target, teams));
      if (bad) {
        const code =
          rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER
            ? PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MUST_NOT_PARTNER
            : rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_TEAM
              ? PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_DIFFERENT_TEAM
              : PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_AVOID_PARTNER;
        violations.push({
          code,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
      return;
    }

    if (
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP ||
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP
    ) {
      if (!groups.length) {
        deferred.push({
          code: PRIVATE_PAIRING_RUNTIME_CODE.CONSTRAINT_CONTEXT_MISSING,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
          reason: "missing_groups_context",
        });
        return;
      }
      if (rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP) {
        const ok = relationSatisfied(rule, (target) => shareGroup(primary, target, groups));
        if (!ok) {
          violations.push({
            code: PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_SAME_GROUP,
            ruleId: rule.id,
            playerIds: [primary, ...rule.targetPlayerIds],
          });
        }
      } else {
        const bad = relationForbidden(rule, (target) => shareGroup(primary, target, groups));
        if (bad) {
          violations.push({
            code: PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_DIFFERENT_GROUP,
            ruleId: rule.id,
            playerIds: [primary, ...rule.targetPlayerIds],
          });
        }
      }
      return;
    }

    if (
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT ||
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT
    ) {
      const isMax = rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT;
      const limit = Number(
        rule.metadata?.[isMax ? "maxCount" : "minCount"] ??
          rule.metadata?.maxCount ??
          rule.metadata?.minCount ??
          1
      );
      let violated = false;
      (rule.targetPlayerIds || []).forEach((target) => {
        const count = getRepeatCount(partnerRepeats, primary, target);
        if (isMax ? count > limit : count < limit) {
          violated = true;
        }
      });
      if (violated) {
        violations.push({
          code: isMax
            ? PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MAX_PARTNER_REPEAT
            : PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MIN_PARTNER_REPEAT,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
      return;
    }

    // Opponent geometry + opponent repeat — defer (not silent, not hard-fail) when no match.
    if (!matchOption) {
      deferred.push({
        code: PRIVATE_PAIRING_RUNTIME_CODE.CONSTRAINT_CONTEXT_MISSING,
        ruleId: rule.id,
        playerIds: [primary, ...rule.targetPlayerIds],
        reason: "missing_match_context",
      });
      return;
    }

    if (
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT ||
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT
    ) {
      const ok = relationSatisfied(rule, (target) => areOpponents(primary, target, matchOption));
      if (!ok) {
        violations.push({
          code: PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MUST_OPPONENT,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
      return;
    }

    if (
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT ||
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT
    ) {
      const bad = relationForbidden(rule, (target) => areOpponents(primary, target, matchOption));
      if (bad) {
        violations.push({
          code:
            rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT
              ? PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MUST_NOT_OPPONENT
              : PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_AVOID_OPPONENT,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
      return;
    }

    if (
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT ||
      rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT
    ) {
      const isMax = rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT;
      const limit = Number(
        rule.metadata?.[isMax ? "maxCount" : "minCount"] ??
          rule.metadata?.maxCount ??
          rule.metadata?.minCount ??
          1
      );
      let violated = false;
      (rule.targetPlayerIds || []).forEach((target) => {
        const count = getRepeatCount(opponentRepeats, primary, target);
        if (isMax ? count > limit : count < limit) {
          violated = true;
        }
      });
      if (violated) {
        violations.push({
          code: isMax
            ? PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MAX_OPPONENT_REPEAT
            : PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MIN_OPPONENT_REPEAT,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
      return;
    }

    violations.push({
      code: PRIVATE_PAIRING_RUNTIME_CODE.UNSUPPORTED_HARD_CONSTRAINT,
      ruleId: rule.id,
      playerIds: [primary, ...rule.targetPlayerIds],
    });
  });

  return { feasible: violations.length === 0, violations, deferred };
}

function deriveTeamsFromMatch(matchOption) {
  if (!matchOption) {
    return [];
  }
  return [
    { members: matchOption.teamA || [] },
    { members: matchOption.teamB || [] },
  ];
}

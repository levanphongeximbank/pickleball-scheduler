import { PRIVATE_PAIRING_CONSTRAINT_TYPE } from "../constants/constraintTypes.js";
import { RELATION_MODE } from "../constants/enums.js";
import { PRIVATE_PAIRING_RUNTIME_CODE } from "./runtimeCodes.js";

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
  // ANY_OF default
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
    // Forbidden only when ALL targets match the forbidden relation simultaneously
    return targets.every((target) => predicate(target));
  }
  // ANY_OF: forbidden if any target matches
  return targets.some((target) => predicate(target));
}

/**
 * Evaluate hard private pairing rules against a candidate.
 * Opponent rules are skipped when matchOption is absent (team-formation only).
 * Group rules are skipped when groups are absent (pairing / matchup only).
 *
 * @param {Object} candidate
 * @param {Array} [candidate.teams]
 * @param {{ teamA?: unknown[], teamB?: unknown[] }} [candidate.matchOption]
 * @param {Array} [candidate.groups]
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule[]} hardRules
 * @returns {{ feasible: boolean, violations: Array<{ code: string, ruleId: string, playerIds: string[] }> }}
 */
export function evaluateHardPrivatePairingRules(candidate, hardRules = []) {
  const teams =
    candidate.teamsIdMatrix ||
    normalizeTeamsToIdMatrix(candidate.teams || deriveTeamsFromMatch(candidate.matchOption));
  const matchOption = candidate.matchOption || null;
  const groups =
    candidate.groupsIdMatrix || normalizeGroupsToPlayerIds(candidate.groups || []);

  /** @type {Array<{ code: string, ruleId: string, playerIds: string[] }>} */
  const violations = [];

  hardRules.forEach((rule) => {
    const primary = String(rule.primaryPlayerId || "");
    if (!primary) {
      return;
    }

    if (rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER) {
      if (!teams.length) {
        return;
      }
      const ok = relationSatisfied(rule, (target) => shareTeam(primary, target, teams));
      if (!ok) {
        violations.push({
          code: PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MUST_PARTNER,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
      return;
    }

    if (rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER) {
      if (!teams.length) {
        return;
      }
      const bad = relationForbidden(rule, (target) => shareTeam(primary, target, teams));
      if (bad) {
        violations.push({
          code: PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MUST_NOT_PARTNER,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
      return;
    }

    if (rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP) {
      if (!groups.length) {
        return;
      }
      const ok = relationSatisfied(rule, (target) => shareGroup(primary, target, groups));
      if (!ok) {
        violations.push({
          code: PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_SAME_GROUP,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
      return;
    }

    if (rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP) {
      if (!groups.length) {
        return;
      }
      const bad = relationForbidden(rule, (target) => shareGroup(primary, target, groups));
      if (bad) {
        violations.push({
          code: PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_DIFFERENT_GROUP,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
      return;
    }

    if (!matchOption) {
      return;
    }

    if (rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT) {
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
            rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT
              ? PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_AVOID_OPPONENT
              : PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MUST_NOT_OPPONENT,
          ruleId: rule.id,
          playerIds: [primary, ...rule.targetPlayerIds],
        });
      }
    }
  });

  return { feasible: violations.length === 0, violations };
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

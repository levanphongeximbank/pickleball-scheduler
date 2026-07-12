import { CONSTRAINT_MODE, CONSTRAINT_SCORE, CONSTRAINT_TYPE } from "../constants.js";
import { evaluateLegacyPairingConstraints } from "../../competition-core/constraints/adapters/constraintsEvaluationBridge.js";
import { evaluateLegacyGroupConstraints } from "../../competition-core/constraints/adapters/groupConstraintsBridge.js";

function activeConstraints(constraints = []) {
  return (constraints || []).filter((item) => item?.enabled !== false);
}

export function getTeamMemberIds(team) {
  return (team.members || team.playerIds || []).map((item) =>
    typeof item === "object" ? String(item.id) : String(item)
  );
}

export function evaluatePartnerConstraintsForTeam(team, constraints = []) {
  const memberIds = getTeamMemberIds(team);
  let score = 0;
  const violations = [];
  const satisfied = [];

  activeConstraints(constraints).forEach((constraint) => {
    const anchor = String(constraint.anchorPlayerId);
    const targets = constraint.targetPlayerIds.map(String);
    const anchorInTeam = memberIds.includes(anchor);

    if (constraint.type === CONSTRAINT_TYPE.PREFER_PARTNER) {
      if (!anchorInTeam) {
        return;
      }
      const matched = targets.find((targetId) => memberIds.includes(targetId));
      if (matched) {
        score += CONSTRAINT_SCORE.preferMatchBonus;
        satisfied.push({ constraint, matchedPlayerId: matched });
      } else if (constraint.mode === CONSTRAINT_MODE.SOFT) {
        score -= CONSTRAINT_SCORE.preferMissPenalty;
      } else {
        violations.push({
          constraint,
          message: `${anchor} chưa được ghép với VĐV ưu tiên.`,
        });
      }
      return;
    }

    if (constraint.type === CONSTRAINT_TYPE.AVOID_PARTNER) {
      if (!anchorInTeam) {
        return;
      }
      const conflict = targets.find((targetId) => memberIds.includes(targetId));
      if (conflict) {
        if (constraint.mode === CONSTRAINT_MODE.HARD) {
          violations.push({
            constraint,
            message: `${anchor} không được cùng cặp với ${conflict}.`,
          });
        } else {
          score -= CONSTRAINT_SCORE.avoidViolationPenalty;
          violations.push({
            constraint,
            soft: true,
            message: `${anchor} đang cùng cặp với ${conflict} (phạt điểm).`,
          });
        }
      }
    }
  });

  return { score, violations, satisfied };
}

export function evaluatePartnerConstraintsForTeams(teams = [], constraints = [], options = {}) {
  const bridge = evaluateLegacyPairingConstraints(teams, constraints, {
    envSource: options.envSource,
    legacyEvaluate: () => evaluatePartnerConstraintsForTeamsLegacy(teams, constraints),
  });
  return bridge.result;
}

function evaluatePartnerConstraintsForTeamsLegacy(teams = [], constraints = []) {
  let score = 0;
  const violations = [];
  const satisfied = [];

  teams.forEach((team) => {
    const result = evaluatePartnerConstraintsForTeam(team, constraints);
    score += result.score;
    violations.push(...result.violations);
    satisfied.push(...result.satisfied);
  });

  const hardViolations = violations.filter((item) => !item.soft);
  return { score, violations, satisfied, hardViolations, ok: hardViolations.length === 0 };
}

export function getEntryPlayerIds(entry) {
  return (entry.playerIds || []).map(String);
}

export function evaluateGroupConstraints(groups = [], constraints = [], options = {}) {
  const bridge = evaluateLegacyGroupConstraints(groups, constraints, {
    envSource: options.envSource,
    players: options.players,
    legacyEvaluate: () => evaluateGroupConstraintsLegacy(groups, constraints),
  });
  return bridge.result;
}

function evaluateGroupConstraintsLegacy(groups = [], constraints = []) {
  let score = 0;
  const violations = [];

  const groupPlayerMap = groups.map((group) => {
    const playerIds = new Set();
    (group.entries || []).forEach((entry) => {
      getEntryPlayerIds(entry).forEach((id) => playerIds.add(id));
    });
    return { group, playerIds };
  });

  activeConstraints(constraints)
    .filter((constraint) => constraint.type === CONSTRAINT_TYPE.AVOID_SAME_GROUP)
    .forEach((constraint) => {
      const anchor = String(constraint.anchorPlayerId);
      const targets = constraint.targetPlayerIds.map(String);

      groupPlayerMap.forEach(({ group, playerIds }) => {
        if (!playerIds.has(anchor)) {
          return;
        }
        const conflict = targets.find((targetId) => playerIds.has(targetId));
        if (!conflict) {
          return;
        }

        if (constraint.mode === CONSTRAINT_MODE.HARD) {
          violations.push({
            constraint,
            groupId: group.id,
            message: `${anchor} và ${conflict} không được cùng bảng ${group.label || group.name}.`,
          });
        } else {
          score -= CONSTRAINT_SCORE.groupAvoidPenalty;
          violations.push({
            constraint,
            groupId: group.id,
            soft: true,
            message: `${anchor} và ${conflict} đang cùng bảng (phạt điểm).`,
          });
        }
      });
    });

  const hardViolations = violations.filter((item) => !item.soft);
  return { score, violations, hardViolations, ok: hardViolations.length === 0 };
}

export function pairSharesTeam(playerA, playerB, teams = []) {
  return teams.some((team) => {
    const ids = getTeamMemberIds(team);
    return ids.includes(String(playerA)) && ids.includes(String(playerB));
  });
}

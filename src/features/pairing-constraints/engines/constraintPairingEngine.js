import { CONSTRAINT_TYPE } from "../constants.js";
import {
  evaluatePartnerConstraintsForTeams,
  getTeamMemberIds,
  pairSharesTeam,
} from "./constraintEvaluator.js";

function cloneTeam(team) {
  return {
    ...team,
    members: [...(team.members || [])],
    playerIds: team.playerIds ? [...team.playerIds] : undefined,
  };
}

function swapMembersBetweenTeams(teams, teamIndexA, playerA, teamIndexB, playerB) {
  const next = teams.map(cloneTeam);
  const teamA = next[teamIndexA];
  const teamB = next[teamIndexB];
  if (!teamA?.members || !teamB?.members) {
    return null;
  }

  const slotA = teamA.members.findIndex((player) => String(player.id) === String(playerA));
  const slotB = teamB.members.findIndex((player) => String(player.id) === String(playerB));
  if (slotA < 0 || slotB < 0) {
    return null;
  }

  const temp = teamA.members[slotA];
  teamA.members[slotA] = teamB.members[slotB];
  teamB.members[slotB] = temp;

  teamA.id = getTeamMemberIds(teamA).sort().join("|");
  teamB.id = getTeamMemberIds(teamB).sort().join("|");
  teamA.name = teamA.members.map((player) => player.name).join(" / ");
  teamB.name = teamB.members.map((player) => player.name).join(" / ");

  return next;
}

function findTeamIndexByPlayer(teams, playerId) {
  return teams.findIndex((team) => getTeamMemberIds(team).includes(String(playerId)));
}

function applyPreferPartner(teams, constraint, playersById) {
  const anchor = String(constraint.anchorPlayerId);
  const anchorIndex = findTeamIndexByPlayer(teams, anchor);
  if (anchorIndex < 0) {
    return teams;
  }

  const anchorTeam = teams[anchorIndex];
  const anchorMembers = getTeamMemberIds(anchorTeam);
  const alreadyMatched = constraint.targetPlayerIds.some((targetId) =>
    anchorMembers.includes(String(targetId))
  );
  if (alreadyMatched) {
    return teams;
  }

  for (const targetId of constraint.targetPlayerIds) {
    const targetIndex = findTeamIndexByPlayer(teams, targetId);
    if (targetIndex < 0 || targetIndex === anchorIndex) {
      continue;
    }

    const swapped = swapMembersBetweenTeams(
      teams,
      anchorIndex,
      anchor,
      targetIndex,
      targetId
    );
    if (swapped) {
      const check = evaluatePartnerConstraintsForTeams(swapped, [constraint]);
      if (check.ok || constraint.mode === "soft") {
        return swapped;
      }
    }
  }

  return teams;
}

function fixAvoidPartner(teams, constraint) {
  const anchor = String(constraint.anchorPlayerId);
  const anchorIndex = findTeamIndexByPlayer(teams, anchor);
  if (anchorIndex < 0) {
    return teams;
  }

  let next = teams.map(cloneTeam);
  const conflicts = constraint.targetPlayerIds.filter((targetId) =>
    pairSharesTeam(anchor, targetId, next)
  );

  conflicts.forEach((targetId) => {
    const targetIndex = findTeamIndexByPlayer(next, targetId);
    if (targetIndex < 0 || targetIndex === anchorIndex) {
      return;
    }

    for (let donorIndex = 0; donorIndex < next.length; donorIndex += 1) {
      if (donorIndex === anchorIndex || donorIndex === targetIndex) {
        continue;
      }
      const donorMembers = next[donorIndex].members || [];
      for (const donorPlayer of donorMembers) {
        const candidate = swapMembersBetweenTeams(
          next,
          targetIndex,
          targetId,
          donorIndex,
          donorPlayer.id
        );
        if (!candidate) {
          continue;
        }
        const stillConflict = constraint.targetPlayerIds.some((id) =>
          pairSharesTeam(anchor, id, candidate)
        );
        if (!stillConflict) {
          next = candidate;
          return;
        }
      }
    }
  });

  return next;
}

export function optimizeTeamsWithConstraints(teams = [], constraints = [], options = {}) {
  const partnerConstraints = (constraints || []).filter(
    (item) =>
      item.type === CONSTRAINT_TYPE.PREFER_PARTNER ||
      item.type === CONSTRAINT_TYPE.AVOID_PARTNER
  );

  if (partnerConstraints.length === 0) {
    return {
      teams,
      evaluation: evaluatePartnerConstraintsForTeams(teams, partnerConstraints),
      warnings: [],
    };
  }

  let working = teams.map(cloneTeam);
  const playersById = options.playersById || new Map();

  partnerConstraints
    .filter((item) => item.type === CONSTRAINT_TYPE.AVOID_PARTNER)
    .forEach((constraint) => {
      working = fixAvoidPartner(working, constraint);
    });

  partnerConstraints
    .filter((item) => item.type === CONSTRAINT_TYPE.PREFER_PARTNER)
    .forEach((constraint) => {
      working = applyPreferPartner(working, constraint, playersById);
    });

  let evaluation = evaluatePartnerConstraintsForTeams(working, partnerConstraints);
  const warnings = evaluation.violations.map((item) => item.message);

  if (!evaluation.ok) {
    const maxAttempts = Number(options.maxAttempts) || 24;
    let best = working;
    let bestEval = evaluation;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (bestEval.ok) {
        break;
      }
      const indices = working
        .map((_, index) => index)
        .filter((index) => (working[index].members || []).length > 0);
      if (indices.length < 2) {
        break;
      }
      const teamA = indices[Math.floor(Math.random() * indices.length)];
      let teamB = indices[Math.floor(Math.random() * indices.length)];
      if (teamB === teamA) {
        teamB = indices[(indices.indexOf(teamA) + 1) % indices.length];
      }
      const membersA = working[teamA].members || [];
      const membersB = working[teamB].members || [];
      if (!membersA.length || !membersB.length) {
        continue;
      }
      const playerA = membersA[0];
      const playerB = membersB[0];
      const candidate = swapMembersBetweenTeams(working, teamA, playerA.id, teamB, playerB.id);
      if (!candidate) {
        continue;
      }
      const candidateEval = evaluatePartnerConstraintsForTeams(candidate, partnerConstraints);
      if (candidateEval.score > bestEval.score || (candidateEval.ok && !bestEval.ok)) {
        best = candidate;
        bestEval = candidateEval;
      }
    }

    working = best;
    evaluation = bestEval;
    if (!evaluation.ok) {
      warnings.push(
        ...evaluation.hardViolations.map((item) => item.message || "Vi phạm quy tắc ghép cặp.")
      );
    }
  }

  return { teams: working, evaluation, warnings: [...new Set(warnings)] };
}

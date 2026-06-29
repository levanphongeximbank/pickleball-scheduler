import { seedTeamsIntoGroups } from "../../../pages/tournament.seeding.logic.js";
import { entriesToTeams } from "../../../tournament/engines/teamPairingEngine.js";
import { getCourtDisplayName } from "../../../models/court.js";

export const ANIMATION_MODES = {
  RANDOM_DRAW: "random_draw",
  SNAKE_GROUP: "snake_group",
  PAIRING_REVEAL: "pairing_reveal",
  MATCH_REVEAL: "match_reveal",
  DAILY_FAIR_MATCH: "daily_fair_match",
  GROUP_MATCH_PAIRING: "group_match_pairing",
  BRACKET_REVEAL: "bracket_reveal",
  BRACKET_ADVANCE: "bracket_advance",
};

/** Thời gian mỗi bước (ms) — chỉnh ở đây để đổi nhịp hồi hộp */
export const ANIMATION_TIMING = {
  pairingStepMs: 1400,
  snakeSpinMs: 2600,
  snakeRevealMs: 900,
  snakeStepMs: 1100,
  drawStepMs: 3600,
  bracketMatchMs: 550,
  bracketRoundMs: 900,
  bracketAdvanceMs: 900,
};

function getSnakeGroupIndex(step, groupCount) {
  if (groupCount <= 1) {
    return 0;
  }

  const round = Math.floor(step / groupCount);
  const positionInRound = step % groupCount;

  if (round % 2 === 0) {
    return positionInRound;
  }

  return groupCount - 1 - positionInRound;
}

function entryIdsPerGroup(groups = []) {
  return groups.map((group) =>
    [...(group.entryIds || group.entries?.map((entry) => entry.id) || [])]
      .map(String)
      .sort()
  );
}

export function assertGroupsMatch(computedGroups, finalGroups) {
  const computed = entryIdsPerGroup(
    computedGroups.map((group, index) => ({
      entryIds: group.teams?.map((team) => team.id) || group.entryIds,
      label: group.group || group.label || String.fromCharCode(65 + index),
    }))
  );
  const final = entryIdsPerGroup(finalGroups);

  if (JSON.stringify(computed) !== JSON.stringify(final)) {
    console.warn("[tournament-animation] Group assignment preview may differ from engine output.");
  }
}

export function buildSnakeSteps({ entries = [], players = [], groupCount = 4, finalGroups = [] }) {
  const teams = entriesToTeams(entries, players).sort(
    (a, b) => Number(b.avgLevel || 0) - Number(a.avgLevel || 0)
  );
  const seeded = seedTeamsIntoGroups(teams, groupCount, { mode: "skill_controlled" });

  assertGroupsMatch(seeded, finalGroups);

  return teams.map((team, index) => {
    const groupIndex = getSnakeGroupIndex(index, groupCount);
    return {
      team: { id: team.id, name: team.name },
      groupLabel: seeded[groupIndex].group,
      groupIndex,
    };
  });
}

export function buildRandomDrawSteps(finalGroups = []) {
  return finalGroups.flatMap((group) =>
    (group.entries || []).map((entry) => ({
      team: { id: entry.id, name: entry.name },
      groupLabel: group.label,
      groupName: group.name,
    }))
  );
}

export function buildPairingSteps(entries = []) {
  return entries.map((entry, index) => {
    const parts = String(entry.name || "")
      .split(/\s*\/\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    const playerIds = (entry.playerIds || []).map((id) => String(id));

    return {
      index,
      pairing: { id: entry.id, name: entry.name },
      team: { id: entry.id, name: entry.name },
      left: {
        id: playerIds[0] || `${entry.id}-a`,
        name: parts[0] || entry.name,
        seed: entry.seed,
      },
      right: {
        id: playerIds[1] || (parts[1] ? `${entry.id}-b` : null),
        name: parts[1] || "—",
      },
      seed: entry.seed,
      playerIds,
    };
  });
}

export function buildPairingWaitingPlayers(entries = [], players = []) {
  const playersById = new Map(players.map((player) => [String(player.id), player]));
  const waiting = [];
  const seen = new Set();

  entries.forEach((entry) => {
    const nameParts = String(entry.name || "")
      .split(/\s*\/\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    const playerIds = (entry.playerIds || []).map((id) => String(id)).filter(Boolean);

    if (playerIds.length > 0) {
      playerIds.forEach((playerId, index) => {
        if (seen.has(playerId)) {
          return;
        }

        seen.add(playerId);
        const player = playersById.get(playerId);
        waiting.push({
          id: playerId,
          name: player?.name || nameParts[index] || entry.name,
          rating: player?.rating ?? player?.level ?? entry.rating,
          seed: entry.seed,
          entryId: entry.id,
        });
      });
      return;
    }

    if (nameParts.length === 0) {
      const fallbackId = String(entry.id);
      if (!seen.has(fallbackId)) {
        seen.add(fallbackId);
        waiting.push({
          id: fallbackId,
          name: entry.name || "—",
          rating: entry.rating,
          seed: entry.seed,
          entryId: entry.id,
        });
      }
      return;
    }

    nameParts.forEach((name, index) => {
      const playerId = `${entry.id}-${index}`;
      if (seen.has(playerId)) {
        return;
      }

      seen.add(playerId);
      waiting.push({
        id: playerId,
        name,
        rating: entry.rating,
        seed: index === 0 ? entry.seed : null,
        entryId: entry.id,
      });
    });
  });

  return waiting;
}

export function getRevealedPlayerIds(steps = [], placedCount = 0) {
  const revealed = new Set();

  steps.slice(0, placedCount).forEach((step) => {
    [step.left?.id, step.right?.id].forEach((playerId) => {
      if (playerId) {
        revealed.add(String(playerId));
      }
    });
  });

  return revealed;
}

function resolveMatchCourtLabel(match, courts = []) {
  if (!match?.courtId) {
    return null;
  }

  const courtIndex = courts.findIndex((court) => String(court.id) === String(match.courtId));
  if (courtIndex < 0) {
    return `Sân ${match.courtId}`;
  }

  return getCourtDisplayName(courts[courtIndex], courtIndex);
}

function sortGroupMatches(matches = []) {
  return [...matches].sort((left, right) => {
    const roundDiff = Number(left.round || 0) - Number(right.round || 0);
    if (roundDiff !== 0) {
      return roundDiff;
    }

    return String(left.id).localeCompare(String(right.id));
  });
}

export function buildGroupMatchPairingSteps({
  groups = [],
  matches = [],
  entries = [],
  courts = [],
} = {}) {
  const entryById = Object.fromEntries((entries || []).map((entry) => [String(entry.id), entry]));
  const sortedGroups = [...groups].sort((left, right) =>
    String(left.label || "").localeCompare(String(right.label || ""))
  );

  const steps = [];

  sortedGroups.forEach((group) => {
    const groupMatches = sortGroupMatches(
      group.matches?.length
        ? group.matches
        : (matches || []).filter((match) => String(match.groupId) === String(group.id))
    );

    groupMatches.forEach((match, indexInGroup) => {
      const entryA = entryById[String(match.entryAId)] || null;
      const entryB = entryById[String(match.entryBId)] || null;
      const courtLabel = resolveMatchCourtLabel(match, courts);

      steps.push({
        match,
        groupId: group.id,
        groupLabel: group.label,
        groupName: group.name || `Bảng ${group.label}`,
        matchNumber: indexInGroup + 1,
        matchLabel: `Trận ${String(indexInGroup + 1).padStart(2, "0")}`,
        left: {
          id: entryA?.id || match.entryAId,
          name: entryA?.name || "Đội A",
          seed: entryA?.seed,
        },
        right: {
          id: entryB?.id || match.entryBId,
          name: entryB?.name || "Đội B",
          seed: entryB?.seed,
        },
        courtLabel,
      });
    });
  });

  return steps;
}

export function getGroupMatchRanges(steps = []) {
  if (!steps.length) {
    return [];
  }

  const ranges = [];
  let start = 0;

  for (let index = 1; index <= steps.length; index += 1) {
    if (index === steps.length || steps[index].groupId !== steps[start].groupId) {
      ranges.push({
        groupId: steps[start].groupId,
        groupLabel: steps[start].groupLabel,
        groupName: steps[start].groupName,
        start,
        end: index,
        matchCount: index - start,
      });
      start = index;
    }
  }

  return ranges;
}

export function stripMatchesFromEvent(event = {}) {
  return {
    ...event,
    matches: [],
    groups: (event.groups || []).map((group) => ({
      ...group,
      matches: [],
    })),
  };
}

export function buildDailyMatchSteps(matches = []) {
  return matches.map((match, index) => ({
    index,
    pairing: { id: match.id, name: `${match.teamALabel || "Đội A"} vs ${match.teamBLabel || "Đội B"}` },
    team: { id: match.id, name: `${match.teamALabel || "Đội A"} vs ${match.teamBLabel || "Đội B"}` },
    left: { name: match.teamALabel || "Đội A" },
    right: { name: match.teamBLabel || "Đội B" },
    match,
  }));
}

export function buildBracketRevealSteps(bracketProgress) {
  return (bracketProgress?.rounds || []).map((round, roundIndex) => ({
    roundIndex,
    roundName: round.name,
    matches: round.matches,
  }));
}

export function shuffleVisualOrder(items = []) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  );
}

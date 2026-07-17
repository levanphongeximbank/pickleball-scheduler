import { buildRoundRobinRounds } from "../../../pages/tournament.fixtures.logic.js";
import { createSeededRng, seededShuffle } from "../core/seededRandom.js";
import { cloneMatchups, validateMatchupStructure } from "./matchupConstraints.js";

const ROUND_ROBIN_TEMPLATES = Object.freeze({
  3: [
    { roundNumber: 1, pairs: [[0, 1]] },
    { roundNumber: 2, pairs: [[1, 2]] },
    { roundNumber: 3, pairs: [[0, 2]] },
  ],
  4: [
    { roundNumber: 1, pairs: [[0, 1], [2, 3]] },
    { roundNumber: 2, pairs: [[0, 2], [1, 3]] },
    { roundNumber: 3, pairs: [[0, 3], [1, 2]] },
  ],
  5: [
    { roundNumber: 1, pairs: [[0, 1], [2, 3]] },
    { roundNumber: 2, pairs: [[0, 2], [1, 4]] },
    { roundNumber: 3, pairs: [[0, 3], [4, 2]] },
    { roundNumber: 4, pairs: [[1, 2], [3, 4]] },
    { roundNumber: 5, pairs: [[0, 4], [1, 3]] },
  ],
});

function buildRoundsForTeamCount(teamCount) {
  const count = Number(teamCount) || 0;
  if (count < 2) return [];
  if (ROUND_ROBIN_TEMPLATES[count]) {
    return ROUND_ROBIN_TEMPLATES[count].map((round) => ({
      roundNumber: round.roundNumber,
      pairs: round.pairs.map(([homeIndex, awayIndex]) => [homeIndex, awayIndex]),
    }));
  }
  const placeholderTeams = Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name: String(index),
    members: [],
  }));
  return buildRoundRobinRounds(placeholderTeams).map((round) => ({
    roundNumber: round.roundNumber,
    pairs: round.matches.map((match) => {
      const homeIndex = placeholderTeams.findIndex((team) => team.id === match.home?.id);
      const awayIndex = placeholderTeams.findIndex((team) => team.id === match.away?.id);
      return [homeIndex, awayIndex];
    }),
  }));
}

function buildFromRounds(teamIds, rounds, options = {}) {
  const ids = (teamIds || []).map(String);
  const matchups = [];
  rounds.forEach((round) => {
    round.pairs.forEach(([homeIndex, awayIndex], matchIndex) => {
      const teamAId = ids[homeIndex];
      const teamBId = ids[awayIndex];
      if (!teamAId || !teamBId) return;
      matchups.push({
        id: options.idPrefix
          ? `${options.idPrefix}-r${round.roundNumber}-m${matchIndex + 1}`
          : undefined,
        teamAId,
        teamBId,
        roundNumber: round.roundNumber,
        groupId: options.groupId || "",
        matchNumberInRound: matchIndex + 1,
      });
    });
  });
  return matchups;
}

function flipSides(matchups) {
  return cloneMatchups(matchups).map((matchup) => ({
    ...matchup,
    teamAId: matchup.teamBId,
    teamBId: matchup.teamAId,
  }));
}

function shuffleSides(matchups, rng) {
  return cloneMatchups(matchups).map((matchup) => {
    if (rng() < 0.5) {
      return { ...matchup, teamAId: matchup.teamBId, teamBId: matchup.teamAId };
    }
    return matchup;
  });
}

function permuteRoundOrder(matchups, rounds, teamIds, groupId, rng) {
  const roundNumbers = [...new Set(rounds.map((round) => round.roundNumber))];
  const permuted = seededShuffle(roundNumbers, rng);
  const roundMap = new Map(permuted.map((num, index) => [roundNumbers[index], index + 1]));
  return cloneMatchups(matchups).map((matchup) => ({
    ...matchup,
    roundNumber: roundMap.get(matchup.roundNumber) || matchup.roundNumber,
  }));
}

/**
 * Generate initial matchup candidates.
 */
export function generateMatchupInitialCandidates(input = {}) {
  const {
    matchups: currentMatchups = [],
    teamIds = [],
    groupId = "",
    allowRematch = false,
    randomSeed = 1,
    maxCandidates = 200,
  } = input;

  const rng = createSeededRng(randomSeed);
  const results = [];
  const push = (candidate) => {
    if (!candidate || results.length >= maxCandidates) return;
    const structural = validateMatchupStructure({
      matchups: candidate.matchups,
      allowRematch,
      baselineMatchups: currentMatchups,
      lockedMatchupIds: input.lockedMatchupIds,
    });
    if (structural.ok) {
      results.push(candidate);
    }
  };

  if (currentMatchups.length) {
    push({
      strategy: "current_plan",
      matchups: cloneMatchups(currentMatchups),
    });
    push({
      strategy: "current_flip_all",
      matchups: flipSides(currentMatchups),
    });
    push({
      strategy: "current_shuffle_sides",
      matchups: shuffleSides(currentMatchups, rng),
    });
  }

  const ids = teamIds.length
    ? teamIds.map(String)
    : [...new Set(currentMatchups.flatMap((m) => [m.teamAId, m.teamBId]))];

  if (ids.length >= 2) {
    const rounds = buildRoundsForTeamCount(ids.length);
    const templateMatchups = buildFromRounds(ids, rounds, {
      groupId,
      idPrefix: groupId || "tpl",
    });
    push({ strategy: "rr_template", matchups: templateMatchups });
    push({ strategy: "rr_template_flip", matchups: flipSides(templateMatchups) });

    for (let i = 0; i < Math.min(30, maxCandidates); i += 1) {
      const shuffledIds = seededShuffle(ids, rng);
      const shuffledRounds = buildFromRounds(shuffledIds, rounds, {
        groupId,
        idPrefix: `seed-${i}`,
      });
      push({
        strategy: `rr_perm_${i}`,
        matchups: shuffleSides(shuffledRounds, rng),
      });
    }

    if (currentMatchups.length && rounds.length) {
      push({
        strategy: "round_permute",
        matchups: permuteRoundOrder(currentMatchups, rounds, ids, groupId, rng),
      });
    }
  }

  const extra = Math.min(40, Math.max(0, maxCandidates - results.length));
  for (let i = 0; i < extra; i += 1) {
    if (!currentMatchups.length) break;
    push({
      strategy: `seeded_shuffle_${i}`,
      matchups: shuffleSides(currentMatchups, rng),
    });
  }

  return results.slice(0, maxCandidates);
}

export { buildRoundsForTeamCount, buildFromRounds };

import { createSeededRng, seededShuffle } from "./seededRng.js";
import { playerIdOf } from "./evaluateHardOnCandidate.js";

function playerRating(player) {
  return Number(player?.rating ?? player?.level ?? 3.5);
}

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

function pairSequential(players, teamSize = 2) {
  const teams = [];
  for (let i = 0; i + teamSize - 1 < players.length; i += teamSize) {
    const members = players.slice(i, i + teamSize);
    teams.push({
      id: members.map((p) => playerIdOf(p)).sort().join("|"),
      name: members.map((p) => p.name || playerIdOf(p)).join(" / "),
      members,
      playerIds: members.map((p) => playerIdOf(p)),
      avgLevel:
        Math.round(
          (members.reduce((sum, p) => sum + playerRating(p), 0) / members.length) * 100
        ) / 100,
    });
  }
  return teams;
}

function pairMixed(males, females) {
  const pairCount = Math.min(males.length, females.length);
  const teams = [];
  for (let index = 0; index < pairCount; index += 1) {
    const male = males[index];
    const female = females[pairCount - 1 - index];
    const members = [male, female];
    teams.push({
      id: members.map((p) => playerIdOf(p)).sort().join("|"),
      name: members.map((p) => p.name || playerIdOf(p)).join(" / "),
      members,
      playerIds: members.map((p) => playerIdOf(p)),
      avgLevel:
        Math.round(
          (members.reduce((sum, p) => sum + playerRating(p), 0) / members.length) * 100
        ) / 100,
    });
  }
  return teams;
}

/**
 * @param {Object} input
 * @returns {{ candidates: Array<{ id: string, teams: Array }>, iterations: number, truncated: boolean }}
 */
export function generateTeamPairingCandidates(input = {}) {
  const players = Array.isArray(input.players) ? [...input.players] : [];
  const teamSize = Number(input.teamSize ?? 2) || 2;
  const maxCandidates = Math.max(1, Number(input.maxCandidates ?? 64));
  const maxIterations = Math.max(maxCandidates, Number(input.maxIterations ?? 128));
  const rng = createSeededRng(input.seed ?? 1);
  const mixedDoubles = input.mixedDoubles === true;

  const sortPlayers = (list) =>
    [...list].sort((a, b) => {
      const ratingDiff = playerRating(b) - playerRating(a);
      if (ratingDiff !== 0) {
        return ratingDiff;
      }
      return String(playerIdOf(a)).localeCompare(String(playerIdOf(b)));
    });

  /** @type {Map<string, { id: string, teams: Array }>} */
  const unique = new Map();
  let iterations = 0;

  const pushTeams = (teams) => {
    const signature = teams
      .map((team) => [...(team.playerIds || [])].sort().join("+"))
      .sort()
      .join("||");
    if (!unique.has(signature)) {
      unique.set(signature, {
        id: `cand-${unique.size + 1}`,
        teams,
      });
    }
  };

  if (mixedDoubles) {
    const males = sortPlayers(players.filter((p) => normalizeGender(p.gender) === "male"));
    const females = sortPlayers(players.filter((p) => normalizeGender(p.gender) === "female"));
    pushTeams(pairMixed(males, females));

    while (unique.size < maxCandidates && iterations < maxIterations) {
      iterations += 1;
      pushTeams(pairMixed(seededShuffle(males, rng), seededShuffle(females, rng)));
    }
  } else {
    const sortedBase = sortPlayers(players);
    pushTeams(pairSequential(sortedBase, teamSize));

    while (unique.size < maxCandidates && iterations < maxIterations) {
      iterations += 1;
      pushTeams(pairSequential(seededShuffle(sortedBase, rng), teamSize));
    }
  }

  return {
    candidates: [...unique.values()],
    iterations,
    truncated: iterations >= maxIterations,
  };
}

export function createMatchCandidate(matchOption, id = "match-1") {
  return {
    id,
    matchOption: {
      teamA: [...(matchOption.teamA || [])],
      teamB: [...(matchOption.teamB || [])],
    },
    teams: [
      { members: matchOption.teamA || [], playerIds: (matchOption.teamA || []).map(playerIdOf) },
      { members: matchOption.teamB || [], playerIds: (matchOption.teamB || []).map(playerIdOf) },
    ],
  };
}

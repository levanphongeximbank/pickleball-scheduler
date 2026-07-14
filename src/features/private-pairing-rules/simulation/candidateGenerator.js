/**
 * PR-4.5 — candidate generation for simulation (team + match/Daily Play).
 * Reuses PR-3 generators; non-exhaustive, seeded, deduped.
 */

import {
  createMatchCandidate,
  generateTeamPairingCandidates,
} from "../runtime/generateTeamCandidates.js";
import { createSeededRng, seededShuffle } from "../runtime/seededRng.js";
import { playerIdOf } from "../runtime/evaluateHardOnCandidate.js";
import { canonicalizeCandidateKey } from "./candidateCanonicalizer.js";
import { SIMULATION_DEFAULTS } from "./simulationCodes.js";

function isMatchMode(input = {}) {
  const competitionType = String(input.competitionType || input.context?.competitionType || "")
    .toUpperCase();
  const eventType = String(input.eventType || input.context?.eventType || "").toUpperCase();
  if (input.options?.matchMode === true) return true;
  if (competitionType.includes("DAILY")) return true;
  if (eventType.includes("DAILY")) return true;
  return Boolean(input.courtCount && Number(input.courtCount) > 0);
}

function buildMatchFromFour(four, matchIndex) {
  const [a, b, c, d] = four;
  const matchOption = {
    teamA: [a, b],
    teamB: [c, d],
  };
  const base = createMatchCandidate(matchOption, `match-${matchIndex + 1}`);
  return {
    ...base,
    teamAIds: [playerIdOf(a), playerIdOf(b)].sort(),
    teamBIds: [playerIdOf(c), playerIdOf(d)].sort(),
  };
}

/**
 * Build simultaneous 2v2 matches + bench for Daily Play style pools.
 */
function generateMatchCandidates(input = {}) {
  const players = Array.isArray(input.players) ? [...input.players] : [];
  const maxCandidates = Math.max(1, Number(input.maxCandidates ?? SIMULATION_DEFAULTS.maxCandidates));
  const maxIterations = Math.max(
    maxCandidates,
    Number(input.maxIterations ?? SIMULATION_DEFAULTS.maxIterations)
  );
  const courtCount = Math.max(1, Number(input.courtCount ?? 1) || 1);
  const rng = createSeededRng(input.seed ?? 1);

  /** @type {Map<string, object>} */
  const unique = new Map();
  let iterations = 0;

  const push = (ordered) => {
    const matchSlots = Math.min(courtCount, Math.floor(ordered.length / 4));
    const matches = [];
    const used = [];
    for (let i = 0; i < matchSlots; i += 1) {
      const slice = ordered.slice(i * 4, i * 4 + 4);
      if (slice.length < 4) break;
      // Two deterministic partner pairings from the four, then sort teams lexicographically
      const rotated = i % 2 === 0 ? slice : [slice[0], slice[2], slice[1], slice[3]];
      matches.push(buildMatchFromFour(rotated, i));
      used.push(...slice.map(playerIdOf));
    }
    const usedSet = new Set(used);
    const benchPlayers = ordered.filter((p) => !usedSet.has(playerIdOf(p)));
    const allTeams = matches.flatMap((m) => m.teams);
    const first = matches[0] || null;
    const candidate = {
      id: `sim-${unique.size + 1}`,
      matches: matches.map((m) => ({
        teamA: m.matchOption.teamA,
        teamB: m.matchOption.teamB,
        teamAIds: m.teamAIds,
        teamBIds: m.teamBIds,
      })),
      teams: allTeams,
      benchPlayers,
      matchOption: first?.matchOption || null,
      playersAssigned: used.length,
    };
    const key = canonicalizeCandidateKey(candidate);
    if (!unique.has(key)) {
      unique.set(key, { ...candidate, deterministicKey: key });
    }
  };

  // Seeded baseline order by id for stability
  const base = [...players].sort((a, b) =>
    String(playerIdOf(a)).localeCompare(String(playerIdOf(b)))
  );
  push(base);

  while (unique.size < maxCandidates && iterations < maxIterations) {
    iterations += 1;
    push(seededShuffle(base, rng));
  }

  return {
    candidates: [...unique.values()],
    iterations,
    truncated: iterations >= maxIterations || unique.size >= maxCandidates,
    mode: "match",
  };
}

/**
 * Team-formation candidates (PR-3 generator) with canonical keys + bench leftover.
 */
function generateTeamCandidates(input = {}) {
  const teamSize = Number(input.teamSize ?? input.context?.teamSize ?? SIMULATION_DEFAULTS.teamSize) || 2;
  const generation = generateTeamPairingCandidates({
    players: input.players,
    teamSize,
    seed: input.seed ?? 1,
    maxCandidates: Math.min(
      Number(input.maxCandidates ?? SIMULATION_DEFAULTS.maxCandidates),
      500
    ),
    maxIterations: Math.min(
      Number(input.maxIterations ?? SIMULATION_DEFAULTS.maxIterations),
      5000
    ),
    mixedDoubles: input.mixedDoubles === true || input.options?.mixedDoubles === true,
  });

  const players = input.players || [];
  const mapped = generation.candidates.map((candidate, index) => {
    const assigned = new Set(
      (candidate.teams || []).flatMap((team) =>
        (team.playerIds || (team.members || []).map(playerIdOf)).map(String)
      )
    );
    const benchPlayers = players.filter((p) => !assigned.has(String(playerIdOf(p))));
    const withBench = {
      ...candidate,
      id: candidate.id || `team-${index + 1}`,
      matches: [],
      benchPlayers,
      matchOption: null,
    };
    return {
      ...withBench,
      deterministicKey: canonicalizeCandidateKey(withBench),
    };
  });

  // Dedupe by canonical key
  const unique = new Map();
  mapped.forEach((item) => {
    if (!unique.has(item.deterministicKey)) {
      unique.set(item.deterministicKey, item);
    }
  });

  return {
    candidates: [...unique.values()],
    iterations: generation.iterations,
    truncated: generation.truncated,
    mode: "team",
  };
}

/**
 * @param {object} input
 */
export function generateSimulationCandidates(input = {}) {
  if (isMatchMode(input)) {
    return generateMatchCandidates(input);
  }
  return generateTeamCandidates(input);
}

/*
==========================================================
AI Pairing Engine V2.1
Full Candidate Generator
==========================================================
*/

import { calculatePairScore } from "./scoring.js";
import { AI_CONFIG } from "./config.js";

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function flattenPlayers(courts) {
  return courts.flatMap((court) => court.players);
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

function splitGroupToTeams(group, options) {
  const teamSize = Number(options.teamSize) || 2;
  const playersPerCourt = Number(options.playersPerCourt) || 4;

  if (options.requiresMixedPairs && playersPerCourt === 4 && teamSize === 2) {
    const males = group.filter((player) => normalizeGender(player?.gender) === "male");
    const females = group.filter((player) => normalizeGender(player?.gender) === "female");

    if (males.length >= 2 && females.length >= 2) {
      return {
        teamA: [males[0], females[0]],
        teamB: [males[1], females[1]],
      };
    }
  }

  return {
    teamA: group.slice(0, teamSize),
    teamB: group.slice(teamSize, playersPerCourt),
  };
}

function createCandidate(courts, options = {}) {
  const players = shuffle(flattenPlayers(courts));
  const courtCount = courts.length;
  const playersPerCourt = Number(options.playersPerCourt) || 4;
  const candidate = [];

  for (let i = 0; i < courtCount; i++) {
    const group = players.slice(i * playersPerCourt, i * playersPerCourt + playersPerCourt);
    const teams = splitGroupToTeams(group, options);

    candidate.push({
      court: courts[i].id,
      teamA: teams.teamA,
      teamB: teams.teamB,
    });
  }

  return candidate;
}

function scoreCandidate(candidate, context) {
  let totalScore = 0;

  const scoredCourts = candidate.map((court) => {
    const score = calculatePairScore(
      {
        teamA: court.teamA,
        teamB: court.teamB,
      },
      context
    );

    totalScore += score.totalScore;

    return {
      court: court.court,
      teamA: court.teamA,
      teamB: court.teamB,
      teamATotal: score.teamATotal,
      teamBTotal: score.teamBTotal,
      diff: score.diff,
      score: score.totalScore,
      detailScore: score,
    };
  });

  return {
    courts: scoredCourts,
    totalScore,
  };
}

export function runPairingEngine(courts, context = {}, options = {}) {
  const requestedTop = Number(options.topCandidates);
  const topCandidates = Number.isFinite(requestedTop)
    ? Math.max(1, Math.min(AI_CONFIG.pairing.maxTopCandidates, Math.floor(requestedTop)))
    : AI_CONFIG.pairing.topCandidates;
  const candidates = [];

  for (let i = 0; i < AI_CONFIG.pairing.candidateCount; i += 1) {
    const candidate = createCandidate(courts, options);
    const scoredCandidate = scoreCandidate(candidate, context);

    candidates.push(scoredCandidate);
  }

  const sortedCandidates = candidates
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, topCandidates);

  return sortedCandidates.map((candidate) => ({
    options: candidate.courts,
    totalScore: candidate.totalScore,
  }));
}
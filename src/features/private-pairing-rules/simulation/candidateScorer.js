/**
 * PR-4.5 — hard reject + soft/balance/fairness/diversity scoring.
 * Soft never rescues hard violations. Reuses PR-3 evaluators.
 */

import { evaluatePrivatePairingCandidate } from "../runtime/runPrivatePairingRuntime.js";
import { playerIdOf } from "../runtime/evaluateHardOnCandidate.js";
import { PRIVATE_PAIRING_CONSTRAINT_TYPE } from "../constants/constraintTypes.js";
import { SIMULATION_CODE } from "./simulationCodes.js";

function finiteScore(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n === Number.POSITIVE_INFINITY || n === Number.NEGATIVE_INFINITY) return fallback;
  return n;
}

/**
 * Diversity: reward unseen partner pairs / opponent pairs; reduce repeats.
 */
export function computeDiversityScore(candidate, history = {}) {
  const partnerRepeats = history.partnerRepeatCounts || {};
  const opponentRepeats = history.opponentRepeatCounts || {};
  let score = 50;
  const teams = candidate.teams || [];

  teams.forEach((team) => {
    const ids = (team.playerIds || (team.members || []).map(playerIdOf)).map(String).sort();
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i];
        const b = ids[j];
        const repeats = partnerRepeats[a]?.[b] ?? partnerRepeats[b]?.[a] ?? 0;
        score += repeats === 0 ? 8 : -Math.min(20, repeats * 6);
      }
    }
  });

  (candidate.matches || []).forEach((match) => {
    const aIds = (match.teamAIds || (match.teamA || []).map(playerIdOf)).map(String);
    const bIds = (match.teamBIds || (match.teamB || []).map(playerIdOf)).map(String);
    aIds.forEach((a) => {
      bIds.forEach((b) => {
        const repeats = opponentRepeats[a]?.[b] ?? opponentRepeats[b]?.[a] ?? 0;
        score += repeats === 0 ? 4 : -Math.min(12, repeats * 4);
      });
    });
  });

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Fairness augmentation using wait / bench / matchesPlayed metadata.
 */
export function computeSimulationFairnessScore(candidate, baseFairness, playersById = {}) {
  let score = finiteScore(baseFairness, 50);
  const playing = new Set(
    (candidate.teams || []).flatMap((team) =>
      (team.playerIds || (team.members || []).map(playerIdOf)).map(String)
    )
  );
  const benchIds = (candidate.benchPlayers || []).map(playerIdOf).map(String);

  playing.forEach((id) => {
    const p = playersById[id] || {};
    score += Math.min(15, Number(p.waitMinutes || 0) * 0.5);
    score += Math.min(10, Number(p.benchCount || 0) * 2);
    score -= Math.min(10, Number(p.matchesPlayed || 0));
  });

  benchIds.forEach((id) => {
    const p = playersById[id] || {};
    // Penalize parking high-wait players on bench
    score -= Math.min(20, Number(p.waitMinutes || 0) * 0.8);
    score -= Math.min(12, Number(p.benchCount || 0) * 3);
  });

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Detect missing ratings without inventing silent defaults for confidence.
 */
export function collectMissingRatingWarnings(players = []) {
  const warnings = [];
  players.forEach((player) => {
    if (player.rating === null || player.rating === undefined || !Number.isFinite(Number(player.rating))) {
      warnings.push({
        code: SIMULATION_CODE.MISSING_PLAYER_RATING,
        meta: { playerId: player.playerId || player.id },
      });
    }
  });
  return warnings;
}

/**
 * Score one candidate. Returns infeasible hard rejects without soft ranking rescue.
 */
export function scoreSimulationCandidate(candidate, options = {}) {
  const playersById =
    options.playersById ||
    Object.fromEntries((options.players || []).map((p) => [String(p.playerId || p.id), p]));

  const scored = evaluatePrivatePairingCandidate(candidate, {
    resolved: options.resolved,
    rules: options.rules,
    legacyConstraints: options.legacyConstraints,
    context: {
      ...(options.context || {}),
      playersById,
      teamSize: options.context?.teamSize ?? 2,
    },
    history: options.history || {},
  });

  if (!scored.feasible) {
    return {
      ...scored,
      diversityScore: 0,
      fairnessScore: 0,
      balanceScore: 0,
      historyScore: 0,
      constraintScore: 0,
      finalScore: Number.NEGATIVE_INFINITY,
      hardConstraintResult: {
        feasible: false,
        violations: scored.violations || [],
        codes: scored.rejectionCodes || [],
      },
      softConstraintResult: {
        constraintScore: 0,
        softConstraintsSatisfied: [],
        softConstraintsMissed: [],
      },
      scores: {
        balanceScore: 0,
        fairnessScore: 0,
        historyScore: 0,
        constraintScore: 0,
        diversityScore: 0,
        finalScore: Number.NEGATIVE_INFINITY,
      },
    };
  }

  const diversityScore = computeDiversityScore(candidate, options.history || {});
  const fairnessScore = computeSimulationFairnessScore(
    candidate,
    scored.fairnessScore,
    playersById
  );
  const balanceScore = finiteScore(scored.balanceScore, 0);
  const historyScore = finiteScore(scored.historyScore, 0);
  const constraintScore = finiteScore(scored.constraintScore, 0);

  // Ranking weights: hard already passed; soft cannot override hard.
  const finalScore =
    fairnessScore * 100000 +
    balanceScore * 1000 +
    diversityScore * 100 +
    historyScore * 10 +
    constraintScore;

  return {
    ...scored,
    feasible: true,
    diversityScore,
    fairnessScore,
    balanceScore,
    historyScore,
    constraintScore,
    finalScore: finiteScore(finalScore, 0),
    hardConstraintResult: {
      feasible: true,
      violations: [],
      codes: [],
    },
    softConstraintResult: {
      constraintScore,
      softConstraintsSatisfied: scored.softConstraintsSatisfied,
      softConstraintsMissed: scored.softConstraintsMissed,
    },
    scores: {
      balanceScore,
      fairnessScore,
      historyScore,
      constraintScore,
      diversityScore,
      finalScore: finiteScore(finalScore, 0),
    },
  };
}

export function compareScoredCandidates(a, b) {
  if (a.finalScore !== b.finalScore) return b.finalScore - a.finalScore;
  if (a.balanceScore !== b.balanceScore) return b.balanceScore - a.balanceScore;
  if (a.fairnessScore !== b.fairnessScore) return b.fairnessScore - a.fairnessScore;
  if (a.diversityScore !== b.diversityScore) return b.diversityScore - a.diversityScore;
  if (a.constraintScore !== b.constraintScore) return b.constraintScore - a.constraintScore;
  return String(a.deterministicKey || a.id).localeCompare(String(b.deterministicKey || b.id));
}

export function softTypeToExplanationCode(constraintType) {
  switch (constraintType) {
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER:
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM:
      return "PREFER_PARTNER_SATISFIED";
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER:
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_TEAM:
      return "AVOID_PARTNER_SATISFIED";
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT:
      return "PREFER_OPPONENT_SATISFIED";
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT:
      return "AVOID_OPPONENT_SATISFIED";
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP:
      return "SAME_GROUP_SATISFIED";
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP:
      return "DIFFERENT_GROUP_SATISFIED";
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT:
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT:
      return "REPEAT_PARTNER_REDUCED";
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT:
    case PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT:
      return "REPEAT_OPPONENT_REDUCED";
    default:
      return null;
  }
}

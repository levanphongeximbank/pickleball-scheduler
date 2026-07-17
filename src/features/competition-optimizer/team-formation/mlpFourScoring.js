import {
  genderOf,
  playerRating,
  MLP4_MALES,
  MLP4_FEMALES,
} from "./mlpFourConstraints.js";

function mean(values = []) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values = []) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((s, v) => s + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}

function rangeOf(values = []) {
  if (!values.length) return 0;
  return Math.max(...values) - Math.min(...values);
}

function teamMembers(team, playersById) {
  if (Array.isArray(team.members) && team.members.length) {
    return team.members;
  }
  return (team.playerIds || [])
    .map((id) => playersById[String(id)])
    .filter(Boolean);
}

/**
 * Compute MLP4 balance diagnostics used for defaultPenalty.
 */
export function computeMlpFourBalanceMetrics(teams = [], playersById = {}) {
  const teamAvgs = [];
  const maleAvgs = [];
  const femaleAvgs = [];
  const maleGaps = [];
  const femaleGaps = [];
  const genderStrengthGaps = [];
  const bestMixedGaps = [];

  for (const team of teams) {
    const members = teamMembers(team, playersById);
    const males = members.filter((p) => genderOf(p) === "male");
    const females = members.filter((p) => genderOf(p) === "female");
    const ratings = members.map(playerRating);
    const maleRatings = males.map(playerRating);
    const femaleRatings = females.map(playerRating);

    const teamAvg = mean(ratings);
    const maleAvg = mean(maleRatings);
    const femaleAvg = mean(femaleRatings);
    teamAvgs.push(teamAvg);
    maleAvgs.push(maleAvg);
    femaleAvgs.push(femaleAvg);
    maleGaps.push(rangeOf(maleRatings));
    femaleGaps.push(rangeOf(femaleRatings));
    genderStrengthGaps.push(Math.abs(maleAvg - femaleAvg));

    // Best mixed pair gap: strongest male+female vs weakest male+female
    if (males.length === MLP4_MALES && females.length === MLP4_FEMALES) {
      const mixed = [];
      for (const m of males) {
        for (const f of females) {
          mixed.push(playerRating(m) + playerRating(f));
        }
      }
      bestMixedGaps.push(rangeOf(mixed));
    } else {
      bestMixedGaps.push(0);
    }
  }

  return {
    teamAverage: mean(teamAvgs),
    teamAverageRange: rangeOf(teamAvgs),
    teamAverageStdDev: stdDev(teamAvgs),
    maleAverage: mean(maleAvgs),
    femaleAverage: mean(femaleAvgs),
    maleAverageStdDev: stdDev(maleAvgs),
    femaleAverageStdDev: stdDev(femaleAvgs),
    maleGapMean: mean(maleGaps),
    femaleGapMean: mean(femaleGaps),
    genderStrengthGapMean: mean(genderStrengthGaps),
    bestMixedGapMean: mean(bestMixedGaps),
    maleAverageRange: rangeOf(maleAvgs),
    femaleAverageRange: rangeOf(femaleAvgs),
  };
}

/**
 * Map balance metrics (+ optional history) into a single defaultPenalty.
 * Private-pairing authority soft penalties remain separate lexicographic keys.
 */
export function computeMlpFourDefaultPenalty(metrics = {}, historyPenalty = 0) {
  const penalty =
    metrics.teamAverageRange * 120 +
    metrics.teamAverageStdDev * 80 +
    metrics.maleAverageStdDev * 40 +
    metrics.femaleAverageStdDev * 40 +
    metrics.maleGapMean * 25 +
    metrics.femaleGapMean * 25 +
    metrics.genderStrengthGapMean * 35 +
    metrics.bestMixedGapMean * 30 +
    metrics.maleAverageRange * 20 +
    metrics.femaleAverageRange * 20 +
    Number(historyPenalty) * 10;

  return Math.max(0, Math.round(penalty * 100) / 100);
}

/**
 * Lightweight teammate-history penalty (repeat pairs across teams).
 * @param {Array} teams
 * @param {object} pairingHistory — { partnerCounts?: Record<string, number> } or Map-like
 */
export function computeTeammateHistoryPenalty(teams = [], pairingHistory = null) {
  if (!pairingHistory) return 0;
  const partnerCounts =
    pairingHistory.partnerCounts ||
    pairingHistory.pairCounts ||
    pairingHistory;
  if (!partnerCounts || typeof partnerCounts !== "object") return 0;

  let penalty = 0;
  for (const team of teams) {
    const ids = [...(team.playerIds || [])].map(String).sort();
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = `${ids[i]}|${ids[j]}`;
        const alt = `${ids[j]}|${ids[i]}`;
        const count = Number(partnerCounts[key] ?? partnerCounts[alt] ?? 0) || 0;
        if (count > 0) penalty += count;
      }
    }
  }
  return penalty;
}

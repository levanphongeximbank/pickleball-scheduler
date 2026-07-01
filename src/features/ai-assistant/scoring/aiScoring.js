export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function average(values = []) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeBalanceScore(groupAvgs = []) {
  if (groupAvgs.length < 2) {
    return 100;
  }
  const mean = average(groupAvgs);
  const maxDev = Math.max(...groupAvgs.map((v) => Math.abs(v - mean)));
  const relativeDev = mean > 0 ? maxDev / mean : maxDev / 100;
  return clamp(Math.round(100 - relativeDev * 200));
}

export function computeFairnessScore(teamScores = []) {
  if (teamScores.length < 2) {
    return 100;
  }
  const mean = average(teamScores);
  const variance =
    teamScores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / teamScores.length;
  const stdDev = Math.sqrt(variance);
  const relative = mean > 0 ? stdDev / mean : stdDev;
  return clamp(Math.round(100 - relative * 150));
}

export function confidenceFromDataCoverage({ total, withElo, withHistory }) {
  if (total === 0) {
    return "low";
  }
  const eloRatio = withElo / total;
  const historyRatio = withHistory / total;
  const score = eloRatio * 0.6 + historyRatio * 0.4;
  if (score >= 0.75) {
    return "high";
  }
  if (score >= 0.4) {
    return "medium";
  }
  return "low";
}

export function computeOverallAiScore({
  balanceScore = 70,
  fairnessScore = 70,
  timeRisk = 0,
  scheduleRisk = 0,
  dataConfidence = "medium",
} = {}) {
  const confidenceBonus = { high: 10, medium: 0, low: -10 }[dataConfidence] ?? 0;
  const base = balanceScore * 0.35 + fairnessScore * 0.35;
  const riskPenalty = timeRisk * 0.15 + scheduleRisk * 0.15;
  return clamp(Math.round(base + confidenceBonus - riskPenalty));
}

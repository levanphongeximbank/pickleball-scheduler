/**
 * Default soft scoring for matchup pairing (lower is better).
 */

function pairKey(teamAId, teamBId) {
  return [String(teamAId), String(teamBId)].sort().join("-");
}

function teamStrength(teamId, teamsById = {}) {
  const team =
    teamsById instanceof Map
      ? teamsById.get(String(teamId))
      : teamsById[String(teamId)];
  if (!team) return 3.5;
  if (Number(team.avgLevel) > 0) return Number(team.avgLevel);
  const ratings = (team.playerIds || [])
    .map((id) => {
      const player = team.playersById?.[id];
      return Number(player?.ratingInternal ?? player?.rating ?? 3.5) || 3.5;
    })
    .filter((value) => value > 0);
  if (!ratings.length) return 3.5;
  return ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
}

/**
 * @param {Array} matchups
 * @param {Map|Record} teamsById
 * @param {object} [options]
 */
export function computeMatchupDefaultPenalty(matchups = [], teamsById = {}, options = {}) {
  const rows = matchups || [];
  const pairCounts = new Map();
  let homeAwayImbalance = 0;
  let strengthGapSum = 0;

  for (const matchup of rows) {
    const key = pairKey(matchup.teamAId, matchup.teamBId);
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);

    const strengthA = teamStrength(matchup.teamAId, teamsById);
    const strengthB = teamStrength(matchup.teamBId, teamsById);
    strengthGapSum += Math.abs(strengthA - strengthB);

    const homeBias = options.homeTeamIds?.has
      ? options.homeTeamIds.has(String(matchup.teamAId))
        ? 1
        : options.homeTeamIds.has(String(matchup.teamBId))
          ? -1
          : 0
      : 0;
    homeAwayImbalance += Math.abs(homeBias);
  }

  const rematchPenalty = [...pairCounts.values()].reduce(
    (sum, count) => sum + Math.max(0, count - 1) * 120,
    0
  );

  const strengthBalancePenalty = (strengthGapSum / Math.max(1, rows.length)) * 18;
  const homeAwayPenalty = homeAwayImbalance * 6;

  return rematchPenalty + strengthBalancePenalty + homeAwayPenalty;
}

export function computeMatchupFairnessMetrics(matchups = []) {
  const pairCounts = new Map();
  for (const matchup of matchups || []) {
    const key = pairKey(matchup.teamAId, matchup.teamBId);
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  const counts = [...pairCounts.values()];
  return {
    rematchCount: counts.reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    uniquePairs: pairCounts.size,
    matchupCount: (matchups || []).length,
  };
}

/** Shared normalization for TT-7 oracle deep-compare (no production engine imports). */

export const STANDING_COMPARE_FIELDS = [
  "rank",
  "teamId",
  "played",
  "wins",
  "losses",
  "rankingPoints",
  "subMatchWins",
  "subMatchLosses",
  "subMatchDiff",
  "pointsScored",
  "pointsConceded",
  "pointDifference",
  "forfeitWins",
  "forfeitLosses",
  "withdrawn",
];

export function normalizeStandingRow(row) {
  return {
    rank: row.rank,
    teamId: row.teamId,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    rankingPoints: row.rankingPoints,
    subMatchWins: row.subMatchWins,
    subMatchLosses: row.subMatchLosses,
    subMatchDiff: row.subMatchDiff,
    pointsScored: row.pointsScored,
    pointsConceded: row.pointsConceded,
    pointDifference: row.pointDifference ?? row.pointDiff ?? 0,
    forfeitWins: row.forfeitWins ?? 0,
    forfeitLosses: row.forfeitLosses ?? 0,
    withdrawn: Boolean(row.withdrawn),
  };
}

export function normalizeStandingsBlock(block) {
  const standings = (block.standings || []).map(normalizeStandingRow);
  standings.sort((a, b) => a.rank - b.rank);
  return {
    fixtureId: block.fixtureId,
    tiebreakOrder: block.tiebreakOrder || [],
    standings,
    summary: block.summary
      ? {
          teamCount: block.summary.teamCount,
          matchupCount: block.summary.matchupCount,
          completedMatchups: block.summary.completedMatchups,
          incompleteMatchups: block.summary.incompleteMatchups,
          withdrawnTeams: [...(block.summary.withdrawnTeams || [])].sort(),
        }
      : undefined,
  };
}

export function normalizeExpectedFile(expectedFile) {
  return {
    fixtureId: expectedFile.fixtureId,
    default: normalizeStandingsBlock(expectedFile.default),
    profiles: Object.fromEntries(
      Object.entries(expectedFile.profiles || {}).map(([key, value]) => [
        key,
        normalizeStandingsBlock(value),
      ])
    ),
  };
}

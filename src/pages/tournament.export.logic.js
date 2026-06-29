function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toTeamSnapshot(team) {
  if (!team) {
    return null;
  }

  return {
    id: team.id,
    name: team.name,
  };
}

function toMatchSnapshot(match) {
  return {
    id: match.id,
    homeSeed: match.homeSeed || null,
    awaySeed: match.awaySeed || null,
    home: toTeamSnapshot(match.home),
    away: toTeamSnapshot(match.away),
    winnerSide: match.winnerSide || null,
    winner: toTeamSnapshot(match.winner),
    completed: Boolean(match.completed),
  };
}

export function buildTournamentResultExport(input = {}) {
  const rounds = safeArray(input.rounds);
  const sessions = safeArray(input.sessions);
  const groupStandings = safeArray(input.groupStandings);
  const knockoutProgress = input.knockoutProgress || {
    rounds: [],
    champion: null,
    completedRounds: 0,
    totalRounds: 0,
  };
  const bracketWinners =
    input.bracketWinners && typeof input.bracketWinners === "object"
      ? input.bracketWinners
      : {};
  const bracketUnlockedRounds =
    input.bracketUnlockedRounds && typeof input.bracketUnlockedRounds === "object"
      ? input.bracketUnlockedRounds
      : {};

  const completedSessions = sessions.filter((session) => session?.result?.status === "completed");

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    overview: {
      totalRounds: rounds.length,
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      totalGroups: groupStandings.length,
      knockoutCompletedRounds: Number(knockoutProgress.completedRounds || 0),
      knockoutTotalRounds: Number(knockoutProgress.totalRounds || 0),
      champion: toTeamSnapshot(knockoutProgress.champion),
    },
    rounds: rounds.map((round) => ({
      id: round.id,
      name: round.name,
      groupLabel: round.groupLabel || null,
      defaultShift: round.defaultShift || null,
      seededTeams: safeArray(round.seededTeams).map((team) => ({
        id: team.id,
        name: team.name,
      })),
    })),
    groupStandings: groupStandings.map((group) => ({
      group: group.group,
      roundId: group.roundId,
      roundName: group.roundName,
      matchCount: group.matchCount,
      standing: safeArray(group.standing).map((team, index) => ({
        rank: index + 1,
        id: team.id,
        name: team.name,
        played: team.played,
        won: team.won,
        draw: team.draw,
        lost: team.lost,
        pointsFor: team.pointsFor,
        pointsAgainst: team.pointsAgainst,
        scoreDiff: team.scoreDiff,
        matchPoints: team.matchPoints,
      })),
      qualified: safeArray(group.qualified).map((team) => ({
        id: team.id,
        name: team.name,
      })),
    })),
    knockout: {
      completedRounds: Number(knockoutProgress.completedRounds || 0),
      totalRounds: Number(knockoutProgress.totalRounds || 0),
      champion: toTeamSnapshot(knockoutProgress.champion),
      rounds: safeArray(knockoutProgress.rounds).map((round) => ({
        name: round.name,
        completed: Boolean(round.completed),
        matches: safeArray(round.matches).map(toMatchSnapshot),
      })),
    },
    bracketState: {
      winnersByMatch: bracketWinners,
      unlockedRounds: bracketUnlockedRounds,
    },
  };
}

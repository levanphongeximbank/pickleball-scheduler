export function buildDashboardSummary({
  sessions = [],
  players = [],
  courts = [],
  rounds = [],
  seasonId = null,
  leagueId = null,
}) {
  const filteredSessions = sessions.filter((session) => {
    if (seasonId && session.meta?.seasonId && session.meta.seasonId !== seasonId) {
      return false;
    }

    if (leagueId && session.meta?.leagueId && session.meta.leagueId !== leagueId) {
      return false;
    }

    return true;
  });

  const filteredRounds = leagueId
    ? rounds.filter((round) => !round.leagueId || round.leagueId === leagueId)
    : rounds;

  const activeCourts = courts.filter((court) => court.active !== false);
  const sortedSessions = [...filteredSessions].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );
  const recentSessions = sortedSessions.slice(0, 5);

  const avgAiScore =
    filteredSessions.length > 0
      ? Math.round(
          filteredSessions.reduce((sum, session) => sum + Number(session.aiScore?.total || 0), 0) /
            filteredSessions.length
        )
      : 0;

  const completedResults = filteredSessions.filter(
    (session) => session.result?.status === "completed"
  ).length;

  const gameCountByPlayer = {};

  filteredSessions.forEach((session) => {
    (session.courts || []).forEach((court) => {
      [...(court.teamA || []), ...(court.teamB || [])].forEach((player) => {
        if (!player?.id) {
          return;
        }

        gameCountByPlayer[player.id] = (gameCountByPlayer[player.id] || 0) + 1;
      });
    });
  });

  const topPlayers = players
    .map((player) => ({
      id: player.id,
      name: player.name,
      level: player.level,
      games: gameCountByPlayer[player.id] || 0,
    }))
    .sort((left, right) => {
      if (right.games !== left.games) {
        return right.games - left.games;
      }

      return String(left.name || "").localeCompare(String(right.name || ""), "vi");
    })
    .slice(0, 5);

  const lastSession = recentSessions[0] || null;

  return {
    totals: {
      players: players.length,
      courts: courts.length,
      activeCourts: activeCourts.length,
      sessions: filteredSessions.length,
      rounds: filteredRounds.length,
      completedResults,
      avgAiScore,
    },
    recentSessions: recentSessions.map((session) => ({
      id: session.id,
      date: session.date,
      courtCount: session.courts?.length || 0,
      waitingCount: session.waiting?.length || 0,
      aiScore: Number(session.aiScore?.total || 0),
      roundName: session.meta?.roundName || null,
      shiftLabel: session.meta?.shiftLabel || null,
      resultStatus: session.result?.status || "pending",
    })),
    topPlayers,
    lastSession,
  };
}

export function parseTournamentRounds(raw) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

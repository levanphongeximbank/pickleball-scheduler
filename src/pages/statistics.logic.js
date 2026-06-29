export function filterSessionsByContext(sessions = [], { seasonId = null, leagueId = null } = {}) {
  return sessions.filter((session) => {
    if (seasonId && session.meta?.seasonId && session.meta.seasonId !== seasonId) {
      return false;
    }

    if (leagueId && session.meta?.leagueId && session.meta.leagueId !== leagueId) {
      return false;
    }

    return true;
  });
}

export function filterRoundsByLeague(rounds = [], leagueId = null) {
  if (!leagueId) {
    return rounds;
  }

  return rounds.filter((round) => !round.leagueId || round.leagueId === leagueId);
}

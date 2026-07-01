export const CLUB_MATCH_TYPES = Object.freeze({
  FRIENDLY: "friendly",
  INTERNAL_TOURNAMENT: "internal_tournament",
});

export function normalizeClubMatch(match) {
  const type = Object.values(CLUB_MATCH_TYPES).includes(match?.type)
    ? match.type
    : CLUB_MATCH_TYPES.FRIENDLY;

  return {
    id: String(match?.id || `cmatch-${Date.now()}`),
    tenantId: String(match?.tenantId || "").trim(),
    clubId: String(match?.clubId || "").trim(),
    tournamentId: match?.tournamentId ? String(match.tournamentId) : null,
    matchId: match?.matchId ? String(match.matchId) : null,
    type,
    playedAt: match?.playedAt || new Date().toISOString(),
    teamAPlayerIds: Array.isArray(match?.teamAPlayerIds)
      ? match.teamAPlayerIds.map(String)
      : [],
    teamBPlayerIds: Array.isArray(match?.teamBPlayerIds)
      ? match.teamBPlayerIds.map(String)
      : [],
    teamAScore: match?.teamAScore != null ? Number(match.teamAScore) : null,
    teamBScore: match?.teamBScore != null ? Number(match.teamBScore) : null,
    winnerTeam: match?.winnerTeam === "A" || match?.winnerTeam === "B" ? match.winnerTeam : null,
    eloApplied: Boolean(match?.eloApplied),
    createdAt: match?.createdAt || new Date().toISOString(),
    updatedAt: match?.updatedAt || new Date().toISOString(),
  };
}

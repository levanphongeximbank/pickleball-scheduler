import { buildLeagueStandingsRows } from "./seasonStandingsEngine.js";

export const SEASON_EXPORT_SCHEMA_VERSION = 1;

const MODE_LABELS = {
  daily_play: "Daily",
  internal_tournament: "Noi bo",
  official_tournament: "Chinh thuc",
};

const COMPLETED_MATCH_STATUSES = new Set(["completed", "forfeit", "forfeited", "finished", "closed"]);
const ACTIVE_MATCH_STATUSES = new Set(["playing", "in_progress", "in progress", "live", "active"]);

function normalizeMatchStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (COMPLETED_MATCH_STATUSES.has(normalized)) {
    return "completed";
  }

  if (ACTIVE_MATCH_STATUSES.has(normalized)) {
    return "active";
  }

  return "pending";
}

export function summarizeTournamentForExport(tournament) {
  if (!tournament) {
    return null;
  }

  const matches = tournament.matches || [];
  const completed = matches.filter((match) => normalizeMatchStatus(match.status) === "completed").length;
  const active = matches.filter((match) => normalizeMatchStatus(match.status) === "active").length;
  const total = matches.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    id: tournament.id,
    name: tournament.name,
    mode: tournament.mode,
    modeLabel: MODE_LABELS[tournament.mode] || tournament.mode,
    status: tournament.status,
    seasonId: tournament.seasonId || null,
    leagueId: tournament.leagueId || null,
    roundId: tournament.roundId || null,
    entryCount: (tournament.entries || []).length,
    matchCount: total,
    completedMatchCount: completed,
    activeMatchCount: active,
    progressPercent,
    createdAt: tournament.createdAt || null,
    updatedAt: tournament.updatedAt || null,
  };
}

export function summarizeRoundForExport(round, tournaments = []) {
  const ids = new Set((round.tournamentIds || []).map(String));

  return {
    id: round.id,
    name: round.name,
    seasonId: round.seasonId || null,
    leagueId: round.leagueId || null,
    status: round.status || "active",
    tournamentIds: [...ids],
    tournaments: tournaments
      .filter((tournament) => ids.has(String(tournament.id)))
      .map(summarizeTournamentForExport)
      .filter(Boolean),
  };
}

export function buildLeagueExportSection(
  league,
  { standingsRows = [], rounds = [], tournaments = [] } = {}
) {
  const tournamentSummaries = tournaments.map(summarizeTournamentForExport).filter(Boolean);
  const matchCount = tournamentSummaries.reduce((sum, item) => sum + (item.matchCount || 0), 0);
  const completedMatchCount = tournamentSummaries.reduce(
    (sum, item) => sum + (item.completedMatchCount || 0),
    0
  );
  const activeMatchCount = tournamentSummaries.reduce((sum, item) => sum + (item.activeMatchCount || 0), 0);
  const progressPercent = matchCount > 0 ? Math.round((completedMatchCount / matchCount) * 100) : 0;

  return {
    league: {
      id: league.id,
      name: league.name,
      format: league.format,
      competitionType: league.competitionType,
      status: league.status,
      pointsSystem: league.pointsSystem,
    },
    standings: standingsRows.map((row, index) => ({
      rank: index + 1,
      ...row,
    })),
    rounds: rounds.map((round) => summarizeRoundForExport(round, tournaments)),
    tournaments: tournamentSummaries,
    summary: {
      tournamentCount: tournamentSummaries.length,
      roundCount: rounds.length,
      matchCount,
      completedMatchCount,
      activeMatchCount,
      progressPercent,
    },
  };
}

export function buildSeasonExportPackage({
  clubId,
  clubName = "",
  season,
  leagues = [],
  rounds = [],
  tournaments = [],
  seasonStandings = {},
  players = [],
}) {
  if (!season) {
    return null;
  }

  const leagueSections = leagues.map((league) => {
    const leagueId = league.id;
    const leagueRounds = rounds.filter((round) => round.leagueId === leagueId);
    const leagueTournaments = tournaments.filter((tournament) => tournament.leagueId === leagueId);
    const standings = seasonStandings[leagueId];
    const standingsRows = standings ? buildLeagueStandingsRows(standings, players) : [];

    return buildLeagueExportSection(league, {
      standingsRows,
      rounds: leagueRounds,
      tournaments: leagueTournaments,
    });
  });

  const leagueIds = new Set(leagues.map((league) => league.id));
  const summarizedTournaments = (tournaments || []).map(summarizeTournamentForExport).filter(Boolean);
  const totalMatches = summarizedTournaments.reduce((sum, item) => sum + (item.matchCount || 0), 0);
  const totalCompletedMatches = summarizedTournaments.reduce(
    (sum, item) => sum + (item.completedMatchCount || 0),
    0
  );
  const totalActiveMatches = summarizedTournaments.reduce(
    (sum, item) => sum + (item.activeMatchCount || 0),
    0
  );
  const overallProgressPercent = totalMatches > 0 ? Math.round((totalCompletedMatches / totalMatches) * 100) : 0;
  const unassignedTournaments = tournaments.filter(
    (tournament) => !tournament.leagueId || !leagueIds.has(tournament.leagueId)
  );

  return {
    schemaVersion: SEASON_EXPORT_SCHEMA_VERSION,
    type: "season-results",
    exportedAt: new Date().toISOString(),
    clubId,
    clubName,
    season: {
      id: season.id,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
      status: season.status,
      createdAt: season.createdAt,
    },
    summary: {
      leagueCount: leagues.length,
      roundCount: rounds.length,
      tournamentCount: tournaments.length,
      playerCount: players.length,
      matchCount: totalMatches,
      completedMatchCount: totalCompletedMatches,
      activeMatchCount: totalActiveMatches,
      progressPercent: overallProgressPercent,
    },
    leagues: leagueSections,
    unassignedTournaments: unassignedTournaments
      .map(summarizeTournamentForExport)
      .filter(Boolean),
  };
}

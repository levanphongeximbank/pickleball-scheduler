import { buildLeagueStandingsRows } from "./seasonStandingsEngine.js";

export const SEASON_EXPORT_SCHEMA_VERSION = 1;

const MODE_LABELS = {
  daily_play: "Daily",
  internal_tournament: "Noi bo",
  official_tournament: "Chinh thuc",
};

export function summarizeTournamentForExport(tournament) {
  if (!tournament) {
    return null;
  }

  const matches = tournament.matches || [];
  const completed = matches.filter((match) => match.status === "completed").length;

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
    matchCount: matches.length,
    completedMatchCount: completed,
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
    tournaments: tournaments.map(summarizeTournamentForExport).filter(Boolean),
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
    },
    leagues: leagueSections,
    unassignedTournaments: unassignedTournaments
      .map(summarizeTournamentForExport)
      .filter(Boolean),
  };
}

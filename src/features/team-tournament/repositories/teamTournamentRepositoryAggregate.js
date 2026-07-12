import { normalizeTeamData } from "../models/index.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";

/**
 * Extract flat sub-match list from normalized matchups.
 * @param {import('./teamTournamentRepositoryTypes.js').MatchupRecord[]} matchups
 * @returns {import('./teamTournamentRepositoryTypes.js').SubMatchRecord[]}
 */
export function extractSubMatchesFromMatchups(matchups = []) {
  const subMatches = [];
  for (const matchup of matchups) {
    for (const subMatch of matchup.subMatches || []) {
      subMatches.push({
        ...subMatch,
        matchupId: matchup.id,
      });
    }
  }
  return subMatches;
}

/**
 * @param {import('./teamTournamentRepositoryTypes.js').MatchupRecord[]} matchups
 * @returns {import('./teamTournamentRepositoryTypes.js').ScheduleRecord[]}
 */
export function extractScheduleFromMatchups(matchups = []) {
  return matchups
    .filter((matchup) => matchup.scheduledAt || matchup.courtLabel || matchup.roundNumber != null)
    .map((matchup) => ({
      matchupId: matchup.id,
      scheduledAt: matchup.scheduledAt || null,
      courtLabel: matchup.courtLabel || null,
      roundNumber: matchup.roundNumber ?? null,
    }));
}

/**
 * Map legacy teamData blob or tournament record into normalized aggregate collections.
 * @param {object} tournament
 * @param {import('./teamTournamentRepositoryTypes.js').RepositoryProvider} [provider]
 * @returns {import('./teamTournamentRepositoryTypes.js').TournamentAggregate}
 */
export function mapTournamentToAggregate(tournament, provider = "blob") {
  const teamData = normalizeTeamData(tournament?.teamData || tournament || {});
  const matchups = teamData.matchups || [];

  const aggregate = {
    id: String(tournament?.id || ""),
    clubId: String(tournament?.clubId || ""),
    tenantId: tournament?.tenantId ? String(tournament.tenantId) : undefined,
    mode: tournament?.mode ? String(tournament.mode) : TOURNAMENT_MODE.TEAM_TOURNAMENT,
    status: tournament?.status ? String(tournament.status) : undefined,
    version:
      tournament?.version ??
      teamData.settings?._version ??
      teamData.settings?.version ??
      1,
    provider,
    teams: teamData.teams || [],
    matchups,
    lineups: teamData.lineups || {},
    standings: teamData.standings || [],
    subMatches: extractSubMatchesFromMatchups(matchups),
    schedule: extractScheduleFromMatchups(matchups),
    disciplines: teamData.disciplines || [],
    groups: teamData.groups || [],
    settings: teamData.settings || {},
    teamData,
  };

  return aggregate;
}

/**
 * Ensure aggregate retains normalized collection fields from teamData blob adapter.
 * @param {import('./teamTournamentRepositoryTypes.js').TournamentAggregate} aggregate
 * @returns {string[]}
 */
export function listAggregateCollectionKeys(aggregate) {
  return [
    "teams",
    "matchups",
    "lineups",
    "standings",
    "subMatches",
    "schedule",
    "disciplines",
    "groups",
    "settings",
  ].filter((key) => aggregate[key] !== undefined);
}

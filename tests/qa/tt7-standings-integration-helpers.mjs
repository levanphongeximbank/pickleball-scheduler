/**
 * TT-7 execution helpers — adapt QA fixtures to production teamData shape.
 * Does not import production standings engine.
 */

import { MATCHUP_STATUS } from "../../src/features/team-tournament/constants.js";

export function fixtureToTeamData(fixture, options = {}) {
  const includeExhibition = options.includeExhibition ?? false;
  const matchups = [
    ...(fixture.matchups || []),
    ...(includeExhibition ? fixture.exhibitionMatchups || [] : []),
  ]
    .filter((matchup) => matchup.activeForStandings !== false)
    .map((matchup) => ({
      id: matchup.id,
      teamAId: matchup.teamAId,
      teamBId: matchup.teamBId,
      status: matchup.status || MATCHUP_STATUS.SCHEDULED,
      subMatches: matchup.subMatches || [],
      result: matchup.result ? { ...matchup.result } : null,
    }));

  const teams = (fixture.teams || []).map((team) => ({
    id: team.id,
    name: team.name,
    code: team.code,
    playerIds: team.playerIds || [],
    withdrawn: Boolean(team.withdrawn),
    groupId: team.groupId,
  }));

  return {
    teams,
    matchups,
    lineups: {},
    disciplines: [],
    settings: {
      tiebreakOrder: options.tiebreakOrder || fixture.settings?.tiebreakOrder || [],
    },
  };
}

export function productionResultToStandingsBlock(teamDataResult, fixture, tiebreakOrder) {
  const standings = (teamDataResult.standings || []).map((row) => ({
    ...row,
    pointDiff: (row.pointsScored || 0) - (row.pointsConceded || 0),
  }));

  return {
    fixtureId: fixture.meta?.fixtureId || fixture.fixtureId || "unknown",
    tiebreakOrder: tiebreakOrder || teamDataResult.settings?.tiebreakOrder || [],
    standings,
  };
}

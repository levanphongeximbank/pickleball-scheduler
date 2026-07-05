import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { createId } from "../../../utils/id.js";
import { GENDER_REQUIREMENT, MATCHUP_STATUS } from "../constants.js";
import {
  createDisciplineRecord,
  createEmptyTeamData,
  createMatchupRecord,
  createTeamRecord,
  normalizeTeamData,
} from "../models/index.js";
import { computeTeamStandings } from "./teamStandingsEngine.js";

export function createDefaultDisciplines() {
  return [
    createDisciplineRecord({ name: "Đôi nam", genderRequirement: GENDER_REQUIREMENT.MALE, playerCount: 2, sortOrder: 1 }),
    createDisciplineRecord({ name: "Đôi nữ", genderRequirement: GENDER_REQUIREMENT.FEMALE, playerCount: 2, sortOrder: 2 }),
    createDisciplineRecord({ name: "Mixed 1", genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR, playerCount: 2, sortOrder: 3 }),
    createDisciplineRecord({ name: "Mixed 2", genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR, playerCount: 2, sortOrder: 4 }),
  ];
}

export function initializeTeamTournamentData(options = {}) {
  return createEmptyTeamData({
    disciplines: options.disciplines || createDefaultDisciplines(),
    teams: options.teams || [],
    matchups: options.matchups || [],
    settings: options.settings || {},
  });
}

export function addTeamToTournament(teamData, options = {}) {
  const team = createTeamRecord(options);
  return normalizeTeamData({
    ...teamData,
    teams: [...teamData.teams, team],
  });
}

export function updateTeamInTournament(teamData, teamId, patch = {}) {
  const teams = teamData.teams.map((team) =>
    team.id === String(teamId)
      ? createTeamRecord({ ...team, ...patch, id: team.id })
      : team
  );

  return normalizeTeamData({
    ...teamData,
    teams,
  });
}

export function addDisciplineToTournament(teamData, options = {}) {
  const discipline = createDisciplineRecord({
    ...options,
    sortOrder: options.sortOrder || teamData.disciplines.length + 1,
  });

  return normalizeTeamData({
    ...teamData,
    disciplines: [...teamData.disciplines, discipline],
  });
}

export function buildRoundRobinMatchups(teamData, options = {}) {
  const teams = teamData.teams;
  const matchups = [];

  for (let indexA = 0; indexA < teams.length; indexA += 1) {
    for (let indexB = indexA + 1; indexB < teams.length; indexB += 1) {
      matchups.push(
        createMatchupRecord(teams[indexA].id, teams[indexB].id, {
          disciplines: teamData.disciplines,
          lineupLockAt: options.lineupLockAt || null,
          scheduledAt: options.scheduledAt || null,
          courtLabel: options.courtLabel || "",
          status: MATCHUP_STATUS.LINEUP_OPEN,
        })
      );
    }
  }

  return normalizeTeamData({
    ...teamData,
    matchups,
  });
}

export function attachTeamDataToTournament(tournament, teamData) {
  return {
    ...tournament,
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    teamData: normalizeTeamData(teamData),
    updatedAt: new Date().toISOString(),
  };
}

export function createTeamTournamentShell(clubId, options = {}) {
  const teamData = initializeTeamTournamentData(options.teamData || {});

  return {
    id: options.id || createId("team-tournament"),
    clubId,
    seasonId: options.seasonId || "",
    leagueId: options.leagueId || "",
    name: options.name || "Giải đồng đội",
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    status: options.status || "draft",
    events: [],
    settings: options.settings || {},
    teamData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(options.tenantId ? { tenantId: String(options.tenantId) } : {}),
  };
}

export function refreshStandings(tournament) {
  if (!tournament?.teamData) {
    return tournament;
  }

  return {
    ...tournament,
    teamData: computeTeamStandings(tournament.teamData),
    updatedAt: new Date().toISOString(),
  };
}

export function isTeamTournament(tournament) {
  return tournament?.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT;
}

export function getTeamData(tournament) {
  if (!isTeamTournament(tournament)) {
    return null;
  }

  return normalizeTeamData(tournament.teamData || {});
}

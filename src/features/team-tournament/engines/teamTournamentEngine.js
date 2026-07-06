import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { createId } from "../../../utils/id.js";
import { ACTIVATION_RULE, FORMAT_PRESET, GENDER_REQUIREMENT } from "../constants.js";
import {
  createDisciplineRecord,
  createEmptyTeamData,
  createTeamRecord,
  normalizeTeamData,
} from "../models/index.js";
import { computeTeamStandings } from "./teamStandingsEngine.js";
import { createMlpPreset } from "./mlpPresetEngine.js";
import { buildStructuredRoundRobinMatchups } from "./teamRoundRobinScheduleEngine.js";

export {
  assignTeamsToGroupsBySizes,
  describeGroupSplit,
  describeSchedulePreview,
  recommendGroupSizes,
} from "./teamRoundRobinScheduleEngine.js";
export {
  applyMlpAutoDraw,
  assignSeededTeamsToGroups,
  suggestMlpTeamsFromPlayers,
  summarizeSeededGroupBalance,
} from "./teamAutoDrawEngine.js";

export function createDefaultDisciplines() {
  return [
    createDisciplineRecord({ name: "Đôi nam", genderRequirement: GENDER_REQUIREMENT.MALE, playerCount: 2, sortOrder: 1 }),
    createDisciplineRecord({ name: "Đôi nữ", genderRequirement: GENDER_REQUIREMENT.FEMALE, playerCount: 2, sortOrder: 2 }),
    createDisciplineRecord({ name: "Mixed 1", genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR, playerCount: 2, sortOrder: 3 }),
    createDisciplineRecord({ name: "Mixed 2", genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR, playerCount: 2, sortOrder: 4 }),
  ];
}

export function initializeTeamTournamentData(options = {}) {
  const formatPreset =
    options.formatPreset ||
    options.settings?.formatPreset ||
    FORMAT_PRESET.CUSTOM;
  const useMlp = formatPreset === FORMAT_PRESET.MLP_4;

  if (useMlp) {
    const preset = createMlpPreset({
      teams: options.teams || [],
      matchups: options.matchups || [],
      settings: options.settings || {},
    });
    return createEmptyTeamData(preset);
  }

  return createEmptyTeamData({
    disciplines: options.disciplines || createDefaultDisciplines(),
    teams: options.teams || [],
    matchups: options.matchups || [],
    settings: { formatPreset: FORMAT_PRESET.CUSTOM, ...(options.settings || {}) },
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

export function updateDisciplineInTournament(teamData, disciplineId, patch = {}) {
  const disciplines = teamData.disciplines.map((discipline) =>
    discipline.id === String(disciplineId)
      ? createDisciplineRecord({ ...discipline, ...patch, id: discipline.id })
      : discipline
  );

  return normalizeTeamData({
    ...teamData,
    disciplines,
  });
}

export function removeDisciplineFromTournament(teamData, disciplineId) {
  return normalizeTeamData({
    ...teamData,
    disciplines: teamData.disciplines.filter(
      (discipline) => discipline.id !== String(disciplineId)
    ),
  });
}

export function updateMatchupInTournament(teamData, matchupId, patch = {}) {
  const matchups = teamData.matchups.map((matchup) =>
    matchup.id === String(matchupId)
      ? {
          ...matchup,
          ...patch,
          id: matchup.id,
        }
      : matchup
  );

  return normalizeTeamData({
    ...teamData,
    matchups,
  });
}

export function buildRoundRobinMatchups(teamData, options = {}) {
  return buildStructuredRoundRobinMatchups(teamData, options);
}

export function assignTeamsToGroupsSnake(teamData, groupCount) {
  const teams = teamData.teams || [];
  const count = Math.max(1, Math.min(Number(groupCount) || 1, teams.length));
  const groups = Array.from({ length: count }, (_, index) => ({
    id: createId("grp"),
    name: `Bảng ${String.fromCharCode(65 + index)}`,
    teamIds: [],
  }));

  teams.forEach((team, index) => {
    const round = Math.floor(index / count);
    const position = index % count;
    const groupIndex = round % 2 === 0 ? position : count - 1 - position;
    groups[groupIndex].teamIds.push(team.id);
  });

  return normalizeTeamData({
    ...teamData,
    groups,
  });
}

export function clearTeamGroups(teamData) {
  return normalizeTeamData({
    ...teamData,
    groups: [],
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
  const formatPreset = options.formatPreset || FORMAT_PRESET.MLP_4;
  const teamData = initializeTeamTournamentData({
    ...options.teamData,
    formatPreset,
    settings: options.settings,
    teams: options.teams,
    matchups: options.matchups,
  });

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

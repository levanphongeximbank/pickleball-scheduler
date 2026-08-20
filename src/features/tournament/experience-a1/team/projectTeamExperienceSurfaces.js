/**
 * Wave T3 READ projections for Settings / Participants / Schedule.
 * Projection only — no domain mutation, no second authority.
 */
import { resolveFormatVenueDefaults } from "../../../team-tournament/engines/teamFormatVenueConfig.js";
import { getTeamRosterWarnings } from "../../../team-tournament/engines/teamRosterEngine.js";
import { buildTeamExperienceContext } from "./teamExperienceRoutes.js";
import { TEAM_EXPERIENCE_ADAPTER_ID, TEAM_DOMAIN_AUTHORITIES } from "./TeamTournamentExperienceAdapter.js";

function teamNameById(teams = []) {
  const map = new Map();
  for (const team of teams || []) {
    if (team?.id) map.set(String(team.id), String(team.name || team.id));
  }
  return map;
}

function groupLabelById(groups = []) {
  const map = new Map();
  for (const group of groups || []) {
    if (group?.id) {
      map.set(String(group.id), String(group.name || group.label || group.id));
    }
  }
  return map;
}

function findGroupIdForTeam(groups = [], teamId) {
  const id = String(teamId || "");
  for (const group of groups || []) {
    if ((group.teamIds || []).map(String).includes(id)) {
      return String(group.id);
    }
  }
  return null;
}

/**
 * @param {{ tournament?: object|null, teamData?: object|null }} input
 */
export function projectTeamSettings({ tournament = null, teamData = null } = {}) {
  if (!tournament?.id && !teamData) return null;
  const defaults = resolveFormatVenueDefaults(teamData || {}, tournament);
  const disciplines = Array.isArray(teamData?.disciplines) ? teamData.disciplines : [];
  return {
    adapterId: TEAM_EXPERIENCE_ADAPTER_ID,
    context: buildTeamExperienceContext({
      tournamentId: tournament?.id,
      tenantId: tournament?.tenantId,
      clubId: tournament?.clubId,
    }),
    identity: {
      id: String(tournament?.id || ""),
      name: String(tournament?.name || "Giải đồng đội"),
      status: tournament?.status || "",
      clubId: tournament?.clubId || null,
      tenantId: tournament?.tenantId || null,
    },
    format: {
      formatPreset: defaults.formatPreset,
      groupMode: defaults.groupMode,
      groupCount: defaults.groupCount,
      qualifiersPerGroup: defaults.qualifiersPerGroup ?? defaults.qualificationCount,
      knockoutFormat: defaults.knockoutFormat,
      dreambreakerEnabled: defaults.dreambreakerEnabled === true,
      selectedCourtIds: Array.isArray(defaults.selectedCourtIds)
        ? defaults.selectedCourtIds.map(String)
        : [],
      rosterRules: defaults.rosterRules || null,
    },
    disciplines: disciplines.map((d) => ({
      id: String(d.id),
      name: String(d.name || d.label || d.id),
      sortOrder: d.sortOrder ?? null,
    })),
    disciplineCount: disciplines.length,
    authority: {
      adapter: TEAM_EXPERIENCE_ADAPTER_ID,
      settingsWriter: "persistFormatVenueSetup → tournament.update_setup_config",
      disciplineWriter: "persistSetupTeamData → discipline.* (legacy/compat surface)",
      ownsPersistence: false,
      domain: TEAM_DOMAIN_AUTHORITIES,
    },
  };
}

/**
 * @param {{ tournament?: object|null, teamData?: object|null, players?: object[] }} input
 */
export function projectTeamParticipants({
  tournament = null,
  teamData = null,
  players = [],
} = {}) {
  if (!tournament?.id && !teamData) return null;
  const teams = Array.isArray(teamData?.teams) ? teamData.teams : [];
  const groups = Array.isArray(teamData?.groups) ? teamData.groups : [];
  const playerById = new Map(
    (players || []).map((p) => [String(p.id || p.playerId || ""), p])
  );

  const projectedTeams = teams.map((team) => {
    const memberIds = Array.isArray(team.playerIds)
      ? team.playerIds.map(String)
      : Array.isArray(team.members)
        ? team.members.map((m) => String(m.playerId || m.id || "")).filter(Boolean)
        : [];
    const members = memberIds.map((playerId) => {
      const player = playerById.get(playerId);
      return {
        playerId,
        displayName: player
          ? String(player.displayName || player.name || playerId)
          : null,
        identityAuthority: "playerId",
      };
    });
    const warnings = getTeamRosterWarnings(team, teamData, players) || [];
    const groupId = findGroupIdForTeam(groups, team.id);
    return {
      id: String(team.id),
      name: String(team.name || team.id),
      captainPlayerId: team.captainPlayerId ? String(team.captainPlayerId) : null,
      memberCount: memberIds.length,
      members,
      groupId,
      groupLabel: groupId ? groupLabelById(groups).get(groupId) || groupId : null,
      withdrawn: team.withdrawn === true,
      readiness: {
        hasCaptain: Boolean(team.captainPlayerId),
        warningCount: Array.isArray(warnings) ? warnings.length : 0,
        warnings: Array.isArray(warnings)
          ? warnings.map((w) => (typeof w === "string" ? w : w?.message || String(w)))
          : [],
      },
    };
  });

  return {
    adapterId: TEAM_EXPERIENCE_ADAPTER_ID,
    context: buildTeamExperienceContext({
      tournamentId: tournament?.id,
      tenantId: tournament?.tenantId,
      clubId: tournament?.clubId,
    }),
    teamCount: projectedTeams.length,
    teams: projectedTeams,
    authority: {
      adapter: TEAM_EXPERIENCE_ADAPTER_ID,
      rosterWriter:
        "teamTournamentService → save_team / assign_member / remove_member / set_captain",
      identityField: "playerId",
      ownsPersistence: false,
      domain: TEAM_DOMAIN_AUTHORITIES,
    },
  };
}

/**
 * @param {{ tournament?: object|null, teamData?: object|null }} input
 */
export function projectTeamSchedule({ tournament = null, teamData = null } = {}) {
  if (!tournament?.id && !teamData) return null;
  const teams = Array.isArray(teamData?.teams) ? teamData.teams : [];
  const groups = Array.isArray(teamData?.groups) ? teamData.groups : [];
  const matchups = Array.isArray(teamData?.matchups) ? teamData.matchups : [];
  const names = teamNameById(teams);
  const groupNames = groupLabelById(groups);

  const rows = matchups.map((matchup) => {
    const subMatches = Array.isArray(matchup.subMatches) ? matchup.subMatches : [];
    return {
      id: String(matchup.id),
      stage: matchup.stage || null,
      groupId: matchup.groupId ? String(matchup.groupId) : null,
      groupLabel: matchup.groupId
        ? groupNames.get(String(matchup.groupId)) || String(matchup.groupId)
        : null,
      roundNumber: matchup.roundNumber ?? null,
      teamAId: matchup.teamAId ? String(matchup.teamAId) : null,
      teamBId: matchup.teamBId ? String(matchup.teamBId) : null,
      teamAName: matchup.teamAId ? names.get(String(matchup.teamAId)) || String(matchup.teamAId) : "—",
      teamBName: matchup.teamBId ? names.get(String(matchup.teamBId)) || String(matchup.teamBId) : "—",
      status: matchup.status || "scheduled",
      scheduledAt: matchup.scheduledAt || null,
      courtLabel: matchup.courtLabel || null,
      courtId: matchup.courtId || null,
      physicalCourtId: matchup.physicalCourtId || null,
      subMatchCount: subMatches.length,
      subMatchIds: subMatches.map((sm) => String(sm.id || sm.subMatchId || "")).filter(Boolean),
      hierarchy: "tournament → matchup → subMatches",
    };
  });

  const publish = teamData?.settings?.schedulePublish || teamData?.schedulePublish || null;

  return {
    adapterId: TEAM_EXPERIENCE_ADAPTER_ID,
    context: buildTeamExperienceContext({
      tournamentId: tournament?.id,
      tenantId: tournament?.tenantId,
      clubId: tournament?.clubId,
    }),
    matchupCount: rows.length,
    matchups: rows,
    publishStatus: publish?.status || null,
    authority: {
      adapter: TEAM_EXPERIENCE_ADAPTER_ID,
      matchupWriter: "buildRoundRobinMatchups + persistSetupTeamData → matchups.replace / schedule.*",
      regeneratesOnRead: false,
      ownsPersistence: false,
      domain: TEAM_DOMAIN_AUTHORITIES,
    },
  };
}

export const TEAM_EXPERIENCE_COMMANDS = Object.freeze({
  SAVE_FORMAT_VENUE: "persistFormatVenueSetup",
  PERSIST_SETUP_TEAM_DATA: "persistSetupTeamData",
  BUILD_ROUND_ROBIN: "buildRoundRobinMatchups",
  CREATE_TEAM: "createTeamInTournament",
  ADD_MEMBER: "addPlayerToTeamRoster",
  REMOVE_MEMBER: "removePlayerFromTeamRoster",
  SET_CAPTAIN: "assignCaptainToTeam",
});

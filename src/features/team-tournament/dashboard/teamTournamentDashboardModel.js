/**
 * Application-layer dashboard composition.
 * Separate domain readers stay gated; this layer never merges private
 * captain/referee payloads into the public viewer section.
 */
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import {
  canViewTournamentDashboard,
  isDraftTournament,
  resolveOrganizerPrimaryAction,
  isRegistrationFoundationReady,
} from "../lifecycle/teamTournamentLifecycle.js";
import {
  projectPublicMatchups,
  projectPublicStandings,
  projectPublicTeams,
  projectStageTieBreakDisplay,
  stripPrivateCaptainFields,
} from "./teamTournamentDashboardPrivacy.js";
import {
  buildCaptainDashboardTasks,
  buildOrganizerDashboardActions,
  buildRefereeDashboardAssignments,
} from "./teamTournamentDashboardTasks.js";

function findParticipatingTeam(teams = [], playerId) {
  if (!playerId) return null;
  const pid = String(playerId);
  return (
    (teams || []).find((team) => {
      if (String(team.captainPlayerId || "") === pid) return true;
      if ((team.deputyPlayerIds || []).map(String).includes(pid)) return true;
      return (team.members || team.playerIds || []).some(
        (member) => String(member?.playerId || member?.id || member) === pid
      );
    }) || null
  );
}

function findCaptainTeam(teams = [], playerId) {
  if (!playerId) return null;
  const pid = String(playerId);
  return (
    (teams || []).find(
      (team) =>
        String(team.captainPlayerId || "") === pid ||
        (team.deputyPlayerIds || []).map(String).includes(pid)
    ) || null
  );
}

function classifyMatchups(matchups = []) {
  const upcoming = [];
  const live = [];
  const completed = [];
  for (const matchup of matchups) {
    const status = String(matchup.status || "");
    if (status === "completed") completed.push(matchup);
    else if (status === "in_progress" || status === "playing") live.push(matchup);
    else upcoming.push(matchup);
  }
  return { upcoming, live, completed };
}

export function resolveDashboardCapabilities({
  teamData,
  playerId,
  userId,
  canOrganize = false,
  refereeAssignments = [],
} = {}) {
  const teams = teamData?.teams || [];
  const myTeam = findParticipatingTeam(teams, playerId);
  const captainTeam = findCaptainTeam(teams, playerId);
  const myAssignments = (refereeAssignments || []).filter((item) => {
    if (!userId) return false;
    return String(item.refereeUserId || item.userId || "") === String(userId);
  });

  return {
    canOrganize: canOrganize === true,
    isParticipant: Boolean(myTeam),
    isCaptain: Boolean(captainTeam),
    isReferee: myAssignments.length > 0,
    isViewer: true,
    myTeamId: myTeam?.id || null,
    captainTeamId: captainTeam?.id || null,
    myAssignments,
  };
}

export function buildTeamTournamentDashboardView({
  tournament,
  teamData,
  playerId = null,
  userId = null,
  canOrganize = false,
  sameTenant = false,
  isAuthenticated = false,
  refereeAssignments = [],
  clubId = null,
} = {}) {
  const visibility = canViewTournamentDashboard({
    tournament,
    isAuthenticated,
    canOrganize,
    sameTenant,
  });
  if (!visibility.ok) {
    return {
      ok: false,
      code: visibility.code,
      error:
        visibility.code === "DRAFT_NOT_VISIBLE"
          ? "Giải nháp chỉ hiển thị cho ban tổ chức."
          : visibility.code === "CROSS_TENANT_DENIED"
            ? "Không xem được giải của tenant khác."
            : "Không xem được bảng điều khiển giải.",
    };
  }

  const capabilities = resolveDashboardCapabilities({
    tournament,
    teamData,
    playerId,
    userId,
    canOrganize,
    refereeAssignments,
  });

  const matchups = projectPublicMatchups(teamData?.matchups || []);
  const classified = classifyMatchups(matchups);
  const myTeam = capabilities.myTeamId
    ? (teamData?.teams || []).find((team) => team.id === capabilities.myTeamId)
    : null;
  const mySchedule = matchups.filter(
    (matchup) =>
      matchup.teamAId === capabilities.myTeamId || matchup.teamBId === capabilities.myTeamId
  );

  const captainTasks = capabilities.isCaptain
    ? buildCaptainDashboardTasks({
        tournament,
        teamData,
        captainTeamId: capabilities.captainTeamId,
        clubId,
      })
    : [];

  const refereeTasks = capabilities.isReferee
    ? buildRefereeDashboardAssignments({
        tournament,
        teamData,
        assignments: capabilities.myAssignments,
      })
    : [];

  const view = {
    ok: true,
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    overview: {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      clubId: tournament.clubId,
      tenantId: tournament.tenantId,
      formatPreset: teamData?.settings?.formatPreset || teamData?.formatPreset || null,
      isDraft: isDraftTournament(tournament),
      registrationFoundationReady: isRegistrationFoundationReady(tournament),
      registrationFullUiImplemented: false,
    },
    stageTieBreakPolicy: projectStageTieBreakDisplay(teamData, tournament),
    teams: projectPublicTeams(teamData?.teams || []),
    schedule: classified,
    results: classified.completed,
    standings: projectPublicStandings(teamData?.standings || []),
    knockout: matchups.filter((matchup) => matchup.stage === "knockout"),
    capabilities,
    sections: {
      viewer: true,
      myTeam: capabilities.isParticipant,
      captain: capabilities.isCaptain,
      referee: capabilities.isReferee,
      organizer: capabilities.canOrganize,
    },
    myTeam: capabilities.isParticipant
      ? {
          id: myTeam?.id,
          name: myTeam?.name,
          roster: (myTeam?.members || []).map((member) => ({
            playerId: member.playerId || member.id || null,
            name: member.displayName || member.name || null,
          })),
          schedule: mySchedule,
          nextMatch: mySchedule.find((item) => item.status !== "completed") || null,
          standingsRow: projectPublicStandings(teamData?.standings || []).find(
            (row) => row.teamId === myTeam?.id
          ) || null,
        }
      : null,
    captain: capabilities.isCaptain
      ? stripPrivateCaptainFields({
          teamId: capabilities.captainTeamId,
          href: captainTasks[0]?.href || null,
          tasks: captainTasks,
        })
      : null,
    referee: capabilities.isReferee
      ? {
          assignments: refereeTasks,
        }
      : null,
    organizer: capabilities.canOrganize
      ? {
          primaryAction: resolveOrganizerPrimaryAction(tournament),
          actions: buildOrganizerDashboardActions(tournament),
        }
      : null,
  };

  return view;
}

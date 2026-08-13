/**
 * Policy-aware Captain / Referee dashboard tasks.
 * Links into EXISTING portals. Does not implement scoring or orders.
 */
import {
  DREAMBREAKER_STATUS,
  LINEUP_STATUS,
  STAGE_TIE_BREAK_POLICY,
} from "../constants.js";
import { resolveEffectiveStageTieBreakPolicy } from "../engines/teamStageTieBreakPolicy.js";
import { getLineup } from "../models/index.js";
import { buildCaptainPortalPath } from "../../../components/tournament/team/copyPortalLink.js";
import { teamTournamentDashboardPath, teamTournamentPath, TEAM_TAB_QUERY } from "../../../config/tournamentRoutes.js";
import { isUnresolvedBracketPlaceholder } from "../engines/teamKnockoutEngine.js";

export const DASHBOARD_TASK = Object.freeze({
  CAPTAIN_LINEUP: "captain_lineup",
  CAPTAIN_DREAMBREAKER: "captain_dreambreaker",
  REFEREE_OPERATE: "referee_operate",
});

function matchupLabel(matchup, teamsById) {
  const teamA = teamsById.get(matchup.teamAId)?.name || "Đội A";
  const teamB = teamsById.get(matchup.teamBId)?.name || "Đội B";
  const when = matchup.scheduledAt ? String(matchup.scheduledAt) : "";
  const court = matchup.courtLabel ? `Sân ${matchup.courtLabel}` : "";
  return [when, `${teamA} vs ${teamB}`, court].filter(Boolean).join(" · ");
}

/**
 * Missing lineup row = fresh matchup lifecycle (group → SF / SF → Final).
 * Prior-round submitted/locked/published lineups never satisfy a new matchupId.
 */
export function isLineupTaskOpen(lineup) {
  if (!lineup) return true;
  const status = String(lineup?.status || "").toLowerCase();
  return (
    status === LINEUP_STATUS.NOT_SUBMITTED ||
    status === LINEUP_STATUS.DRAFT ||
    status === "lineup_open" ||
    status === "waiting" ||
    status === ""
  );
}

function resolveOwnLineup(teamData, matchup, captainTeamId) {
  const fromMap = getLineup(teamData, matchup?.id, captainTeamId);
  if (fromMap) return fromMap;
  const embedded = matchup?.lineups?.[captainTeamId] || matchup?.ownLineup;
  return embedded || null;
}

export function buildCaptainDashboardTasks({
  tournament,
  teamData,
  captainTeamId,
  clubId,
} = {}) {
  if (!captainTeamId) return [];
  const teamsById = new Map((teamData?.teams || []).map((team) => [team.id, team]));
  const href = buildCaptainPortalPath(tournament?.id || tournament?.teamDomainId, {
    clubId: clubId || tournament?.clubId || null,
  });
  const tasks = [];

  for (const matchup of teamData?.matchups || []) {
    if (matchup.teamAId !== captainTeamId && matchup.teamBId !== captainTeamId) {
      continue;
    }
    if (isUnresolvedBracketPlaceholder(matchup)) {
      continue;
    }
    if (matchup.status === "completed") {
      continue;
    }

    const ownLineup = resolveOwnLineup(teamData, matchup, captainTeamId);
    if (isLineupTaskOpen(ownLineup)) {
      tasks.push({
        type: DASHBOARD_TASK.CAPTAIN_LINEUP,
        matchupId: matchup.id,
        label: `Điền lineup · ${matchupLabel(matchup, teamsById)}`,
        href,
      });
    }

    const policy = resolveEffectiveStageTieBreakPolicy(teamData, matchup, tournament);
    const dreambreaker = matchup.dreambreaker || matchup.result?.dreambreaker || {};
    const needsDb = matchup.result?.needsDreambreaker === true;
    const dbStatus = String(dreambreaker.status || "");
    const pointsUnequal =
      policy === STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS &&
      Number(matchup.result?.teamAPoints) !== Number(matchup.result?.teamBPoints) &&
      matchup.result?.tieBreakStatus === "points";

    if (pointsUnequal) {
      continue;
    }

    const fallbackOrDirect =
      policy === STAGE_TIE_BREAK_POLICY.DREAMBREAKER ||
      matchup.result?.tieBreakStatus === "dreambreaker" ||
      matchup.result?.tieBreakStatus === "dreambreaker_fallback";

    if (
      fallbackOrDirect &&
      needsDb &&
      dbStatus !== DREAMBREAKER_STATUS.COMPLETED &&
      dbStatus !== DREAMBREAKER_STATUS.IN_PROGRESS
    ) {
      tasks.push({
        type: DASHBOARD_TASK.CAPTAIN_DREAMBREAKER,
        matchupId: matchup.id,
        label: `Thứ tự Dreambreaker · ${matchupLabel(matchup, teamsById)}`,
        href,
      });
    }
  }

  return tasks;
}

export function buildRefereeDashboardAssignments({
  tournament,
  teamData,
  assignments = [],
} = {}) {
  const teamsById = new Map((teamData?.teams || []).map((team) => [team.id, team]));
  const tournamentId = tournament?.id || tournament?.teamDomainId;
  return (assignments || []).flatMap((assignment) => {
    const matchupId = assignment.matchupId || assignment.externalMatchupId;
    const matchup = (teamData?.matchups || []).find((item) => item.id === matchupId) || {};
    if (isUnresolvedBracketPlaceholder(matchup)) {
      return [];
    }
    const matchId = assignment.matchId || assignment.v5MatchId;
    const href = matchId
      ? `/referee/match/${matchId}?tournamentId=${encodeURIComponent(tournamentId)}`
      : `/team-referee/${tournamentId}?matchup=${encodeURIComponent(matchupId || "")}`;
    return {
      type: DASHBOARD_TASK.REFEREE_OPERATE,
      matchupId,
      matchId: matchId || null,
      scheduledAt: matchup.scheduledAt || assignment.scheduledAt || null,
      courtLabel: matchup.courtLabel || assignment.courtLabel || null,
      label: matchupLabel(
        {
          ...matchup,
          scheduledAt: matchup.scheduledAt || assignment.scheduledAt,
          courtLabel: matchup.courtLabel || assignment.courtLabel,
        },
        teamsById
      ),
      href,
    };
  });
}

export function buildOrganizerDashboardActions(tournament) {
  const id = tournament?.id;
  if (!id) return [];
  return [
    {
      id: "dashboard",
      label: "Bảng điều khiển",
      href: teamTournamentDashboardPath(id),
    },
    {
      id: "setup",
      label: "Thiết lập / điều hành",
      href: teamTournamentPath(id, TEAM_TAB_QUERY.teams),
    },
  ];
}

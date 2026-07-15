import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { MATCHUP_STATUS } from "../constants.js";
import { findTeam } from "../models/index.js";
import { loadAthleteClubLink } from "../../club/storage/athleteClubLinkStore.js";

function normalizePlayerId(value) {
  return value ? String(value).trim() : "";
}

/** Resolve linked athlete player id for captain portal (session, profile snake_case, athlete link). */
export function resolveCaptainViewerPlayerId(user) {
  if (!user) {
    return null;
  }

  const direct = user.playerId || user.player_id;
  if (direct) {
    return normalizePlayerId(direct);
  }

  const link = user.id ? loadAthleteClubLink(user.id) : null;
  return link?.playerId ? normalizePlayerId(link.playerId) : null;
}

export function isTeamCaptain(team, playerId) {
  if (!team || !playerId) {
    return false;
  }

  const normalized = normalizePlayerId(playerId);
  if (team.captainPlayerId === normalized) {
    return true;
  }

  return (team.deputyPlayerIds || []).includes(normalized);
}

export function canManageTeam({ permissions = [] } = {}) {
  if (permissions.includes(PERMISSIONS.TEAM_MANAGE)) {
    return true;
  }

  return permissions.includes(PERMISSIONS.TOURNAMENT_UPDATE);
}

export function canViewTeam({ permissions = [] } = {}) {
  return (
    permissions.includes(PERMISSIONS.TEAM_VIEW) ||
    permissions.includes(PERMISSIONS.TEAM_STANDINGS_VIEW) ||
    permissions.includes(PERMISSIONS.TOURNAMENT_VIEW)
  );
}

export function canSubmitLineup({
  team,
  playerId,
  permissions = [],
}) {
  if (canManageTeam({ permissions })) {
    return true;
  }

  if (!permissions.includes(PERMISSIONS.TEAM_LINEUP_SUBMIT)) {
    return false;
  }

  return isTeamCaptain(team, playerId);
}

export function canLockLineup({ permissions = [] } = {}) {
  return (
    permissions.includes(PERMISSIONS.TEAM_LINEUP_LOCK) ||
    permissions.includes(PERMISSIONS.TOURNAMENT_UPDATE)
  );
}

export function canPublishLineup({ permissions = [] } = {}) {
  return (
    permissions.includes(PERMISSIONS.TEAM_LINEUP_PUBLISH) ||
    permissions.includes(PERMISSIONS.TOURNAMENT_UPDATE)
  );
}

export function canRandomizeLineup({ permissions = [] } = {}) {
  return (
    permissions.includes(PERMISSIONS.TEAM_LINEUP_RANDOMIZE) ||
    permissions.includes(PERMISSIONS.TOURNAMENT_UPDATE)
  );
}

export function canOverrideLineup({ permissions = [] } = {}) {
  return (
    permissions.includes(PERMISSIONS.TEAM_LINEUP_OVERRIDE) ||
    permissions.includes(PERMISSIONS.TOURNAMENT_UPDATE)
  );
}

export function canApplyForfeit({ permissions = [] } = {}) {
  return (
    canManageTeam({ permissions }) ||
    canManageTeamMatchResult({ permissions })
  );
}

export function canWithdrawTeam({ permissions = [] } = {}) {
  return (
    permissions.includes(PERMISSIONS.TEAM_WITHDRAW) ||
    permissions.includes(PERMISSIONS.TOURNAMENT_UPDATE)
  );
}

export function canProvisionRefereeLink({ permissions = [] } = {}) {
  return canManageTeam({ permissions });
}

export function canManageTeamMatchResult({ permissions = [] } = {}) {
  return (
    permissions.includes(PERMISSIONS.TEAM_MATCH_RESULT_MANAGE) ||
    permissions.includes(PERMISSIONS.MATCH_UPDATE) ||
    permissions.includes(PERMISSIONS.TOURNAMENT_UPDATE)
  );
}

/** S2-B — view existing teams catalog */
export function canViewExistingTeams({ permissions = [] } = {}) {
  if (canManageTeam({ permissions })) {
    return true;
  }
  return (
    permissions.includes(PERMISSIONS.EXISTING_TEAM_VIEW) ||
    permissions.includes(PERMISSIONS.EXISTING_TEAM_SELECT) ||
    permissions.includes(PERMISSIONS.EXISTING_TEAM_MANAGE) ||
    permissions.includes(PERMISSIONS.TOURNAMENT_VIEW)
  );
}

/** S2-B — clone / select existing team into a tournament */
export function canSelectExistingTeam({ permissions = [] } = {}) {
  if (canManageTeam({ permissions })) {
    return true;
  }
  return (
    permissions.includes(PERMISSIONS.EXISTING_TEAM_SELECT) ||
    permissions.includes(PERMISSIONS.EXISTING_TEAM_MANAGE)
  );
}

/** S2-C — captain may request / apply pre-lock substitution on own team */
export function canRequestSubstitution({ permissions = [] } = {}) {
  if (canManageTeam({ permissions })) {
    return true;
  }
  return (
    permissions.includes(PERMISSIONS.TEAM_SUBSTITUTION_REQUEST) ||
    permissions.includes(PERMISSIONS.TEAM_SUBSTITUTION_APPROVE)
  );
}

/** S2-C — BTC may approve / apply pre-lock substitution */
export function canApproveSubstitution({ permissions = [] } = {}) {
  if (canManageTeam({ permissions })) {
    return true;
  }
  return permissions.includes(PERMISSIONS.TEAM_SUBSTITUTION_APPROVE);
}

export function canViewTeamMatchResults({ permissions = [] } = {}) {
  return (
    canViewTeam({ permissions }) ||
    canManageTeamMatchResult({ permissions })
  );
}

export function assertTeamScope(teamData, teamId, playerId, permissions = []) {
  const team = findTeam(teamData, teamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  if (canManageTeam({ permissions })) {
    return { ok: true, team };
  }

  if (!isTeamCaptain(team, playerId)) {
    return { ok: false, error: "Bạn không có quyền thao tác đội này." };
  }

  return { ok: true, team };
}

export function getCaptainPermissionsForTeam(team, playerId) {
  const captain = isTeamCaptain(team, playerId);
  return {
    canViewTeam: captain,
    canSubmitLineup: captain,
    canViewStandings: captain,
  };
}

export function findTeamForCaptain(teamData, playerId) {
  if (!teamData?.teams || !playerId) {
    return null;
  }

  return (
    teamData.teams.find((team) => isTeamCaptain(team, playerId)) || null
  );
}

export function listMatchupsForTeam(teamData, teamId) {
  if (!teamData?.matchups || !teamId) {
    return [];
  }

  const normalizedTeamId = String(teamId).trim();
  return teamData.matchups.filter(
    (matchup) =>
      matchup.teamAId === normalizedTeamId || matchup.teamBId === normalizedTeamId
  );
}

export function getOpponentTeamId(matchup, teamId) {
  if (!matchup || !teamId) {
    return "";
  }

  const normalizedTeamId = String(teamId).trim();
  return matchup.teamAId === normalizedTeamId ? matchup.teamBId : matchup.teamAId;
}

export function partitionMatchupsForPortal(matchups = [], now = new Date()) {
  const timestamp = new Date(now).getTime();
  const upcoming = [];
  const past = [];

  for (const matchup of matchups) {
    if (matchup.status === MATCHUP_STATUS.COMPLETED) {
      past.push(matchup);
      continue;
    }

    const scheduledAt = matchup.scheduledAt
      ? new Date(matchup.scheduledAt).getTime()
      : null;

    const isPastEvent =
      scheduledAt !== null &&
      scheduledAt < timestamp &&
      (matchup.status === MATCHUP_STATUS.LOCKED ||
        matchup.status === MATCHUP_STATUS.PUBLISHED ||
        matchup.status === MATCHUP_STATUS.IN_PROGRESS);

    if (isPastEvent) {
      past.push(matchup);
    } else {
      upcoming.push(matchup);
    }
  }

  const bySchedule = (left, right) => {
    const leftTime = left.scheduledAt ? new Date(left.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.scheduledAt ? new Date(right.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  };

  upcoming.sort(bySchedule);
  past.sort(bySchedule);

  return { upcoming, past };
}

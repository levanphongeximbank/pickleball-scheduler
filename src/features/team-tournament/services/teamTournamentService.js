import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { getAuthOptions, guardClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { getPermissionsForRole } from "../../identity/matrix/rolePermissions.js";
import { TEAM_AUDIT_ACTIONS, LINEUP_STATUS, SUB_MATCH_STATUS } from "../constants.js";
import {
  attachTeamDataToTournament,
  createTeamTournamentShell,
  getTeamData,
  isTeamTournament,
  refreshStandings,
} from "../engines/teamTournamentEngine.js";
import {
  lockMatchupLineups,
  publishMatchupLineups,
  saveLineupDraft,
  submitLineup,
} from "../engines/lineupEngine.js";
import { recordSubMatchResult } from "../engines/teamResultEngine.js";
import {
  confirmSubMatchResult,
  saveSubMatchDraft,
  validateSubMatchScoreInput,
} from "../engines/teamRefereeEngine.js";
import {
  addPlayerToTeam,
  assignTeamCaptain,
  assignTeamDeputies,
  removePlayerFromTeam,
  updateTeamProfile,
} from "../engines/teamRosterEngine.js";
import { addTeamToTournament } from "../engines/teamTournamentEngine.js";
import {
  assertTeamScope,
  canManageTeam,
} from "../engines/teamPermissionEngine.js";
import { normalizeTeamData, getLineup, createTeamRecord } from "../models/index.js";
import { resolveTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import { appendTeamAuditLog } from "./teamAuditService.js";
import {
  cloudAssignMember,
  cloudCaptainSaveLineup,
  cloudCaptainSubmitLineup,
  cloudEnsureTournamentHeader,
  cloudGetTeamTournamentSetup,
  cloudOrganizerLockLineups,
  cloudOrganizerPublishLineups,
  cloudRefereeConfirmSubMatch,
  cloudRefereeSaveSubMatchDraft,
  cloudRemoveMember,
  cloudSaveTeam,
  cloudSetCaptain,
  cloudSyncStandingsAfterMutation,
  shouldUseTeamTournamentCloud,
} from "./teamTournamentCloudSync.js";

function findTournament(data, tournamentId) {
  return (data.tournaments || []).find((item) => item.id === String(tournamentId)) || null;
}

async function mirrorMutationToCloud(cloudCall, tournament) {
  if (shouldUseTeamTournamentCloud() && tournament?.id) {
    const header = await cloudEnsureTournamentHeader({
      ...tournament,
      tenantId: tournament.tenantId || resolveTenantIdForClub(tournament.clubId),
    });
    if (!header.ok) {
      return {
        ok: false,
        usedCloud: true,
        error: header.error || "Không đồng bộ được giải lên cloud.",
        code: header.code,
      };
    }
  }

  const cloud = await cloudCall();
  if (!cloud.ok && cloud.usedCloud) {
    return cloud;
  }

  if (cloud.usedCloud && tournament?.id) {
    await cloudSyncStandingsAfterMutation(tournament).catch(() => {});
  }

  return cloud;
}

function updateTournament(clubId, tournamentId, updater) {
  const data = loadClubData(clubId);
  const tournament = findTournament(data, tournamentId);

  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải đấu." };
  }

  if (!isTeamTournament(tournament)) {
    return { ok: false, error: "Giải này không phải giải đồng đội." };
  }

  const nextTournament = updater(tournament);
  if (nextTournament?.ok === false) {
    return nextTournament;
  }

  data.tournaments = data.tournaments.map((item) =>
    item.id === tournament.id ? nextTournament.tournament || nextTournament : item
  );
  saveClubData(clubId, data);

  return {
    ok: true,
    tournament: nextTournament.tournament || nextTournament,
    logs: nextTournament.logs,
    matchupResult: nextTournament.matchupResult,
  };
}

function guardCaptainLineupAction(clubId, tournamentId, teamId) {
  const access = guardClubAction(clubId, PERMISSIONS.TEAM_LINEUP_SUBMIT);
  if (!access.ok) {
    return access;
  }

  const tournament = getTeamTournamentById(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải đồng đội." };
  }

  const { user } = getAuthOptions();
  const playerId = user?.playerId ? String(user.playerId) : "";
  const permissions = getPermissionsForRole(user?.role || "");

  return assertTeamScope(getTeamData(tournament), teamId, playerId, permissions);
}

export function createTeamTournament(clubId, options = {}) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_CREATE);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);
  const tournament = createTeamTournamentShell(clubId, {
    ...options,
    seasonId: options.seasonId || data.active?.seasonId || "",
    leagueId: options.leagueId || data.active?.leagueId || "",
  });

  data.tournaments = [...(data.tournaments || []), tournament];
  saveClubData(clubId, data);

  appendTeamAuditLog({
    action: TEAM_AUDIT_ACTIONS.TEAM_CREATE,
    targetId: tournament.id,
    metadata: { name: tournament.name, mode: TOURNAMENT_MODE.TEAM_TOURNAMENT },
  });

  return { ok: true, tournament };
}

export function patchTeamTournament(clubId, tournamentId, patch = {}) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_UPDATE);
  if (!check.ok) {
    return check;
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const teamData = patch.teamData
      ? normalizeTeamData(patch.teamData)
      : getTeamData(tournament);

    const next = {
      ...tournament,
      ...patch,
      teamData,
      updatedAt: new Date().toISOString(),
    };

    return refreshStandings(next);
  });
}

export async function captainSaveLineup(clubId, tournamentId, payload = {}) {
  const scopeCheck = guardCaptainLineupAction(clubId, tournamentId, payload.teamId);
  if (!scopeCheck.ok) {
    return scopeCheck;
  }

  const cloudCheck = await mirrorMutationToCloud(
    () => cloudCaptainSaveLineup(tournamentId, payload),
    getTeamTournamentById(clubId, tournamentId)
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const existing = getLineup(getTeamData(tournament), payload.matchupId, payload.teamId);
    const result = saveLineupDraft(getTeamData(tournament), payload);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    appendTeamAuditLog({
      action:
        existing?.status === LINEUP_STATUS.SUBMITTED
          ? TEAM_AUDIT_ACTIONS.LINEUP_UPDATE
          : TEAM_AUDIT_ACTIONS.LINEUP_DRAFT,
      targetId: tournament.id,
      metadata: {
        matchupId: payload.matchupId,
        teamId: payload.teamId,
        status: "draft",
        edited: existing?.status === LINEUP_STATUS.SUBMITTED,
      },
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(tournament, result.teamData),
    };
  });
}

export async function captainSubmitLineup(clubId, tournamentId, payload = {}) {
  const scopeCheck = guardCaptainLineupAction(clubId, tournamentId, payload.teamId);
  if (!scopeCheck.ok) {
    return scopeCheck;
  }

  const cloudCheck = await mirrorMutationToCloud(
    () => cloudCaptainSubmitLineup(tournamentId, payload),
    getTeamTournamentById(clubId, tournamentId)
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const existing = getLineup(getTeamData(tournament), payload.matchupId, payload.teamId);
    const wasSubmitted = existing?.status === LINEUP_STATUS.SUBMITTED;

    const result = submitLineup(getTeamData(tournament), payload);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    if (wasSubmitted) {
      appendTeamAuditLog({
        action: TEAM_AUDIT_ACTIONS.LINEUP_UPDATE,
        targetId: tournament.id,
        metadata: {
          matchupId: payload.matchupId,
          teamId: payload.teamId,
          status: "edit_before_lock",
        },
      });
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.LINEUP_SUBMIT,
      targetId: tournament.id,
      metadata: {
        matchupId: payload.matchupId,
        teamId: payload.teamId,
      },
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(tournament, result.teamData),
    };
  });
}

export async function organizerLockLineups(clubId, tournamentId, payload = {}) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_UPDATE);
  if (!check.ok) {
    return check;
  }

  const cloudCheck = await mirrorMutationToCloud(
    () => cloudOrganizerLockLineups(tournamentId, payload),
    getTeamTournamentById(clubId, tournamentId)
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const result = lockMatchupLineups(getTeamData(tournament), payload);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    result.logs?.forEach((message) => {
      appendTeamAuditLog({
        action: message.includes("tự động")
          ? TEAM_AUDIT_ACTIONS.LINEUP_RANDOM
          : TEAM_AUDIT_ACTIONS.LINEUP_LOCK,
        targetId: tournament.id,
        metadata: { matchupId: payload.matchupId, message },
      });
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(tournament, result.teamData),
      logs: result.logs,
    };
  });
}

export async function organizerPublishLineups(clubId, tournamentId, payload = {}) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_UPDATE);
  if (!check.ok) {
    return check;
  }

  const cloudCheck = await mirrorMutationToCloud(
    () => cloudOrganizerPublishLineups(tournamentId, payload),
    getTeamTournamentById(clubId, tournamentId)
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const result = publishMatchupLineups(getTeamData(tournament), payload);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.LINEUP_PUBLISH,
      targetId: tournament.id,
      metadata: { matchupId: payload.matchupId },
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(tournament, result.teamData),
    };
  });
}

function guardRefereeResultAction(clubId) {
  const permissionChecks = [
    PERMISSIONS.TEAM_MATCH_RESULT_MANAGE,
    PERMISSIONS.MATCH_UPDATE,
    PERMISSIONS.TOURNAMENT_UPDATE,
  ];

  let lastFailure = { ok: false, error: "Không có quyền nhập kết quả." };

  for (const permission of permissionChecks) {
    const result = guardClubAction(clubId, permission);
    if (result.ok) {
      const { user } = getAuthOptions();
      return {
        ok: true,
        permissions: getPermissionsForRole(user?.role || ""),
      };
    }
    lastFailure = result;
  }

  return lastFailure;
}

function resolveResultAuditAction(payload = {}, permissions = []) {
  if (payload.confirm) {
    const isOverride =
      payload.override === true && canManageTeam({ permissions });
    return isOverride
      ? TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT_OVERRIDE
      : TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT_CONFIRM;
  }

  return TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT_DRAFT;
}

export async function refereeSaveSubMatchDraft(clubId, tournamentId, payload = {}) {
  const check = guardRefereeResultAction(clubId);
  if (!check.ok) {
    return check;
  }

  const cloudCheck = await mirrorMutationToCloud(
    () => cloudRefereeSaveSubMatchDraft(tournamentId, payload),
    getTeamTournamentById(clubId, tournamentId)
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const result = saveSubMatchDraft(getTeamData(tournament), {
      ...payload,
      permissions: check.permissions,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT_DRAFT,
      targetId: tournament.id,
      metadata: {
        matchupId: payload.matchupId,
        subMatchId: payload.subMatchId,
        score: payload.score,
        games: payload.games,
      },
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(tournament, result.teamData),
      subMatch: result.subMatch,
    };
  });
}

export async function refereeConfirmSubMatch(clubId, tournamentId, payload = {}) {
  const check = guardRefereeResultAction(clubId);
  if (!check.ok) {
    return check;
  }

  const cloudCheck = await mirrorMutationToCloud(
    () => cloudRefereeConfirmSubMatch(tournamentId, payload),
    getTeamTournamentById(clubId, tournamentId)
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const teamData = getTeamData(tournament);
    const validation = validateSubMatchScoreInput({
      ...payload,
      teamData,
      confirm: true,
      permissions: check.permissions,
    });

    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }

    const isOverride =
      validation.subMatch.status === SUB_MATCH_STATUS.COMPLETED &&
      canManageTeam({ permissions: check.permissions });

    const result = confirmSubMatchResult(teamData, {
      ...payload,
      permissions: check.permissions,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    appendTeamAuditLog({
      action: resolveResultAuditAction(
        { confirm: true, override: isOverride },
        check.permissions
      ),
      targetId: tournament.id,
      metadata: {
        matchupId: payload.matchupId,
        subMatchId: payload.subMatchId,
        score: payload.score,
        games: payload.games,
        matchupResult: result.matchupResult,
      },
    });

    return {
      ok: true,
      tournament: refreshStandings(
        attachTeamDataToTournament(tournament, result.teamData)
      ),
      matchupResult: result.matchupResult,
      subMatch: result.subMatch,
    };
  });
}

/** @deprecated Use refereeSaveSubMatchDraft / refereeConfirmSubMatch */
export function refereeRecordSubMatch(clubId, tournamentId, payload = {}) {
  if (payload.confirm) {
    return refereeConfirmSubMatch(clubId, tournamentId, payload);
  }

  if (payload.draft) {
    return refereeSaveSubMatchDraft(clubId, tournamentId, payload);
  }

  const check = guardRefereeResultAction(clubId);
  if (!check.ok) {
    return check;
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const result = recordSubMatchResult(getTeamData(tournament), payload);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT,
      targetId: tournament.id,
      metadata: payload,
    });

    return {
      ok: true,
      tournament: refreshStandings(
        attachTeamDataToTournament(tournament, result.teamData)
      ),
      matchupResult: result.matchupResult,
    };
  });
}

function guardTeamManage(clubId) {
  const teamManage = guardClubAction(clubId, PERMISSIONS.TEAM_MANAGE);
  if (teamManage.ok) {
    return teamManage;
  }
  return guardClubAction(clubId, PERMISSIONS.TOURNAMENT_UPDATE);
}

function applyTeamDataPatch(clubId, tournamentId, mutator) {
  const check = guardTeamManage(clubId);
  if (!check.ok) {
    return check;
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const result = mutator(getTeamData(tournament), tournament);
    if (result?.ok === false) {
      return result;
    }

    return {
      ok: true,
      tournament: attachTeamDataToTournament(tournament, result.teamData),
      audit: result.audit,
    };
  });
}

export async function createTeamInTournament(clubId, tournamentId, options = {}) {
  const check = guardTeamManage(clubId);
  if (!check.ok) {
    return check;
  }

  const tournament = getTeamTournamentById(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải đấu." };
  }

  const teamRecord = createTeamRecord(options);

  const cloudCheck = await mirrorMutationToCloud(
    () => cloudSaveTeam(tournamentId, teamRecord),
    {
      ...tournament,
      tenantId: tournament.tenantId || resolveTenantIdForClub(clubId),
    }
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  return updateTournament(clubId, tournamentId, (current) => {
    const teamData = addTeamToTournament(getTeamData(current), teamRecord);

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_CREATE,
      targetId: current.id,
      metadata: { teamName: teamRecord.name, teamId: teamRecord.id },
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(current, teamData),
    };
  });
}

export function updateTeamDetails(clubId, tournamentId, { teamId, patch = {} }) {
  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournament) => {
    const result = updateTeamProfile(teamData, teamId, patch);
    if (!result.ok) {
      return result;
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_UPDATE,
      targetId: tournament.id,
      metadata: { teamId, patch },
    });

    return { ...result, audit: TEAM_AUDIT_ACTIONS.TEAM_UPDATE };
  });
}

export async function addPlayerToTeamRoster(clubId, tournamentId, { teamId, playerId }) {
  const cloudCheck = await mirrorMutationToCloud(
    () => cloudAssignMember(tournamentId, teamId, playerId),
    getTeamTournamentById(clubId, tournamentId)
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournament) => {
    const result = addPlayerToTeam(teamData, teamId, playerId);
    if (!result.ok) {
      return result;
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_PLAYER_ADD,
      targetId: tournament.id,
      metadata: { teamId, playerId: result.playerId },
    });

    return { ...result, audit: TEAM_AUDIT_ACTIONS.TEAM_PLAYER_ADD };
  });
}

export async function removePlayerFromTeamRoster(clubId, tournamentId, { teamId, playerId }) {
  const cloudCheck = await mirrorMutationToCloud(
    () => cloudRemoveMember(tournamentId, teamId, playerId),
    getTeamTournamentById(clubId, tournamentId)
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournament) => {
    const result = removePlayerFromTeam(teamData, teamId, playerId);
    if (!result.ok) {
      return result;
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_PLAYER_REMOVE,
      targetId: tournament.id,
      metadata: { teamId, playerId: result.playerId },
    });

    return { ...result, audit: TEAM_AUDIT_ACTIONS.TEAM_PLAYER_REMOVE };
  });
}

export async function assignCaptainToTeam(clubId, tournamentId, { teamId, playerId }) {
  const cloudCheck = await mirrorMutationToCloud(
    () => cloudSetCaptain(tournamentId, teamId, playerId, []),
    getTeamTournamentById(clubId, tournamentId)
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournament) => {
    const result = assignTeamCaptain(teamData, teamId, playerId);
    if (!result.ok) {
      return result;
    }

    const action = result.changed && result.previousCaptainId
      ? TEAM_AUDIT_ACTIONS.TEAM_CAPTAIN_CHANGE
      : TEAM_AUDIT_ACTIONS.TEAM_CAPTAIN_ASSIGN;

    appendTeamAuditLog({
      action,
      targetId: tournament.id,
      metadata: {
        teamId,
        playerId: result.playerId,
        previousCaptainId: result.previousCaptainId || null,
      },
    });

    return { ...result, audit: action };
  });
}

export function assignDeputiesToTeam(clubId, tournamentId, { teamId, deputyPlayerIds = [] }) {
  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournament) => {
    const result = assignTeamDeputies(teamData, teamId, deputyPlayerIds);
    if (!result.ok) {
      return result;
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_DEPUTY_ASSIGN,
      targetId: tournament.id,
      metadata: { teamId, deputyPlayerIds: result.deputyPlayerIds },
    });

    return { ...result, audit: TEAM_AUDIT_ACTIONS.TEAM_DEPUTY_ASSIGN };
  });
}

export function getTeamTournamentById(clubId, tournamentId) {
  const data = loadClubData(clubId);
  const tournament = findTournament(data, tournamentId);
  if (!tournament || !isTeamTournament(tournament)) {
    return null;
  }
  return tournament;
}

export async function getTeamTournamentByIdCloud(clubId, tournamentId, viewerTeamId = null) {
  const local = getTeamTournamentById(clubId, tournamentId);
  const cloud = await cloudGetTeamTournamentSetup(tournamentId, viewerTeamId);

  if (cloud.ok && cloud.tournament) {
    return cloud.tournament;
  }

  return local;
}

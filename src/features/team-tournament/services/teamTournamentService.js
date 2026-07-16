import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { getAuthOptions, guardClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { getPermissionsForRole } from "../../identity/matrix/rolePermissions.js";
import { TEAM_AUDIT_ACTIONS, LINEUP_STATUS, SUB_MATCH_STATUS } from "../constants.js";
import {
  loadAthletesForTeamTournamentMutation,
} from "./teamTournamentAthletePoolService.js";
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
import { computeMatchupResult, recordSubMatchResult } from "../engines/teamResultEngine.js";
import {
  confirmSubMatchResult,
  saveSubMatchDraft,
  validateSubMatchScoreInput,
} from "../engines/teamRefereeEngine.js";
import {
  lockDreambreakerOrders,
  recordDreambreakerPoint,
  startDreambreaker,
  submitDreambreakerOrder,
  syncDreambreakerForAllMatchups,
  undoDreambreakerPoint,
} from "../engines/dreambreakerEngine.js";
import {
  forfeitDoublesSubMatch,
  forfeitDreambreakerInjury,
} from "../engines/forfeitEngine.js";
import {
  addPlayerToTeam,
  assignTeamCaptain,
  assignTeamDeputies,
  removePlayerFromTeam,
  updateTeamProfile,
} from "../engines/teamRosterEngine.js";
import {
  hydrateAllTeamRosters,
  hydrateTeamRoster,
} from "../engines/teamRosterHydration.js";
import { addTeamToTournament } from "../engines/teamTournamentEngine.js";
import {
  assertTeamScope,
  canApproveSubstitution,
  canManageTeam,
  canRequestSubstitution,
} from "../engines/teamPermissionEngine.js";
import {
  generateTeamKnockoutMatchups,
  canGenerateTeamKnockout,
} from "../engines/teamKnockoutEngine.js";
import {
  buildClonedTeamForTournament,
  listExistingTeamCatalog,
} from "../engines/existingTeamCatalogEngine.js";
import {
  applyRosterSubstitution,
  getSubstitutionGate,
  listSubstitutionLog,
} from "../engines/substitutionEngine.js";
import {
  freezeTiebreakOrder,
  setTiebreakOrder,
} from "../engines/teamStandingsEngine.js";
import {
  assignAward,
  autoAssignAwardsFromRanking,
  updateAwardsConfig,
} from "../engines/awardsEngine.js";
import {
  assertTeamTournamentOpen,
  closeTeamTournament,
  getTeamTournamentSummary,
  isTeamTournamentClosed,
  previewCloseReadiness,
} from "../engines/teamClosingEngine.js";
import {
  buildProductionUntouchedInventory,
  buildStagingInventoryFromTt5Final,
  evaluateTt5OpsReadiness,
  getS2FSoftGapDisposition,
  summarizeMatchupRefereeOps,
} from "../engines/teamRefereeOpsReadinessEngine.js";
import { buildRealtimeEnableGatesReport } from "../engines/teamRealtimeEnableGatesEngine.js";
import { readTeamTournamentRealtimeEnv } from "../realtime/realtimeFlags.js";
import { normalizeTeamData, getLineup, createTeamRecord, findTeam } from "../models/index.js";
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
import {
  resolveUiTeamTournamentDataMode,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../repositories/teamTournamentRepositoryFactory.js";

function findTournament(data, tournamentId) {
  return (data.tournaments || []).find((item) => item.id === String(tournamentId)) || null;
}

async function mirrorMutationToCloud(cloudCall, tournament) {
  if (shouldUseTeamTournamentCloud() && tournament?.id) {
    const header = await cloudEnsureTournamentHeader({
      ...tournament,
      clubId: tournament.clubId,
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

async function applyOrganizerMutationLocalFirst({
  clubId,
  tournamentId,
  cloudCall,
  applyLocal,
}) {
  const localResult = updateTournament(clubId, tournamentId, applyLocal);
  if (!localResult.ok) {
    return localResult;
  }

  if (!shouldUseTeamTournamentCloud()) {
    return localResult;
  }

  const cloudCheck = await mirrorMutationToCloud(
    cloudCall,
    localResult.tournament || getTeamTournamentById(clubId, tournamentId)
  );

  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return {
      ...localResult,
      warning: cloudCheck.error,
      cloudSyncFailed: true,
      code: cloudCheck.code,
    };
  }

  return localResult;
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

/**
 * Create a Team Tournament draft and verify it is readable from the club blob
 * before returning OK. Callers must not navigate until this returns ok:true.
 *
 * Sync local persist only. Preview/cloud_primary UIs must use
 * createTeamTournamentForUi so the cloud header exists before detail load.
 */
export function createTeamTournament(clubId, options = {}) {
  const resolvedClubId = String(clubId || "").trim();
  if (!resolvedClubId) {
    return {
      ok: false,
      error: "Chưa chọn CLB — không thể tạo giải đồng đội.",
      code: "CLUB_REQUIRED",
    };
  }

  const check = guardClubAction(resolvedClubId, PERMISSIONS.TOURNAMENT_CREATE);
  if (!check.ok) {
    return check;
  }

  let data;
  try {
    data = loadClubData(resolvedClubId);
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Không đọc được dữ liệu CLB để tạo giải.",
      code: "LOAD_FAILED",
    };
  }

  const tournament = createTeamTournamentShell(resolvedClubId, {
    ...options,
    seasonId: options.seasonId || data.active?.seasonId || "",
    leagueId: options.leagueId || data.active?.leagueId || "",
  });

  if (!tournament?.id || !isTeamTournament(tournament)) {
    return {
      ok: false,
      error: "Không tạo được bản nháp giải đồng đội (object không hợp lệ).",
      code: "SHELL_INVALID",
    };
  }

  data.tournaments = [...(data.tournaments || []), tournament];

  try {
    saveClubData(resolvedClubId, data);
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Lưu giải đồng đội thất bại — chưa điều hướng.",
      code: "SAVE_FAILED",
    };
  }

  const saved = getTeamTournamentById(resolvedClubId, tournament.id);
  if (!saved) {
    return {
      ok: false,
      error:
        "Đã ghi nháp nhưng không đọc lại được từ CLB/blob. Không mở trang chi tiết.",
      code: "PERSIST_VERIFY_FAILED",
    };
  }

  appendTeamAuditLog({
    action: TEAM_AUDIT_ACTIONS.TEAM_CREATE,
    targetId: saved.id,
    metadata: { name: saved.name, mode: TOURNAMENT_MODE.TEAM_TOURNAMENT },
  });

  return { ok: true, tournament: saved, clubId: resolvedClubId };
}

function resolveCreateRequiresCloudHeader() {
  try {
    const mode = resolveUiTeamTournamentDataMode();
    return (
      mode === TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY ||
      mode === TEAM_TOURNAMENT_DATA_MODES.CLOUD_ONLY
    );
  } catch {
    return shouldUseTeamTournamentCloud();
  }
}

/**
 * UI create entry: local persist first, then ensure cloud header when store/cloud
 * is enabled. In cloud_primary/cloud_only, cloud header failure blocks navigate
 * (no fake success). Shadow mode keeps local OK and surfaces a warning.
 */
export async function createTeamTournamentForUi(clubId, options = {}) {
  const local = createTeamTournament(clubId, options);
  if (!local.ok) {
    return local;
  }

  if (!shouldUseTeamTournamentCloud()) {
    return local;
  }

  const header = await cloudEnsureTournamentHeader({
    ...local.tournament,
    clubId: local.clubId || local.tournament?.clubId || clubId,
  });

  if (header.ok) {
    return {
      ...local,
      cloudSynced: true,
      tenantId: header.tenantId || local.tournament?.tenantId || null,
    };
  }

  const requiresCloud = resolveCreateRequiresCloudHeader();
  if (requiresCloud) {
    return {
      ok: false,
      error:
        header.error ||
        "Đã lưu nháp local nhưng chưa đồng bộ cloud — không mở trang chi tiết (cloud_primary).",
      code: header.code || "CLOUD_HEADER_FAILED",
      tournament: local.tournament,
      clubId: local.clubId,
      persistedLocally: true,
      cloudSynced: false,
    };
  }

  return {
    ...local,
    warning: header.error || "Đồng bộ cloud tạm thất bại — giải vẫn mở từ blob.",
    cloudSyncFailed: true,
    cloudSynced: false,
  };
}

/**
 * Persist tournament classification (Phân loại giải) for Team Tournament.
 * Cloud_primary: writes header.settings.tournamentLevel (durable) — fail closed.
 */
export async function updateTeamTournamentClassification(
  clubId,
  tournamentId,
  tournamentLevel
) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_UPDATE);
  if (!check.ok) {
    return check;
  }

  const { resolveCertificationForLevel } = await import(
    "../../../models/tournament/tournament.js"
  );

  const local = updateTournament(clubId, tournamentId, (tournament) => {
    const cert = resolveCertificationForLevel(tournamentLevel, tournament);
    const nextSettings = {
      ...(tournament.teamData?.settings || {}),
      tournamentLevel: cert.tournamentLevel,
      certificationStatus: cert.certificationStatus,
      rankingEnabled: cert.rankingEnabled,
    };
    return {
      ...tournament,
      ...cert,
      teamData: {
        ...(tournament.teamData || {}),
        settings: nextSettings,
      },
    };
  });

  if (!local.ok) {
    return local;
  }

  if (!shouldUseTeamTournamentCloud()) {
    return { ...local, cloudSynced: false, cloudRequired: false };
  }

  const header = await cloudEnsureTournamentHeader({
    ...local.tournament,
    clubId: local.tournament?.clubId || clubId,
  });

  if (!header.ok) {
    return {
      ok: false,
      error:
        header.error ||
        "Không lưu được phân loại giải lên cloud — không báo thành công local-only.",
      code: header.code || "CLOUD_HEADER_FAILED",
      tournament: local.tournament,
      cloudSynced: false,
      cloudRequired: true,
    };
  }

  return {
    ...local,
    cloudSynced: true,
    cloudRequired: true,
    tenantId: header.tenantId || local.tournament?.tenantId || null,
  };
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

  return applyOrganizerMutationLocalFirst({
    clubId,
    tournamentId,
    cloudCall: () => cloudOrganizerLockLineups(tournamentId, payload),
    applyLocal: (tournament) => {
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
    },
  });
}

export async function organizerPublishLineups(clubId, tournamentId, payload = {}) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_UPDATE);
  if (!check.ok) {
    return check;
  }

  return applyOrganizerMutationLocalFirst({
    clubId,
    tournamentId,
    cloudCall: () => cloudOrganizerPublishLineups(tournamentId, payload),
    applyLocal: (tournament) => {
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
    },
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

  return applyOrganizerMutationLocalFirst({
    clubId,
    tournamentId,
    cloudCall: () => cloudRefereeSaveSubMatchDraft(tournamentId, payload),
    applyLocal: (tournament) => {
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
        tournament: refreshStandings(
          attachTeamDataToTournament(tournament, result.teamData)
        ),
        subMatch: result.subMatch,
      };
    },
  });
}

export async function refereeConfirmSubMatch(clubId, tournamentId, payload = {}) {
  const check = guardRefereeResultAction(clubId);
  if (!check.ok) {
    return check;
  }

  return applyOrganizerMutationLocalFirst({
    clubId,
    tournamentId,
    cloudCall: () => cloudRefereeConfirmSubMatch(tournamentId, payload),
    applyLocal: (tournament) => {
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

      const synced = syncDreambreakerForAllMatchups(result.teamData, {
        now: new Date().toISOString(),
      });
      const nextTeamData = synced.teamData;

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
          attachTeamDataToTournament(tournament, nextTeamData)
        ),
        matchupResult: result.matchupResult,
        subMatch:
          nextTeamData.matchups
            .find((item) => item.id === payload.matchupId)
            ?.subMatches?.find((item) => item.id === payload.subMatchId) || result.subMatch,
      };
    },
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

function guardExistingTeamView(clubId) {
  const manage = guardTeamManage(clubId);
  if (manage.ok) {
    return manage;
  }
  const select = guardClubAction(clubId, PERMISSIONS.EXISTING_TEAM_SELECT);
  if (select.ok) {
    return select;
  }
  const view = guardClubAction(clubId, PERMISSIONS.EXISTING_TEAM_VIEW);
  if (view.ok) {
    return view;
  }
  return guardClubAction(clubId, PERMISSIONS.TOURNAMENT_VIEW);
}

function guardExistingTeamSelect(clubId) {
  const manage = guardTeamManage(clubId);
  if (manage.ok) {
    return manage;
  }
  const select = guardClubAction(clubId, PERMISSIONS.EXISTING_TEAM_SELECT);
  if (select.ok) {
    return select;
  }
  return guardClubAction(clubId, PERMISSIONS.EXISTING_TEAM_MANAGE);
}

async function mirrorClonedTeamToCloud(tournament, teamRecord) {
  const save = await mirrorMutationToCloud(
    () => cloudSaveTeam(tournament.id, teamRecord),
    {
      ...tournament,
      clubId: tournament.clubId,
      tenantId: tournament.tenantId,
    }
  );
  if (!save.ok && save.usedCloud) {
    return save;
  }
  if (!shouldUseTeamTournamentCloud()) {
    return { ok: true, usedCloud: false };
  }

  for (const playerId of teamRecord.playerIds || []) {
    const assign = await cloudAssignMember(tournament.id, teamRecord.id, playerId);
    if (!assign.ok && assign.usedCloud) {
      return {
        ok: false,
        usedCloud: true,
        error: assign.error || "Không gán được thành viên lên cloud.",
        code: assign.code,
      };
    }
  }

  if (teamRecord.captainPlayerId) {
    const captain = await cloudSetCaptain(
      tournament.id,
      teamRecord.id,
      teamRecord.captainPlayerId,
      teamRecord.deputyPlayerIds || []
    );
    if (!captain.ok && captain.usedCloud) {
      return {
        ok: false,
        usedCloud: true,
        error: captain.error || "Không gán được đội trưởng lên cloud.",
        code: captain.code,
      };
    }
  }

  return { ok: true, usedCloud: true };
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

/**
 * S2-D — Generate group → knockout bracket (keeps RR matchups).
 */
export function generateTeamKnockoutBracket(clubId, tournamentId, options = {}) {
  const check = guardTeamManage(clubId);
  if (!check.ok) {
    return check;
  }

  const tournament = getTeamTournamentById(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải đấu." };
  }

  const open = assertTeamTournamentOpen(getTeamData(tournament), "tạo knockout");
  if (!open.ok) {
    return open;
  }

  const built = generateTeamKnockoutMatchups(getTeamData(tournament), options);
  if (!built.ok) {
    return built;
  }

  return updateTournament(clubId, tournamentId, (current) => {
    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.KNOCKOUT_GENERATE,
      targetId: current.id,
      metadata: {
        qualifiersPerGroup: options.qualifiersPerGroup || 2,
        knockoutMatchCount: built.knockoutMatchCount,
        qualifiedCount: (built.qualified || []).length,
      },
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(current, built.teamData),
      qualified: built.qualified,
      knockoutMatchCount: built.knockoutMatchCount,
    };
  });
}

export function previewTeamKnockoutGate(clubId, tournamentId, options = {}) {
  const tournament = getTeamTournamentById(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, allowed: false, error: "Không tìm thấy giải đấu." };
  }
  return canGenerateTeamKnockout(getTeamData(tournament), options);
}

/**
 * S2-E — Update / freeze tie-break order (blocked after knockout generate).
 */
export function updateTeamTiebreakOrder(clubId, tournamentId, tiebreakOrder = []) {
  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournament) => {
    const result = setTiebreakOrder(teamData, tiebreakOrder);
    if (!result.ok) {
      return result;
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_UPDATE,
      targetId: tournament.id,
      metadata: { tiebreakOrder, field: "tiebreakOrder" },
    });

    return { ok: true, teamData: result.teamData };
  });
}

export function freezeTeamTiebreakOrder(clubId, tournamentId, options = {}) {
  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournament) => {
    const result = freezeTiebreakOrder(teamData, options);
    if (!result.ok) {
      return result;
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_UPDATE,
      targetId: tournament.id,
      metadata: { field: "tiebreakFrozen", reason: options.reason || "manual" },
    });

    return { ok: true, teamData: result.teamData };
  });
}

/**
 * S2-H — Awards config / assign / auto / close.
 */
export function updateTeamAwardsConfig(clubId, tournamentId, patch = {}) {
  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournament) => {
    const result = updateAwardsConfig(teamData, patch);
    if (!result.ok) {
      return result;
    }
    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.AWARDS_UPDATE,
      targetId: tournament.id,
      metadata: { patchKeys: Object.keys(patch || {}) },
    });
    return { ok: true, teamData: result.teamData, awardsConfig: result.awardsConfig };
  });
}

export function assignTeamAward(clubId, tournamentId, awardKey, teamId) {
  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournament) => {
    const result = assignAward(teamData, awardKey, teamId);
    if (!result.ok) {
      return result;
    }
    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.AWARDS_ASSIGN,
      targetId: tournament.id,
      metadata: { awardKey, teamId },
    });
    return { ok: true, teamData: result.teamData };
  });
}

export function autoAssignTeamAwards(clubId, tournamentId, options = {}) {
  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournament) => {
    const result = autoAssignAwardsFromRanking(teamData, options);
    if (!result.ok) {
      return result;
    }
    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.AWARDS_ASSIGN,
      targetId: tournament.id,
      metadata: { mode: "auto", count: (result.awards || []).length },
    });
    return {
      ok: true,
      teamData: result.teamData,
      awards: result.awards,
      ranking: result.ranking,
    };
  });
}

export function closeTeamTournamentForClub(clubId, tournamentId, options = {}) {
  const check = guardTeamManage(clubId);
  if (!check.ok) {
    return check;
  }

  const tournament = getTeamTournamentById(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải đấu." };
  }

  return updateTournament(clubId, tournamentId, (current) => {
    const closed = closeTeamTournament(getTeamData(current), {
      ...options,
      tournamentId: current.id,
      tournamentName: current.name || "",
    });
    if (!closed.ok) {
      return closed;
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TOURNAMENT_CLOSE,
      targetId: current.id,
      metadata: {
        championTeamId: closed.summary?.champion?.teamId || "",
        completedMatchupCount: closed.summary?.completedMatchupCount || 0,
      },
    });

    return {
      ok: true,
      tournament: {
        ...attachTeamDataToTournament(current, closed.teamData),
        status: "completed",
      },
      summary: closed.summary,
    };
  });
}

export function getTeamClosePreview(clubId, tournamentId) {
  const tournament = getTeamTournamentById(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải đấu." };
  }
  const teamData = getTeamData(tournament);
  return {
    ok: true,
    closed: isTeamTournamentClosed(teamData),
    summary: getTeamTournamentSummary(teamData),
    readiness: previewCloseReadiness(teamData),
  };
}

/**
 * S2-F — TT-5 ops readiness report (inventory evaluate; never applies Production SQL).
 */
export function getTeamRefereeOpsReadinessReport(clubId, tournamentId, options = {}) {
  const tournament = tournamentId
    ? getTeamTournamentById(clubId, tournamentId)
    : null;
  const teamData = tournament ? getTeamData(tournament) : null;

  const staging = evaluateTt5OpsReadiness(
    options.stagingInventory || buildStagingInventoryFromTt5Final(options.stagingFlags || {})
  );
  const production = evaluateTt5OpsReadiness(
    options.productionInventory || buildProductionUntouchedInventory(options.productionFlags || {})
  );

  return {
    ok: true,
    productionSqlApplyAllowed: false,
    staging,
    production,
    softGaps: getS2FSoftGapDisposition(),
    liveOps: teamData ? summarizeMatchupRefereeOps(teamData) : null,
    legacyDeprecation: staging.legacyDeprecation,
  };
}

/**
 * S2-G — Realtime enable gates report (Production flag remains Owner-gated).
 */
export function getTeamRealtimeEnableGatesReport(options = {}) {
  return buildRealtimeEnableGatesReport({
    env: options.env || readTeamTournamentRealtimeEnv(),
    stage: options.stage,
    ownerProductionOverride: options.ownerProductionOverride,
    assumeCaptainEvidencePass: options.assumeCaptainEvidencePass,
    captainSecurityVerdict: options.captainSecurityVerdict,
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
      clubId,
      tenantId: tournament.tenantId,
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

/**
 * Persist AI-generated team list (replace teams, clear groups/matchups).
 * cloud_primary: mirrors each team via save_team + members + captain, then verifies get_setup.
 * Never reports success when durable cloud write/verify fails.
 */
export async function applyAiGeneratedTeamsToTournament(
  clubId,
  tournamentId,
  nextTeamData
) {
  const check = guardTeamManage(clubId);
  if (!check.ok) {
    return check;
  }

  const tournament = getTeamTournamentById(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải đấu." };
  }

  const teamData = normalizeTeamData({
    ...getTeamData(tournament),
    ...(nextTeamData && typeof nextTeamData === "object" ? nextTeamData : {}),
    groups: [],
    matchups: [],
  });
  const teams = teamData.teams || [];
  if (!teams.length) {
    return { ok: false, error: "Không có đội để lưu.", code: "EMPTY_TEAMS" };
  }

  const cloudRequired = shouldUseTeamTournamentCloud();
  if (cloudRequired) {
    for (const teamRecord of teams) {
      const mirrored = await mirrorClonedTeamToCloud(
        { ...tournament, clubId, tenantId: tournament.tenantId },
        teamRecord
      );
      if (!mirrored.ok && mirrored.usedCloud) {
        return {
          ok: false,
          error:
            mirrored.error ||
            `Không lưu được đội ${teamRecord.name || teamRecord.id} lên cloud.`,
          code: mirrored.code || "CLOUD_TEAM_SAVE_FAILED",
          cloudSynced: false,
          cloudRequired: true,
        };
      }
    }

    const verified = await cloudGetTeamTournamentSetup(tournamentId);
    if (!verified.ok) {
      return {
        ok: false,
        error:
          verified.error ||
          "Không xác minh được danh sách đội trên cloud sau khi lưu.",
        code: verified.code || "CLOUD_VERIFY_FAILED",
        cloudSynced: false,
        cloudRequired: true,
      };
    }

    const loadedTeams = verified.tournament?.teamData?.teams || [];
    const loadedById = new Map(
      loadedTeams.map((team) => [String(team.id), team])
    );
    const missing = teams.filter((team) => !loadedById.has(String(team.id)));
    if (missing.length) {
      return {
        ok: false,
        error: `Cloud thiếu ${missing.length} đội sau khi lưu — không báo thành công local-only.`,
        code: "CLOUD_TEAMS_MISSING_AFTER_SAVE",
        cloudSynced: false,
        cloudRequired: true,
        missingTeamIds: missing.map((team) => team.id),
      };
    }
  }

  const local = updateTournament(clubId, tournamentId, (current) => {
    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_CREATE,
      targetId: current.id,
      metadata: {
        source: "ai_pairing",
        teamCount: teams.length,
        teamIds: teams.map((team) => team.id),
      },
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(current, teamData),
    };
  });

  if (!local.ok) {
    return local;
  }

  return {
    ...local,
    teamData,
    teamCount: teams.length,
    cloudSynced: cloudRequired,
    cloudRequired,
  };
}

/**
 * S2-B — Catalog of teams already created in other (or all) team tournaments of this club.
 */
export function listExistingTeamsForClub(clubId, options = {}) {
  const check = guardExistingTeamView(clubId);
  if (!check.ok) {
    return { ok: false, error: check.error, code: check.code, entries: [] };
  }

  const data = loadClubData(clubId);
  const tournaments = (data.tournaments || [])
    .filter((item) => isTeamTournament(item))
    .map((item) => ({
      ...item,
      teamData: getTeamData(item),
    }));

  const entries = listExistingTeamCatalog(tournaments, {
    excludeTournamentId: options.excludeTournamentId,
    includeEmpty: options.includeEmpty === true,
  });

  return { ok: true, entries };
}

/**
 * S2-B — Clone an existing team (roster + captain) into the target tournament.
 * Does not share a live registry — creates a new tournament-local team id.
 */
export async function cloneExistingTeamIntoTournament(
  clubId,
  targetTournamentId,
  options = {}
) {
  const check = guardExistingTeamSelect(clubId);
  if (!check.ok) {
    return check;
  }

  const sourceTournamentId = options.sourceTournamentId
    ? String(options.sourceTournamentId)
    : "";
  const sourceTeamId = options.sourceTeamId ? String(options.sourceTeamId) : "";
  if (!sourceTournamentId || !sourceTeamId) {
    return { ok: false, error: "Thiếu đội nguồn để sao chép.", code: "SOURCE_REQUIRED" };
  }

  const target = getTeamTournamentById(clubId, targetTournamentId);
  if (!target) {
    return { ok: false, error: "Không tìm thấy giải đích.", code: "TARGET_MISSING" };
  }

  const sourceTournament = getTeamTournamentById(clubId, sourceTournamentId);
  if (!sourceTournament) {
    return { ok: false, error: "Không tìm thấy giải nguồn.", code: "SOURCE_TOURNAMENT_MISSING" };
  }

  const sourceTeam = findTeam(getTeamData(sourceTournament), sourceTeamId);
  if (!sourceTeam) {
    return { ok: false, error: "Không tìm thấy đội nguồn.", code: "SOURCE_TEAM_MISSING" };
  }

  const built = buildClonedTeamForTournament(sourceTeam, getTeamData(target), {
    name: options.name,
    sourceTournamentId,
    clonedAt: new Date().toISOString(),
  });
  if (!built.ok) {
    return built;
  }

  const teamRecord = built.teamRecord;
  const cloudCheck = await mirrorClonedTeamToCloud(
    { ...target, clubId, tenantId: target.tenantId },
    teamRecord
  );
  if (!cloudCheck.ok && cloudCheck.usedCloud) {
    return { ok: false, error: cloudCheck.error, code: cloudCheck.code };
  }

  const saved = updateTournament(clubId, targetTournamentId, (current) => {
    const teamData = addTeamToTournament(getTeamData(current), teamRecord);

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_CLONE,
      targetId: current.id,
      metadata: {
        teamId: teamRecord.id,
        teamName: teamRecord.name,
        sourceTournamentId,
        sourceTeamId,
        skippedPlayerIds: built.skippedPlayerIds,
      },
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(current, teamData),
    };
  });

  if (!saved.ok) {
    return saved;
  }

  return {
    ...saved,
    team: teamRecord,
    warnings: built.warnings,
    skippedPlayerIds: built.skippedPlayerIds,
  };
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

  const tournament = getTeamTournamentById(clubId, tournamentId);
  const athleteLookup = await loadAthletesForTeamTournamentMutation(clubId, {
    tenantId: tournament?.tenantId || null,
    tournamentId,
    callerName: "teamTournamentService.addPlayerToTeamRoster",
  });
  if (!athleteLookup.ok) {
    return {
      ok: false,
      error: athleteLookup.error || "Không tải được VĐV canonical để thêm vào đội.",
      code: athleteLookup.code || "ATHLETE_POOL_ERROR",
    };
  }

  return applyTeamDataPatch(clubId, tournamentId, (teamData, tournamentRow) => {
    const result = addPlayerToTeam(teamData, teamId, playerId, athleteLookup.athletes);
    if (!result.ok) {
      return result;
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_PLAYER_ADD,
      targetId: tournamentRow.id,
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

/**
 * S2-C — Replace outPlayer with inPlayer on roster before lineup lock/publish.
 * Captain (request) on own team or BTC (approve/manage).
 */
export async function substituteTeamPlayer(clubId, tournamentId, payload = {}) {
  const tournament = getTeamTournamentById(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải đồng đội." };
  }

  const open = assertTeamTournamentOpen(getTeamData(tournament), "thay người");
  if (!open.ok) {
    return open;
  }

  const { user } = getAuthOptions();
  const permissions = getPermissionsForRole(user?.role || "");
  const actorPlayerId = user?.playerId ? String(user.playerId) : "";
  const teamId = payload.teamId ? String(payload.teamId) : "";
  const isBtc =
    canApproveSubstitution({ permissions }) || canManageTeam({ permissions });

  if (isBtc) {
    const manage = guardTeamManage(clubId);
    if (!manage.ok) {
      const approve = guardClubAction(clubId, PERMISSIONS.TEAM_SUBSTITUTION_APPROVE);
      if (!approve.ok) {
        return approve;
      }
    }
  } else {
    if (!canRequestSubstitution({ permissions })) {
      return guardClubAction(clubId, PERMISSIONS.TEAM_SUBSTITUTION_REQUEST);
    }
    const scope = assertTeamScope(
      getTeamData(tournament),
      teamId,
      actorPlayerId,
      permissions
    );
    if (!scope.ok) {
      return scope;
    }
  }

  const athleteLookup = await loadAthletesForTeamTournamentMutation(clubId, {
    tenantId: tournament?.tenantId || null,
    tournamentId,
    callerName: "teamTournamentService.substituteTeamPlayer",
  });
  if (!athleteLookup.ok) {
    return {
      ok: false,
      error: athleteLookup.error || "Không tải được VĐV canonical để thay người.",
      code: athleteLookup.code || "ATHLETE_POOL_ERROR",
    };
  }

  const built = applyRosterSubstitution(
    getTeamData(tournament),
    {
      teamId,
      outPlayerId: payload.outPlayerId,
      inPlayerId: payload.inPlayerId,
      reason: payload.reason,
      actorRole: isBtc ? "btc" : "captain",
      actorPlayerId,
    },
    athleteLookup.athletes
  );
  if (!built.ok) {
    return built;
  }

  const nextTeam = findTeam(built.teamData, teamId);
  if (shouldUseTeamTournamentCloud()) {
    const remove = await mirrorMutationToCloud(
      () => cloudRemoveMember(tournamentId, teamId, String(payload.outPlayerId)),
      { ...tournament, clubId, tenantId: tournament.tenantId }
    );
    if (!remove.ok && remove.usedCloud) {
      return { ok: false, error: remove.error, code: remove.code };
    }
    const assign = await mirrorMutationToCloud(
      () => cloudAssignMember(tournamentId, teamId, String(payload.inPlayerId)),
      { ...tournament, clubId, tenantId: tournament.tenantId }
    );
    if (!assign.ok && assign.usedCloud) {
      return { ok: false, error: assign.error, code: assign.code };
    }
    if (built.entry?.captainChanged && nextTeam?.captainPlayerId) {
      const captain = await mirrorMutationToCloud(
        () =>
          cloudSetCaptain(
            tournamentId,
            teamId,
            nextTeam.captainPlayerId,
            nextTeam.deputyPlayerIds || []
          ),
        { ...tournament, clubId, tenantId: tournament.tenantId }
      );
      if (!captain.ok && captain.usedCloud) {
        return { ok: false, error: captain.error, code: captain.code };
      }
    }
  }

  const saved = updateTournament(clubId, tournamentId, (current) => {
    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.TEAM_SUBSTITUTION,
      targetId: current.id,
      metadata: {
        teamId,
        outPlayerId: payload.outPlayerId,
        inPlayerId: payload.inPlayerId,
        reason: payload.reason || "",
        actorRole: isBtc ? "btc" : "captain",
        substitutionId: built.entry?.id,
      },
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(current, built.teamData),
    };
  });

  if (!saved.ok) {
    return saved;
  }

  return {
    ...saved,
    entry: built.entry,
    warnings: built.warnings,
  };
}

export function getTeamSubstitutionGate(clubId, tournamentId, teamId) {
  const tournament = getTeamTournamentById(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, allowed: false, error: "Không tìm thấy giải đồng đội." };
  }
  return getSubstitutionGate(getTeamData(tournament), teamId);
}

export function getTeamSubstitutionLog(clubId, tournamentId, teamId = "") {
  const tournament = getTeamTournamentById(clubId, tournamentId);
  if (!tournament) {
    return [];
  }
  return listSubstitutionLog(getTeamData(tournament), teamId);
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

/**
 * P0 read-model helper — hydrate every team roster against the canonical athlete pool.
 * Never treats blob roster as identity authority.
 *
 * @param {object|null} teamData
 * @param {object[]} athletePool
 * @param {{ teamMemberRowsByTeamId?: Record<string, object[]> }} [options]
 */
export function buildHydratedTeamRosterReadModel(
  teamData,
  athletePool = [],
  options = {}
) {
  const rowsByTeam = options.teamMemberRowsByTeamId || {};
  const teams = (teamData?.teams || []).map((team) =>
    hydrateTeamRoster({
      team,
      teamMemberRows: rowsByTeam[String(team.id)] || null,
      athletePool,
    })
  );
  return {
    teams,
    unresolvedCount: teams.reduce((sum, team) => sum + team.unresolvedCount, 0),
    memberCount: teams.reduce((sum, team) => sum + team.members.length, 0),
  };
}

/**
 * Convenience wrapper around hydrateAllTeamRosters for service consumers.
 */
export function hydrateTeamTournamentRosters(teamData, athletePool = []) {
  return hydrateAllTeamRosters(teamData, athletePool);
}

export async function getTeamTournamentByIdCloud(clubId, tournamentId, viewerTeamId = null) {
  const local = getTeamTournamentById(clubId, tournamentId);
  const cloud = await cloudGetTeamTournamentSetup(tournamentId, viewerTeamId);

  if (cloud.ok && cloud.tournament) {
    return cloud.tournament;
  }

  return local;
}

export function captainSubmitDreambreakerOrder(clubId, tournamentId, payload = {}) {
  const check = guardCaptainLineupAction(clubId, tournamentId, payload.teamId);
  if (!check.ok) {
    return check;
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const result = submitDreambreakerOrder(getTeamData(tournament), payload);
    if (!result.ok) {
      return result;
    }

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.DREAMBREAKER_ORDER_SUBMIT,
      targetId: tournament.id,
      metadata: payload,
    });

    return {
      ok: true,
      tournament: attachTeamDataToTournament(tournament, result.teamData),
    };
  });
}

export function refereeStartDreambreaker(clubId, tournamentId, { matchupId }) {
  const check = guardRefereeResultAction(clubId);
  if (!check.ok) {
    return check;
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const result = startDreambreaker(getTeamData(tournament), matchupId);
    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      tournament: refreshStandings(
        attachTeamDataToTournament(tournament, result.teamData)
      ),
    };
  });
}

export async function refereeRecordDreambreakerPoint(clubId, tournamentId, payload = {}) {
  const check = guardRefereeResultAction(clubId);
  if (!check.ok) {
    return check;
  }

  return applyOrganizerMutationLocalFirst({
    clubId,
    tournamentId,
    cloudCall: async () => ({ ok: true, usedCloud: false }),
    applyLocal: (tournament) => {
      const result = recordDreambreakerPoint(getTeamData(tournament), payload);
      if (!result.ok) {
        return result;
      }

      appendTeamAuditLog({
        action: TEAM_AUDIT_ACTIONS.DREAMBREAKER_POINT,
        targetId: tournament.id,
        metadata: payload,
      });

      return {
        ok: true,
        tournament: refreshStandings(
          attachTeamDataToTournament(tournament, result.teamData)
        ),
        completed: result.completed,
        winnerTeamId: result.winnerTeamId,
      };
    },
  });
}

export function refereeUndoDreambreakerPoint(clubId, tournamentId, { matchupId }) {
  const check = guardRefereeResultAction(clubId);
  if (!check.ok) {
    return check;
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const result = undoDreambreakerPoint(getTeamData(tournament), matchupId);
    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      tournament: attachTeamDataToTournament(tournament, result.teamData),
    };
  });
}

export async function refereeForfeitSubMatch(clubId, tournamentId, payload = {}) {
  const check = guardRefereeResultAction(clubId);
  if (!check.ok) {
    return check;
  }

  return applyOrganizerMutationLocalFirst({
    clubId,
    tournamentId,
    cloudCall: async () => ({ ok: true, usedCloud: false }),
    applyLocal: (tournament) => {
      let teamData = getTeamData(tournament);
      const forfeitResult = forfeitDoublesSubMatch(teamData, payload);
      if (!forfeitResult.ok) {
        return forfeitResult;
      }

      teamData = forfeitResult.teamData;
      const aggregated = computeMatchupResult(teamData, payload.matchupId);

      appendTeamAuditLog({
        action: TEAM_AUDIT_ACTIONS.SUB_MATCH_FORFEIT,
        targetId: tournament.id,
        metadata: payload,
      });

      return {
        ok: true,
        tournament: refreshStandings(
          attachTeamDataToTournament(tournament, aggregated.teamData)
        ),
      };
    },
  });
}

export function refereeDreambreakerInjury(clubId, tournamentId, payload = {}) {
  const check = guardRefereeResultAction(clubId);
  if (!check.ok) {
    return check;
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const result = forfeitDreambreakerInjury(getTeamData(tournament), payload);
    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      tournament: attachTeamDataToTournament(tournament, result.teamData),
    };
  });
}

export async function organizerSyncDreambreaker(clubId, tournamentId) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_UPDATE);
  if (!check.ok) {
    return check;
  }

  return applyOrganizerMutationLocalFirst({
    clubId,
    tournamentId,
    cloudCall: async () => ({ ok: true, usedCloud: false }),
    applyLocal: (tournament) => {
      const synced = syncDreambreakerForAllMatchups(getTeamData(tournament), {
        now: new Date().toISOString(),
      });

      if (!synced.changed) {
        return { ok: true, tournament, changed: false };
      }

      return {
        ok: true,
        tournament: attachTeamDataToTournament(tournament, synced.teamData),
        changed: true,
      };
    },
  });
}

export async function organizerLockDreambreakerOrders(clubId, tournamentId, payload = {}) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_UPDATE);
  if (!check.ok) {
    return check;
  }

  return applyOrganizerMutationLocalFirst({
    clubId,
    tournamentId,
    cloudCall: async () => ({ ok: true, usedCloud: false }),
    applyLocal: (tournament) => {
      const result = lockDreambreakerOrders(getTeamData(tournament), payload.matchupId, {
        now: payload.now || new Date().toISOString(),
        force: true,
      });

      if (!result.teamData) {
        return { ok: false, error: result.error || "Không khóa được thứ tự Dreambreaker." };
      }

      result.logs?.forEach((message) => {
        appendTeamAuditLog({
          action: message.includes("Tự động")
            ? TEAM_AUDIT_ACTIONS.LINEUP_RANDOM
            : TEAM_AUDIT_ACTIONS.DREAMBREAKER_ORDER_LOCK,
          targetId: tournament.id,
          metadata: { matchupId: payload.matchupId, message },
        });
      });

      appendTeamAuditLog({
        action: TEAM_AUDIT_ACTIONS.DREAMBREAKER_ORDER_LOCK,
        targetId: tournament.id,
        metadata: { matchupId: payload.matchupId, partial: !result.ok },
      });

      return {
        ok: true,
        warning: result.ok ? undefined : result.error,
        tournament: attachTeamDataToTournament(tournament, result.teamData),
        logs: result.logs,
        dreambreakerLocked: result.ok,
      };
    },
  });
}

export function refereeLockDreambreakerOrders(clubId, tournamentId, { matchupId }) {
  const check = guardRefereeResultAction(clubId);
  if (!check.ok) {
    return check;
  }

  return updateTournament(clubId, tournamentId, (tournament) => {
    const result = lockDreambreakerOrders(getTeamData(tournament), matchupId, {
      now: new Date().toISOString(),
      force: true,
    });

    if (!result.teamData) {
      return { ok: false, error: result.error || "Không khóa được thứ tự Dreambreaker." };
    }

    result.logs?.forEach((message) => {
      appendTeamAuditLog({
        action: message.includes("Tự động")
          ? TEAM_AUDIT_ACTIONS.LINEUP_RANDOM
          : TEAM_AUDIT_ACTIONS.DREAMBREAKER_ORDER_LOCK,
        targetId: tournament.id,
        metadata: { matchupId, message },
      });
    });

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.DREAMBREAKER_ORDER_LOCK,
      targetId: tournament.id,
      metadata: { matchupId, partial: !result.ok },
    });

    return {
      ok: true,
      warning: result.ok ? undefined : result.error,
      tournament: attachTeamDataToTournament(tournament, result.teamData),
      logs: result.logs,
      dreambreakerLocked: result.ok,
    };
  });
}

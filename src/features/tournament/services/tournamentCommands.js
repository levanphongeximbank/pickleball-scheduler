/**
 * Canonical Tournament write commands — async cloud writer authority.
 */
import { getTournamentRepository } from "../repositories/tournamentRepositoryFactory.js";
import { createTeamTournamentForUi } from "../../team-tournament/services/teamTournamentService.js";
import { TOURNAMENT_MODE, OFFICIAL_MODE } from "../../../models/tournament/constants.js";
import { modeLabelVi } from "../constants/tournamentLabels.js";
import {
  resolveTeamTournamentDataMode,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../../team-tournament/repositories/teamTournamentDataMode.js";
import { resolveTournamentTenantScope } from "../guards/tournamentTenant.js";

function buildDefaultName(mode) {
  const date = new Date().toLocaleDateString("vi-VN");
  return `${modeLabelVi(mode)} ${date}`;
}

function prepareScope(clubIdOrScope, options = {}) {
  return resolveTournamentTenantScope(clubIdOrScope, options);
}

export const PROVIDED_COURT_AUTH_CODE = Object.freeze({
  ZERO_COURTS_SELECTED: "ZERO_COURTS_SELECTED",
  COURT_TENANT_FORBIDDEN: "COURT_TENANT_FORBIDDEN",
  COURT_NOT_IN_AUTHORIZED_SET: "COURT_NOT_IN_AUTHORIZED_SET",
  COURT_INACTIVE: "COURT_INACTIVE",
});

/**
 * Authorize an explicitly provided court list for tournament booking.
 * Does not discover courts. Does not fall back to localStorage.
 * Fail-closed on empty, wrong-tenant/club stamp, or selected id outside the set.
 */
export function authorizeProvidedTournamentCourts(
  courts,
  scope = {},
  selectedCourtIds = []
) {
  if (!Array.isArray(courts) || courts.length === 0) {
    return {
      ok: false,
      error: "Chưa có sân khả dụng cho đơn vị hiện tại.",
      code: PROVIDED_COURT_AUTH_CODE.ZERO_COURTS_SELECTED,
    };
  }

  const clubId = String(scope.clubId || "").trim();
  const tenantId = String(scope.tenantId || "").trim();
  const foreign = courts.filter((court) => {
    if (!court || court.id == null || String(court.id).trim() === "") {
      return true;
    }
    const courtTenant = String(court.tenantId || court.venueId || "").trim();
    const courtClub = String(court.clubId || "").trim();
    if (tenantId && courtTenant && courtTenant !== tenantId) {
      return true;
    }
    if (clubId && courtClub && courtClub !== clubId) {
      return true;
    }
    return false;
  });
  if (foreign.length) {
    return {
      ok: false,
      error: "Sân không thuộc đơn vị hiện tại.",
      code: PROVIDED_COURT_AUTH_CODE.COURT_TENANT_FORBIDDEN,
    };
  }

  const allowedIds = new Set(courts.map((court) => String(court.id)));
  const selected = (selectedCourtIds || []).map(String).filter(Boolean);
  if (selected.some((id) => !allowedIds.has(id))) {
    return {
      ok: false,
      error: "Sân chọn không nằm trong danh sách đã được phép.",
      code: PROVIDED_COURT_AUTH_CODE.COURT_NOT_IN_AUTHORIZED_SET,
    };
  }

  return { ok: true, courts };
}

export const COURT_LOCK_CODE = Object.freeze({
  BOOKING_PUSH_FAILED: "CANONICAL_BOOKING_PUSH_FAILED",
  READBACK_MISMATCH: "COURT_SCHEDULE_READBACK_MISMATCH",
  COMPENSATION_FAILED: "COURT_LOCK_COMPENSATION_FAILED",
  BOOKING_TOURNAMENT_INCONSISTENT: "BOOKING_TOURNAMENT_SCHEDULE_INCONSISTENT",
  TOURNAMENT_PATCH_FAILED: "COURT_LOCK_TOURNAMENT_PATCH_FAILED",
});

async function resolveSyncClubToCloud(options = {}) {
  if (typeof options.syncClubToCloud === "function") {
    return options.syncClubToCloud;
  }
  const { syncClubToCloud } = await import("../../../ai/cloudSync.js");
  return syncClubToCloud;
}

async function pushOfficialClubBookings(clubId, syncClubToCloud) {
  try {
    const pushed = await syncClubToCloud({ clubId });
    if (!pushed?.ok) {
      return {
        ok: false,
        error: pushed?.error || "Không thể tạo booking canonical.",
        code: pushed?.code || COURT_LOCK_CODE.BOOKING_PUSH_FAILED,
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Không thể tạo booking canonical.",
      code: COURT_LOCK_CODE.BOOKING_PUSH_FAILED,
    };
  }
}

async function compensateOfficialCourtLock({
  clubId,
  priorOccupancyBookings,
  persistSnapshot,
  syncClubToCloud,
}) {
  const { restoreCanonicalTournamentBookingSnapshot } = await import(
    "../../../domain/tournamentBookingService.js"
  );
  const restored = restoreCanonicalTournamentBookingSnapshot({
    clubId,
    priorOccupancyBookings,
    persistSnapshot,
  });
  if (!restored.ok) {
    return {
      ok: false,
      code: COURT_LOCK_CODE.COMPENSATION_FAILED,
      error:
        restored.message ||
        "Không hoàn tác được booking sau khi lưu giải thất bại.",
    };
  }
  const pushed = await pushOfficialClubBookings(clubId, syncClubToCloud);
  if (!pushed.ok) {
    return {
      ok: false,
      code: COURT_LOCK_CODE.COMPENSATION_FAILED,
      error: "Không hoàn tác được booking sau khi lưu giải thất bại.",
    };
  }
  return { ok: true };
}

export async function createTournamentCommand(clubIdOrScope, input = {}, options = {}) {
  const scope = prepareScope(clubIdOrScope, options);
  if (!scope.ok) {
    return scope;
  }

  const repo = options.repository || getTournamentRepository();
  const mode = input.mode;
  const name = String(input.name || buildDefaultName(mode)).trim();
  const repoOptions = { ...options, tenantId: scope.tenantId };

  if (mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
    try {
      const modeNow = resolveTeamTournamentDataMode({ allowFutureModes: true });
      if (
        modeNow !== TEAM_TOURNAMENT_DATA_MODES.CLOUD_ONLY &&
        modeNow !== TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY &&
        modeNow !== TEAM_TOURNAMENT_DATA_MODES.SHADOW
      ) {
        // Prefer cloud_only when cutover flag set; otherwise still use existing TT service.
      }
    } catch {
      // TT mode guard may throw without supabase in unit tests — service handles errors.
    }
    return createTeamTournamentForUi(scope.clubId, {
      name,
      seasonId: input.seasonId,
      leagueId: input.leagueId,
      formatPreset: input.formatPreset || "mlp_4",
      runtimeTenantId: scope.tenantId,
      tenantId: scope.tenantId,
      createdBy: input.createdBy || input.ownerPlayerId || null,
      ownerPlayerId: input.ownerPlayerId || input.createdBy || null,
    });
  }

  return repo.create(scope.clubId, {
    name,
    mode,
    officialMode:
      mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT
        ? input.officialMode || OFFICIAL_MODE.OPEN
        : undefined,
    hostClubName: input.hostClubName,
    seasonId: input.seasonId,
    leagueId: input.leagueId,
    createdBy: input.createdBy,
    ownerPlayerId: input.ownerPlayerId,
    ...(input.extra || {}),
    ...repoOptions,
  });
}

export async function updateTournamentCommand(
  clubIdOrScope,
  tournamentId,
  patch = {},
  options = {}
) {
  const scope = prepareScope(clubIdOrScope, options);
  if (!scope.ok) return scope;
  const repo = options.repository || getTournamentRepository();
  const { processMatchId, processEventId, ...repoOptions } = options;
  const result = await repo.update(scope.clubId, tournamentId, patch, {
    ...repoOptions,
    tenantId: scope.tenantId,
  });

  // Contract B: score/update command explicitly invokes canonical lifecycle
  // after cloud persistence succeeds. Cloud repository never owns side-effects.
  // Match authority is result.tournament (canonical), not legacy club blob.
  if (!result?.ok || !processMatchId) {
    return result;
  }

  const { processCanonicalCompletedMatch } = await import(
    "./tournamentMatchLifecycle.js"
  );
  const lifecycle = processCanonicalCompletedMatch(
    scope.clubId,
    result.tournament,
    processMatchId,
    { eventId: processEventId || null }
  );

  if (lifecycle?.ok === false) {
    return {
      ...result,
      lifecycleOk: false,
      lifecycleError:
        lifecycle.error || "Đã lưu kết quả nhưng cập nhật Elo/điểm mùa thất bại.",
      lifecycle,
    };
  }

  return {
    ...result,
    lifecycleOk: true,
    lifecycle,
  };
}

export async function deleteTournamentCommand(clubIdOrScope, tournamentId, options = {}) {
  const scope = prepareScope(clubIdOrScope, options);
  if (!scope.ok) return scope;
  const repo = options.repository || getTournamentRepository();
  return repo.delete(scope.clubId, tournamentId, {
    ...options,
    tenantId: scope.tenantId,
  });
}

export async function applyEngineV4StateCommand(
  clubIdOrScope,
  tournamentId,
  engineState,
  options = {}
) {
  const scope = prepareScope(clubIdOrScope, options);
  if (!scope.ok) return scope;
  const repo = options.repository || getTournamentRepository();
  return repo.applyEngineState(scope.clubId, tournamentId, engineState, {
    ...options,
    tenantId: scope.tenantId,
  });
}

export async function setTournamentStatusCommand(
  clubIdOrScope,
  tournamentId,
  status,
  options = {}
) {
  return updateTournamentCommand(clubIdOrScope, tournamentId, { status }, options);
}

/**
 * Lock courts for a tournament: booking bridge (club calendar) + cloud Tournament patch.
 * Does not use club blob as Tournament SoT.
 */
export async function setTournamentCourtScheduleCommand(
  clubIdOrScope,
  tournamentId,
  scheduleInput,
  options = {}
) {
  const scope = prepareScope(clubIdOrScope, options);
  if (!scope.ok) return scope;

  const { normalizeCourtSchedule, courtScheduleFieldsMatch } = await import(
    "../../../models/tournament/courtSchedule.js"
  );
  const { syncTournamentCourtBookings, tournamentOwnedBookingsMatchCourtSchedule } =
    await import("../../../domain/tournamentBookingService.js");
  const { loadCourtsForClub } = await import("../../../domain/clubStorage.js");
  const { getTournamentQuery } = await import("./tournamentQueries.js");

  const loaded = await getTournamentQuery(scope.clubId, tournamentId, {
    ...options,
    tenantId: scope.tenantId,
  });
  if (!loaded.ok || !loaded.tournament) {
    return { ok: false, error: loaded.error || "Không tìm thấy giải." };
  }

  const courtSchedule = normalizeCourtSchedule(scheduleInput);
  if (!courtSchedule) {
    return {
      ok: false,
      error: "Vui lòng chọn ngày, giờ và ít nhất một sân.",
    };
  }

  const pending = {
    ...loaded.tournament,
    courtSchedule: {
      ...courtSchedule,
      syncedAt: new Date().toISOString(),
    },
    id: tournamentId,
    clubId: scope.clubId,
    tenantId: scope.tenantId,
    updatedAt: new Date().toISOString(),
  };

  const courtsProvided = Object.prototype.hasOwnProperty.call(options, "courts");
  let courts;
  if (courtsProvided) {
    const { readCanonicalClubCourtBookingSnapshot } = await import(
      "../../team-tournament/services/canonicalClubCourtInventory.js"
    );
    const readSnapshot =
      typeof options.readCanonicalClubCourtBookingSnapshot === "function"
        ? options.readCanonicalClubCourtBookingSnapshot
        : readCanonicalClubCourtBookingSnapshot;
    const snapshot = await readSnapshot({
      clubId: scope.clubId,
      tenantId: scope.tenantId,
      includeInactive: true,
    });
    if (!snapshot.ok) {
      return {
        ok: false,
        error:
          snapshot.error ||
          "Chưa thể xác minh xung đột lịch sân từ nguồn canonical.",
        code: snapshot.code || "CANONICAL_OCCUPANCY_UNAVAILABLE",
        tournament: loaded.tournament,
        tournamentPatchAttempted: false,
      };
    }
    if (!snapshot.clubData) {
      return {
        ok: false,
        error: "Không thể tạo booking canonical.",
        code: snapshot.code || "CLUB_BLOB_MISSING",
        tournament: loaded.tournament,
        tournamentPatchAttempted: false,
      };
    }

    const selectedIds = (courtSchedule.courtIds || []).map(String);
    for (const courtId of selectedIds) {
      const live = (snapshot.courts || []).find(
        (court) => String(court.id) === courtId
      );
      if (!live) {
        return {
          ok: false,
          error: "Sân không còn thuộc đơn vị hiện tại.",
          code: PROVIDED_COURT_AUTH_CODE.COURT_NOT_IN_AUTHORIZED_SET,
          tournament: loaded.tournament,
          tournamentPatchAttempted: false,
        };
      }
      if (live.active === false) {
        return {
          ok: false,
          error: "Sân đã bị vô hiệu hóa.",
          code: PROVIDED_COURT_AUTH_CODE.COURT_INACTIVE,
          tournament: loaded.tournament,
          tournamentPatchAttempted: false,
        };
      }
    }

    const activeCourts = (snapshot.courts || []).filter(
      (court) => court.active !== false
    );
    const authorized = authorizeProvidedTournamentCourts(
      activeCourts,
      scope,
      courtSchedule.courtIds
    );
    if (!authorized.ok) {
      return {
        ...authorized,
        tournament: loaded.tournament,
        tournamentPatchAttempted: false,
      };
    }
    courts = authorized.courts;
    const priorOccupancyBookings = JSON.parse(
      JSON.stringify(snapshot.bookings || [])
    );
    const syncResult = syncTournamentCourtBookings(pending, scope.clubId, courts, {
      canonicalOccupancy: true,
      occupancyBookings: snapshot.bookings,
      persistSnapshot: snapshot.clubData,
      authorizedCourts: courts,
    });
    if (!syncResult.ok) {
      return {
        ...syncResult,
        ok: false,
        error: syncResult.message,
        code: syncResult.code || null,
        tournament: loaded.tournament,
        tournamentPatchAttempted: false,
      };
    }

    const syncClubToCloud = await resolveSyncClubToCloud(options);
    const pushed = await pushOfficialClubBookings(scope.clubId, syncClubToCloud);
    if (!pushed.ok) {
      return {
        ...syncResult,
        ok: false,
        error: pushed.error,
        code: pushed.code || COURT_LOCK_CODE.BOOKING_PUSH_FAILED,
        tournament: loaded.tournament,
        tournamentPatchAttempted: false,
        compensationAttempted: false,
      };
    }

    const saved = await updateTournamentCommand(
      scope.clubId,
      tournamentId,
      { courtSchedule: pending.courtSchedule },
      { ...options, tenantId: scope.tenantId }
    );
    const failAfterBookingPush = async (error, code) => {
      const compensation = await compensateOfficialCourtLock({
        clubId: scope.clubId,
        priorOccupancyBookings,
        persistSnapshot: snapshot.clubData,
        syncClubToCloud,
      });
      return {
        ...syncResult,
        ok: false,
        error: compensation.ok
          ? error
          : compensation.error || error,
        code: compensation.ok ? code : COURT_LOCK_CODE.COMPENSATION_FAILED,
        tournament: loaded.tournament,
        tournamentPatchAttempted: true,
        courtScheduleReadbackVerified: false,
        compensationAttempted: true,
        compensationOk: compensation.ok,
      };
    };
    if (!saved.ok) {
      return failAfterBookingPush(
        saved.error || "Không lưu được lịch sân của giải.",
        saved.code || COURT_LOCK_CODE.TOURNAMENT_PATCH_FAILED
      );
    }

    const readback = await getTournamentQuery(scope.clubId, tournamentId, {
      ...options,
      tenantId: scope.tenantId,
    });
    if (
      !readback.ok ||
      !courtScheduleFieldsMatch(
        readback.tournament?.courtSchedule,
        pending.courtSchedule
      )
    ) {
      return failAfterBookingPush(
        "Không xác minh được lịch sân đã lưu. Không khóa sân.",
        COURT_LOCK_CODE.READBACK_MISMATCH
      );
    }

    const proof = await readSnapshot({
      clubId: scope.clubId,
      tenantId: scope.tenantId,
      includeInactive: true,
    });
    if (
      !proof.ok ||
      !tournamentOwnedBookingsMatchCourtSchedule(proof.bookings, {
        id: tournamentId,
        courtSchedule: pending.courtSchedule,
      })
    ) {
      return {
        ...syncResult,
        ok: false,
        error: "Lịch sân giải và booking canonical không khớp. Hãy khóa lại sân.",
        code: COURT_LOCK_CODE.BOOKING_TOURNAMENT_INCONSISTENT,
        tournament: readback.tournament,
        tournamentPatchAttempted: true,
        courtScheduleReadbackVerified: true,
        compensationAttempted: false,
      };
    }

    return {
      ...syncResult,
      ok: true,
      tournament: readback.tournament,
      tournamentPatchAttempted: true,
      courtScheduleReadbackVerified: true,
      bookingTournamentScheduleConsistent: true,
      compensationAttempted: false,
    };
  } else {
    courts = loadCourtsForClub(scope.clubId);
  }
  const syncResult = syncTournamentCourtBookings(pending, scope.clubId, courts);
  if (!syncResult.ok) {
    return {
      ...syncResult,
      ok: false,
      error: syncResult.message,
      code: syncResult.code || null,
      tournament: loaded.tournament,
    };
  }

  const saved = await updateTournamentCommand(
    scope.clubId,
    tournamentId,
    { courtSchedule: pending.courtSchedule },
    { ...options, tenantId: scope.tenantId }
  );
  if (!saved.ok) {
    return saved;
  }

  return {
    ...syncResult,
    ok: true,
    tournament: saved.tournament,
  };
}

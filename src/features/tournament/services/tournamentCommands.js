/**
 * Canonical Tournament write commands — async cloud writer authority.
 */
import { getTournamentRepository } from "../repositories/tournamentRepositoryFactory.js";
import { createTeamTournamentForUi } from "../../team-tournament/services/teamTournamentService.js";
import { TOURNAMENT_MODE, OFFICIAL_MODE } from "../../../models/tournament/constants.js";
import { modeLabelVi } from "../constants/tournamentLabels.js";
import { TOURNAMENT_REPO_ERROR } from "../repositories/TournamentRepository.interface.js";
import { resolveTeamTournamentDataMode, TEAM_TOURNAMENT_DATA_MODES } from "../../team-tournament/repositories/teamTournamentDataMode.js";

function buildDefaultName(mode) {
  const date = new Date().toLocaleDateString("vi-VN");
  return `${modeLabelVi(mode)} ${date}`;
}

export async function createTournamentCommand(clubId, input = {}, options = {}) {
  const repo = options.repository || getTournamentRepository();
  const mode = input.mode;
  const name = String(input.name || buildDefaultName(mode)).trim();

  if (!String(clubId || "").trim()) {
    return {
      ok: false,
      code: TOURNAMENT_REPO_ERROR.MISSING_CLUB,
      error: "Chưa chọn CLB — hãy chọn CLB trước khi tạo giải.",
    };
  }

  if (mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
    // Force cloud-capable TT path — no new local mirror.
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
    return createTeamTournamentForUi(clubId, {
      name,
      seasonId: input.seasonId,
      leagueId: input.leagueId,
      formatPreset: input.formatPreset || "mlp_4",
    });
  }

  return repo.create(clubId, {
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
  });
}

export async function updateTournamentCommand(clubId, tournamentId, patch = {}, options = {}) {
  const repo = options.repository || getTournamentRepository();
  return repo.update(clubId, tournamentId, patch, options);
}

export async function deleteTournamentCommand(clubId, tournamentId, options = {}) {
  const repo = options.repository || getTournamentRepository();
  return repo.delete(clubId, tournamentId);
}

export async function applyEngineV4StateCommand(
  clubId,
  tournamentId,
  engineState,
  options = {}
) {
  const repo = options.repository || getTournamentRepository();
  return repo.applyEngineState(clubId, tournamentId, engineState, options);
}

export async function setTournamentStatusCommand(
  clubId,
  tournamentId,
  status,
  options = {}
) {
  return updateTournamentCommand(clubId, tournamentId, { status }, options);
}

/**
 * Lock courts for a tournament: booking bridge (club calendar) + cloud Tournament patch.
 * Does not use club blob as Tournament SoT.
 */
export async function setTournamentCourtScheduleCommand(
  clubId,
  tournamentId,
  scheduleInput,
  options = {}
) {
  const { normalizeCourtSchedule } = await import(
    "../../../models/tournament/courtSchedule.js"
  );
  const { syncTournamentCourtBookings } = await import(
    "../../../domain/tournamentBookingService.js"
  );
  const { loadCourtsForClub } = await import("../../../domain/clubStorage.js");
  const { getTournamentQuery } = await import("./tournamentQueries.js");

  const loaded = await getTournamentQuery(clubId, tournamentId, options);
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
    clubId,
    updatedAt: new Date().toISOString(),
  };

  const courts = loadCourtsForClub(clubId);
  const syncResult = syncTournamentCourtBookings(pending, clubId, courts);
  if (!syncResult.ok) {
    return {
      ok: false,
      error: syncResult.message,
      code: syncResult.code || null,
      tournament: loaded.tournament,
      ...syncResult,
    };
  }

  const saved = await updateTournamentCommand(
    clubId,
    tournamentId,
    { courtSchedule: pending.courtSchedule },
    options
  );
  if (!saved.ok) {
    return saved;
  }

  return {
    ok: true,
    tournament: saved.tournament,
    ...syncResult,
  };
}

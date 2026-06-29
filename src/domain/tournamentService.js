import { getActiveClubId } from "../data/club.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { guardClubAction, guardDirectorAction } from "../auth/guardAction.js";
import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  createTournamentRecord,
  normalizeTournament,
} from "../models/tournament/index.js";
import { loadClubData, loadCourtsForClub, saveClubData } from "./clubStorage.js";
import { normalizeCourtSchedule } from "../models/tournament/courtSchedule.js";
import {
  cancelTournamentCourtBookings,
  syncTournamentCourtBookings,
} from "./tournamentBookingService.js";
import { ensureTournamentLeagueRound } from "./leagueRoundService.js";
import { processCompletedMatchById } from "./tournamentLifecycle.js";

const ALLOWED_STATUS_TRANSITIONS = {
  [TOURNAMENT_STATUS.DRAFT]: [
    TOURNAMENT_STATUS.REGISTRATION,
    TOURNAMENT_STATUS.CANCELLED,
  ],
  [TOURNAMENT_STATUS.REGISTRATION]: [
    TOURNAMENT_STATUS.READY,
    TOURNAMENT_STATUS.DRAFT,
    TOURNAMENT_STATUS.CANCELLED,
  ],
  [TOURNAMENT_STATUS.READY]: [
    TOURNAMENT_STATUS.ACTIVE,
    TOURNAMENT_STATUS.REGISTRATION,
    TOURNAMENT_STATUS.CANCELLED,
  ],
  [TOURNAMENT_STATUS.ACTIVE]: [
    TOURNAMENT_STATUS.COMPLETED,
    TOURNAMENT_STATUS.CANCELLED,
  ],
  [TOURNAMENT_STATUS.COMPLETED]: [],
  [TOURNAMENT_STATUS.CANCELLED]: [TOURNAMENT_STATUS.DRAFT],
};

function findTournamentIndex(tournaments, tournamentId) {
  return tournaments.findIndex((item) => item.id === tournamentId);
}

function tournamentHasGroups(tournament) {
  return (tournament.events || []).some(
    (event) => Array.isArray(event.groups) && event.groups.length > 0
  );
}

function canActivateTournament(tournament) {
  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return { ok: true };
  }

  if (!tournamentHasGroups(tournament)) {
    return {
      ok: false,
      error: "Khong the kich hoat giai khi chua co bang dau.",
    };
  }

  return { ok: true };
}

function canCompleteTournament(tournament, options = {}) {
  if (options.force) {
    return { ok: true };
  }

  const pendingMatches = (tournament.events || []).flatMap((event) => {
    const groupMatches = (event.groups || []).flatMap((group) => group.matches || []);
    const eventMatches = event.matches || [];
    return [...groupMatches, ...eventMatches];
  });

  const hasPending = pendingMatches.some(
    (match) =>
      match.status !== "completed" &&
      match.status !== "forfeit" &&
      match.status !== "postponed"
  );

  if (hasPending) {
    return {
      ok: false,
      error: "Con tran chua hoan tat. BTC can xac nhan ket thuc thu cong.",
    };
  }

  return { ok: true };
}

function buildStatusTransitionPath(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return [];
  }

  const visited = new Set([fromStatus]);
  const queue = [{ status: fromStatus, path: [] }];

  while (queue.length > 0) {
    const { status, path } = queue.shift();
    const nextStatuses = ALLOWED_STATUS_TRANSITIONS[status] || [];

    for (const nextStatus of nextStatuses) {
      const nextPath = [...path, nextStatus];

      if (nextStatus === toStatus) {
        return nextPath;
      }

      if (!visited.has(nextStatus)) {
        visited.add(nextStatus);
        queue.push({ status: nextStatus, path: nextPath });
      }
    }
  }

  return null;
}

export function advanceTournamentStatus(
  clubId,
  tournamentId,
  targetStatus,
  patch = {},
  options = {}
) {
  const tournament = getTournament(clubId, tournamentId);

  if (!tournament) {
    return { ok: false, error: "Khong tim thay giai." };
  }

  const { status: patchStatus, ...dataPatch } = patch;
  const target = patchStatus || targetStatus;

  if (Object.keys(dataPatch).length > 0) {
    const dataResult = updateTournament(clubId, tournamentId, dataPatch);
    if (!dataResult.ok) {
      return dataResult;
    }
  }

  const current = getTournament(clubId, tournamentId);

  if (!target || current.status === target) {
    return { ok: true, tournament: current };
  }

  const path = buildStatusTransitionPath(current.status, target);

  if (!path) {
    return {
      ok: false,
      error: `Khong the chuyen tu ${current.status} sang ${target}.`,
    };
  }

  for (const stepStatus of path) {
    const stepResult = setTournamentStatus(clubId, tournamentId, stepStatus, options);
    if (!stepResult.ok) {
      return stepResult;
    }
  }

  return { ok: true, tournament: getTournament(clubId, tournamentId) };
}

export function validateTournamentStatusChange(tournament, nextStatus, options = {}) {
  const currentStatus = tournament.status || TOURNAMENT_STATUS.DRAFT;
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      error: `Khong the chuyen tu ${currentStatus} sang ${nextStatus}.`,
    };
  }

  if (nextStatus === TOURNAMENT_STATUS.ACTIVE) {
    return canActivateTournament(tournament);
  }

  if (nextStatus === TOURNAMENT_STATUS.COMPLETED) {
    return canCompleteTournament(tournament, options);
  }

  return { ok: true };
}

export function listTournaments(clubId = getActiveClubId(), filters = {}) {
  const data = loadClubData(clubId);
  let tournaments = data.tournaments || [];

  if (filters.seasonId) {
    tournaments = tournaments.filter((item) => item.seasonId === filters.seasonId);
  }

  if (filters.leagueId) {
    tournaments = tournaments.filter((item) => item.leagueId === filters.leagueId);
  }

  if (filters.mode) {
    tournaments = tournaments.filter((item) => item.mode === filters.mode);
  }

  if (filters.status) {
    tournaments = tournaments.filter((item) => item.status === filters.status);
  }

  return tournaments;
}

export function getTournament(clubId, tournamentId) {
  const data = loadClubData(clubId);
  return data.tournaments.find((item) => item.id === tournamentId) || null;
}

export function createTournament(clubId, options = {}) {
  const trimmed = String(options.name || "").trim();

  if (trimmed === "") {
    return { ok: false, error: "Ten giai khong duoc de trong." };
  }

  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_MANAGE);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);
  const seasonId = options.seasonId || data.active.seasonId || "";
  const leagueId = options.leagueId || data.active.leagueId || "";

  const tournament = createTournamentRecord(clubId, {
    ...options,
    name: trimmed,
    seasonId,
    leagueId,
  });

  data.tournaments = [...(data.tournaments || []), tournament];
  saveClubData(clubId, data);

  ensureTournamentLeagueRound(clubId, tournament);

  const refreshed = loadClubData(clubId);
  const savedTournament = findTournamentInData(refreshed, tournament.id) || tournament;

  return { ok: true, tournament: savedTournament };
}

function findTournamentInData(data, tournamentId) {
  return (data.tournaments || []).find((item) => String(item.id) === String(tournamentId)) || null;
}

export function updateTournament(clubId, tournamentId, patch = {}, options = {}) {
  const check = options.directorMode
    ? guardDirectorAction(clubId, options)
    : guardClubAction(clubId, PERMISSIONS.TOURNAMENT_MANAGE, {}, options);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);
  const index = findTournamentIndex(data.tournaments || [], tournamentId);

  if (index < 0) {
    return { ok: false, error: "Khong tim thay giai." };
  }

  const current = data.tournaments[index];
  const { status: nextStatus, force, ...safePatch } = patch;

  if (nextStatus && nextStatus !== current.status) {
    const validation = validateTournamentStatusChange(current, nextStatus, { force });
    if (!validation.ok) {
      return validation;
    }
  }

  data.tournaments[index] = normalizeTournament({
    ...current,
    ...safePatch,
    ...(nextStatus ? { status: nextStatus } : {}),
    id: tournamentId,
    clubId,
    seasonId: safePatch.seasonId ?? current.seasonId,
    leagueId: safePatch.leagueId ?? current.leagueId,
    roundId: safePatch.roundId ?? current.roundId,
    updatedAt: new Date().toISOString(),
  });

  saveClubData(clubId, data);

  if (options.processMatchId) {
    processCompletedMatchById(clubId, tournamentId, options.processMatchId, {
      eventId: options.processEventId || null,
    });
  }

  return { ok: true, tournament: data.tournaments[index] };
}

export function setTournamentStatus(clubId, tournamentId, status, options = {}) {
  return updateTournament(
    clubId,
    tournamentId,
    {
      status,
    },
    options
  );
}

export function deleteTournament(clubId, tournamentId) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_MANAGE);
  if (!check.ok) {
    return check;
  }

  const data = loadClubData(clubId);
  const tournament = data.tournaments.find((item) => item.id === tournamentId);

  if (!tournament) {
    return { ok: false, error: "Khong tim thay giai." };
  }

  if (
    tournament.status !== TOURNAMENT_STATUS.DRAFT &&
    tournament.status !== TOURNAMENT_STATUS.CANCELLED
  ) {
    return {
      ok: false,
      error: "Chi co the xoa giai o trang thai draft hoac cancelled.",
    };
  }

  data.tournaments = data.tournaments.filter((item) => item.id !== tournamentId);
  saveClubData(clubId, data);

  return { ok: true };
}

export function isOpenTournament(tournament) {
  const status = tournament?.status;
  return (
    status !== TOURNAMENT_STATUS.COMPLETED && status !== TOURNAMENT_STATUS.CANCELLED
  );
}

export function purgeOpenTournaments(clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  const toRemove = (data.tournaments || []).filter(isOpenTournament);

  toRemove.forEach((tournament) => {
    cancelTournamentCourtBookings(clubId, tournament.id);
  });

  const removedIds = new Set(toRemove.map((tournament) => tournament.id));
  data.tournaments = (data.tournaments || []).filter(
    (tournament) => !removedIds.has(tournament.id)
  );
  saveClubData(clubId, data);

  return {
    ok: true,
    removedCount: toRemove.length,
    removedNames: toRemove.map((tournament) => tournament.name),
  };
}

export function cancelTournament(clubId, tournamentId) {
  cancelTournamentCourtBookings(clubId, tournamentId);
  return setTournamentStatus(clubId, tournamentId, TOURNAMENT_STATUS.CANCELLED);
}

export function setTournamentCourtSchedule(clubId, tournamentId, scheduleInput) {
  const data = loadClubData(clubId);
  const index = findTournamentIndex(data.tournaments || [], tournamentId);

  if (index < 0) {
    return { ok: false, error: "Không tìm thấy giải." };
  }

  const courtSchedule = normalizeCourtSchedule(scheduleInput);
  if (!courtSchedule) {
    return {
      ok: false,
      error: "Vui lòng chọn ngày, giờ và ít nhất một sân.",
    };
  }

  const current = data.tournaments[index];
  const updated = normalizeTournament({
    ...current,
    courtSchedule: {
      ...courtSchedule,
      syncedAt: new Date().toISOString(),
    },
    id: tournamentId,
    clubId,
    updatedAt: new Date().toISOString(),
  });

  data.tournaments[index] = updated;
  saveClubData(clubId, data);

  const courts = loadCourtsForClub(clubId);
  const syncResult = syncTournamentCourtBookings(updated, clubId, courts);

  if (!syncResult.ok) {
    return {
      ok: false,
      error: syncResult.message,
      tournament: updated,
      ...syncResult,
    };
  }

  return {
    ok: true,
    tournament: updated,
    ...syncResult,
  };
}

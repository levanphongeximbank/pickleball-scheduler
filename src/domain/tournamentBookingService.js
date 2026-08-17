/**
 * Tournament compatibility facade → canonical Court Resource Gateway.
 *
 * Ownership: tournament calendar capacity writes go through CourtResourceGateway,
 * which delegates to neutral legacy booking primitives during the transition.
 * Identity: bookingType=tournament + tournamentId + deterministic id
 *   tournament-booking-{tournamentId}-{courtId}-{date}
 *
 * Sync is validate-first / fail-closed against foreign bookings, then
 * upsert desired rows and cancel obsolete owned rows.
 */

import {
  COURT_RESOURCE_CODE,
  RESERVATION_OWNER_TYPE,
  buildTournamentReservationId,
  buildTournamentReservationRows,
  isActiveTournamentReservation,
  isTournamentReservation,
  listOwnerReservations,
  releaseCourts,
  reserveCourts,
} from "../features/court-resource/index.js";

export const TOURNAMENT_BOOKING_BRIDGE_CODE = Object.freeze({
  SCHEDULE_MISSING: "SCHEDULE_MISSING",
  BOOKING_CONFLICT: "BOOKING_CONFLICT",
  PARTIAL_FAILURE: "PARTIAL_FAILURE",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
});

/**
 * Deterministic booking id for one tournament court block on a civil date.
 * Time-window changes keep the same id (in-place update). Date changes mint a new id;
 * obsolete owned rows are cancelled by ownership scan.
 */
export function buildTournamentBookingId(tournamentId, courtId, date) {
  return buildTournamentReservationId(tournamentId, courtId, date);
}

export function isTournamentBridgeBooking(booking, tournamentId) {
  return isTournamentReservation(booking, tournamentId);
}

export function buildTournamentCourtBookings(tournament, courts = []) {
  const schedule = tournament?.courtSchedule;
  if (!schedule?.date || !schedule?.startTime || !schedule?.endTime) {
    return [];
  }
  if (!Array.isArray(schedule.courtIds) || schedule.courtIds.length === 0) {
    return [];
  }

  return buildTournamentReservationRows(
    { type: RESERVATION_OWNER_TYPE.TOURNAMENT, id: tournament.id },
    schedule,
    schedule.courtIds,
    courts,
    tournament.name || "Giải đấu"
  );
}

/**
 * Cancel only bridge-owned tournament bookings for this tournament.
 * Routes through the canonical Court Resource gateway.
 */
export async function cancelTournamentCourtBookings(clubId, tournamentId) {
  const result = await releaseCourts({
    clubId,
    owner: { type: RESERVATION_OWNER_TYPE.TOURNAMENT, id: tournamentId },
  });
  if (!result.ok) {
    return {
      ok: false,
      code:
        result.code === COURT_RESOURCE_CODE.DATA_UNAVAILABLE
          ? TOURNAMENT_BOOKING_BRIDGE_CODE.DATA_UNAVAILABLE
          : TOURNAMENT_BOOKING_BRIDGE_CODE.PARTIAL_FAILURE,
      message: result.error || "Không hủy được booking giải.",
      cancelled: result.cancelled || [],
      failed: result.failed || [],
    };
  }
  return { ok: true, cancelled: result.cancelled || [], failed: [] };
}

/**
 * Idempotent reconcile of tournament courtSchedule through the gateway.
 */
export async function syncTournamentCourtBookings(tournament, clubId, courts = []) {
  const payloads = buildTournamentCourtBookings(tournament, courts);
  if (payloads.length === 0) {
    return {
      ok: false,
      code: TOURNAMENT_BOOKING_BRIDGE_CODE.SCHEDULE_MISSING,
      message: "Chưa cấu hình lịch sân cho giải.",
      created: [],
      updated: [],
      cancelled: [],
      failed: [],
    };
  }

  const schedule = tournament.courtSchedule;
  const result = await reserveCourts({
    clubId,
    clusterId: schedule.clusterId || null,
    selectedCourtIds: schedule.courtIds,
    owner: { type: RESERVATION_OWNER_TYPE.TOURNAMENT, id: tournament.id },
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    label: tournament.name || tournament.id,
  });
  if (!result.ok) {
    const conflictCodes = new Set([
      COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT,
      COURT_RESOURCE_CODE.CUSTOMER_BOOKING_CONFLICT,
      COURT_RESOURCE_CODE.MAINTENANCE_CONFLICT,
      COURT_RESOURCE_CODE.TOURNAMENT_BOOKING_CONFLICT,
      COURT_RESOURCE_CODE.BOOKING_CONFLICT,
    ]);
    return {
      ok: false,
      code: conflictCodes.has(result.code)
        ? TOURNAMENT_BOOKING_BRIDGE_CODE.BOOKING_CONFLICT
        : result.code === COURT_RESOURCE_CODE.DATA_UNAVAILABLE
          ? TOURNAMENT_BOOKING_BRIDGE_CODE.DATA_UNAVAILABLE
          : TOURNAMENT_BOOKING_BRIDGE_CODE.PARTIAL_FAILURE,
      message: result.error || "Xung đột lịch booking — không đồng bộ (fail-closed).",
      created: result.created || [],
      updated: result.updated || [],
      cancelled: result.cancelled || [],
      failed: result.failed || [],
    };
  }
  return {
    ok: true,
    code: null,
    message: `Đã khóa ${payloads.length} sân trên lịch booking (tạo ${result.created.length}, cập nhật ${result.updated.length}, hủy cũ ${result.cancelled.length}).`,
    created: result.created,
    updated: result.updated,
    cancelled: result.cancelled,
    failed: [],
  };
}

export function getTournamentCourtBookings(clubId, tournamentId) {
  const result = listOwnerReservations({
    clubId,
    owner: { type: RESERVATION_OWNER_TYPE.TOURNAMENT, id: tournamentId },
  });
  return result.ok ? result.reservations : [];
}

export function getActiveTournamentCourtBookings(clubId, tournamentId) {
  return getTournamentCourtBookings(clubId, tournamentId).filter((booking) =>
    isActiveTournamentReservation(booking, tournamentId)
  );
}

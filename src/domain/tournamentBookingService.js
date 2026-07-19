/**
 * Tournament ↔ Venue & Court booking bridge (Phase 2C).
 *
 * Ownership: tournament calendar writes go only through bookingService.
 * Identity: bookingType=tournament + tournamentId + deterministic id
 *   tournament-booking-{tournamentId}-{courtId}-{date}
 *
 * Sync is validate-first / fail-closed against foreign bookings, then
 * upsert desired rows and cancel obsolete owned rows.
 */

import { getCourtDisplayName } from "../models/court.js";
import { createBookingRecord, isActiveBookingStatus } from "../models/booking.js";
import { loadBookingsForClub } from "./clubStorage.js";
import { checkBookingConflict } from "./courtBookingEngine.js";
import {
  createBooking,
  saveBooking,
  updateBookingStatus,
} from "./bookingService.js";

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
  return `tournament-booking-${String(tournamentId)}-${String(courtId)}-${String(date)}`;
}

export function isTournamentBridgeBooking(booking, tournamentId) {
  if (!booking || tournamentId == null || tournamentId === "") {
    return false;
  }
  return (
    booking.bookingType === "tournament" &&
    String(booking.tournamentId) === String(tournamentId)
  );
}

function isOwnedActiveBridgeBooking(booking, tournamentId) {
  return (
    isTournamentBridgeBooking(booking, tournamentId) &&
    booking.bookingStatus !== "cancelled" &&
    booking.bookingStatus !== "completed" &&
    isActiveBookingStatus(booking.bookingStatus)
  );
}

export function buildTournamentCourtBookings(tournament, courts = []) {
  const schedule = tournament?.courtSchedule;
  if (!schedule?.date || !schedule?.startTime || !schedule?.endTime) {
    return [];
  }
  if (!Array.isArray(schedule.courtIds) || schedule.courtIds.length === 0) {
    return [];
  }

  return schedule.courtIds.map((courtId) => {
    const court = courts.find((item) => String(item.id) === String(courtId));

    return createBookingRecord({
      id: buildTournamentBookingId(tournament.id, courtId, schedule.date),
      tournamentId: tournament.id,
      bookingType: "tournament",
      courtId,
      courtName: court ? getCourtDisplayName(court) : `Sân ${courtId}`,
      customerName: tournament.name || "Giải đấu",
      customerType: "event",
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      totalAmount: 0,
      depositAmount: 0,
      paidAmount: 0,
      bookingStatus: "confirmed",
      note: `Giải đấu: ${tournament.name || tournament.id}`,
    });
  });
}

/**
 * Cancel only bridge-owned tournament bookings for this tournament.
 * Uses bookingService.updateBookingStatus (canonical write path).
 */
export function cancelTournamentCourtBookings(clubId, tournamentId) {
  const bookings = loadBookingsForClub(clubId);
  const cancelled = [];
  const failed = [];

  bookings.forEach((booking) => {
    if (!isOwnedActiveBridgeBooking(booking, tournamentId)) {
      return;
    }
    const result = updateBookingStatus(booking.id, "cancelled", clubId);
    if (result.ok) {
      cancelled.push(result.booking);
      return;
    }
    failed.push({
      bookingId: booking.id,
      courtId: booking.courtId,
      message: result.message || "Không hủy được booking giải.",
    });
  });

  if (failed.length > 0 && cancelled.length === 0) {
    return {
      ok: false,
      code: TOURNAMENT_BOOKING_BRIDGE_CODE.PARTIAL_FAILURE,
      message: failed[0]?.message || "Không hủy được booking giải.",
      cancelled,
      failed,
    };
  }

  if (failed.length > 0) {
    return {
      ok: false,
      code: TOURNAMENT_BOOKING_BRIDGE_CODE.PARTIAL_FAILURE,
      message: `Đã hủy ${cancelled.length} booking; ${failed.length} thất bại.`,
      cancelled,
      failed,
    };
  }

  return { ok: true, cancelled, failed: [] };
}

function bookingsExcludingOwnedActive(bookings, tournamentId) {
  return (bookings || []).filter(
    (booking) => !isOwnedActiveBridgeBooking(booking, tournamentId)
  );
}

function validateDesiredAgainstForeign(bookings, tournamentId, payloads) {
  const foreign = bookingsExcludingOwnedActive(bookings, tournamentId);
  const failed = [];

  // Desired set must not self-overlap on the same court.
  for (let i = 0; i < payloads.length; i += 1) {
    for (let j = i + 1; j < payloads.length; j += 1) {
      const a = payloads[i];
      const b = payloads[j];
      if (String(a.courtId) !== String(b.courtId)) {
        continue;
      }
      if (a.date !== b.date) {
        continue;
      }
      const conflict = checkBookingConflict([a], b);
      if (conflict) {
        failed.push({
          courtId: b.courtId,
          message: conflict.message,
          conflict,
          code: TOURNAMENT_BOOKING_BRIDGE_CODE.BOOKING_CONFLICT,
        });
      }
    }
  }

  payloads.forEach((payload) => {
    const conflict = checkBookingConflict(foreign, payload);
    if (conflict) {
      failed.push({
        courtId: payload.courtId,
        message: conflict.message,
        conflict,
        code: TOURNAMENT_BOOKING_BRIDGE_CODE.BOOKING_CONFLICT,
      });
    }
  });

  return failed;
}

function upsertTournamentBooking(payload, clubId, existingBookings) {
  const existing = existingBookings.find((item) => String(item.id) === String(payload.id));
  if (existing) {
    return saveBooking(
      {
        ...existing,
        ...payload,
        id: existing.id,
        bookingCode: existing.bookingCode,
        createdAt: existing.createdAt,
        bookingStatus: "confirmed",
        updatedAt: new Date().toISOString(),
      },
      clubId,
      { excludeId: existing.id }
    );
  }
  return createBooking(payload, clubId);
}

/**
 * Idempotent reconcile of tournament courtSchedule → bookings[].
 *
 * Algorithm:
 * 1. Build desired payloads from courtSchedule
 * 2. Validate full set against non-owned bookings (fail-closed; no writes)
 * 3. Upsert desired rows via bookingService
 * 4. Cancel obsolete owned active rows
 */
export function syncTournamentCourtBookings(tournament, clubId, courts = []) {
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

  let bookings;
  try {
    bookings = loadBookingsForClub(clubId);
  } catch (error) {
    return {
      ok: false,
      code: TOURNAMENT_BOOKING_BRIDGE_CODE.DATA_UNAVAILABLE,
      message: error?.message || "Không tải được bookings.",
      created: [],
      updated: [],
      cancelled: [],
      failed: [],
    };
  }

  const conflictFailures = validateDesiredAgainstForeign(
    bookings,
    tournament.id,
    payloads
  );
  if (conflictFailures.length > 0) {
    return {
      ok: false,
      code: TOURNAMENT_BOOKING_BRIDGE_CODE.BOOKING_CONFLICT,
      message:
        conflictFailures[0]?.message ||
        "Xung đột lịch booking — không đồng bộ (fail-closed).",
      created: [],
      updated: [],
      cancelled: [],
      failed: conflictFailures,
    };
  }

  const desiredIds = new Set(payloads.map((item) => String(item.id)));
  const ownedActive = bookings.filter((booking) =>
    isOwnedActiveBridgeBooking(booking, tournament.id)
  );

  const created = [];
  const updated = [];
  const failed = [];

  for (const payload of payloads) {
    const existingAny = bookings.find(
      (booking) => String(booking.id) === String(payload.id)
    );
    const result = upsertTournamentBooking(payload, clubId, bookings);
    if (!result.ok) {
      failed.push({
        courtId: payload.courtId,
        message: result.message,
        conflict: result.conflict || null,
      });
      break;
    }

    if (existingAny) {
      updated.push(result.booking);
    } else {
      created.push(result.booking);
    }

    // Refresh local snapshot for subsequent exclude/conflict correctness.
    const idx = bookings.findIndex((item) => String(item.id) === String(result.booking.id));
    if (idx >= 0) {
      bookings[idx] = result.booking;
    } else {
      bookings.push(result.booking);
    }
  }

  if (failed.length > 0) {
    return {
      ok: false,
      code: TOURNAMENT_BOOKING_BRIDGE_CODE.PARTIAL_FAILURE,
      message:
        failed[0]?.message ||
        "Đồng bộ booking giải bị gián đoạn (PARTIAL_FAILURE).",
      created,
      updated,
      cancelled: [],
      failed,
      recovery: {
        hint:
          "Một phần booking giải đã ghi. Gọi lại syncTournamentCourtBookings hoặc cancelTournamentCourtBookings rồi sync lại.",
        createdIds: created.map((item) => item.id),
        updatedIds: updated.map((item) => item.id),
      },
    };
  }

  const obsolete = ownedActive.filter(
    (booking) => !desiredIds.has(String(booking.id))
  );
  const cancelled = [];
  const cancelFailed = [];

  for (const booking of obsolete) {
    const result = updateBookingStatus(booking.id, "cancelled", clubId);
    if (result.ok) {
      cancelled.push(result.booking);
    } else {
      cancelFailed.push({
        bookingId: booking.id,
        courtId: booking.courtId,
        message: result.message || "Không hủy booking cũ của giải.",
      });
    }
  }

  if (cancelFailed.length > 0) {
    return {
      ok: false,
      code: TOURNAMENT_BOOKING_BRIDGE_CODE.PARTIAL_FAILURE,
      message: `Đã upsert ${created.length + updated.length} booking nhưng hủy cũ thất bại.`,
      created,
      updated,
      cancelled,
      failed: cancelFailed,
      recovery: {
        hint:
          "Desired bookings đã có; hủy thủ công các booking giải obsolete hoặc gọi cancelTournamentCourtBookings.",
        createdIds: created.map((item) => item.id),
        updatedIds: updated.map((item) => item.id),
        pendingCancelIds: cancelFailed.map((item) => item.bookingId),
      },
    };
  }

  return {
    ok: true,
    code: null,
    message: `Đã khóa ${payloads.length} sân trên lịch booking (tạo ${created.length}, cập nhật ${updated.length}, hủy cũ ${cancelled.length}).`,
    created,
    updated,
    cancelled,
    failed: [],
  };
}

export function getTournamentCourtBookings(clubId, tournamentId) {
  return loadBookingsForClub(clubId).filter((booking) =>
    isTournamentBridgeBooking(booking, tournamentId)
  );
}

export function getActiveTournamentCourtBookings(clubId, tournamentId) {
  return getTournamentCourtBookings(clubId, tournamentId).filter(
    (booking) =>
      booking.bookingStatus !== "cancelled" &&
      booking.bookingStatus !== "completed" &&
      isActiveBookingStatus(booking.bookingStatus)
  );
}

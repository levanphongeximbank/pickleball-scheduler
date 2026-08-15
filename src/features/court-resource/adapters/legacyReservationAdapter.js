/**
 * Low-level compatibility adapter for reservations stored in the club booking
 * blob. This layer knows booking rows, but no tournament business services.
 */
import { getCourtDisplayName } from "../../../models/court.js";
import { createBookingRecord, isActiveBookingStatus } from "../../../models/booking.js";

export function buildTournamentReservationId(tournamentId, courtId, date) {
  return `tournament-booking-${String(tournamentId)}-${String(courtId)}-${String(date)}`;
}

export function isTournamentReservation(booking, ownerId) {
  return Boolean(
    booking &&
      ownerId != null &&
      ownerId !== "" &&
      booking.bookingType === "tournament" &&
      String(booking.tournamentId) === String(ownerId)
  );
}

export function isActiveTournamentReservation(booking, ownerId) {
  return (
    isTournamentReservation(booking, ownerId) &&
    booking.bookingStatus !== "cancelled" &&
    booking.bookingStatus !== "completed" &&
    isActiveBookingStatus(booking.bookingStatus)
  );
}

export function buildTournamentReservationRows(owner, window, courtIds, courts = [], label = "") {
  return (courtIds || []).map((courtId) => {
    const court = courts.find((item) => String(item.id) === String(courtId));
    const displayName = label || owner.id;
    return createBookingRecord({
      id: buildTournamentReservationId(owner.id, courtId, window.date),
      tournamentId: owner.id,
      bookingType: "tournament",
      courtId,
      courtName: court ? getCourtDisplayName(court) : `Sân ${courtId}`,
      customerName: displayName || "Giải đấu",
      customerType: "event",
      date: window.date,
      startTime: window.startTime,
      endTime: window.endTime,
      totalAmount: 0,
      depositAmount: 0,
      paidAmount: 0,
      bookingStatus: "confirmed",
      note: `Giải đấu: ${displayName || owner.id}`,
    });
  });
}

function isOwnedActive(booking, owner) {
  return isActiveTournamentReservation(booking, owner.id);
}

function bookingsExcludingOwnedActive(bookings, owner) {
  return (bookings || []).filter((booking) => !isOwnedActive(booking, owner));
}

function validateDesiredAgainstForeign(bookings, owner, payloads, checkBookingConflict) {
  const foreign = bookingsExcludingOwnedActive(bookings, owner);
  const failed = [];

  for (let i = 0; i < payloads.length; i += 1) {
    for (let j = i + 1; j < payloads.length; j += 1) {
      const conflict = checkBookingConflict([payloads[i]], payloads[j]);
      if (conflict) {
        failed.push({
          courtId: payloads[j].courtId,
          message: conflict.message,
          conflict,
          code: "BOOKING_CONFLICT",
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
        code: "BOOKING_CONFLICT",
      });
    }
  });
  return failed;
}

function upsertReservation(payload, clubId, bookings, deps) {
  const existing = bookings.find((item) => String(item.id) === String(payload.id));
  if (!existing) {
    return deps.createBooking(payload, clubId);
  }
  return deps.saveBooking(
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

export function syncLegacyTournamentReservations(
  { clubId, owner, courts = [], courtIds = [], window, label = "" },
  deps
) {
  const payloads = buildTournamentReservationRows(owner, window, courtIds, courts, label);
  let bookings;
  try {
    bookings = deps.loadBookingsForClub(clubId);
  } catch (error) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      message: error?.message || "Không tải được bookings.",
      created: [],
      updated: [],
      cancelled: [],
      failed: [],
    };
  }

  const conflictFailures = validateDesiredAgainstForeign(
    bookings,
    owner,
    payloads,
    deps.checkBookingConflict
  );
  if (conflictFailures.length > 0) {
    return {
      ok: false,
      code: "BOOKING_CONFLICT",
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
  const ownedActive = bookings.filter((booking) => isOwnedActive(booking, owner));
  const created = [];
  const updated = [];
  const failed = [];

  for (const payload of payloads) {
    const existing = bookings.find((booking) => String(booking.id) === String(payload.id));
    const result = upsertReservation(payload, clubId, bookings, deps);
    if (!result.ok) {
      failed.push({
        courtId: payload.courtId,
        message: result.message,
        conflict: result.conflict || null,
      });
      break;
    }
    (existing ? updated : created).push(result.booking);
    const index = bookings.findIndex((item) => String(item.id) === String(result.booking.id));
    if (index >= 0) {
      bookings[index] = result.booking;
    } else {
      bookings.push(result.booking);
    }
  }

  if (failed.length > 0) {
    return {
      ok: false,
      code: "PARTIAL_FAILURE",
      message: failed[0]?.message || "Đồng bộ booking giải bị gián đoạn (PARTIAL_FAILURE).",
      created,
      updated,
      cancelled: [],
      failed,
      recovery: {
        hint: "Một phần booking giải đã ghi. Gọi lại đồng bộ hoặc hủy rồi đồng bộ lại.",
        createdIds: created.map((item) => item.id),
        updatedIds: updated.map((item) => item.id),
      },
    };
  }

  const cancelled = [];
  const cancelFailed = [];
  for (const booking of ownedActive.filter((item) => !desiredIds.has(String(item.id)))) {
    const result = deps.updateBookingStatus(booking.id, "cancelled", clubId);
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
      code: "PARTIAL_FAILURE",
      message: `Đã upsert ${created.length + updated.length} booking nhưng hủy cũ thất bại.`,
      created,
      updated,
      cancelled,
      failed: cancelFailed,
      recovery: {
        hint: "Desired bookings đã có; hủy thủ công các booking obsolete.",
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

export function releaseLegacyTournamentReservations(
  { clubId, owner, courtIds = null },
  deps
) {
  let bookings;
  try {
    bookings = deps.loadBookingsForClub(clubId);
  } catch (error) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      message: error?.message || "Không tải được bookings.",
      cancelled: [],
      failed: [],
    };
  }

  const filter = courtIds ? new Set(courtIds.map(String)) : null;
  const targets = bookings.filter(
    (booking) =>
      isOwnedActive(booking, owner) &&
      (!filter || filter.has(String(booking.courtId)))
  );
  const cancelled = [];
  const failed = [];
  for (const booking of targets) {
    const result = deps.updateBookingStatus(booking.id, "cancelled", clubId);
    if (result.ok) {
      cancelled.push(result.booking);
    } else {
      failed.push({
        bookingId: booking.id,
        courtId: booking.courtId,
        message: result.message || "Không hủy được booking giải.",
      });
    }
  }

  if (failed.length > 0) {
    return {
      ok: false,
      code: "PARTIAL_FAILURE",
      message:
        cancelled.length === 0
          ? failed[0].message
          : `Đã hủy ${cancelled.length} booking; ${failed.length} thất bại.`,
      cancelled,
      failed,
    };
  }
  return { ok: true, cancelled, failed: [] };
}

export function listLegacyTournamentReservations(bookings, ownerId) {
  return (bookings || []).filter((booking) => isTournamentReservation(booking, ownerId));
}

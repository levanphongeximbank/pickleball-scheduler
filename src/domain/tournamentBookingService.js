import { getCourtDisplayName } from "../models/court.js";
import { createBookingRecord } from "../models/booking.js";
import {
  loadBookingsForClub,
  saveBookingsForClub,
} from "./clubStorage.js";
import { createBooking } from "./bookingService.js";

export function buildTournamentCourtBookings(tournament, courts = []) {
  const schedule = tournament?.courtSchedule;
  if (!schedule) {
    return [];
  }

  return schedule.courtIds.map((courtId) => {
    const court = courts.find((item) => item.id === courtId);

    return createBookingRecord({
      id: `tournament-booking-${tournament.id}-${courtId}-${schedule.date}`,
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

export function cancelTournamentCourtBookings(clubId, tournamentId) {
  const bookings = loadBookingsForClub(clubId);
  const now = new Date().toISOString();
  let changed = false;

  const nextBookings = bookings.map((booking) => {
    if (
      booking.tournamentId === tournamentId &&
      booking.bookingStatus !== "cancelled" &&
      booking.bookingStatus !== "completed"
    ) {
      changed = true;
      return {
        ...booking,
        bookingStatus: "cancelled",
        updatedAt: now,
      };
    }

    return booking;
  });

  if (changed) {
    saveBookingsForClub(nextBookings, clubId);
  }

  return { ok: true, bookings: nextBookings };
}

export function syncTournamentCourtBookings(tournament, clubId, courts = []) {
  cancelTournamentCourtBookings(clubId, tournament.id);

  const payloads = buildTournamentCourtBookings(tournament, courts);
  const created = [];
  const failed = [];

  payloads.forEach((payload) => {
    const result = createBooking(payload, clubId);

    if (result.ok) {
      created.push(result.booking);
      return;
    }

    failed.push({
      courtId: payload.courtId,
      message: result.message,
    });
  });

  if (payloads.length === 0) {
    return {
      ok: false,
      message: "Chưa cấu hình lịch sân cho giải.",
      created,
      failed,
    };
  }

  if (created.length === 0) {
    return {
      ok: false,
      message: failed[0]?.message || "Không khóa được sân nào cho giải.",
      created,
      failed,
    };
  }

  return {
    ok: true,
    message: `Đã khóa ${created.length}/${payloads.length} sân trên lịch booking.`,
    created,
    failed,
  };
}

export function getTournamentCourtBookings(clubId, tournamentId) {
  return loadBookingsForClub(clubId).filter(
    (booking) =>
      booking.tournamentId === tournamentId && booking.bookingType === "tournament"
  );
}

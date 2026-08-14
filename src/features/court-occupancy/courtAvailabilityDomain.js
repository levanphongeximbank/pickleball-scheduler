/**
 * Shared court availability authority (client/in-memory mirror of SQL).
 * Half-open intervals: [starts_at, ends_at).
 *
 * Daily live leases have no bounded end. An active lease occupies the court
 * from leased_at until explicit release. Do not invent a duration.
 */

import { civilDateTimeToUtcMs, civilTimeToMinutes } from "../../domain/civilTime.js";

export const COURT_TIME_RANGE_SEMANTICS = "[)";

export const COURT_AVAILABILITY_CODE = Object.freeze({
  COURT_OCCUPIED: "COURT_OCCUPIED",
  INVALID_WINDOW: "INVALID_WINDOW",
});

export const MALFORMED_ACTIVE_BOOKING_POLICY = "FAIL_CLOSED";

export const DAILY_VS_FUTURE_RESERVATION_POLICY =
  "ACTIVE_LEASE_OPEN_ENDED_BLOCKS_ALL_CALENDAR; ANY_ACTIVE_CALENDAR_RESERVATION_OR_BRIDGED_BOOKING_BLOCKS_NEW_LEASE";

export const COURT_AVAILABILITY_MESSAGES = Object.freeze({
  [COURT_AVAILABILITY_CODE.COURT_OCCUPIED]: "Sân đang bị chiếm.",
  [COURT_AVAILABILITY_CODE.INVALID_WINDOW]: "Khung giờ sân không hợp lệ.",
});

const ACTIVE_BLOB_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "playing",
]);

function deny(code, extra = {}) {
  return {
    ok: false,
    code,
    error: extra.error || COURT_AVAILABILITY_MESSAGES[code] || code,
    ...extra,
  };
}

export function parseInstant(value) {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Half-open overlap: [aStart, aEnd) vs [bStart, bEnd).
 * 10:00–11:00 and 11:00–12:00 do not overlap.
 */
export function rangesOverlapHalfOpen(aStart, aEnd, bStart, bEnd) {
  const a0 = parseInstant(aStart);
  const a1 = parseInstant(aEnd);
  const b0 = parseInstant(bStart);
  const b1 = parseInstant(bEnd);
  if (![a0, a1, b0, b1].every(Number.isFinite)) {
    return false;
  }
  return a0 < b1 && b0 < a1;
}

export function assertValidWindow(startsAt, endsAt) {
  const start = parseInstant(startsAt);
  const end = parseInstant(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(start < end)) {
    return deny(COURT_AVAILABILITY_CODE.INVALID_WINDOW);
  }
  return null;
}

export function isActiveReservationStatus(status) {
  return String(status || "active").toLowerCase() === "active";
}

export function isActiveDailyLease(lease) {
  return String(lease?.status || "active").toLowerCase() === "active";
}

export function isActiveBlobBooking(booking) {
  const status = String(booking?.status || booking?.bookingStatus || "confirmed").toLowerCase();
  if (status === "cancelled" || status === "completed" || status === "no_show") {
    return false;
  }
  return ACTIVE_BLOB_STATUSES.has(status) || status === "confirmed";
}

/**
 * Classify a club_data_v3.data.bookings row for backfill / read-bridge.
 * Only rows with a provable court + civil window are occupancy-relevant.
 */
export function classifyClubBlobBooking(booking, tournamentsById = {}) {
  if (!booking || typeof booking !== "object") {
    return { class: "unknown", action: "IGNORE_WITH_PROOF", reason: "not_object" };
  }
  const courtId = String(booking.courtId || booking.court_id || "").trim();
  const date = String(booking.date || "").slice(0, 10);
  const startTime = String(booking.startTime || booking.start_time || "").slice(0, 5);
  const endTime = String(booking.endTime || booking.end_time || "").slice(0, 5);
  const type = String(booking.bookingType || booking.booking_type || "").trim().toLowerCase();
  const hasRange = Boolean(courtId && date && startTime && endTime && startTime < endTime);

  if (!hasRange) {
    return {
      class: type || "unknown",
      action: "IGNORE_WITH_PROOF",
      reason: "malformed_or_unbounded",
    };
  }

  if (type === "maintenance") {
    return { class: "maintenance", action: "READ_COMPAT_ONLY", hasRange: true };
  }
  if (type === "single" || type === "recurring" || type === "social_play" || type === "") {
    return { class: "normal", action: "READ_COMPAT_ONLY", hasRange: true };
  }
  if (type === "tournament") {
    const tournamentId = String(booking.tournamentId || booking.tournament_id || "").trim();
    const tournament = tournamentsById[tournamentId] || null;
    const mode = String(tournament?.mode || booking.tournamentMode || "").trim();
    if (mode === "official_tournament") {
      return { class: "official_tournament", action: "MIGRATE", hasRange: true, tournamentId };
    }
    if (mode === "internal_tournament") {
      return { class: "internal_tournament", action: "READ_COMPAT_ONLY", hasRange: true, tournamentId };
    }
    if (!tournamentId) {
      return { class: "unknown", action: "IGNORE_WITH_PROOF", reason: "tournament_without_id" };
    }
    return {
      class: "unknown",
      action: "IGNORE_WITH_PROOF",
      reason: "tournament_mode_unproven",
      tournamentId,
    };
  }
  return { class: "unknown", action: "IGNORE_WITH_PROOF", reason: `type:${type || "empty"}` };
}

export function blobBookingToRange(booking, timezone = "UTC") {
  const date = String(booking.date || "").slice(0, 10);
  const startTime = String(booking.startTime || booking.start_time || "").slice(0, 5);
  const endTime = String(booking.endTime || booking.end_time || "").slice(0, 5);
  if (!date || !startTime || !endTime) {
    return null;
  }
  try {
    const startsAt = civilToTimestamptz(date, startTime, timezone);
    const endsAt = civilToTimestamptz(date, endTime, timezone);
    if (!startsAt || !endsAt || parseInstant(startsAt) >= parseInstant(endsAt)) {
      return null;
    }
    return { startsAt, endsAt };
  } catch {
    return null;
  }
}

export function civilToTimestamptz(date, time, timeZone) {
  try {
    const ms = civilDateTimeToUtcMs(date, civilTimeToMinutes(time), timeZone);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  } catch {
    return null;
  }
}

function sameCourt(row, tenantId, clubId, courtId) {
  return (
    String(row.tenantId || row.tenant_id || "") === String(tenantId) &&
    String(row.clubId || row.club_id || "") === String(clubId) &&
    String(row.courtId || row.court_id || "") === String(courtId)
  );
}

/**
 * One shared conflict authority.
 *
 * liveUnbounded=true (Daily assign/change):
 *   any active calendar reservation or bridged blob booking on the court blocks.
 * liveUnbounded=false (Official/calendar):
 *   overlapping reservations/blob bookings, or any active Daily lease, block.
 */
export function assertCourtAvailable({
  tenantId,
  clubId,
  courtId,
  startsAt,
  endsAt,
  ignoreTournamentId = null,
  liveUnbounded = false,
  reservations = [],
  dailyLeases = [],
  blobBookings = [],
  timezone = "UTC",
} = {}) {
  const cid = String(courtId || "").trim();
  if (!cid) {
    return deny(COURT_AVAILABILITY_CODE.INVALID_WINDOW, { error: "Thiếu court id." });
  }

  if (!liveUnbounded) {
    const invalid = assertValidWindow(startsAt, endsAt);
    if (invalid) return invalid;
  }

  const ignoreId = ignoreTournamentId != null ? String(ignoreTournamentId) : null;

  for (const reservation of reservations || []) {
    if (!isActiveReservationStatus(reservation.status)) continue;
    if (!sameCourt(reservation, tenantId, clubId, cid)) continue;
    const ownerTournament = String(
      reservation.tournamentId || reservation.tournament_id || ""
    );
    if (ignoreId && ownerTournament === ignoreId) continue;
    if (liveUnbounded) {
      return deny(COURT_AVAILABILITY_CODE.COURT_OCCUPIED, {
        courtId: cid,
        conflictSource: "court_reservations",
      });
    }
    if (
      rangesOverlapHalfOpen(
        startsAt,
        endsAt,
        reservation.startsAt || reservation.starts_at,
        reservation.endsAt || reservation.ends_at
      )
    ) {
      return deny(COURT_AVAILABILITY_CODE.COURT_OCCUPIED, {
        courtId: cid,
        conflictSource: "court_reservations",
      });
    }
  }

  for (const lease of dailyLeases || []) {
    if (!isActiveDailyLease(lease)) continue;
    if (!sameCourt(lease, tenantId, clubId, cid)) continue;
    return deny(COURT_AVAILABILITY_CODE.COURT_OCCUPIED, {
      courtId: cid,
      conflictSource: "daily_play_court_leases",
    });
  }

  for (const booking of blobBookings || []) {
    if (!isActiveBlobBooking(booking)) continue;
    if (String(booking.courtId || booking.court_id || "") !== cid) continue;
    const classified = classifyClubBlobBooking(booking);
    const bookingTournament = String(booking.tournamentId || booking.tournament_id || "");
    if (ignoreId && bookingTournament === ignoreId) continue;
    if (classified.action === "IGNORE_WITH_PROOF") {
      return deny(COURT_AVAILABILITY_CODE.COURT_OCCUPIED, {
        courtId: cid,
        conflictSource: "club_data_v3.bookings",
        reason: classified.reason || "unparseable_active_booking",
      });
    }
    if (liveUnbounded) {
      return deny(COURT_AVAILABILITY_CODE.COURT_OCCUPIED, {
        courtId: cid,
        conflictSource: "club_data_v3.bookings",
      });
    }
    const range = blobBookingToRange(booking, timezone);
    if (!range) {
      return deny(COURT_AVAILABILITY_CODE.COURT_OCCUPIED, {
        courtId: cid,
        conflictSource: "club_data_v3.bookings",
        reason: "unparseable_active_booking",
      });
    }
    if (rangesOverlapHalfOpen(startsAt, endsAt, range.startsAt, range.endsAt)) {
      return deny(COURT_AVAILABILITY_CODE.COURT_OCCUPIED, {
        courtId: cid,
        conflictSource: "club_data_v3.bookings",
      });
    }
  }

  return { ok: true };
}

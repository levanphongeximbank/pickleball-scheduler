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
 * Official/Open may still use options.canonicalOccupancy for local occupancy lock.
 */

import { isActiveBookingStatus } from "../models/booking.js";
import { loadClubData, saveClubData } from "./clubStorage.js";
import { checkBookingConflict, enrichBookingWithCourt } from "./courtBookingEngine.js";
import { guardBookingSave } from "../auth/guardAction.js";
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
  CANONICAL_OCCUPANCY_UNAVAILABLE: "CANONICAL_OCCUPANCY_UNAVAILABLE",
  COURT_NOT_IN_AUTHORIZED_SET: "COURT_NOT_IN_AUTHORIZED_SET",
  COURT_INACTIVE: "COURT_INACTIVE",
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

function resolveAuthorizedCourt(courts, courtId) {
  return (courts || []).find((item) => String(item.id) === String(courtId)) || null;
}

function validatePayloadsAgainstAuthorizedCourts(payloads, courts) {
  const failed = [];
  for (const payload of payloads) {
    const court = resolveAuthorizedCourt(courts, payload.courtId);
    if (!court) {
      failed.push({
        courtId: payload.courtId,
        message: "Sân không còn thuộc đơn vị hiện tại.",
        code: TOURNAMENT_BOOKING_BRIDGE_CODE.COURT_NOT_IN_AUTHORIZED_SET,
      });
      continue;
    }
    if (court.active === false) {
      failed.push({
        courtId: payload.courtId,
        message: "Sân đã bị vô hiệu hóa.",
        code: TOURNAMENT_BOOKING_BRIDGE_CODE.COURT_INACTIVE,
      });
    }
  }
  return failed;
}

export function restoreCanonicalTournamentBookingSnapshot({
  clubId,
  priorOccupancyBookings,
  persistSnapshot,
  suppressCloudPush = false,
  source,
  operation,
} = {}) {
  if (!clubId || !persistSnapshot) {
    return {
      ok: false,
      code: "COURT_LOCK_COMPENSATION_FAILED",
      message: "Không hoàn tác được booking sau khi lưu giải thất bại.",
    };
  }
  persistCanonicalClubBookings(
    clubId,
    Array.isArray(priorOccupancyBookings) ? priorOccupancyBookings : [],
    persistSnapshot,
    {
      suppressCloudPush: suppressCloudPush === true,
      source,
      operation: operation || "restore-canonical-bookings",
    }
  );
  return { ok: true };
}

function ownedBookingIdentity(booking) {
  return JSON.stringify({
    id: String(booking?.id || ""),
    courtId: String(booking?.courtId || ""),
    date: String(booking?.date || "").slice(0, 10),
    startTime: String(booking?.startTime || "").slice(0, 5),
    endTime: String(booking?.endTime || "").slice(0, 5),
    bookingStatus: String(booking?.bookingStatus || ""),
  });
}

/**
 * Undo unpushed Official tournament-owned bookings without replacing other local fields.
 */
export function abandonUnpushedOfficialTournamentBookings(
  clubId,
  tournamentId,
  occupancyBookings = []
) {
  if (!clubId || !tournamentId) {
    return { ok: false, restored: false };
  }
  const local = loadClubData(clubId);
  const localBookings = Array.isArray(local.bookings) ? local.bookings : [];
  const snapshotBookings = Array.isArray(occupancyBookings) ? occupancyBookings : [];
  const localOwned = localBookings.filter((booking) =>
    isTournamentBridgeBooking(booking, tournamentId)
  );
  const snapshotOwned = snapshotBookings.filter((booking) =>
    isTournamentBridgeBooking(booking, tournamentId)
  );
  const localKeys = localOwned.map(ownedBookingIdentity).sort().join("|");
  const snapshotKeys = snapshotOwned.map(ownedBookingIdentity).sort().join("|");
  if (localKeys === snapshotKeys) {
    return { ok: true, restored: false };
  }
  const others = localBookings.filter(
    (booking) => !isTournamentBridgeBooking(booking, tournamentId)
  );
  saveClubData(
    clubId,
    {
      ...local,
      bookings: [...others, ...snapshotOwned],
    },
    {
      source: "cloud",
      suppressCloudPush: true,
      operation: "abandon-unpushed-official-bookings",
    }
  );
  return { ok: true, restored: true };
}

export function tournamentOwnedBookingsMatchCourtSchedule(bookings, tournament) {
  const schedule = tournament?.courtSchedule;
  if (!tournament?.id || !schedule?.date || !schedule?.startTime || !schedule?.endTime) {
    return false;
  }
  const expectedIds = new Set((schedule.courtIds || []).map(String).filter(Boolean));
  if (expectedIds.size === 0) {
    return false;
  }
  const owned = (bookings || []).filter((booking) =>
    isOwnedActiveBridgeBooking(booking, tournament.id)
  );
  if (owned.length !== expectedIds.size) {
    return false;
  }
  const seen = new Set();
  for (const booking of owned) {
    const courtId = String(booking.courtId);
    if (!expectedIds.has(courtId) || seen.has(courtId)) {
      return false;
    }
    if (String(booking.tournamentId) !== String(tournament.id)) {
      return false;
    }
    if (String(booking.date || "").slice(0, 10) !== String(schedule.date).slice(0, 10)) {
      return false;
    }
    if (String(booking.startTime || "").slice(0, 5) !== String(schedule.startTime).slice(0, 5)) {
      return false;
    }
    if (String(booking.endTime || "").slice(0, 5) !== String(schedule.endTime).slice(0, 5)) {
      return false;
    }
    seen.add(courtId);
  }
  return seen.size === expectedIds.size;
}

function persistCanonicalClubBookings(clubId, nextBookings, snapshotClubData, options = {}) {
  const useFreshSnapshot = snapshotClubData && typeof snapshotClubData === "object";
  const base = useFreshSnapshot ? { ...snapshotClubData } : loadClubData(clubId);
  const cloudCourts = Array.isArray(snapshotClubData?.courts)
    ? snapshotClubData.courts
    : Array.isArray(base.courts)
      ? base.courts
      : [];
  return saveClubData(
    clubId,
    {
      ...base,
      courts: cloudCourts.length > 0 ? cloudCourts : base.courts,
      bookings: nextBookings,
    },
    {
      suppressCloudPush: options.suppressCloudPush === true,
      source: options.source,
      operation: options.operation || "canonical-booking-persist",
    }
  );
}

function applyCanonicalTournamentOccupancy({
  clubId,
  tournamentId,
  payloads,
  occupancyBookings,
  persistSnapshot,
  courts,
  suppressCloudPush = false,
}) {
  const occupancy = Array.isArray(occupancyBookings) ? occupancyBookings : [];
  const hasNew = payloads.some(
    (payload) =>
      !occupancy.some((booking) => String(booking.id) === String(payload.id))
  );
  const access = guardBookingSave(clubId, { isNew: hasNew });
  if (!access.ok) {
    return {
      ok: false,
      code: TOURNAMENT_BOOKING_BRIDGE_CODE.DATA_UNAVAILABLE,
      message: access.error || "Không thể tạo booking canonical.",
      created: [],
      updated: [],
      cancelled: [],
      failed: [],
    };
  }

  const nextById = new Map(
    occupancy.map((booking) => [String(booking.id), { ...booking }])
  );
  const created = [];
  const updated = [];

  for (const payload of payloads) {
    const existing = nextById.get(String(payload.id));
    const record = existing
      ? {
          ...existing,
          ...payload,
          id: existing.id,
          bookingCode: existing.bookingCode,
          createdAt: existing.createdAt,
          bookingStatus: "confirmed",
          updatedAt: new Date().toISOString(),
        }
      : payload;
    const enriched = enrichBookingWithCourt(record, courts);
    nextById.set(String(enriched.id), enriched);
    if (existing) {
      updated.push(enriched);
    } else {
      created.push(enriched);
    }
  }

  const desiredIds = new Set(payloads.map((item) => String(item.id)));
  const cancelled = [];
  occupancy.forEach((booking) => {
    if (
      isOwnedActiveBridgeBooking(booking, tournamentId) &&
      !desiredIds.has(String(booking.id))
    ) {
      const cancelledBooking = {
        ...nextById.get(String(booking.id)),
        bookingStatus: "cancelled",
        updatedAt: new Date().toISOString(),
      };
      nextById.set(String(booking.id), cancelledBooking);
      cancelled.push(cancelledBooking);
    }
  });

  persistCanonicalClubBookings(clubId, [...nextById.values()], persistSnapshot, {
    suppressCloudPush: suppressCloudPush === true,
  });

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

/**
 * Idempotent reconcile of tournament courtSchedule through the gateway.
 * When options.canonicalOccupancy is set (Official court lock), uses local
 * occupancy snapshot path; otherwise reserves via Court Resource gateway.
 */
export async function syncTournamentCourtBookings(
  tournament,
  clubId,
  courts = [],
  options = {}
) {
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

  const useCanonicalOccupancy = options.canonicalOccupancy === true;
  if (useCanonicalOccupancy) {
    if (
      !Object.prototype.hasOwnProperty.call(options, "occupancyBookings") ||
      !options.persistSnapshot
    ) {
      return {
        ok: false,
        code: TOURNAMENT_BOOKING_BRIDGE_CODE.CANONICAL_OCCUPANCY_UNAVAILABLE,
        message: "Chưa thể xác minh xung đột lịch sân từ nguồn canonical.",
        created: [],
        updated: [],
        cancelled: [],
        failed: [],
      };
    }

    const courtFailures = validatePayloadsAgainstAuthorizedCourts(payloads, courts);
    if (courtFailures.length > 0) {
      return {
        ok: false,
        code:
          courtFailures[0].code ||
          TOURNAMENT_BOOKING_BRIDGE_CODE.COURT_NOT_IN_AUTHORIZED_SET,
        message: courtFailures[0].message,
        created: [],
        updated: [],
        cancelled: [],
        failed: courtFailures,
      };
    }

    const bookings = Array.isArray(options.occupancyBookings)
      ? options.occupancyBookings
      : [];

    const conflictFailures = validateDesiredAgainstForeign(
      bookings,
      tournament.id,
      payloads
    );
    if (conflictFailures.length > 0) {
      const detail =
        conflictFailures[0]?.message ||
        "Xung đột lịch booking — không đồng bộ (fail-closed).";
      return {
        ok: false,
        code: TOURNAMENT_BOOKING_BRIDGE_CODE.BOOKING_CONFLICT,
        message: detail.includes("trùng")
          ? detail
          : `Sân đã có lịch trùng. ${detail}`,
        created: [],
        updated: [],
        cancelled: [],
        failed: conflictFailures,
      };
    }

    return applyCanonicalTournamentOccupancy({
      clubId,
      tournamentId: tournament.id,
      payloads,
      occupancyBookings: bookings,
      persistSnapshot: options.persistSnapshot,
      courts,
      suppressCloudPush: options.suppressCloudPush === true,
    });
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
      message:
        result.error || "Xung đột lịch booking — không đồng bộ (fail-closed).",
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

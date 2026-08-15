/**
 * Canonical Court Resource gateway.
 *
 * Supports the current flat option contract and the accepted Phase 2
 * scope/window shape. This is the only gateway implementation.
 */
import { getCourtDisplayName } from "../../../models/court.js";
import { loadBookingsForClub } from "../../../domain/clubStorage.js";
import { checkBookingConflict } from "../../../domain/courtBookingEngine.js";
import {
  createBooking,
  createMaintenanceBooking,
  saveBooking,
  updateBookingStatus,
} from "../../../domain/bookingService.js";
import {
  COURT_RESOURCE_CODE,
  OWNERSHIP_STATUS,
  RESERVATION_OWNER_TYPE,
} from "../constants/courtResourceContract.js";
import {
  buildTournamentReservationId,
  isActiveTournamentReservation,
  isTournamentReservation,
  listLegacyTournamentReservations,
  releaseLegacyTournamentReservations,
  syncLegacyTournamentReservations,
} from "../adapters/legacyReservationAdapter.js";
import {
  AVAILABILITY_REASON,
  getCourtAvailability as getCanonicalCourtAvailability,
} from "../../venue-court/services/courtAvailabilityService.js";
import { listCourts } from "../../venue-court/services/courtInventoryService.js";
import { assertCourtClusterMembership } from "../../venue-court/services/courtClusterMembershipService.js";
import {
  getReservationOwner as lookupReservationOwner,
  isBlockingReservation,
  isSameReservationOwner,
  normalizeOwnerInput,
} from "../../venue-court/services/reservationOwnerService.js";

function adapterDeps() {
  return {
    loadBookingsForClub: deps.loadBookingsForClub,
    checkBookingConflict: deps.checkBookingConflict,
    createBooking: deps.createBooking,
    saveBooking: deps.saveBooking,
    updateBookingStatus: deps.updateBookingStatus,
  };
}

function defaultSyncTournamentCourtBookings(tournament, clubId, courts = []) {
  const schedule = tournament?.courtSchedule || {};
  return syncLegacyTournamentReservations(
    {
      clubId,
      owner: { type: RESERVATION_OWNER_TYPE.TOURNAMENT, id: tournament.id },
      courts,
      courtIds: schedule.courtIds || [],
      window: schedule,
      label: tournament.name || tournament.id,
    },
    adapterDeps()
  );
}

function defaultCancelTournamentCourtBookings(clubId, ownerId, courtIds = null) {
  return releaseLegacyTournamentReservations(
    {
      clubId,
      owner: { type: RESERVATION_OWNER_TYPE.TOURNAMENT, id: ownerId },
      courtIds,
    },
    adapterDeps()
  );
}

const defaultDeps = Object.freeze({
  getCourtAvailability: getCanonicalCourtAvailability,
  listCourts,
  loadBookingsForClub,
  checkBookingConflict,
  createBooking,
  createMaintenanceBooking,
  saveBooking,
  updateBookingStatus,
  assertCourtClusterMembership,
  getReservationOwner: lookupReservationOwner,
  syncTournamentCourtBookings: defaultSyncTournamentCourtBookings,
  cancelTournamentCourtBookings: defaultCancelTournamentCourtBookings,
});

let deps = { ...defaultDeps };

/** @internal */
export function __setCourtResourceGatewayDepsForTests(next = {}) {
  deps = { ...defaultDeps, ...next };
}

/** @internal */
export function __resetCourtResourceGatewayDepsForTests() {
  deps = { ...defaultDeps };
}

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeOptions(options = {}) {
  const scope = options.scope || {};
  const window = options.window || {};
  return {
    ...scope,
    ...window,
    ...options,
    clubId: options.clubId ?? scope.clubId,
    tenantId: options.tenantId ?? scope.tenantId,
    venueId: options.venueId ?? scope.venueId,
    clusterId: options.clusterId ?? scope.clusterId,
    date: options.date ?? window.date,
    startTime: options.startTime ?? window.startTime,
    endTime: options.endTime ?? window.endTime,
  };
}

function fail(code, error, extra = {}) {
  return { ok: false, code, error, ...extra };
}

function selectedCourtIds(options) {
  if (Array.isArray(options.selectedCourtIds) && options.selectedCourtIds.length) {
    return [...options.selectedCourtIds];
  }
  if (Array.isArray(options.courtIds) && options.courtIds.length) {
    return [...options.courtIds];
  }
  return trimId(options.courtId) ? [trimId(options.courtId)] : [];
}

function windowFrom(options) {
  return {
    date: trimId(options.date),
    startTime: trimId(options.startTime) || trimId(options.scheduledStart),
    endTime: trimId(options.endTime) || trimId(options.scheduledEnd),
  };
}

function mapAvailabilityCode(code) {
  if (code === AVAILABILITY_REASON.TOURNAMENT_BOOKING_CONFLICT) {
    return COURT_RESOURCE_CODE.TOURNAMENT_BOOKING_CONFLICT;
  }
  if (
    code === AVAILABILITY_REASON.MAINTENANCE_BOOKING ||
    code === AVAILABILITY_REASON.COURT_MAINTENANCE
  ) {
    return COURT_RESOURCE_CODE.MAINTENANCE_CONFLICT;
  }
  if (code === AVAILABILITY_REASON.BOOKING_CONFLICT) {
    return COURT_RESOURCE_CODE.CUSTOMER_BOOKING_CONFLICT;
  }
  return code || COURT_RESOURCE_CODE.BOOKING_CONFLICT;
}

function bookingTypeForOwner(owner) {
  if (owner.type === RESERVATION_OWNER_TYPE.MAINTENANCE) return "maintenance";
  if (owner.type === RESERVATION_OWNER_TYPE.DAILY_PLAY) return "social_play";
  return "single";
}

export function getCourtAvailability(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const owner = normalizeOwnerInput(options.owner);
  return deps.getCourtAvailability({
    ...options,
    ...(owner ? { context: { ...(options.context || {}), owner } } : {}),
  });
}

export function reserveCourts(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const clubId = trimId(options.clubId);
  const owner = normalizeOwnerInput(options.owner);
  const courtIds = selectedCourtIds(options);
  const window = windowFrom(options);
  const clusterId = trimId(options.clusterId);
  const tenantId = trimId(options.tenantId) || trimId(options.venueId);

  if (!clubId) return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required — no first-club fallback.");
  if (!owner) return fail(COURT_RESOURCE_CODE.MISSING_OWNER, "owner.type and owner.id are required.");
  if (trimId(options.courtLabel) && courtIds.length === 0) {
    return fail(COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED, "courtLabel is display-only — reservation identity is courtId.");
  }
  if (courtIds.length === 0) {
    return fail(COURT_RESOURCE_CODE.MISSING_COURT_ID, "selectedCourtIds are required — cluster is not a reservable unit.");
  }
  if (clusterId && courtIds.length === 1 && String(courtIds[0]) === clusterId) {
    return fail(COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED, "Cannot reserve a cluster id as a physical court.");
  }
  if (!window.date || !window.startTime || !window.endTime) {
    return fail(COURT_RESOURCE_CODE.MISSING_WINDOW, "date, startTime, and endTime are required.");
  }

  let courts;
  try {
    courts = deps.listCourts({ clubId, tenantId, includeInactive: true });
  } catch (error) {
    return fail(COURT_RESOURCE_CODE.DATA_UNAVAILABLE, error?.message || "Failed to load court inventory.");
  }

  const membershipFailures = [];
  for (const courtId of courtIds) {
    const membership = deps.assertCourtClusterMembership({
      clubId,
      tenantId,
      venueId: trimId(options.venueId),
      clusterId,
      courtId,
      courts,
      includeInactive: false,
    });
    if (!membership.ok) {
      membershipFailures.push({ courtId, code: membership.code, error: membership.error });
    }
  }
  if (membershipFailures.length) {
    return fail(membershipFailures[0].code, membershipFailures[0].error, {
      failed: membershipFailures,
      reserved: [],
    });
  }

  if (owner.type === RESERVATION_OWNER_TYPE.TOURNAMENT) {
    const result = deps.syncTournamentCourtBookings(
      {
        id: owner.id,
        name: options.label || options.tournamentName || owner.id,
        courtSchedule: { ...window, courtIds },
      },
      clubId,
      courts
    );
    if (!result.ok) {
      return fail(
        result.code === "BOOKING_CONFLICT"
          ? COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT
          : result.code || COURT_RESOURCE_CODE.PARTIAL_FAILURE,
        result.message || result.error || "Reservation failed.",
        { reserved: [], failed: result.failed || [] }
      );
    }
    return {
      ok: true,
      code: COURT_RESOURCE_CODE.OK,
      reserved: [...(result.created || []), ...(result.updated || [])],
      created: result.created || [],
      updated: result.updated || [],
      cancelled: result.cancelled || [],
      selectedCourtIds: courtIds,
      granularity: "physical_court_x_capacity_window",
    };
  }

  const reserved = [];
  const failed = [];
  for (const courtId of courtIds) {
    const court = courts.find((item) => String(item.id) === String(courtId));
    const payload = {
      id: `${owner.type}-booking-${owner.id}-${courtId}-${window.date}`,
      bookingType: bookingTypeForOwner(owner),
      courtId,
      courtName: court ? getCourtDisplayName(court) : courtId,
      customerName: options.label || owner.id,
      customerType: "event",
      ...window,
      totalAmount: 0,
      depositAmount: 0,
      paidAmount: 0,
      bookingStatus: "confirmed",
      note: `Court resource reservation: ${owner.type}:${owner.id}`,
    };
    const result =
      owner.type === RESERVATION_OWNER_TYPE.MAINTENANCE
        ? deps.createMaintenanceBooking(payload, clubId)
        : deps.createBooking(payload, clubId);
    if (!result.ok) {
      failed.push({ courtId, message: result.message, conflict: result.conflict || null });
      break;
    }
    reserved.push(result.booking);
  }
  if (failed.length) {
    return fail(COURT_RESOURCE_CODE.PARTIAL_FAILURE, failed[0].message, { reserved, failed });
  }
  return {
    ok: true,
    code: COURT_RESOURCE_CODE.OK,
    reserved,
    created: reserved,
    updated: [],
    cancelled: [],
    selectedCourtIds: courtIds,
    granularity: "physical_court_x_capacity_window",
  };
}

export function releaseCourts(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const clubId = trimId(options.clubId);
  const owner = normalizeOwnerInput(options.owner);
  const ids = selectedCourtIds(options);
  const courtFilter = ids.length ? new Set(ids) : null;
  if (!clubId) return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required.");
  if (!owner) return fail(COURT_RESOURCE_CODE.MISSING_OWNER, "owner.type and owner.id are required.");

  if (owner.type === RESERVATION_OWNER_TYPE.TOURNAMENT) {
    const result = deps.cancelTournamentCourtBookings(
      clubId,
      owner.id,
      courtFilter ? [...courtFilter] : null
    );
    if (!result.ok) {
      return fail(result.code || COURT_RESOURCE_CODE.PARTIAL_FAILURE, result.message || result.error, {
        cancelled: result.cancelled || [],
        failed: result.failed || [],
      });
    }
    return { ok: true, code: COURT_RESOURCE_CODE.OK, cancelled: result.cancelled || [], failed: [] };
  }

  let bookings;
  try {
    bookings = deps.loadBookingsForClub(clubId);
  } catch (error) {
    return fail(COURT_RESOURCE_CODE.DATA_UNAVAILABLE, error?.message || "Failed to load bookings.");
  }
  const targets = bookings.filter(
    (booking) =>
      isBlockingReservation(booking) &&
      isSameReservationOwner(booking, owner) &&
      (!courtFilter || courtFilter.has(String(booking.courtId)))
  );
  const cancelled = [];
  const failed = [];
  for (const booking of targets) {
    const result = deps.updateBookingStatus(booking.id, "cancelled", clubId);
    if (result.ok) cancelled.push(result.booking);
    else failed.push({ bookingId: booking.id, courtId: booking.courtId, message: result.message });
  }
  if (failed.length) {
    return fail(COURT_RESOURCE_CODE.PARTIAL_FAILURE, failed[0].message, { cancelled, failed });
  }
  return { ok: true, code: COURT_RESOURCE_CODE.OK, cancelled, failed: [] };
}

export function getReservationOwner(rawOptions = {}) {
  return deps.getReservationOwner(normalizeOptions(rawOptions));
}

export function listOwnerReservations(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const clubId = trimId(options.clubId);
  const owner = normalizeOwnerInput(options.owner);
  if (!clubId) return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required.", { reservations: [] });
  if (!owner) return fail(COURT_RESOURCE_CODE.MISSING_OWNER, "owner.type and owner.id are required.", { reservations: [] });
  try {
    const bookings = deps.loadBookingsForClub(clubId);
    const reservations =
      owner.type === RESERVATION_OWNER_TYPE.TOURNAMENT
        ? listLegacyTournamentReservations(bookings, owner.id)
        : bookings.filter((booking) => isSameReservationOwner(booking, owner));
    return { ok: true, code: COURT_RESOURCE_CODE.OK, reservations };
  } catch (error) {
    return fail(COURT_RESOURCE_CODE.DATA_UNAVAILABLE, error?.message || "Failed to load bookings.", { reservations: [] });
  }
}

export function validateCourtAssignment(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const clubId = trimId(options.clubId);
  const courtId = trimId(options.courtId);
  const owner = normalizeOwnerInput(options.owner);
  const window = windowFrom(options);
  if (trimId(options.courtLabel) && !courtId) {
    return fail(COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED, "courtLabel is display-only — assignment identity is courtId.");
  }
  if (!clubId) return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required.");
  if (!courtId) return fail(COURT_RESOURCE_CODE.MISSING_COURT_ID, "courtId is required.");
  if (!window.date || !window.startTime || !window.endTime) {
    return fail(COURT_RESOURCE_CODE.MISSING_WINDOW, "date and scheduled start/end are required.");
  }

  const membership = deps.assertCourtClusterMembership({
    clubId,
    tenantId: trimId(options.tenantId) || trimId(options.venueId),
    venueId: trimId(options.venueId),
    clusterId: trimId(options.clusterId),
    courtId,
    includeInactive: false,
  });
  if (!membership.ok) return fail(membership.code, membership.error, { valid: false });

  let availability;
  try {
    availability = deps.getCourtAvailability({
      clubId,
      venueId: trimId(options.venueId),
      tenantId: trimId(options.tenantId) || trimId(options.venueId),
      clusterId: trimId(options.clusterId),
      courtId,
      ...window,
      context: { owner },
      includeUnavailable: true,
    });
  } catch (error) {
    return fail(error?.code || COURT_RESOURCE_CODE.DATA_UNAVAILABLE, error?.message || "Failed to evaluate availability.", { valid: false });
  }
  const row = availability.courts?.[0] || null;
  if (!row) return fail(COURT_RESOURCE_CODE.COURT_NOT_FOUND, "Court not found in scoped inventory.", { valid: false });
  if (!row.available) {
    const conflict = row.conflicts?.[0] || {};
    return fail(mapAvailabilityCode(conflict.code), conflict.message || row.reasons?.[0], {
      valid: false,
      availability: row,
    });
  }
  if (
    options.requireOwnerReservation !== false &&
    owner &&
    row.ownership?.status !== OWNERSHIP_STATUS.OWN_RESERVATION
  ) {
    return fail(COURT_RESOURCE_CODE.COURT_NOT_IN_OWNER_SCOPE, "Court is not inside the owner's reserved capacity window.", {
      valid: false,
      availability: row,
    });
  }
  return {
    ok: true,
    valid: true,
    code: COURT_RESOURCE_CODE.ASSIGNMENT_VALID,
    courtId,
    ownership: row.ownership,
    courtLabel: membership.court ? getCourtDisplayName(membership.court) : null,
  };
}

export {
  buildTournamentReservationId,
  isTournamentReservation,
  isActiveTournamentReservation,
};

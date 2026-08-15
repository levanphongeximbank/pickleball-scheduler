/**
 * Shared Court Resource Gateway.
 *
 * Competition / Booking / Daily Play / Maintenance consume this contract.
 * Venue & Court owns inventory, availability, reservation, release, ownership.
 * Not Team Tournament-specific. Does not own Court Engine live occupancy.
 *
 * Capacity reservation = selected physical court × time window.
 * Match assignment is validation only — it does not create a booking.
 */

import { getCourtDisplayName } from "../../../models/court.js";
import { loadBookingsForClub } from "../../../domain/clubStorage.js";
import {
  cancelTournamentCourtBookings,
  syncTournamentCourtBookings,
} from "../../../domain/tournamentBookingService.js";
import {
  createBooking,
  createMaintenanceBooking,
  updateBookingStatus,
} from "../../../domain/bookingService.js";
import {
  COURT_RESOURCE_CODE,
  OWNERSHIP_STATUS,
  RESERVATION_OWNER_TYPE,
} from "../constants/courtResourceContract.js";
import {
  AVAILABILITY_REASON,
  getCourtAvailability as getCanonicalCourtAvailability,
} from "./courtAvailabilityService.js";
import { listCourts } from "./courtInventoryService.js";
import { assertCourtClusterMembership } from "./courtClusterMembershipService.js";
import {
  getReservationOwner as lookupReservationOwner,
  isBlockingReservation,
  isSameReservationOwner,
  normalizeOwnerInput,
} from "./reservationOwnerService.js";

const defaultDeps = Object.freeze({
  getCourtAvailability: getCanonicalCourtAvailability,
  listCourts,
  loadBookingsForClub,
  syncTournamentCourtBookings,
  cancelTournamentCourtBookings,
  createBooking,
  createMaintenanceBooking,
  updateBookingStatus,
  assertCourtClusterMembership,
  getReservationOwner: lookupReservationOwner,
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
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function fail(code, error, extra = {}) {
  return { ok: false, code, error, ...extra };
}

function resolveSelectedCourtIds(options = {}) {
  if (Array.isArray(options.selectedCourtIds) && options.selectedCourtIds.length > 0) {
    return options.selectedCourtIds.map((id) => String(id));
  }
  if (Array.isArray(options.courtIds) && options.courtIds.length > 0) {
    return options.courtIds.map((id) => String(id));
  }
  if (options.courtId != null && String(options.courtId).trim() !== "") {
    return [String(options.courtId).trim()];
  }
  return [];
}

function resolveCivilWindow(options = {}) {
  const date = trimId(options.date);
  const startTime = trimId(options.startTime) || trimId(options.scheduledStart);
  const endTime = trimId(options.endTime) || trimId(options.scheduledEnd);
  return { date, startTime, endTime };
}

function mapAvailabilityConflictCode(conflictCode) {
  switch (conflictCode) {
    case AVAILABILITY_REASON.TOURNAMENT_BOOKING_CONFLICT:
      return COURT_RESOURCE_CODE.TOURNAMENT_BOOKING_CONFLICT;
    case AVAILABILITY_REASON.MAINTENANCE_BOOKING:
    case AVAILABILITY_REASON.COURT_MAINTENANCE:
      return COURT_RESOURCE_CODE.MAINTENANCE_CONFLICT;
    case AVAILABILITY_REASON.BOOKING_CONFLICT:
      return COURT_RESOURCE_CODE.CUSTOMER_BOOKING_CONFLICT;
    case AVAILABILITY_REASON.CLUSTER_MISMATCH:
      return COURT_RESOURCE_CODE.CLUSTER_MISMATCH;
    case AVAILABILITY_REASON.COURT_NOT_FOUND:
      return COURT_RESOURCE_CODE.COURT_NOT_FOUND;
    case AVAILABILITY_REASON.COURT_INACTIVE:
      return COURT_RESOURCE_CODE.COURT_INACTIVE;
    case AVAILABILITY_REASON.COURT_LOCKED:
      return COURT_RESOURCE_CODE.COURT_LOCKED;
    default:
      return conflictCode || COURT_RESOURCE_CODE.BOOKING_CONFLICT;
  }
}

function bookingTypeForOwner(owner) {
  switch (owner.type) {
    case RESERVATION_OWNER_TYPE.TOURNAMENT:
      return "tournament";
    case RESERVATION_OWNER_TYPE.MAINTENANCE:
      return "maintenance";
    case RESERVATION_OWNER_TYPE.DAILY_PLAY:
      return "social_play";
    case RESERVATION_OWNER_TYPE.CUSTOMER:
      return "single";
    default:
      return "single";
  }
}

function buildGenericReservationId(owner, courtId, date) {
  return `${owner.type}-booking-${owner.id}-${courtId}-${date}`;
}

/**
 * Owner-aware availability. Delegates evaluation to canonical getCourtAvailability.
 */
export function getCourtAvailability(options = {}) {
  return deps.getCourtAvailability(options);
}

/**
 * Reserve selected physical courts × one capacity window.
 * Does not reserve a whole cluster. Does not create one row per match.
 */
export function reserveCourts(options = {}) {
  const clubId = trimId(options.clubId);
  const owner = normalizeOwnerInput(options.owner);
  const selectedCourtIds = resolveSelectedCourtIds(options);
  const window = resolveCivilWindow(options);
  const clusterId = trimId(options.clusterId);
  const tenantId = trimId(options.tenantId) || trimId(options.venueId);

  if (!clubId) {
    return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required — no first-club fallback.");
  }
  if (!owner) {
    return fail(COURT_RESOURCE_CODE.MISSING_OWNER, "owner.type and owner.id are required.");
  }
  if (trimId(options.courtLabel) && selectedCourtIds.length === 0) {
    return fail(
      COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED,
      "courtLabel is display-only — reservation identity is courtId."
    );
  }
  if (selectedCourtIds.length === 0) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_COURT_ID,
      "selectedCourtIds are required — cluster is not a reservable unit."
    );
  }
  if (clusterId && selectedCourtIds.length === 1 && selectedCourtIds[0] === clusterId) {
    return fail(
      COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED,
      "Cannot reserve a cluster id as a physical court."
    );
  }
  if (!window.date || !window.startTime || !window.endTime) {
    return fail(COURT_RESOURCE_CODE.MISSING_WINDOW, "date, startTime, and endTime are required.");
  }

  let courts;
  try {
    courts = deps.listCourts({
      clubId,
      tenantId,
      includeInactive: true,
    });
  } catch (error) {
    return fail(
      COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      error?.message || "Failed to load court inventory."
    );
  }

  const membershipFailures = [];
  for (const courtId of selectedCourtIds) {
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
  if (membershipFailures.length > 0) {
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
        courtSchedule: {
          date: window.date,
          startTime: window.startTime,
          endTime: window.endTime,
          courtIds: selectedCourtIds,
        },
      },
      clubId,
      courts
    );
    if (!result.ok) {
      return fail(
        result.code === "BOOKING_CONFLICT"
          ? COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT
          : result.code || COURT_RESOURCE_CODE.PARTIAL_FAILURE,
        result.message || "Reservation failed.",
        {
          reserved: [],
          failed: result.failed || [],
        }
      );
    }
    return {
      ok: true,
      code: COURT_RESOURCE_CODE.OK,
      reserved: [...(result.created || []), ...(result.updated || [])],
      created: result.created || [],
      updated: result.updated || [],
      cancelled: result.cancelled || [],
      selectedCourtIds,
      granularity: "physical_court_x_capacity_window",
    };
  }

  const reserved = [];
  const failed = [];
  for (const courtId of selectedCourtIds) {
    const court = (courts || []).find((item) => String(item.id) === String(courtId));
    const payload = {
      id: buildGenericReservationId(owner, courtId, window.date),
      bookingType: bookingTypeForOwner(owner),
      courtId,
      courtName: court ? getCourtDisplayName(court) : String(courtId),
      customerName: options.label || owner.id,
      customerType: "event",
      date: window.date,
      startTime: window.startTime,
      endTime: window.endTime,
      totalAmount: 0,
      depositAmount: 0,
      paidAmount: 0,
      bookingStatus: "confirmed",
      note: `Court resource reservation: ${owner.type}:${owner.id}`,
    };

    const write =
      owner.type === RESERVATION_OWNER_TYPE.MAINTENANCE
        ? deps.createMaintenanceBooking(payload, clubId)
        : deps.createBooking(payload, clubId);

    if (!write.ok) {
      failed.push({
        courtId,
        message: write.message,
        conflict: write.conflict || null,
      });
      break;
    }
    reserved.push(write.booking);
  }

  if (failed.length > 0) {
    return fail(COURT_RESOURCE_CODE.PARTIAL_FAILURE, failed[0].message, {
      reserved,
      failed,
    });
  }

  return {
    ok: true,
    code: COURT_RESOURCE_CODE.OK,
    reserved,
    created: reserved,
    updated: [],
    cancelled: [],
    selectedCourtIds,
    granularity: "physical_court_x_capacity_window",
  };
}

/**
 * Release only reservations owned by the specified owner.
 */
export function releaseCourts(options = {}) {
  const clubId = trimId(options.clubId);
  const owner = normalizeOwnerInput(options.owner);
  const courtFilter = Array.isArray(options.courtIds) && options.courtIds.length > 0
    ? new Set(options.courtIds.map((id) => String(id)))
    : Array.isArray(options.selectedCourtIds) && options.selectedCourtIds.length > 0
      ? new Set(options.selectedCourtIds.map((id) => String(id)))
      : null;

  if (!clubId) {
    return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required.");
  }
  if (!owner) {
    return fail(COURT_RESOURCE_CODE.MISSING_OWNER, "owner.type and owner.id are required.");
  }

  if (owner.type === RESERVATION_OWNER_TYPE.TOURNAMENT && !courtFilter) {
    const result = deps.cancelTournamentCourtBookings(clubId, owner.id);
    if (!result.ok) {
      return fail(result.code || COURT_RESOURCE_CODE.PARTIAL_FAILURE, result.message, {
        cancelled: result.cancelled || [],
        failed: result.failed || [],
      });
    }
    return {
      ok: true,
      code: COURT_RESOURCE_CODE.OK,
      cancelled: result.cancelled || [],
      failed: [],
    };
  }

  let bookings;
  try {
    bookings = deps.loadBookingsForClub(clubId);
  } catch (error) {
    return fail(COURT_RESOURCE_CODE.DATA_UNAVAILABLE, error?.message || "Failed to load bookings.");
  }

  const targets = (bookings || []).filter((booking) => {
    if (!isBlockingReservation(booking)) {
      return false;
    }
    if (!isSameReservationOwner(booking, owner)) {
      return false;
    }
    if (courtFilter && !courtFilter.has(String(booking.courtId))) {
      return false;
    }
    return true;
  });

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
        message: result.message,
      });
    }
  }

  if (failed.length > 0) {
    return fail(COURT_RESOURCE_CODE.PARTIAL_FAILURE, failed[0].message, {
      cancelled,
      failed,
    });
  }

  return {
    ok: true,
    code: COURT_RESOURCE_CODE.OK,
    cancelled,
    failed: [],
  };
}

export function getReservationOwner(options = {}) {
  return deps.getReservationOwner(options);
}

/**
 * Validate a planned match assignment. Does not write bookings.
 */
export function validateCourtAssignment(options = {}) {
  const clubId = trimId(options.clubId);
  const courtId =
    options.courtId != null && String(options.courtId).trim() !== ""
      ? String(options.courtId).trim()
      : null;
  const owner = normalizeOwnerInput(options.owner);
  const window = resolveCivilWindow(options);
  const clusterId = trimId(options.clusterId);
  const tenantId = trimId(options.tenantId) || trimId(options.venueId);
  const requireOwnerReservation = options.requireOwnerReservation !== false && Boolean(owner);

  if (trimId(options.courtLabel) && !courtId) {
    return fail(
      COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED,
      "courtLabel is display-only — assignment identity is courtId."
    );
  }
  if (!clubId) {
    return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required.");
  }
  if (!courtId) {
    return fail(COURT_RESOURCE_CODE.MISSING_COURT_ID, "courtId is required.");
  }
  if (!window.date || !window.startTime || !window.endTime) {
    return fail(COURT_RESOURCE_CODE.MISSING_WINDOW, "date and scheduled start/end are required.");
  }

  const membership = deps.assertCourtClusterMembership({
    clubId,
    tenantId,
    venueId: trimId(options.venueId),
    clusterId,
    courtId,
    includeInactive: false,
  });
  if (!membership.ok) {
    return fail(membership.code, membership.error, { valid: false });
  }

  let availability;
  try {
    availability = deps.getCourtAvailability({
      clubId,
      venueId: trimId(options.venueId),
      tenantId,
      clusterId,
      courtId,
      date: window.date,
      startTime: window.startTime,
      endTime: window.endTime,
      context: {
        owner,
      },
      includeUnavailable: true,
    });
  } catch (error) {
    return fail(
      error?.code || COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      error?.message || "Failed to evaluate availability.",
      { valid: false }
    );
  }

  const row = (availability.courts || [])[0] || null;
  if (!row) {
    return fail(COURT_RESOURCE_CODE.COURT_NOT_FOUND, "Court not found in scoped inventory.", {
      valid: false,
    });
  }

  if (!row.available) {
    const conflict = (row.conflicts || [])[0] || {};
    return fail(mapAvailabilityConflictCode(conflict.code), conflict.message || row.reasons?.[0], {
      valid: false,
      availability: row,
    });
  }

  if (requireOwnerReservation && row.ownership?.status !== OWNERSHIP_STATUS.OWN_RESERVATION) {
    return fail(
      COURT_RESOURCE_CODE.COURT_NOT_IN_OWNER_SCOPE,
      "Court is not inside the owner's reserved capacity window.",
      { valid: false, availability: row }
    );
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

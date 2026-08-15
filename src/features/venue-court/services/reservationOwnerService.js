/**
 * Shared reservation-owner normalization over the existing booking substrate.
 *
 * Does not introduce a new table. Tournament ownership is bookingType=tournament
 * + tournamentId. Other workloads map from bookingType.
 */

import { isActiveBookingStatus } from "../../../models/booking.js";
import { doTimesOverlap, isBookingBlocking } from "../../../domain/courtBookingEngine.js";
import { loadBookingsForClub } from "../../../domain/clubStorage.js";
import {
  OWNERSHIP_STATUS,
  RESERVATION_OWNER_TYPE,
} from "../constants/courtResourceContract.js";

const defaultDeps = Object.freeze({
  loadBookingsForClub,
});

let deps = { ...defaultDeps };

/** @internal */
export function __setReservationOwnerDepsForTests(next = {}) {
  deps = { ...defaultDeps, ...next };
}

/** @internal */
export function __resetReservationOwnerDepsForTests() {
  deps = { ...defaultDeps };
}

function trimId(value) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function mapBookingTypeToOwnerType(bookingType) {
  switch (String(bookingType || "")) {
    case "tournament":
      return RESERVATION_OWNER_TYPE.TOURNAMENT;
    case "maintenance":
      return RESERVATION_OWNER_TYPE.MAINTENANCE;
    case "social_play":
      return RESERVATION_OWNER_TYPE.DAILY_PLAY;
    case "single":
    case "recurring":
      return RESERVATION_OWNER_TYPE.CUSTOMER;
    default:
      return RESERVATION_OWNER_TYPE.UNKNOWN;
  }
}

/**
 * Normalize a consumer-supplied owner. Generic — not Team Tournament specific.
 * @param {object|null|undefined} owner
 * @returns {{ type: string, id: string }|null}
 */
export function normalizeOwnerInput(owner) {
  if (!owner || typeof owner !== "object") {
    return null;
  }
  const type = trimId(owner.type)?.toLowerCase() || null;
  const id = trimId(owner.id);
  if (!type || !id) {
    return null;
  }

  const aliases = {
    tournament: RESERVATION_OWNER_TYPE.TOURNAMENT,
    customer: RESERVATION_OWNER_TYPE.CUSTOMER,
    maintenance: RESERVATION_OWNER_TYPE.MAINTENANCE,
    daily_play: RESERVATION_OWNER_TYPE.DAILY_PLAY,
    dailyplay: RESERVATION_OWNER_TYPE.DAILY_PLAY,
    social_play: RESERVATION_OWNER_TYPE.DAILY_PLAY,
  };

  return {
    type: aliases[type] || type,
    id,
  };
}

/**
 * Project a booking row into a shared owner — no blob internals.
 * @param {object|null|undefined} booking
 * @returns {{ type: string, id: string }|null}
 */
export function normalizeReservationOwnerFromBooking(booking) {
  if (!booking) {
    return null;
  }

  const type = mapBookingTypeToOwnerType(booking.bookingType);
  if (type === RESERVATION_OWNER_TYPE.TOURNAMENT) {
    const tournamentId = trimId(booking.tournamentId);
    if (!tournamentId) {
      return null;
    }
    return { type, id: tournamentId };
  }

  const id = trimId(booking.id);
  if (!id) {
    return null;
  }
  return { type, id };
}

export function isSameReservationOwner(booking, owner) {
  const normalized = normalizeReservationOwnerFromBooking(booking);
  const requested = normalizeOwnerInput(owner);
  if (!normalized || !requested) {
    return false;
  }
  return normalized.type === requested.type && normalized.id === requested.id;
}

export function projectReservationOwner(booking) {
  if (!booking) {
    return {
      found: false,
      owner: null,
      reservationId: null,
      courtId: null,
      ownershipStatus: OWNERSHIP_STATUS.UNRESERVED,
      window: null,
    };
  }

  return {
    found: true,
    owner: normalizeReservationOwnerFromBooking(booking),
    reservationId: trimId(booking.id),
    courtId: booking.courtId != null ? String(booking.courtId) : null,
    ownershipStatus: OWNERSHIP_STATUS.FOREIGN,
    window: {
      date: booking.date || null,
      startTime: booking.startTime || null,
      endTime: booking.endTime || null,
    },
  };
}

function sameCourtId(left, right) {
  return left != null && right != null && String(left) === String(right);
}

export function bookingOverlapsWindow(booking, range = {}) {
  if (!booking || !range.date || !range.startTime || !range.endTime) {
    return false;
  }
  if (String(booking.date || "") !== String(range.date)) {
    return false;
  }
  return doTimesOverlap(
    booking.startTime,
    booking.endTime,
    range.startTime,
    range.endTime
  );
}

export function bookingFullyContainsWindow(booking, range = {}) {
  if (!bookingOverlapsWindow(booking, range)) {
    return false;
  }
  const start = String(booking.startTime || "");
  const end = String(booking.endTime || "");
  return start <= String(range.startTime) && end >= String(range.endTime);
}

export function isBlockingReservation(booking) {
  if (!booking) {
    return false;
  }
  if (typeof isBookingBlocking === "function" && isBookingBlocking(booking)) {
    return true;
  }
  return (
    booking.bookingStatus !== "cancelled" &&
    booking.bookingStatus !== "completed" &&
    isActiveBookingStatus(booking.bookingStatus)
  );
}

/**
 * Find the owner's capacity reservation that fully covers the requested window.
 */
export function findContainingOwnReservation(
  bookings,
  { courtId, date, startTime, endTime, owner, excludeBookingId = null } = {}
) {
  const requested = normalizeOwnerInput(owner);
  if (!requested || courtId == null || !date) {
    return null;
  }

  const range = { date, startTime, endTime };
  return (
    (bookings || []).find((booking) => {
      if (excludeBookingId && String(booking.id) === String(excludeBookingId)) {
        return false;
      }
      if (!isBlockingReservation(booking)) {
        return false;
      }
      if (!sameCourtId(booking.courtId, courtId)) {
        return false;
      }
      if (!isSameReservationOwner(booking, requested)) {
        return false;
      }
      return bookingFullyContainsWindow(booking, range);
    }) || null
  );
}

/**
 * Shared reservation-owner lookup for a court window or reservation id.
 */
export function getReservationOwner(options = {}) {
  const clubId = trimId(options.clubId);
  if (!clubId) {
    return {
      found: false,
      owner: null,
      reservationId: null,
      courtId: null,
      ownershipStatus: OWNERSHIP_STATUS.UNRESERVED,
      window: null,
      code: "MISSING_CLUB_ID",
    };
  }

  let bookings;
  try {
    bookings = deps.loadBookingsForClub(clubId);
  } catch (error) {
    return {
      found: false,
      owner: null,
      reservationId: null,
      courtId: null,
      ownershipStatus: OWNERSHIP_STATUS.UNRESERVED,
      window: null,
      code: "DATA_UNAVAILABLE",
      error: error?.message || "Failed to load bookings",
    };
  }

  const reservationId = trimId(options.reservationId) || trimId(options.bookingId);
  if (reservationId) {
    const booking =
      (bookings || []).find((item) => String(item.id) === reservationId) || null;
    return projectReservationOwner(booking);
  }

  const courtId = options.courtId;
  const range = {
    date: options.date,
    startTime: options.startTime || options.scheduledStart,
    endTime: options.endTime || options.scheduledEnd,
  };

  const matches = (bookings || []).filter((booking) => {
    if (!isBlockingReservation(booking)) {
      return false;
    }
    if (courtId != null && !sameCourtId(booking.courtId, courtId)) {
      return false;
    }
    return bookingOverlapsWindow(booking, range);
  });

  if (matches.length === 0) {
    return projectReservationOwner(null);
  }

  return projectReservationOwner(matches[0]);
}

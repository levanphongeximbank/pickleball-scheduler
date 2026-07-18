/**
 * Venue & Court — Canonical court availability (Phase 1E).
 *
 * Read-only. Delegates overlap/status checks to courtBookingEngine.
 * SSOT: Club V3 courts[] + bookings[] + courtManagement hours.
 */

import { listCourts } from "./courtInventoryService.js";
import { loadBookingsForClub } from "../../../domain/clubStorage.js";
import { loadCourtManagementSettings } from "../../../domain/courtManagementSettings.js";
import {
  checkBookingConflict,
  timeToMinutes,
} from "../../../domain/courtBookingEngine.js";
import { loadClubs } from "../../../data/club.js";
import { isCourtBookable } from "../../../models/court.js";

export const AVAILABILITY_REASON = Object.freeze({
  AVAILABLE: "AVAILABLE",
  COURT_NOT_FOUND: "COURT_NOT_FOUND",
  COURT_INACTIVE: "COURT_INACTIVE",
  COURT_LOCKED: "COURT_LOCKED",
  COURT_MAINTENANCE: "COURT_MAINTENANCE",
  OUTSIDE_VENUE_HOURS: "OUTSIDE_VENUE_HOURS",
  BOOKING_CONFLICT: "BOOKING_CONFLICT",
  TOURNAMENT_BOOKING_CONFLICT: "TOURNAMENT_BOOKING_CONFLICT",
  MAINTENANCE_BOOKING: "MAINTENANCE_BOOKING",
  INVALID_TIME_RANGE: "INVALID_TIME_RANGE",
  VENUE_MISMATCH: "VENUE_MISMATCH",
  CLUSTER_MISMATCH: "CLUSTER_MISMATCH",
  CLUB_SCOPE_MISSING: "CLUB_SCOPE_MISSING",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const defaultDeps = Object.freeze({
  listCourts,
  loadBookingsForClub,
  loadCourtManagementSettings,
  loadClubs,
  checkBookingConflict,
});

let deps = { ...defaultDeps };

/** @internal Test-only dependency override. */
export function __setCourtAvailabilityDepsForTests(nextDeps = {}) {
  deps = { ...defaultDeps, ...nextDeps };
}

/** @internal Test-only dependency reset. */
export function __resetCourtAvailabilityDepsForTests() {
  deps = { ...defaultDeps };
}

function createValidationError(message, code = AVAILABILITY_REASON.INVALID_TIME_RANGE) {
  return Object.assign(new Error(message), { code });
}

function createLoadError(message, cause) {
  return Object.assign(new Error(message), {
    code: AVAILABILITY_REASON.DATA_UNAVAILABLE,
    cause,
  });
}

function parseHhmmStrict(value, label) {
  const text = String(value || "").trim();
  if (!HHMM_RE.test(text)) {
    throw createValidationError(`${label} phải có dạng HH:mm.`);
  }
  return text;
}

function parseDateStrict(value) {
  const text = String(value || "").trim();
  if (!DATE_RE.test(text)) {
    throw createValidationError("date phải có dạng YYYY-MM-DD.");
  }
  return text;
}

function resolveScope(options = {}) {
  const clubId = options.clubId != null && String(options.clubId).trim() !== ""
    ? String(options.clubId).trim()
    : null;
  const venueId =
    (options.venueId != null && String(options.venueId).trim() !== "" && String(options.venueId).trim()) ||
    (options.tenantId != null && String(options.tenantId).trim() !== "" && String(options.tenantId).trim()) ||
    null;

  if (!clubId) {
    throw createValidationError(
      "getCourtAvailability requires clubId.",
      AVAILABILITY_REASON.CLUB_SCOPE_MISSING
    );
  }

  if (venueId) {
    const club = deps.loadClubs().find((item) => item.id === clubId);
    if (!club || club.venueId !== venueId) {
      throw createValidationError(
        "Club does not belong to the selected venue.",
        AVAILABILITY_REASON.VENUE_MISMATCH
      );
    }
  }

  return { clubId, venueId };
}

function validateTimeWindow(options = {}) {
  const date = parseDateStrict(options.date);
  const startTime = parseHhmmStrict(options.startTime, "startTime");
  const endTime = parseHhmmStrict(options.endTime, "endTime");

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw createValidationError(
      "endTime phải sau startTime trong cùng ngày (không hỗ trợ qua đêm)."
    );
  }

  return { date, startTime, endTime };
}

function isOutsideOperatingHours(startTime, endTime, openHour, closeHour) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const openMin = Number(openHour) * 60;
  const closeMin = Number(closeHour) * 60;
  return startMin < openMin || endMin > closeMin;
}

function classifyBookingConflict(booking) {
  if (!booking) {
    return {
      code: AVAILABILITY_REASON.BOOKING_CONFLICT,
      message: "Court already has an overlapping booking",
    };
  }

  if (booking.bookingType === "maintenance") {
    return {
      code: AVAILABILITY_REASON.MAINTENANCE_BOOKING,
      referenceId: booking.id,
      message: "Court has an overlapping maintenance booking",
    };
  }

  if (booking.bookingType === "tournament") {
    return {
      code: AVAILABILITY_REASON.TOURNAMENT_BOOKING_CONFLICT,
      referenceId: booking.id,
      message: "Court has an overlapping tournament booking",
    };
  }

  return {
    code: AVAILABILITY_REASON.BOOKING_CONFLICT,
    referenceId: booking.id,
    message: "Court already has an overlapping booking",
  };
}

function buildSource() {
  return {
    inventory: "club_data_v3",
    booking: "club_data_v3",
    settings: "courtManagementSettings",
  };
}

function toCourtPublic(court) {
  if (!court) {
    return null;
  }
  return {
    id: court.id,
    name: court.name,
    number: court.number,
    active: court.active,
    status: court.status,
    ...(court.clusterId ? { clusterId: court.clusterId } : {}),
  };
}

function unavailableResult(courtId, checkedRange, conflicts, court = null) {
  return {
    available: false,
    courtId,
    court: toCourtPublic(court),
    checkedRange: { ...checkedRange },
    conflicts: (conflicts || []).map((item) => ({ ...item })),
    reasons: (conflicts || []).map((item) => item.message).filter(Boolean),
    source: buildSource(),
  };
}

function availableResult(courtId, checkedRange, court) {
  return {
    available: true,
    courtId,
    court: toCourtPublic(court),
    checkedRange: { ...checkedRange },
    conflicts: [],
    reasons: [],
    source: buildSource(),
  };
}

/**
 * Evaluate one court against inventory + bookings + operating hours.
 * Pure relative to injected deps; no writes.
 */
export function evaluateCourtAvailability({
  court,
  courtId,
  bookings,
  settings,
  checkedRange,
  clusterId = null,
  excludeBookingId = null,
}) {
  const range = {
    date: checkedRange.date,
    startTime: checkedRange.startTime,
    endTime: checkedRange.endTime,
  };

  if (!court) {
    return unavailableResult(courtId, range, [
      {
        code: AVAILABILITY_REASON.COURT_NOT_FOUND,
        message: "Court not found in scoped inventory",
      },
    ]);
  }

  if (clusterId != null && clusterId !== "") {
    if (String(court.clusterId || "") !== String(clusterId)) {
      return unavailableResult(
        court.id,
        range,
        [
          {
            code: AVAILABILITY_REASON.CLUSTER_MISMATCH,
            message: "Court does not belong to the requested cluster",
          },
        ],
        court
      );
    }
  }

  if (court.active === false) {
    return unavailableResult(
      court.id,
      range,
      [
        {
          code: AVAILABILITY_REASON.COURT_INACTIVE,
          message: "Court is inactive",
        },
      ],
      court
    );
  }

  if (court.status === "maintenance") {
    return unavailableResult(
      court.id,
      range,
      [
        {
          code: AVAILABILITY_REASON.COURT_MAINTENANCE,
          message: "Court master status is maintenance",
        },
      ],
      court
    );
  }

  if (court.status === "locked" || !isCourtBookable(court)) {
    return unavailableResult(
      court.id,
      range,
      [
        {
          code: AVAILABILITY_REASON.COURT_LOCKED,
          message: "Court is locked",
        },
      ],
      court
    );
  }

  const conflictCheck = deps.checkBookingConflict(
    bookings,
    {
      courtId: court.id,
      date: range.date,
      startTime: range.startTime,
      endTime: range.endTime,
    },
    excludeBookingId
  );

  if (conflictCheck) {
    const conflict = classifyBookingConflict(conflictCheck.conflict);
    return unavailableResult(court.id, range, [conflict], court);
  }

  if (
    isOutsideOperatingHours(
      range.startTime,
      range.endTime,
      settings.openHour,
      settings.closeHour
    )
  ) {
    return unavailableResult(
      court.id,
      range,
      [
        {
          code: AVAILABILITY_REASON.OUTSIDE_VENUE_HOURS,
          message: "Requested time is outside venue operating hours",
        },
      ],
      court
    );
  }

  return availableResult(court.id, range, court);
}

/**
 * Canonical read-only availability contract.
 *
 * Input (venue-local civil time; no timezone guessing):
 * {
 *   clubId,              // required
 *   venueId|tenantId,    // optional; must match club when provided
 *   clusterId,           // optional filter
 *   courtId,             // optional; when set, only this court
 *   courtIds,            // optional; filter to these ids
 *   date,                // YYYY-MM-DD
 *   startTime, endTime,  // HH:mm, end > start same day
 *   context: { type?, excludeBookingId? },
 *   includeUnavailable   // default true
 * }
 *
 * Output:
 * {
 *   clubId, venueId,
 *   checkedRange: { date, startTime, endTime },
 *   courts: [ { available, courtId, court, conflicts, reasons, source } ],
 *   source
 * }
 */
export function getCourtAvailability(options = {}) {
  const { clubId, venueId } = resolveScope(options);
  const checkedRange = validateTimeWindow(options);
  const clusterId = options.clusterId != null && options.clusterId !== ""
    ? String(options.clusterId)
    : null;
  const excludeBookingId = options.context?.excludeBookingId || null;
  const includeUnavailable = options.includeUnavailable !== false;

  let courts;
  let bookings;
  let settings;

  try {
    courts = deps.listCourts({
      clubId,
      tenantId: venueId || null,
      includeInactive: true,
    });
    bookings = deps.loadBookingsForClub(clubId);
    settings = deps.loadCourtManagementSettings(clubId);
  } catch (error) {
    throw createLoadError("Failed to load court availability data", error);
  }

  if (!Array.isArray(courts) || !Array.isArray(bookings) || !settings) {
    throw createLoadError("Failed to load court availability data");
  }

  let targetIds = null;
  if (options.courtId != null && String(options.courtId).trim() !== "") {
    targetIds = [String(options.courtId)];
  } else if (Array.isArray(options.courtIds) && options.courtIds.length > 0) {
    targetIds = options.courtIds.map((id) => String(id));
  }

  const courtById = new Map((courts || []).map((court) => [String(court.id), court]));
  const idsToEvaluate = targetIds || [...courtById.keys()];

  const results = [];
  for (const id of idsToEvaluate) {
    const court = courtById.get(String(id)) || null;
    const result = evaluateCourtAvailability({
      court,
      courtId: id,
      bookings,
      settings,
      checkedRange,
      clusterId,
      excludeBookingId,
    });
    if (includeUnavailable || result.available) {
      results.push(result);
    }
  }

  return {
    clubId,
    venueId: venueId || null,
    checkedRange: { ...checkedRange },
    courts: results,
    source: buildSource(),
  };
}

/**
 * Court Operations Booking Application Service.
 *
 * UI → this boundary → CourtResourceGateway (inventory/availability)
 *                   → canonical booking RPCs (business + atomic capacity)
 *
 * Canonical path is fail-closed. No blob overlap checkers, no legacy identity
 * mapping requirements, and no default-club fallbacks.
 */
import { isCanonicalPhysicalCourtId } from "../contracts/canonicalPhysicalCourt.js";
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";
import {
  CANONICAL_BOOKING_LIFECYCLE_STATUS,
  CANONICAL_BOOKING_OWNER_TYPE,
  isCanonicalBookingLifecycle,
} from "../constants/canonicalBooking.js";
import {
  getCourtAvailability,
  listEligibleCourts,
} from "./courtResourceGateway.js";
import {
  rpcCancelBooking,
  rpcCreateBooking,
  rpcGetBooking,
  rpcListBookings,
  rpcRescheduleBooking,
  rpcTransferBookingCourt,
  rpcUpdateBookingLifecycle,
} from "./canonicalBookingClient.js";

function trimId(value) {
  if (value == null) return "";
  return String(value).trim();
}

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function windowToTimestamps(input = {}) {
  const startsAt = trimId(input.startsAt);
  const endsAt = trimId(input.endsAt);
  if (startsAt && endsAt) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return null;
    }
    return { startsAt: start.toISOString(), endsAt: end.toISOString() };
  }
  const date = trimId(input.date);
  const startTime = trimId(input.startTime);
  const endTime = trimId(input.endTime);
  if (!date || !startTime || !endTime) return null;
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function requireTenantClub(input = {}) {
  const tenantId = trimId(input.tenantId);
  const clubId = trimId(input.clubId);
  if (!tenantId) {
    return fail(
      COURT_RESOURCE_CODE.TENANT_MISMATCH,
      "tenantId is required — fail closed (no venueId invent, no default-club)."
    );
  }
  if (!clubId) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_CLUB_ID,
      "clubId is required — no default-club fallback."
    );
  }
  return { ok: true, tenantId, clubId };
}

function requirePhysicalCourtId(value) {
  const physicalCourtId = trimId(value);
  if (!physicalCourtId) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_COURT_ID,
      "physicalCourtId is required — legacy courtId / labels are not identity."
    );
  }
  if (!isCanonicalPhysicalCourtId(physicalCourtId)) {
    return fail(
      COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED,
      "physicalCourtId must be a UUID — labels and legacy court ids are not identity.",
      { physicalCourtId }
    );
  }
  return { ok: true, physicalCourtId };
}

function buildPayload(input = {}) {
  return {
    bookingCode: input.bookingCode || undefined,
    bookingType: input.bookingType || "single",
    customerName: input.customerName || "",
    customerPhone: input.customerPhone || "",
    customerType: input.customerType || "walk_in",
    customerRef: input.customerRef || input.customerId || null,
    totalAmount: input.totalAmount ?? 0,
    depositAmount: input.depositAmount ?? 0,
    paidAmount: input.paidAmount ?? 0,
    paymentStatus: input.paymentStatus || undefined,
    note: input.note || "",
    courtDisplayName: input.courtDisplayName || input.courtName || "",
    lifecycleStatus:
      input.lifecycleStatus || input.bookingStatus || CANONICAL_BOOKING_LIFECYCLE_STATUS.CONFIRMED,
    ownerSubType: input.ownerSubType || (input.bookingType === "recurring" ? "recurring" : "customer"),
  };
}

function mapBookingResult(result) {
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      message: result?.message || result?.error || "Canonical booking command failed.",
      capacityPreserved: result?.capacityPreserved === true,
      ...result,
    };
  }
  const booking = result.booking || null;
  return {
    ok: true,
    code: result.code || COURT_RESOURCE_CODE.OK,
    booking,
    bookingId: booking?.bookingId || result.bookingId || null,
    reservationId: result.reservationId || booking?.reservationId || null,
    physicalCourtId: result.physicalCourtId || booking?.physicalCourtId || null,
    replay: result.replay === true,
    message: result.message,
  };
}

function defaultRequestId(prefix) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * List eligible courts for Booking UI — gateway only.
 */
export async function listBookingEligibleCourts(input = {}) {
  const scope = requireTenantClub(input);
  if (!scope.ok) return { ...scope, courts: [] };
  return listEligibleCourts({
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    clusterId: trimId(input.clusterId) || undefined,
  });
}

/**
 * Availability for Booking — gateway canonical capacity only.
 */
export async function getBookingCourtAvailability(input = {}) {
  const scope = requireTenantClub(input);
  if (!scope.ok) return scope;
  const court = requirePhysicalCourtId(input.physicalCourtId || input.physicalCourtIds?.[0]);
  if (!court.ok) return court;
  const window = windowToTimestamps(input);
  if (!window) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_WINDOW,
      "startsAt/endsAt or date+startTime+endTime are required."
    );
  }
  return getCourtAvailability({
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    physicalCourtId: court.physicalCourtId,
    physicalCourtIds: [court.physicalCourtId],
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    owner: input.owner || { type: CANONICAL_BOOKING_OWNER_TYPE, id: trimId(input.bookingId) || "preview" },
  });
}

/**
 * Create booking (also walk-in / quick-book). Atomic reserve + persist.
 */
export async function createCourtOperationsBooking(input = {}) {
  if (!isCanonicalBookingLifecycle() && input.forceCanonical !== true) {
    return fail(
      COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      "Canonical booking lifecycle is not enabled."
    );
  }
  const scope = requireTenantClub(input);
  if (!scope.ok) return scope;
  const court = requirePhysicalCourtId(input.physicalCourtId);
  if (!court.ok) return court;
  if (trimId(input.courtLabel) && !trimId(input.physicalCourtId)) {
    return fail(
      COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED,
      "court label cannot create canonical Booking."
    );
  }
  const window = windowToTimestamps(input);
  if (!window) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_WINDOW,
      "startsAt/endsAt or date+startTime+endTime are required."
    );
  }
  const requestId = trimId(input.requestId) || defaultRequestId("booking-create");
  const result = await rpcCreateBooking({
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    physicalCourtId: court.physicalCourtId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    requestId,
    payload: buildPayload(input),
  });
  return mapBookingResult(result);
}

/**
 * Reschedule time and/or court (atomic). Failed reschedule preserves old capacity.
 */
export async function rescheduleCourtOperationsBooking(input = {}) {
  if (!isCanonicalBookingLifecycle() && input.forceCanonical !== true) {
    return fail(
      COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      "Canonical booking lifecycle is not enabled."
    );
  }
  const tenantId = trimId(input.tenantId);
  if (!tenantId) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required — fail closed.");
  }
  const bookingId = trimId(input.bookingId);
  if (!bookingId) {
    return fail(COURT_RESOURCE_CODE.INVALID_INPUT, "bookingId is required.");
  }
  const court = requirePhysicalCourtId(input.physicalCourtId);
  if (!court.ok) return court;
  const window = windowToTimestamps(input);
  if (!window) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_WINDOW,
      "startsAt/endsAt or date+startTime+endTime are required."
    );
  }
  const requestId = trimId(input.requestId) || defaultRequestId(`booking-reschedule:${bookingId}`);
  const result = await rpcRescheduleBooking({
    tenantId,
    bookingId,
    physicalCourtId: court.physicalCourtId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    expectedVersion: Number(input.expectedVersion ?? input.version),
    requestId,
    payload: buildPayload(input),
  });
  return mapBookingResult(result);
}

/**
 * Transfer court A → B preserving bookingId. Failed transfer preserves A.
 */
export async function transferCourtOperationsBooking(input = {}) {
  if (!isCanonicalBookingLifecycle() && input.forceCanonical !== true) {
    return fail(
      COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      "Canonical booking lifecycle is not enabled."
    );
  }
  const tenantId = trimId(input.tenantId);
  if (!tenantId) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required — fail closed.");
  }
  const bookingId = trimId(input.bookingId);
  if (!bookingId) {
    return fail(COURT_RESOURCE_CODE.INVALID_INPUT, "bookingId is required.");
  }
  const court = requirePhysicalCourtId(input.newPhysicalCourtId || input.physicalCourtId);
  if (!court.ok) return court;
  const requestId = trimId(input.requestId) || defaultRequestId(`booking-transfer:${bookingId}`);
  const result = await rpcTransferBookingCourt({
    tenantId,
    bookingId,
    newPhysicalCourtId: court.physicalCourtId,
    expectedVersion: Number(input.expectedVersion ?? input.version),
    requestId,
  });
  return mapBookingResult(result);
}

/**
 * Cancel booking + release owned capacity. Idempotent.
 */
export async function cancelCourtOperationsBooking(input = {}) {
  if (!isCanonicalBookingLifecycle() && input.forceCanonical !== true) {
    return fail(
      COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      "Canonical booking lifecycle is not enabled."
    );
  }
  const tenantId = trimId(input.tenantId);
  if (!tenantId) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required — fail closed.");
  }
  const bookingId = trimId(input.bookingId);
  if (!bookingId) {
    return fail(COURT_RESOURCE_CODE.INVALID_INPUT, "bookingId is required.");
  }
  const requestId = trimId(input.requestId) || defaultRequestId(`booking-cancel:${bookingId}`);
  const result = await rpcCancelBooking({
    tenantId,
    bookingId,
    requestId,
    releaseReason: input.releaseReason || "booking_cancelled",
  });
  return mapBookingResult(result);
}

/**
 * Booking lifecycle only (check-in / start / complete / auto). No capacity mutation.
 */
export async function updateCourtOperationsBookingLifecycle(input = {}) {
  if (!isCanonicalBookingLifecycle() && input.forceCanonical !== true) {
    return fail(
      COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      "Canonical booking lifecycle is not enabled."
    );
  }
  const tenantId = trimId(input.tenantId);
  if (!tenantId) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required — fail closed.");
  }
  const bookingId = trimId(input.bookingId);
  const lifecycleStatus = trimId(input.lifecycleStatus || input.bookingStatus);
  if (!bookingId || !lifecycleStatus) {
    return fail(COURT_RESOURCE_CODE.INVALID_INPUT, "bookingId and lifecycleStatus are required.");
  }
  const requestId =
    trimId(input.requestId) || defaultRequestId(`booking-lifecycle:${bookingId}:${lifecycleStatus}`);
  const result = await rpcUpdateBookingLifecycle({
    tenantId,
    bookingId,
    lifecycleStatus,
    expectedVersion: Number(input.expectedVersion ?? input.version),
    requestId,
  });
  return mapBookingResult(result);
}

export async function getCourtOperationsBooking(input = {}) {
  const tenantId = trimId(input.tenantId);
  if (!tenantId) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required — fail closed.");
  }
  const bookingId = trimId(input.bookingId);
  if (!bookingId) {
    return fail(COURT_RESOURCE_CODE.INVALID_INPUT, "bookingId is required.");
  }
  return mapBookingResult(await rpcGetBooking({ tenantId, bookingId }));
}

export async function listCourtOperationsBookings(input = {}) {
  const scope = requireTenantClub(input);
  if (!scope.ok) return { ...scope, bookings: [] };
  const result = await rpcListBookings({
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    from: input.from || null,
    to: input.to || null,
    lifecycleStatuses: input.lifecycleStatuses || null,
  });
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      message: result?.message || result?.error || "Failed to list bookings.",
      bookings: [],
    };
  }
  return {
    ok: true,
    code: result.code || COURT_RESOURCE_CODE.OK,
    bookings: Array.isArray(result.bookings) ? result.bookings : [],
  };
}

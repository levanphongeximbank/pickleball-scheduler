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
  __bindCanonicalBookingGateway,
} from "../../../domain/bookingService.js";
import {
  COURT_RESOURCE_CODE,
  OWNERSHIP_STATUS,
  RESERVATION_OWNER_TYPE,
} from "../constants/courtResourceContract.js";
import {
  CANONICAL_AVAILABILITY_STATUS,
  isCanonicalReservationCutover,
  mapGatewayOwnerTypeToCanonical,
} from "../constants/canonicalReservation.js";
import { isCanonicalPhysicalCourtId } from "../contracts/canonicalPhysicalCourt.js";
import { resolveLegacyCourtIdentity } from "../contracts/legacyCourtIdentityMapping.js";
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
import {
  productionCanonicalGetAvailability,
  productionCanonicalRelease,
  productionCanonicalReserve,
} from "../runtime/canonicalReservationRuntime.js";

function adapterDeps() {
  return {
    loadBookingsForClub: deps.loadBookingsForClub,
    checkBookingConflict: deps.checkBookingConflict,
    createBooking: deps.createBooking,
    saveBooking: deps.saveBooking,
    updateBookingStatus: deps.updateBookingStatus,
  };
}

async function settle(value) {
  return value && typeof value.then === "function" ? await value : value;
}

async function defaultSyncTournamentCourtBookings(tournament, clubId, courts = []) {
  const schedule = tournament?.courtSchedule || {};
  return settle(
    syncLegacyTournamentReservations(
      {
        clubId,
        owner: { type: RESERVATION_OWNER_TYPE.TOURNAMENT, id: tournament.id },
        courts,
        courtIds: schedule.courtIds || [],
        window: schedule,
        label: tournament.name || tournament.id,
      },
      adapterDeps()
    )
  );
}

async function defaultCancelTournamentCourtBookings(clubId, ownerId, courtIds = null) {
  return settle(
    releaseLegacyTournamentReservations(
      {
        clubId,
        owner: { type: RESERVATION_OWNER_TYPE.TOURNAMENT, id: ownerId },
        courtIds,
      },
      adapterDeps()
    )
  );
}

function defaultResolveLegacyPhysicalCourt(options = {}) {
  const mappings = Array.isArray(options.legacyMappings) ? options.legacyMappings : [];
  const key = {
    tenantId: trimId(options.tenantId) || trimId(options.venueId),
    clubId: trimId(options.clubId),
    sourceSystem: trimId(options.sourceSystem) || "club-data-v3",
    sourceVersion: trimId(options.sourceVersion) || "3",
    legacyClusterId: trimId(options.legacyClusterId) || trimId(options.clusterId),
    legacyCourtId: trimId(options.courtId) || trimId(options.legacyCourtId),
  };
  if (!key.tenantId || !key.clubId || !key.legacyClusterId || !key.legacyCourtId) {
    return fail(
      COURT_RESOURCE_CODE.UNRESOLVED_MAPPING,
      "Legacy court identity mapping is incomplete — fail closed."
    );
  }
  try {
    const resolved = resolveLegacyCourtIdentity(key, mappings);
    if (resolved.classification !== "deterministic" || !resolved.physicalCourtId) {
      return fail(
        COURT_RESOURCE_CODE.UNRESOLVED_MAPPING,
        "Legacy court identity is not a deterministic physicalCourtId mapping.",
        { classification: resolved.classification }
      );
    }
    return { ok: true, physicalCourtId: resolved.physicalCourtId };
  } catch (error) {
    return fail(
      COURT_RESOURCE_CODE.UNRESOLVED_MAPPING,
      error?.message || "Legacy court identity mapping failed closed."
    );
  }
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
  canonicalReserve: productionCanonicalReserve,
  canonicalRelease: productionCanonicalRelease,
  canonicalGetAvailability: productionCanonicalGetAvailability,
  resolveLegacyPhysicalCourt: defaultResolveLegacyPhysicalCourt,
  isCanonicalReservationCutover,
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

function selectedPhysicalCourtIds(options) {
  const raw = Array.isArray(options.physicalCourtIds)
    ? options.physicalCourtIds
    : trimId(options.physicalCourtId)
      ? [options.physicalCourtId]
      : [];
  return raw.map(trimId).filter(Boolean);
}

function canonicalCutoverEnabled(options = {}) {
  if (options.canonicalReservationCutover === true) return true;
  if (options.canonicalReservationCutover === false) return false;
  if (typeof deps.isCanonicalReservationCutover === "function") {
    return deps.isCanonicalReservationCutover() === true;
  }
  return isCanonicalReservationCutover() === true;
}

async function invokeCanonicalAdapter(adapter, payload, missingMessage) {
  if (typeof adapter !== "function") {
    return fail(COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE, missingMessage);
  }
  try {
    const result = adapter(payload);
    return await settle(result);
  } catch (error) {
    return fail(
      error?.code || COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      error?.message || "Canonical reservation adapter rejected.",
      { reserved: [], cancelled: [], failed: [], courts: [] }
    );
  }
}

function windowToTimestamps(options) {
  const startsAt = trimId(options.startsAt);
  const endsAt = trimId(options.endsAt);
  if (startsAt && endsAt) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return null;
    }
    return { startsAt: start.toISOString(), endsAt: end.toISOString() };
  }
  const window = windowFrom(options);
  if (!window.date || !window.startTime || !window.endTime) return null;
  const start = new Date(`${window.date}T${window.startTime}:00`);
  const end = new Date(`${window.date}T${window.endTime}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function resolveCanonicalPhysicalIds(options) {
  const direct = selectedPhysicalCourtIds(options);
  if (direct.length) {
    const invalid = direct.filter((id) => !isCanonicalPhysicalCourtId(id));
    if (invalid.length) {
      return fail(
        COURT_RESOURCE_CODE.UNRESOLVED_MAPPING,
        "physicalCourtId must be a UUID — labels and legacy court ids are not identity.",
        { failed: invalid }
      );
    }
    return { ok: true, physicalCourtIds: [...new Set(direct)].sort() };
  }
  const courtIds = selectedCourtIds(options);
  if (!courtIds.length) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_COURT_ID,
      "physicalCourtIds are required — cluster and courtCount are not reservable units."
    );
  }
  const resolved = [];
  for (const courtId of courtIds) {
    const row = deps.resolveLegacyPhysicalCourt({ ...options, courtId });
    if (!row?.ok) {
      return fail(
        row?.code || COURT_RESOURCE_CODE.UNRESOLVED_MAPPING,
        row?.error || "Legacy court identity mapping failed closed.",
        { courtId }
      );
    }
    resolved.push(row.physicalCourtId);
  }
  return { ok: true, physicalCourtIds: [...new Set(resolved)].sort() };
}

function denyNonPhysicalReservation(options) {
  if (
    options.courtCount != null
    && selectedPhysicalCourtIds(options).length === 0
    && selectedCourtIds(options).length === 0
  ) {
    return fail(
      COURT_RESOURCE_CODE.COURT_COUNT_DENIED,
      "courtCount is demand only — reserve physicalCourtIds."
    );
  }
  const clusterId = trimId(options.clusterId);
  const courtIds = selectedCourtIds(options);
  if (
    clusterId
    && courtIds.length === 1
    && String(courtIds[0]) === clusterId
    && selectedPhysicalCourtIds(options).length === 0
  ) {
    return fail(
      COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED,
      "Cannot reserve a cluster id as a physical court."
    );
  }
  return null;
}

function canonicalOwnerFrom(options) {
  const owner = normalizeOwnerInput(options.owner);
  if (!owner) return null;
  const ownerType = mapGatewayOwnerTypeToCanonical(owner.type);
  if (!ownerType) return null;
  return {
    ownerType,
    ownerId: owner.id,
    ownerSubType:
      trimId(options.ownerSubType)
      || trimId(options.owner?.subType)
      || trimId(options.owner?.ownerSubType),
  };
}

function mapCanonicalAvailabilityStatus(status) {
  if (status === CANONICAL_AVAILABILITY_STATUS.OWN_RESERVATION) {
    return OWNERSHIP_STATUS.OWN_RESERVATION;
  }
  if (status === CANONICAL_AVAILABILITY_STATUS.FOREIGN_RESERVATION) {
    return OWNERSHIP_STATUS.FOREIGN;
  }
  if (status === CANONICAL_AVAILABILITY_STATUS.AVAILABLE) {
    return OWNERSHIP_STATUS.UNRESERVED;
  }
  return status;
}

async function reserveCourtsCanonical(options) {
  const denied = denyNonPhysicalReservation(options);
  if (denied) return denied;
  const clubId = trimId(options.clubId);
  const tenantId = trimId(options.tenantId) || trimId(options.venueId);
  const owner = canonicalOwnerFrom(options);
  if (!clubId) return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required — no first-club fallback.");
  if (!tenantId) return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required.");
  if (!owner) return fail(COURT_RESOURCE_CODE.MISSING_OWNER, "owner.type and owner.id are required.");
  const window = windowToTimestamps(options);
  if (!window) {
    return fail(COURT_RESOURCE_CODE.MISSING_WINDOW, "startsAt/endsAt or date+startTime+endTime are required.");
  }
  const resolved = resolveCanonicalPhysicalIds(options);
  if (!resolved.ok) return resolved;
  const requestId = trimId(options.requestId);
  if (!requestId) return fail(COURT_RESOURCE_CODE.REQUEST_ID_REQUIRED, "requestId is required.");
  const result = await invokeCanonicalAdapter(
    deps.canonicalReserve,
    {
      tenantId,
      clubId,
      physicalCourtIds: resolved.physicalCourtIds,
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      ownerSubType: owner.ownerSubType,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      requestId,
    },
    "Canonical reservation cutover is enabled but no reserve adapter is bound — fail closed."
  );
  if (!result?.ok) {
    return fail(
      result?.code || COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      result?.error || result?.message || "Canonical reserve failed.",
      { reserved: [], failed: result?.failed || [] }
    );
  }
  return {
    ok: true,
    code: COURT_RESOURCE_CODE.OK,
    reserved: result.reservations || result.reserved || [],
    reservationIds: result.reservationIds || [],
    created: result.reservations || result.created || [],
    updated: [],
    cancelled: [],
    selectedCourtIds: resolved.physicalCourtIds,
    physicalCourtIds: resolved.physicalCourtIds,
    granularity: "physical_court_x_capacity_window",
    replay: result.replay === true,
    capacityAuthority: "canonical_reservation",
  };
}

async function releaseCourtsCanonical(options) {
  const clubId = trimId(options.clubId);
  const tenantId = trimId(options.tenantId) || trimId(options.venueId);
  const owner = canonicalOwnerFrom(options);
  if (!clubId) return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required.");
  if (!tenantId) return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required.");
  if (!owner) return fail(COURT_RESOURCE_CODE.MISSING_OWNER, "owner.type and owner.id are required.");
  const requestId = trimId(options.requestId)
    || `release:${owner.ownerType}:${owner.ownerId}`;
  let physicalCourtIds = null;
  if (selectedPhysicalCourtIds(options).length || selectedCourtIds(options).length) {
    const physical = resolveCanonicalPhysicalIds(options);
    if (!physical.ok) return physical;
    physicalCourtIds = physical.physicalCourtIds;
  }
  const result = await invokeCanonicalAdapter(
    deps.canonicalRelease,
    {
      tenantId,
      clubId,
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      reservationIds: Array.isArray(options.reservationIds) ? options.reservationIds : null,
      physicalCourtIds,
      requestId,
      releaseReason: trimId(options.releaseReason) || "released",
    },
    "Canonical reservation cutover is enabled but no release adapter is bound — fail closed."
  );
  if (!result?.ok) {
    return fail(
      result?.code || COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      result?.error || result?.message || "Canonical release failed.",
      { cancelled: [], failed: result?.failed || [] }
    );
  }
  return {
    ok: true,
    code: COURT_RESOURCE_CODE.OK,
    cancelled: result.releasedReservationIds || result.cancelled || [],
    failed: [],
    capacityAuthority: "canonical_reservation",
    replay: result.replay === true,
  };
}

async function getCourtAvailabilityCanonical(options) {
  const clubId = trimId(options.clubId);
  const tenantId = trimId(options.tenantId) || trimId(options.venueId);
  if (!clubId) {
    return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required.", { courts: [] });
  }
  if (!tenantId) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required.", { courts: [] });
  }
  const window = windowToTimestamps(options);
  if (!window) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_WINDOW,
      "startsAt/endsAt or date+startTime+endTime are required.",
      { courts: [] }
    );
  }
  const resolved = resolveCanonicalPhysicalIds(options);
  if (!resolved.ok) return { ...resolved, courts: [] };
  const owner = canonicalOwnerFrom(options);
  const result = await invokeCanonicalAdapter(
    deps.canonicalGetAvailability,
    {
      tenantId,
      clubId,
      physicalCourtIds: resolved.physicalCourtIds,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      ownerType: owner?.ownerType || null,
      ownerId: owner?.ownerId || null,
    },
    "Canonical reservation cutover is enabled but no availability adapter is bound — fail closed."
  );
  if (!result?.ok) {
    return fail(
      result?.code || COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      result?.error || result?.message || "Canonical availability failed.",
      { courts: [] }
    );
  }
  const courts = (result.courts || []).map((row) => {
    const status = row.status || CANONICAL_AVAILABILITY_STATUS.UNKNOWN_COURT;
    const available =
      status === CANONICAL_AVAILABILITY_STATUS.AVAILABLE
      || status === CANONICAL_AVAILABILITY_STATUS.OWN_RESERVATION;
    return {
      ...row,
      id: row.physicalCourtId,
      physicalCourtId: row.physicalCourtId,
      available,
      ownership: { status: mapCanonicalAvailabilityStatus(status) },
      reasons: available ? [] : [status],
      conflicts: available ? [] : [{ code: status, message: status }],
    };
  });
  return {
    ok: true,
    code: COURT_RESOURCE_CODE.OK,
    courts,
    capacityAuthority: "canonical_reservation",
  };
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

export async function getCourtAvailability(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  if (canonicalCutoverEnabled(options)) {
    return getCourtAvailabilityCanonical(options);
  }
  const owner = normalizeOwnerInput(options.owner);
  return settle(
    deps.getCourtAvailability({
      ...options,
      ...(owner ? { context: { ...(options.context || {}), owner } } : {}),
    })
  );
}

/**
 * Inventory listing for a club operational scope.
 * Cluster is a filter only. Does not reserve courts.
 */
export function listEligibleCourts(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const clubId = trimId(options.clubId);
  const tenantId = trimId(options.tenantId) || trimId(options.venueId);
  const clusterId = trimId(options.clusterId);
  const requestedIds = selectedCourtIds(options);

  if (!clubId) {
    return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required — no first-club fallback.", {
      courts: [],
    });
  }
  if (trimId(options.courtLabel) && requestedIds.length === 0) {
    return fail(
      COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED,
      "courtLabel is display-only — eligibility identity is courtId.",
      { courts: [] }
    );
  }

  let courts;
  try {
    courts = deps.listCourts({
      clubId,
      tenantId,
      clusterId,
      includeInactive: false,
    });
  } catch (error) {
    return fail(COURT_RESOURCE_CODE.DATA_UNAVAILABLE, error?.message || "Failed to load court inventory.", {
      courts: [],
    });
  }

  const inventory = Array.isArray(courts) ? courts : [];
  if (requestedIds.length === 0) {
    return {
      ok: true,
      code: COURT_RESOURCE_CODE.OK,
      courts: inventory.map((court) => ({ ...court })),
    };
  }

  const matched = [];
  const failed = [];
  for (const courtId of requestedIds) {
    const membership = deps.assertCourtClusterMembership({
      clubId,
      tenantId,
      venueId: trimId(options.venueId),
      clusterId,
      courtId,
      courts: inventory,
      includeInactive: false,
    });
    if (!membership.ok) {
      failed.push({ courtId, code: membership.code, error: membership.error });
      continue;
    }
    matched.push(membership.court ? { ...membership.court } : { id: courtId });
  }
  if (failed.length) {
    return fail(failed[0].code, failed[0].error, { courts: [], failed });
  }
  return {
    ok: true,
    code: COURT_RESOURCE_CODE.OK,
    courts: matched,
  };
}

export async function reserveCourts(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  if (canonicalCutoverEnabled(options)) {
    return reserveCourtsCanonical(options);
  }
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
    const result = await settle(
      deps.syncTournamentCourtBookings(
        {
          id: owner.id,
          name: options.label || options.tournamentName || owner.id,
          courtSchedule: { ...window, courtIds },
        },
        clubId,
        courts
      )
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
    const result = await settle(
      owner.type === RESERVATION_OWNER_TYPE.MAINTENANCE
        ? deps.createMaintenanceBooking(payload, clubId)
        : deps.createBooking(payload, clubId)
    );
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

export async function releaseCourts(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  if (canonicalCutoverEnabled(options)) {
    return releaseCourtsCanonical(options);
  }
  const clubId = trimId(options.clubId);
  const owner = normalizeOwnerInput(options.owner);
  const ids = selectedCourtIds(options);
  const courtFilter = ids.length ? new Set(ids) : null;
  if (!clubId) return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required.");
  if (!owner) return fail(COURT_RESOURCE_CODE.MISSING_OWNER, "owner.type and owner.id are required.");

  if (owner.type === RESERVATION_OWNER_TYPE.TOURNAMENT) {
    const result = await settle(
      deps.cancelTournamentCourtBookings(
        clubId,
        owner.id,
        courtFilter ? [...courtFilter] : null
      )
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
    const result = await settle(deps.updateBookingStatus(booking.id, "cancelled", clubId));
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

export async function validateCourtAssignment(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  if (canonicalCutoverEnabled(options)) {
    const availability = await getCourtAvailabilityCanonical(options);
    if (!availability.ok) return { ...availability, valid: false };
    const row = availability.courts?.[0] || null;
    if (!row) {
      return fail(COURT_RESOURCE_CODE.COURT_NOT_FOUND, "Court not found in scoped inventory.", { valid: false });
    }
    if (!row.available) {
      const conflict = row.conflicts?.[0] || {};
      return fail(mapAvailabilityCode(conflict.code) === conflict.code
        ? (conflict.code || COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT)
        : mapAvailabilityCode(conflict.code), conflict.message || row.reasons?.[0], {
        valid: false,
        availability: row,
      });
    }
    const owner = normalizeOwnerInput(options.owner);
    if (
      options.requireOwnerReservation !== false
      && owner
      && row.ownership?.status !== OWNERSHIP_STATUS.OWN_RESERVATION
    ) {
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
      courtId: row.physicalCourtId,
      physicalCourtId: row.physicalCourtId,
      ownership: row.ownership,
      capacityAuthority: "canonical_reservation",
    };
  }
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
    availability = await settle(
      deps.getCourtAvailability({
        clubId,
        venueId: trimId(options.venueId),
        tenantId: trimId(options.tenantId) || trimId(options.venueId),
        clusterId: trimId(options.clusterId),
        courtId,
        ...window,
        context: { owner },
        includeUnavailable: true,
      })
    );
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

__bindCanonicalBookingGateway({
  reserveCourts,
  releaseCourts,
});

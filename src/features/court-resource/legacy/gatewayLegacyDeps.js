/**
 * Explicit Gateway OFF-path / legacy compatibility dependency surface.
 *
 * Canonical ON branches of CourtResourceGateway MUST NOT call these.
 * Importing this module marks a caller as EXPLICIT_LEGACY_RUNTIME.
 *
 * LEGACY_GATEWAY_SUBSTRATE_RETAINED=YES
 * CANONICAL_GATEWAY_LEGACY_SUBSTRATE_CALL_COUNT must stay 0 on ON path.
 */
import { loadBookingsForClub } from "../../../domain/clubStorage.js";
import { checkBookingConflict } from "../../../domain/courtBookingEngine.js";
import {
  createBooking,
  createMaintenanceBooking,
  saveBooking,
  updateBookingStatus,
} from "../../../domain/bookingService.js";
import { getCourtAvailability as getLegacyCourtAvailability } from "../../venue-court/services/courtAvailabilityService.js";
import { listCourts as listLegacyCourts } from "../../venue-court/services/courtInventoryService.js";
import { assertCourtClusterMembership } from "../../venue-court/services/courtClusterMembershipService.js";
import {
  getReservationOwner as lookupReservationOwner,
} from "../../venue-court/services/reservationOwnerService.js";
import { resolveLegacyCourtIdentity } from "../contracts/legacyCourtIdentityMapping.js";
import {
  listLegacyTournamentReservations,
  releaseLegacyTournamentReservations,
  syncLegacyTournamentReservations,
} from "../adapters/legacyReservationAdapter.js";
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";
import {
  COURT_OPERATIONS_SCOPE_CODE,
  requireCanonicalTenantId,
} from "../scope/courtOperationsScope.js";

export const LEGACY_GATEWAY_SUBSTRATE = Object.freeze({
  name: "court-resource/legacy/gatewayLegacyDeps",
  role: "EXPLICIT_LEGACY_RUNTIME",
  clubDataV3Authority: "LEGACY_COMPATIBILITY_ONLY",
  capacityAuthority: "LEGACY_COMPATIBILITY_ONLY",
});

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function fail(code, error, extra = {}) {
  return { ok: false, code, error, ...extra };
}

function mapTenantScopeFailure(result, extra = {}) {
  if (result.code === COURT_OPERATIONS_SCOPE_CODE.TENANT_VENUE_COLLAPSE_DENIED) {
    return fail(
      COURT_RESOURCE_CODE.TENANT_VENUE_COLLAPSE_DENIED,
      result.error || "venueId cannot substitute for tenantId.",
      extra
    );
  }
  if (result.code === COURT_OPERATIONS_SCOPE_CODE.MISSING_TENANT_ID) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_TENANT_ID,
      result.error || "tenantId is required.",
      extra
    );
  }
  return fail(
    result.code || COURT_RESOURCE_CODE.TENANT_MISMATCH,
    result.error || "tenantId is required.",
    extra
  );
}

/**
 * Legacy mapping resolver — OFF-path / migration only.
 * Canonical ON path must never invoke this.
 */
export function resolveLegacyPhysicalCourtForCompatibility(options = {}) {
  const mappings = Array.isArray(options.legacyMappings) ? options.legacyMappings : [];
  const tenantResult = requireCanonicalTenantId(options);
  if (!tenantResult.ok) return mapTenantScopeFailure(tenantResult);
  const key = {
    tenantId: tenantResult.tenantId,
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

export function createLegacyGatewaySubstrateDeps(overrides = {}) {
  return Object.freeze({
    getCourtAvailability: getLegacyCourtAvailability,
    listCourts: listLegacyCourts,
    loadBookingsForClub,
    checkBookingConflict,
    createBooking,
    createMaintenanceBooking,
    saveBooking,
    updateBookingStatus,
    assertCourtClusterMembership,
    getReservationOwner: lookupReservationOwner,
    resolveLegacyPhysicalCourt: resolveLegacyPhysicalCourtForCompatibility,
    listLegacyTournamentReservations,
    syncLegacyTournamentReservations,
    releaseLegacyTournamentReservations,
    ...overrides,
  });
}

export const defaultLegacyGatewaySubstrateDeps = createLegacyGatewaySubstrateDeps();

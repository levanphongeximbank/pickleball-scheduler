/**
 * Canonical venue boundary validator (thin adapter).
 *
 * Reuses VenueContractV2-facing Venue/Court venue scope projection.
 * Not a new SSOT contract. Never treats venueId as tenantId.
 */
import { projectVenueCourtVenueScope } from "../../venue-court/platform/venueCourtPlatformAdapter.js";
import {
  COURT_OPERATIONS_SCOPE_CODE,
  requireCanonicalTenantId,
} from "../scope/courtOperationsScope.js";

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function fail(code, error, extra = {}) {
  return { ok: false, code, error, ...extra };
}

/**
 * Require explicit tenantId + venueId as distinct fields; project venue framing.
 *
 * @param {object} input
 * @param {object} [adapters]
 */
export function assertCanonicalVenueBoundary(input = {}, adapters = {}) {
  const tenant = requireCanonicalTenantId(input);
  if (!tenant.ok) return tenant;

  const venueId = trimId(input.venueId);
  if (!venueId) {
    return fail(
      COURT_OPERATIONS_SCOPE_CODE.VENUE_SCOPE_REJECTED,
      "venueId is required for venue boundary validation — distinct from tenantId."
    );
  }

  if (typeof adapters.assertVenueBelongsToTenant === "function") {
    const framing = adapters.assertVenueBelongsToTenant({
      tenantId: tenant.tenantId,
      venueId,
    });
    if (framing && framing.ok === false) {
      return fail(
        framing.code || COURT_OPERATIONS_SCOPE_CODE.VENUE_SCOPE_REJECTED,
        framing.error || framing.message || "Foreign venue framing rejected.",
        framing
      );
    }
  }

  const project =
    typeof adapters.projectVenueCourtVenueScope === "function"
      ? adapters.projectVenueCourtVenueScope
      : projectVenueCourtVenueScope;

  const projected = project({
    venueId,
    tenantId: tenant.tenantId,
  });
  if (!projected?.ok) {
    return fail(
      COURT_OPERATIONS_SCOPE_CODE.VENUE_SCOPE_REJECTED,
      projected?.error?.message
        || projected?.error
        || "Venue scope projection rejected — fail closed.",
      { projection: projected }
    );
  }

  return {
    ok: true,
    code: COURT_OPERATIONS_SCOPE_CODE.OK,
    tenantId: tenant.tenantId,
    venueId,
    framing: projected.value,
  };
}

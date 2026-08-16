/**
 * Court Operations scope normalizer.
 *
 * tenantId and venueId are DISTINCT concepts. Never invent tenantId from
 * venueId (or the reverse). Club identity framing is separate from court
 * operational access (gateway / clubOperationalAccess).
 *
 * Does not invent default-club. Does not create a new identity SSOT.
 */
import {
  TENANT_ID_OWNER,
  VENUE_ID_OWNER,
  CLUB_ID_OWNER,
  CLUSTER_ID_OWNER,
  PHYSICAL_COURT_ID_OWNER,
  CLUB_OPERATIONAL_COURT_ACCESS_OWNER,
} from "../constants/courtOperationsOwnership.js";
import {
  projectCourtOperationsTenantScope,
  projectCourtOperationsVenueScope,
  projectCourtOperationsClubScope,
} from "../platform/courtResourcePlatformAdapter.js";

export {
  TENANT_ID_OWNER,
  VENUE_ID_OWNER,
  CLUB_ID_OWNER,
  CLUSTER_ID_OWNER,
  PHYSICAL_COURT_ID_OWNER,
  CLUB_OPERATIONAL_COURT_ACCESS_OWNER,
};

export const COURT_OPERATIONS_SCOPE_CODE = Object.freeze({
  OK: "OK",
  INVALID_SCOPE: "INVALID_SCOPE",
  MISSING_TENANT_ID: "MISSING_TENANT_ID",
  TENANT_VENUE_COLLAPSE_DENIED: "TENANT_VENUE_COLLAPSE_DENIED",
  MISSING_CLUB_ID: "MISSING_CLUB_ID",
  CLUB_SCOPE_REJECTED: "CLUB_SCOPE_REJECTED",
  VENUE_SCOPE_REJECTED: "VENUE_SCOPE_REJECTED",
});

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function fail(code, error, extra = {}) {
  return { ok: false, code, error, ...extra };
}

/**
 * Reject venue→tenant invent: venueId alone where tenantId is required.
 * Same opaque string for both fields is allowed when BOTH are explicit.
 *
 * @param {object} input
 */
export function assertNoTenantVenueFallback(input = {}) {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      COURT_OPERATIONS_SCOPE_CODE.INVALID_SCOPE,
      "Court Operations scope input must be a plain object."
    );
  }
  const tenantId = trimId(input.tenantId);
  const venueId = trimId(input.venueId);
  if (!tenantId && venueId) {
    return fail(
      COURT_OPERATIONS_SCOPE_CODE.TENANT_VENUE_COLLAPSE_DENIED,
      "venueId cannot substitute for tenantId — TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION=NO."
    );
  }
  return { ok: true, code: COURT_OPERATIONS_SCOPE_CODE.OK };
}

/**
 * Require an explicit canonical tenantId. Never invent from venueId.
 *
 * @param {object} input
 */
export function requireCanonicalTenantId(input = {}) {
  const collapse = assertNoTenantVenueFallback(input);
  if (!collapse.ok) return collapse;
  const tenantId = trimId(input.tenantId);
  if (!tenantId) {
    return fail(
      COURT_OPERATIONS_SCOPE_CODE.MISSING_TENANT_ID,
      "tenantId is required for canonical Court Operations — fail closed."
    );
  }
  return { ok: true, code: COURT_OPERATIONS_SCOPE_CODE.OK, tenantId };
}

/**
 * Normalize Court Operations scope. tenantId required; venueId/clubId/actorId/
 * clusterId optional and never collapsed into each other.
 *
 * @param {object} input
 * @returns {{ ok: true, scope: object } | { ok: false, code: string, error: string }}
 */
export function normalizeCourtOperationsScope(input = {}) {
  const tenant = requireCanonicalTenantId(input);
  if (!tenant.ok) return tenant;

  /** @type {{ tenantId: string, venueId?: string, clubId?: string, actorId?: string, clusterId?: string }} */
  const scope = { tenantId: tenant.tenantId };

  const venueId = trimId(input.venueId);
  if (venueId) scope.venueId = venueId;

  const clubId = trimId(input.clubId);
  if (clubId) scope.clubId = clubId;

  const actorId = trimId(input.actorId) || trimId(input.userId);
  if (actorId) scope.actorId = actorId;

  const clusterId = trimId(input.clusterId);
  if (clusterId) scope.clusterId = clusterId;

  return { ok: true, code: COURT_OPERATIONS_SCOPE_CODE.OK, scope: Object.freeze(scope) };
}

/**
 * Require tenantId + clubId. Uses platform club scope projection for framing.
 * Optional injectable boundary asserts foreign club/tenant framing.
 * Court operational access remains a separate gateway concern.
 *
 * @param {object} input
 * @param {object} [boundary]
 */
export function requireCanonicalClubScope(input = {}, boundary = {}) {
  const normalized = normalizeCourtOperationsScope(input);
  if (!normalized.ok) return normalized;

  const clubId = trimId(normalized.scope.clubId);
  if (!clubId) {
    return fail(
      COURT_OPERATIONS_SCOPE_CODE.MISSING_CLUB_ID,
      "clubId is required — no default-club fallback."
    );
  }

  const projectClub =
    typeof boundary.projectClubScope === "function"
      ? boundary.projectClubScope
      : projectCourtOperationsClubScope;

  const clubProjected = projectClub({
    clubId,
    tenantId: normalized.scope.tenantId,
  });
  if (!clubProjected?.ok) {
    return fail(
      COURT_OPERATIONS_SCOPE_CODE.CLUB_SCOPE_REJECTED,
      clubProjected?.error?.message
        || clubProjected?.error
        || "Club scope projection rejected — fail closed.",
      { projection: clubProjected }
    );
  }

  if (typeof boundary.assertClubBelongsToTenant === "function") {
    const framing = boundary.assertClubBelongsToTenant({
      tenantId: normalized.scope.tenantId,
      clubId,
      venueId: normalized.scope.venueId,
    });
    if (framing && framing.ok === false) {
      return fail(
        framing.code || COURT_OPERATIONS_SCOPE_CODE.CLUB_SCOPE_REJECTED,
        framing.error || framing.message || "Foreign club framing rejected.",
        framing
      );
    }
  }

  if (normalized.scope.venueId && typeof boundary.assertVenueBelongsToTenant === "function") {
    const venueFraming = boundary.assertVenueBelongsToTenant({
      tenantId: normalized.scope.tenantId,
      venueId: normalized.scope.venueId,
    });
    if (venueFraming && venueFraming.ok === false) {
      return fail(
        venueFraming.code || COURT_OPERATIONS_SCOPE_CODE.VENUE_SCOPE_REJECTED,
        venueFraming.error || venueFraming.message || "Foreign venue framing rejected.",
        venueFraming
      );
    }
  } else if (normalized.scope.venueId) {
    const venueProjected = projectCourtOperationsVenueScope({
      venueId: normalized.scope.venueId,
      tenantId: normalized.scope.tenantId,
    });
    if (!venueProjected?.ok) {
      return fail(
        COURT_OPERATIONS_SCOPE_CODE.VENUE_SCOPE_REJECTED,
        venueProjected?.error?.message
          || venueProjected?.error
          || "Venue scope projection rejected — fail closed.",
        { projection: venueProjected }
      );
    }
  }

  // Touch tenant projection for framing consistency (no invent).
  const tenantProjected = projectCourtOperationsTenantScope({
    tenantId: normalized.scope.tenantId,
  });
  if (!tenantProjected?.ok) {
    return fail(
      COURT_OPERATIONS_SCOPE_CODE.MISSING_TENANT_ID,
      tenantProjected?.error?.message
        || tenantProjected?.error
        || "Tenant scope projection rejected — fail closed.",
      { projection: tenantProjected }
    );
  }

  return {
    ok: true,
    code: COURT_OPERATIONS_SCOPE_CODE.OK,
    scope: Object.freeze({
      ...normalized.scope,
      clubId,
    }),
    tenantId: normalized.scope.tenantId,
    clubId,
  };
}

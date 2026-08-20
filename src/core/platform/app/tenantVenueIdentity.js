/**
 * Wave 3 — Tenant ≠ Venue identity helpers (Platform Core).
 * Never invent tenantId from venueId or the reverse at call sites.
 * Organization remains NOT_CONFIGURED.
 */

export function trimScopeId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

/**
 * @param {{ tenantId?: unknown, venueId?: unknown }} input
 * @returns {{ ok: true, tenantId: string|null, venueId: string|null } | { ok: false, code: string, error: string }}
 */
export function readDistinctTenantVenueIds(input = {}) {
  const tenantId = trimScopeId(input?.tenantId);
  const venueId = trimScopeId(input?.venueId);
  return { ok: true, tenantId, venueId };
}

/**
 * Reject collapsed invent patterns at Platform Core boundaries.
 * @param {{ tenantId?: unknown, venueId?: unknown, allowEqualLegacyIds?: boolean }} input
 */
export function assertDistinctTenantVenueFields(input = {}) {
  const { tenantId, venueId } = readDistinctTenantVenueIds(input);
  if (
    Object.prototype.hasOwnProperty.call(input, "tenantId") === false &&
    Object.prototype.hasOwnProperty.call(input, "venueId") === false
  ) {
    return {
      ok: false,
      code: "TENANT_VENUE_FIELDS_REQUIRED",
      error: "tenantId and/or venueId must be supplied as distinct fields.",
    };
  }
  if (input?.tenantId != null && tenantId == null) {
    return { ok: false, code: "TENANT_ID_INVALID", error: "tenantId is invalid." };
  }
  if (input?.venueId != null && venueId == null) {
    return { ok: false, code: "VENUE_ID_INVALID", error: "venueId is invalid." };
  }
  return { ok: true, tenantId, venueId };
}

/**
 * True when venue belongs to selected tenant under Wave 3 rules.
 * Equal ids alone are NOT proof of belonging — require venue.tenantId.
 */
export function venueBelongsToTenant(venue, selectedTenantId) {
  const tenantId = trimScopeId(selectedTenantId);
  if (!tenantId || !venue || typeof venue !== "object") {
    return false;
  }
  const venueTenantId = trimScopeId(venue.tenantId ?? venue.tenant_id);
  const venueId = trimScopeId(venue.id ?? venue.venueId ?? venue.venue_id);
  if (!venueTenantId || !venueId) {
    return false;
  }
  return venueTenantId === tenantId;
}

/**
 * Filter venues to the selected tenant.
 */
export function filterVenuesForSelectedTenant(venues, selectedTenantId) {
  const list = Array.isArray(venues) ? venues : [];
  const tenantId = trimScopeId(selectedTenantId);
  if (!tenantId) return [];
  return list.filter((venue) => venueBelongsToTenant(venue, tenantId));
}

/**
 * Cluster must belong to selected venue (and optionally tenant).
 */
export function clusterBelongsToVenue(cluster, selectedVenueId, selectedTenantId = null) {
  const venueId = trimScopeId(selectedVenueId);
  if (!venueId || !cluster || typeof cluster !== "object") {
    return false;
  }
  const clusterVenueId = trimScopeId(cluster.venueId ?? cluster.venue_id);
  if (!clusterVenueId || clusterVenueId !== venueId) {
    return false;
  }
  const tenantId = trimScopeId(selectedTenantId);
  if (!tenantId) {
    return true;
  }
  const clusterTenantId = trimScopeId(cluster.tenantId ?? cluster.tenant_id);
  // Legacy clusters may lack tenantId — venue match is enough until Phase B backfill.
  if (!clusterTenantId) {
    return true;
  }
  return clusterTenantId === tenantId;
}

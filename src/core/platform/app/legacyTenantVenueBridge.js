/**
 * Wave 3 — single transitional bridge for pre-Phase-B rows where durable
 * Tenant≠Venue columns are not yet applied.
 *
 * ONLY this module may derive a provisional tenantId from a legacy venue id
 * for bootstrap/hydration. Call sites must not invent tenant↔venue.
 */

import { trimScopeId } from "./tenantVenueIdentity.js";

export const LEGACY_TENANT_VENUE_BRIDGE = "WAVE3_LEGACY_1_1_BRIDGE";

/**
 * When a venue row has no tenantId (pre-migration), stamp tenantId = venue.id
 * so local runtime can expose distinct fields while data remains 1:1.
 * Does NOT mean Tenant === Venue architecturally.
 */
export function stampLegacyVenueTenantId(venue) {
  if (!venue || typeof venue !== "object") {
    return null;
  }
  const id = trimScopeId(venue.id ?? venue.venueId ?? venue.venue_id);
  if (!id) {
    return null;
  }
  const existingTenantId = trimScopeId(venue.tenantId ?? venue.tenant_id);
  return {
    ...venue,
    id,
    tenantId: existingTenantId || id,
    _legacyTenantVenueBridge: existingTenantId ? undefined : LEGACY_TENANT_VENUE_BRIDGE,
  };
}

/**
 * Profile mapping before profiles.tenant_id exists: provisional tenant assignment
 * equals home venue id. Explicit bridge — not normalizeUser cross-fill.
 */
export function resolveLegacyProfileTenantId({ tenantId = null, venueId = null } = {}) {
  const explicitTenant = trimScopeId(tenantId);
  if (explicitTenant) {
    return { tenantId: explicitTenant, bridged: false };
  }
  const venue = trimScopeId(venueId);
  if (!venue) {
    return { tenantId: null, bridged: false };
  }
  return { tenantId: venue, bridged: true, bridge: LEGACY_TENANT_VENUE_BRIDGE };
}

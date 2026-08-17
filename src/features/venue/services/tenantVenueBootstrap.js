/**
 * Wave 3 — bootstrap local tenant registry from venue rows (transitional 1:1).
 * After Phase B SQL, cloud hydrate supplies real tenant≠venue cardinality.
 */

import { loadVenues, saveVenues } from "../../../data/venue.js";
import { loadTenants, saveTenants, upsertTenantRecord } from "../../../data/tenantRegistry.js";
import { normalizeVenue } from "../../../models/venue.js";
import { createTenantRecord, normalizeTenant } from "../../../models/tenant.js";
import { stampLegacyVenueTenantId } from "../../../core/platform/app/legacyTenantVenueBridge.js";

export function resetTenantVenueBootstrapFlagForTests() {
  // retained for tests; bootstrap is now idempotent each call
}

/**
 * Ensure every venue has tenantId and a corresponding tenant registry row.
 * Legacy unstamped venues: tenantId = venue.id (bridge only).
 */
export function ensureTenantVenueLocalBootstrap() {
  const rawVenues = loadVenues();
  const stamped = rawVenues.map((row) => normalizeVenue(stampLegacyVenueTenantId(row) || row));
  const changed = stamped.some((row, index) => {
    const prev = rawVenues[index];
    return !prev || row.tenantId !== prev.tenantId || row.id !== prev.id;
  });

  if (changed || stamped.length !== rawVenues.length) {
    saveVenues(stamped);
  }

  const tenantsById = new Map(loadTenants().map((row) => [row.id, row]));
  let tenantChanged = false;
  for (const venue of stamped) {
    if (!venue.tenantId) continue;
    if (!tenantsById.has(venue.tenantId)) {
      const tenant = normalizeTenant(
        createTenantRecord(venue.name || venue.tenantId, {
          id: venue.tenantId,
          timezone: venue.timezone,
          status: venue.status,
          note: venue.note,
        })
      );
      tenantsById.set(tenant.id, tenant);
      tenantChanged = true;
    }
  }
  if (tenantChanged) {
    saveTenants([...tenantsById.values()]);
  }

  return { ok: true, venueCount: stamped.length, tenantCount: tenantsById.size };
}

export function ensureTenantExistsForVenue(venue) {
  const normalized = normalizeVenue(stampLegacyVenueTenantId(venue) || venue);
  if (!normalized?.tenantId) {
    return { ok: false, error: "venue.tenantId required" };
  }
  return upsertTenantRecord(
    createTenantRecord(normalized.name || normalized.tenantId, {
      id: normalized.tenantId,
      timezone: normalized.timezone,
      status: normalized.status,
    })
  );
}

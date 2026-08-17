import { PERMISSIONS } from "../../../auth/permissions.js";
import { guardPermission } from "../../../auth/guardAction.js";
import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { isGlobalRole } from "../../../auth/roles.js";
import { loadVenues, saveVenues } from "../../../data/venue.js";
import { loadTenants, saveTenants, upsertTenantRecord } from "../../../data/tenantRegistry.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import {
  createTenantRecord,
  normalizeTenant,
  isTenantOperational,
  DEFAULT_TENANT_ID,
} from "../../../models/tenant.js";
import { createVenueRecord } from "../../../models/venue.js";
import {
  getExplicitTenantIdForClub,
  listClubsForTenant,
  resolveTenantIdForClub,
} from "../guards/tenantGuard.js";
import {
  ensureDefaultTenantMigration,
  ensureMultiTenantSeed,
  SEED_TENANTS,
} from "../seed/multiTenantSeed.js";
import { ensureClubManagementSeed } from "../../club/seed/clubManagementSeed.js";
import { isDemoSeedDisabled } from "../../../demo/seed/demoSeedRegistry.js";
import { purgeDemoSeedData } from "../../../demo/seed/purgeDemoSeed.js";
import { ensureTenantVenueLocalBootstrap } from "../../venue/services/tenantVenueBootstrap.js";
import { listVenuesForTenant } from "../../venue/services/venueSelectionService.js";

export { DEFAULT_TENANT_ID, SEED_TENANTS, listVenuesForTenant };

export function ensureTenantBootstrap() {
  ensureDefaultTenantMigration();
  ensureTenantVenueLocalBootstrap();

  if (import.meta.env?.PROD) {
    return purgeDemoSeedData();
  }

  if (isDemoSeedDisabled()) {
    return { ok: true, skipped: true };
  }

  ensureMultiTenantSeed();
  ensureClubManagementSeed();
  ensureTenantVenueLocalBootstrap();
  return { ok: true };
}

export function listTenants() {
  ensureTenantVenueLocalBootstrap();
  const registry = loadTenants();
  if (registry.length) {
    return registry.map(normalizeTenant);
  }
  // Transitional fallback: derive tenants from stamped venues (bridge).
  const derived = new Map();
  for (const venue of loadVenues()) {
    const tenantId = String(venue.tenantId || "").trim();
    if (!tenantId || derived.has(tenantId)) continue;
    derived.set(
      tenantId,
      normalizeTenant(
        createTenantRecord(venue.name || tenantId, {
          id: tenantId,
          timezone: venue.timezone,
          status: venue.status,
        })
      )
    );
  }
  return [...derived.values()];
}

export function getTenantById(tenantId) {
  const id = String(tenantId || "").trim();
  if (!id) {
    return null;
  }

  ensureTenantVenueLocalBootstrap();
  const fromRegistry = loadTenants().find((item) => item.id === id);
  if (fromRegistry) {
    return normalizeTenant(fromRegistry);
  }

  const venue = loadVenues().find((item) => item.tenantId === id || item.id === id);
  return venue
    ? normalizeTenant(
        createTenantRecord(venue.name || id, {
          id,
          timezone: venue.timezone,
          status: venue.status,
        })
      )
    : null;
}

export function getTenantStats(tenantId) {
  const clubs = listClubsForTenant(tenantId);
  let players = 0;
  let courts = 0;
  let tournaments = 0;

  for (const club of clubs) {
    const data = loadClubData(club.id);
    players += data.players?.length || 0;
    courts += data.courts?.length || 0;
    tournaments += data.tournaments?.length || 0;
  }

  return { players, courts, tournaments, clubs: clubs.length };
}

export function listTenantsWithStats() {
  return listTenants().map((tenant) => ({
    ...tenant,
    stats: getTenantStats(tenant.id),
  }));
}

function guardTenantAdmin() {
  if (!isRbacEnabled()) {
    return { ok: true };
  }

  const user = getCurrentUser();
  if (isGlobalRole(user?.role)) {
    return { ok: true };
  }

  return guardPermission(PERMISSIONS.VENUE_UPDATE);
}

export function createTenant(name, options = {}) {
  const adminCheck = guardTenantAdmin();
  if (!adminCheck.ok) {
    return adminCheck;
  }

  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Tên tenant không được để trống." };
  }

  const tenant = createTenantRecord(trimmed, options);
  upsertTenantRecord(tenant);

  // Wave 3: creating a tenant also creates its first venue under that tenant (1:N ready).
  // Venue id is distinct from tenant id unless caller forces legacy coupling.
  const forceLegacyCoupledId = options.legacyCoupledVenueId === true;
  const venueId = forceLegacyCoupledId
    ? tenant.id
    : options.defaultVenueId || `venue-${tenant.id}`;
  const venues = loadVenues();
  if (!venues.some((row) => row.id === venueId)) {
    const venue = createVenueRecord(trimmed, {
      id: venueId,
      tenantId: tenant.id,
      timezone: tenant.timezone,
      status: tenant.status,
      ownerId: tenant.ownerUserId,
      note: tenant.note,
    });
    saveVenues([...venues, venue]);
  }

  return { ok: true, tenant };
}

export function updateTenant(tenantId, patch = {}) {
  const adminCheck = guardTenantAdmin();
  if (!adminCheck.ok) {
    return adminCheck;
  }

  const tenants = loadTenants();
  const index = tenants.findIndex((item) => item.id === tenantId);

  if (index < 0) {
    // Transitional: allow update via ensure + upsert when only venues existed.
    const existing = getTenantById(tenantId);
    if (!existing) {
      return { ok: false, error: "Không tìm thấy tenant." };
    }
    const tenant = normalizeTenant({
      ...existing,
      ...patch,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    });
    upsertTenantRecord(tenant);
    return { ok: true, tenant };
  }

  const next = tenants.map((item, idx) =>
    idx === index
      ? normalizeTenant({
          ...item,
          ...patch,
          id: item.id,
          updatedAt: new Date().toISOString(),
        })
      : item
  );

  saveTenants(next);
  return { ok: true, tenant: next[index] };
}

export function setTenantStatus(tenantId, status) {
  return updateTenant(tenantId, { status });
}

export function renameTenant(tenantId, name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Tên tenant không được để trống." };
  }

  return updateTenant(tenantId, { name: trimmed });
}

export function getPrimaryClubIdForTenant(tenantId) {
  const clubs = listClubsForTenant(tenantId);
  // Phase 2F: no silent first-club when multiple clubs exist under a tenant.
  if (clubs.length === 1) {
    return clubs[0]?.id || null;
  }
  return null;
}

export function resolveEffectiveTenantId(user, overrideTenantId = null) {
  if (overrideTenantId) {
    return overrideTenantId;
  }

  if (user?.tenantId) {
    return user.tenantId;
  }

  const clubId = user?.clubId || user?.club_id;
  if (clubId) {
    return getExplicitTenantIdForClub(clubId);
  }

  return null;
}

export function canUserAccessTenant(user, tenantId) {
  if (!user || !tenantId) {
    return false;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  if (user.tenantId) {
    return user.tenantId === tenantId;
  }

  return false;
}

export function isCurrentTenantUsable(tenant) {
  return Boolean(tenant && isTenantOperational(tenant));
}

export function getTenantDisplayName(tenantId) {
  return getTenantById(tenantId)?.name || "Chưa chọn tenant";
}

export function getTenantIdForClub(clubId) {
  return resolveTenantIdForClub(clubId);
}

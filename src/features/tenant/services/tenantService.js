import { PERMISSIONS } from "../../../auth/permissions.js";
import { guardPermission } from "../../../auth/guardAction.js";
import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { isGlobalRole } from "../../../auth/roles.js";
import { loadVenues, saveVenues } from "../../../data/venue.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import {
  createTenantRecord,
  normalizeTenant,
  isTenantOperational,
  DEFAULT_TENANT_ID,
} from "../../../models/tenant.js";
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

export { DEFAULT_TENANT_ID, SEED_TENANTS };

export function ensureTenantBootstrap() {
  ensureDefaultTenantMigration();

  if (import.meta.env?.PROD) {
    return purgeDemoSeedData();
  }

  if (isDemoSeedDisabled()) {
    return { ok: true, skipped: true };
  }

  ensureMultiTenantSeed();
  ensureClubManagementSeed();
  return { ok: true };
}

export function listTenants() {
  return loadVenues().map(normalizeTenant);
}

export function getTenantById(tenantId) {
  const id = String(tenantId || "").trim();
  if (!id) {
    return null;
  }

  const venue = loadVenues().find((item) => item.id === id);
  return venue ? normalizeTenant(venue) : null;
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
  const venues = loadVenues();
  saveVenues([...venues, tenant]);

  return { ok: true, tenant };
}

export function updateTenant(tenantId, patch = {}) {
  const adminCheck = guardTenantAdmin();
  if (!adminCheck.ok) {
    return adminCheck;
  }

  const venues = loadVenues();
  const index = venues.findIndex((item) => item.id === tenantId);

  if (index < 0) {
    return { ok: false, error: "Không tìm thấy tenant." };
  }

  const next = venues.map((item, idx) =>
    idx === index
      ? normalizeTenant({
          ...item,
          ...patch,
          id: item.id,
          updatedAt: new Date().toISOString(),
        })
      : item
  );

  saveVenues(next);
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

  if (user?.venueId) {
    return user.venueId;
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

  const userTenantId = user.tenantId || user.venueId;
  return userTenantId === tenantId;
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

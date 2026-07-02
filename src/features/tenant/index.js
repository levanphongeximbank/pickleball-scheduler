export {
  DEFAULT_TENANT_ID,
  SEED_TENANTS,
  ensureTenantBootstrap,
  listTenants,
  listTenantsWithStats,
  getTenantById,
  getTenantStats,
  createTenant,
  updateTenant,
  setTenantStatus,
  renameTenant,
  getPrimaryClubIdForTenant,
  resolveEffectiveTenantId,
  canUserAccessTenant,
  isCurrentTenantUsable,
  getTenantDisplayName,
  getTenantIdForClub,
} from "./services/tenantService.js";

export {
  canTrustProfileVenue,
  buildProfileBackedTenant,
  resolveTenantRecord,
  hydrateProfileVenueToLocalRegistry,
  resolveRouteAccessScope,
} from "./services/profileVenueService.js";

export {
  resolveTenantIdFromUser,
  getExplicitTenantIdForClub,
  resolveTenantIdForClub,
  assertSameTenant,
  guardTenantAccess,
  guardClubTenant,
  guardRecordTenant,
  filterByTenant,
  listClubsForTenant,
  assertTenantOperational,
  stampWithTenantId,
} from "./guards/tenantGuard.js";

export {
  ensureDefaultTenantMigration,
  ensureMultiTenantSeed,
  isMultiTenantSeedApplied,
} from "./seed/multiTenantSeed.js";

export {
  TENANT_STATUS,
  TENANT_PLANS,
  normalizeTenant,
  createTenantRecord,
  isTenantOperational,
  tenantIdFromRecord,
} from "../../models/tenant.js";

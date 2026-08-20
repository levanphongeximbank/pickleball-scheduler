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
  createTenantDurable,
  updateTenantDurable,
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
  hydrateSupabaseVenuesToLocalRegistry,
  resolveRouteAccessScope,
} from "./services/profileVenueService.js";

export {
  canSwitchTenant,
  canRenderTenantSwitcher,
  canOperateUnassignedTenant,
  buildTenantCatalog,
  findCatalogTenant,
  resolvePickerCurrentTenantId,
  resolveTenantSwitcherView,
  resolveClubDetailTenantGate,
  reconcileSessionWithCatalog,
  reauthorizePersistedTenantSelection,
  CLUB_DETAIL_MISSING_TENANT_WARNING,
} from "./services/tenantSelectionModel.js";

export {
  commitTenantSwitch,
  createTenantSelectionRuntime,
  readSelectableTenantCatalog,
  invalidateOperationalContextForTenantSwitch,
} from "./services/tenantSelectionService.js";

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
  decideTenantAccess,
  evaluateTenantContext,
  collectActiveTenantEntitlements,
} from "./services/tenantAccessDecision.js";

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

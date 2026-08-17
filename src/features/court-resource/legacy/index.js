/**
 * Court Operations legacy / compatibility / migration surface.
 * Explicit boundary — not canonical authority.
 */
export {
  LEGACY_GATEWAY_SUBSTRATE,
  createLegacyGatewaySubstrateDeps,
  defaultLegacyGatewaySubstrateDeps,
  resolveLegacyPhysicalCourtForCompatibility,
} from "./gatewayLegacyDeps.js";

export {
  createLegacyCourtIdentityMapping,
  normalizeLegacyCourtIdentityMapping,
  resolveLegacyCourtIdentity,
  LEGACY_COURT_MAPPING_KEY_FIELDS,
} from "../contracts/legacyCourtIdentityMapping.js";

export {
  buildTournamentReservationRows,
  listLegacyTournamentReservations,
  releaseLegacyTournamentReservations,
  syncLegacyTournamentReservations,
  buildTournamentReservationId,
  isTournamentReservation,
  isActiveTournamentReservation,
} from "../adapters/legacyReservationAdapter.js";

export {
  projectCanonicalCourtToLegacy,
  projectLegacyCourtCompatibility,
} from "../services/legacyCourtCompatibilityProjection.js";

export {
  planLegacyBookingMigrationDryRun,
} from "../services/legacyBookingMigrationDryRun.js";

export {
  planLegacyLiveStateMigrationDryRun,
  planLegacyMaintenanceMigrationDryRun,
} from "./legacyMigrationDryRun.js";

export {
  LEGACY_COMPATIBILITY_BOUNDARY_EXPLICIT,
  LEGACY_BOUNDARY_LOCATION,
  CANONICAL_PATH_MUST_NOT_IMPORT,
  CANONICAL_GATEWAY_MUST_NOT_CALL_ON_ON_PATH,
  TENANT_VENUE_COLLAPSE_PATTERNS,
  COURT_CLUSTERS_TENANT_SEMANTICS_EXPLICIT,
  COURT_CLUSTERS_VENUE_SEMANTICS_EXPLICIT,
  COURT_CLUSTERS_VENUE_ID_ORG_PARENT_DEBT_ON_CANONICAL_PATH,
  CURRENTMATCHID_CANONICAL_AUTHORITY,
  LEGACY_COURT_STATUS_AUTHORITY_ON_CANONICAL_PATH,
  LEGACY_COURT_ENGINE_OCCUPANCY_AUTHORITY_ON_CANONICAL_PATH,
  D4_VENUE_AS_TENANT_ON_CANONICAL_PATH,
  STALE_EPHEMERAL_STATE_AUTO_MIGRATED,
} from "./legacyIsolationLocks.js";

/**
 * Batch 8 architecture locks for legacy isolation.
 * Canonical modules outside legacy/ must not import these surfaces.
 */
export const LEGACY_COMPATIBILITY_BOUNDARY_EXPLICIT = "YES";
export const LEGACY_BOUNDARY_LOCATION = "src/features/court-resource/legacy/";

export const CANONICAL_PATH_MUST_NOT_IMPORT = Object.freeze([
  "domain/clubStorage",
  "clubStorage",
  "loadCourtsForClub",
  "loadBookingsForClub",
  "loadCourtsFromLegacy",
  "legacyCourtIdentityMapping",
  "club_data_v3",
  "pickleball-club-data-v3",
]);

export const CANONICAL_GATEWAY_MUST_NOT_CALL_ON_ON_PATH = Object.freeze([
  "loadBookingsForClub",
  "createMaintenanceBooking",
  "resolveLegacyPhysicalCourt",
  "resolveLegacyCourtIdentity",
  "syncLegacyTournamentReservations",
  "listLegacyTournamentReservations",
  "court_resource_daily_play_acquire",
]);

export const TENANT_VENUE_COLLAPSE_PATTERNS = Object.freeze([
  "tenantId || venueId",
  "venueId || tenantId",
  "tenant_id || venue_id",
  "venue_id || tenant_id",
]);

export const COURT_CLUSTERS_TENANT_SEMANTICS_EXPLICIT = "YES";
export const COURT_CLUSTERS_VENUE_SEMANTICS_EXPLICIT = "YES";
export const COURT_CLUSTERS_VENUE_ID_ORG_PARENT_DEBT_ON_CANONICAL_PATH = "NO";
export const CURRENTMATCHID_CANONICAL_AUTHORITY = "NO";
export const LEGACY_COURT_STATUS_AUTHORITY_ON_CANONICAL_PATH = "NO";
export const LEGACY_COURT_ENGINE_OCCUPANCY_AUTHORITY_ON_CANONICAL_PATH = "NO";
export const D4_VENUE_AS_TENANT_ON_CANONICAL_PATH = "NO";
export const STALE_EPHEMERAL_STATE_AUTO_MIGRATED = "NO";

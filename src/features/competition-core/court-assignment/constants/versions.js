/**
 * CORE-12 Court Assignment — version and identity constants.
 * Capability-local; no CORE-10 runtime dependency.
 */

export const CORE12_ENGINE_ID = "CORE12_COURT_ASSIGNMENT";

export const CORE12_ENGINE_VERSION = "1.0.0-phase1c";

/** Contract schema bound into requests / results. */
export const CORE12_COURT_ASSIGNMENT_SCHEMA_V1 =
  "CORE12_COURT_ASSIGNMENT_SCHEMA_V1";

/** Stable ordinal comparator version (UTF-16 code-unit ordering). */
export const CORE12_COMPARATOR_VERSION = "CORE12_COMPARATOR_V1";

/** Greedy first-eligible court selection strategy. */
export const CORE12_COURT_SELECTION_STRATEGY_VERSION =
  "CORE12_GREEDY_FIRST_ELIGIBLE_V1";

/** Fingerprint algorithm version (FNV-1a 32-bit over canonical JSON). */
export const CORE12_FINGERPRINT_VERSION = "CORE12_FINGERPRINT_V1";

/** Canonical serialization algorithm id. */
export const CORE12_CANONICAL_SERIALIZATION_VERSION =
  "CORE12_CANONICAL_JSON_V1";

/** Supported policy version pin for Phase 1B. */
export const CORE12_POLICY_VERSION = "CORE12_POLICY_V1";

/** TE anti-corruption adapter contract version (Phase 1C). */
export const CORE12_TE_ADAPTER_CONTRACT_V1 = "CORE12_TE_ADAPTER_CONTRACT_V1";

/** Shadow-parity report version (Phase 1C). */
export const CORE12_SHADOW_PARITY_V1 = "CORE12_SHADOW_PARITY_V1";

/** Parity classification precedence version (Phase 1C-R). */
export const CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1 =
  "CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1";

/** Legacy TE source-anchor contract version (Phase 1C-R Model B). */
export const CORE12_LEGACY_SOURCE_ANCHOR_V1 = "CORE12_LEGACY_SOURCE_ANCHOR_V1";

/** Divergence catalog version (Phase 1C-R). */
export const CORE12_DIVERGENCE_CATALOG_V1 = "CORE12_DIVERGENCE_CATALOG_V1";

/** Phase 1D-B1 — injected eligibility provider contract. */
export const CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1 =
  "CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1";

/** Phase 1D-B1 — eligibility snapshot schema. */
export const CORE12_ELIGIBILITY_SNAPSHOT_V1 = "CORE12_ELIGIBILITY_SNAPSHOT_V1";

/** Phase 1D-B1 — exact query-window + eligibility query schema. */
export const CORE12_AVAILABILITY_QUERY_V1 = "CORE12_AVAILABILITY_QUERY_V1";

/** Phase 1D-B1 — canonical court descriptor authority schema. */
export const CORE12_CANONICAL_COURT_DESCRIPTOR_V1 =
  "CORE12_CANONICAL_COURT_DESCRIPTOR_V1";

/** Phase 1D-B1 — pure eligibility→AvailableCourtInput projection. */
export const CORE12_AVAILABILITY_PROJECTION_V1 =
  "CORE12_AVAILABILITY_PROJECTION_V1";

/**
 * Phase 1D-B2 Option A — injected Venue CAA + descriptor bridge contract.
 * Capability-local pin; does not import Venue modules.
 */
export const CORE12_VENUE_AVAILABILITY_BRIDGE_V1 =
  "CORE12_VENUE_AVAILABILITY_BRIDGE_V1";

/**
 * Expected Venue Phase 3B public descriptorAuthority literal.
 * Copied as a CORE-12 pin — not imported from Venue source.
 */
export const CORE12_EXPECTED_VENUE_DESCRIPTOR_AUTHORITY =
  "venue-court.inventory.club_data_v3";

/**
 * Expected Venue Phase 3B public sourceContractVersion literal.
 * Copied as a CORE-12 pin — not imported from Venue source.
 */
export const CORE12_EXPECTED_VENUE_SOURCE_CONTRACT_VERSION =
  "VENUE_COURT_CANONICAL_COURT_DESCRIPTOR_V1";

export const CORE12_IDENTITY = Object.freeze({
  id: CORE12_ENGINE_ID,
  version: CORE12_ENGINE_VERSION,
  schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  comparatorVersion: CORE12_COMPARATOR_VERSION,
  courtSelectionStrategyVersion: CORE12_COURT_SELECTION_STRATEGY_VERSION,
  fingerprintVersion: CORE12_FINGERPRINT_VERSION,
  canonicalSerializationVersion: CORE12_CANONICAL_SERIALIZATION_VERSION,
  policyVersion: CORE12_POLICY_VERSION,
  teAdapterContractVersion: CORE12_TE_ADAPTER_CONTRACT_V1,
  shadowParityVersion: CORE12_SHADOW_PARITY_V1,
  classificationPrecedenceVersion: CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1,
  legacySourceAnchorVersion: CORE12_LEGACY_SOURCE_ANCHOR_V1,
  divergenceCatalogVersion: CORE12_DIVERGENCE_CATALOG_V1,
  availabilityProviderContractVersion: CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1,
  eligibilitySnapshotVersion: CORE12_ELIGIBILITY_SNAPSHOT_V1,
  availabilityQueryVersion: CORE12_AVAILABILITY_QUERY_V1,
  canonicalCourtDescriptorVersion: CORE12_CANONICAL_COURT_DESCRIPTOR_V1,
  availabilityProjectionVersion: CORE12_AVAILABILITY_PROJECTION_V1,
  venueAvailabilityBridgeVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
});

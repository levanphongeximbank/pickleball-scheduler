/**
 * Venue & Court — Canonical Court Descriptor contract literals (Phase 3B).
 *
 * Venue-owned authority and version pins for the Competition-facing
 * listCanonicalCourtDescriptors public contract. Do not invent values in CORE-12.
 */

/** Inventory provenance authority for Club V3 court master data. */
export const DESCRIPTOR_AUTHORITY = "venue-court.inventory.club_data_v3";

/** Public contract version pin for CanonicalCourtDescriptor responses. */
export const SOURCE_CONTRACT_VERSION =
  "VENUE_COURT_CANONICAL_COURT_DESCRIPTOR_V1";

/** Deterministic diagnostic reasons for excluded courts. */
export const DESCRIPTOR_DIAGNOSTIC_REASON = Object.freeze({
  PRIORITY_NOT_AUTHORITATIVE: "PRIORITY_NOT_AUTHORITATIVE",
  COURT_NOT_FOUND: "COURT_NOT_FOUND",
});

/** Fail-closed error codes for listCanonicalCourtDescriptors. */
export const DESCRIPTOR_ERROR = Object.freeze({
  INVALID_REQUEST: "INVALID_REQUEST",
  TENANT_SCOPE_MISSING: "TENANT_SCOPE_MISSING",
  CLUB_SCOPE_MISSING: "CLUB_SCOPE_MISSING",
  VENUE_SCOPE_MISSING: "VENUE_SCOPE_MISSING",
  CLUB_NOT_FOUND: "CLUB_NOT_FOUND",
  VENUE_MISMATCH: "VENUE_MISMATCH",
  TENANT_MISMATCH: "TENANT_MISMATCH",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
});

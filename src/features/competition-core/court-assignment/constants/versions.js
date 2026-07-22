/**
 * CORE-12 Court Assignment — version and identity constants.
 * Capability-local; no CORE-10 runtime dependency.
 */

export const CORE12_ENGINE_ID = "CORE12_COURT_ASSIGNMENT";

export const CORE12_ENGINE_VERSION = "1.0.0-phase1b";

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

export const CORE12_IDENTITY = Object.freeze({
  id: CORE12_ENGINE_ID,
  version: CORE12_ENGINE_VERSION,
  schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  comparatorVersion: CORE12_COMPARATOR_VERSION,
  courtSelectionStrategyVersion: CORE12_COURT_SELECTION_STRATEGY_VERSION,
  fingerprintVersion: CORE12_FINGERPRINT_VERSION,
  canonicalSerializationVersion: CORE12_CANONICAL_SERIALIZATION_VERSION,
  policyVersion: CORE12_POLICY_VERSION,
});

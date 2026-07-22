/**
 * CORE-13 — schema and identity constants.
 * Single canonical schema identifier; no aliases.
 */

export const CORE13_ENGINE_ID = "competition-core-referee-assignment";

export const CORE13_ENGINE_VERSION = "0.1.0-phase1b";

/** Canonical schema identifier — do not invent alternate aliases. */
export const CORE13_SCHEMA_VERSION = "CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1";

export const CORE13_DETERMINISM_POLICY_ID = "CORE13_DETERMINISM_V1";

export const CORE13_COMPARATOR_VERSION = "CORE13_COMPARATOR_V1";

export const CORE13_CANONICAL_SERIALIZATION_VERSION =
  "CORE13_CANONICAL_JSON_V1";

export const CORE13_IDENTITY = Object.freeze({
  engineId: CORE13_ENGINE_ID,
  version: CORE13_ENGINE_VERSION,
  schemaVersion: CORE13_SCHEMA_VERSION,
  determinismPolicyId: CORE13_DETERMINISM_POLICY_ID,
  comparatorVersion: CORE13_COMPARATOR_VERSION,
});

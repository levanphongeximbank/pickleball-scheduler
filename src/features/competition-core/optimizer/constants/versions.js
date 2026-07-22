/**
 * CORE-10 — version and identity constants.
 */

export const CORE10_ENGINE_ID = "CORE10_GLOBAL_OPTIMIZER";

/** Engine identity for replay metadata. */
export const CORE10_ENGINE_VERSION = "1.0.0-phase1b";

/** Contract schema version bound into requests / replay. */
export const CORE10_SCHEMA_VERSION = "CORE10_OPTIMIZER_SCHEMA_V1";

/** Lexicographic score comparator version. */
export const CORE10_COMPARATOR_VERSION = "CORE10_COMPARATOR_V1";

/** Fingerprint algorithm version (FNV-1a 32-bit over canonical JSON). */
export const CORE10_FINGERPRINT_VERSION = "CORE10_FINGERPRINT_V1";

/** Canonical serialization algorithm id. */
export const CORE10_CANONICAL_SERIALIZATION_VERSION = "CORE10_CANONICAL_JSON_V1";

/** Seeded PRNG algorithm version. */
export const CORE10_PRNG_VERSION = "CORE10_PRNG_MULBERRY32_V1";

/** Determinism policy id. */
export const CORE10_DETERMINISM_POLICY_ID = "CORE10_DETERMINISM_V1";

/** Phase 1C-A — ObjectiveDefinition schema version. */
export const CORE10_OBJECTIVE_DEFINITION_SCHEMA_VERSION =
  "CORE10_OBJECTIVE_DEFINITION_SCHEMA_V1";

/** Phase 1C-A — objective registry contract version. */
export const CORE10_OBJECTIVE_REGISTRY_VERSION = "CORE10_OBJECTIVE_REGISTRY_V1";

/** Phase 1C-A — objective evaluation pipeline version. */
export const CORE10_OBJECTIVE_EVALUATION_VERSION =
  "CORE10_OBJECTIVE_EVALUATION_V1";

export const CORE10_IDENTITY = Object.freeze({
  id: CORE10_ENGINE_ID,
  version: CORE10_ENGINE_VERSION,
  schemaVersion: CORE10_SCHEMA_VERSION,
  comparatorVersion: CORE10_COMPARATOR_VERSION,
  fingerprintVersion: CORE10_FINGERPRINT_VERSION,
  canonicalSerializationVersion: CORE10_CANONICAL_SERIALIZATION_VERSION,
  prngVersion: CORE10_PRNG_VERSION,
  determinismPolicyId: CORE10_DETERMINISM_POLICY_ID,
  objectiveDefinitionSchemaVersion: CORE10_OBJECTIVE_DEFINITION_SCHEMA_VERSION,
  objectiveRegistryVersion: CORE10_OBJECTIVE_REGISTRY_VERSION,
  objectiveEvaluationVersion: CORE10_OBJECTIVE_EVALUATION_VERSION,
});

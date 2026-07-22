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

/** Phase 1C-B1 — CandidateEvaluationInput schema version. */
export const CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION =
  "CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_V1";

/** Phase 1C-B1 — CandidateEvaluationDependencies contract version. */
export const CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION =
  "CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_V1";

/** Phase 1C-B1 — HardViolation schema version. */
export const CORE10_HARD_VIOLATION_SCHEMA_VERSION =
  "CORE10_HARD_VIOLATION_SCHEMA_V1";

/** Phase 1C-B1 — ConstraintEvaluationPort contract version. */
export const CORE10_CONSTRAINT_EVALUATION_PORT_VERSION =
  "CORE10_CONSTRAINT_EVALUATION_PORT_V1";

/** Phase 1C-B1 — hard-violation composition algorithm version. */
export const CORE10_HARD_VIOLATION_COMPOSITION_VERSION =
  "CORE10_HARD_VIOLATION_COMPOSITION_V1";

/** Phase 1C-B2-A — CandidateEvaluationResult schema version. */
export const CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION =
  "CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_V1";

/** Phase 1C-B2-A — CandidateEvaluationFailure schema version. */
export const CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION =
  "CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_V1";

/** Phase 1C-B2-A — candidate evaluation pipeline version. */
export const CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION =
  "CORE10_CANDIDATE_EVALUATION_PIPELINE_V1";

/** Phase 1C-B2-A — candidate OptimizationScore composition version. */
export const CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION =
  "CORE10_CANDIDATE_SCORE_COMPOSITION_V1";

/** Phase 1C-B2-A — candidate evaluation input fingerprint version. */
export const CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION =
  "CORE10_CANDIDATE_INPUT_FINGERPRINT_V1";

/** Phase 1C-C — CandidateEvaluationResult fingerprint schema version. */
export const CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION =
  "CORE10_CANDIDATE_RESULT_FINGERPRINT_V1";

/** Phase 1D — candidate ranking / feasible-winner selection version. */
export const CORE10_CANDIDATE_RANKING_VERSION = "CORE10_CANDIDATE_RANKING_V1";

/** Phase 1E — supplied-frontier OptimizationResult projection version. */
export const CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_VERSION =
  "CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_V1";

/** Phase 1F — historical supplied-candidate optimization version (retained). */
export const CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION =
  "CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V1";

/**
 * Phase 1G — supplied-candidate optimization with deterministic
 * evaluation-budget termination.
 */
export const CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2 =
  "CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2";

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
  candidateEvaluationInputSchemaVersion:
    CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION,
  candidateEvaluationDependenciesVersion:
    CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION,
  hardViolationSchemaVersion: CORE10_HARD_VIOLATION_SCHEMA_VERSION,
  constraintEvaluationPortVersion: CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  hardViolationCompositionVersion: CORE10_HARD_VIOLATION_COMPOSITION_VERSION,
  candidateEvaluationResultSchemaVersion:
    CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION,
  candidateEvaluationFailureSchemaVersion:
    CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION,
  candidateEvaluationPipelineVersion:
    CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  candidateScoreCompositionVersion: CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION,
  candidateInputFingerprintVersion: CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION,
  candidateResultFingerprintVersion: CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION,
  candidateRankingVersion: CORE10_CANDIDATE_RANKING_VERSION,
  suppliedFrontierResultProjectionVersion:
    CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_VERSION,
  suppliedCandidateOptimizationVersion:
    CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION,
  suppliedCandidateOptimizationV2: CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
});

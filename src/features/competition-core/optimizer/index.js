/**
 * CORE-10 Global Optimizer — capability-local public surface.
 * Phase 1B: contracts, determinism primitives, structural validation,
 * scoring comparator, replay metadata, diagnostics contracts.
 * Phase 1C-A: objective definitions, immutable registry, synchronous
 * deterministic objective evaluation (no candidate pipeline).
 * Phase 1C-B1: candidate-evaluation contracts, constraint port,
 * HardViolation composition, structural candidate-input validation.
 * Phase 1C-B2-A: CandidateEvaluationFailure/Result, score composition,
 * input fingerprint helper (internal).
 * Phase 1C-B2-B: evaluateCandidateSolution orchestration (no search/solvers).
 * Phase 1C-C: CandidateEvaluationResult content fingerprint (explicit utility).
 *
 * Integrator owns root competition-core/index.js — do not edit that here.
 * No scheduling, court-assignment, or referee-assignment exports.
 * No production solvers in Phase 1B / 1C-A / 1C-B1 / 1C-B2-A / 1C-B2-B / 1C-C.
 */

export {
  CORE10_ENGINE_ID,
  CORE10_ENGINE_VERSION,
  CORE10_SCHEMA_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_FINGERPRINT_VERSION,
  CORE10_CANONICAL_SERIALIZATION_VERSION,
  CORE10_PRNG_VERSION,
  CORE10_DETERMINISM_POLICY_ID,
  CORE10_OBJECTIVE_DEFINITION_SCHEMA_VERSION,
  CORE10_OBJECTIVE_REGISTRY_VERSION,
  CORE10_OBJECTIVE_EVALUATION_VERSION,
  CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION,
  CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION,
  CORE10_HARD_VIOLATION_SCHEMA_VERSION,
  CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  CORE10_HARD_VIOLATION_COMPOSITION_VERSION,
  CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION,
  CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION,
  CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION,
  CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION,
  CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION,
  CORE10_IDENTITY,
} from "./constants/index.js";

export {
  OPTIMIZATION_STATUS,
  OPTIMIZATION_STATUS_VALUES,
  isOptimizationStatus,
  resolveOptimizationStatus,
  OPTIMIZATION_FAILURE_CODE,
  OPTIMIZATION_FAILURE_CODE_VALUES,
  isOptimizationFailureCode,
  resolveOptimizationFailureCode,
  SOLVER_STRATEGY,
  SOLVER_STRATEGY_VALUES,
  isSolverStrategy,
  resolveSolverStrategy,
  OPTIMIZATION_OPERATION,
  OPTIMIZATION_OPERATION_VALUES,
  isOptimizationOperation,
  resolveOptimizationOperation,
  CONSTRAINT_KIND,
  CONSTRAINT_KIND_VALUES,
  isConstraintKind,
  OBJECTIVE_SENSE,
  OBJECTIVE_SENSE_VALUES,
  isObjectiveSense,
  OBJECTIVE_EVALUATION_FAILURE_CODE,
  CANDIDATE_EVALUATION_STATUS,
  CANDIDATE_EVALUATION_FAILURE_CODE,
} from "./enums/index.js";

export {
  OptimizerContractError,
  isOptimizerContractError,
} from "./errors/index.js";

export {
  createDecisionVariable,
  createOptimizationPolicy,
  FORBIDDEN_OBJECTIVE_KEYS,
  createOptimizationOperation,
  createSnapshotRef,
  createOptimizationContext,
  createDeterministicBudget,
  createOptimizationRequest,
  createConstraintEvaluation,
  createObjectiveEvaluation,
  createOptimizationScore,
  createCandidateSolution,
  createOptimizationFailure,
  createSolverDiagnostics,
  createReplayMetadata,
  projectReplayFingerprintMaterial,
  REPLAY_METADATA_FORBIDDEN_FIELDS,
  createOptimizationResult,
  createObjectiveDefinition,
  OBJECTIVE_NORMALIZATION_POLICY,
  createObjectiveExecutionSpec,
  createObjectiveEvaluationRecord,
  createHardViolation,
  createCandidateEvaluationInput,
  createCandidateEvaluationDependencies,
  createCandidateEvaluationFailure,
  createCandidateEvaluationResult,
} from "./contracts/index.js";

export {
  compareStableString,
  compareStableId,
  sortStableIds,
  sortedObjectKeys,
  isPlainObject,
  deepFreezeCanonical,
  freezePlainObject,
  hashStringToUint32,
  canonicalizeJsonValue,
  serializeCanonical,
  fingerprintValue,
  fingerprintAccepted,
  normalizeSeed,
  createSeededRandom,
} from "./deterministic/index.js";

export {
  orientObjectiveValue,
  buildOptimizationScore,
  compareOptimizationScores,
  sortScoresDeterministic,
  composeCandidateOptimizationScore,
} from "./scoring/index.js";

export {
  validateOptimizationRequestStructure,
  validateScopeConsistency,
  validateSnapshotReferences,
  validateCandidateAgainstDomains,
  validateCanonicalReplayInput,
  validateOptimizationRequest,
} from "./constraints/index.js";

export { createEmptySolverDiagnostics } from "./diagnostics/index.js";

export {
  createObjectiveRegistry,
  evaluateObjective,
  evaluateObjectives,
} from "./objectives/index.js";

export { createConstraintEvaluationPort } from "./ports/index.js";

export {
  validateCandidateEvaluationInput,
  composeHardViolations,
  evaluateCandidateSolution,
  createCandidateEvaluationResultFingerprint,
} from "./evaluation/index.js";

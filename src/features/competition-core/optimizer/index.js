/**
 * CORE-10 Global Optimizer — capability-local public surface.
 * Phase 1B: contracts, determinism primitives, structural validation,
 * scoring comparator, replay metadata, diagnostics contracts.
 *
 * Integrator owns root competition-core/index.js — do not edit that here.
 * No scheduling, court-assignment, or referee-assignment exports.
 * No production solvers in Phase 1B.
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

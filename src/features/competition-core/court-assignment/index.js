/**
 * CORE-12 Court Assignment — capability-local public production surface (Phase 1B).
 *
 * Pure deterministic greedy assignment over request-provided snapshots.
 * No UI, persistence, Supabase, Venue live APIs, CORE-11, CORE-14, or CORE-10 wiring.
 *
 * Test doubles and fail-closed stubs are exported from `./adapters/index.js`
 * only — not from this production surface.
 *
 * Integrator owns root competition-core/index.js — do not edit that here.
 */

export {
  CORE12_ENGINE_ID,
  CORE12_ENGINE_VERSION,
  CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  CORE12_COMPARATOR_VERSION,
  CORE12_COURT_SELECTION_STRATEGY_VERSION,
  CORE12_FINGERPRINT_VERSION,
  CORE12_CANONICAL_SERIALIZATION_VERSION,
  CORE12_POLICY_VERSION,
  CORE12_TE_ADAPTER_CONTRACT_V1,
  CORE12_SHADOW_PARITY_V1,
  CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1,
  CORE12_LEGACY_SOURCE_ANCHOR_V1,
  CORE12_DIVERGENCE_CATALOG_V1,
  CORE12_IDENTITY,
} from "./constants/index.js";

export {
  COURT_ASSIGNMENT_STATUS,
  COURT_ASSIGNMENT_STATUS_VALUES,
  isCourtAssignmentStatus,
  COURT_AVAILABILITY_STATUS,
  COURT_AVAILABILITY_STATUS_VALUES,
  isCourtAvailabilityStatus,
  COURT_CONSTRAINT_KIND,
  COURT_CONSTRAINT_KIND_VALUES,
  isCourtConstraintKind,
  CONFLICT_SEVERITY,
  CONFLICT_SEVERITY_VALUES,
  isConflictSeverity,
  COURT_ASSIGNMENT_SOURCE,
  COURT_ASSIGNMENT_SOURCE_VALUES,
  isCourtAssignmentSource,
  COURT_LOCK_SOURCE,
  COURT_LOCK_SOURCE_VALUES,
  isCourtLockSource,
  MATCH_ORDERING_STRATEGY,
  MATCH_ORDERING_STRATEGY_VALUES,
  isMatchOrderingStrategy,
  COURT_ORDERING_STRATEGY,
  COURT_ORDERING_STRATEGY_VALUES,
  isCourtOrderingStrategy,
  CAPABILITY_MATCH_MODE,
  CAPABILITY_MATCH_MODE_VALUES,
  isCapabilityMatchMode,
  OVERLAP_MODE,
  OVERLAP_MODE_VALUES,
  isOverlapMode,
  INVALID_LOCK_BEHAVIOR,
  INVALID_LOCK_BEHAVIOR_VALUES,
  isInvalidLockBehavior,
  COURT_ASSIGNMENT_REJECTION_CODE,
  COURT_ASSIGNMENT_REJECTION_CODE_ALIASES,
  COURT_ASSIGNMENT_CONFLICT_CODE,
  COURT_ASSIGNMENT_CONFLICT_CODE_ALIASES,
  COURT_ASSIGNMENT_REJECTION_CODE_VALUES,
  COURT_ASSIGNMENT_CONFLICT_CODE_VALUES,
  resolveCanonicalRejectionCode,
  resolveCanonicalConflictCode,
} from "./enums/index.js";

export {
  CourtAssignmentContractError,
  isCourtAssignmentContractError,
} from "./errors/index.js";

export {
  createCourtAssignmentPolicy,
  createScheduledMatchInput,
  createAvailableCourtInput,
  createCourtConstraint,
  createLockedCourtAssignment,
  createAssignedCourtSlot,
  createUnassignedMatch,
  createCourtAssignmentConflict,
  createSnapshotRef,
  createCourtAssignmentDiagnostics,
  createCourtAssignmentResult,
  createCourtAssignmentRequest,
} from "./contracts/index.js";

export {
  compareStableString,
  compareStableId,
  sortStableIds,
  deepFreezeCanonical,
  fingerprintValue,
  serializeCanonical,
  intervalsOverlapHalfOpen,
  intervalFullyCovers,
  requireHalfOpenInterval,
  compareMatches,
  compareCourts,
  stableSortCopy,
} from "./deterministic/index.js";

export {
  detectCourtOverlaps,
  occupancyConflictsWith,
  validateCourtAssignmentRequest,
  /** Canonical pure assigner (deterministic, side-effect free). */
  assignCourtsDeterministic,
  /** Alias of assignCourtsDeterministic for CourtAssignmentPort naming. */
  assignCourts,
} from "./services/index.js";

export {
  /** Production port factory wrapping assignCourtsDeterministic. */
  createCourtAssignmentPort,
  /** Method-name constants for consumer-side availability port. */
  COURT_AVAILABILITY_PORT_METHODS,
  COURT_ASSIGNMENT_RULE_PORT_METHODS,
} from "./ports/index.js";

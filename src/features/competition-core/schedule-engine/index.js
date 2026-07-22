/**
 * CORE-11 Schedule Engine — public module surface.
 *
 * Canonical path: src/features/competition-core/schedule-engine/
 * Engine ID: CORE11_SCHEDULE_ENGINE
 * Engine version: core11-v1
 *
 * Phase 1B: domain contracts, diagnostics, request/plan validators.
 * Phase 1C: operating/session window normalization + civilTime.js absolute adapter.
 * Phase 1D: dependency graph, cycle detection, topo order, readiness, earliest bound.
 * Phase 1E: abstract slot generation + deterministic baseline schedule candidate.
 * Phase 1F: independent hard-constraint certification of baseline candidates.
 * Phase 1G-B1: CORE-09 MatchPlan → ScheduleRequest adapter (Path A).
 * Does not re-export CC-09 (src/features/competition-core/scheduling/).
 * Does not implement physical court / referee assignment, persistence, or UI wiring.
 */

export {
  SCHEDULE_SCHEMA_VERSION,
  SCHEDULE_ENGINE_IDENTITY,
  CORE11_SCHEDULE_ENGINE,
  CORE11_ENGINE_VERSION,
  CONSTRAINT_CERTIFICATION,
  CONSTRAINT_CERTIFICATION_VALUES,
  isConstraintCertification,
  BASELINE_CANDIDATE_STATUS,
  CONSTRAINT_CERTIFICATION_RESULT_STATUS,
  PARTICIPANT_REFERENCE_KIND,
  PARTICIPANT_REFERENCE_KIND_VALUES,
  isParticipantReferenceKind,
  OVERNIGHT_POLICY,
  SCHEDULE_DEPENDENCY_TYPE,
  SCHEDULE_DEPENDENCY_TYPE_VALUES,
  isScheduleDependencyType,
  SCHEDULE_PREDECESSOR_STATE,
  SCHEDULE_PREDECESSOR_STATE_VALUES,
  isSchedulePredecessorState,
  SCHEDULE_DIAGNOSTIC_SEVERITY,
  SCHEDULE_DIAGNOSTIC_SEVERITY_VALUES,
  isScheduleDiagnosticSeverity,
  FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS,
  MINUTES_FROM_MIDNIGHT_MIN,
  MINUTES_FROM_MIDNIGHT_MAX,
  CIVIL_DATE_RE,
} from "./scheduleConstants.js";

export {
  SCHEDULE_DIAGNOSTIC_CODE,
  SCHEDULE_DIAGNOSTIC_CODE_VALUES,
  isScheduleDiagnosticCode,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
  assignmentBoundaryCodeForField,
} from "./scheduleDiagnostics.js";

export {
  asciiCompare,
  normalizeIdentifier,
  isValidIdentifier,
  isNonNegativeInteger,
  isPositiveInteger,
  copyPlainObject,
  isValidCivilDate,
  isValidMinutesFromMidnight,
  isValidIanaTimezone,
  civilWindowsOverlap,
  isCivilWindowContained,
  deriveOperatingWindowId,
  stableSortByKeys,
  canonicalizeJsonValue,
  serializeCanonical,
} from "./scheduleTypes.js";

export {
  createCivilScheduleTime,
  createSchedulingWindow,
  createSessionWindow,
  createScheduleParticipantReference,
  createScheduleDependency,
  createScheduleMatchInput,
  createMatchDurationPolicy,
  createRestPolicy,
  createCapacityPolicy,
  createSchedulePolicy,
  createScheduleRequest,
  createScheduledMatch,
  createUnscheduledMatch,
  createScheduleReplayMetadata,
  createSchedulePlan,
  normalizeScheduledOrder,
  normalizeUnscheduledOrder,
  projectSchedulePlanForFingerprint,
  fingerprintSchedulePlan,
  projectScheduleRequestForFingerprint,
  fingerprintScheduleRequest,
  projectBaselineCandidateForFingerprint,
  fingerprintBaselineScheduleCandidate,
  MATCH_PLAN_TO_SCHEDULE_REQUEST_RESULT_STATUS,
  createMatchPlanToScheduleRequestResult,
  schedulePlansSemanticallyEqual,
  collectForbiddenAssignmentFieldPaths,
  matchesScheduleOptimizerPort,
  matchesScheduleCapacityPort,
} from "./scheduleContracts.js";

export { normalizeOperatingWindows } from "./normalizeOperatingWindows.js";
export {
  normalizeSessionWindows,
  validateSessionContainment,
} from "./normalizeSessionWindows.js";
export {
  convertCivilScheduleTimeToAbsolute,
  convertSchedulingWindowToAbsoluteRange,
} from "./scheduleCivilTime.js";

export {
  buildScheduleDependencyGraph,
  topologicallyOrderScheduleMatches,
  detectDependencyCycles,
} from "./scheduleDependencyGraph.js";
export {
  evaluateSchedulePlanningReadiness,
  evaluateParticipantResolutionReadiness,
  evaluateMatchDependencyReadiness,
  deriveDependencyEarliestStartAbsolute,
} from "./scheduleDependencyReadiness.js";

export {
  generateAbstractScheduleSlots,
  buildSlotId,
} from "./scheduleSlotGenerator.js";
export {
  resolveMatchDurationMinutes,
  placeMatchIntoCandidateSlot,
  buildBaselineScheduleCandidate,
} from "./baselineScheduleCandidate.js";

export {
  intervalsOverlap,
  restGapUtcMs,
  isUnresolvedParticipantIdentity,
  parseLineageParticipantToken,
  collectPlaceholderLineageSources,
  extractConstraintResources,
  deriveConservativeConstraintResources,
  collectScheduledConstraintIndex,
  certifyResourceTimeline,
  LINEAGE_DEPENDENCY_TYPES,
  EXTERNAL_BARRIER_DEPENDENCY_TYPES,
} from "./scheduleParticipantConstraints.js";
export { certifyBaselineScheduleCandidateConstraints } from "./scheduleConstraintCertification.js";

export { createScheduleRequestFromMatchPlan } from "./adapters/index.js";

export { validateScheduleRequest } from "./validateScheduleRequest.js";
export {
  validateSchedulePlan,
  scheduleResultValidator,
} from "./validateSchedulePlan.js";

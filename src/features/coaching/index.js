/**
 * Coaching & Training — public facade (COACHING-01).
 *
 * Canonical foundation: domain, authorization, application, in-memory repositories,
 * Platform Core adapter projections.
 *
 * Legacy localStorage (`services/coachingService.js`) remains exported for existing
 * UI compatibility only — NOT a repository port implementation.
 *
 * Does NOT export:
 * - durable Supabase adapters (deferred)
 * - raw SQL
 * - secrets / credentials
 */

// ---------------------------------------------------------------------------
// Legacy / prototype persistence (COMPATIBILITY_ONLY) — do not use as SoT
// ---------------------------------------------------------------------------
export * from "./services/coachingService.js";

// ---------------------------------------------------------------------------
// Platform Core adoption — pure projections + adoption metadata
// ---------------------------------------------------------------------------
export {
  COACHING_PLATFORM_ADAPTER_ERROR,
  projectCoachingActor,
  projectCoachingSecurityContext,
  projectCoachingScope,
  projectCoachingSubject,
  projectCoachingPermission,
  projectCoachingAuthorizationRequest,
  projectCoachingOperation,
  projectCoachingVersion,
  projectCoachingCompatibility,
  projectCoachingEvent,
  projectCoachingError,
  projectCoachingCapability,
} from "./platform/index.js";

export {
  COACHING_PLATFORM_ADOPTION,
  getCoachingPlatformAdoption,
} from "./adoption.js";

// ---------------------------------------------------------------------------
// COACHING-01 canonical foundation
// ---------------------------------------------------------------------------
export {
  COACHING_ACTIONS,
  COACHING_ACTION_VALUES,
  isCoachingAction,
} from "./constants/actions.js";

export {
  COACHING_ERROR_CODES,
  COACHING_ERROR_CODE_VALUES,
  isCoachingErrorCode,
} from "./constants/errorCodes.js";

export {
  PROGRAM_STATUS,
  PROGRAM_STATUS_VALUES,
  PROGRAM_ALLOWED_TRANSITIONS,
  ENROLLMENT_STATUS,
  ENROLLMENT_STATUS_VALUES,
  ENROLLMENT_ALLOWED_TRANSITIONS,
  SESSION_STATUS,
  SESSION_STATUS_VALUES,
  SESSION_ALLOWED_TRANSITIONS,
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_VALUES,
  EVALUATION_STATUS,
  EVALUATION_STATUS_VALUES,
  EVALUATION_ALLOWED_TRANSITIONS,
  PACKAGE_STATUS,
  PACKAGE_STATUS_VALUES,
  PACKAGE_ALLOWED_TRANSITIONS,
  RELATIONSHIP_STATUS,
  isProgramStatus,
  isEnrollmentStatus,
  isSessionStatus,
  isAttendanceStatus,
  isEvaluationStatus,
  isPackageStatus,
  isAllowedTransition,
} from "./constants/lifecycles.js";

export {
  CoachingError,
  throwCoachingError,
  isCoachingError,
  coachingFailure,
} from "./errors/CoachingError.js";

export {
  authorizeCoaching,
  authorizeCoachingResource,
  authorizeCoachingViaPort,
  requireCoachingActor,
  requireCoachingScope,
} from "./authorization/coachingAuthorize.js";

export * from "./domain/index.js";

export {
  COACHING_REPOSITORY_PORTS,
  createSystemCoachingClock,
  createSequentialCoachingIdGenerator,
  createFixedCoachingClock,
  createInMemoryCoachingRepositories,
} from "./repositories/index.js";

export {
  createCoachingApplicationService,
  createFailClosedCoachingApplication,
  createMemoryCoachingApplication,
} from "./application/index.js";

export const COACHING_FOUNDATION_PHASE = "COACHING-01";

export const COACHING_PUBLIC_EXPORTS = Object.freeze([
  "COACHING_FOUNDATION_PHASE",
  "COACHING_ACTIONS",
  "COACHING_ERROR_CODES",
  "CoachingError",
  "authorizeCoaching",
  "createCoachingProgram",
  "createCoachingEnrollment",
  "createTrainingSession",
  "createAttendanceRecord",
  "correctAttendanceRecord",
  "createCoachingPackage",
  "createPackageEntitlement",
  "createCoachingEvaluation",
  "createInMemoryCoachingRepositories",
  "createCoachingApplicationService",
  "createFailClosedCoachingApplication",
  "createMemoryCoachingApplication",
  "getCoachingPlatformAdoption",
  "loadCoachingStore",
  "listCoaches",
]);

/**
 * Coaching & Training — public facade (COACHING-01 … COACHING-04).
 *
 * Canonical foundation: domain, authorization, application, in-memory repositories,
 * Platform Core adapter projections.
 *
 * COACHING-02 durable factories are exported for injection/tests only —
 * NOT wired as the application runtime default. COACHING_DURABLE_RUNTIME_DEFAULT=false.
 *
 * COACHING-04: UI pages MUST use `runtime/` (getCoachingPageGateway /
 * useCoachingCollection). Do not import list/save/delete from this barrel in pages.
 *
 * Legacy `services/coachingService.js` remains exported for compatibility /
 * tests only — COMPATIBILITY_ONLY. Runtime composition default is still legacy.
 * localStorage is not retired (LOCALSTORAGE_RETIRED=false).
 *
 * Does NOT export:
 * - raw SQL
 * - secrets / credentials
 * - a silent durable runtime default
 */

// ---------------------------------------------------------------------------
// Legacy / prototype persistence (COMPATIBILITY_ONLY)
// Pages: use runtime/ instead of these exports.
// ---------------------------------------------------------------------------
export * from "./services/coachingService.js";

// ---------------------------------------------------------------------------
// COACHING-04 runtime boundary (page-facing)
// ---------------------------------------------------------------------------
export {
  COACHING_RUNTIME_MODE,
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
  COACHING_04_PHASE,
  COACHING_04_SCOPED_PERMISSION_IDS,
  COACHING_04_PLAYER_SELF_PERMISSION_IDS,
  COACHING_04_PLAYER_SELF_SCOPE_STATUS,
  COACHING_UI_COLLECTIONS,
  COACHING_RUNTIME_ERROR_CODES,
  COACHING_PLAYER_SCOPE_STATE,
  createCoachingRuntimeError,
  createCoachingRuntime,
  createLegacyCoachingAdapter,
  createDurableCoachingAdapter,
  createDefaultCoachingRuntime,
  getDefaultCoachingRuntime,
  getCoachingPageGateway,
  detectLegacyStore,
  classifyLegacyStore,
  buildRetirementPlan,
  assertRetirementNotActivated,
  resolveCoachingPlayerSelfScope,
  classifyCoachingDurableCollectionResult,
  assertCoachingPlayerDurableWriteAllowed,
  getCoachingLegacyIsolationContract,
  COACHING_STAGING_DURABLE_RUNTIME_FLAG,
  COACHING_STAGING_OWNER_GO_GRANTED_FLAG,
  COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
  COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT,
  COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION,
  resolveCoachingStagingDurableActivation,
} from "./runtime/index.js";
// useCoachingCollection — import from ./runtime (keeps React out of Node barrel tests).
// COACHING_LEGACY_STORAGE_KEY_PREFIX comes from coachingService (COMPATIBILITY_ONLY).
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
  COACHING_04_ASSIGNED_ACTIONS,
  COACHING_04_ASSIGNED_ACTION_VALUES,
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

export {
  COACHING_IDENTITY_PERMISSION_IDS,
  COACHING_IDENTITY_PERMISSION_VALUES,
  COACHING_04_ASSIGNED_PERMISSION_IDS,
  COACHING_04_ASSIGNED_PERMISSION_VALUES,
  COACHING_PERMISSION_MANIFEST,
  coachingActionToIdentityPermissionId,
} from "./constants/permissions.js";

export {
  COACHING_DURABLE_PERSISTENCE_PHASE,
  COACHING_DURABLE_RUNTIME_DEFAULT as COACHING_DURABLE_PERSISTENCE_RUNTIME_DEFAULT,
  COACHING_02_TABLES,
  COACHING_02_RPC,
  requireCoachingDatabaseClientPort,
  createDurableCoachingRepositories,
  createFakeCoachingDatabaseClient,
  translateCoachingPersistenceError,
} from "./persistence/index.js";

export const COACHING_FOUNDATION_PHASE = "COACHING-01";
export const COACHING_PERSISTENCE_PHASE = "COACHING-02";
export const COACHING_CUTOVER_PHASE = "COACHING-04";

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
  "getCoachingPageGateway",
  "createCoachingRuntime",
  "loadCoachingStore",
  "listCoaches",
]);

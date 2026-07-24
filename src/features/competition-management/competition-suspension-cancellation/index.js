/**
 * Competition Suspension / Cancellation — public facade (CM-07).
 *
 * Canonical Competition Management capability that owns competition-level
 * lifecycle interruption decisions: suspend, resume, and irreversible cancel.
 *
 * Does NOT export / own:
 * - SQL / migrations / Supabase clients
 * - production tournamentService wiring
 * - UI / routes / React hooks
 * - Competition Core (CORE-01..CORE-23) execution
 * - CM-01 CompetitionDefinition mutation
 * - CM-06 CompetitionPublication mutation / unpublish execution
 * - CM-08 archive
 * - match cancellation / score / result / standings mutation
 * - notification sending / audit persistence
 * - CORE-23 recovery/resume checkpoints
 */

export const COMPETITION_SUSPENSION_CANCELLATION_PHASE = Object.freeze({
  id: "CM-07",
  name: "competition-suspension-cancellation",
  wiredToProductionRuntime: false,
  hasPersistence: false,
  hasUi: false,
  hasMigration: false,
  migrationAuthored: false,
  migrationApplied: false,
  repositoryMode: "capability-local-in-memory",
  ownsLifecycleInterruption: true,
  ownsDefinitionMutation: false,
  ownsPublicationMutation: false,
  ownsMatchCancellation: false,
  ownsArchive: false,
  ownsNotifications: false,
  ownsAuditPersistence: false,
  ownsCore15: false,
  ownsCore19: false,
  ownsCore23Recovery: false,
  uncancelSupported: false,
});

export {
  COMPETITION_LIFECYCLE_STATE,
  COMPETITION_LIFECYCLE_STATE_VALUES,
  isCompetitionLifecycleState,
  COMPETITION_LIFECYCLE_TERMINAL_STATES,
  isCompetitionLifecycleTerminalState,
  COMPETITION_LIFECYCLE_ACTION,
  COMPETITION_LIFECYCLE_ACTION_VALUES,
  isCompetitionLifecycleAction,
  COMPETITION_SUSPENSION_REASON_CODE,
  COMPETITION_SUSPENSION_REASON_CODE_VALUES,
  COMPETITION_SUSPENSION_REASON_CATEGORY,
  COMPETITION_SUSPENSION_REASON_CATEGORY_BY_CODE,
  COMPETITION_CANCELLATION_REASON_CODE,
  COMPETITION_CANCELLATION_REASON_CODE_VALUES,
  COMPETITION_CANCELLATION_REASON_CATEGORY,
  COMPETITION_CANCELLATION_REASON_CATEGORY_BY_CODE,
  COMPETITION_RESUME_REASON_CODE,
  COMPETITION_RESUME_REASON_CODE_VALUES,
  COMPETITION_RESUME_REASON_CATEGORY,
  COMPETITION_RESUME_REASON_CATEGORY_BY_CODE,
  COMPETITION_LIFECYCLE_REASON_SUMMARY_MAX_LENGTH,
  COMPETITION_LIFECYCLE_REASON_DETAIL_MAX_LENGTH,
  COMPETITION_LIFECYCLE_REASON_OTHER_MIN_DETAIL_LENGTH,
  isCompetitionSuspensionReasonCode,
  isCompetitionCancellationReasonCode,
  isCompetitionResumeReasonCode,
  COMPETITION_SUSPENSION_PUBLICATION_POLICY,
  COMPETITION_SUSPENSION_PUBLICATION_POLICY_VALUES,
  COMPETITION_CANCELLATION_PUBLICATION_POLICY,
  COMPETITION_CANCELLATION_PUBLICATION_POLICY_VALUES,
  COMPETITION_PUBLICATION_CONTEXT_PRESENCE,
  COMPETITION_PUBLICATION_CONTEXT_PRESENCE_VALUES,
  COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION,
  COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION_VALUES,
  COMPETITION_LIFECYCLE_ACTOR_TYPE,
  COMPETITION_LIFECYCLE_ACTOR_TYPE_VALUES,
  isCompetitionSuspensionPublicationPolicy,
  isCompetitionCancellationPublicationPolicy,
  isCompetitionPublicationContextPresence,
  isCompetitionLifecycleAuthorizationDecision,
  isCompetitionLifecycleActorType,
  COMPETITION_LIFECYCLE_INITIAL_REVISION,
  isValidCompetitionLifecycleRevision,
  nextCompetitionLifecycleRevision,
  isValidExpectedLifecycleRevision,
  normalizeExpectedLifecycleRevision,
  COMPETITION_LIFECYCLE_FINGERPRINT_ALGORITHM,
  COMPETITION_LIFECYCLE_RECORD_SCHEMA_VERSION,
  COMPETITION_LIFECYCLE_INTENT_EXECUTION_STATUS,
  COMPETITION_LIFECYCLE_SEVERITY,
  COMPETITION_LIFECYCLE_SEVERITY_VALUES,
  isCompetitionLifecycleSeverity,
} from "./constants/index.js";

export {
  COMPETITION_LIFECYCLE_ERROR_CODE,
  CompetitionLifecycleError,
  isCompetitionLifecycleError,
  isCompetitionLifecycleErrorCode,
} from "./errors/index.js";

export {
  failContract,
  isNonEmptyString,
  isPositiveInteger,
  deepFreeze,
  clonePlain,
  compareFieldPath,
  canonicalizeJson,
  stableContentFingerprint,
  hasControlCharacters,
  looksLikeHtmlOrScript,
  requireNonEmptyString,
  resolveEffectiveAt,
  createFieldError,
  sortFieldErrors,
  buildExplanation,
  validationOk,
  validationFail,
  isValidationOk,
  isValidationFail,
  snapshotInput,
  createCompetitionLifecycleRecordId,
  parseCompetitionLifecycleRecordId,
  lifecycleScopeKey,
  createLifecycleIdempotencyStorageKey,
  collectActorErrors,
  collectAuthorityErrors,
  collectReasonErrors,
  collectDefinitionContextErrors,
  collectPublicationContextErrors,
  collectPublicationPolicyErrors,
  collectOptionalVersionContextErrors,
  collectExpectedLifecycleRevisionErrors,
  buildSourceProvenance,
  projectCompetitionLifecycleState,
  projectCurrentLifecycleRevision,
  computeLifecycleRequestFingerprint,
  computeLifecycleRecordFingerprint,
  buildCompetitionLifecycleRecord,
  isCompetitionLifecycleRecord,
  resolveTransition,
} from "./contracts/index.js";

export {
  COMPETITION_LIFECYCLE_INTENT_TYPE,
  COMPETITION_LIFECYCLE_INTENT_TYPE_VALUES,
  buildCompetitionLifecycleEffectPlan,
  isCompetitionLifecycleEffectPlan,
} from "./effects/index.js";

export {
  evaluateLifecycleActionEligibility,
} from "./eligibility/index.js";

export {
  suspendCompetition,
  resumeCompetition,
  cancelCompetition,
  evaluateCompetitionLifecycleActionCommand,
  getCurrentCompetitionLifecycle,
  listCompetitionLifecycleHistory,
  createCapabilityLocalLifecycleRepository,
} from "./application/index.js";

export {
  createInMemoryCompetitionLifecycleRepository,
} from "./repository/index.js";

export {
  projectLegacyTournamentLifecycleObservation,
  isLegacyLifecycleObservationResult,
  LEGACY_LIFECYCLE_COMPATIBILITY,
} from "./adapters/index.js";

export {
  COMPETITION_LIFECYCLE_REPOSITORY_PORT_METHODS,
  throwLifecyclePortUnimplemented,
  createUnimplementedCompetitionLifecycleRepositoryPort,
  matchesCompetitionLifecycleRepositoryPort,
} from "./ports/index.js";

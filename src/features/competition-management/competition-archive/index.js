/**
 * Competition Archive — public facade (CM-08).
 *
 * Canonical Competition Management capability that owns competition-level
 * archive / unarchive decision records.
 *
 * Does NOT export / own:
 * - SQL / migrations / Supabase clients
 * - production tournamentService wiring
 * - UI / routes / React hooks
 * - CM-01 definition mutation
 * - CM-06 publication mutation
 * - CM-07 lifecycle mutation
 * - delete / purge / retention job execution
 * - storage deletion
 * - CORE-22 export / CORE-23 recovery
 * - notification sending / audit persistence (CORE-20)
 */

export const COMPETITION_ARCHIVE_PHASE = Object.freeze({
  id: "CM-08",
  name: "competition-archive",
  wiredToProductionRuntime: false,
  hasPersistence: false,
  hasUi: false,
  hasMigration: false,
  migrationAuthored: false,
  migrationApplied: false,
  repositoryMode: "capability-local-in-memory",
  ownsArchive: true,
  ownsDefinitionMutation: false,
  ownsPublicationMutation: false,
  ownsLifecycleMutation: false,
  ownsDelete: false,
  ownsPurge: false,
  ownsRetentionExecution: false,
  ownsStorageDeletion: false,
  ownsCore20AuditPersistence: false,
  ownsCore22Export: false,
  ownsCore23Recovery: false,
  unarchiveSupported: true,
  productionEffectsExecuted: false,
});

export {
  COMPETITION_ARCHIVE_STATE,
  COMPETITION_ARCHIVE_STATE_VALUES,
  isCompetitionArchiveState,
  COMPETITION_ARCHIVE_ACTION,
  COMPETITION_ARCHIVE_ACTION_VALUES,
  isCompetitionArchiveAction,
  COMPETITION_ARCHIVE_REASON_CODE,
  COMPETITION_ARCHIVE_REASON_CODE_VALUES,
  COMPETITION_ARCHIVE_REASON_CATEGORY,
  COMPETITION_ARCHIVE_REASON_CATEGORY_BY_CODE,
  COMPETITION_UNARCHIVE_REASON_CODE,
  COMPETITION_UNARCHIVE_REASON_CODE_VALUES,
  COMPETITION_UNARCHIVE_REASON_CATEGORY,
  COMPETITION_UNARCHIVE_REASON_CATEGORY_BY_CODE,
  COMPETITION_ARCHIVE_REASON_SUMMARY_MAX_LENGTH,
  COMPETITION_ARCHIVE_REASON_DETAIL_MAX_LENGTH,
  COMPETITION_ARCHIVE_REASON_OTHER_MIN_DETAIL_LENGTH,
  isCompetitionArchiveReasonCode,
  isCompetitionUnarchiveReasonCode,
  COMPETITION_ARCHIVE_POLICY_PROFILE,
  COMPETITION_ARCHIVE_POLICY_PROFILE_VALUES,
  COMPETITION_ARCHIVE_POLICY_BY_PROFILE,
  COMPETITION_PUBLICATION_CONTEXT_PRESENCE,
  COMPETITION_PUBLICATION_CONTEXT_PRESENCE_VALUES,
  COMPETITION_OPTIONAL_CONTEXT_PRESENCE,
  COMPETITION_OPTIONAL_CONTEXT_PRESENCE_VALUES,
  COMPETITION_ARCHIVE_AUTHORIZATION_DECISION,
  COMPETITION_ARCHIVE_AUTHORIZATION_DECISION_VALUES,
  COMPETITION_ARCHIVE_ACTOR_TYPE,
  COMPETITION_ARCHIVE_ACTOR_TYPE_VALUES,
  COMPETITION_ARCHIVE_FINALIZATION_KIND,
  COMPETITION_ARCHIVE_FINALIZATION_KIND_VALUES,
  isCompetitionArchivePolicyProfile,
  resolveCompetitionArchivePolicy,
  isCompetitionPublicationContextPresence,
  isCompetitionOptionalContextPresence,
  isCompetitionArchiveAuthorizationDecision,
  isCompetitionArchiveActorType,
  isCompetitionArchiveFinalizationKind,
  COMPETITION_ARCHIVE_INITIAL_REVISION,
  isValidCompetitionArchiveRevision,
  nextCompetitionArchiveRevision,
  isValidExpectedArchiveRevision,
  normalizeExpectedArchiveRevision,
  COMPETITION_ARCHIVE_FINGERPRINT_ALGORITHM,
  COMPETITION_ARCHIVE_RECORD_SCHEMA_VERSION,
  COMPETITION_ARCHIVE_MANIFEST_SCHEMA_VERSION,
  COMPETITION_ARCHIVE_INTENT_EXECUTION_STATUS,
  COMPETITION_ARCHIVE_SEVERITY,
  COMPETITION_ARCHIVE_SEVERITY_VALUES,
  isCompetitionArchiveSeverity,
} from "./constants/index.js";

export {
  COMPETITION_ARCHIVE_ERROR_CODE,
  CompetitionArchiveError,
  isCompetitionArchiveError,
  isCompetitionArchiveErrorCode,
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
  collectForbiddenManifestMarkers,
  createFieldError,
  sortFieldErrors,
  buildExplanation,
  validationOk,
  validationFail,
  isValidationOk,
  isValidationFail,
  snapshotInput,
  createCompetitionArchiveRecordId,
  parseCompetitionArchiveRecordId,
  archiveScopeKey,
  createArchiveIdempotencyStorageKey,
  collectActorErrors,
  collectAuthorityErrors,
  collectReasonErrors,
  collectDefinitionContextErrors,
  collectPublicationContextErrors,
  collectRequiredVersionContextErrors,
  collectOptionalRevisionContextErrors,
  collectConfigurationContextErrors,
  collectBrandingContextErrors,
  collectArchivePolicyErrors,
  collectExpectedArchiveRevisionErrors,
  collectFinalizationContextErrors,
  collectOperationalGuardErrors,
  buildSourceProvenance,
  projectCompetitionArchiveState,
  projectCurrentArchiveRevision,
  computeArchiveRequestFingerprint,
  computeArchiveRecordFingerprint,
  buildCompetitionArchiveRecord,
  isCompetitionArchiveRecord,
  resolveArchiveTransition,
} from "./contracts/index.js";

export {
  COMPETITION_ARCHIVE_INTENT_TYPE,
  COMPETITION_ARCHIVE_INTENT_TYPE_VALUES,
  buildCompetitionArchiveEffectPlan,
  isCompetitionArchiveEffectPlan,
} from "./effects/index.js";

export {
  buildCompetitionArchiveManifest,
  isCompetitionArchiveManifest,
} from "./manifest/index.js";

export {
  evaluateCompetitionArchiveEligibility,
} from "./eligibility/index.js";

export {
  archiveCompetition,
  unarchiveCompetition,
  evaluateCompetitionArchiveEligibilityCommand,
  getCurrentCompetitionArchiveState,
  listCompetitionArchiveHistory,
  createCapabilityLocalArchiveRepository,
} from "./application/index.js";

export {
  createInMemoryCompetitionArchiveRepository,
} from "./repository/index.js";

export {
  projectLegacyTournamentArchiveObservation,
  isLegacyArchiveObservationResult,
  LEGACY_ARCHIVE_COMPATIBILITY,
} from "./adapters/index.js";

export {
  COMPETITION_ARCHIVE_REPOSITORY_PORT_METHODS,
  throwArchivePortUnimplemented,
  createUnimplementedCompetitionArchiveRepositoryPort,
  matchesCompetitionArchiveRepositoryPort,
} from "./ports/index.js";

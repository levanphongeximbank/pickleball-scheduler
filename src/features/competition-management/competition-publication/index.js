/**
 * Competition Publication — public facade (CM-06 Competition Publication).
 *
 * Canonical Competition Management capability that owns only the
 * CompetitionPublication record: turning an explicit, already-immutable
 * CM-03 CompetitionVersion (plus its matching CM-01 definition, optional
 * CM-04 configuration, and required CM-05 branding) into a deterministic
 * public manifest and an integration plan of proposal-only intents.
 *
 * Does NOT export:
 * - SQL / migrations / Supabase clients
 * - production tournamentService wiring
 * - UI / routes / React hooks
 * - Competition Core engine surfaces (CORE-01..CORE-23)
 * - CM-01 CompetitionDefinition mutation / status / visibility changes
 * - CM-03 CompetitionVersion creation
 * - CM-04 CompetitionConfiguration mutation
 * - CM-05 CompetitionBranding mutation
 * - CM-07 suspension / CM-08 archive ownership
 * - real deploy / public route activation / CDN / cache execution
 * - notification sending
 * - audit persistence
 * - a "latest version" fallback or any UNVERSIONED_DRAFT_PUBLICATION concept
 */

export const COMPETITION_PUBLICATION_PHASE = Object.freeze({
  id: "CM-06",
  name: "competition-publication",
  wiredToProductionRuntime: false,
  hasPersistence: false,
  hasUi: false,
  hasMigration: false,
  migrationAuthored: false,
  migrationApplied: false,
  repositoryMode: "capability-local-in-memory",
  ownsPublicationStates: true,
  ownsNotifications: false,
  ownsPublicRouting: false,
  ownsBranding: false,
  ownsConfiguration: false,
  ownsCanonicalNameDescription: false,
  ownsCompetitionVersionCreation: false,
  ownsCompetitionCoreExecution: false,
  ownsAuditPersistence: false,
  ownsSuspensionOrArchiveStates: false,
});

export {
  COMPETITION_PUBLICATION_STATUS,
  COMPETITION_PUBLICATION_STATUS_VALUES,
  isCompetitionPublicationStatus,
  COMPETITION_PUBLICATION_SEMANTIC_STATE,
  COMPETITION_PUBLICATION_SEMANTIC_STATE_VALUES,
  isCompetitionPublicationSemanticState,
  COMPETITION_PUBLICATION_CHANNEL,
  COMPETITION_PUBLICATION_CHANNEL_VALUES,
  isCompetitionPublicationChannel,
  COMPETITION_PUBLICATION_AUDIENCE_CLASSIFICATION,
  COMPETITION_PUBLICATION_AUDIENCE_CLASSIFICATION_VALUES,
  isCompetitionPublicationAudienceClassification,
  COMPETITION_PUBLICATION_OUTPUT_REFERENCE_TYPE,
  COMPETITION_PUBLICATION_OUTPUT_REFERENCE_TYPE_VALUES,
  isCompetitionPublicationOutputReferenceType,
  COMPETITION_PUBLICATION_PROFILE_ID,
  COMPETITION_PUBLICATION_PROFILE_ID_VALUES,
  isCompetitionPublicationProfileId,
  COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE,
  COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE_VALUES,
  isCompetitionPublicationConfigurationPresence,
  COMPETITION_PUBLICATION_INITIAL_REVISION,
  isValidCompetitionPublicationRevision,
  nextCompetitionPublicationRevision,
  isValidExpectedCurrentPublicationRevision,
  COMPETITION_PUBLICATION_FINGERPRINT_ALGORITHM,
  COMPETITION_PUBLICATION_MANIFEST_SCHEMA_VERSION,
  COMPETITION_PUBLICATION_CHANGE_TYPE,
  COMPETITION_PUBLICATION_CHANGE_TYPE_VALUES,
  isCompetitionPublicationChangeType,
  COMPETITION_PUBLICATION_SEVERITY,
  COMPETITION_PUBLICATION_SEVERITY_VALUES,
  isCompetitionPublicationSeverity,
} from "./constants/index.js";

export {
  COMPETITION_PUBLICATION_ERROR_CODE,
  CompetitionPublicationError,
  isCompetitionPublicationError,
  isCompetitionPublicationErrorCode,
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
  requireNonEmptyString,
  createFieldError,
  sortFieldErrors,
  buildExplanation,
  validationOk,
  validationFail,
  isValidationOk,
  isValidationFail,
  snapshotInput,
  createCompetitionPublicationId,
  parseCompetitionPublicationId,
  publicationScopeKey,
  createIdempotencyStorageKey,
  publicReferenceKey,
  PUBLIC_REFERENCE_SLUG_PATTERN,
  validateSlug,
  parseRequestedPublicReference,
  buildSourceReferences,
  isCompetitionPublicationSourceReferences,
  cloneSourceReferences,
  EXTERNAL_LIFECYCLE_BLOCKED_STATUSES,
  collectProfileErrors,
  collectChannelErrors,
  collectVersionSourceErrors,
  collectDefinitionMatchErrors,
  collectConfigurationErrors,
  collectBrandingErrors,
  collectChannelVisibilityErrors,
  collectExternalLifecycleBlockErrors,
  buildCompetitionPublicationRecord,
  isCompetitionPublication,
  computePublicationRequestFingerprint,
} from "./contracts/index.js";

export {
  CM06_STANDARD_V1_PROFILE,
  getCompetitionPublicationProfile,
  isKnownCompetitionPublicationProfileId,
  listCompetitionPublicationProfiles,
} from "./profiles/index.js";

export {
  getCompetitionPublicationChannelDescriptor,
  isVisibilityAllowedForChannel,
  listCompetitionPublicationChannelDescriptors,
} from "./channels/index.js";

export {
  evaluateCompetitionPublicationReadiness,
} from "./readiness/index.js";

export {
  buildCompetitionPublicationManifest,
  isCompetitionPublicationManifest,
} from "./manifest/index.js";

export {
  COMPETITION_PUBLICATION_INTENT_TYPE,
  COMPETITION_PUBLICATION_INTENT_TYPE_VALUES,
  buildCompetitionPublicationPlan,
  isCompetitionPublicationPlan,
} from "./planning/index.js";

export {
  publishCompetitionPublication,
  republishCompetitionPublication,
  getCompetitionPublicationById,
  getCurrentCompetitionPublication,
  listCompetitionPublicationsCommand,
  evaluateCompetitionPublicationReadinessCommand,
  createCapabilityLocalPublicationRepository,
} from "./application/index.js";

export {
  createInMemoryCompetitionPublicationRepository,
} from "./repository/index.js";

export {
  projectLegacyTournamentPublicationObservation,
  isLegacyPublicationObservationResult,
  LEGACY_PUBLICATION_COMPATIBILITY,
} from "./adapters/index.js";

export {
  COMPETITION_PUBLICATION_REPOSITORY_PORT_METHODS,
  COMPETITION_PUBLICATION_REPOSITORY_PORT_OPTIONAL_METHODS,
  throwPublicationPortUnimplemented,
  createUnimplementedCompetitionPublicationRepositoryPort,
  matchesCompetitionPublicationRepositoryPort,
} from "./ports/index.js";

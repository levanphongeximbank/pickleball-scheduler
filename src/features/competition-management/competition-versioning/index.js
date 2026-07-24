/**
 * Competition Versioning — public facade (CM-03 Competition Versioning).
 *
 * Canonical Competition Management capability for immutable competition
 * version snapshots, lineage, comparison, and restore proposals.
 *
 * Does NOT export:
 * - SQL / migrations / Supabase clients
 * - production tournamentService wiring
 * - UI / routes / React hooks
 * - Competition Core engine surfaces (CORE-01..CORE-23)
 * - CM-01 mutable CompetitionDefinition ownership
 * - CM-02 template selection/instantiation ownership
 * - CM-04..CM-08 lifecycle ownership
 * - Finance / Notification / Venue inventory / Player / Club membership ownership
 */

export const COMPETITION_VERSIONING_PHASE = Object.freeze({
  id: "CM-03",
  name: "competition-versioning",
  wiredToProductionRuntime: false,
  hasPersistence: false,
  hasUi: false,
  hasMigration: false,
  migrationAuthored: false,
  migrationApplied: false,
  repositoryMode: "capability-local-in-memory",
  ownsPublicationStates: false,
  ownsAuditPersistence: false,
  ownsReplayOrRecoveryCheckpoints: false,
});

export {
  COMPETITION_VERSION_STATE,
  COMPETITION_VERSION_STATE_VALUES,
  isCompetitionVersionState,
  COMPETITION_VERSION_INITIAL_NUMBER,
  isValidCompetitionVersionNumber,
  nextCompetitionVersionNumber,
  COMPETITION_VERSION_CHANGE_TYPE,
  COMPETITION_VERSION_CHANGE_TYPE_VALUES,
  isCompetitionVersionChangeType,
  COMPETITION_VERSION_FINGERPRINT_ALGORITHM,
  COMPETITION_VERSION_IMMUTABLE_DEFINITION_FIELDS,
} from "./constants/index.js";

export {
  COMPETITION_VERSION_ERROR_CODE,
  CompetitionVersionError,
  isCompetitionVersionError,
  isCompetitionVersionErrorCode,
} from "./errors/index.js";

export {
  failContract,
  isNonEmptyString,
  isPositiveInteger,
  isValidTimestamp,
  deepFreeze,
  clonePlain,
  compareFieldPath,
  canonicalizeJson,
  stableContentFingerprint,
  createFieldError,
  sortFieldErrors,
  buildExplanation,
  validationOk,
  validationFail,
  isValidationOk,
  isValidationFail,
  snapshotInput,
  createCompetitionVersionId,
  parseCompetitionVersionId,
  createIdempotencyStorageKey,
  isRootVersionNumber,
  buildVersionContentFromDefinition,
  buildFingerprintPayload,
  computeVersionContentFingerprint,
  parseOptionalTemplateVersioned,
  assembleCompetitionVersion,
  isCompetitionVersion,
  collectDefinitionScopeErrors,
} from "./contracts/index.js";

export {
  createCompetitionVersion,
  getCompetitionVersion,
  listCompetitionVersions,
  compareCompetitionVersionsCommand,
  createCompetitionRestoreProposalCommand,
  createCapabilityLocalVersionRepository,
  compareCompetitionVersions,
  createCompetitionRestoreProposal,
} from "./application/index.js";

export {
  createVersionDifference,
  sortVersionDifferences,
} from "./comparison/index.js";

export {
  projectContentToDefinitionFields,
} from "./restore/index.js";

export {
  competitionScopeKey,
  createInMemoryCompetitionVersionRepository,
} from "./repository/index.js";

export {
  COMPETITION_VERSION_REPOSITORY_PORT_METHODS,
  throwVersionPortUnimplemented,
  createUnimplementedCompetitionVersionRepositoryPort,
  matchesCompetitionVersionRepositoryPort,
} from "./ports/index.js";

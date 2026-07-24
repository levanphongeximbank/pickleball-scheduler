/**
 * Competition Configuration — public facade (CM-04 Competition Configuration).
 *
 * Canonical Competition Management capability for management-level
 * configuration aggregates, section references, template-proposal application,
 * comparison, and snapshot projection.
 *
 * Does NOT export:
 * - SQL / migrations / Supabase clients
 * - production tournamentService wiring
 * - UI / routes / React hooks
 * - Competition Core engine execution (CORE-01..CORE-23)
 * - CM-01 CompetitionDefinition mutation
 * - CM-02 template selection/instantiation ownership
 * - CM-03 CompetitionVersion creation
 * - CM-05 branding / CM-06 publication / CM-07 suspension / CM-08 archive
 * - Finance / Notification / Venue inventory / Player / Club membership ownership
 */

export const COMPETITION_CONFIGURATION_PHASE = Object.freeze({
  id: "CM-04",
  name: "competition-configuration",
  wiredToProductionRuntime: false,
  hasPersistence: false,
  hasUi: false,
  hasMigration: false,
  migrationAuthored: false,
  migrationApplied: false,
  repositoryMode: "capability-local-in-memory",
  ownsPublicationStates: false,
  ownsBranding: false,
  ownsCompetitionCoreExecution: false,
});

export {
  COMPETITION_CONFIGURATION_STATUS,
  COMPETITION_CONFIGURATION_STATUS_VALUES,
  COMPETITION_CONFIGURATION_EDITABLE_STATUSES,
  isCompetitionConfigurationStatus,
  isConfigurationEditableStatus,
  COMPETITION_CONFIGURATION_INITIAL_REVISION,
  isValidCompetitionConfigurationRevision,
  nextCompetitionConfigurationRevision,
  COMPETITION_CONFIGURATION_PARTICIPANT_MODE,
  COMPETITION_CONFIGURATION_PARTICIPANT_MODE_VALUES,
  isCompetitionConfigurationParticipantMode,
  COMPETITION_CONFIGURATION_SECTION,
  COMPETITION_CONFIGURATION_SECTION_VALUES,
  COMPETITION_CONFIGURATION_TEAM_ONLY_SECTIONS,
  COMPETITION_CONFIGURATION_INDIVIDUAL_ONLY_SECTIONS,
  isCompetitionConfigurationSection,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER_VALUES,
  COMPETITION_CONFIGURATION_DEFERRED_CAPABILITY_OWNERS,
  isCompetitionConfigurationCapabilityOwner,
  COMPETITION_CONFIGURATION_OFFICIAL_MODE,
  COMPETITION_CONFIGURATION_OFFICIAL_MODE_VALUES,
  isCompetitionConfigurationOfficialMode,
  COMPETITION_CONFIGURATION_CHANGE_TYPE,
  COMPETITION_CONFIGURATION_CHANGE_TYPE_VALUES,
  isCompetitionConfigurationChangeType,
  COMPETITION_CONFIGURATION_FINGERPRINT_ALGORITHM,
} from "./constants/index.js";

export {
  COMPETITION_CONFIGURATION_ERROR_CODE,
  CompetitionConfigurationError,
  isCompetitionConfigurationError,
  isCompetitionConfigurationErrorCode,
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
  createFieldError,
  sortFieldErrors,
  buildExplanation,
  validationOk,
  validationFail,
  isValidationOk,
  isValidationFail,
  snapshotInput,
  createCompetitionConfigurationId,
  parseCompetitionConfigurationId,
  configurationScopeKey,
  parseCapabilityReference,
  parseConfigurationSection,
  parseConfigurationSections,
  collectDefinitionScopeErrors,
  collectCrossSectionErrors,
  validateCompetitionConfigurationInput,
  isCompetitionConfiguration,
  configurationsSemanticallyEqual,
  semanticConfigurationPayload,
} from "./contracts/index.js";

export {
  createDraftCompetitionConfiguration,
  updateDraftCompetitionConfiguration,
  applyTemplateConfigurationProposal,
  validateCompetitionConfigurationCommand,
  compareCompetitionConfigurationsCommand,
  projectCompetitionConfigurationSnapshotCommand,
  getCompetitionConfiguration,
  createCapabilityLocalConfigurationRepository,
} from "./application/index.js";

export {
  createConfigurationDifference,
  sortConfigurationDifferences,
  compareCompetitionConfigurations,
} from "./comparison/index.js";

export {
  projectCompetitionConfigurationSnapshot,
  isCompetitionConfigurationSnapshot,
} from "./snapshot/index.js";

export {
  CM04_TEMPLATE_PROPOSAL_PATHS,
  mapCm04OwnedPatchToSection,
  extractCm04ProposalFragments,
} from "./template-proposal/index.js";

export {
  createInMemoryCompetitionConfigurationRepository,
} from "./repository/index.js";

export {
  projectLegacyTournamentToConfigurationSections,
  isLegacyConfigurationProjectionResult,
  LEGACY_CONFIGURATION_COMPATIBILITY,
} from "./adapters/index.js";

export {
  COMPETITION_CONFIGURATION_REPOSITORY_PORT_METHODS,
  throwConfigurationPortUnimplemented,
  createUnimplementedCompetitionConfigurationRepositoryPort,
  matchesCompetitionConfigurationRepositoryPort,
} from "./ports/index.js";

/**
 * Template Selection & Instantiation — public facade (CM-02).
 *
 * Canonical Competition Management capability for discovering, selecting,
 * evaluating compatibility, and instantiating competition templates into
 * deterministic patch/proposal artifacts for a CM-01 CompetitionDefinition.
 *
 * Does NOT export:
 * - SQL / migrations / Supabase clients
 * - production tournamentService wiring
 * - UI / routes / React hooks
 * - Competition Core engine execution (CORE-01..CORE-23)
 * - CM-03 version history / CM-04 config editor / CM-05..CM-08 lifecycle
 * - Finance / Notification / Venue inventory / Player / Club membership ownership
 */

export const COMPETITION_TEMPLATE_INSTANTIATION_PHASE = Object.freeze({
  id: "CM-02",
  name: "template-instantiation",
  wiredToProductionRuntime: false,
  hasPersistence: false,
  hasUi: false,
  hasMigration: false,
  migrationAuthored: false,
  migrationApplied: false,
  catalogMode: "capability-local-static",
});

export {
  COMPETITION_TEMPLATE_SCOPE,
  COMPETITION_TEMPLATE_SCOPE_VALUES,
  isCompetitionTemplateScope,
  COMPETITION_TEMPLATE_AVAILABILITY,
  COMPETITION_TEMPLATE_AVAILABILITY_VALUES,
  isCompetitionTemplateAvailability,
  isTemplateSelectable,
  COMPETITION_TEMPLATE_PARTICIPANT_MODE,
  COMPETITION_TEMPLATE_PARTICIPANT_MODE_VALUES,
  isCompetitionTemplateParticipantMode,
  COMPETITION_TEMPLATE_OWNERSHIP_TARGET,
  COMPETITION_TEMPLATE_OWNERSHIP_TARGET_VALUES,
  isCompetitionTemplateOwnershipTarget,
  COMPETITION_TEMPLATE_COMPATIBILITY_STATUS,
  COMPETITION_TEMPLATE_ISSUE_SEVERITY,
  COMPETITION_TEMPLATE_INSTANTIATION_STATUS,
  COMPETITION_TEMPLATE_NAME_MAX_LENGTH,
  COMPETITION_TEMPLATE_DESCRIPTION_MAX_LENGTH,
  COMPETITION_TEMPLATE_INITIAL_VERSION,
} from "./constants/index.js";

export {
  COMPETITION_TEMPLATE_ERROR_CODE,
  CompetitionTemplateError,
  isCompetitionTemplateError,
  isCompetitionTemplateErrorCode,
} from "./errors/index.js";

export {
  failContract,
  isNonEmptyString,
  isPositiveInteger,
  deepFreeze,
  clonePlain,
  compareFieldPath,
  stableChecksum,
  createFieldError,
  sortFieldErrors,
  buildExplanation,
  validationOk,
  validationFail,
  isValidationOk,
  isValidationFail,
  snapshotInput,
  parseTemplateVersionedReference,
  toCm01TemplateReference,
  parseTemplateRequirements,
  parseTemplateDefaults,
  validateCompetitionTemplateDefinition,
  isCompetitionTemplateDefinition,
  createCompatibilityIssue,
  sortCompatibilityIssues,
  evaluateTemplateCompatibility,
  compatibilityErrorsAsFieldErrors,
  buildInstantiationPlan,
  projectDefinitionPatch,
  instantiateCompetitionTemplate,
} from "./contracts/index.js";

export {
  registerCompetitionTemplate,
  listAvailableCompetitionTemplates,
  getCompetitionTemplate,
  selectCompetitionTemplate,
  evaluateCompetitionTemplateCompatibilityCommand,
  instantiateCompetitionTemplateCommand,
  rejectImplicitTemplateSelection,
  createInMemoryTemplateCatalog,
} from "./application/index.js";

export {
  createStaticCatalogSeeds,
  LEGACY_MODE_TO_TEMPLATE_ID,
} from "./catalog/staticCatalog.js";

export {
  templateIdentityKey,
  createStaticCapabilityLocalCatalog,
  getDefaultCapabilityLocalCatalog,
  resetDefaultCapabilityLocalCatalog,
} from "./catalog/index.js";

export {
  projectLegacyPresetToCompetitionTemplateCandidate,
  isLegacyTemplateProjectionResult,
  LEGACY_TEMPLATE_COMPATIBILITY,
} from "./adapters/index.js";

export {
  COMPETITION_TEMPLATE_CATALOG_PORT_METHODS,
  throwCatalogPortUnimplemented,
  createUnimplementedCompetitionTemplateCatalogPort,
  matchesCompetitionTemplateCatalogPort,
} from "./ports/index.js";

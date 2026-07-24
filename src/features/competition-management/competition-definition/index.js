/**
 * Competition Definition — public facade (CM-01 Competition Definition).
 *
 * Canonical management-level source of truth for competition identity,
 * ownership, planning metadata, and draft definition.
 *
 * Does NOT export:
 * - SQL / migrations / Supabase clients
 * - production tournamentService wiring
 * - UI / routes / React hooks
 * - Competition Core engine surfaces (CORE-01..CORE-23)
 * - Finance / Notification / Venue inventory / Player / Club membership ownership
 */

export const COMPETITION_DEFINITION_PHASE = Object.freeze({
  id: "CM-01",
  name: "competition-definition",
  wiredToProductionRuntime: false,
  hasPersistence: false,
  hasUi: false,
  hasMigration: false,
  migrationAuthored: false,
  migrationApplied: false,
});

export {
  COMPETITION_TYPE,
  COMPETITION_TYPE_VALUES,
  isCompetitionType,
  COMPETITION_SCOPE,
  COMPETITION_SCOPE_VALUES,
  isCompetitionScope,
  COMPETITION_VISIBILITY,
  COMPETITION_VISIBILITY_VALUES,
  isCompetitionVisibility,
  COMPETITION_DEFINITION_STATUS,
  COMPETITION_DEFINITION_STATUS_VALUES,
  COMPETITION_DEFINITION_EDITABLE_STATUSES,
  isCompetitionDefinitionStatus,
  isDraftEditableStatus,
  COMPETITION_DEFINITION_INITIAL_REVISION,
  nextCompetitionDefinitionRevision,
  isValidCompetitionDefinitionRevision,
  COMPETITION_OWNER_TYPE,
  COMPETITION_OWNER_TYPE_VALUES,
  isCompetitionOwnerType,
  COMPETITION_DEFINITION_NAME_MAX_LENGTH,
  COMPETITION_DEFINITION_DESCRIPTION_MAX_LENGTH,
} from "./constants/index.js";

export {
  COMPETITION_DEFINITION_ERROR_CODE,
  CompetitionDefinitionError,
  isCompetitionDefinitionError,
  isCompetitionDefinitionErrorCode,
} from "./errors/index.js";

export {
  failContract,
  isNonEmptyString,
  isValidTimestamp,
  timestampSortValue,
  requireNonEmptyString,
  requireValidTimestamp,
  optionalNonEmptyString,
  deepFreeze,
  clonePlain,
  compareFieldPath,
  requireOpaqueId,
  createCompetitionDefinitionId,
  createTenantId,
  normalizeIdentifier,
  createFieldError,
  sortFieldErrors,
  buildExplanation,
  validationOk,
  validationFail,
  isValidationOk,
  isValidationFail,
  snapshotInput,
  parseOwnerReference,
  parseVenueReference,
  parseClubReference,
  parseTemplateReference,
  parseRuleSetReference,
  parseRegistrationWindow,
  parsePlannedPeriod,
  validateRegistrationAgainstPlannedPeriod,
  validateCompetitionDefinitionInput,
  collectScopeAssociationErrors,
  isCompetitionDefinition,
} from "./contracts/index.js";

export {
  createDraftCompetitionDefinition,
  updateDraftCompetitionDefinition,
  assertSameTenantDefinition,
} from "./application/index.js";

export {
  projectLegacyTournamentToCompetitionDefinition,
  isLegacyProjectionResult,
  LEGACY_TOURNAMENT_COMPATIBILITY,
} from "./adapters/index.js";

export {
  COMPETITION_DEFINITION_REPOSITORY_PORT_METHODS,
  throwPortUnimplemented,
  createUnimplementedCompetitionDefinitionRepositoryPort,
  matchesCompetitionDefinitionRepositoryPort,
} from "./ports/index.js";

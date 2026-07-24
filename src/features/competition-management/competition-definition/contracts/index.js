/**
 * CM-01 contract public surface.
 */

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
} from "./shared.js";

export {
  requireOpaqueId,
  createCompetitionDefinitionId,
  createTenantId,
  normalizeIdentifier,
} from "./identifiers.js";

export {
  createFieldError,
  sortFieldErrors,
  buildExplanation,
  validationOk,
  validationFail,
  isValidationOk,
  isValidationFail,
  snapshotInput,
} from "./validation.js";

export {
  parseOwnerReference,
  parseVenueReference,
  parseClubReference,
  parseTemplateReference,
  parseRuleSetReference,
} from "./references.js";

export {
  parseRegistrationWindow,
  parsePlannedPeriod,
  validateRegistrationAgainstPlannedPeriod,
} from "./periods.js";

export {
  validateCompetitionDefinitionInput,
  collectScopeAssociationErrors,
  isCompetitionDefinition,
} from "./definition.js";

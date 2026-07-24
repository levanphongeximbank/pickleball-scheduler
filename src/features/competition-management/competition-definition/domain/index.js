/**
 * Domain validators / pure helpers for Competition Definition (CM-01).
 */

export {
  validateCompetitionDefinitionInput,
  collectScopeAssociationErrors,
  isCompetitionDefinition,
} from "../contracts/definition.js";

export {
  parseRegistrationWindow,
  parsePlannedPeriod,
  validateRegistrationAgainstPlannedPeriod,
} from "../contracts/periods.js";

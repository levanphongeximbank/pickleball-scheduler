/**
 * Core-04 Classification — local public surface.
 *
 * Capability-local index only. Do NOT re-export from competition-core/index.js
 * in this branch (Integrator owns protected barrels).
 */

export { CLASSIFICATION_SCHEMA_VERSION } from "./contracts/shared.js";
export {
  createAuditMetadata,
  createFormatExtension,
  isNonEmptyString,
  isJsonSafe,
  cloneJsonSafe,
} from "./contracts/shared.js";

export {
  createEligibilityDescriptor,
  createAgeBandDescriptor,
  createRatingBandDescriptor,
  createSkillBandDescriptor,
} from "./contracts/eligibility.js";

export {
  createDivisionCategoryCapacity,
  createRecommendedCapacity,
  createPoolSizeMetadata,
} from "./contracts/capacity.js";

export {
  DEFINITION_STATUS,
  DEFINITION_STATUS_VALUES,
  isDefinitionStatus,
  DIVISION_CATEGORY_LIFECYCLE,
  DIVISION_CATEGORY_LIFECYCLE_VALUES,
  DIVISION_CATEGORY_ALLOWED_TRANSITIONS,
  isDivisionCategoryLifecycle,
  GENDER_CLASS,
  GENDER_CLASS_VALUES,
  isGenderClass,
  ACCESS_MODE,
  ACCESS_MODE_VALUES,
  isAccessMode,
  createApplicability,
  CLASSIFICATION_ENTITY_KIND,
  CLASSIFICATION_ENTITY_KIND_VALUES,
  isClassificationEntityKind,
} from "./enums/index.js";

export {
  CLASSIFICATION_ERROR_CODE,
  classificationError,
  classificationWarning,
  classificationOk,
  classificationFail,
} from "./errors/index.js";

export {
  normalizeClassificationCode,
  buildCategoryKey,
  buildDivisionKey,
  buildDivisionCategoryKey,
} from "./keys/index.js";

export { createCompetitionCategory } from "./categories/index.js";
export { createCompetitionDivision } from "./divisions/index.js";
export {
  createCompetitionDivisionCategory,
  gateDivisionCategoryRegistration,
} from "./division-categories/index.js";

export {
  validateCompetitionCategory,
  validateCompetitionDivision,
  validateCompetitionDivisionCategory,
  assertDivisionAndCategoryAreSeparate,
  assertUniqueCategoryCodes,
  assertUniqueDivisionCodes,
  assertUniqueDivisionCategoryPairs,
  assertDivisionCategoryReferences,
  assertCanHardDelete,
  assertNotArchivedReadOnly,
  assertNoSilentEntryMigration,
  validateDefinitionTransition,
  validateDivisionCategoryTransition,
  evaluateOpenToDraftReferenceCheck,
  applyDivisionCategoryTransition,
  assertRegistrationAccepted,
  assertDivisionCategoryMutable,
  validateDivisionCategoryCapacity,
  enforceDivisionCategoryCapacity,
  sortClassificationList,
  DEFINITION_ALLOWED_TRANSITIONS,
} from "./validators/index.js";

export {
  mapEventTypeToCategory,
  LEGACY_EVENT_TYPE,
  mapGroupToDivision,
  mapTtDisciplineToCategory,
  mapTtTeamGroupToDivision,
} from "./mappers/index.js";

export {
  ELIGIBILITY_EVALUATION_PORT_METHODS,
  isEligibilityEvaluationPort,
  requestEligibilityEvaluation,
  mapEligibilityPortResult,
  CATEGORY_REPOSITORY_PORT_METHODS,
  DIVISION_REPOSITORY_PORT_METHODS,
  DIVISION_CATEGORY_REPOSITORY_PORT_METHODS,
  REFERENCE_CHECKER_PORT_METHODS,
} from "./ports/index.js";

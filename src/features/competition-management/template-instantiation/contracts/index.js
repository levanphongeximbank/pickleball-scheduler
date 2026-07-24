export {
  failContract,
  isNonEmptyString,
  isPositiveInteger,
  deepFreeze,
  clonePlain,
  compareFieldPath,
  stableChecksum,
  requireNonEmptyString,
} from "./shared.js";

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
  parseTemplateVersionedReference,
  toCm01TemplateReference,
} from "./references.js";

export {
  parseTemplateRequirements,
  parseTemplateDefaults,
  validateCompetitionTemplateDefinition,
  isCompetitionTemplateDefinition,
} from "./templateDefinition.js";

export {
  createCompatibilityIssue,
  sortCompatibilityIssues,
  evaluateTemplateCompatibility,
  compatibilityErrorsAsFieldErrors,
} from "./compatibility.js";

export {
  buildInstantiationPlan,
  projectDefinitionPatch,
  instantiateCompetitionTemplate,
} from "./instantiation.js";

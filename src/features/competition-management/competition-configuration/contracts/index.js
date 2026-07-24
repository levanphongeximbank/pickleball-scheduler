export {
  failContract,
  isNonEmptyString,
  isPositiveInteger,
  deepFreeze,
  clonePlain,
  compareFieldPath,
  canonicalizeJson,
  stableContentFingerprint,
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
  createCompetitionConfigurationId,
  parseCompetitionConfigurationId,
  configurationScopeKey,
} from "./identity.js";

export {
  parseCapabilityReference,
  parseConfigurationSection,
  parseConfigurationSections,
} from "./sections.js";

export {
  collectDefinitionScopeErrors,
  collectCrossSectionErrors,
  validateCompetitionConfigurationInput,
  isCompetitionConfiguration,
  configurationsSemanticallyEqual,
  semanticConfigurationPayload,
} from "./configuration.js";

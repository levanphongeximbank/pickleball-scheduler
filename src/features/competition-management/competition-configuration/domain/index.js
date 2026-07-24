/**
 * Domain re-exports for CM-04 (pure validators / helpers).
 */

export {
  validateCompetitionConfigurationInput,
  collectCrossSectionErrors,
  collectDefinitionScopeErrors,
  isCompetitionConfiguration,
  semanticConfigurationPayload,
} from "../contracts/configuration.js";

export {
  parseConfigurationSections,
  parseCapabilityReference,
} from "../contracts/sections.js";

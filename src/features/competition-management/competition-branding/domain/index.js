/**
 * Domain re-exports for Competition Branding (CM-05).
 */

export {
  validateCompetitionBrandingInput,
  isCompetitionBranding,
  brandingsSemanticallyEqual,
  semanticBrandingPayload,
  collectDefinitionScopeErrors,
} from "../contracts/branding.js";

export {
  normalizeBrandColor,
  isValidBrandColor,
  parseBrandPalette,
} from "../contracts/colors.js";

export {
  parseBrandAssets,
  parseBrandAssetReference,
} from "../contracts/assets.js";

export {
  evaluateBrandingAccessibility,
  contrastRatio,
  relativeLuminance,
} from "../accessibility/index.js";

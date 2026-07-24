export {
  failContract,
  isNonEmptyString,
  isPositiveInteger,
  deepFreeze,
  clonePlain,
  compareFieldPath,
  canonicalizeJson,
  stableContentFingerprint,
  hasControlCharacters,
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
  createCompetitionBrandingId,
  parseCompetitionBrandingId,
  brandingScopeKey,
} from "./identity.js";

export {
  normalizeBrandColor,
  isValidBrandColor,
  parseBrandColor,
  parseBrandPalette,
  isBrandPalette,
} from "./colors.js";

export {
  isSignedOrTokenizedUri,
  collectUnsafeUriErrors,
  parseBrandAssetReference,
  parseBrandAssets,
} from "./assets.js";

export {
  parseTypographyReference,
} from "./presentation.js";

export {
  parsePresentationMetadata,
} from "./presentationMetadata.js";

export {
  collectDefinitionScopeErrors,
  validateCompetitionBrandingInput,
  isCompetitionBranding,
  brandingsSemanticallyEqual,
  semanticBrandingPayload,
} from "./branding.js";

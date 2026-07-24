/**
 * Competition Branding — public facade (CM-05 Competition Branding).
 *
 * Canonical Competition Management capability for competition-level
 * visual identity metadata, asset references, palette/typography,
 * presentation metadata, accessibility baseline, readiness, comparison,
 * and snapshot projection.
 *
 * Does NOT export:
 * - SQL / migrations / Supabase clients
 * - production tournamentService wiring
 * - UI / routes / React hooks / MUI theme application
 * - file upload / storage / CDN
 * - Competition Core engine execution (CORE-01..CORE-23)
 * - CM-01 CompetitionDefinition mutation / canonical name-description
 * - CM-02 template selection/instantiation ownership
 * - CM-03 CompetitionVersion creation
 * - CM-04 CompetitionConfiguration mutation
 * - CM-06 publication / CM-07 suspension / CM-08 archive
 * - platform / tenant / venue / club branding ownership
 * - Finance / Notification ownership
 */

export const COMPETITION_BRANDING_PHASE = Object.freeze({
  id: "CM-05",
  name: "competition-branding",
  wiredToProductionRuntime: false,
  hasPersistence: false,
  hasUi: false,
  hasMigration: false,
  migrationAuthored: false,
  migrationApplied: false,
  repositoryMode: "capability-local-in-memory",
  ownsPublicationStates: false,
  ownsBranding: true,
  ownsCanonicalNameDescription: false,
  ownsConfiguration: false,
  ownsCompetitionCoreExecution: false,
  ownsUploadStorage: false,
  sponsorMarksDeferred: true,
});

export {
  COMPETITION_BRANDING_STATUS,
  COMPETITION_BRANDING_STATUS_VALUES,
  COMPETITION_BRANDING_EDITABLE_STATUSES,
  isCompetitionBrandingStatus,
  isBrandingEditableStatus,
  COMPETITION_BRANDING_INITIAL_REVISION,
  isValidCompetitionBrandingRevision,
  nextCompetitionBrandingRevision,
  COMPETITION_BRAND_ASSET_KIND,
  COMPETITION_BRAND_ASSET_KIND_VALUES,
  COMPETITION_BRAND_ASSET_KINDS_REQUIRING_ALT,
  COMPETITION_BRAND_ASSET_ACCESS,
  COMPETITION_BRAND_ASSET_ACCESS_VALUES,
  isCompetitionBrandAssetKind,
  isCompetitionBrandAssetAccess,
  COMPETITION_BRAND_COLOR_FORMAT,
  COMPETITION_BRAND_PALETTE_REQUIRED_KEYS,
  COMPETITION_BRAND_PALETTE_OPTIONAL_KEYS,
  COMPETITION_BRAND_PALETTE_ALLOWED_KEYS,
  COMPETITION_BRAND_SHORT_LABEL_MAX_LENGTH,
  COMPETITION_BRAND_TAGLINE_MAX_LENGTH,
  COMPETITION_BRAND_ALT_TEXT_MAX_LENGTH,
  COMPETITION_BRAND_TYPOGRAPHY_TOKEN_MAX_LENGTH,
  COMPETITION_BRAND_LOCKUP_VARIANT,
  COMPETITION_BRAND_LOCKUP_VARIANT_VALUES,
  COMPETITION_BRAND_THEME_MODE,
  COMPETITION_BRAND_THEME_MODE_VALUES,
  isCompetitionBrandLockupVariant,
  isCompetitionBrandThemeMode,
  COMPETITION_BRANDING_CONTRAST_ALGORITHM,
  COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY,
  COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY_VALUES,
  COMPETITION_BRANDING_CHANGE_TYPE,
  COMPETITION_BRANDING_CHANGE_TYPE_VALUES,
  isCompetitionBrandingChangeType,
  COMPETITION_BRANDING_FINGERPRINT_ALGORITHM,
} from "./constants/index.js";

export {
  COMPETITION_BRANDING_ERROR_CODE,
  CompetitionBrandingError,
  isCompetitionBrandingError,
  isCompetitionBrandingErrorCode,
} from "./errors/index.js";

export {
  failContract,
  isNonEmptyString,
  isPositiveInteger,
  deepFreeze,
  clonePlain,
  compareFieldPath,
  canonicalizeJson,
  stableContentFingerprint,
  createFieldError,
  sortFieldErrors,
  buildExplanation,
  validationOk,
  validationFail,
  isValidationOk,
  isValidationFail,
  snapshotInput,
  createCompetitionBrandingId,
  parseCompetitionBrandingId,
  brandingScopeKey,
  normalizeBrandColor,
  isValidBrandColor,
  parseBrandColor,
  parseBrandPalette,
  isBrandPalette,
  isSignedOrTokenizedUri,
  collectUnsafeUriErrors,
  parseBrandAssetReference,
  parseBrandAssets,
  parseTypographyReference,
  parsePresentationMetadata,
  collectDefinitionScopeErrors,
  validateCompetitionBrandingInput,
  isCompetitionBranding,
  brandingsSemanticallyEqual,
  semanticBrandingPayload,
} from "./contracts/index.js";

export {
  createDraftCompetitionBranding,
  updateDraftCompetitionBranding,
  validateCompetitionBrandingCommand,
  compareCompetitionBrandingsCommand,
  projectCompetitionBrandingSnapshotCommand,
  evaluateCompetitionBrandingReadinessCommand,
  getCompetitionBranding,
  createCapabilityLocalBrandingRepository,
} from "./application/index.js";

export {
  createBrandingDifference,
  sortBrandingDifferences,
  compareCompetitionBrandings,
} from "./comparison/index.js";

export {
  projectCompetitionBrandingSnapshot,
  isCompetitionBrandingSnapshot,
} from "./snapshot/index.js";

export {
  evaluateCompetitionBrandingReadiness,
} from "./readiness/index.js";

export {
  evaluateBrandingAccessibility,
  accessibilityIssuesToFieldErrors,
  contrastRatio,
  relativeLuminance,
} from "./accessibility/index.js";

export {
  createInMemoryCompetitionBrandingRepository,
} from "./repository/index.js";

export {
  projectLegacyTournamentToBranding,
  isLegacyBrandingProjectionResult,
  LEGACY_BRANDING_COMPATIBILITY,
} from "./adapters/index.js";

export {
  COMPETITION_BRANDING_REPOSITORY_PORT_METHODS,
  throwBrandingPortUnimplemented,
  createUnimplementedCompetitionBrandingRepositoryPort,
  matchesCompetitionBrandingRepositoryPort,
} from "./ports/index.js";

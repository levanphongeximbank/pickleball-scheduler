/**
 * CM-06 contract public surface.
 */

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
  createCompetitionPublicationId,
  parseCompetitionPublicationId,
  publicationScopeKey,
  createIdempotencyStorageKey,
  publicReferenceKey,
} from "./identity.js";

export {
  PUBLIC_REFERENCE_SLUG_PATTERN,
  validateSlug,
  parseRequestedPublicReference,
} from "./slug.js";

export {
  buildSourceReferences,
  isCompetitionPublicationSourceReferences,
  cloneSourceReferences,
} from "./source.js";

export {
  EXTERNAL_LIFECYCLE_BLOCKED_STATUSES,
  collectProfileErrors,
  collectChannelErrors,
  collectVersionSourceErrors,
  collectDefinitionMatchErrors,
  collectConfigurationErrors,
  collectBrandingErrors,
  collectChannelVisibilityErrors,
  collectExternalLifecycleBlockErrors,
  buildCompetitionPublicationRecord,
  isCompetitionPublication,
  computePublicationRequestFingerprint,
} from "./publication.js";

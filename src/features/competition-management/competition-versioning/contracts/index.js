/**
 * CM-03 contract public surface.
 */

export {
  failContract,
  isNonEmptyString,
  isPositiveInteger,
  isValidTimestamp,
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
  createCompetitionVersionId,
  parseCompetitionVersionId,
  createIdempotencyStorageKey,
  isRootVersionNumber,
} from "./identity.js";

export {
  buildVersionContentFromDefinition,
  buildFingerprintPayload,
  computeVersionContentFingerprint,
  parseOptionalTemplateVersioned,
  assembleCompetitionVersion,
  isCompetitionVersion,
  collectDefinitionScopeErrors,
} from "./snapshot.js";

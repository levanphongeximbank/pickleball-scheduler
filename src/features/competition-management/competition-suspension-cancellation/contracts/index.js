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
  looksLikeHtmlOrScript,
  requireNonEmptyString,
  resolveEffectiveAt,
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
  createCompetitionLifecycleRecordId,
  parseCompetitionLifecycleRecordId,
  lifecycleScopeKey,
  createLifecycleIdempotencyStorageKey,
} from "./identity.js";

export {
  collectActorErrors,
  collectAuthorityErrors,
} from "./actor.js";

export {
  collectReasonErrors,
} from "./reason.js";

export {
  collectDefinitionContextErrors,
  collectPublicationContextErrors,
  collectPublicationPolicyErrors,
  collectOptionalVersionContextErrors,
  collectExpectedLifecycleRevisionErrors,
  buildSourceProvenance,
} from "./source.js";

export {
  projectCompetitionLifecycleState,
  projectCurrentLifecycleRevision,
  computeLifecycleRequestFingerprint,
  computeLifecycleRecordFingerprint,
  buildCompetitionLifecycleRecord,
  isCompetitionLifecycleRecord,
  resolveTransition,
} from "./lifecycle.js";

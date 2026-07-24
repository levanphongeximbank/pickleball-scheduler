/**
 * Domain re-exports for Competition Publication (CM-06).
 */

export {
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
  EXTERNAL_LIFECYCLE_BLOCKED_STATUSES,
} from "../contracts/publication.js";

export {
  buildSourceReferences,
  isCompetitionPublicationSourceReferences,
} from "../contracts/source.js";

export {
  validateSlug,
  parseRequestedPublicReference,
} from "../contracts/slug.js";

export {
  getCompetitionPublicationProfile,
  isKnownCompetitionPublicationProfileId,
  CM06_STANDARD_V1_PROFILE,
} from "../profiles/index.js";

export {
  getCompetitionPublicationChannelDescriptor,
  isVisibilityAllowedForChannel,
} from "../channels/registry.js";

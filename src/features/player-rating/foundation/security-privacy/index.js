/**
 * Player Rating Foundation — Phase 1I security, privacy, and boundary hardening.
 */

export {
  PLAYER_RATING_PRIVACY_PROJECTION_LEVEL,
  PLAYER_RATING_READ_CAPABILITY,
  PLAYER_RATING_SECURITY_PRIVACY_PHASE,
  isSupportedPrivacyProjectionLevel,
  requiredCapabilityForProjectionLevel,
} from "./privacyProjectionLevels.js";

export {
  PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE,
  failSecurityPrivacy,
  sanitizeSecurityErrorDetails,
} from "./securityPrivacyErrors.js";

export {
  DEFAULT_PUBLIC_WARNING_ALLOWLIST,
  ALWAYS_EXCLUDED_PROFILE_KEYS,
  createPlayerRatingPrivacyPolicy,
} from "./createPlayerRatingPrivacyPolicy.js";

export { validatePlayerRatingScopeAccess } from "./validatePlayerRatingScopeAccess.js";
export { authorizePlayerRatingRead } from "./authorizePlayerRatingRead.js";
export {
  redactPlayerRatingCandidate,
  stripExcludedKeys,
} from "./redactPlayerRatingCandidate.js";
export { redactPlayerRatingOverview } from "./redactPlayerRatingOverview.js";
export { projectPublicPlayerRating } from "./projectPublicPlayerRating.js";
export { projectRestrictedPlayerRating } from "./projectRestrictedPlayerRating.js";
export { createSecurePlayerRatingReadFacade } from "./createSecurePlayerRatingReadFacade.js";

/**
 * Player Rating Foundation — Phase 1C current-state read model.
 * Read-only normalization / candidate collection. Not wired to Production runtime.
 */

export {
  PLAYER_RATING_SOURCE_TYPE,
  PLAYER_RATING_SOURCE_SCALE,
  PLAYER_ID_RESOLUTION_STATUS,
  CONFIDENCE_SCALE,
  NORMALIZABLE_SOURCE_TYPES,
  NON_AUTHORITATIVE_SOURCE_TYPES,
  isKnownPlayerRatingSourceType,
  isNormalizableSourceType,
  isNonAuthoritativeSourceType,
} from "./sourceTypes.js";

export {
  PLAYER_RATING_READ_MODEL_ERROR_CODE,
  PLAYER_RATING_READ_MODEL_REUSED_ERROR_CODE,
  failReadModel,
  isPlayerRatingReadModelErrorCode,
} from "./ratingReadModelErrors.js";

export {
  buildCandidateId,
  candidateSortKey,
  sortCandidatesDeterministically,
  createCurrentStateCandidate,
  optionalFiniteNumber,
  optionalNonEmptyString,
  optionalTimestamp,
} from "./currentStateCandidate.js";

export { normalizeV2Rating } from "./normalizeV2Rating.js";
export { normalizeV5Rating } from "./normalizeV5Rating.js";
export { normalizeLegacyRating } from "./normalizeLegacyRating.js";
export { collectRatingCandidates } from "./collectRatingCandidates.js";

export const PLAYER_RATING_CURRENT_STATE_READ_MODEL_PHASE = Object.freeze({
  id: "1C",
  name: "canonical-current-state-read-model",
  wiredToProductionRuntime: false,
  selectsRuntimeSsot: false,
  convertsScales: false,
});

/**
 * EC-03 Public Portal data-source honesty — façade.
 */

export {
  PUBLIC_DATA_RESULT_STATUS,
  PUBLIC_DATA_RESULT_STATUS_VALUES,
  isPublicDataResultStatus,
  PUBLIC_DATA_FALLBACK_REASON,
  PUBLIC_DATA_FALLBACK_REASON_VALUES,
  isPublicDataFallbackReason,
} from "./constants.js";

export {
  sanitizePublicDataErrorMessage,
  normalizePublicDataError,
  createLiveResult,
  createMockResult,
  createPreviewResult,
  createMixedResult,
  createEmptyResult,
  createErrorResult,
  createUnavailableResult,
} from "./publicDataResult.js";

export { certifyPublicDataResult } from "./certifyPublicDataResult.js";
export { resolvePublicListDataResult } from "./resolvePublicListDataResult.js";

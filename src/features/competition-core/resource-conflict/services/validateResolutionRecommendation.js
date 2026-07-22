/**
 * CORE-14 Phase 1E — validateResolutionRecommendation service entry.
 * Re-exports the pure validator; kept as a service for capability symmetry.
 */

export {
  validateResolutionRecommendation,
  RESOLUTION_VALIDATION_STATUS,
  RESOLUTION_VALIDATION_STATUS_VALUES,
} from "../resolution/validateRecommendation.js";

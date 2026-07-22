/**
 * CORE-14 Phase 1D/1E — services barrel.
 */

export {
  detectResourceConflicts,
  deriveResultStatuses,
} from "./detectResourceConflicts.js";

export { proposeResourceConflictResolutions } from "./proposeResourceConflictResolutions.js";

export {
  validateResolutionRecommendation,
  RESOLUTION_VALIDATION_STATUS,
  RESOLUTION_VALIDATION_STATUS_VALUES,
} from "./validateResolutionRecommendation.js";

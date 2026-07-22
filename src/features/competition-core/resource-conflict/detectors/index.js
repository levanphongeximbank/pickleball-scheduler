/**
 * CORE-14 Phase 1D — detector barrel.
 */

export { detectTimeOverlaps } from "./detectTimeOverlaps.js";
export { detectCapacityExceeded } from "./detectCapacityExceeded.js";
export { detectRestViolations } from "./detectRestViolations.js";
export {
  detectAvailabilityFindings,
  materializeAvailabilityFactsFromPort,
} from "./detectAvailabilityFindings.js";
export {
  suppressDuplicateRootCauses,
  DUPLICATE_SUPPRESSION_RULES,
} from "./suppressDuplicateRootCauses.js";

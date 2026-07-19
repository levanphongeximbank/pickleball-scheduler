/**
 * Phase 3H — validateSeedAssignments re-export surface.
 * Join/merge logic lives in validateCandidates.js (mergeCandidatesAndSeeds).
 */

export {
  mergeCandidatesAndSeeds,
} from "./validateCandidates.js";

export {
  validateCandidates,
  validateGroupParams,
  validateBracketParams,
  validateManualAndProtected,
  isPowerOfTwo,
} from "./validateParams.js";

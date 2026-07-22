/**
 * CORE-14 Phase 1E — resolution barrel (capability-local).
 */

export {
  RESOLUTION_ACTION_TYPE,
  RESOLUTION_ACTION_TYPE_VALUES,
  RESOLUTION_ACTION_TYPE_ORDINAL,
  NON_MUTATING_ACTION_TYPES,
  isResolutionActionType,
  isNonMutatingActionType,
  getActionTypeOrdinal,
} from "./actionTypes.js";

export {
  CONFLICT_ACTION_MAPPING_VERSION,
  CONFLICT_TO_ACTIONS,
  getBasePermittedActions,
  getPermittedActionsForFinding,
  isActionPermittedForFinding,
} from "./conflictActionMapping.js";

export {
  RESOLUTION_POLICY_VERSION,
  normalizeResolutionPolicy,
  createResolutionPolicy,
  cloneResourceKey,
} from "./resolutionPolicy.js";

export {
  buildMoveAssignmentTimeDelta,
  buildReassignCourtDelta,
  buildReassignRefereeDelta,
  buildInsertRestGapDelta,
  buildReduceCapacityUsageDelta,
  buildManualReviewDelta,
  buildNoSafeAutomaticResolutionDelta,
  canonicalizeProposedChanges,
} from "./buildStructuredDelta.js";

export {
  RESOLUTION_RECOMMENDATION_VERSION,
  CORE14_RID_V1,
  createRecommendationId,
  createResolutionRecommendation,
  recommendationContractIdentity,
  resourceKeyIdentity,
} from "./buildRecommendations.js";

export {
  ROOT_CONFLICT_CONTINUITY_VERSION,
  CORE14_RCK_V1,
  createRootConflictContinuityKey,
  collectLogicalIdentityTokens,
  compareFindingsWithContinuity,
} from "./rootConflictContinuityKey.js";

export {
  projectRecommendation,
  indexOccupanciesById,
  sameResourceScope,
  resourceKeySerialized,
  sortOccupanciesById,
} from "./projectRecommendation.js";

export {
  RESOLUTION_VALIDATION_STATUS,
  RESOLUTION_VALIDATION_STATUS_VALUES,
  validateResolutionRecommendation,
} from "./validateRecommendation.js";

export {
  compareRecommendations,
  rankRecommendations,
} from "./rankRecommendations.js";

export {
  RESOLUTION_RECOMMENDATION_RESULT_VERSION,
  createRecommendationResult,
} from "./recommendationResult.js";

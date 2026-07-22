/**
 * CORE-14 Resource Conflict Resolver — capability-local public surface.
 * Phase 1C: dormant domain foundation.
 * Phase 1D: dormant conflict detectors (unwired).
 * Phase 1E: dormant resolution recommendations + dry-run validation (unwired).
 * Phase 1F: dormant adapters, projectors, legacy mapping, shadow parity (unwired).
 *
 * Integrator owns the competition-core root barrel — do not edit that here.
 * No production wiring. No imports from unfinished CORE-10/11/12/13.
 */

export {
  CORE14_ENGINE_ID,
  CORE14_ENGINE_VERSION,
  CORE14_SCHEMA_VERSION,
  CORE14_CRK_V1,
  CORE14_LAK_V1,
  CORE14_OIK_V1,
  CORE14_FP_V1,
  CORE14_FID_V1,
  CORE14_ADAPTER_CONTRACT_V1,
  CORE14_OID_V1,
  CORE14_ADAPTER_RESULT_V1,
  CORE14_SHADOW_PARITY_V1,
  CORE14_LEGACY_MAP_V1,
  CORE14_PROJECTOR_CONTRACT_V1,
  CORE14_IDENTITY,
} from "./constants/index.js";

export {
  RESOURCE_KIND,
  RESOURCE_KIND_VALUES,
  isResourceKind,
  resolveResourceKind,
  SCOPE_TYPE,
  SCOPE_TYPE_VALUES,
  isScopeType,
  resolveScopeType,
  OCCUPANCY_SOURCE,
  OCCUPANCY_SOURCE_VALUES,
  isOccupancySource,
  isWellKnownOccupancySource,
  resolveOccupancySource,
  DOMAIN_CONTRACT_ERROR_CODE,
  DOMAIN_CONTRACT_ERROR_CODE_VALUES,
  isDomainContractErrorCode,
  ACTIVITY_IDENTITY_TYPE,
  ACTIVITY_IDENTITY_TYPE_VALUES,
  isActivityIdentityType,
  RESOURCE_FINDING_CODE,
  RESOURCE_FINDING_CODE_VALUES,
  isResourceFindingCode,
  INPUT_DIAGNOSTIC_CODE,
  INPUT_DIAGNOSTIC_CODE_VALUES,
  isInputDiagnosticCode,
  SEVERITY,
  SEVERITY_VALUES,
  SEVERITY_RANK,
  isSeverity,
  maxSeverity,
  EVALUATION_STATUS,
  EVALUATION_STATUS_VALUES,
  isEvaluationStatus,
  PLAN_STATUS,
  PLAN_STATUS_VALUES,
  isPlanStatus,
  AVAILABILITY_CERTIFICATION,
  AVAILABILITY_CERTIFICATION_VALUES,
  isAvailabilityCertification,
  AVAILABILITY_MODE,
  AVAILABILITY_MODE_VALUES,
  isAvailabilityMode,
} from "./enums/index.js";

export {
  ResourceConflictContractError,
  isResourceConflictContractError,
} from "./errors/index.js";

export {
  isSafeEpochMs,
  validateHalfOpenInterval,
  intervalsOverlap,
  intervalIntersection,
  compareIntervals,
} from "./time/index.js";

export {
  escapeCore14Token,
  utf8Bytes,
  compareUtf8Bytewise,
  compareIdentifier,
  sortIdentifiers,
  sortedObjectKeys,
  compareSafeInteger,
  hashUtf8Sha256Hex,
  isValidSha256Hex,
  isPlainObject,
  formatSafeIntegerDecimal,
  canonicalSerialize,
  canonicalSerializeIdentifierSet,
  deepFreezeClone,
  fingerprintCanonicalText,
  fingerprintValue,
  fingerprintCore14Material,
  createFindingId,
} from "./deterministic/index.js";

export {
  getMinimumSeverity,
  evaluateSeverityOverride,
  compareDiagnostics,
  compareFindings,
  HARD_MINIMUM_FINDING_CODES,
  FINDING_CATALOG,
  DIAGNOSTIC_CATALOG,
} from "./catalogs/index.js";

export {
  validateCanonicalResourceKey,
  createCanonicalResourceKey,
  serializeCanonicalResourceKey,
  validateEventScopeIdentity,
  compareCanonicalResourceKeys,
  validateResourceOccupancy,
  normalizeResourceOccupancy,
  createResourceOccupancy,
  createResourceOccupancyFromPartial,
  createOccupancyIndexKey,
  serializeOccupancyIndexKey,
  compareOccupancyIndexKeys,
  compareOccupancyIds,
  resolveActivityIdentity,
  createLogicalAssignmentKeyV1,
  serializeLogicalAssignmentKeyV1,
  logicalAssignmentKeyIdentity,
  compareLogicalAssignmentKeys,
  evaluateDuplicateIntegrity,
  createInputDiagnostic,
  createResourceFinding,
  createDetectionResult,
  createRejectedInvalidInputResult,
} from "./domain/index.js";

export {
  OVERLAP_POLICY_VERSION,
  SPECIALIZED_OVERLAP_KINDS,
  isSpecializedOverlapKind,
  resolveOverlapFindingCode,
  CAPACITY_POLICY_VERSION,
  DEFAULT_CAPACITY_ONE_KINDS,
  normalizeCapacityPolicy,
  resolveResourceCapacity,
  resolveCapacityFindingCode,
  REST_POLICY_VERSION,
  REST_MODE,
  REST_MODE_VALUES,
  isRestMode,
  DEFAULT_REST_RESOURCE_KINDS,
  normalizeRestPolicy,
  AVAILABILITY_POLICY_VERSION,
  AVAILABILITY_STATUS,
  AVAILABILITY_STATUS_VALUES,
  isAvailabilityStatus,
  resolveUnavailableFindingCode,
  resolveUnavailableSeverity,
  normalizeAvailabilityMode,
  deriveAvailabilityCertification,
} from "./policy/index.js";

export {
  detectTimeOverlaps,
  detectCapacityExceeded,
  detectRestViolations,
  detectAvailabilityFindings,
  materializeAvailabilityFactsFromPort,
  suppressDuplicateRootCauses,
  DUPLICATE_SUPPRESSION_RULES,
} from "./detectors/index.js";

export {
  detectResourceConflicts,
  deriveResultStatuses,
  proposeResourceConflictResolutions,
  validateResolutionRecommendation,
  RESOLUTION_VALIDATION_STATUS,
  RESOLUTION_VALIDATION_STATUS_VALUES,
} from "./services/index.js";

export {
  RESOLUTION_ACTION_TYPE,
  RESOLUTION_ACTION_TYPE_VALUES,
  RESOLUTION_ACTION_TYPE_ORDINAL,
  NON_MUTATING_ACTION_TYPES,
  isResolutionActionType,
  isNonMutatingActionType,
  getActionTypeOrdinal,
  CONFLICT_ACTION_MAPPING_VERSION,
  CONFLICT_TO_ACTIONS,
  getBasePermittedActions,
  getPermittedActionsForFinding,
  isActionPermittedForFinding,
  RESOLUTION_POLICY_VERSION,
  normalizeResolutionPolicy,
  createResolutionPolicy,
  buildMoveAssignmentTimeDelta,
  buildReassignCourtDelta,
  buildReassignRefereeDelta,
  buildInsertRestGapDelta,
  buildReduceCapacityUsageDelta,
  buildManualReviewDelta,
  buildNoSafeAutomaticResolutionDelta,
  canonicalizeProposedChanges,
  RESOLUTION_RECOMMENDATION_VERSION,
  CORE14_RID_V1,
  createRecommendationId,
  createResolutionRecommendation,
  recommendationContractIdentity,
  ROOT_CONFLICT_CONTINUITY_VERSION,
  CORE14_RCK_V1,
  createRootConflictContinuityKey,
  compareFindingsWithContinuity,
  projectRecommendation,
  compareRecommendations,
  rankRecommendations,
  RESOLUTION_RECOMMENDATION_RESULT_VERSION,
  createRecommendationResult,
} from "./resolution/index.js";

export {
  createAdapterOccupancyId,
  createAdapterResult,
  createRejectedAdapterResult,
  adaptScheduleAssignmentsToResourceOccupancies,
  adaptCourtAssignmentsToResourceOccupancies,
  adaptRefereeAssignmentsToResourceOccupancies,
  combineResourceOccupancies,
  adaptAvailabilityAnswersToFacts,
} from "./adapters/index.js";

export {
  projectConflictResultForOptimizer,
  projectConflictResultForSchedule,
  projectConflictResultForCourtAssignment,
  projectConflictResultForRefereeAssignment,
} from "./projectors/index.js";

export {
  LEGACY_CC09_CONFLICT_CODE,
  LEGACY_CC09_CONFLICT_CODE_VALUES,
  LEGACY_CC09_UNMAPPED_WORKFLOW_CODES,
  mapLegacyConflictCodeToCore14,
  mapCore14FindingCodeToLegacy,
  mapLegacyConflictsToCore14,
  projectCore14FindingsToLegacy,
} from "./legacy/index.js";

export {
  SHADOW_PARITY_CATEGORY,
  SHADOW_PARITY_CATEGORY_VALUES,
  compareLegacyAndCore14Conflicts,
} from "./shadow/index.js";

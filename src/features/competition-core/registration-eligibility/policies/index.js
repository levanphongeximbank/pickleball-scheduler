export {
  REGISTRATION_ALLOWED_TRANSITIONS,
  canTransitionRegistrationStatus,
  validateRegistrationTransition,
  applyRegistrationTransition,
} from "./registrationTransitions.js";

export {
  evaluateIdempotentSubmission,
  createIdempotencyRecordForRegistration,
  buildRegistrationIdempotencyKey,
} from "./idempotencyPolicy.js";

export {
  EVALUATION_IDEMPOTENCY_KEY_PREFIX,
  buildEvaluationIdempotencyKey,
  buildCanonicalEvaluationRequestFingerprint,
  serializeCanonicalEvaluationRequestFingerprint,
  canonicalEvaluationFingerprintsEqual,
  evaluateIdempotentEvaluation,
  createIdempotencyRecordForEvaluation,
} from "./evaluationIdempotencyPolicy.js";

export {
  ELIGIBILITY_EVALUATION_ELIGIBLE_STATUSES,
  ELIGIBILITY_CHECK_EXECUTION_ORDER,
  isRegistrationStatusEligibleForEvaluation,
  resolveRequiredCheckTypes,
  isOptionalEligibilityCheck,
  resolveEligibilityPolicyFromCompetitionPolicy,
  orderCheckTypesForExecution,
} from "./eligibilityEvaluationPolicy.js";

export {
  validateCapacityCounts,
  computeEffectiveRemaining,
  hasAvailableCapacity,
  normalizePriorityRank,
  buildCapacityScopeKey,
} from "./capacityAccounting.js";

export {
  compareWaitlistEntries,
  sortWaitlistEntries,
  calculateWaitlistPositions,
} from "./waitlistOrderingPolicy.js";

export {
  CAPACITY_IDEMPOTENCY_NAMESPACE,
  buildCapacityIdempotencyKey,
  buildCanonicalCapacityRequestFingerprint,
  serializeCanonicalCapacityRequestFingerprint,
  canonicalCapacityFingerprintsEqual,
  evaluateIdempotentCapacityRequest,
  createIdempotencyRecordForCapacity,
} from "./capacityIdempotencyPolicy.js";

export {
  CAPACITY_AUTH_PURPOSE,
  validateScopeBoundAuthorization,
  policyExplicitlyRequiresWaitlist,
  resolveWaitlistPlacementPermit,
  validatePromotionAuthorization,
} from "./capacityAuthorizationPolicy.js";

export {
  REGISTRATION_ELIGIBILITY_SCHEMA_VERSION,
  ELIGIBILITY_EVALUATOR_VERSION,
  REGISTRATION_LIFECYCLE_SERVICE_VERSION,
  createAuditMetadata,
  isNonEmptyString,
  requireNonEmptyString,
  cloneJsonSafe,
} from "./shared.js";

export {
  createRegistrationTarget,
  assertRegistrationTarget,
  buildRegistrationTargetStableIdentity,
  hasValidRegistrationTarget,
  isRegistrationTarget,
} from "./registrationTarget.js";

export { createRegistrationApplicant } from "./registrationApplicant.js";

export {
  createRegistrationDecision,
  mapDecisionTypeToStatus,
} from "./registrationDecision.js";

export {
  createEligibilityReason,
  orderEligibilityReasons,
  createEligibilityCheckResult,
  createEligibilityPolicy,
  createEligibilityEvaluationContext,
  createEligibilityDecision,
} from "./eligibility.js";

export {
  createCompetitionRegistration,
  buildCompetitionRegistrationIdentityKey,
} from "./competitionRegistration.js";

export {
  createRegistrationEvidence,
  createRegistrationAuditEvent,
} from "./registrationEvidence.js";

export {
  createRegistrationCapacitySnapshot,
  createRegistrationWaitlistPosition,
} from "./capacity.js";

export {
  buildRegistrationIdempotencyKey,
  createRegistrationIdempotencyRecord,
} from "./idempotency.js";

/**
 * Core-03 — Registration & Eligibility (Phase 1A foundation).
 *
 * Capability-local public surface ONLY.
 * Do NOT re-export from competition-core/index.js in this branch
 * (Integrator owns protected barrels).
 *
 * Does not own: Participant/Entry persistence (Core-02), Division/Category (Core-04),
 * Rule Engine implementation (Core-01), UI, SQL, or Production adapters.
 */

export {
  REGISTRATION_STATUS,
  REGISTRATION_STATUS_VALUES,
  TERMINAL_REGISTRATION_STATUSES,
  isRegistrationStatus,
  isTerminalRegistrationStatus,
  REGISTRATION_TARGET_TYPE,
  REGISTRATION_TARGET_TYPE_VALUES,
  isRegistrationTargetType,
  REGISTRATION_DECISION_TYPE,
  REGISTRATION_DECISION_TYPE_VALUES,
  isRegistrationDecisionType,
  ELIGIBILITY_OUTCOME,
  ELIGIBILITY_OUTCOME_VALUES,
  isEligibilityOutcome,
  ELIGIBILITY_CHECK_TYPE,
  ELIGIBILITY_CHECK_TYPE_VALUES,
  isEligibilityCheckType,
  ELIGIBILITY_REASON_SEVERITY,
  ELIGIBILITY_REASON_SEVERITY_VALUES,
  ELIGIBILITY_REASON_SEVERITY_RANK,
  isEligibilityReasonSeverity,
  COMPETITION_FORMAT_HINT,
  COMPETITION_FORMAT_HINT_VALUES,
  isCompetitionFormatHint,
} from "./enums/index.js";

export {
  REGISTRATION_ELIGIBILITY_ERROR_CODE,
  REGISTRATION_ELIGIBILITY_ERROR_CODE_VALUES,
  isRegistrationEligibilityErrorCode,
  registrationEligibilityError,
  registrationEligibilityWarning,
  registrationEligibilityOk,
  registrationEligibilityFail,
} from "./errors/index.js";

export {
  REGISTRATION_ELIGIBILITY_SCHEMA_VERSION,
  ELIGIBILITY_EVALUATOR_VERSION,
  REGISTRATION_LIFECYCLE_SERVICE_VERSION,
  createAuditMetadata,
  isNonEmptyString,
  requireNonEmptyString,
  cloneJsonSafe,
  createRegistrationTarget,
  assertRegistrationTarget,
  buildRegistrationTargetStableIdentity,
  hasValidRegistrationTarget,
  isRegistrationTarget,
  createRegistrationApplicant,
  createRegistrationDecision,
  mapDecisionTypeToStatus,
  createEligibilityReason,
  orderEligibilityReasons,
  createEligibilityCheckResult,
  createEligibilityPolicy,
  createEligibilityEvaluationContext,
  createEligibilityDecision,
  createCompetitionRegistration,
  buildCompetitionRegistrationIdentityKey,
  createRegistrationEvidence,
  createRegistrationAuditEvent,
  createRegistrationCapacitySnapshot,
  createRegistrationWaitlistPosition,
  buildRegistrationIdempotencyKey,
  createRegistrationIdempotencyRecord,
} from "./contracts/index.js";

export {
  REGISTRATION_ALLOWED_TRANSITIONS,
  canTransitionRegistrationStatus,
  validateRegistrationTransition,
  applyRegistrationTransition,
  evaluateIdempotentSubmission,
  createIdempotencyRecordForRegistration,
} from "./policies/index.js";

export {
  createNullClockPort,
  createFixedClockPort,
  isClockPort,
  createSequentialIdGeneratorPort,
  createNullIdGeneratorPort,
  isIdGeneratorPort,
  createNullParticipantLookupPort,
  createInMemoryParticipantLookupPort,
  PARTICIPANT_LOOKUP_PORT_METHODS,
  createNullEntryLookupPort,
  createInMemoryEntryLookupPort,
  ENTRY_LOOKUP_PORT_METHODS,
  createNullEntryCreationPort,
  createInMemoryEntryCreationPort,
  ENTRY_CREATION_PORT_METHODS,
  createNullDivisionEligibilityPort,
  createStubDivisionEligibilityPort,
  DIVISION_ELIGIBILITY_PORT_METHODS,
  createNullCompetitionRegistrationPolicyPort,
  createInMemoryCompetitionRegistrationPolicyPort,
  COMPETITION_REGISTRATION_POLICY_PORT_METHODS,
  createNullRuleEvaluationPort,
  createStubRuleEvaluationPort,
  RULE_EVALUATION_PORT_METHODS,
  createNullPaymentStatusPort,
  createStubPaymentStatusPort,
  PAYMENT_STATUS_PORT_METHODS,
  createNullMembershipStatusPort,
  createStubMembershipStatusPort,
  MEMBERSHIP_STATUS_PORT_METHODS,
  createNullTeamRosterValidationPort,
  createStubTeamRosterValidationPort,
  TEAM_ROSTER_VALIDATION_PORT_METHODS,
  REGISTRATION_REPOSITORY_PORT_METHODS,
  matchesRegistrationRepositoryPort,
  createInMemoryRegistrationRepositoryPort,
  createNoopRegistrationRepositoryPort,
  createNullRegistrationAuditPort,
  createInMemoryRegistrationAuditPort,
  REGISTRATION_AUDIT_PORT_METHODS,
} from "./ports/index.js";

export {
  CORE03_FIXTURE_CLOCK,
  createCore03TestFixture,
  fixtureIndividualRegistration,
  fixturePairRegistration,
  fixtureTeamRegistration,
} from "./fixtures/index.js";

export {
  REGISTRATION_LIFECYCLE_OPERATION,
  REGISTRATION_LIFECYCLE_OPERATION_VALUES,
  isRegistrationLifecycleOperation,
  REGISTRATION_LIFECYCLE_SYSTEM_ACTOR,
  registrationLifecycleServiceOk,
  registrationLifecycleServiceFail,
  createRegistrationLifecycleService,
} from "./services/index.js";

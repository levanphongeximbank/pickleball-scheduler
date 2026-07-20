import { REGISTRATION_TARGET_TYPE } from "../enums/registrationTargetType.js";
import { REGISTRATION_STATUS } from "../enums/registrationStatus.js";
import { COMPETITION_FORMAT_HINT } from "../enums/competitionFormatHint.js";
import { ELIGIBILITY_CHECK_TYPE } from "../enums/eligibilityCheckType.js";
import { createCompetitionRegistration } from "../contracts/competitionRegistration.js";
import { createRegistrationApplicant } from "../contracts/registrationApplicant.js";
import { createFixedClockPort } from "../ports/clockPort.js";
import { createSequentialIdGeneratorPort } from "../ports/idGeneratorPort.js";
import { createInMemoryRegistrationRepositoryPort } from "../ports/registrationRepositoryPort.js";
import { createInMemoryRegistrationAuditPort } from "../ports/registrationAuditPort.js";
import { createInMemoryParticipantLookupPort } from "../ports/participantLookupPort.js";
import { createInMemoryEntryLookupPort } from "../ports/entryLookupPort.js";
import { createInMemoryCompetitionRegistrationPolicyPort } from "../ports/competitionRegistrationPolicyPort.js";
import { createStubDivisionEligibilityPort } from "../ports/divisionEligibilityPort.js";
import { createStubRuleEvaluationPort } from "../ports/ruleEvaluationPort.js";
import { createStubPaymentStatusPort } from "../ports/paymentStatusPort.js";
import { createStubMembershipStatusPort } from "../ports/membershipStatusPort.js";
import { createStubTeamRosterValidationPort } from "../ports/teamRosterValidationPort.js";
import { createEligibilityEvaluationService } from "../services/eligibilityEvaluationService.js";

export const CORE03_FIXTURE_CLOCK = "2026-07-20T05:00:00.000Z";

/**
 * Pure-domain test fixture bundle (no Production I/O).
 * @param {{ clockIso?: string, idSeed?: string }} [options]
 */
export function createCore03TestFixture(options = {}) {
  const clock = createFixedClockPort(options.clockIso || CORE03_FIXTURE_CLOCK);
  const ids = createSequentialIdGeneratorPort(options.idSeed || "core03");
  const repository = createInMemoryRegistrationRepositoryPort();
  const audit = createInMemoryRegistrationAuditPort();

  return {
    clock,
    ids,
    repository,
    audit,
    now: () => clock.nowIso(),
  };
}

/**
 * @param {Partial<import('../contracts/competitionRegistration.js').CompetitionRegistration>} [overrides]
 */
export function fixtureIndividualRegistration(overrides = {}) {
  return createCompetitionRegistration({
    id: "reg-ind-1",
    registrationRequestId: "req-ind-1",
    idempotencyKey: "idem-ind-1",
    competitionId: "comp-1",
    divisionId: "div-1",
    status: REGISTRATION_STATUS.DRAFT,
    formatHint: COMPETITION_FORMAT_HINT.INDIVIDUAL_TOURNAMENT,
    target: {
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: "p-1",
    },
    applicant: createRegistrationApplicant({
      platformUserId: "user-1",
      participantId: "p-1",
    }),
    ...overrides,
  });
}

/**
 * @param {Partial<import('../contracts/competitionRegistration.js').CompetitionRegistration>} [overrides]
 */
export function fixturePairRegistration(overrides = {}) {
  return createCompetitionRegistration({
    id: "reg-pair-1",
    registrationRequestId: "req-pair-1",
    idempotencyKey: "idem-pair-1",
    competitionId: "comp-1",
    divisionId: "div-doubles",
    status: REGISTRATION_STATUS.DRAFT,
    formatHint: COMPETITION_FORMAT_HINT.INDIVIDUAL_TOURNAMENT,
    target: {
      targetType: REGISTRATION_TARGET_TYPE.PAIR,
      participantIds: ["p-2", "p-1"],
    },
    applicant: createRegistrationApplicant({
      platformUserId: "user-1",
      participantId: "p-1",
    }),
    ...overrides,
  });
}

/**
 * @param {Partial<import('../contracts/competitionRegistration.js').CompetitionRegistration>} [overrides]
 */
export function fixtureTeamRegistration(overrides = {}) {
  return createCompetitionRegistration({
    id: "reg-team-1",
    registrationRequestId: "req-team-1",
    idempotencyKey: "idem-team-1",
    competitionId: "comp-1",
    divisionId: "div-team",
    status: REGISTRATION_STATUS.DRAFT,
    formatHint: COMPETITION_FORMAT_HINT.TEAM_TOURNAMENT,
    target: {
      targetType: REGISTRATION_TARGET_TYPE.TEAM,
      teamId: "team-1",
      representativeParticipantId: "p-captain",
    },
    applicant: createRegistrationApplicant({
      platformUserId: "user-cap",
      participantId: "p-captain",
    }),
    ...overrides,
  });
}

/** Default participant seed for orchestration tests. */
export const CORE03_FIXTURE_PARTICIPANTS = Object.freeze([
  {
    id: "p-1",
    status: "ACTIVE",
    birthDate: "1990-01-01",
    gender: "M",
    rating: 3.5,
  },
  {
    id: "p-2",
    status: "ACTIVE",
    birthDate: "1992-06-15",
    gender: "F",
    rating: 3.0,
  },
  {
    id: "p-captain",
    status: "ACTIVE",
    birthDate: "1988-03-10",
    gender: "M",
    rating: 4.0,
  },
]);

/**
 * Default open competition policy with minimal eligibility checks.
 */
export function fixtureDefaultCompetitionPolicy(overrides = {}) {
  return {
    policyAvailable: true,
    windowOpen: true,
    policyRef: "pol-default",
    competitionLimit: null,
    allowWaitlist: false,
    eligibilityPolicy: {
      policyId: "pol-default",
      requiredCheckTypes: [
        ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
      ],
    },
    ...overrides,
  };
}

/**
 * @param {{
 *   clockIso?: string,
 *   idSeed?: string,
 *   participants?: Array<Record<string, unknown>>,
 *   competitionPolicies?: Record<string, Record<string, unknown>>,
 *   teamRosterImpl?: Function,
 *   ruleEvaluationImpl?: Function,
 *   paymentImpl?: Function,
 *   membershipImpl?: Function,
 *   divisionImpl?: Function,
 * }} [options]
 */
export function createEligibilityEvaluationTestHarness(options = {}) {
  const clock = createFixedClockPort(options.clockIso || CORE03_FIXTURE_CLOCK);
  const ids = createSequentialIdGeneratorPort(options.idSeed || "eval");
  const repository = createInMemoryRegistrationRepositoryPort();
  const audit = createInMemoryRegistrationAuditPort();
  const participantLookup = createInMemoryParticipantLookupPort(
    options.participants || [...CORE03_FIXTURE_PARTICIPANTS]
  );
  const entryLookup = createInMemoryEntryLookupPort();
  const competitionPolicy = createInMemoryCompetitionRegistrationPolicyPort(
    options.competitionPolicies || {
      "comp-1": fixtureDefaultCompetitionPolicy(),
    }
  );
  const divisionEligibility = createStubDivisionEligibilityPort(options.divisionImpl);
  const ruleEvaluation = createStubRuleEvaluationPort(options.ruleEvaluationImpl);
  const paymentStatus = createStubPaymentStatusPort(options.paymentImpl);
  const membershipStatus = createStubMembershipStatusPort(options.membershipImpl);
  const teamRosterValidation = createStubTeamRosterValidationPort(options.teamRosterImpl);

  const service = createEligibilityEvaluationService({
    repository,
    audit,
    clock,
    ids,
    participantLookup,
    entryLookup,
    divisionEligibility,
    competitionPolicy,
    ruleEvaluation,
    paymentStatus,
    membershipStatus,
    teamRosterValidation,
  });

  return {
    clock,
    ids,
    repository,
    audit,
    participantLookup,
    entryLookup,
    competitionPolicy,
    divisionEligibility,
    ruleEvaluation,
    paymentStatus,
    membershipStatus,
    teamRosterValidation,
    service,
    now: () => clock.nowIso(),
    async seedRegistration(registration) {
      return repository.save(registration);
    },
  };
}

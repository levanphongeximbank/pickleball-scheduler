import { REGISTRATION_TARGET_TYPE } from "../enums/registrationTargetType.js";
import { REGISTRATION_STATUS } from "../enums/registrationStatus.js";
import { COMPETITION_FORMAT_HINT } from "../enums/competitionFormatHint.js";
import { createCompetitionRegistration } from "../contracts/competitionRegistration.js";
import { createRegistrationApplicant } from "../contracts/registrationApplicant.js";
import { createFixedClockPort } from "../ports/clockPort.js";
import { createSequentialIdGeneratorPort } from "../ports/idGeneratorPort.js";
import { createInMemoryRegistrationRepositoryPort } from "../ports/registrationRepositoryPort.js";
import { createInMemoryRegistrationAuditPort } from "../ports/registrationAuditPort.js";

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

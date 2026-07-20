import { ELIGIBILITY_CHECK_TYPE } from "../enums/eligibilityCheckType.js";
import { ELIGIBILITY_REASON_SEVERITY } from "../enums/eligibilityReasonSeverity.js";
import { REGISTRATION_TARGET_TYPE } from "../enums/registrationTargetType.js";
import { TERMINAL_REGISTRATION_STATUSES } from "../enums/registrationStatus.js";
import {
  createEligibilityCheckResult,
  createEligibilityReason,
} from "../contracts/eligibility.js";
import { buildCompetitionRegistrationIdentityKey } from "../contracts/competitionRegistration.js";
import { buildRegistrationTargetStableIdentity } from "../contracts/registrationTarget.js";
import { isOptionalEligibilityCheck } from "../policies/eligibilityEvaluationPolicy.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import { registrationEligibilityWarning } from "../errors/registrationEligibilityError.js";

/**
 * @typedef {Object} EligibilityCheckExecutionContext
 * @property {import('../contracts/competitionRegistration.js').CompetitionRegistration} registration
 * @property {import('../contracts/eligibility.js').EligibilityEvaluationContext} evaluationContext
 * @property {import('../contracts/eligibility.js').EligibilityPolicy|null} policy
 * @property {Record<string, unknown>} competitionPolicy
 * @property {string} evaluatedAt
 */

/**
 * @typedef {Object} EligibilityCheckExecutorDeps
 * @property {import('../ports/participantLookupPort.js').ParticipantLookupPort} participantLookup
 * @property {import('../ports/entryLookupPort.js').EntryLookupPort} entryLookup
 * @property {import('../ports/divisionEligibilityPort.js').DivisionEligibilityPort} divisionEligibility
 * @property {import('../ports/competitionRegistrationPolicyPort.js').CompetitionRegistrationPolicyPort} competitionPolicy
 * @property {import('../ports/ruleEvaluationPort.js').RuleEvaluationPort} ruleEvaluation
 * @property {import('../ports/paymentStatusPort.js').PaymentStatusPort} paymentStatus
 * @property {import('../ports/membershipStatusPort.js').MembershipStatusPort} membershipStatus
 * @property {import('../ports/teamRosterValidationPort.js').TeamRosterValidationPort} teamRosterValidation
 * @property {import('../ports/registrationRepositoryPort.js').RegistrationRepositoryPort} repository
 */

/**
 * @param {import('../contracts/registrationTarget.js').RegistrationTarget} target
 * @returns {string[]}
 */
export function resolveParticipantIdsForTarget(target) {
  if (target.targetType === REGISTRATION_TARGET_TYPE.INDIVIDUAL) {
    return target.participantId ? [target.participantId] : [];
  }
  if (target.targetType === REGISTRATION_TARGET_TYPE.PAIR) {
    return Array.isArray(target.participantIds) ? [...target.participantIds] : [];
  }
  if (target.targetType === REGISTRATION_TARGET_TYPE.TEAM) {
    return target.representativeParticipantId ? [target.representativeParticipantId] : [];
  }
  return [];
}

/**
 * @param {string} birthDate
 * @param {string} evaluatedAt
 * @returns {number|null}
 */
function computeAgeYears(birthDate, evaluatedAt) {
  const birth = new Date(birthDate);
  const at = new Date(evaluatedAt);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return null;
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = at.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && at.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * @param {string} checkType
 * @param {EligibilityCheckExecutionContext} context
 * @param {EligibilityCheckExecutorDeps} deps
 * @returns {Promise<{
 *   result: import('../contracts/eligibility.js').EligibilityCheckResult|null,
 *   warning?: import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue|null,
 *   portUnavailable?: boolean,
 * }>}
 */
export async function executeEligibilityCheck(checkType, context, deps) {
  const { registration, policy, competitionPolicy, evaluatedAt, evaluationContext } = context;
  const optional = isOptionalEligibilityCheck(checkType, policy);

  switch (checkType) {
    case ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW:
      return executeRegistrationWindowCheck(competitionPolicy, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS:
      return executeParticipantStatusCheck(registration, deps, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT:
      return executeAgeRequirementCheck(registration, deps, policy, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.GENDER_REQUIREMENT:
      return executeGenderRequirementCheck(registration, deps, policy, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.RATING_RANGE:
      return executeRatingRangeCheck(registration, deps, policy, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.RANKING_REQUIREMENT:
    case ELIGIBILITY_CHECK_TYPE.DOCUMENT_REQUIREMENT:
    case ELIGIBILITY_CHECK_TYPE.SUSPENSION_OR_SANCTION:
      return executeRuleEvaluationCheck(
        checkType,
        evaluationContext,
        deps,
        evaluatedAt,
        optional
      );
    case ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY:
      return executeDivisionCompatibilityCheck(registration, deps, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.DIVISION_CAPACITY:
      return executeDivisionCapacityCheck(registration, deps, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.MEMBERSHIP_REQUIREMENT:
      return executeMembershipRequirementCheck(registration, deps, policy, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT:
      return executeTeamRosterCheck(registration, deps, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT:
      return executePaymentRequirementCheck(registration, deps, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.DUPLICATE_REGISTRATION:
      return executeDuplicateRegistrationCheck(registration, deps, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.ENTRY_LIMIT:
      return executeEntryLimitCheck(registration, deps, policy, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.COMPETITION_CAPACITY:
      return executeCompetitionCapacityCheck(registration, competitionPolicy, deps, evaluatedAt);
    case ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL:
      return executeManualApprovalCheck(policy, evaluatedAt);
    default:
      if (optional) {
        return {
          result: null,
          warning: registrationEligibilityWarning(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.PORT_REQUIRED,
            checkType,
            `Optional check ${checkType} has no adapter in Phase 1C`,
            { checkType }
          ),
        };
      }
      return {
        result: createEligibilityCheckResult({
          checkType,
          passed: false,
          evaluatedAt,
          reasons: [
            createEligibilityReason({
              code: "CHECK_ADAPTER_UNAVAILABLE",
              checkType,
              severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
              message: `Mandatory check ${checkType} adapter unavailable`,
              details: { expected: "adapter", actual: "unavailable" },
            }),
          ],
        }),
        portUnavailable: true,
      };
  }
}

/**
 * @param {Record<string, unknown>} competitionPolicy
 * @param {string} evaluatedAt
 */
async function executeRegistrationWindowCheck(competitionPolicy, evaluatedAt) {
  const windowOpen = competitionPolicy.windowOpen === true;
  if (!windowOpen) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        passed: false,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "REGISTRATION_WINDOW_CLOSED",
            checkType: ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: "Registration window is closed",
            details: { expected: "open", actual: "closed" },
          }),
        ],
      }),
    };
  }
  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
      passed: true,
      evaluatedAt,
      reasons: [],
    }),
  };
}

/**
 * @param {import('../contracts/competitionRegistration.js').CompetitionRegistration} registration
 * @param {EligibilityCheckExecutorDeps} deps
 * @param {string} evaluatedAt
 */
async function executeParticipantStatusCheck(registration, deps, evaluatedAt) {
  const participantIds = resolveParticipantIdsForTarget(registration.target);
  if (participantIds.length === 0 && registration.target.targetType !== REGISTRATION_TARGET_TYPE.TEAM) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
        passed: false,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "PARTICIPANT_IDS_MISSING",
            checkType: ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: "No participant ids resolved for target",
          }),
        ],
      }),
    };
  }

  if (registration.target.targetType === REGISTRATION_TARGET_TYPE.TEAM) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
        passed: true,
        evaluatedAt,
        reasons: [],
      }),
    };
  }

  const participants = await deps.participantLookup.getByIds(participantIds);
  /** @type {import('../contracts/eligibility.js').EligibilityReason[]} */
  const reasons = [];

  for (const id of participantIds) {
    const found = participants.find((p) => p.id === id);
    if (!found) {
      reasons.push(
        createEligibilityReason({
          code: "PARTICIPANT_NOT_FOUND",
          checkType: ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: `Participant not found: ${id}`,
          details: { participantId: id, expected: "found", actual: "missing" },
        })
      );
      continue;
    }
    const status = String(found.status || "UNKNOWN").toUpperCase();
    if (status !== "ACTIVE") {
      reasons.push(
        createEligibilityReason({
          code: "PARTICIPANT_INACTIVE",
          checkType: ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: `Participant ${id} is not active`,
          details: { participantId: id, expected: "ACTIVE", actual: status },
        })
      );
    }
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
      passed: reasons.length === 0,
      evaluatedAt,
      reasons,
    }),
  };
}

/**
 * @param {import('../contracts/competitionRegistration.js').CompetitionRegistration} registration
 * @param {EligibilityCheckExecutorDeps} deps
 * @param {import('../contracts/eligibility.js').EligibilityPolicy|null} policy
 * @param {string} evaluatedAt
 */
async function executeAgeRequirementCheck(registration, deps, policy, evaluatedAt) {
  const params = policy?.parameters || {};
  const minAge = typeof params.minAge === "number" ? params.minAge : null;
  const maxAge = typeof params.maxAge === "number" ? params.maxAge : null;
  const participantIds = resolveParticipantIdsForTarget(registration.target);
  const participants = await deps.participantLookup.getByIds(participantIds);
  /** @type {import('../contracts/eligibility.js').EligibilityReason[]} */
  const reasons = [];

  for (const id of participantIds) {
    const found = participants.find((p) => p.id === id);
    const birthDate = found?.birthDate ? String(found.birthDate) : null;
    const age = birthDate ? computeAgeYears(birthDate, evaluatedAt) : null;
    if (age == null) {
      reasons.push(
        createEligibilityReason({
          code: "AGE_UNKNOWN",
          checkType: ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: `Age unknown for participant ${id}`,
          details: { participantId: id },
        })
      );
      continue;
    }
    if (minAge != null && age < minAge) {
      reasons.push(
        createEligibilityReason({
          code: "AGE_TOO_YOUNG",
          checkType: ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: `Participant ${id} below minimum age`,
          details: { participantId: id, expected: `>=${minAge}`, actual: age },
        })
      );
    }
    if (maxAge != null && age > maxAge) {
      reasons.push(
        createEligibilityReason({
          code: "AGE_TOO_OLD",
          checkType: ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: `Participant ${id} above maximum age`,
          details: { participantId: id, expected: `<=${maxAge}`, actual: age },
        })
      );
    }
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.AGE_REQUIREMENT,
      passed: reasons.length === 0,
      evaluatedAt,
      reasons,
    }),
  };
}

async function executeGenderRequirementCheck(registration, deps, policy, evaluatedAt) {
  const requiredGender = policy?.parameters?.requiredGender
    ? String(policy.parameters.requiredGender).toUpperCase()
    : null;
  if (!requiredGender) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.GENDER_REQUIREMENT,
        passed: true,
        evaluatedAt,
        reasons: [],
      }),
    };
  }

  const participantIds = resolveParticipantIdsForTarget(registration.target);
  const participants = await deps.participantLookup.getByIds(participantIds);
  /** @type {import('../contracts/eligibility.js').EligibilityReason[]} */
  const reasons = [];

  for (const id of participantIds) {
    const found = participants.find((p) => p.id === id);
    const gender = found?.gender ? String(found.gender).toUpperCase() : "UNKNOWN";
    if (gender !== requiredGender) {
      reasons.push(
        createEligibilityReason({
          code: "GENDER_MISMATCH",
          checkType: ELIGIBILITY_CHECK_TYPE.GENDER_REQUIREMENT,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: `Participant ${id} gender does not match requirement`,
          details: { participantId: id, expected: requiredGender, actual: gender },
        })
      );
    }
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.GENDER_REQUIREMENT,
      passed: reasons.length === 0,
      evaluatedAt,
      reasons,
    }),
  };
}

async function executeRatingRangeCheck(registration, deps, policy, evaluatedAt) {
  const minRating =
    typeof policy?.parameters?.minRating === "number" ? policy.parameters.minRating : null;
  const maxRating =
    typeof policy?.parameters?.maxRating === "number" ? policy.parameters.maxRating : null;
  const participantIds = resolveParticipantIdsForTarget(registration.target);
  const participants = await deps.participantLookup.getByIds(participantIds);
  /** @type {import('../contracts/eligibility.js').EligibilityReason[]} */
  const reasons = [];

  for (const id of participantIds) {
    const found = participants.find((p) => p.id === id);
    const rating = typeof found?.rating === "number" ? found.rating : null;
    if (rating == null) {
      reasons.push(
        createEligibilityReason({
          code: "RATING_UNKNOWN",
          checkType: ELIGIBILITY_CHECK_TYPE.RATING_RANGE,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: `Rating unknown for participant ${id}`,
          details: { participantId: id },
        })
      );
      continue;
    }
    if (minRating != null && rating < minRating) {
      reasons.push(
        createEligibilityReason({
          code: "RATING_BELOW_MIN",
          checkType: ELIGIBILITY_CHECK_TYPE.RATING_RANGE,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: `Participant ${id} rating below minimum`,
          details: { participantId: id, expected: `>=${minRating}`, actual: rating },
        })
      );
    }
    if (maxRating != null && rating > maxRating) {
      reasons.push(
        createEligibilityReason({
          code: "RATING_ABOVE_MAX",
          checkType: ELIGIBILITY_CHECK_TYPE.RATING_RANGE,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: `Participant ${id} rating above maximum`,
          details: { participantId: id, expected: `<=${maxRating}`, actual: rating },
        })
      );
    }
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.RATING_RANGE,
      passed: reasons.length === 0,
      evaluatedAt,
      reasons,
    }),
  };
}

async function executeRuleEvaluationCheck(checkType, evaluationContext, deps, evaluatedAt, optional = false) {
  let response;
  try {
    response = await deps.ruleEvaluation.evaluateRules({
      competitionId: evaluationContext.competitionId,
      ruleSetId: evaluationContext.ruleSetId,
      ruleSetVersion: evaluationContext.ruleSetVersion,
      operation: checkType,
      subject: {
        registrationId: evaluationContext.registrationId,
        target: evaluationContext.target,
      },
      context: {
        divisionId: evaluationContext.divisionId,
        formatHint: evaluationContext.formatHint,
      },
    });
  } catch (error) {
    if (optional) {
      return {
        result: null,
        warning: registrationEligibilityWarning(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.PORT_REQUIRED,
          checkType,
          `Optional rule evaluation adapter unavailable for ${checkType}`,
          { checkType }
        ),
      };
    }
    return {
      result: createEligibilityCheckResult({
        checkType,
        passed: false,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "RULE_EVALUATION_FAILED",
            checkType,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: error instanceof Error ? error.message : "Rule evaluation failed",
            details: { expected: "accepted", actual: "error" },
          }),
        ],
      }),
    };
  }

  const codes = Array.isArray(response?.reasonCodes) ? response.reasonCodes : [];
  if (codes.includes("RULE_EVALUATION_PORT_UNAVAILABLE")) {
    if (optional) {
      return {
        result: null,
        warning: registrationEligibilityWarning(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.PORT_REQUIRED,
          checkType,
          `Optional rule evaluation adapter unavailable for ${checkType}`,
          { checkType }
        ),
      };
    }
    return {
      result: createEligibilityCheckResult({
        checkType,
        passed: false,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "RULE_EVALUATION_PORT_UNAVAILABLE",
            checkType,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: "Rule evaluation port unavailable",
          }),
        ],
      }),
      portUnavailable: true,
    };
  }

  if (!response?.accepted) {
    const reasonCodes = codes.length > 0 ? codes : ["RULE_REJECTED"];
    return {
      result: createEligibilityCheckResult({
        checkType,
        passed: false,
        evaluatedAt,
        ruleRef: response?.traceRef ?? null,
        reasons: reasonCodes.map((code) =>
          createEligibilityReason({
            code: String(code),
            checkType,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: String(code),
            details: {
              sourceRuleId: response?.traceRef ?? null,
              sourceVersion: response?.ruleSetVersion ?? null,
            },
          })
        ),
      }),
    };
  }

  return {
    result: createEligibilityCheckResult({
      checkType,
      passed: true,
      evaluatedAt,
      ruleRef: response?.traceRef ?? null,
      reasons: [],
    }),
  };
}

async function executeDivisionCompatibilityCheck(registration, deps, evaluatedAt) {
  const response = await deps.divisionEligibility.getDivisionEligibilityContext({
    competitionId: registration.competitionId,
    divisionId: registration.divisionId,
    divisionCategoryId: registration.divisionCategoryId,
  });

  if (response?.acceptsRegistration === false) {
    const codes = Array.isArray(response.reasonCodes) ? response.reasonCodes : ["DIVISION_INCOMPATIBLE"];
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY,
        passed: false,
        evaluatedAt,
        reasons: codes.map((code) =>
          createEligibilityReason({
            code: String(code),
            checkType: ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: String(code),
          })
        ),
      }),
    };
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY,
      passed: true,
      evaluatedAt,
      reasons: [],
    }),
  };
}

async function executeDivisionCapacityCheck(registration, deps, evaluatedAt) {
  const response = await deps.divisionEligibility.getDivisionEligibilityContext({
    competitionId: registration.competitionId,
    divisionId: registration.divisionId,
    divisionCategoryId: registration.divisionCategoryId,
  });

  const capacity = response?.capacity;
  if (
    capacity &&
    typeof capacity === "object" &&
    /** @type {{ available?: number|null }} */ (capacity).available === 0
  ) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.DIVISION_CAPACITY,
        passed: false,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "DIVISION_CAPACITY_FULL",
            checkType: ELIGIBILITY_CHECK_TYPE.DIVISION_CAPACITY,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: "Division capacity is full",
          }),
        ],
      }),
    };
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.DIVISION_CAPACITY,
      passed: true,
      evaluatedAt,
      reasons: [],
    }),
  };
}

async function executeMembershipRequirementCheck(registration, deps, policy, evaluatedAt) {
  const clubId = policy?.parameters?.clubId ? String(policy.parameters.clubId) : null;
  const organizationId = policy?.parameters?.organizationId
    ? String(policy.parameters.organizationId)
    : null;
  const participantIds = resolveParticipantIdsForTarget(registration.target);
  /** @type {import('../contracts/eligibility.js').EligibilityReason[]} */
  const reasons = [];

  for (const participantId of participantIds) {
    const status = await deps.membershipStatus.getMembershipStatus({
      clubId,
      organizationId,
      participantId,
    });
    if (!status?.isMember) {
      const codes = Array.isArray(status?.reasonCodes) ? status.reasonCodes : ["MEMBERSHIP_REQUIRED"];
      for (const code of codes) {
        reasons.push(
          createEligibilityReason({
            code: String(code),
            checkType: ELIGIBILITY_CHECK_TYPE.MEMBERSHIP_REQUIREMENT,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: `Membership required for participant ${participantId}`,
            details: { participantId, expected: "member", actual: status?.status ?? "non-member" },
          })
        );
      }
    }
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.MEMBERSHIP_REQUIREMENT,
      passed: reasons.length === 0,
      evaluatedAt,
      reasons,
    }),
  };
}

async function executeTeamRosterCheck(registration, deps, evaluatedAt) {
  if (registration.target.targetType !== REGISTRATION_TARGET_TYPE.TEAM) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
        passed: true,
        evaluatedAt,
        reasons: [],
      }),
    };
  }

  const response = await deps.teamRosterValidation.validateRoster({
    competitionId: registration.competitionId,
    teamId: registration.target.teamId,
    divisionId: registration.divisionId,
  });

  if (!response?.valid) {
    const codes = Array.isArray(response?.reasonCodes)
      ? response.reasonCodes
      : ["TEAM_ROSTER_INVALID"];
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
        passed: false,
        evaluatedAt,
        reasons: codes.map((code) =>
          createEligibilityReason({
            code: String(code),
            checkType: ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: String(code),
          })
        ),
      }),
    };
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
      passed: true,
      evaluatedAt,
      reasons: [],
    }),
  };
}

async function executePaymentRequirementCheck(registration, deps, evaluatedAt) {
  const response = await deps.paymentStatus.getPaymentStatus({
    competitionId: registration.competitionId,
    registrationId: registration.id,
    participantId: registration.target.participantId ?? null,
    teamId: registration.target.teamId ?? null,
  });

  if (response?.status === "NOT_REQUIRED" || response?.requirementMet === true) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT,
        passed: true,
        evaluatedAt,
        reasons: [],
      }),
    };
  }

  if (response?.status === "UNPAID" || response?.status === "UNKNOWN") {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT,
        passed: true,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "CONDITIONAL_PAYMENT_PENDING",
            checkType: ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT,
            severity: ELIGIBILITY_REASON_SEVERITY.WARNING,
            message: "Payment is pending",
            details: { expected: "PAID", actual: response.status },
          }),
        ],
      }),
    };
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT,
      passed: false,
      evaluatedAt,
      reasons: [
        createEligibilityReason({
          code: "PAYMENT_REQUIRED",
          checkType: ELIGIBILITY_CHECK_TYPE.PAYMENT_REQUIREMENT,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: "Payment requirement not met",
          details: { expected: "PAID", actual: response?.status ?? "UNKNOWN" },
        }),
      ],
    }),
  };
}

async function executeDuplicateRegistrationCheck(registration, deps, evaluatedAt) {
  const identityKey =
    registration.identityKey ||
    buildCompetitionRegistrationIdentityKey({
      competitionId: registration.competitionId,
      divisionId: registration.divisionId,
      target: registration.target,
    });

  const existing = deps.repository.findByIdentityKey
    ? await deps.repository.findByIdentityKey(identityKey)
    : null;

  if (existing && existing.id !== registration.id && !TERMINAL_REGISTRATION_STATUSES.includes(existing.status)) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.DUPLICATE_REGISTRATION,
        passed: false,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "DUPLICATE_REGISTRATION",
            checkType: ELIGIBILITY_CHECK_TYPE.DUPLICATE_REGISTRATION,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: "Duplicate active registration exists",
            details: {
              identityKey,
              existingRegistrationId: existing.id,
            },
          }),
        ],
      }),
    };
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.DUPLICATE_REGISTRATION,
      passed: true,
      evaluatedAt,
      reasons: [],
    }),
  };
}

async function executeEntryLimitCheck(registration, deps, policy, evaluatedAt) {
  const identityKey = buildRegistrationTargetStableIdentity(registration.target);
  const existingEntry = deps.entryLookup.findByIdentityKey
    ? await deps.entryLookup.findByIdentityKey(
        `${registration.competitionId}::${registration.divisionId ?? "NONE"}::${identityKey}`
      )
    : null;

  if (existingEntry) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.ENTRY_LIMIT,
        passed: false,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "ENTRY_ALREADY_EXISTS",
            checkType: ELIGIBILITY_CHECK_TYPE.ENTRY_LIMIT,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: "Entry already exists for target",
            details: { entryId: existingEntry.id, identityKey },
          }),
        ],
      }),
    };
  }

  const maxEntries =
    typeof policy?.parameters?.maxEntriesPerTarget === "number"
      ? policy.parameters.maxEntriesPerTarget
      : 1;
  const entries = await deps.entryLookup.getByCompetition(registration.competitionId);
  const matching = entries.filter(
    (e) =>
      e.identityKey === identityKey ||
      `${registration.competitionId}::${registration.divisionId ?? "NONE"}::${identityKey}` ===
        e.identityKey
  );

  if (matching.length >= maxEntries) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.ENTRY_LIMIT,
        passed: false,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "ENTRY_LIMIT_REACHED",
            checkType: ELIGIBILITY_CHECK_TYPE.ENTRY_LIMIT,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: "Entry limit reached for target",
            details: { expected: `<${maxEntries}`, actual: matching.length },
          }),
        ],
      }),
    };
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.ENTRY_LIMIT,
      passed: true,
      evaluatedAt,
      reasons: [],
    }),
  };
}

async function executeCompetitionCapacityCheck(
  registration,
  competitionPolicy,
  deps,
  evaluatedAt
) {
  const limit =
    typeof competitionPolicy.competitionLimit === "number"
      ? competitionPolicy.competitionLimit
      : null;
  if (limit == null) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.COMPETITION_CAPACITY,
        passed: true,
        evaluatedAt,
        reasons: [],
      }),
    };
  }

  const registrations = await deps.repository.listByCompetition(registration.competitionId);
  const activeCount = registrations.filter(
    (r) => !TERMINAL_REGISTRATION_STATUSES.includes(r.status)
  ).length;

  if (activeCount > limit) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.COMPETITION_CAPACITY,
        passed: false,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "COMPETITION_CAPACITY_FULL",
            checkType: ELIGIBILITY_CHECK_TYPE.COMPETITION_CAPACITY,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: "Competition capacity exceeded",
            details: { expected: `<=${limit}`, actual: activeCount },
          }),
        ],
      }),
    };
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.COMPETITION_CAPACITY,
      passed: true,
      evaluatedAt,
      reasons: [],
    }),
  };
}

async function executeManualApprovalCheck(policy, evaluatedAt) {
  if (policy?.requireManualApproval) {
    return {
      result: createEligibilityCheckResult({
        checkType: ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
        passed: false,
        evaluatedAt,
        reasons: [
          createEligibilityReason({
            code: "MANUAL_REVIEW_REQUIRED",
            checkType: ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
            severity: ELIGIBILITY_REASON_SEVERITY.WARNING,
            message: "Manual approval required by policy",
          }),
        ],
      }),
    };
  }

  return {
    result: createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.MANUAL_APPROVAL,
      passed: true,
      evaluatedAt,
      reasons: [],
    }),
  };
}

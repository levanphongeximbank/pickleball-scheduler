import { REGISTRATION_STATUS } from "../enums/registrationStatus.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import { registrationEligibilityError } from "../errors/registrationEligibilityError.js";
import {
  createEligibilityDecision,
  createEligibilityEvaluationContext,
} from "../contracts/eligibility.js";
import { createEligibilityEvaluationEvidence } from "../contracts/eligibilityEvaluationEvidence.js";
import { createRegistrationAuditEvent } from "../contracts/registrationEvidence.js";
import {
  ELIGIBILITY_EVALUATION_SERVICE_VERSION,
  ELIGIBILITY_EVALUATOR_VERSION,
  isNonEmptyString,
} from "../contracts/shared.js";
import {
  buildCanonicalEvaluationRequestFingerprint,
  buildEvaluationIdempotencyKey,
  createIdempotencyRecordForEvaluation,
  evaluateIdempotentEvaluation,
} from "../policies/evaluationIdempotencyPolicy.js";
import {
  isRegistrationStatusEligibleForEvaluation,
  orderCheckTypesForExecution,
  resolveEligibilityPolicyFromCompetitionPolicy,
  resolveRequiredCheckTypes,
} from "../policies/eligibilityEvaluationPolicy.js";
import { isClockPort } from "../ports/clockPort.js";
import { isIdGeneratorPort } from "../ports/idGeneratorPort.js";
import { matchesRegistrationRepositoryPort } from "../ports/registrationRepositoryPort.js";
import { executeEligibilityCheck } from "./eligibilityCheckExecutor.js";
import {
  ELIGIBILITY_EVALUATION_OPERATION,
  ELIGIBILITY_EVALUATION_SYSTEM_ACTOR,
} from "./eligibilityEvaluationOperations.js";
import {
  eligibilityEvaluationServiceFail,
  eligibilityEvaluationServiceOk,
} from "./eligibilityEvaluationResult.js";

/**
 * @typedef {Object} EligibilityEvaluationServiceDeps
 * @property {import('../ports/registrationRepositoryPort.js').RegistrationRepositoryPort} repository
 * @property {import('../ports/registrationAuditPort.js').RegistrationAuditPort} audit
 * @property {import('../ports/clockPort.js').ClockPort} clock
 * @property {import('../ports/idGeneratorPort.js').IdGeneratorPort} ids
 * @property {import('../ports/participantLookupPort.js').ParticipantLookupPort} participantLookup
 * @property {import('../ports/entryLookupPort.js').EntryLookupPort} entryLookup
 * @property {import('../ports/divisionEligibilityPort.js').DivisionEligibilityPort} divisionEligibility
 * @property {import('../ports/competitionRegistrationPolicyPort.js').CompetitionRegistrationPolicyPort} competitionPolicy
 * @property {import('../ports/ruleEvaluationPort.js').RuleEvaluationPort} ruleEvaluation
 * @property {import('../ports/paymentStatusPort.js').PaymentStatusPort} paymentStatus
 * @property {import('../ports/membershipStatusPort.js').MembershipStatusPort} membershipStatus
 * @property {import('../ports/teamRosterValidationPort.js').TeamRosterValidationPort} teamRosterValidation
 */

/**
 * @param {EligibilityEvaluationServiceDeps} deps
 */
function assertEvaluationDeps(deps) {
  if (!deps || typeof deps !== "object") {
    throw new TypeError("EligibilityEvaluationService requires deps object");
  }
  if (!matchesRegistrationRepositoryPort(deps.repository)) {
    throw new TypeError("EligibilityEvaluationService requires RegistrationRepositoryPort");
  }
  if (!deps.audit || typeof deps.audit.append !== "function") {
    throw new TypeError("EligibilityEvaluationService requires RegistrationAuditPort");
  }
  if (!isClockPort(deps.clock)) {
    throw new TypeError("EligibilityEvaluationService requires ClockPort");
  }
  if (!isIdGeneratorPort(deps.ids)) {
    throw new TypeError("EligibilityEvaluationService requires IdGeneratorPort");
  }
  const requiredPorts = [
    "participantLookup",
    "entryLookup",
    "divisionEligibility",
    "competitionPolicy",
    "ruleEvaluation",
    "paymentStatus",
    "membershipStatus",
    "teamRosterValidation",
  ];
  for (const key of requiredPorts) {
    if (!deps[/** @type {keyof EligibilityEvaluationServiceDeps} */ (key)]) {
      throw new TypeError(`EligibilityEvaluationService requires ${key}`);
    }
  }
}

/**
 * @param {unknown} error
 * @param {string} path
 */
function mapRepositoryError(error, path = "repository") {
  const code =
    error &&
    typeof error === "object" &&
    /** @type {{ code?: string }} */ (error).code === REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT
      ? REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT
      : REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED;

  return registrationEligibilityError(
    code,
    path,
    error instanceof Error ? error.message : "Repository operation failed",
    error &&
      typeof error === "object" &&
      /** @type {{ metadata?: Record<string, unknown> }} */ (error).metadata
      ? { .../** @type {{ metadata: Record<string, unknown> }} */ (error).metadata }
      : undefined
  );
}

/**
 * @param {EligibilityEvaluationServiceDeps} deps
 * @param {{
 *   registration: import('../contracts/competitionRegistration.js').CompetitionRegistration,
 *   decision: import('../contracts/eligibility.js').EligibilityDecision,
 *   evidence: import('../contracts/eligibilityEvaluationEvidence.js').EligibilityEvaluationEvidence,
 *   previousStatus: string,
 *   actorId?: string|null,
 *   requestId?: string|null,
 *   correlationId?: string|null,
 * }} input
 */
async function appendEvaluationAudit(deps, input) {
  const summaryReasonCodes = input.decision.reasons.map((r) => r.code);
  const event = createRegistrationAuditEvent({
    id: deps.ids.nextId("audit"),
    registrationId: input.registration.id,
    competitionId: input.registration.competitionId,
    eventType: ELIGIBILITY_EVALUATION_OPERATION.EVALUATE_REGISTRATION,
    operation: ELIGIBILITY_EVALUATION_OPERATION.EVALUATE_REGISTRATION,
    occurredAt: input.decision.evaluatedAt,
    actorId: input.actorId ?? ELIGIBILITY_EVALUATION_SYSTEM_ACTOR,
    fromStatus: input.previousStatus,
    toStatus: input.registration.status,
    eligibilityDecisionId: input.decision.id,
    requestId: input.requestId ?? input.registration.registrationRequestId ?? null,
    correlationId: input.correlationId ?? null,
    reason: input.decision.outcome,
    serviceVersion: ELIGIBILITY_EVALUATION_SERVICE_VERSION,
    payload: {
      evaluatorVersion: input.decision.evaluatorVersion,
      outcome: input.decision.outcome,
      summaryReasonCodes,
      evidenceId: input.evidence.id,
    },
  });
  await deps.audit.append(event);
  return { auditEventId: event.id, event };
}

/**
 * @param {EligibilityEvaluationServiceDeps} deps
 * @returns {{ evaluateRegistrationEligibility: Function }}
 */
export function createEligibilityEvaluationService(deps) {
  assertEvaluationDeps(deps);

  /**
   * @param {{
   *   registrationId: string,
   *   evaluationRequestId: string,
   *   actorId?: string|null,
   *   correlationId?: string|null,
   *   requestId?: string|null,
   *   evaluationOptions?: Record<string, unknown>|null,
   * }} request
   */
  async function evaluateRegistrationEligibility(request) {
    const operation = ELIGIBILITY_EVALUATION_OPERATION.EVALUATE_REGISTRATION;
    const evaluatedAt = deps.clock.nowIso();

    if (!isNonEmptyString(request?.registrationId)) {
      return eligibilityEvaluationServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "registrationId",
          "registrationId is required"
        ),
      ]);
    }
    if (!isNonEmptyString(request?.evaluationRequestId)) {
      return eligibilityEvaluationServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "evaluationRequestId",
          "evaluationRequestId is required"
        ),
      ]);
    }

    const registrationId = String(request.registrationId).trim();
    const evaluationRequestId = String(request.evaluationRequestId).trim();
    const idempotencyKey = buildEvaluationIdempotencyKey(evaluationRequestId);
    const evaluationOptions =
      request.evaluationOptions &&
      typeof request.evaluationOptions === "object" &&
      !Array.isArray(request.evaluationOptions)
        ? { ...request.evaluationOptions }
        : null;

    let registration;
    try {
      registration = await deps.repository.getById(registrationId);
    } catch (error) {
      return eligibilityEvaluationServiceFail(operation, [mapRepositoryError(error)], {
        registrationId,
        evaluatedAt,
      });
    }

    if (!registration) {
      return eligibilityEvaluationServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.REGISTRATION_NOT_FOUND,
          "registrationId",
          `Registration not found: ${registrationId}`,
          { registrationId }
        ),
      ]);
    }

    if (!isRegistrationStatusEligibleForEvaluation(registration.status)) {
      return eligibilityEvaluationServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_STATUS,
            "status",
            `Registration status ${registration.status} is not eligible for evaluation`,
            {
              status: registration.status,
              allowed: [REGISTRATION_STATUS.SUBMITTED, REGISTRATION_STATUS.UNDER_REVIEW],
            }
          ),
        ],
        { registrationId, evaluatedAt }
      );
    }

    let competitionPolicy;
    try {
      competitionPolicy = await deps.competitionPolicy.getRegistrationPolicy(
        registration.competitionId
      );
    } catch (error) {
      return eligibilityEvaluationServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
          "competitionPolicy",
          error instanceof Error ? error.message : "Competition policy lookup failed"
        ),
      ], { registrationId, evaluatedAt });
    }

    if (
      !competitionPolicy ||
      competitionPolicy.policyAvailable === false ||
      !isNonEmptyString(competitionPolicy.competitionId)
    ) {
      return eligibilityEvaluationServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
            "competitionPolicy",
            "Competition registration policy is unavailable",
            { competitionId: registration.competitionId }
          ),
        ],
        { registrationId, evaluatedAt }
      );
    }

    const policy = resolveEligibilityPolicyFromCompetitionPolicy(competitionPolicy);
    const requiredCheckTypes = orderCheckTypesForExecution(
      resolveRequiredCheckTypes(policy, registration.target)
    );

    const canonicalFingerprint = buildCanonicalEvaluationRequestFingerprint({
      registrationId: registration.id,
      competitionId: registration.competitionId,
      divisionId: registration.divisionId,
      target: registration.target,
      evaluatorVersion: ELIGIBILITY_EVALUATOR_VERSION,
      ruleSetId: policy?.ruleSetId ?? null,
      ruleSetVersion: policy?.ruleSetVersion ?? null,
      policyId: policy?.policyId ?? null,
      policyVersion: policy?.parameters?.policyVersion
        ? String(policy.parameters.policyVersion)
        : null,
      requiredCheckTypes,
      evaluationOptions,
    });

    let existingIdempotency;
    try {
      existingIdempotency = await deps.repository.findIdempotencyRecord(idempotencyKey);
    } catch (error) {
      return eligibilityEvaluationServiceFail(operation, [mapRepositoryError(error)], {
        registrationId,
        evaluatedAt,
      });
    }

    const idemEval = evaluateIdempotentEvaluation(
      { evaluationRequestId, registrationId, canonicalFingerprint },
      existingIdempotency
    );
    if (!idemEval.ok) {
      return eligibilityEvaluationServiceFail(operation, idemEval.errors, {
        registrationId,
        evaluatedAt,
        idempotencyResult: "CONFLICT",
      });
    }

    if (idemEval.value?.kind === "HIT" && idemEval.value.replay) {
      const replay = idemEval.value.replay;
      return eligibilityEvaluationServiceOk({
        operation,
        registrationId,
        decision: replay.decision,
        checkResults: replay.checkResults,
        evidence: replay.evidence,
        auditEventId: replay.auditEventId,
        evaluatedAt: replay.evaluatedAt,
        evaluatorVersion: replay.evaluatorVersion,
        replayed: true,
        idempotencyResult: "HIT",
      });
    }

    const evaluationContext = createEligibilityEvaluationContext({
      competitionId: registration.competitionId,
      divisionId: registration.divisionId,
      divisionCategoryId: registration.divisionCategoryId,
      categoryId: registration.categoryId,
      formatHint: registration.formatHint,
      target: registration.target,
      registrationId: registration.id,
      registrationRequestId: registration.registrationRequestId,
      evaluatedAt,
      ruleSetId: policy?.ruleSetId ?? null,
      ruleSetVersion: policy?.ruleSetVersion ?? null,
      policy,
    });

    const executorDeps = {
      participantLookup: deps.participantLookup,
      entryLookup: deps.entryLookup,
      divisionEligibility: deps.divisionEligibility,
      competitionPolicy: deps.competitionPolicy,
      ruleEvaluation: deps.ruleEvaluation,
      paymentStatus: deps.paymentStatus,
      membershipStatus: deps.membershipStatus,
      teamRosterValidation: deps.teamRosterValidation,
      repository: deps.repository,
    };

    /** @type {import('../contracts/eligibility.js').EligibilityCheckResult[]} */
    const checkResults = [];
    /** @type {import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[]} */
    const warnings = [];

    for (const checkType of requiredCheckTypes) {
      const executed = await executeEligibilityCheck(
        checkType,
        {
          registration,
          evaluationContext,
          policy,
          competitionPolicy,
          evaluatedAt,
        },
        executorDeps
      );

      if (executed.warning) {
        warnings.push(executed.warning);
      }

      if (executed.portUnavailable && executed.result) {
        return eligibilityEvaluationServiceFail(
          operation,
          [
            registrationEligibilityError(
              REGISTRATION_ELIGIBILITY_ERROR_CODE.PORT_REQUIRED,
              checkType,
              `Mandatory check ${checkType} adapter unavailable`,
              { checkType }
            ),
          ],
          {
            registrationId,
            checkResults: [...checkResults, executed.result],
            evaluatedAt,
            warnings,
          }
        );
      }

      if (executed.result) {
        checkResults.push(executed.result);
      }
    }

    const decisionId = deps.ids.nextId("elig");
    const decision = createEligibilityDecision({
      id: decisionId,
      checkResults,
      evaluatedAt,
      registrationId: registration.id,
      competitionId: registration.competitionId,
      ruleSetId: policy?.ruleSetId ?? null,
      ruleSetVersion: policy?.ruleSetVersion ?? null,
      policy,
      evaluatorVersion: ELIGIBILITY_EVALUATOR_VERSION,
    });

    const evidenceId = deps.ids.nextId("evidence");
    const evidence = createEligibilityEvaluationEvidence({
      id: evidenceId,
      evaluationRequestId,
      registrationId: registration.id,
      competitionId: registration.competitionId,
      divisionId: registration.divisionId,
      evaluatorVersion: decision.evaluatorVersion,
      ruleSetId: decision.ruleSetId,
      ruleSetVersion: decision.ruleSetVersion,
      requiredCheckTypes,
      checkResults: decision.checkResults,
      reasons: decision.reasons,
      outcome: decision.outcome,
      evaluatedAt,
      correlationId: request.correlationId ?? null,
      requestId: request.requestId ?? registration.registrationRequestId ?? null,
    });

    const replayPayload = {
      kind: /** @type {const} */ ("ELIGIBILITY_EVALUATION_REPLAY"),
      canonicalFingerprint,
      registrationId: registration.id,
      decisionId: decision.id,
      outcome: decision.outcome,
      evidenceId: evidence.id,
      auditEventId: null,
      summaryReasonCodes: decision.reasons.map((r) => r.code),
      evaluatorVersion: decision.evaluatorVersion,
      evaluatedAt,
      checkResults: decision.checkResults,
      evidence,
      decision,
    };

    let auditEventId;
    try {
      const audit = await appendEvaluationAudit(deps, {
        registration,
        decision,
        evidence,
        previousStatus: registration.status,
        actorId: request.actorId ?? null,
        requestId: request.requestId ?? null,
        correlationId: request.correlationId ?? null,
      });
      auditEventId = audit.auditEventId;
      replayPayload.auditEventId = auditEventId;
    } catch (error) {
      return eligibilityEvaluationServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_APPEND_FAILED,
            "audit",
            error instanceof Error ? error.message : "Audit append failed after evaluation",
            {
              registrationId: registration.id,
              decisionId: decision.id,
              evidenceId: evidence.id,
            }
          ),
        ],
        {
          registrationId,
          decision,
          checkResults: decision.checkResults,
          evidence,
          evaluatedAt,
          evaluatorVersion: decision.evaluatorVersion,
          warnings,
          metadata: { evaluatedWithoutAudit: true },
        }
      );
    }

    try {
      await deps.repository.saveIdempotencyRecord(
        createIdempotencyRecordForEvaluation({
          evaluationRequestId,
          registrationId: registration.id,
          createdAt: evaluatedAt,
          replay: replayPayload,
        })
      );
    } catch (error) {
      return eligibilityEvaluationServiceFail(operation, [mapRepositoryError(error)], {
        registrationId,
        decision,
        checkResults: decision.checkResults,
        evidence,
        auditEventId,
        evaluatedAt,
        evaluatorVersion: decision.evaluatorVersion,
        warnings,
        metadata: { auditAppended: true, idempotencyPersistFailed: true },
      });
    }

    return eligibilityEvaluationServiceOk({
      operation,
      registrationId,
      decision,
      checkResults: decision.checkResults,
      evidence,
      auditEventId,
      evaluatedAt,
      evaluatorVersion: decision.evaluatorVersion,
      replayed: false,
      idempotencyResult: "MISS",
      warnings,
    });
  }

  return {
    evaluateRegistrationEligibility,
  };
}

export {
  ELIGIBILITY_EVALUATION_OPERATION,
  ELIGIBILITY_EVALUATION_OPERATION_VALUES,
  isEligibilityEvaluationOperation,
  ELIGIBILITY_EVALUATION_SYSTEM_ACTOR,
} from "./eligibilityEvaluationOperations.js";

export {
  eligibilityEvaluationServiceOk,
  eligibilityEvaluationServiceFail,
} from "./eligibilityEvaluationResult.js";

import { REGISTRATION_STATUS, isTerminalRegistrationStatus } from "../enums/registrationStatus.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  registrationEligibilityError,
} from "../errors/registrationEligibilityError.js";
import { createCompetitionRegistration } from "../contracts/competitionRegistration.js";
import { createRegistrationApplicant } from "../contracts/registrationApplicant.js";
import { createRegistrationTarget } from "../contracts/registrationTarget.js";
import { createRegistrationAuditEvent } from "../contracts/registrationEvidence.js";
import { isNonEmptyString, REGISTRATION_LIFECYCLE_SERVICE_VERSION } from "../contracts/shared.js";
import {
  applyRegistrationTransition,
  evaluateIdempotentSubmission,
  createIdempotencyRecordForRegistration,
  validateRegistrationTransition,
} from "../policies/index.js";
import { isClockPort } from "../ports/clockPort.js";
import { isIdGeneratorPort } from "../ports/idGeneratorPort.js";
import { matchesRegistrationRepositoryPort } from "../ports/registrationRepositoryPort.js";
import {
  REGISTRATION_LIFECYCLE_OPERATION,
  REGISTRATION_LIFECYCLE_SYSTEM_ACTOR,
} from "./registrationLifecycleOperations.js";
import {
  registrationLifecycleServiceFail,
  registrationLifecycleServiceOk,
} from "./registrationLifecycleResult.js";

/**
 * @typedef {Object} RegistrationLifecycleServiceDeps
 * @property {import('../ports/registrationRepositoryPort.js').RegistrationRepositoryPort} repository
 * @property {import('../ports/registrationAuditPort.js').RegistrationAuditPort} audit
 * @property {import('../ports/clockPort.js').ClockPort} clock
 * @property {import('../ports/idGeneratorPort.js').IdGeneratorPort} ids
 */

/**
 * @param {RegistrationLifecycleServiceDeps} deps
 */
function assertLifecycleDeps(deps) {
  if (!deps || typeof deps !== "object") {
    throw new TypeError("RegistrationLifecycleService requires deps object");
  }
  if (!matchesRegistrationRepositoryPort(deps.repository)) {
    throw new TypeError("RegistrationLifecycleService requires RegistrationRepositoryPort");
  }
  if (!deps.audit || typeof deps.audit.append !== "function") {
    throw new TypeError("RegistrationLifecycleService requires RegistrationAuditPort");
  }
  if (!isClockPort(deps.clock)) {
    throw new TypeError("RegistrationLifecycleService requires ClockPort");
  }
  if (!isIdGeneratorPort(deps.ids)) {
    throw new TypeError("RegistrationLifecycleService requires IdGeneratorPort");
  }
}

/**
 * @param {unknown} error
 * @param {string} path
 * @returns {import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue}
 */
function mapRepositoryError(error, path = "repository") {
  const code =
    error &&
    typeof error === "object" &&
    /** @type {{ code?: string }} */ (error).code === REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT
      ? REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT
      : error &&
          typeof error === "object" &&
          /** @type {{ code?: string }} */ (error).code ===
            REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_REGISTRATION
        ? REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_REGISTRATION
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
 * @param {RegistrationLifecycleServiceDeps} deps
 * @param {{
 *   operation: string,
 *   registration: import('../contracts/competitionRegistration.js').CompetitionRegistration,
 *   previousStatus: string,
 *   nextStatus: string,
 *   actorId?: string|null,
 *   requestId?: string|null,
 *   correlationId?: string|null,
 *   reason?: string|null,
 * }} input
 * @returns {Promise<{ auditEventId: string, event: import('../contracts/registrationEvidence.js').RegistrationAuditEvent }>}
 */
async function appendLifecycleAudit(deps, input) {
  const event = createRegistrationAuditEvent({
    id: deps.ids.nextId("audit"),
    registrationId: input.registration.id,
    competitionId: input.registration.competitionId,
    eventType: input.operation,
    operation: input.operation,
    occurredAt: deps.clock.nowIso(),
    actorId: input.actorId ?? null,
    fromStatus: input.previousStatus,
    toStatus: input.nextStatus,
    requestId: input.requestId ?? input.registration.registrationRequestId ?? null,
    correlationId: input.correlationId ?? null,
    reason: input.reason ?? null,
    serviceVersion: REGISTRATION_LIFECYCLE_SERVICE_VERSION,
  });
  await deps.audit.append(event);
  return { auditEventId: event.id, event };
}

/**
 * @param {RegistrationLifecycleServiceDeps} deps
 * @param {string} registrationId
 * @param {string} operation
 * @returns {Promise<
 *   | { ok: true, registration: import('../contracts/competitionRegistration.js').CompetitionRegistration }
 *   | { ok: false, result: import('./registrationLifecycleResult.js').RegistrationLifecycleServiceResult }
 * >}
 */
async function loadRegistration(deps, registrationId, operation) {
  if (!isNonEmptyString(registrationId)) {
    return {
      ok: false,
      result: registrationLifecycleServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "registrationId",
          "registrationId is required"
        ),
      ]),
    };
  }

  let registration;
  try {
    registration = await deps.repository.getById(String(registrationId).trim());
  } catch (error) {
    return {
      ok: false,
      result: registrationLifecycleServiceFail(operation, [mapRepositoryError(error)], {
        performedAt: deps.clock.nowIso(),
      }),
    };
  }

  if (!registration) {
    return {
      ok: false,
      result: registrationLifecycleServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.REGISTRATION_NOT_FOUND,
          "registrationId",
          `Registration not found: ${registrationId}`,
          { registrationId: String(registrationId).trim() }
        ),
      ]),
    };
  }

  return { ok: true, registration };
}

/**
 * @param {RegistrationLifecycleServiceDeps} deps
 * @param {{
 *   operation: string,
 *   registration: import('../contracts/competitionRegistration.js').CompetitionRegistration,
 *   toStatus: string,
 *   actorId?: string|null,
 *   requestId?: string|null,
 *   correlationId?: string|null,
 *   reason?: string|null,
 *   replayed?: boolean,
 *   idempotencyResult?: 'MISS'|'HIT'|'CONFLICT'|null,
 * }} input
 * @returns {Promise<import('./registrationLifecycleResult.js').RegistrationLifecycleServiceResult>}
 */
async function persistStatusTransition(deps, input) {
  const previousStatus = input.registration.status;
  const performedAt = deps.clock.nowIso();

  const validation = validateRegistrationTransition(previousStatus, input.toStatus);
  if (!validation.ok) {
    return registrationLifecycleServiceFail(input.operation, validation.errors, {
      registration: input.registration,
      previousStatus,
      currentStatus: previousStatus,
      performedAt,
      idempotencyResult: input.idempotencyResult ?? null,
    });
  }

  if (validation.value?.noop === true || previousStatus === input.toStatus) {
    if (isTerminalRegistrationStatus(previousStatus)) {
      return registrationLifecycleServiceFail(
        input.operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.TERMINAL_STATUS,
            "status",
            `Terminal status ${previousStatus} cannot transition to ${input.toStatus}`,
            { from: previousStatus, to: input.toStatus }
          ),
        ],
        {
          registration: input.registration,
          previousStatus,
          currentStatus: previousStatus,
          performedAt,
          idempotencyResult: input.idempotencyResult ?? null,
        }
      );
    }
    return registrationLifecycleServiceOk({
      operation: input.operation,
      registration: input.registration,
      previousStatus,
      currentStatus: previousStatus,
      performedAt,
      replayed: input.replayed === true,
      idempotencyResult: input.idempotencyResult ?? null,
      auditEventId: null,
    });
  }

  const transitioned = applyRegistrationTransition(input.registration, input.toStatus, {
    clockNow: performedAt,
    decidedBy: input.actorId ?? null,
    reason: input.reason ?? null,
  });

  let saved;
  try {
    saved = await deps.repository.save(transitioned);
  } catch (error) {
    return registrationLifecycleServiceFail(input.operation, [mapRepositoryError(error)], {
      registration: input.registration,
      previousStatus,
      currentStatus: previousStatus,
      performedAt,
      idempotencyResult: input.idempotencyResult ?? null,
    });
  }

  try {
    const audit = await appendLifecycleAudit(deps, {
      operation: input.operation,
      registration: saved,
      previousStatus,
      nextStatus: input.toStatus,
      actorId: input.actorId ?? null,
      requestId: input.requestId ?? null,
      correlationId: input.correlationId ?? null,
      reason: input.reason ?? null,
    });
    return registrationLifecycleServiceOk({
      operation: input.operation,
      registration: saved,
      previousStatus,
      currentStatus: saved.status,
      auditEventId: audit.auditEventId,
      performedAt,
      replayed: false,
      idempotencyResult: input.idempotencyResult ?? null,
    });
  } catch (error) {
    return registrationLifecycleServiceFail(
      input.operation,
      [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_APPEND_FAILED,
          "audit",
          error instanceof Error ? error.message : "Audit append failed after persistence",
          {
            registrationId: saved.id,
            previousStatus,
            nextStatus: input.toStatus,
            persisted: true,
          }
        ),
      ],
      {
        registration: saved,
        previousStatus,
        currentStatus: saved.status,
        performedAt,
        idempotencyResult: input.idempotencyResult ?? null,
        metadata: { persistedWithoutAudit: true },
      }
    );
  }
}

/**
 * @param {RegistrationLifecycleServiceDeps} deps
 * @returns {{
 *   createDraftRegistration: Function,
 *   submitRegistration: Function,
 *   beginRegistrationReview: Function,
 *   withdrawRegistration: Function,
 *   cancelRegistration: Function,
 *   expireRegistration: Function,
 * }}
 */
export function createRegistrationLifecycleService(deps) {
  assertLifecycleDeps(deps);

  /**
   * @param {{
   *   competitionId: string,
   *   applicant: import('../contracts/registrationApplicant.js').RegistrationApplicant | Record<string, unknown>,
   *   target: import('../contracts/registrationTarget.js').RegistrationTarget | Record<string, unknown>,
   *   registrationRequestId: string,
   *   idempotencyKey: string,
   *   divisionId?: string|null,
   *   requestFingerprint?: Record<string, unknown>|null,
   *   actorId?: string|null,
   *   correlationId?: string|null,
   *   metadata?: Record<string, unknown>|null,
   *   formatHint?: string|null,
   * }} request
   */
  async function createDraftRegistration(request) {
    const operation = REGISTRATION_LIFECYCLE_OPERATION.CREATE_DRAFT;
    const performedAt = deps.clock.nowIso();

    if (!isNonEmptyString(request?.competitionId)) {
      return registrationLifecycleServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "competitionId",
          "competitionId is required"
        ),
      ]);
    }
    if (!isNonEmptyString(request?.registrationRequestId)) {
      return registrationLifecycleServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "registrationRequestId",
          "registrationRequestId is required"
        ),
      ]);
    }
    if (!isNonEmptyString(request?.idempotencyKey)) {
      return registrationLifecycleServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "idempotencyKey",
          "idempotencyKey is required"
        ),
      ]);
    }

    let target;
    try {
      target = createRegistrationTarget(request.target);
    } catch (error) {
      return registrationLifecycleServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TARGET,
          "target",
          error instanceof Error ? error.message : "Invalid registration target"
        ),
      ]);
    }

    let applicant;
    try {
      applicant = createRegistrationApplicant(request.applicant);
    } catch (error) {
      return registrationLifecycleServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.REQUIRED,
          "applicant",
          error instanceof Error ? error.message : "Invalid registration applicant"
        ),
      ]);
    }

    const idempotencyKey = String(request.idempotencyKey).trim();
    let existingRecord;
    try {
      existingRecord = await deps.repository.findIdempotencyRecord(idempotencyKey);
    } catch (error) {
      return registrationLifecycleServiceFail(operation, [mapRepositoryError(error)], {
        performedAt,
      });
    }

    const idemEval = evaluateIdempotentSubmission(
      {
        idempotencyKey,
        registrationRequestId: request.registrationRequestId,
        competitionId: request.competitionId,
        divisionId: request.divisionId ?? null,
        target,
        requestFingerprint: request.requestFingerprint ?? null,
      },
      existingRecord
    );

    if (!idemEval.ok) {
      return registrationLifecycleServiceFail(operation, idemEval.errors, {
        performedAt,
        idempotencyResult: "CONFLICT",
      });
    }

    if (idemEval.value?.kind === "HIT") {
      const loaded = await loadRegistration(
        deps,
        String(idemEval.value.registrationId),
        operation
      );
      if (!loaded.ok) {
        return {
          ...loaded.result,
          idempotencyResult: "HIT",
          replayed: true,
        };
      }
      return registrationLifecycleServiceOk({
        operation,
        registration: loaded.registration,
        previousStatus: loaded.registration.status,
        currentStatus: loaded.registration.status,
        idempotencyResult: "HIT",
        performedAt,
        replayed: true,
        auditEventId: null,
      });
    }

    const registrationId = deps.ids.nextId("reg");
    let registration;
    try {
      registration = createCompetitionRegistration({
        id: registrationId,
        registrationRequestId: request.registrationRequestId,
        idempotencyKey,
        competitionId: request.competitionId,
        divisionId: request.divisionId ?? null,
        status: REGISTRATION_STATUS.DRAFT,
        target,
        applicant,
        metadata: request.metadata ?? null,
        formatHint: request.formatHint ?? undefined,
        audit: {
          createdAt: performedAt,
          createdBy: request.actorId ?? null,
          updatedAt: performedAt,
          updatedBy: request.actorId ?? null,
        },
      });
    } catch (error) {
      return registrationLifecycleServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
          "registration",
          error instanceof Error ? error.message : "Failed to create registration"
        ),
      ]);
    }

    let saved;
    try {
      saved = await deps.repository.save(registration);
    } catch (error) {
      return registrationLifecycleServiceFail(operation, [mapRepositoryError(error)], {
        registration,
        previousStatus: null,
        currentStatus: REGISTRATION_STATUS.DRAFT,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    const idempotencyRecord = createIdempotencyRecordForRegistration({
      registrationId: saved.id,
      createdAt: performedAt,
      competitionId: request.competitionId,
      divisionId: request.divisionId ?? null,
      target,
      registrationRequestId: request.registrationRequestId,
      idempotencyKey,
      requestFingerprint: request.requestFingerprint ?? null,
    });

    try {
      await deps.repository.saveIdempotencyRecord(idempotencyRecord);
    } catch (error) {
      return registrationLifecycleServiceFail(operation, [mapRepositoryError(error)], {
        registration: saved,
        previousStatus: null,
        currentStatus: saved.status,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    try {
      const audit = await appendLifecycleAudit(deps, {
        operation,
        registration: saved,
        previousStatus: null,
        nextStatus: REGISTRATION_STATUS.DRAFT,
        actorId: request.actorId ?? null,
        requestId: request.registrationRequestId,
        correlationId: request.correlationId ?? null,
      });
      return registrationLifecycleServiceOk({
        operation,
        registration: saved,
        previousStatus: null,
        currentStatus: saved.status,
        idempotencyResult: "MISS",
        auditEventId: audit.auditEventId,
        performedAt,
        replayed: false,
      });
    } catch (error) {
      return registrationLifecycleServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_APPEND_FAILED,
            "audit",
            error instanceof Error ? error.message : "Audit append failed after persistence",
            { registrationId: saved.id, persisted: true }
          ),
        ],
        {
          registration: saved,
          previousStatus: null,
          currentStatus: saved.status,
          performedAt,
          idempotencyResult: "MISS",
          metadata: { persistedWithoutAudit: true },
        }
      );
    }
  }

  /**
   * @param {{
   *   registrationId: string,
   *   actorId?: string|null,
   *   correlationId?: string|null,
   *   requestId?: string|null,
   *   idempotencyKey?: string|null,
   *   requestFingerprint?: Record<string, unknown>|null,
   * }} request
   */
  async function submitRegistration(request) {
    const operation = REGISTRATION_LIFECYCLE_OPERATION.SUBMIT;
    const performedAt = deps.clock.nowIso();

    const loaded = await loadRegistration(deps, request?.registrationId, operation);
    if (!loaded.ok) {
      return loaded.result;
    }

    let registration = loaded.registration;

    if (isNonEmptyString(request?.idempotencyKey)) {
      let existingRecord;
      try {
        existingRecord = await deps.repository.findIdempotencyRecord(String(request.idempotencyKey).trim());
      } catch (error) {
        return registrationLifecycleServiceFail(operation, [mapRepositoryError(error)], {
          registration,
          performedAt,
        });
      }

      const idemEval = evaluateIdempotentSubmission(
        {
          idempotencyKey: String(request.idempotencyKey).trim(),
          registrationRequestId: registration.registrationRequestId,
          competitionId: registration.competitionId,
          divisionId: registration.divisionId,
          target: registration.target,
          requestFingerprint: request.requestFingerprint ?? null,
        },
        existingRecord
      );

      if (!idemEval.ok) {
        return registrationLifecycleServiceFail(operation, idemEval.errors, {
          registration,
          performedAt,
          idempotencyResult: "CONFLICT",
        });
      }

      if (idemEval.value?.kind === "HIT" && idemEval.value.registrationId !== registration.id) {
        return registrationLifecycleServiceFail(
          operation,
          [
            registrationEligibilityError(
              REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT,
              "idempotencyKey",
              "Idempotency key is bound to a different registration",
              {
                idempotencyKey: String(request.idempotencyKey).trim(),
                existingRegistrationId: idemEval.value.registrationId,
                registrationId: registration.id,
              }
            ),
          ],
          { registration, performedAt, idempotencyResult: "CONFLICT" }
        );
      }
    }

    if (registration.status === REGISTRATION_STATUS.SUBMITTED) {
      return registrationLifecycleServiceOk({
        operation,
        registration,
        previousStatus: registration.status,
        currentStatus: registration.status,
        performedAt,
        replayed: true,
        auditEventId: null,
        idempotencyResult: isNonEmptyString(request?.idempotencyKey) ? "HIT" : null,
      });
    }

    if (registration.status !== REGISTRATION_STATUS.DRAFT) {
      const validation = validateRegistrationTransition(
        registration.status,
        REGISTRATION_STATUS.SUBMITTED
      );
      return registrationLifecycleServiceFail(
        operation,
        validation.ok
          ? []
          : validation.errors,
        {
          registration,
          previousStatus: registration.status,
          currentStatus: registration.status,
          performedAt,
        }
      );
    }

    const transitioned = applyRegistrationTransition(registration, REGISTRATION_STATUS.SUBMITTED, {
      clockNow: performedAt,
      decidedBy: request?.actorId ?? null,
    });

    let saved;
    try {
      saved = await deps.repository.save(transitioned);
    } catch (error) {
      return registrationLifecycleServiceFail(operation, [mapRepositoryError(error)], {
        registration,
        previousStatus: registration.status,
        currentStatus: registration.status,
        performedAt,
      });
    }

    try {
      const audit = await appendLifecycleAudit(deps, {
        operation,
        registration: saved,
        previousStatus: REGISTRATION_STATUS.DRAFT,
        nextStatus: REGISTRATION_STATUS.SUBMITTED,
        actorId: request?.actorId ?? null,
        requestId: request?.requestId ?? saved.registrationRequestId,
        correlationId: request?.correlationId ?? null,
      });
      return registrationLifecycleServiceOk({
        operation,
        registration: saved,
        previousStatus: REGISTRATION_STATUS.DRAFT,
        currentStatus: saved.status,
        auditEventId: audit.auditEventId,
        performedAt,
        replayed: false,
        idempotencyResult: isNonEmptyString(request?.idempotencyKey) ? "MISS" : null,
      });
    } catch (error) {
      return registrationLifecycleServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_APPEND_FAILED,
            "audit",
            error instanceof Error ? error.message : "Audit append failed after persistence",
            {
              registrationId: saved.id,
              previousStatus: REGISTRATION_STATUS.DRAFT,
              nextStatus: REGISTRATION_STATUS.SUBMITTED,
              persisted: true,
            }
          ),
        ],
        {
          registration: saved,
          previousStatus: REGISTRATION_STATUS.DRAFT,
          currentStatus: saved.status,
          performedAt,
          metadata: { persistedWithoutAudit: true },
        }
      );
    }
  }

  /**
   * @param {{
   *   registrationId: string,
   *   actorId?: string|null,
   *   correlationId?: string|null,
   *   requestId?: string|null,
   * }} request
   */
  async function beginRegistrationReview(request) {
    const operation = REGISTRATION_LIFECYCLE_OPERATION.BEGIN_REVIEW;
    const loaded = await loadRegistration(deps, request?.registrationId, operation);
    if (!loaded.ok) {
      return loaded.result;
    }

    return persistStatusTransition(deps, {
      operation,
      registration: loaded.registration,
      toStatus: REGISTRATION_STATUS.UNDER_REVIEW,
      actorId: request?.actorId ?? null,
      requestId: request?.requestId ?? null,
      correlationId: request?.correlationId ?? null,
    });
  }

  /**
   * @param {{
   *   registrationId: string,
   *   actorId?: string|null,
   *   correlationId?: string|null,
   *   requestId?: string|null,
   *   reason?: string|null,
   * }} request
   */
  async function withdrawRegistration(request) {
    const operation = REGISTRATION_LIFECYCLE_OPERATION.WITHDRAW;
    const loaded = await loadRegistration(deps, request?.registrationId, operation);
    if (!loaded.ok) {
      return loaded.result;
    }

    return persistStatusTransition(deps, {
      operation,
      registration: loaded.registration,
      toStatus: REGISTRATION_STATUS.WITHDRAWN,
      actorId: request?.actorId ?? null,
      requestId: request?.requestId ?? null,
      correlationId: request?.correlationId ?? null,
      reason: request?.reason ?? null,
    });
  }

  /**
   * @param {{
   *   registrationId: string,
   *   actorId?: string|null,
   *   correlationId?: string|null,
   *   requestId?: string|null,
   *   reason?: string|null,
   * }} request
   */
  async function cancelRegistration(request) {
    const operation = REGISTRATION_LIFECYCLE_OPERATION.CANCEL;
    const loaded = await loadRegistration(deps, request?.registrationId, operation);
    if (!loaded.ok) {
      return loaded.result;
    }

    return persistStatusTransition(deps, {
      operation,
      registration: loaded.registration,
      toStatus: REGISTRATION_STATUS.CANCELLED,
      actorId: request?.actorId ?? null,
      requestId: request?.requestId ?? null,
      correlationId: request?.correlationId ?? null,
      reason: request?.reason ?? null,
    });
  }

  /**
   * @param {{
   *   registrationId: string,
   *   actorId?: string|null,
   *   correlationId?: string|null,
   *   requestId?: string|null,
   *   reason?: string|null,
   * }} request
   */
  async function expireRegistration(request) {
    const operation = REGISTRATION_LIFECYCLE_OPERATION.EXPIRE;
    const loaded = await loadRegistration(deps, request?.registrationId, operation);
    if (!loaded.ok) {
      return loaded.result;
    }

    return persistStatusTransition(deps, {
      operation,
      registration: loaded.registration,
      toStatus: REGISTRATION_STATUS.EXPIRED,
      actorId: request?.actorId ?? REGISTRATION_LIFECYCLE_SYSTEM_ACTOR,
      requestId: request?.requestId ?? null,
      correlationId: request?.correlationId ?? null,
      reason: request?.reason ?? null,
    });
  }

  return {
    createDraftRegistration,
    submitRegistration,
    beginRegistrationReview,
    withdrawRegistration,
    cancelRegistration,
    expireRegistration,
  };
}

export {
  REGISTRATION_LIFECYCLE_OPERATION,
  REGISTRATION_LIFECYCLE_SYSTEM_ACTOR,
} from "./registrationLifecycleOperations.js";

export {
  registrationLifecycleServiceOk,
  registrationLifecycleServiceFail,
} from "./registrationLifecycleResult.js";

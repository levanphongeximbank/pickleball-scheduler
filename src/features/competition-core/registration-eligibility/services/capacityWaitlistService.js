import { REGISTRATION_STATUS } from "../enums/registrationStatus.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import { registrationEligibilityError } from "../errors/registrationEligibilityError.js";
import {
  createCapacityReservation,
  createRegistrationCapacitySnapshot,
  createRegistrationWaitlistPosition,
  createWaitlistEntry,
} from "../contracts/capacity.js";
import { createRegistrationAuditEvent } from "../contracts/registrationEvidence.js";
import {
  CAPACITY_WAITLIST_SERVICE_VERSION,
  isNonEmptyString,
} from "../contracts/shared.js";
import {
  applyRegistrationTransition,
  validateRegistrationTransition,
} from "../policies/registrationTransitions.js";
import {
  computeEffectiveRemaining,
  hasAvailableCapacity,
  normalizePriorityRank,
  validateCapacityCounts,
} from "../policies/capacityAccounting.js";
import {
  calculateWaitlistPositions,
  sortWaitlistEntries,
} from "../policies/waitlistOrderingPolicy.js";
import {
  CAPACITY_IDEMPOTENCY_NAMESPACE,
  buildCanonicalCapacityRequestFingerprint,
  buildCapacityIdempotencyKey,
  createIdempotencyRecordForCapacity,
  evaluateIdempotentCapacityRequest,
} from "../policies/capacityIdempotencyPolicy.js";
import {
  CAPACITY_AUTH_PURPOSE,
  resolveWaitlistPlacementPermit,
  validatePromotionAuthorization,
} from "../policies/capacityAuthorizationPolicy.js";
import { isClockPort } from "../ports/clockPort.js";
import { isIdGeneratorPort } from "../ports/idGeneratorPort.js";
import { matchesRegistrationRepositoryPort } from "../ports/registrationRepositoryPort.js";
import { matchesCapacityStateRepositoryPort } from "../ports/capacityStateRepositoryPort.js";
import { matchesCapacityReservationRepositoryPort } from "../ports/capacityReservationRepositoryPort.js";
import { matchesWaitlistRepositoryPort } from "../ports/waitlistRepositoryPort.js";
import {
  CAPACITY_VALID_ELIGIBILITY_OUTCOMES,
  matchesEligibilityEvidenceLookupPort,
} from "../ports/eligibilityEvidenceLookupPort.js";
import {
  CAPACITY_WAITLIST_OPERATION,
  CAPACITY_WAITLIST_SYSTEM_ACTOR,
} from "./capacityWaitlistOperations.js";
import {
  capacityWaitlistServiceFail,
  capacityWaitlistServiceOk,
} from "./capacityWaitlistResult.js";

/**
 * @typedef {Object} CapacityWaitlistServiceDeps
 * @property {import('../ports/registrationRepositoryPort.js').RegistrationRepositoryPort} repository
 * @property {import('../ports/registrationAuditPort.js').RegistrationAuditPort} audit
 * @property {import('../ports/clockPort.js').ClockPort} clock
 * @property {import('../ports/idGeneratorPort.js').IdGeneratorPort} ids
 * @property {ReturnType<import('../ports/capacityStateRepositoryPort.js').createInMemoryCapacityStateRepositoryPort>} capacityState
 * @property {ReturnType<import('../ports/capacityReservationRepositoryPort.js').createInMemoryCapacityReservationRepositoryPort>} capacityReservations
 * @property {ReturnType<import('../ports/waitlistRepositoryPort.js').createInMemoryWaitlistRepositoryPort>} waitlist
 * @property {{ getLatestByRegistrationId: Function }} eligibilityEvidence
 * @property {{ getRegistrationPolicy?: Function }|null} [competitionPolicy]
 */

/**
 * @param {CapacityWaitlistServiceDeps} deps
 */
function assertCapacityDeps(deps) {
  if (!deps || typeof deps !== "object") {
    throw new TypeError("CapacityWaitlistService requires deps object");
  }
  if (!matchesRegistrationRepositoryPort(deps.repository)) {
    throw new TypeError("CapacityWaitlistService requires RegistrationRepositoryPort");
  }
  if (!deps.audit || typeof deps.audit.append !== "function") {
    throw new TypeError("CapacityWaitlistService requires RegistrationAuditPort");
  }
  if (!isClockPort(deps.clock)) {
    throw new TypeError("CapacityWaitlistService requires ClockPort");
  }
  if (!isIdGeneratorPort(deps.ids)) {
    throw new TypeError("CapacityWaitlistService requires IdGeneratorPort");
  }
  if (!matchesCapacityStateRepositoryPort(deps.capacityState)) {
    throw new TypeError("CapacityWaitlistService requires CapacityStateRepositoryPort");
  }
  if (!matchesCapacityReservationRepositoryPort(deps.capacityReservations)) {
    throw new TypeError("CapacityWaitlistService requires CapacityReservationRepositoryPort");
  }
  if (!matchesWaitlistRepositoryPort(deps.waitlist)) {
    throw new TypeError("CapacityWaitlistService requires WaitlistRepositoryPort");
  }
  if (!matchesEligibilityEvidenceLookupPort(deps.eligibilityEvidence)) {
    throw new TypeError("CapacityWaitlistService requires EligibilityEvidenceLookupPort");
  }
  if (
    deps.competitionPolicy != null &&
    typeof deps.competitionPolicy.getRegistrationPolicy !== "function"
  ) {
    throw new TypeError(
      "CapacityWaitlistService competitionPolicy must expose getRegistrationPolicy"
    );
  }
}

/**
 * @param {Partial<{
 *   registrationTransitionPersisted: boolean,
 *   capacityCountersPersisted: boolean,
 *   capacityReservationPersisted: boolean,
 *   waitlistEntryPersisted: boolean,
 *   auditPersisted: boolean,
 *   idempotencyRecordPersisted: boolean,
 *   persistedWithoutAudit: boolean,
 *   reconciliationRequired: boolean,
 * }>} flags
 */
function partialSuccessMetadata(flags = {}) {
  return {
    registrationTransitionPersisted: flags.registrationTransitionPersisted === true,
    capacityCountersPersisted: flags.capacityCountersPersisted === true,
    capacityReservationPersisted: flags.capacityReservationPersisted === true,
    waitlistEntryPersisted: flags.waitlistEntryPersisted === true,
    auditPersisted: flags.auditPersisted === true,
    idempotencyRecordPersisted: flags.idempotencyRecordPersisted === true,
    persistedWithoutAudit: flags.persistedWithoutAudit === true,
    reconciliationRequired:
      flags.reconciliationRequired === true ||
      flags.persistedWithoutAudit === true ||
      (flags.capacityCountersPersisted === true && flags.capacityReservationPersisted !== true) ||
      (flags.registrationTransitionPersisted === true && flags.waitlistEntryPersisted !== true),
  };
}

/**
 * @param {unknown} error
 * @param {string} path
 */
function mapPortError(error, path = "port") {
  const explicitCode =
    error && typeof error === "object" && /** @type {{ code?: string }} */ (error).code
      ? String(/** @type {{ code: string }} */ (error).code)
      : null;
  const code =
    path === "audit"
      ? REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_APPEND_FAILED
      : explicitCode || REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED;

  return registrationEligibilityError(
    code,
    path,
    error instanceof Error ? error.message : "Port operation failed",
    error &&
      typeof error === "object" &&
      /** @type {{ metadata?: Record<string, unknown> }} */ (error).metadata
      ? { .../** @type {{ metadata: Record<string, unknown> }} */ (error).metadata }
      : undefined
  );
}

/**
 * @param {CapacityWaitlistServiceDeps} deps
 * @param {string} registrationId
 * @param {string} operation
 */
async function loadRegistration(deps, registrationId, operation) {
  if (!isNonEmptyString(registrationId)) {
    return {
      ok: false,
      result: capacityWaitlistServiceFail(operation, [
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
      result: capacityWaitlistServiceFail(operation, [mapPortError(error, "repository")], {
        performedAt: deps.clock.nowIso(),
      }),
    };
  }
  if (!registration) {
    return {
      ok: false,
      result: capacityWaitlistServiceFail(operation, [
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
 * @param {CapacityWaitlistServiceDeps} deps
 * @param {{
 *   competitionId: string,
 *   divisionId?: string|null,
 *   snapshotId?: string|null,
 * }} input
 */
async function buildCapacitySnapshot(deps, input) {
  const competitionId = String(input.competitionId).trim();
  const divisionId =
    input.divisionId != null && String(input.divisionId).trim() !== ""
      ? String(input.divisionId).trim()
      : null;

  const competitionState = await deps.capacityState.getState(competitionId, null);
  const divisionState = divisionId
    ? await deps.capacityState.getState(competitionId, divisionId)
    : null;

  const competitionCheck = validateCapacityCounts(
    competitionState.limit,
    competitionState.used,
    competitionState.reserved
  );
  if (!competitionCheck.ok) {
    return { ok: false, errors: competitionCheck.errors };
  }

  if (divisionState) {
    const divisionCheck = validateCapacityCounts(
      divisionState.limit,
      divisionState.used,
      divisionState.reserved
    );
    if (!divisionCheck.ok) {
      return { ok: false, errors: divisionCheck.errors };
    }
  }

  const waitlistEntries = await deps.waitlist.listActive(competitionId, divisionId);
  const competitionRemaining = competitionCheck.value.remaining;
  const divisionRemaining = divisionState
    ? validateCapacityCounts(divisionState.limit, divisionState.used, divisionState.reserved)
        .value.remaining
    : null;
  const effectiveRemaining = computeEffectiveRemaining(
    competitionRemaining,
    divisionRemaining,
    { applyDivision: Boolean(divisionId) }
  );

  const stateVersion = Math.max(
    competitionState.stateVersion || 0,
    divisionState?.stateVersion || 0
  );

  const calculatedAt = deps.clock.nowIso();
  const snapshot = createRegistrationCapacitySnapshot({
    snapshotId: input.snapshotId ?? deps.ids.nextId("cap-snap"),
    competitionId,
    divisionId,
    competitionLimit: competitionState.limit,
    competitionUsed: competitionState.used,
    competitionReserved: competitionState.reserved,
    competitionRemaining,
    divisionLimit: divisionState ? divisionState.limit : null,
    divisionUsed: divisionState ? divisionState.used : 0,
    divisionReserved: divisionState ? divisionState.reserved : 0,
    divisionRemaining,
    effectiveRemaining,
    waitlistCount: waitlistEntries.length,
    capturedAt: calculatedAt,
    sourceVersion: stateVersion,
    stateVersion,
  });

  return { ok: true, snapshot, competitionState, divisionState, waitlistEntries };
}

/**
 * @param {CapacityWaitlistServiceDeps} deps
 * @param {object} input
 */
async function appendCapacityAudit(deps, input) {
  const event = createRegistrationAuditEvent({
    id: deps.ids.nextId("audit"),
    registrationId: input.registrationId,
    competitionId: input.competitionId,
    eventType: input.operation,
    operation: input.operation,
    occurredAt: deps.clock.nowIso(),
    actorId: input.actorId ?? CAPACITY_WAITLIST_SYSTEM_ACTOR,
    fromStatus: input.previousStatus ?? null,
    toStatus: input.nextStatus ?? null,
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    reason: input.reason ?? null,
    serviceVersion: CAPACITY_WAITLIST_SERVICE_VERSION,
    payload: {
      divisionId: input.divisionId ?? null,
      capacitySnapshotId: input.capacitySnapshotId ?? null,
      reservationId: input.reservationId ?? null,
      waitlistEntryId: input.waitlistEntryId ?? null,
      previousWaitlistPosition: input.previousWaitlistPosition ?? null,
      nextWaitlistPosition: input.nextWaitlistPosition ?? null,
      stateVersion: input.stateVersion ?? null,
      ...(input.payload || {}),
    },
  });
  await deps.audit.append(event);
  return { auditEventId: event.id, event };
}

/**
 * @param {import('../contracts/eligibilityEvaluationEvidence.js').EligibilityEvaluationEvidence|null} evidence
 * @param {{ maxAgeMs?: number|null, nowIso?: string }} [opts]
 */
function validateEligibilityEvidence(evidence, opts = {}) {
  if (!evidence) {
    return {
      ok: false,
      errors: [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.ELIGIBILITY_EVIDENCE_MISSING,
          "eligibilityEvidence",
          "Eligibility evidence is required"
        ),
      ],
    };
  }
  if (!CAPACITY_VALID_ELIGIBILITY_OUTCOMES.has(evidence.outcome)) {
    return {
      ok: false,
      errors: [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_PROMOTION_PRECONDITION,
          "eligibilityEvidence.outcome",
          `Eligibility outcome ${evidence.outcome} is not valid for capacity operations`,
          { outcome: evidence.outcome }
        ),
      ],
    };
  }
  if (opts.maxAgeMs != null && opts.nowIso && evidence.evaluatedAt) {
    const evaluatedMs = Date.parse(evidence.evaluatedAt);
    const nowMs = Date.parse(opts.nowIso);
    if (
      Number.isFinite(evaluatedMs) &&
      Number.isFinite(nowMs) &&
      nowMs - evaluatedMs > Number(opts.maxAgeMs)
    ) {
      return {
        ok: false,
        errors: [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.ELIGIBILITY_EVIDENCE_STALE,
            "eligibilityEvidence.evaluatedAt",
            "Eligibility evidence is stale",
            { evaluatedAt: evidence.evaluatedAt, nowIso: opts.nowIso }
          ),
        ],
      };
    }
  }
  return { ok: true, evidence };
}

/**
 * @param {CapacityWaitlistServiceDeps} deps
 * @param {{
 *   namespace: string,
 *   requestId: string,
 *   registrationId: string,
 *   competitionId: string,
 *   divisionId?: string|null,
 *   canonicalFingerprint: Record<string, unknown>,
 *   operation: string,
 * }} input
 */
async function resolveIdempotency(deps, input) {
  const key = buildCapacityIdempotencyKey(input.namespace, input.requestId);
  let existing;
  try {
    existing = await deps.repository.findIdempotencyRecord(key);
  } catch (error) {
    return {
      ok: false,
      result: capacityWaitlistServiceFail(input.operation, [mapPortError(error, "idempotency")], {
        performedAt: deps.clock.nowIso(),
        idempotencyResult: "CONFLICT",
      }),
    };
  }

  const evaluation = evaluateIdempotentCapacityRequest(
    {
      requestId: input.requestId,
      namespace: input.namespace,
      registrationId: input.registrationId,
      canonicalFingerprint: input.canonicalFingerprint,
    },
    existing
  );

  if (!evaluation.ok) {
    return {
      ok: false,
      result: capacityWaitlistServiceFail(input.operation, evaluation.errors, {
        performedAt: deps.clock.nowIso(),
        idempotencyResult: "CONFLICT",
      }),
    };
  }

  if (evaluation.value.kind === "HIT") {
    const replay = evaluation.value.replay;
    return {
      ok: true,
      hit: true,
      result: capacityWaitlistServiceOk({
        operation: input.operation,
        registration: replay.registration ?? null,
        capacitySnapshot: replay.capacitySnapshot ?? null,
        reservation: replay.reservation ?? null,
        waitlistEntry: replay.waitlistEntry ?? null,
        waitlistPosition: replay.waitlistPosition ?? null,
        previousStatus: replay.previousStatus ?? null,
        currentStatus: replay.currentStatus ?? null,
        stateVersion: replay.stateVersion ?? null,
        idempotencyResult: "HIT",
        auditEventId: replay.auditEventId ?? null,
        performedAt: replay.performedAt ?? deps.clock.nowIso(),
        replayed: true,
      }),
    };
  }

  return { ok: true, hit: false, existing: null };
}

/**
 * @param {CapacityWaitlistServiceDeps} deps
 */
export function createCapacityWaitlistService(deps) {
  assertCapacityDeps(deps);

  async function evaluateRegistrationCapacity(request = {}) {
    const operation = CAPACITY_WAITLIST_OPERATION.EVALUATE_CAPACITY;
    const performedAt = deps.clock.nowIso();

    if (!isNonEmptyString(request.competitionId)) {
      return capacityWaitlistServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "competitionId",
          "competitionId is required"
        ),
      ]);
    }

    const built = await buildCapacitySnapshot(deps, {
      competitionId: request.competitionId,
      divisionId: request.divisionId ?? null,
    });
    if (!built.ok) {
      return capacityWaitlistServiceFail(operation, built.errors, { performedAt });
    }

    return capacityWaitlistServiceOk({
      operation,
      capacitySnapshot: built.snapshot,
      stateVersion: built.snapshot.stateVersion,
      performedAt,
      idempotencyResult: null,
    });
  }

  async function reserveRegistrationCapacity(request = {}) {
    const operation = CAPACITY_WAITLIST_OPERATION.RESERVE_CAPACITY;
    const performedAt = deps.clock.nowIso();

    if (!isNonEmptyString(request.requestId)) {
      return capacityWaitlistServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "requestId",
          "requestId is required"
        ),
      ]);
    }

    const loaded = await loadRegistration(deps, request.registrationId, operation);
    if (!loaded.ok) return loaded.result;
    const registration = loaded.registration;

    const competitionId = String(request.competitionId || registration.competitionId).trim();
    const divisionId =
      request.divisionId !== undefined
        ? request.divisionId != null && String(request.divisionId).trim() !== ""
          ? String(request.divisionId).trim()
          : null
        : registration.divisionId;

    if (competitionId !== registration.competitionId) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
            "competitionId",
            "competitionId does not match registration",
            { competitionId, registrationCompetitionId: registration.competitionId }
          ),
        ],
        { registration, performedAt }
      );
    }
    if ((divisionId || null) !== (registration.divisionId || null)) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
            "divisionId",
            "divisionId does not match registration",
            { divisionId, registrationDivisionId: registration.divisionId }
          ),
        ],
        { registration, performedAt }
      );
    }

    const fingerprint = buildCanonicalCapacityRequestFingerprint({
      registrationId: registration.id,
      competitionId,
      divisionId,
      operation: "RESERVE",
    });

    const idem = await resolveIdempotency(deps, {
      namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.RESERVE,
      requestId: request.requestId,
      registrationId: registration.id,
      competitionId,
      divisionId,
      canonicalFingerprint: fingerprint,
      operation,
    });
    if (!idem.ok) return idem.result;
    if (idem.hit) return idem.result;

    const existingReservation =
      await deps.capacityReservations.findActiveByRegistrationId(registration.id);
    if (existingReservation) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ACTIVE_RESERVATION,
            "registrationId",
            "Registration already holds an active capacity reservation",
            { reservationId: existingReservation.reservationId }
          ),
        ],
        { registration, reservation: existingReservation, performedAt, idempotencyResult: "MISS" }
      );
    }

    const evidence = await deps.eligibilityEvidence.getLatestByRegistrationId(registration.id);
    const evidenceCheck = validateEligibilityEvidence(evidence, {
      maxAgeMs: request.eligibilityMaxAgeMs ?? null,
      nowIso: performedAt,
    });
    if (!evidenceCheck.ok) {
      return capacityWaitlistServiceFail(operation, evidenceCheck.errors, {
        registration,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    const built = await buildCapacitySnapshot(deps, { competitionId, divisionId });
    if (!built.ok) {
      return capacityWaitlistServiceFail(operation, built.errors, {
        registration,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    if (!hasAvailableCapacity(built.snapshot.effectiveRemaining)) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.CAPACITY_EXHAUSTED,
            "capacity",
            "No remaining competition/division capacity",
            {
              effectiveRemaining: built.snapshot.effectiveRemaining,
              competitionRemaining: built.snapshot.competitionRemaining,
              divisionRemaining: built.snapshot.divisionRemaining,
            }
          ),
        ],
        {
          registration,
          capacitySnapshot: built.snapshot,
          performedAt,
          idempotencyResult: "MISS",
        }
      );
    }

    if (
      request.expectedStateVersion != null &&
      Number(request.expectedStateVersion) !== built.snapshot.stateVersion
    ) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_CAPACITY_VERSION,
            "expectedStateVersion",
            "Capacity state version is stale",
            {
              expectedStateVersion: Number(request.expectedStateVersion),
              actualStateVersion: built.snapshot.stateVersion,
            }
          ),
        ],
        {
          registration,
          capacitySnapshot: built.snapshot,
          performedAt,
          idempotencyResult: "MISS",
        }
      );
    }

    try {
      const competitionState = built.competitionState;
      await deps.capacityState.saveState(
        {
          ...competitionState,
          reserved: competitionState.reserved + 1,
          stateVersion: competitionState.stateVersion + 1,
          updatedAt: performedAt,
        },
        { expectedStateVersion: competitionState.stateVersion }
      );

      if (divisionId) {
        const divisionState = built.divisionState;
        await deps.capacityState.saveState(
          {
            ...divisionState,
            reserved: divisionState.reserved + 1,
            stateVersion: divisionState.stateVersion + 1,
            updatedAt: performedAt,
          },
          { expectedStateVersion: divisionState.stateVersion }
        );
      }
    } catch (error) {
      return capacityWaitlistServiceFail(operation, [mapPortError(error, "capacityState")], {
        registration,
        capacitySnapshot: built.snapshot,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    const reservation = createCapacityReservation({
      reservationId: deps.ids.nextId("cap-rsv"),
      registrationId: registration.id,
      competitionId,
      divisionId,
      status: "ACTIVE",
      reservedAt: performedAt,
      actorId: request.actorId ?? null,
      stateVersion: built.snapshot.stateVersion + 1,
      requestId: request.requestId,
    });

    try {
      await deps.capacityReservations.save(reservation);
    } catch (error) {
      return capacityWaitlistServiceFail(
        operation,
        [mapPortError(error, "capacityReservations")],
        {
          registration,
          performedAt,
          idempotencyResult: "MISS",
          metadata: partialSuccessMetadata({
            capacityCountersPersisted: true,
            capacityReservationPersisted: false,
            reconciliationRequired: true,
          }),
        }
      );
    }

    const after = await buildCapacitySnapshot(deps, { competitionId, divisionId });
    const capacitySnapshot = after.ok ? after.snapshot : built.snapshot;

    let auditEventId;
    try {
      const audit = await appendCapacityAudit(deps, {
        operation,
        registrationId: registration.id,
        competitionId,
        divisionId,
        previousStatus: registration.status,
        nextStatus: registration.status,
        actorId: request.actorId ?? null,
        requestId: request.requestId,
        correlationId: request.correlationId ?? null,
        reason: request.reason ?? "capacity reserved",
        capacitySnapshotId: capacitySnapshot.snapshotId,
        reservationId: reservation.reservationId,
        stateVersion: capacitySnapshot.stateVersion,
      });
      auditEventId = audit.auditEventId;
    } catch (error) {
      return capacityWaitlistServiceFail(operation, [mapPortError(error, "audit")], {
        registration,
        capacitySnapshot,
        reservation,
        performedAt,
        idempotencyResult: "MISS",
        metadata: partialSuccessMetadata({
          capacityCountersPersisted: true,
          capacityReservationPersisted: true,
          persistedWithoutAudit: true,
          reconciliationRequired: true,
        }),
      });
    }

    const replay = {
      kind: "CAPACITY_WAITLIST_REPLAY",
      namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.RESERVE,
      canonicalFingerprint: fingerprint,
      registrationId: registration.id,
      reservationId: reservation.reservationId,
      auditEventId,
      previousStatus: registration.status,
      currentStatus: registration.status,
      capacitySnapshot,
      reservation,
      waitlistEntry: null,
      waitlistPosition: null,
      registration,
      stateVersion: capacitySnapshot.stateVersion,
      performedAt,
    };

    try {
      await deps.repository.saveIdempotencyRecord(
        createIdempotencyRecordForCapacity({
          namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.RESERVE,
          requestId: request.requestId,
          registrationId: registration.id,
          competitionId,
          divisionId,
          createdAt: performedAt,
          replay,
        })
      );
    } catch (error) {
      return capacityWaitlistServiceFail(operation, [mapPortError(error, "idempotency")], {
        registration,
        capacitySnapshot,
        reservation,
        auditEventId,
        performedAt,
        idempotencyResult: "MISS",
        metadata: partialSuccessMetadata({
          capacityCountersPersisted: true,
          capacityReservationPersisted: true,
          auditPersisted: true,
          idempotencyRecordPersisted: false,
          reconciliationRequired: true,
        }),
      });
    }

    return capacityWaitlistServiceOk({
      operation,
      registration,
      capacitySnapshot,
      reservation,
      previousStatus: registration.status,
      currentStatus: registration.status,
      stateVersion: capacitySnapshot.stateVersion,
      idempotencyResult: "MISS",
      auditEventId,
      performedAt,
      replayed: false,
    });
  }

  async function releaseRegistrationCapacity(request = {}) {
    const operation = CAPACITY_WAITLIST_OPERATION.RELEASE_CAPACITY;
    const performedAt = deps.clock.nowIso();

    if (!isNonEmptyString(request.requestId)) {
      return capacityWaitlistServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "requestId",
          "requestId is required"
        ),
      ]);
    }

    const loaded = await loadRegistration(deps, request.registrationId, operation);
    if (!loaded.ok) return loaded.result;
    const registration = loaded.registration;

    const competitionId = String(request.competitionId || registration.competitionId).trim();
    const divisionId =
      request.divisionId !== undefined
        ? request.divisionId != null && String(request.divisionId).trim() !== ""
          ? String(request.divisionId).trim()
          : null
        : registration.divisionId;

    if (competitionId !== registration.competitionId) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
            "competitionId",
            "competitionId does not match registration"
          ),
        ],
        { registration, performedAt }
      );
    }
    if ((divisionId || null) !== (registration.divisionId || null)) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
            "divisionId",
            "divisionId does not match registration"
          ),
        ],
        { registration, performedAt }
      );
    }

    const fingerprint = buildCanonicalCapacityRequestFingerprint({
      registrationId: registration.id,
      competitionId,
      divisionId,
      operation: "RELEASE",
      reservationId: request.reservationId ?? null,
    });

    const idem = await resolveIdempotency(deps, {
      namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.RELEASE,
      requestId: request.requestId,
      registrationId: registration.id,
      competitionId,
      divisionId,
      canonicalFingerprint: fingerprint,
      operation,
    });
    if (!idem.ok) return idem.result;
    if (idem.hit) return idem.result;

    const reservation = isNonEmptyString(request.reservationId)
      ? await deps.capacityReservations.getById(String(request.reservationId).trim())
      : await deps.capacityReservations.findActiveByRegistrationId(registration.id);

    if (!reservation) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.CAPACITY_RESERVATION_NOT_FOUND,
            "reservationId",
            "Capacity reservation not found"
          ),
        ],
        { registration, performedAt, idempotencyResult: "MISS" }
      );
    }

    if (reservation.registrationId !== registration.id) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
            "reservationId",
            "Reservation registration mismatch"
          ),
        ],
        { registration, reservation, performedAt, idempotencyResult: "MISS" }
      );
    }
    if (reservation.competitionId !== competitionId) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
            "competitionId",
            "Reservation competition mismatch"
          ),
        ],
        { registration, reservation, performedAt, idempotencyResult: "MISS" }
      );
    }
    if ((reservation.divisionId || null) !== (divisionId || null)) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
            "divisionId",
            "Reservation division mismatch"
          ),
        ],
        { registration, reservation, performedAt, idempotencyResult: "MISS" }
      );
    }

    if (reservation.status === "RELEASED") {
      const built = await buildCapacitySnapshot(deps, { competitionId, divisionId });
      return capacityWaitlistServiceOk({
        operation,
        registration,
        capacitySnapshot: built.ok ? built.snapshot : null,
        reservation,
        previousStatus: registration.status,
        currentStatus: registration.status,
        stateVersion: built.ok ? built.snapshot.stateVersion : null,
        idempotencyResult: "MISS",
        auditEventId: null,
        performedAt,
        replayed: true,
        warnings: [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.CAPACITY_RESERVATION_NOT_FOUND,
            "reservation",
            "Reservation already released — idempotent no-op",
            { severityHint: "warning" }
          ),
        ],
        metadata: { alreadyReleased: true },
      });
    }

    try {
      const competitionState = await deps.capacityState.getState(competitionId, null);
      await deps.capacityState.saveState(
        {
          ...competitionState,
          reserved: Math.max(0, competitionState.reserved - 1),
          stateVersion: competitionState.stateVersion + 1,
          updatedAt: performedAt,
        },
        { expectedStateVersion: competitionState.stateVersion }
      );
      if (divisionId) {
        const divisionState = await deps.capacityState.getState(competitionId, divisionId);
        await deps.capacityState.saveState(
          {
            ...divisionState,
            reserved: Math.max(0, divisionState.reserved - 1),
            stateVersion: divisionState.stateVersion + 1,
            updatedAt: performedAt,
          },
          { expectedStateVersion: divisionState.stateVersion }
        );
      }
    } catch (error) {
      return capacityWaitlistServiceFail(operation, [mapPortError(error, "capacityState")], {
        registration,
        reservation,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    const released = createCapacityReservation({
      ...reservation,
      status: "RELEASED",
      releasedAt: performedAt,
      releaseReason: request.reason ?? "capacity released",
      actorId: request.actorId ?? reservation.actorId ?? null,
      stateVersion: reservation.stateVersion + 1,
    });
    await deps.capacityReservations.save(released);

    const after = await buildCapacitySnapshot(deps, { competitionId, divisionId });
    const capacitySnapshot = after.ok ? after.snapshot : null;

    let auditEventId;
    try {
      const audit = await appendCapacityAudit(deps, {
        operation,
        registrationId: registration.id,
        competitionId,
        divisionId,
        previousStatus: registration.status,
        nextStatus: registration.status,
        actorId: request.actorId ?? CAPACITY_WAITLIST_SYSTEM_ACTOR,
        requestId: request.requestId,
        correlationId: request.correlationId ?? null,
        reason: request.reason ?? "capacity released",
        capacitySnapshotId: capacitySnapshot?.snapshotId ?? null,
        reservationId: released.reservationId,
        stateVersion: capacitySnapshot?.stateVersion ?? null,
      });
      auditEventId = audit.auditEventId;
    } catch (error) {
      return capacityWaitlistServiceFail(operation, [mapPortError(error, "audit")], {
        registration,
        capacitySnapshot,
        reservation: released,
        performedAt,
        idempotencyResult: "MISS",
        metadata: partialSuccessMetadata({
          capacityCountersPersisted: true,
          capacityReservationPersisted: true,
          persistedWithoutAudit: true,
          reconciliationRequired: true,
        }),
      });
    }

    const replay = {
      kind: "CAPACITY_WAITLIST_REPLAY",
      namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.RELEASE,
      canonicalFingerprint: fingerprint,
      registrationId: registration.id,
      reservationId: released.reservationId,
      auditEventId,
      previousStatus: registration.status,
      currentStatus: registration.status,
      capacitySnapshot,
      reservation: released,
      waitlistEntry: null,
      waitlistPosition: null,
      registration,
      stateVersion: capacitySnapshot?.stateVersion ?? null,
      performedAt,
    };

    await deps.repository.saveIdempotencyRecord(
      createIdempotencyRecordForCapacity({
        namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.RELEASE,
        requestId: request.requestId,
        registrationId: registration.id,
        competitionId,
        divisionId,
        createdAt: performedAt,
        replay,
      })
    );

    return capacityWaitlistServiceOk({
      operation,
      registration,
      capacitySnapshot,
      reservation: released,
      previousStatus: registration.status,
      currentStatus: registration.status,
      stateVersion: capacitySnapshot?.stateVersion ?? null,
      idempotencyResult: "MISS",
      auditEventId,
      performedAt,
      replayed: false,
    });
  }

  async function placeRegistrationOnWaitlist(request = {}) {
    const operation = CAPACITY_WAITLIST_OPERATION.PLACE_ON_WAITLIST;
    const performedAt = deps.clock.nowIso();

    if (!isNonEmptyString(request.requestId)) {
      return capacityWaitlistServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "requestId",
          "requestId is required"
        ),
      ]);
    }

    const loaded = await loadRegistration(deps, request.registrationId, operation);
    if (!loaded.ok) return loaded.result;
    let registration = loaded.registration;
    const previousStatus = registration.status;
    const competitionId = registration.competitionId;
    const divisionId = registration.divisionId;

    const fingerprint = buildCanonicalCapacityRequestFingerprint({
      registrationId: registration.id,
      competitionId,
      divisionId,
      operation: "WAITLIST_PLACE",
      priorityRank: normalizePriorityRank(request.priorityRank),
    });

    const idem = await resolveIdempotency(deps, {
      namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.WAITLIST_PLACE,
      requestId: request.requestId,
      registrationId: registration.id,
      competitionId,
      divisionId,
      canonicalFingerprint: fingerprint,
      operation,
    });
    if (!idem.ok) return idem.result;
    if (idem.hit) return idem.result;

    const activeReservation =
      await deps.capacityReservations.findActiveByRegistrationId(registration.id);
    if (activeReservation) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ACTIVE_RESERVATION,
            "registrationId",
            "Cannot waitlist a registration that already holds capacity",
            { reservationId: activeReservation.reservationId }
          ),
        ],
        { registration, reservation: activeReservation, performedAt, idempotencyResult: "MISS" }
      );
    }

    const existingEntry = await deps.waitlist.findActiveByRegistrationId(registration.id);
    if (existingEntry) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.WAITLIST_ENTRY_ALREADY_EXISTS,
            "registrationId",
            "Registration already has an active waitlist entry",
            { waitlistEntryId: existingEntry.waitlistEntryId }
          ),
        ],
        { registration, waitlistEntry: existingEntry, performedAt, idempotencyResult: "MISS" }
      );
    }

    const transition = validateRegistrationTransition(
      registration.status,
      REGISTRATION_STATUS.WAITLISTED
    );
    if (!transition.ok) {
      return capacityWaitlistServiceFail(
        operation,
        transition.errors.map((e) =>
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_WAITLIST_TRANSITION,
            e.path || "status",
            e.message,
            e.metadata
          )
        ),
        { registration, performedAt, idempotencyResult: "MISS" }
      );
    }

    const built = await buildCapacitySnapshot(deps, { competitionId, divisionId });
    if (!built.ok) {
      return capacityWaitlistServiceFail(operation, built.errors, {
        registration,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    const competitionPolicy =
      deps.competitionPolicy && typeof deps.competitionPolicy.getRegistrationPolicy === "function"
        ? await deps.competitionPolicy.getRegistrationPolicy(competitionId)
        : null;

    const permit = resolveWaitlistPlacementPermit({
      effectiveRemaining: built.snapshot.effectiveRemaining,
      competitionPolicy,
      waitlistAuthorization: request.waitlistAuthorization,
      forceWaitlist: request.forceWaitlist,
      registrationId: registration.id,
      competitionId,
      divisionId,
    });
    if (!permit.ok) {
      return capacityWaitlistServiceFail(operation, permit.errors, {
        registration,
        capacitySnapshot: built.snapshot,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    if (request.requireEligibility !== false) {
      const evidence = await deps.eligibilityEvidence.getLatestByRegistrationId(registration.id);
      const evidenceCheck = validateEligibilityEvidence(evidence, {
        maxAgeMs: request.eligibilityMaxAgeMs ?? null,
        nowIso: performedAt,
      });
      if (!evidenceCheck.ok) {
        return capacityWaitlistServiceFail(operation, evidenceCheck.errors, {
          registration,
          capacitySnapshot: built.snapshot,
          performedAt,
          idempotencyResult: "MISS",
        });
      }
    }

    const placementActor =
      permit.authorization?.authorizedBy ??
      request.actorId ??
      CAPACITY_WAITLIST_SYSTEM_ACTOR;
    const placementReason =
      permit.authorization?.reason ??
      request.reason ??
      (permit.basis === "CAPACITY_EXHAUSTED"
        ? "placed on waitlist — capacity exhausted"
        : permit.basis === "POLICY_REQUIRED"
          ? "placed on waitlist — policy requireWaitlist"
          : "placed on waitlist — authorized");

    registration = applyRegistrationTransition(registration, REGISTRATION_STATUS.WAITLISTED, {
      clockNow: performedAt,
      decidedAt: performedAt,
      decidedBy: placementActor,
      reason: placementReason,
    });
    await deps.repository.save(registration);

    const waitlistEntry = createWaitlistEntry({
      waitlistEntryId: deps.ids.nextId("wl"),
      registrationId: registration.id,
      competitionId,
      divisionId,
      status: "ACTIVE",
      priorityRank: normalizePriorityRank(request.priorityRank),
      submittedAt: registration.submittedAt ?? null,
      waitlistedAt: performedAt,
      actorId: placementActor,
      requestId: request.requestId,
      metadata: {
        placementBasis: permit.basis,
        authorizationRef: permit.authorization?.authorizationRef ?? null,
      },
    });

    let savedEntry;
    try {
      savedEntry = await deps.waitlist.save(waitlistEntry);
    } catch (error) {
      return capacityWaitlistServiceFail(operation, [mapPortError(error, "waitlist")], {
        registration,
        capacitySnapshot: built.snapshot,
        performedAt,
        idempotencyResult: "MISS",
        metadata: partialSuccessMetadata({
          registrationTransitionPersisted: true,
          waitlistEntryPersisted: false,
          reconciliationRequired: true,
        }),
      });
    }

    const positions = calculateWaitlistPositions(
      await deps.waitlist.listActive(competitionId, divisionId),
      {
        calculatedAt: performedAt,
        waitlistVersion: savedEntry.waitlistVersion,
      }
    ).map((p) => createRegistrationWaitlistPosition(p));
    const waitlistPosition =
      positions.find((p) => p.registrationId === registration.id) || null;

    registration = {
      ...registration,
      waitlistPosition: waitlistPosition?.position ?? null,
    };
    await deps.repository.save(registration);

    const after = await buildCapacitySnapshot(deps, { competitionId, divisionId });
    const capacitySnapshot = after.ok ? after.snapshot : built.snapshot;

    let auditEventId;
    try {
      const audit = await appendCapacityAudit(deps, {
        operation,
        registrationId: registration.id,
        competitionId,
        divisionId,
        previousStatus,
        nextStatus: registration.status,
      actorId: placementActor,
      requestId: request.requestId,
      correlationId: request.correlationId ?? null,
      reason: placementReason,
      capacitySnapshotId: capacitySnapshot.snapshotId,
      waitlistEntryId: savedEntry.waitlistEntryId,
      nextWaitlistPosition: waitlistPosition?.position ?? null,
      stateVersion: capacitySnapshot.stateVersion,
      payload: {
        placementBasis: permit.basis,
        authorizationRef: permit.authorization?.authorizationRef ?? null,
      },
    });
      auditEventId = audit.auditEventId;
    } catch (error) {
      return capacityWaitlistServiceFail(operation, [mapPortError(error, "audit")], {
        registration,
        capacitySnapshot,
        waitlistEntry: savedEntry,
        waitlistPosition,
        previousStatus,
        currentStatus: registration.status,
        performedAt,
        idempotencyResult: "MISS",
        metadata: partialSuccessMetadata({
          registrationTransitionPersisted: true,
          waitlistEntryPersisted: true,
          persistedWithoutAudit: true,
          reconciliationRequired: true,
        }),
      });
    }

    const replay = {
      kind: "CAPACITY_WAITLIST_REPLAY",
      namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.WAITLIST_PLACE,
      canonicalFingerprint: fingerprint,
      registrationId: registration.id,
      waitlistEntryId: savedEntry.waitlistEntryId,
      auditEventId,
      previousStatus,
      currentStatus: registration.status,
      capacitySnapshot,
      reservation: null,
      waitlistEntry: savedEntry,
      waitlistPosition,
      registration,
      stateVersion: capacitySnapshot.stateVersion,
      performedAt,
    };

    await deps.repository.saveIdempotencyRecord(
      createIdempotencyRecordForCapacity({
        namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.WAITLIST_PLACE,
        requestId: request.requestId,
        registrationId: registration.id,
        competitionId,
        divisionId,
        createdAt: performedAt,
        replay,
      })
    );

    return capacityWaitlistServiceOk({
      operation,
      registration,
      capacitySnapshot,
      waitlistEntry: savedEntry,
      waitlistPosition,
      previousStatus,
      currentStatus: registration.status,
      stateVersion: capacitySnapshot.stateVersion,
      idempotencyResult: "MISS",
      auditEventId,
      performedAt,
      replayed: false,
    });
  }

  async function withdrawWaitlistedRegistration(request = {}) {
    const operation = CAPACITY_WAITLIST_OPERATION.WITHDRAW_WAITLISTED;
    const performedAt = deps.clock.nowIso();

    if (!isNonEmptyString(request.requestId)) {
      return capacityWaitlistServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "requestId",
          "requestId is required"
        ),
      ]);
    }

    const loaded = await loadRegistration(deps, request.registrationId, operation);
    if (!loaded.ok) return loaded.result;
    let registration = loaded.registration;
    const previousStatus = registration.status;
    const competitionId = registration.competitionId;
    const divisionId = registration.divisionId;

    const fingerprint = buildCanonicalCapacityRequestFingerprint({
      registrationId: registration.id,
      competitionId,
      divisionId,
      operation: "WAITLIST_WITHDRAW",
    });

    const idem = await resolveIdempotency(deps, {
      namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.WAITLIST_WITHDRAW,
      requestId: request.requestId,
      registrationId: registration.id,
      competitionId,
      divisionId,
      canonicalFingerprint: fingerprint,
      operation,
    });
    if (!idem.ok) return idem.result;
    if (idem.hit) return idem.result;

    const entry = await deps.waitlist.findActiveByRegistrationId(registration.id);
    if (!entry) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.WAITLIST_ENTRY_NOT_FOUND,
            "registrationId",
            "Active waitlist entry not found"
          ),
        ],
        { registration, performedAt, idempotencyResult: "MISS" }
      );
    }

    const previousPosition = (
      calculateWaitlistPositions(await deps.waitlist.listActive(competitionId, divisionId), {
        calculatedAt: performedAt,
        waitlistVersion: entry.waitlistVersion,
      })
    ).find((p) => p.registrationId === registration.id);

    const transition = validateRegistrationTransition(
      registration.status,
      REGISTRATION_STATUS.WITHDRAWN
    );
    if (!transition.ok) {
      return capacityWaitlistServiceFail(
        operation,
        transition.errors.map((e) =>
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_WAITLIST_TRANSITION,
            e.path || "status",
            e.message,
            e.metadata
          )
        ),
        { registration, waitlistEntry: entry, performedAt, idempotencyResult: "MISS" }
      );
    }

    registration = applyRegistrationTransition(registration, REGISTRATION_STATUS.WITHDRAWN, {
      clockNow: performedAt,
      decidedAt: performedAt,
      decidedBy: request.actorId ?? CAPACITY_WAITLIST_SYSTEM_ACTOR,
      reason: request.reason ?? "withdrawn from waitlist",
    });
    registration = { ...registration, waitlistPosition: null };
    await deps.repository.save(registration);

    const withdrawnEntry = createWaitlistEntry({
      ...entry,
      status: "WITHDRAWN",
      withdrawnAt: performedAt,
      actorId: request.actorId ?? entry.actorId,
    });
    const savedEntry = await deps.waitlist.save(withdrawnEntry);

    const after = await buildCapacitySnapshot(deps, { competitionId, divisionId });
    const capacitySnapshot = after.ok ? after.snapshot : null;

    let auditEventId;
    try {
      const audit = await appendCapacityAudit(deps, {
        operation,
        registrationId: registration.id,
        competitionId,
        divisionId,
        previousStatus,
        nextStatus: registration.status,
        actorId: request.actorId ?? CAPACITY_WAITLIST_SYSTEM_ACTOR,
        requestId: request.requestId,
        correlationId: request.correlationId ?? null,
        reason: request.reason ?? "withdrawn from waitlist",
        capacitySnapshotId: capacitySnapshot?.snapshotId ?? null,
        waitlistEntryId: savedEntry.waitlistEntryId,
        previousWaitlistPosition: previousPosition?.position ?? null,
        stateVersion: capacitySnapshot?.stateVersion ?? null,
      });
      auditEventId = audit.auditEventId;
    } catch (error) {
      return capacityWaitlistServiceFail(operation, [mapPortError(error, "audit")], {
        registration,
        capacitySnapshot,
        waitlistEntry: savedEntry,
        previousStatus,
        currentStatus: registration.status,
        performedAt,
        idempotencyResult: "MISS",
        metadata: partialSuccessMetadata({
          registrationTransitionPersisted: true,
          waitlistEntryPersisted: true,
          persistedWithoutAudit: true,
          reconciliationRequired: true,
        }),
      });
    }

    const replay = {
      kind: "CAPACITY_WAITLIST_REPLAY",
      namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.WAITLIST_WITHDRAW,
      canonicalFingerprint: fingerprint,
      registrationId: registration.id,
      waitlistEntryId: savedEntry.waitlistEntryId,
      auditEventId,
      previousStatus,
      currentStatus: registration.status,
      capacitySnapshot,
      reservation: null,
      waitlistEntry: savedEntry,
      waitlistPosition: null,
      registration,
      stateVersion: capacitySnapshot?.stateVersion ?? null,
      performedAt,
    };

    await deps.repository.saveIdempotencyRecord(
      createIdempotencyRecordForCapacity({
        namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.WAITLIST_WITHDRAW,
        requestId: request.requestId,
        registrationId: registration.id,
        competitionId,
        divisionId,
        createdAt: performedAt,
        replay,
      })
    );

    return capacityWaitlistServiceOk({
      operation,
      registration,
      capacitySnapshot,
      waitlistEntry: savedEntry,
      previousStatus,
      currentStatus: registration.status,
      stateVersion: capacitySnapshot?.stateVersion ?? null,
      idempotencyResult: "MISS",
      auditEventId,
      performedAt,
      replayed: false,
    });
  }

  async function getRegistrationWaitlistPosition(request = {}) {
    const operation = CAPACITY_WAITLIST_OPERATION.GET_WAITLIST_POSITION;
    const performedAt = deps.clock.nowIso();
    const loaded = await loadRegistration(deps, request.registrationId, operation);
    if (!loaded.ok) return loaded.result;
    const registration = loaded.registration;
    const competitionId = registration.competitionId;
    const divisionId = registration.divisionId;

    const entry = await deps.waitlist.findActiveByRegistrationId(registration.id);
    if (!entry) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.WAITLIST_ENTRY_NOT_FOUND,
            "registrationId",
            "Active waitlist entry not found"
          ),
        ],
        { registration, performedAt }
      );
    }

    const version = await deps.waitlist.getScopeVersion(competitionId, divisionId);
    const positions = calculateWaitlistPositions(
      await deps.waitlist.listActive(competitionId, divisionId),
      { calculatedAt: performedAt, waitlistVersion: version }
    ).map((p) => createRegistrationWaitlistPosition(p));
    const waitlistPosition =
      positions.find((p) => p.registrationId === registration.id) || null;

    return capacityWaitlistServiceOk({
      operation,
      registration,
      waitlistEntry: entry,
      waitlistPosition,
      currentStatus: registration.status,
      stateVersion: version,
      performedAt,
    });
  }

  async function listWaitlist(request = {}) {
    const operation = CAPACITY_WAITLIST_OPERATION.LIST_WAITLIST;
    const performedAt = deps.clock.nowIso();

    if (!isNonEmptyString(request.competitionId)) {
      return capacityWaitlistServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "competitionId",
          "competitionId is required"
        ),
      ]);
    }

    const competitionId = String(request.competitionId).trim();
    const divisionId =
      request.divisionId != null && String(request.divisionId).trim() !== ""
        ? String(request.divisionId).trim()
        : null;

    const entries = sortWaitlistEntries(await deps.waitlist.listActive(competitionId, divisionId));
    const version = await deps.waitlist.getScopeVersion(competitionId, divisionId);
    const positions = calculateWaitlistPositions(entries, {
      calculatedAt: performedAt,
      waitlistVersion: version,
    }).map((p) => createRegistrationWaitlistPosition(p));

    const built = await buildCapacitySnapshot(deps, { competitionId, divisionId });

    return capacityWaitlistServiceOk({
      operation,
      capacitySnapshot: built.ok ? built.snapshot : null,
      stateVersion: version,
      performedAt,
      metadata: {
        waitlistEntries: entries,
        waitlistPositions: positions,
      },
    });
  }

  async function selectWaitlistPromotionCandidates(request = {}) {
    const operation = CAPACITY_WAITLIST_OPERATION.SELECT_PROMOTION_CANDIDATES;
    const performedAt = deps.clock.nowIso();

    if (!isNonEmptyString(request.competitionId)) {
      return capacityWaitlistServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "competitionId",
          "competitionId is required"
        ),
      ]);
    }

    const competitionId = String(request.competitionId).trim();
    const divisionId =
      request.divisionId != null && String(request.divisionId).trim() !== ""
        ? String(request.divisionId).trim()
        : null;

    const built = await buildCapacitySnapshot(deps, { competitionId, divisionId });
    if (!built.ok) {
      return capacityWaitlistServiceFail(operation, built.errors, { performedAt });
    }

    const available =
      built.snapshot.effectiveRemaining == null
        ? Number.POSITIVE_INFINITY
        : built.snapshot.effectiveRemaining;

    const ordered = sortWaitlistEntries(await deps.waitlist.listActive(competitionId, divisionId));
    /** @type {Array<Record<string, unknown>>} */
    const candidates = [];

    for (const entry of ordered) {
      if (candidates.length >= available) break;

      const reservation = await deps.capacityReservations.findActiveByRegistrationId(
        entry.registrationId
      );
      if (reservation) continue;

      const evidence = await deps.eligibilityEvidence.getLatestByRegistrationId(
        entry.registrationId
      );
      const evidenceCheck = validateEligibilityEvidence(evidence, {
        maxAgeMs: request.eligibilityMaxAgeMs ?? null,
        nowIso: performedAt,
      });
      if (!evidenceCheck.ok) continue;

      const registration = await deps.repository.getById(entry.registrationId);
      if (!registration || registration.status !== REGISTRATION_STATUS.WAITLISTED) continue;

      candidates.push({
        registrationId: entry.registrationId,
        waitlistEntryId: entry.waitlistEntryId,
        competitionId: entry.competitionId,
        divisionId: entry.divisionId,
        priorityRank: entry.priorityRank,
        submittedAt: entry.submittedAt,
        waitlistedAt: entry.waitlistedAt,
        eligibilityOutcome: evidence.outcome,
        capacityStateVersion: built.snapshot.stateVersion,
      });
    }

    return capacityWaitlistServiceOk({
      operation,
      capacitySnapshot: built.snapshot,
      promotionCandidates: candidates,
      stateVersion: built.snapshot.stateVersion,
      performedAt,
      metadata: {
        selectedCount: candidates.length,
        availableCapacity: available === Number.POSITIVE_INFINITY ? null : available,
      },
    });
  }

  async function promoteWaitlistedRegistration(request = {}) {
    const operation = CAPACITY_WAITLIST_OPERATION.PROMOTE_WAITLISTED;
    const performedAt = deps.clock.nowIso();

    if (!isNonEmptyString(request.requestId)) {
      return capacityWaitlistServiceFail(operation, [
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          "requestId",
          "requestId is required"
        ),
      ]);
    }

    const loaded = await loadRegistration(deps, request.registrationId, operation);
    if (!loaded.ok) return loaded.result;
    let registration = loaded.registration;
    const previousStatus = registration.status;
    const competitionId = registration.competitionId;
    const divisionId = registration.divisionId;

    const approval = validatePromotionAuthorization(request.approvalAuthorization, {
      registrationId: registration.id,
      competitionId,
      divisionId,
    });
    if (!approval.ok) {
      return capacityWaitlistServiceFail(operation, approval.errors, {
        registration,
        performedAt,
      });
    }

    const fingerprint = buildCanonicalCapacityRequestFingerprint({
      registrationId: registration.id,
      competitionId,
      divisionId,
      operation: "WAITLIST_PROMOTE",
      authorizationRef: approval.value.authorizationRef,
    });

    const idem = await resolveIdempotency(deps, {
      namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.WAITLIST_PROMOTE,
      requestId: request.requestId,
      registrationId: registration.id,
      competitionId,
      divisionId,
      canonicalFingerprint: fingerprint,
      operation,
    });
    if (!idem.ok) return idem.result;
    if (idem.hit) return idem.result;

    if (registration.status !== REGISTRATION_STATUS.WAITLISTED) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_PROMOTION_PRECONDITION,
            "status",
            "Promotion requires current WAITLISTED status",
            { status: registration.status }
          ),
        ],
        { registration, performedAt, idempotencyResult: "MISS" }
      );
    }

    const entry = await deps.waitlist.findActiveByRegistrationId(registration.id);
    if (!entry) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.WAITLIST_ENTRY_NOT_FOUND,
            "registrationId",
            "Active waitlist entry not found"
          ),
        ],
        { registration, performedAt, idempotencyResult: "MISS" }
      );
    }

    if (
      request.expectedWaitlistVersion != null &&
      Number(request.expectedWaitlistVersion) !==
        (await deps.waitlist.getScopeVersion(competitionId, divisionId))
    ) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_WAITLIST_VERSION,
            "expectedWaitlistVersion",
            "Waitlist state version is stale"
          ),
        ],
        { registration, waitlistEntry: entry, performedAt, idempotencyResult: "MISS" }
      );
    }

    const existingReservation =
      await deps.capacityReservations.findActiveByRegistrationId(registration.id);
    if (existingReservation) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ACTIVE_RESERVATION,
            "registrationId",
            "Registration already holds capacity"
          ),
        ],
        {
          registration,
          reservation: existingReservation,
          waitlistEntry: entry,
          performedAt,
          idempotencyResult: "MISS",
        }
      );
    }

    const evidence = await deps.eligibilityEvidence.getLatestByRegistrationId(registration.id);
    const evidenceCheck = validateEligibilityEvidence(evidence, {
      maxAgeMs: request.eligibilityMaxAgeMs ?? null,
      nowIso: performedAt,
    });
    if (!evidenceCheck.ok) {
      return capacityWaitlistServiceFail(operation, evidenceCheck.errors, {
        registration,
        waitlistEntry: entry,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    const built = await buildCapacitySnapshot(deps, { competitionId, divisionId });
    if (!built.ok) {
      return capacityWaitlistServiceFail(operation, built.errors, {
        registration,
        waitlistEntry: entry,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    if (
      request.expectedStateVersion != null &&
      Number(request.expectedStateVersion) !== built.snapshot.stateVersion
    ) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_CAPACITY_VERSION,
            "expectedStateVersion",
            "Capacity state version is stale",
            {
              expectedStateVersion: Number(request.expectedStateVersion),
              actualStateVersion: built.snapshot.stateVersion,
            }
          ),
        ],
        {
          registration,
          capacitySnapshot: built.snapshot,
          waitlistEntry: entry,
          performedAt,
          idempotencyResult: "MISS",
        }
      );
    }

    if (!hasAvailableCapacity(built.snapshot.effectiveRemaining)) {
      return capacityWaitlistServiceFail(
        operation,
        [
          registrationEligibilityError(
            REGISTRATION_ELIGIBILITY_ERROR_CODE.CAPACITY_EXHAUSTED,
            "capacity",
            "No remaining capacity for promotion"
          ),
        ],
        {
          registration,
          capacitySnapshot: built.snapshot,
          waitlistEntry: entry,
          performedAt,
          idempotencyResult: "MISS",
        }
      );
    }

    const transition = validateRegistrationTransition(
      registration.status,
      REGISTRATION_STATUS.APPROVED
    );
    if (!transition.ok) {
      return capacityWaitlistServiceFail(operation, transition.errors, {
        registration,
        capacitySnapshot: built.snapshot,
        waitlistEntry: entry,
        performedAt,
        idempotencyResult: "MISS",
      });
    }

    // Reserve capacity first, then approve via Phase 1A transition.
    const reserveResult = await reserveRegistrationCapacity({
      registrationId: registration.id,
      competitionId,
      divisionId,
      requestId: `${request.requestId}::reserve`,
      actorId: approval.value.authorizedBy,
      reason: `promotion reserve:${approval.value.authorizationRef}`,
      expectedStateVersion: built.snapshot.stateVersion,
    });
    if (!reserveResult.ok) {
      return capacityWaitlistServiceFail(operation, reserveResult.errors, {
        registration,
        capacitySnapshot: reserveResult.capacitySnapshot ?? built.snapshot,
        waitlistEntry: entry,
        performedAt,
        idempotencyResult: "MISS",
        metadata: {
          promotionStage: "reserve_failed",
          ...partialSuccessMetadata({
            capacityReservationPersisted: false,
            registrationTransitionPersisted: false,
            waitlistEntryPersisted: false,
            reconciliationRequired: true,
          }),
        },
      });
    }

    registration = applyRegistrationTransition(registration, REGISTRATION_STATUS.APPROVED, {
      clockNow: performedAt,
      decidedAt: performedAt,
      decidedBy: approval.value.authorizedBy,
      reason: approval.value.reason,
    });
    registration = { ...registration, waitlistPosition: null };
    await deps.repository.save(registration);

    const promotedEntry = createWaitlistEntry({
      ...entry,
      status: "PROMOTED",
      promotedAt: performedAt,
      actorId: approval.value.authorizedBy,
    });
    const savedEntry = await deps.waitlist.save(promotedEntry);

    const after = await buildCapacitySnapshot(deps, { competitionId, divisionId });
    const capacitySnapshot = after.ok ? after.snapshot : reserveResult.capacitySnapshot;

    let auditEventId;
    try {
      const audit = await appendCapacityAudit(deps, {
        operation,
        registrationId: registration.id,
        competitionId,
        divisionId,
        previousStatus,
        nextStatus: registration.status,
        actorId: approval.value.authorizedBy,
        requestId: request.requestId,
        correlationId: request.correlationId ?? null,
        reason: approval.value.reason,
        capacitySnapshotId: capacitySnapshot?.snapshotId ?? null,
        reservationId: reserveResult.reservation?.reservationId ?? null,
        waitlistEntryId: savedEntry.waitlistEntryId,
        stateVersion: capacitySnapshot?.stateVersion ?? null,
        payload: {
          authorizationRef: approval.value.authorizationRef,
          entryCreated: false,
          core02Entry: null,
        },
      });
      auditEventId = audit.auditEventId;
    } catch (error) {
      return capacityWaitlistServiceFail(operation, [mapPortError(error, "audit")], {
        registration,
        capacitySnapshot,
        reservation: reserveResult.reservation,
        waitlistEntry: savedEntry,
        previousStatus,
        currentStatus: registration.status,
        performedAt,
        idempotencyResult: "MISS",
        metadata: partialSuccessMetadata({
          capacityCountersPersisted: true,
          capacityReservationPersisted: true,
          registrationTransitionPersisted: true,
          waitlistEntryPersisted: true,
          persistedWithoutAudit: true,
          reconciliationRequired: true,
        }),
      });
    }

    const replay = {
      kind: "CAPACITY_WAITLIST_REPLAY",
      namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.WAITLIST_PROMOTE,
      canonicalFingerprint: fingerprint,
      registrationId: registration.id,
      reservationId: reserveResult.reservation?.reservationId ?? null,
      waitlistEntryId: savedEntry.waitlistEntryId,
      auditEventId,
      previousStatus,
      currentStatus: registration.status,
      capacitySnapshot,
      reservation: reserveResult.reservation,
      waitlistEntry: savedEntry,
      waitlistPosition: null,
      registration,
      stateVersion: capacitySnapshot?.stateVersion ?? null,
      performedAt,
    };

    await deps.repository.saveIdempotencyRecord(
      createIdempotencyRecordForCapacity({
        namespace: CAPACITY_IDEMPOTENCY_NAMESPACE.WAITLIST_PROMOTE,
        requestId: request.requestId,
        registrationId: registration.id,
        competitionId,
        divisionId,
        createdAt: performedAt,
        replay,
      })
    );

    return capacityWaitlistServiceOk({
      operation,
      registration,
      capacitySnapshot,
      reservation: reserveResult.reservation,
      waitlistEntry: savedEntry,
      previousStatus,
      currentStatus: registration.status,
      stateVersion: capacitySnapshot?.stateVersion ?? null,
      idempotencyResult: "MISS",
      auditEventId,
      performedAt,
      replayed: false,
      metadata: {
        entryCreated: false,
        core02Entry: null,
        authorizationRef: approval.value.authorizationRef,
        authorizationPurpose: CAPACITY_AUTH_PURPOSE.WAITLIST_PROMOTION,
        ...partialSuccessMetadata({
          capacityCountersPersisted: true,
          capacityReservationPersisted: true,
          registrationTransitionPersisted: true,
          waitlistEntryPersisted: true,
          auditPersisted: true,
          idempotencyRecordPersisted: true,
        }),
      },
    });
  }

  return {
    evaluateRegistrationCapacity,
    reserveRegistrationCapacity,
    releaseRegistrationCapacity,
    placeRegistrationOnWaitlist,
    withdrawWaitlistedRegistration,
    getRegistrationWaitlistPosition,
    listWaitlist,
    selectWaitlistPromotionCandidates,
    promoteWaitlistedRegistration,
  };
}

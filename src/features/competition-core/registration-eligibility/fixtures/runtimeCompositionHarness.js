/**
 * Phase 1G — test-only Core-03 runtime composition harness.
 *
 * Composes existing public factories/ports only.
 * NOT a Production composition root.
 * Do NOT re-export from registration-eligibility/index.js (capability surface).
 * Do NOT re-export from competition-core/index.js (protected barrel).
 */

import { REGISTRATION_STATUS } from "../enums/registrationStatus.js";
import { REGISTRATION_TARGET_TYPE } from "../enums/registrationTargetType.js";
import { ELIGIBILITY_CHECK_TYPE } from "../enums/eligibilityCheckType.js";
import { ELIGIBILITY_OUTCOME } from "../enums/eligibilityOutcome.js";
import { createCompetitionRegistration } from "../contracts/competitionRegistration.js";
import { createRegistrationApplicant } from "../contracts/registrationApplicant.js";
import { createRegistrationTarget } from "../contracts/registrationTarget.js";
import { createRegistrationAuditEvent } from "../contracts/registrationEvidence.js";
import { createEligibilityEvaluationEvidence } from "../contracts/eligibilityEvaluationEvidence.js";
import { REGISTRATION_LIFECYCLE_SERVICE_VERSION } from "../contracts/shared.js";
import { applyRegistrationTransition } from "../policies/registrationTransitions.js";
import { CAPACITY_AUTH_PURPOSE } from "../policies/capacityAuthorizationPolicy.js";
import { createFixedClockPort } from "../ports/clockPort.js";
import { createSequentialIdGeneratorPort } from "../ports/idGeneratorPort.js";
import { createStubPaymentStatusPort } from "../ports/paymentStatusPort.js";
import { createStubMembershipStatusPort } from "../ports/membershipStatusPort.js";
import { createInMemoryCompetitionRegistrationPolicyPort } from "../ports/competitionRegistrationPolicyPort.js";
import { createRegistrationLifecycleService } from "../services/registrationLifecycleService.js";
import { createEligibilityEvaluationService } from "../services/eligibilityEvaluationService.js";
import { createCapacityWaitlistService } from "../services/capacityWaitlistService.js";
import { createCore03SiblingAdapters } from "../adapters/createCore03SiblingAdapters.js";
import { createCore03PersistenceRepositories } from "../persistence/createCore03PersistenceRepositories.js";
import { createFakeSiblingFacades } from "./fakeSiblingFacades.js";
import { ELIGIBILITY_CHECK_TYPE as _ELIGIBILITY_CHECK_TYPE } from "../enums/eligibilityCheckType.js";

/** Mirror of fixtures/index.js clock — avoid circular import with fixtures barrel. */
const CORE03_FIXTURE_CLOCK = "2026-07-20T05:00:00.000Z";

const CORE03_FIXTURE_PARTICIPANTS = Object.freeze([
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

function fixtureDefaultCompetitionPolicy(overrides = {}) {
  return {
    policyAvailable: true,
    windowOpen: true,
    policyRef: "pol-default",
    competitionLimit: null,
    allowWaitlist: false,
    eligibilityPolicy: {
      policyId: "pol-default",
      requiredCheckTypes: [
        _ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
        _ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
      ],
    },
    ...overrides,
  };
}

/**
 * @param {import('../contracts/competitionRegistration.js').CompetitionRegistration} registration
 * @param {Record<string, unknown>} [overrides]
 */
export function runtimeWaitlistPlacementAuth(registration, overrides = {}) {
  return {
    purpose: CAPACITY_AUTH_PURPOSE.WAITLIST_PLACEMENT,
    registrationId: registration.id,
    competitionId: registration.competitionId,
    divisionId: registration.divisionId,
    authorizedBy: "director-1",
    authorizationRef: "AUTHZ-WL-PLACE-1G",
    reason: "authorized waitlist placement",
    issuedAt: CORE03_FIXTURE_CLOCK,
    ...overrides,
  };
}

/**
 * @param {import('../contracts/competitionRegistration.js').CompetitionRegistration} registration
 * @param {Record<string, unknown>} [overrides]
 */
export function runtimeWaitlistPromotionAuth(registration, overrides = {}) {
  return {
    purpose: CAPACITY_AUTH_PURPOSE.WAITLIST_PROMOTION,
    registrationId: registration.id,
    competitionId: registration.competitionId,
    divisionId: registration.divisionId,
    authorizedBy: "director-1",
    authorizationRef: "AUTHZ-WL-PROMO-1G",
    reason: "authorized waitlist promotion",
    issuedAt: CORE03_FIXTURE_CLOCK,
    ...overrides,
  };
}

/**
 * Create a test-only composed Core-03 runtime (lifecycle + eligibility + capacity)
 * over Phase 1F persistence repositories and Phase 1E sibling adapters.
 *
 * Mutable hooks / fake facades are returned for tests only and are not part of
 * any Production public surface.
 *
 * @param {{
 *   clockIso?: string,
 *   idSeed?: string,
 *   participants?: Array<Record<string, unknown>>,
 *   entries?: Array<Record<string, unknown>>,
 *   competitionPolicies?: Record<string, Record<string, unknown>>,
 *   capacityStates?: Array<Record<string, unknown>>,
 *   facades?: Record<string, unknown>,
 *   paymentImpl?: Function,
 *   membershipImpl?: Function,
 *   allowUnapprovedEntryCreationFacade?: boolean,
 *   core02EntryCreation?: { createEntryFromRegistration: Function }|null,
 * }} [options]
 */
export function createCore03RuntimeCompositionHarness(options = {}) {
  const clock = createFixedClockPort(options.clockIso || CORE03_FIXTURE_CLOCK);
  const ids = createSequentialIdGeneratorPort(options.idSeed || "p1g");
  const persistence = createCore03PersistenceRepositories();

  const facades = createFakeSiblingFacades({
    participants: options.participants || [...CORE03_FIXTURE_PARTICIPANTS],
    entries: options.entries || [],
    ...(options.facades || {}),
  });

  const adapters = createCore03SiblingAdapters({
    clock,
    core01RuleEngine: facades.core01RuleEngine,
    core02ParticipantLookup: facades.core02ParticipantLookup,
    core02EntryLookup: facades.core02EntryLookup,
    core04DivisionEligibility: facades.core04DivisionEligibility,
    core05TeamRoster: facades.core05TeamRoster,
    core02EntryCreation: options.core02EntryCreation ?? null,
    allowUnapprovedEntryCreationFacade: options.allowUnapprovedEntryCreationFacade === true,
  });

  if (!adapters.ok) {
    throw new TypeError(
      `createCore03RuntimeCompositionHarness: sibling adapter composition failed (${adapters.errorCode})`
    );
  }

  const competitionPolicy = createInMemoryCompetitionRegistrationPolicyPort(
    options.competitionPolicies || {
      "comp-1": fixtureDefaultCompetitionPolicy({
        allowWaitlist: true,
        competitionLimit: 10,
        eligibilityPolicy: {
          policyId: "pol-runtime-1g",
          requiredCheckTypes: [
            ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW,
            ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS,
          ],
        },
      }),
    }
  );

  /** Injectable failure hooks for reconciliation / partial-success QA. */
  const hooks = {
    failNextAuditAppend: false,
    failNextReservationSave: false,
    failNextWaitlistSave: false,
    failNextRegistrationSave: false,
  };

  const audit = {
    async append(event) {
      if (hooks.failNextAuditAppend) {
        hooks.failNextAuditAppend = false;
        const err = new Error("INJECTED_AUDIT_APPEND_FAILURE");
        err.code = "INJECTED_AUDIT_APPEND_FAILURE";
        throw err;
      }
      return persistence.audit.append(event);
    },
    listByRegistration: (registrationId) => persistence.audit.listByRegistration(registrationId),
    update: (...args) => persistence.audit.update(...args),
    delete: (...args) => persistence.audit.delete(...args),
  };

  const capacityReservations = {
    findActiveByRegistrationId: (id) =>
      persistence.capacityReservations.findActiveByRegistrationId(id),
    getById: (id) => persistence.capacityReservations.getById(id),
    listByCompetition: (competitionId, divisionId) =>
      persistence.capacityReservations.listByCompetition(competitionId, divisionId),
    async save(reservation, opts) {
      if (hooks.failNextReservationSave) {
        hooks.failNextReservationSave = false;
        const err = new Error("INJECTED_RESERVATION_SAVE_FAILURE");
        err.code = "INJECTED_RESERVATION_SAVE_FAILURE";
        throw err;
      }
      return persistence.capacityReservations.save(reservation, opts);
    },
  };

  const waitlist = {
    findActiveByRegistrationId: (id) => persistence.waitlist.findActiveByRegistrationId(id),
    getById: (id) => persistence.waitlist.getById(id),
    listActive: (competitionId, divisionId) =>
      persistence.waitlist.listActive(competitionId, divisionId),
    getScopeVersion: (competitionId, divisionId) =>
      persistence.waitlist.getScopeVersion(competitionId, divisionId),
    async save(entry, opts) {
      if (hooks.failNextWaitlistSave) {
        hooks.failNextWaitlistSave = false;
        const err = new Error("INJECTED_WAITLIST_SAVE_FAILURE");
        err.code = "INJECTED_WAITLIST_SAVE_FAILURE";
        throw err;
      }
      return persistence.waitlist.save(entry, opts);
    },
  };

  const registration = {
    getById: (id) => persistence.registration.getById(id),
    listByCompetition: (competitionId) => persistence.registration.listByCompetition(competitionId),
    findIdempotencyRecord: (key) => persistence.registration.findIdempotencyRecord(key),
    findByIdentityKey: (key) => persistence.registration.findByIdentityKey(key),
    saveIdempotencyRecord: (record) => persistence.registration.saveIdempotencyRecord(record),
    async save(reg, opts) {
      if (hooks.failNextRegistrationSave) {
        hooks.failNextRegistrationSave = false;
        const err = new Error("INJECTED_REGISTRATION_SAVE_FAILURE");
        err.code = "INJECTED_REGISTRATION_SAVE_FAILURE";
        throw err;
      }
      return persistence.registration.save(reg, opts);
    },
  };

  if (Array.isArray(options.capacityStates)) {
    for (const state of options.capacityStates) {
      persistence.capacityState.saveState({
        competitionId: state.competitionId,
        divisionId: state.divisionId ?? null,
        limit: state.limit,
        used: state.used ?? 0,
        reserved: state.reserved ?? 0,
        stateVersion: state.stateVersion ?? 0,
        updatedAt: clock.nowIso(),
      });
    }
  } else {
    persistence.capacityState.saveState({
      competitionId: "comp-1",
      divisionId: null,
      limit: 10,
      used: 0,
      reserved: 0,
      stateVersion: 0,
      updatedAt: clock.nowIso(),
    });
    persistence.capacityState.saveState({
      competitionId: "comp-1",
      divisionId: "div-1",
      limit: 10,
      used: 0,
      reserved: 0,
      stateVersion: 0,
      updatedAt: clock.nowIso(),
    });
  }

  const lifecycle = createRegistrationLifecycleService({
    repository: registration,
    audit,
    clock,
    ids,
  });

  const eligibility = createEligibilityEvaluationService({
    repository: registration,
    audit,
    clock,
    ids,
    participantLookup: adapters.participantLookup,
    entryLookup: adapters.entryLookup,
    divisionEligibility: adapters.divisionEligibility,
    competitionPolicy,
    ruleEvaluation: adapters.ruleEvaluation,
    paymentStatus: createStubPaymentStatusPort(options.paymentImpl),
    membershipStatus: createStubMembershipStatusPort(options.membershipImpl),
    teamRosterValidation: adapters.teamRosterValidation,
  });

  const capacity = createCapacityWaitlistService({
    repository: registration,
    audit,
    clock,
    ids,
    capacityState: persistence.capacityState,
    capacityReservations,
    waitlist,
    eligibilityEvidence: persistence.eligibilityEvidence,
    competitionPolicy,
  });

  return {
    clock,
    ids,
    persistence,
    facades,
    adapters,
    hooks,
    competitionPolicy,
    lifecycle,
    eligibility,
    capacity,
    /** Explicit marker — never a Production root. */
    isTestOnlyComposition: true,
    productionCompositionRoot: false,
    now: () => clock.nowIso(),

    async seedCapacityStates(states) {
      for (const state of states) {
        await persistence.capacityState.saveState({
          competitionId: state.competitionId,
          divisionId: state.divisionId ?? null,
          limit: state.limit,
          used: state.used ?? 0,
          reserved: state.reserved ?? 0,
          stateVersion: state.stateVersion ?? 0,
          updatedAt: clock.nowIso(),
        });
      }
    },

    /**
     * Bridge Phase 1C evaluation evidence into Phase 1F evidence repository.
     * Required because eligibility service does not yet write the evidence port.
     */
    async persistEvaluationEvidence(evaluationResult) {
      if (!evaluationResult?.evidence) {
        throw new TypeError("persistEvaluationEvidence requires evaluationResult.evidence");
      }
      return persistence.eligibilityEvidence.saveEvidence(evaluationResult.evidence);
    },

    async seedEligibleEvidence(registrationRow, overrides = {}) {
      return persistence.eligibilityEvidence.saveEvidence(
        createEligibilityEvaluationEvidence({
          id: ids.nextId("evidence"),
          evaluationRequestId: ids.nextId("eval-req"),
          registrationId: registrationRow.id,
          competitionId: registrationRow.competitionId,
          divisionId: registrationRow.divisionId,
          outcome: ELIGIBILITY_OUTCOME.ELIGIBLE,
          evaluatedAt: clock.nowIso(),
          checkResults: [],
          reasons: [],
          requiredCheckTypes: [],
          ...overrides,
        })
      );
    },

    /**
     * Test-only APPROVED transition after capacity reservation.
     * Formal director-approval orchestration beyond waitlist promote remains deferred;
     * this helper composes existing transition policy + persistence + audit only.
     */
    async approveReservedRegistration(request = {}) {
      const registrationId = String(request.registrationId || "").trim();
      const existing = await registration.getById(registrationId);
      if (!existing) {
        return { ok: false, error: "REGISTRATION_NOT_FOUND" };
      }
      const activeReservation =
        await capacityReservations.findActiveByRegistrationId(registrationId);
      if (!activeReservation) {
        return { ok: false, error: "ACTIVE_RESERVATION_REQUIRED" };
      }

      const previousStatus = existing.status;
      const performedAt = clock.nowIso();
      let next = applyRegistrationTransition(existing, REGISTRATION_STATUS.APPROVED, {
        clockNow: performedAt,
        decidedAt: performedAt,
        decidedBy: request.actorId ?? "director-1",
        reason: request.reason ?? "approved after capacity reservation",
      });
      next = createCompetitionRegistration({
        ...next,
        handoffPending: true,
        stateVersion: Number(existing.stateVersion || 0) + 1,
        updatedAt: performedAt,
      });
      const saved = await registration.save(next, {
        expectedStateVersion: existing.stateVersion,
      });

      const auditEvent = createRegistrationAuditEvent({
        id: ids.nextId("audit"),
        registrationId: saved.id,
        competitionId: saved.competitionId,
        divisionId: saved.divisionId,
        eventType: "APPROVE_RESERVED_REGISTRATION",
        operation: "APPROVE_RESERVED_REGISTRATION",
        occurredAt: performedAt,
        actorId: request.actorId ?? "director-1",
        fromStatus: previousStatus,
        toStatus: REGISTRATION_STATUS.APPROVED,
        requestId: request.requestId ?? null,
        correlationId: request.correlationId ?? null,
        reason: request.reason ?? "approved after capacity reservation",
        serviceVersion: REGISTRATION_LIFECYCLE_SERVICE_VERSION,
        reservationId: activeReservation.reservationId,
        payload: {
          handoffPending: true,
          entryCreated: false,
          core02EntryCreation: "DEFERRED_FAIL_CLOSED",
          stateVersion: saved.stateVersion,
        },
      });
      await audit.append(auditEvent);

      const entryCreation = await adapters.entryCreation.createEntryFromRegistration({
        registrationId: saved.id,
        competitionId: saved.competitionId,
        divisionId: saved.divisionId,
        target: saved.target,
        registrationStatus: saved.status,
        handoffRequestId: request.handoffRequestId ?? `handoff-${saved.id}`,
        allowUnapprovedEntryCreationFacade: true,
        allowUnapprovedFacade: true,
      });

      return {
        ok: true,
        registration: saved,
        previousStatus,
        currentStatus: saved.status,
        reservation: activeReservation,
        auditEventId: auditEvent.id,
        entryCreation,
        entryCreated: false,
        handoffPending: saved.handoffPending === true,
        performedAt,
      };
    },

    async createDraftIndividual(overrides = {}) {
      const applicant = createRegistrationApplicant({
        platformUserId: overrides.platformUserId || "user-1",
        participantId: overrides.participantId || "p-1",
      });
      const target =
        overrides.target ||
        createRegistrationTarget({
          targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
          participantId: overrides.participantId || "p-1",
        });
      return lifecycle.createDraftRegistration({
        competitionId: overrides.competitionId || "comp-1",
        divisionId: overrides.divisionId !== undefined ? overrides.divisionId : "div-1",
        applicant,
        target,
        registrationRequestId: overrides.registrationRequestId || ids.nextId("req"),
        idempotencyKey: overrides.idempotencyKey || ids.nextId("idem"),
        actorId: overrides.actorId || "user-1",
        correlationId: overrides.correlationId || ids.nextId("corr"),
        requestFingerprint: overrides.requestFingerprint || null,
        metadata: overrides.metadata || null,
        formatHint: overrides.formatHint || null,
      });
    },

    async advanceToUnderReview(draftResult) {
      const registrationId = draftResult.registration.id;
      const submitted = await lifecycle.submitRegistration({
        registrationId,
        actorId: "user-1",
        requestId: ids.nextId("submit-req"),
        correlationId: draftResult.registration.correlationId,
      });
      if (!submitted.ok) return { draft: draftResult, submitted, review: null };
      const review = await lifecycle.beginRegistrationReview({
        registrationId,
        actorId: "director-1",
        requestId: ids.nextId("review-req"),
        correlationId: draftResult.registration.correlationId,
      });
      return { draft: draftResult, submitted, review };
    },

    async evaluateAndBridge(registrationId, evaluationRequestId) {
      const evaluation = await eligibility.evaluateRegistrationEligibility({
        registrationId,
        evaluationRequestId: evaluationRequestId || ids.nextId("eval-req"),
        actorId: "director-1",
        requestId: ids.nextId("eval-cmd"),
        correlationId: ids.nextId("corr"),
      });
      if (evaluation.ok && evaluation.evidence) {
        await this.persistEvaluationEvidence(evaluation);
      }
      return evaluation;
    },
  };
}

/**
 * Catalog of reconciliation scenarios for Phase 1G QA (documentation + tests).
 * Not an automatic Production worker.
 */
export const CORE03_RECONCILIATION_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "REG_PERSISTED_AUDIT_FAILED",
    persistedEffects: ["registration row / transition"],
    missingEffects: ["audit event"],
    safeReplayBehavior: "Replay may append missing audit if idempotency HIT is absent; prefer operator audit backfill",
    reconciliationRequired: true,
    operatorRecoveryAction: "Append missing audit event with reconciliationRequired=true; verify no duplicate mutation",
    automaticRecoverySafe: false,
  }),
  Object.freeze({
    id: "CAPACITY_COUNTERS_CHANGED_RESERVATION_WRITE_FAILED",
    persistedEffects: ["capacity counters incremented"],
    missingEffects: ["reservation row", "audit", "idempotency"],
    safeReplayBehavior: "Do not blind-retry reserve; counters already moved — operator must reconcile counters or rollback",
    reconciliationRequired: true,
    operatorRecoveryAction: "Inspect counters vs reservations; restore counter or insert missing reservation under Owner GO",
    automaticRecoverySafe: false,
  }),
  Object.freeze({
    id: "RESERVATION_PERSISTED_AUDIT_FAILED",
    persistedEffects: ["capacity counters", "reservation row"],
    missingEffects: ["audit event", "possibly idempotency"],
    safeReplayBehavior: "Exact requestId replay should HIT once idempotency exists; otherwise safe to append audit only",
    reconciliationRequired: true,
    operatorRecoveryAction: "Append audit; ensure idempotency record exists for requestId",
    automaticRecoverySafe: false,
  }),
  Object.freeze({
    id: "REGISTRATION_TRANSITIONED_WAITLIST_WRITE_FAILED",
    persistedEffects: ["registration WAITLISTED transition"],
    missingEffects: ["waitlist entry", "audit"],
    safeReplayBehavior: "Unsafe automatic waitlist recreate without checking active entry uniqueness",
    reconciliationRequired: true,
    operatorRecoveryAction: "Create missing waitlist entry or revert status under Owner GO",
    automaticRecoverySafe: false,
  }),
  Object.freeze({
    id: "PROMOTION_RESERVATION_PERSISTED_APPROVAL_FAILED",
    persistedEffects: ["promotion reservation / capacity"],
    missingEffects: ["APPROVED transition", "waitlist PROMOTED mark"],
    safeReplayBehavior: "Do not double-reserve; resume approval transition with expected versions",
    reconciliationRequired: true,
    operatorRecoveryAction: "Complete APPROVED transition + waitlist mark, or release reservation",
    automaticRecoverySafe: false,
  }),
  Object.freeze({
    id: "WAITLIST_PROMOTED_AUDIT_FAILED",
    persistedEffects: ["APPROVED registration", "waitlist PROMOTED", "reservation"],
    missingEffects: ["audit event"],
    safeReplayBehavior: "Append-only audit backfill; do not re-promote",
    reconciliationRequired: true,
    operatorRecoveryAction: "Append promotion audit with reconciliationRequired=true",
    automaticRecoverySafe: false,
  }),
  Object.freeze({
    id: "IDEMPOTENCY_RECORD_MISSING_AFTER_SUCCESS",
    persistedEffects: ["mutation completed", "audit may exist"],
    missingEffects: ["idempotency record"],
    safeReplayBehavior: "Exact replay may duplicate unless operator inserts idempotency HIT payload",
    reconciliationRequired: true,
    operatorRecoveryAction: "Insert idempotency record from audit/replay payload before client retries",
    automaticRecoverySafe: false,
  }),
]);

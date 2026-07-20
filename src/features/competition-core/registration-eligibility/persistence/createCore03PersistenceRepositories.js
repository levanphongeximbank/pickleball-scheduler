/**
 * Phase 1F — Core-03 persistence repository adapters (port implementations).
 * Backed by an injected store (memory by default). No Production DB connection.
 */

import { createCompetitionRegistration } from "../contracts/competitionRegistration.js";
import { createRegistrationIdempotencyRecord } from "../contracts/idempotency.js";
import { createEligibilityEvaluationEvidence } from "../contracts/eligibilityEvaluationEvidence.js";
import { createRegistrationAuditEvent } from "../contracts/registrationEvidence.js";
import { createCapacityReservation, createWaitlistEntry } from "../contracts/capacity.js";
import { cloneJsonSafe } from "../contracts/shared.js";
import { PERSISTENCE_FOUNDATION_VERSION } from "../contracts/shared.js";
import { createCore03MemoryPersistenceStore } from "./memoryPersistenceStore.js";
import { runPersistenceTransaction } from "./transactionBoundary.js";

/**
 * @param {ReturnType<typeof createCore03MemoryPersistenceStore>} store
 */
export function createRegistrationRepositoryAdapter(store) {
  return {
    async getById(id) {
      const row = store.getRegistration(id);
      return row ? createCompetitionRegistration(row) : null;
    },
    async listByCompetition(competitionId) {
      return store
        .listRegistrationsByCompetition(competitionId)
        .map((r) => createCompetitionRegistration(r));
    },
    async findIdempotencyRecord(idempotencyKey) {
      const row = store.getIdempotencyRecord(idempotencyKey);
      return row ? createRegistrationIdempotencyRecord(row) : null;
    },
    /**
     * @param {import('../contracts/competitionRegistration.js').CompetitionRegistration} registration
     * @param {{ expectedStateVersion?: number|null }} [opts]
     */
    async save(registration, opts = {}) {
      const normalized = createCompetitionRegistration(registration);
      const stored = store.saveRegistration(normalized, opts);
      return createCompetitionRegistration(stored);
    },
    async saveIdempotencyRecord(record) {
      const normalized = createRegistrationIdempotencyRecord(record);
      const stored = store.saveIdempotencyRecord(normalized);
      return createRegistrationIdempotencyRecord(stored);
    },
    async findByIdentityKey(identityKey) {
      const row = store.findRegistrationByIdentityKey(identityKey);
      return row ? createCompetitionRegistration(row) : null;
    },
  };
}

/**
 * @param {ReturnType<typeof createCore03MemoryPersistenceStore>} store
 */
export function createRegistrationAuditRepositoryAdapter(store) {
  return {
    async append(event) {
      const normalized = createRegistrationAuditEvent(event);
      if (!normalized.id) {
        throw new TypeError("RegistrationAuditEvent requires id for persistence");
      }
      store.appendAuditEvent(normalized);
    },
    async listByRegistration(registrationId) {
      return store
        .listAuditByRegistration(registrationId)
        .map((e) => createRegistrationAuditEvent(e));
    },
    async update() {
      store.updateAuditEvent();
    },
    async delete() {
      store.deleteAuditEvent();
    },
  };
}

/**
 * @param {ReturnType<typeof createCore03MemoryPersistenceStore>} store
 */
export function createEligibilityEvidenceRepositoryAdapter(store) {
  return {
    async getLatestByRegistrationId(registrationId) {
      const row = store.getLatestEvidenceByRegistrationId(registrationId);
      return row ? createEligibilityEvaluationEvidence(row) : null;
    },
    async saveEvidence(evidence) {
      const normalized = createEligibilityEvaluationEvidence(evidence);
      const stored = store.saveEvidence(normalized);
      return createEligibilityEvaluationEvidence(stored);
    },
    async getById(id) {
      const row = store.getEvidence(id);
      return row ? createEligibilityEvaluationEvidence(row) : null;
    },
    async getByFingerprint(fingerprint) {
      const row = store.getEvidenceByFingerprint(fingerprint);
      return row ? createEligibilityEvaluationEvidence(row) : null;
    },
  };
}

/**
 * @param {ReturnType<typeof createCore03MemoryPersistenceStore>} store
 */
export function createCapacityStateRepositoryAdapter(store) {
  return {
    async getState(competitionId, divisionId = null) {
      return store.getCapacityState(competitionId, divisionId);
    },
    async saveState(state, opts = {}) {
      return store.saveCapacityState(state, opts);
    },
    async listByCompetition(competitionId) {
      return store.listCapacityByCompetition(competitionId);
    },
  };
}

/**
 * @param {ReturnType<typeof createCore03MemoryPersistenceStore>} store
 */
export function createCapacityReservationRepositoryAdapter(store) {
  return {
    async getById(reservationId) {
      const row = store.getReservation(reservationId);
      return row ? createCapacityReservation(row) : null;
    },
    async findActiveByRegistrationId(registrationId) {
      const row = store.findActiveReservationByRegistrationId(registrationId);
      return row ? createCapacityReservation(row) : null;
    },
    async save(reservation) {
      const normalized = createCapacityReservation(reservation);
      const stored = store.saveReservation(normalized);
      return createCapacityReservation(stored);
    },
    async listByCompetition(competitionId) {
      return store
        .listReservationsByCompetition(competitionId)
        .map((r) => createCapacityReservation(r));
    },
  };
}

/**
 * @param {ReturnType<typeof createCore03MemoryPersistenceStore>} store
 */
export function createWaitlistRepositoryAdapter(store) {
  return {
    async getById(waitlistEntryId) {
      const row = store.getWaitlistEntry(waitlistEntryId);
      return row ? createWaitlistEntry(row) : null;
    },
    async findActiveByRegistrationId(registrationId) {
      const row = store.findActiveWaitlistByRegistrationId(registrationId);
      return row ? createWaitlistEntry(row) : null;
    },
    async listActive(competitionId, divisionId = null) {
      return store
        .listActiveWaitlist(competitionId, divisionId)
        .map((e) => createWaitlistEntry(e));
    },
    async save(entry, opts = {}) {
      const normalized = createWaitlistEntry(entry);
      const stored = store.saveWaitlistEntry(normalized, opts);
      return createWaitlistEntry(stored);
    },
    async getScopeVersion(competitionId, divisionId = null) {
      return store.getWaitlistScopeVersion(competitionId, divisionId);
    },
  };
}

/**
 * Compose Core-03 persistence repositories for Phase 1F.
 *
 * @param {{
 *   store?: ReturnType<typeof createCore03MemoryPersistenceStore>,
 * }} [options]
 */
export function createCore03PersistenceRepositories(options = {}) {
  const store = options.store || createCore03MemoryPersistenceStore();

  const registration = createRegistrationRepositoryAdapter(store);
  const audit = createRegistrationAuditRepositoryAdapter(store);
  const eligibilityEvidence = createEligibilityEvidenceRepositoryAdapter(store);
  const capacityState = createCapacityStateRepositoryAdapter(store);
  const capacityReservations = createCapacityReservationRepositoryAdapter(store);
  const waitlist = createWaitlistRepositoryAdapter(store);

  return Object.freeze({
    store,
    registration,
    audit,
    eligibilityEvidence,
    capacityState,
    capacityReservations,
    waitlist,
    persistenceVersion: PERSISTENCE_FOUNDATION_VERSION,
    persistenceBackend: store.persistenceBackend || "memory",
    sqlApplied: false,
    databaseConnected: false,
    entryCreationDeferred: "DEFERRED_FAIL_CLOSED",
    /**
     * @param {{ operation: string, steps: Array<Function>, reconciliationId?: string|null }} input
     */
    runTransaction(input) {
      return runPersistenceTransaction({ store, ...input });
    },
    /**
     * Defensive metadata — never expose mutable maps or credentials.
     */
    getPublicMetadata() {
      return cloneJsonSafe({
        persistenceVersion: PERSISTENCE_FOUNDATION_VERSION,
        persistenceBackend: store.persistenceBackend || "memory",
        sqlApplied: false,
        databaseConnected: false,
        supportsTransactions: store.supportsTransactions === true,
        entryCreationDeferred: "DEFERRED_FAIL_CLOSED",
      });
    },
  });
}

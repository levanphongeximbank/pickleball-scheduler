/**
 * Phase 1F — in-memory Core-03 persistence store.
 * Implements uniqueness, optimistic concurrency, and snapshot transactions.
 * NOT a Production database connection.
 */

import { cloneJsonSafe, isNonEmptyString } from "../contracts/shared.js";
import { isTerminalRegistrationStatus } from "../enums/registrationStatus.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";

/**
 * @returns {import('./memoryPersistenceStore.js').Core03MemoryPersistenceStore}
 */
export function createCore03MemoryPersistenceStore() {
  /** @type {Map<string, any>} */
  let registrationsById = new Map();
  /** @type {Map<string, string>} */
  let registrationRequestToId = new Map();
  /** @type {Map<string, any>} */
  let idempotencyByKey = new Map();
  /** @type {Map<string, string>} */
  let activeIdentityToId = new Map();
  /** @type {Map<string, any>} */
  let evidenceById = new Map();
  /** @type {Map<string, string>} */
  let latestEvidenceByRegistration = new Map();
  /** @type {Map<string, string>} */
  let evidenceByFingerprint = new Map();
  /** @type {Map<string, any>} */
  let capacityByScope = new Map();
  /** @type {Map<string, any>} */
  let reservationsById = new Map();
  /** @type {Map<string, string>} */
  let activeReservationByRegistration = new Map();
  /** @type {Map<string, any>} */
  let waitlistById = new Map();
  /** @type {Map<string, string>} */
  let activeWaitlistByRegistration = new Map();
  /** @type {Map<string, number>} */
  let waitlistScopeVersion = new Map();
  /** @type {any[]} */
  let auditEvents = [];
  /** @type {Map<string, any>} */
  let reconciliationById = new Map();

  /** @type {null | ReturnType<typeof snapshot>} */
  let txSnapshot = null;
  let txDepth = 0;

  function snapshot() {
    return {
      registrationsById: cloneMap(registrationsById),
      registrationRequestToId: cloneMap(registrationRequestToId),
      idempotencyByKey: cloneMap(idempotencyByKey),
      activeIdentityToId: cloneMap(activeIdentityToId),
      evidenceById: cloneMap(evidenceById),
      latestEvidenceByRegistration: cloneMap(latestEvidenceByRegistration),
      evidenceByFingerprint: cloneMap(evidenceByFingerprint),
      capacityByScope: cloneMap(capacityByScope),
      reservationsById: cloneMap(reservationsById),
      activeReservationByRegistration: cloneMap(activeReservationByRegistration),
      waitlistById: cloneMap(waitlistById),
      activeWaitlistByRegistration: cloneMap(activeWaitlistByRegistration),
      waitlistScopeVersion: cloneMap(waitlistScopeVersion),
      auditEvents: auditEvents.map((e) => cloneJsonSafe(e)),
      reconciliationById: cloneMap(reconciliationById),
    };
  }

  function restore(s) {
    registrationsById = cloneMap(s.registrationsById);
    registrationRequestToId = cloneMap(s.registrationRequestToId);
    idempotencyByKey = cloneMap(s.idempotencyByKey);
    activeIdentityToId = cloneMap(s.activeIdentityToId);
    evidenceById = cloneMap(s.evidenceById);
    latestEvidenceByRegistration = cloneMap(s.latestEvidenceByRegistration);
    evidenceByFingerprint = cloneMap(s.evidenceByFingerprint);
    capacityByScope = cloneMap(s.capacityByScope);
    reservationsById = cloneMap(s.reservationsById);
    activeReservationByRegistration = cloneMap(s.activeReservationByRegistration);
    waitlistById = cloneMap(s.waitlistById);
    activeWaitlistByRegistration = cloneMap(s.activeWaitlistByRegistration);
    waitlistScopeVersion = cloneMap(s.waitlistScopeVersion);
    auditEvents = s.auditEvents.map((e) => cloneJsonSafe(e));
    reconciliationById = cloneMap(s.reconciliationById);
  }

  function beginTransaction() {
    if (txDepth === 0) {
      txSnapshot = snapshot();
    }
    txDepth += 1;
    return { supportsRollback: true, depth: txDepth };
  }

  function commitTransaction() {
    if (txDepth <= 0) {
      throw new Error("NO_ACTIVE_TRANSACTION");
    }
    txDepth -= 1;
    if (txDepth === 0) {
      txSnapshot = null;
    }
    return { committed: true, depth: txDepth };
  }

  function rollbackTransaction() {
    if (txDepth <= 0) {
      throw new Error("NO_ACTIVE_TRANSACTION");
    }
    if (!txSnapshot) {
      throw new Error("MISSING_TRANSACTION_SNAPSHOT");
    }
    restore(txSnapshot);
    txDepth = 0;
    txSnapshot = null;
    return { rolledBack: true };
  }

  function requireCompetitionScope(competitionId, field = "competitionId") {
    if (!isNonEmptyString(competitionId)) {
      const err = new Error("MISSING_PERSISTENCE_SCOPE");
      err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.PERSISTENCE_SCOPE_REQUIRED;
      err.metadata = { field };
      throw err;
    }
    return String(competitionId).trim();
  }

  return {
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    supportsTransactions: true,
    persistenceBackend: "memory",

    // --- registrations ---
    getRegistration(id) {
      return cloneJsonSafe(registrationsById.get(String(id || "")) ?? null);
    },
    listRegistrationsByCompetition(competitionId) {
      const id = requireCompetitionScope(competitionId);
      return [...registrationsById.values()]
        .filter((r) => r.competitionId === id)
        .map((r) => cloneJsonSafe(r));
    },
    /**
     * @param {any} registration
     * @param {{ expectedStateVersion?: number|null }} [opts]
     */
    saveRegistration(registration, opts = {}) {
      if (!registration || !isNonEmptyString(registration.id)) {
        throw new TypeError("saveRegistration requires registration.id");
      }
      requireCompetitionScope(registration.competitionId);
      if (!isNonEmptyString(registration.registrationRequestId)) {
        const err = new Error("MISSING_REGISTRATION_REQUEST_ID");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.PERSISTENCE_SCOPE_REQUIRED;
        err.metadata = { field: "registrationRequestId" };
        throw err;
      }

      const id = String(registration.id).trim();
      const requestId = String(registration.registrationRequestId).trim();
      const existing = registrationsById.get(id);
      const incomingVersion = Number(registration.stateVersion ?? 0);

      if (
        opts.expectedStateVersion != null &&
        existing &&
        Number(existing.stateVersion ?? 0) !== Number(opts.expectedStateVersion)
      ) {
        const err = new Error("STALE_REGISTRATION_VERSION");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_REGISTRATION_VERSION;
        err.metadata = {
          expectedStateVersion: Number(opts.expectedStateVersion),
          actualStateVersion: Number(existing.stateVersion ?? 0),
          registrationId: id,
        };
        throw err;
      }

      if (existing && opts.expectedStateVersion == null) {
        // Optimistic default: reject silent last-write-wins when version decreases.
        if (incomingVersion < Number(existing.stateVersion ?? 0)) {
          const err = new Error("STALE_REGISTRATION_VERSION");
          err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_REGISTRATION_VERSION;
          err.metadata = {
            expectedStateVersion: Number(existing.stateVersion ?? 0),
            actualStateVersion: incomingVersion,
            registrationId: id,
          };
          throw err;
        }
      }

      const existingByRequest = registrationRequestToId.get(requestId);
      if (existingByRequest && existingByRequest !== id) {
        const err = new Error("DUPLICATE_REGISTRATION_REQUEST_ID");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_REGISTRATION_REQUEST_ID;
        err.metadata = {
          registrationRequestId: requestId,
          existingRegistrationId: existingByRequest,
          attemptedRegistrationId: id,
        };
        throw err;
      }

      const identityKey =
        registration.identityKey != null ? String(registration.identityKey) : null;
      if (identityKey && !isTerminalRegistrationStatus(registration.status)) {
        const activeOwner = activeIdentityToId.get(identityKey);
        if (activeOwner && activeOwner !== id) {
          const err = new Error("DUPLICATE_REGISTRATION_IDENTITY_KEY");
          err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_REGISTRATION;
          err.metadata = {
            identityKey,
            existingRegistrationId: activeOwner,
            attemptedRegistrationId: id,
          };
          throw err;
        }
      }

      // Clear previous identity ownership if identity/status changed.
      if (existing?.identityKey && existing.identityKey !== identityKey) {
        if (activeIdentityToId.get(String(existing.identityKey)) === id) {
          activeIdentityToId.delete(String(existing.identityKey));
        }
      }
      if (
        existing?.identityKey &&
        isTerminalRegistrationStatus(registration.status) &&
        activeIdentityToId.get(String(existing.identityKey)) === id
      ) {
        activeIdentityToId.delete(String(existing.identityKey));
      }

      const stored = cloneJsonSafe(registration);
      registrationsById.set(id, stored);
      registrationRequestToId.set(requestId, id);
      if (identityKey && !isTerminalRegistrationStatus(registration.status)) {
        activeIdentityToId.set(identityKey, id);
      }
      return cloneJsonSafe(stored);
    },

    getIdempotencyRecord(key) {
      return cloneJsonSafe(idempotencyByKey.get(String(key || "")) ?? null);
    },
    saveIdempotencyRecord(record) {
      if (!record || !isNonEmptyString(record.idempotencyKey)) {
        throw new TypeError("saveIdempotencyRecord requires idempotencyKey");
      }
      const key = String(record.idempotencyKey).trim();
      const existing = idempotencyByKey.get(key);
      if (existing && existing.registrationId !== record.registrationId) {
        const err = new Error("DUPLICATE_IDEMPOTENCY_KEY");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT;
        err.metadata = {
          idempotencyKey: key,
          existingRegistrationId: existing.registrationId,
          attemptedRegistrationId: record.registrationId,
        };
        throw err;
      }
      const stored = cloneJsonSafe(record);
      idempotencyByKey.set(key, stored);
      return cloneJsonSafe(stored);
    },

    findRegistrationByIdentityKey(identityKey) {
      const key = String(identityKey || "");
      if (!key) return null;
      const id = activeIdentityToId.get(key);
      return id ? cloneJsonSafe(registrationsById.get(id) ?? null) : null;
    },

    // --- eligibility evidence ---
    getEvidence(id) {
      return cloneJsonSafe(evidenceById.get(String(id || "")) ?? null);
    },
    getLatestEvidenceByRegistrationId(registrationId) {
      const id = latestEvidenceByRegistration.get(String(registrationId || ""));
      return id ? cloneJsonSafe(evidenceById.get(id) ?? null) : null;
    },
    getEvidenceByFingerprint(fingerprint) {
      const id = evidenceByFingerprint.get(String(fingerprint || ""));
      return id ? cloneJsonSafe(evidenceById.get(id) ?? null) : null;
    },
    saveEvidence(evidence) {
      if (!evidence || !isNonEmptyString(evidence.id)) {
        throw new TypeError("saveEvidence requires id");
      }
      requireCompetitionScope(evidence.competitionId);
      if (!isNonEmptyString(evidence.registrationId)) {
        const err = new Error("MISSING_REGISTRATION_ID");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.PERSISTENCE_SCOPE_REQUIRED;
        err.metadata = { field: "registrationId" };
        throw err;
      }
      const fingerprint = evidence.canonicalRequestFingerprint
        ? String(evidence.canonicalRequestFingerprint).trim()
        : null;
      if (fingerprint) {
        const existingId = evidenceByFingerprint.get(fingerprint);
        if (existingId && existingId !== evidence.id) {
          const existing = evidenceById.get(existingId);
          // Exact replay → return existing logical record
          if (
            existing &&
            existing.evaluationRequestId === evidence.evaluationRequestId &&
            existing.registrationId === evidence.registrationId
          ) {
            return cloneJsonSafe(existing);
          }
          const err = new Error("DUPLICATE_EVALUATION_FINGERPRINT");
          err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_EVALUATION_FINGERPRINT;
          err.metadata = {
            canonicalRequestFingerprint: fingerprint,
            existingEvidenceId: existingId,
            attemptedEvidenceId: evidence.id,
          };
          throw err;
        }
      }
      const stored = cloneJsonSafe(evidence);
      evidenceById.set(stored.id, stored);
      latestEvidenceByRegistration.set(stored.registrationId, stored.id);
      if (fingerprint) {
        evidenceByFingerprint.set(fingerprint, stored.id);
      }
      return cloneJsonSafe(stored);
    },

    // --- capacity ---
    getCapacityState(competitionId, divisionId = null) {
      const comp = requireCompetitionScope(competitionId);
      const key = buildScopeKey(comp, divisionId);
      const existing = capacityByScope.get(key);
      if (existing) return cloneJsonSafe(existing);
      return cloneJsonSafe({
        competitionId: comp,
        divisionId: normalizeDivision(divisionId),
        limit: null,
        used: 0,
        reserved: 0,
        stateVersion: 0,
        sourceVersion: null,
        updatedAt: null,
      });
    },
    /**
     * @param {any} state
     * @param {{ expectedStateVersion?: number|null }} [opts]
     */
    saveCapacityState(state, opts = {}) {
      if (!state || !isNonEmptyString(state.competitionId)) {
        throw new TypeError("saveCapacityState requires competitionId");
      }
      const next = {
        competitionId: requireCompetitionScope(state.competitionId),
        divisionId: normalizeDivision(state.divisionId),
        limit: state.limit == null ? null : Number(state.limit),
        used: Number(state.used ?? 0),
        reserved: Number(state.reserved ?? 0),
        stateVersion: Number(state.stateVersion ?? 0),
        sourceVersion:
          state.sourceVersion == null || state.sourceVersion === ""
            ? null
            : Number(state.sourceVersion),
        updatedAt: state.updatedAt ?? null,
      };
      if (
        next.limit != null &&
        (!Number.isFinite(next.limit) || next.limit < 0 || !Number.isInteger(next.limit))
      ) {
        const err = new Error("INVALID_CAPACITY_CONFIGURATION");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_CAPACITY_CONFIGURATION;
        throw err;
      }
      if (
        next.used < 0 ||
        next.reserved < 0 ||
        !Number.isInteger(next.used) ||
        !Number.isInteger(next.reserved)
      ) {
        const err = new Error("INVALID_CAPACITY_CONFIGURATION");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_CAPACITY_CONFIGURATION;
        throw err;
      }
      if (next.limit != null && next.used + next.reserved > next.limit) {
        const err = new Error("used+reserved exceeds limit");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_CAPACITY_CONFIGURATION;
        throw err;
      }
      const key = buildScopeKey(next.competitionId, next.divisionId);
      const existing = capacityByScope.get(key);
      if (
        opts.expectedStateVersion != null &&
        existing &&
        existing.stateVersion !== Number(opts.expectedStateVersion)
      ) {
        const err = new Error("STALE_CAPACITY_VERSION");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_CAPACITY_VERSION;
        err.metadata = {
          expectedStateVersion: Number(opts.expectedStateVersion),
          actualStateVersion: existing.stateVersion,
          scopeKey: key,
        };
        throw err;
      }
      capacityByScope.set(key, cloneJsonSafe(next));
      return cloneJsonSafe(next);
    },
    listCapacityByCompetition(competitionId) {
      const id = requireCompetitionScope(competitionId);
      return [...capacityByScope.values()]
        .filter((s) => s.competitionId === id)
        .map((s) => cloneJsonSafe(s));
    },

    // --- reservations ---
    getReservation(id) {
      return cloneJsonSafe(reservationsById.get(String(id || "")) ?? null);
    },
    findActiveReservationByRegistrationId(registrationId) {
      const id = activeReservationByRegistration.get(String(registrationId || ""));
      if (!id) return null;
      const reservation = reservationsById.get(id);
      if (!reservation || reservation.status !== "ACTIVE") return null;
      return cloneJsonSafe(reservation);
    },
    saveReservation(reservation) {
      if (!reservation || !isNonEmptyString(reservation.reservationId)) {
        throw new TypeError("saveReservation requires reservationId");
      }
      requireCompetitionScope(reservation.competitionId);
      if (!isNonEmptyString(reservation.registrationId)) {
        const err = new Error("MISSING_REGISTRATION_ID");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.PERSISTENCE_SCOPE_REQUIRED;
        err.metadata = { field: "registrationId" };
        throw err;
      }
      const stored = cloneJsonSafe(reservation);
      const existingActiveId = activeReservationByRegistration.get(stored.registrationId);
      if (stored.status === "ACTIVE") {
        if (existingActiveId && existingActiveId !== stored.reservationId) {
          const err = new Error("DUPLICATE_ACTIVE_RESERVATION");
          err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ACTIVE_RESERVATION;
          err.metadata = {
            registrationId: stored.registrationId,
            existingReservationId: existingActiveId,
            attemptedReservationId: stored.reservationId,
          };
          throw err;
        }
        activeReservationByRegistration.set(stored.registrationId, stored.reservationId);
      } else if (existingActiveId === stored.reservationId) {
        activeReservationByRegistration.delete(stored.registrationId);
      }
      reservationsById.set(stored.reservationId, stored);
      return cloneJsonSafe(stored);
    },
    listReservationsByCompetition(competitionId) {
      const id = requireCompetitionScope(competitionId);
      return [...reservationsById.values()]
        .filter((r) => r.competitionId === id)
        .map((r) => cloneJsonSafe(r));
    },

    // --- waitlist ---
    getWaitlistEntry(id) {
      return cloneJsonSafe(waitlistById.get(String(id || "")) ?? null);
    },
    findActiveWaitlistByRegistrationId(registrationId) {
      const id = activeWaitlistByRegistration.get(String(registrationId || ""));
      if (!id) return null;
      const entry = waitlistById.get(id);
      if (!entry || entry.status !== "ACTIVE") return null;
      return cloneJsonSafe(entry);
    },
    listActiveWaitlist(competitionId, divisionId = null) {
      const comp = requireCompetitionScope(competitionId);
      const div = normalizeDivision(divisionId);
      return [...waitlistById.values()]
        .filter((e) => {
          if (e.status !== "ACTIVE") return false;
          if (e.competitionId !== comp) return false;
          if (div == null) return true;
          return e.divisionId === div;
        })
        .map((e) => cloneJsonSafe(e));
    },
    getWaitlistScopeVersion(competitionId, divisionId = null) {
      return (
        waitlistScopeVersion.get(
          buildScopeKey(requireCompetitionScope(competitionId), divisionId)
        ) || 0
      );
    },
    /**
     * @param {any} entry
     * @param {{ expectedWaitlistVersion?: number|null }} [opts]
     */
    saveWaitlistEntry(entry, opts = {}) {
      if (!entry || !isNonEmptyString(entry.waitlistEntryId)) {
        throw new TypeError("saveWaitlistEntry requires waitlistEntryId");
      }
      requireCompetitionScope(entry.competitionId);
      const scopeKey = buildScopeKey(entry.competitionId, entry.divisionId);
      const currentVersion = waitlistScopeVersion.get(scopeKey) || 0;
      if (
        opts.expectedWaitlistVersion != null &&
        Number(opts.expectedWaitlistVersion) !== currentVersion
      ) {
        const err = new Error("STALE_WAITLIST_VERSION");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_WAITLIST_VERSION;
        err.metadata = {
          expectedWaitlistVersion: Number(opts.expectedWaitlistVersion),
          actualWaitlistVersion: currentVersion,
          scopeKey,
        };
        throw err;
      }
      const stored = cloneJsonSafe(entry);
      const existingActiveId = activeWaitlistByRegistration.get(stored.registrationId);
      if (stored.status === "ACTIVE") {
        if (existingActiveId && existingActiveId !== stored.waitlistEntryId) {
          const err = new Error("WAITLIST_ENTRY_ALREADY_EXISTS");
          err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.WAITLIST_ENTRY_ALREADY_EXISTS;
          err.metadata = {
            registrationId: stored.registrationId,
            existingWaitlistEntryId: existingActiveId,
            attemptedWaitlistEntryId: stored.waitlistEntryId,
          };
          throw err;
        }
        activeWaitlistByRegistration.set(stored.registrationId, stored.waitlistEntryId);
      } else if (existingActiveId === stored.waitlistEntryId) {
        activeWaitlistByRegistration.delete(stored.registrationId);
      }
      const nextVersion = currentVersion + 1;
      waitlistScopeVersion.set(scopeKey, nextVersion);
      stored.waitlistVersion = nextVersion;
      waitlistById.set(stored.waitlistEntryId, stored);
      return cloneJsonSafe(stored);
    },

    // --- audit (append-only) ---
    appendAuditEvent(event) {
      if (!event || !isNonEmptyString(event.id)) {
        throw new TypeError("appendAuditEvent requires id");
      }
      if (!isNonEmptyString(event.registrationId)) {
        const err = new Error("MISSING_REGISTRATION_ID");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.PERSISTENCE_SCOPE_REQUIRED;
        err.metadata = { field: "registrationId" };
        throw err;
      }
      if (auditEvents.some((e) => e.id === event.id)) {
        const err = new Error("AUDIT_IMMUTABLE_DUPLICATE_ID");
        err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_IMMUTABLE;
        err.metadata = { auditEventId: event.id };
        throw err;
      }
      auditEvents.push(cloneJsonSafe(event));
    },
    listAuditByRegistration(registrationId) {
      const id = String(registrationId || "");
      return auditEvents.filter((e) => e.registrationId === id).map((e) => cloneJsonSafe(e));
    },
    updateAuditEvent() {
      const err = new Error("AUDIT_UPDATE_FORBIDDEN");
      err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_IMMUTABLE;
      throw err;
    },
    deleteAuditEvent() {
      const err = new Error("AUDIT_DELETE_FORBIDDEN");
      err.code = REGISTRATION_ELIGIBILITY_ERROR_CODE.AUDIT_IMMUTABLE;
      throw err;
    },

    // --- reconciliation metadata ---
    saveReconciliationRecord(record) {
      if (!record || !isNonEmptyString(record.id)) {
        throw new TypeError("saveReconciliationRecord requires id");
      }
      const stored = cloneJsonSafe(record);
      reconciliationById.set(stored.id, stored);
      return cloneJsonSafe(stored);
    },
    getReconciliationRecord(id) {
      return cloneJsonSafe(reconciliationById.get(String(id || "")) ?? null);
    },
  };
}

/**
 * @param {Map<any, any>} map
 */
function cloneMap(map) {
  /** @type {Map<any, any>} */
  const next = new Map();
  for (const [k, v] of map.entries()) {
    next.set(k, typeof v === "object" && v !== null ? cloneJsonSafe(v) : v);
  }
  return next;
}

function normalizeDivision(divisionId) {
  return divisionId != null && String(divisionId).trim() !== ""
    ? String(divisionId).trim()
    : null;
}

function buildScopeKey(competitionId, divisionId) {
  const div = normalizeDivision(divisionId) ?? "NONE";
  return `${String(competitionId).trim()}::${div}`;
}

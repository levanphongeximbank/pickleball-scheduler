/**
 * RegistrationRepositoryPort — persistence interface only.
 * Phase 1A: in-memory stub for tests. No Production / Supabase adapter.
 *
 * Phase 1B: in-memory returns defensive copies and rejects unsafe duplicate keys.
 *
 * @typedef {Object} RegistrationRepositoryPort
 * @property {(id: string) => Promise<import('../contracts/competitionRegistration.js').CompetitionRegistration|null>} getById
 * @property {(competitionId: string) => Promise<import('../contracts/competitionRegistration.js').CompetitionRegistration[]>} listByCompetition
 * @property {(idempotencyKey: string) => Promise<import('../contracts/idempotency.js').RegistrationIdempotencyRecord|null>} findIdempotencyRecord
 * @property {(registration: import('../contracts/competitionRegistration.js').CompetitionRegistration) => Promise<import('../contracts/competitionRegistration.js').CompetitionRegistration>} save
 * @property {(record: import('../contracts/idempotency.js').RegistrationIdempotencyRecord) => Promise<import('../contracts/idempotency.js').RegistrationIdempotencyRecord>} saveIdempotencyRecord
 * @property {(identityKey: string) => Promise<import('../contracts/competitionRegistration.js').CompetitionRegistration|null>} [findByIdentityKey]
 */

import { cloneJsonSafe } from "../contracts/shared.js";

export const REGISTRATION_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "findIdempotencyRecord",
  "save",
  "saveIdempotencyRecord",
  "findByIdentityKey",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRegistrationRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return ["getById", "listByCompetition", "findIdempotencyRecord", "save", "saveIdempotencyRecord"].every(
    (name) => typeof /** @type {any} */ (port)[name] === "function"
  );
}

/**
 * In-memory repository — NOT Production persistence.
 * @returns {RegistrationRepositoryPort}
 */
export function createInMemoryRegistrationRepositoryPort() {
  /** @type {Map<string, import('../contracts/competitionRegistration.js').CompetitionRegistration>} */
  const byId = new Map();
  /** @type {Map<string, import('../contracts/idempotency.js').RegistrationIdempotencyRecord>} */
  const byIdempotency = new Map();
  /** @type {Map<string, string>} */
  const identityToId = new Map();

  /**
   * @param {import('../contracts/competitionRegistration.js').CompetitionRegistration|null} registration
   * @returns {import('../contracts/competitionRegistration.js').CompetitionRegistration|null}
   */
  function cloneRegistration(registration) {
    return registration ? /** @type {import('../contracts/competitionRegistration.js').CompetitionRegistration} */ (cloneJsonSafe(registration)) : null;
  }

  /**
   * @param {import('../contracts/idempotency.js').RegistrationIdempotencyRecord|null} record
   * @returns {import('../contracts/idempotency.js').RegistrationIdempotencyRecord|null}
   */
  function cloneIdempotencyRecord(record) {
    return record ? /** @type {import('../contracts/idempotency.js').RegistrationIdempotencyRecord} */ (cloneJsonSafe(record)) : null;
  }

  return {
    async getById(id) {
      return cloneRegistration(byId.get(String(id)) ?? null);
    },
    async listByCompetition(competitionId) {
      const id = String(competitionId || "");
      return [...byId.values()]
        .filter((r) => r.competitionId === id)
        .map((r) => cloneRegistration(r));
    },
    async findIdempotencyRecord(idempotencyKey) {
      return cloneIdempotencyRecord(byIdempotency.get(String(idempotencyKey || "")) ?? null);
    },
    async save(registration) {
      if (!registration || typeof registration !== "object" || !registration.id) {
        throw new TypeError("save requires registration with id");
      }
      const id = String(registration.id);
      const stored = cloneRegistration(registration);
      if (!stored) {
        throw new TypeError("save requires registration with id");
      }

      if (stored.identityKey) {
        const existingId = identityToId.get(String(stored.identityKey));
        if (existingId && existingId !== id) {
          const err = new Error("DUPLICATE_REGISTRATION_IDENTITY_KEY");
          err.code = "REG_ELIG_DUPLICATE_REGISTRATION";
          err.metadata = {
            identityKey: stored.identityKey,
            existingRegistrationId: existingId,
            attemptedRegistrationId: id,
          };
          throw err;
        }
      }

      byId.set(id, stored);
      if (stored.identityKey) {
        identityToId.set(String(stored.identityKey), id);
      }
      return cloneRegistration(stored);
    },
    async saveIdempotencyRecord(record) {
      if (!record || typeof record !== "object" || !record.idempotencyKey) {
        throw new TypeError("saveIdempotencyRecord requires idempotencyKey");
      }
      const key = String(record.idempotencyKey);
      const existing = byIdempotency.get(key);
      if (
        existing &&
        existing.registrationId !== record.registrationId
      ) {
        const err = new Error("DUPLICATE_IDEMPOTENCY_KEY");
        err.code = "REG_ELIG_IDEMPOTENCY_CONFLICT";
        err.metadata = {
          idempotencyKey: key,
          existingRegistrationId: existing.registrationId,
          attemptedRegistrationId: record.registrationId,
        };
        throw err;
      }
      const stored = cloneIdempotencyRecord(record);
      if (!stored) {
        throw new TypeError("saveIdempotencyRecord requires idempotencyKey");
      }
      byIdempotency.set(key, stored);
      return cloneIdempotencyRecord(stored);
    },
    async findByIdentityKey(identityKey) {
      const key = String(identityKey || "");
      if (!key) return null;
      const id = identityToId.get(key);
      return id ? cloneRegistration(byId.get(id) ?? null) : null;
    },
  };
}

/**
 * @returns {RegistrationRepositoryPort}
 */
export function createNoopRegistrationRepositoryPort() {
  return {
    async getById() {
      return null;
    },
    async listByCompetition() {
      return [];
    },
    async findIdempotencyRecord() {
      return null;
    },
    async save() {
      throw new Error("NOOP_REPOSITORY_WRITE_FORBIDDEN");
    },
    async saveIdempotencyRecord() {
      throw new Error("NOOP_REPOSITORY_WRITE_FORBIDDEN");
    },
    async findByIdentityKey() {
      return null;
    },
  };
}

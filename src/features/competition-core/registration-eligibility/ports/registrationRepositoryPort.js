/**
 * RegistrationRepositoryPort — persistence interface only.
 * Phase 1A: in-memory stub for tests. No Production / Supabase adapter.
 *
 * @typedef {Object} RegistrationRepositoryPort
 * @property {(id: string) => Promise<import('../contracts/competitionRegistration.js').CompetitionRegistration|null>} getById
 * @property {(competitionId: string) => Promise<import('../contracts/competitionRegistration.js').CompetitionRegistration[]>} listByCompetition
 * @property {(idempotencyKey: string) => Promise<import('../contracts/idempotency.js').RegistrationIdempotencyRecord|null>} findIdempotencyRecord
 * @property {(registration: import('../contracts/competitionRegistration.js').CompetitionRegistration) => Promise<import('../contracts/competitionRegistration.js').CompetitionRegistration>} save
 * @property {(record: import('../contracts/idempotency.js').RegistrationIdempotencyRecord) => Promise<import('../contracts/idempotency.js').RegistrationIdempotencyRecord>} saveIdempotencyRecord
 * @property {(identityKey: string) => Promise<import('../contracts/competitionRegistration.js').CompetitionRegistration|null>} [findByIdentityKey]
 */

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

  return {
    async getById(id) {
      return byId.get(String(id)) ?? null;
    },
    async listByCompetition(competitionId) {
      const id = String(competitionId || "");
      return [...byId.values()].filter((r) => r.competitionId === id);
    },
    async findIdempotencyRecord(idempotencyKey) {
      return byIdempotency.get(String(idempotencyKey || "")) ?? null;
    },
    async save(registration) {
      if (!registration || typeof registration !== "object" || !registration.id) {
        throw new TypeError("save requires registration with id");
      }
      byId.set(String(registration.id), registration);
      if (registration.identityKey) {
        identityToId.set(String(registration.identityKey), String(registration.id));
      }
      return registration;
    },
    async saveIdempotencyRecord(record) {
      if (!record || typeof record !== "object" || !record.idempotencyKey) {
        throw new TypeError("saveIdempotencyRecord requires idempotencyKey");
      }
      byIdempotency.set(String(record.idempotencyKey), record);
      return record;
    },
    async findByIdentityKey(identityKey) {
      const key = String(identityKey || "");
      if (!key) return null;
      const id = identityToId.get(key);
      return id ? byId.get(id) ?? null : null;
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

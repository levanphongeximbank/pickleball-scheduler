/**
 * Phase 3C — Persistence port (stub only).
 * No Supabase. No RPC. No Production writes from this runtime.
 */

/**
 * @typedef {Object} RegistrationPersistencePort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(registration: unknown) => Promise<unknown>} save
 * @property {(identity: { key: string }|string) => Promise<unknown|null>} findByIdentityKey
 */

export const REGISTRATION_PERSISTENCE_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "findByIdentityKey",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRegistrationPersistencePort(port) {
  if (!port || typeof port !== "object") return false;
  return REGISTRATION_PERSISTENCE_PORT_METHODS.every(
    (name) => typeof port[name] === "function"
  );
}

/**
 * In-memory stub — NOT a Production adapter.
 * @returns {RegistrationPersistencePort}
 */
export function createInMemoryRegistrationPersistencePort() {
  /** @type {Map<string, unknown>} */
  const byId = new Map();
  /** @type {Map<string, string>} */
  const identityToId = new Map();

  return {
    async getById(id) {
      return byId.get(String(id)) ?? null;
    },
    async listByCompetition(competitionId) {
      return [...byId.values()].filter(
        (r) =>
          r &&
          typeof r === "object" &&
          /** @type {{ competitionId?: string }} */ (r).competitionId === competitionId
      );
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
    async findByIdentityKey(identity) {
      const key =
        typeof identity === "string"
          ? identity
          : identity && typeof identity === "object"
            ? String(identity.key || "")
            : "";
      if (!key) return null;
      const id = identityToId.get(key);
      return id ? byId.get(id) ?? null : null;
    },
  };
}

/**
 * No-op persistence — rejects writes for safety tests.
 * @returns {RegistrationPersistencePort}
 */
export function createNoopRegistrationPersistencePort() {
  return {
    async getById() {
      return null;
    },
    async listByCompetition() {
      return [];
    },
    async save() {
      throw new Error("NOOP_PERSISTENCE_WRITE_FORBIDDEN");
    },
    async findByIdentityKey() {
      return null;
    },
  };
}

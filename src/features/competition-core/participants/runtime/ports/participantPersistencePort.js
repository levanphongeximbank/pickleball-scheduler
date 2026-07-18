/**
 * Phase 3B — Persistence port (abstraction only).
 * Production persistence MUST NOT be invoked from this runtime.
 * Adapters here are stub / in-memory / mock only.
 */

/**
 * @typedef {Object} ParticipantPersistencePort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(participant: unknown) => Promise<unknown>} save
 * @property {(identity: { key: string }|string) => Promise<unknown|null>} findByIdentityKey
 */

export const PARTICIPANT_PERSISTENCE_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "findByIdentityKey",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesParticipantPersistencePort(port) {
  if (!port || typeof port !== "object") return false;
  return PARTICIPANT_PERSISTENCE_PORT_METHODS.every(
    (name) => typeof port[name] === "function"
  );
}

/**
 * In-memory stub — NOT a Production adapter.
 * @returns {ParticipantPersistencePort}
 */
export function createInMemoryParticipantPersistencePort() {
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
        (p) =>
          p &&
          typeof p === "object" &&
          /** @type {{ competitionId?: string }} */ (p).competitionId === competitionId
      );
    },
    async save(participant) {
      if (!participant || typeof participant !== "object" || !participant.id) {
        throw new TypeError("save requires participant with id");
      }
      byId.set(String(participant.id), participant);
      const key =
        participant.identityKey ||
        (participant.person
          ? `${participant.competitionId}::${participant.person.kind}::${participant.person.id}`
          : null);
      if (key) identityToId.set(String(key), String(participant.id));
      return participant;
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
 * No-op persistence — always empty / rejects writes for safety tests.
 * @returns {ParticipantPersistencePort}
 */
export function createNoopParticipantPersistencePort() {
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

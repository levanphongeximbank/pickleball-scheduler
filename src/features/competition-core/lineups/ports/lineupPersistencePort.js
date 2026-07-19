/**
 * Phase 3E — Lineup persistence port (stub only).
 * No Supabase. No RPC. No Production writes from this runtime.
 */

/**
 * @typedef {Object} LineupPersistencePort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(lineup: unknown) => Promise<unknown>} save
 * @property {(lineup: unknown) => Promise<unknown>} [saveRevision]
 * @property {(identity: { key: string }|string) => Promise<unknown|null>} findByIdentityKey
 */

export const LINEUP_PERSISTENCE_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "findByIdentityKey",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesLineupPersistencePort(port) {
  if (!port || typeof port !== "object") return false;
  return LINEUP_PERSISTENCE_PORT_METHODS.every(
    (name) => typeof port[name] === "function"
  );
}

/**
 * @returns {LineupPersistencePort}
 */
export function createInMemoryLineupPersistencePort() {
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
          /** @type {{ competitionId?: string }} */ (r).competitionId ===
            competitionId
      );
    },
    async save(lineup) {
      if (!lineup || typeof lineup !== "object" || !lineup.id) {
        throw new TypeError("save requires lineup with id");
      }
      byId.set(String(lineup.id), lineup);
      if (lineup.identityKey) {
        identityToId.set(String(lineup.identityKey), String(lineup.id));
      }
      return lineup;
    },
    async saveRevision(lineup) {
      return this.save(lineup);
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
 * @returns {LineupPersistencePort}
 */
export function createNoopLineupPersistencePort() {
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
    async saveRevision() {
      throw new Error("NOOP_PERSISTENCE_WRITE_FORBIDDEN");
    },
    async findByIdentityKey() {
      return null;
    },
  };
}

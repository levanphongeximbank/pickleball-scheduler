/**
 * Phase 3D — Team / Roster persistence ports (stub only).
 * No Supabase. No RPC. No Production writes from this runtime.
 */

/**
 * @typedef {Object} TeamPersistencePort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(team: unknown) => Promise<unknown>} save
 * @property {(identity: { key: string }|string) => Promise<unknown|null>} findByIdentityKey
 */

/**
 * @typedef {Object} RosterPersistencePort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(roster: unknown) => Promise<unknown>} save
 * @property {(identity: { key: string }|string) => Promise<unknown|null>} findByIdentityKey
 */

export const TEAM_PERSISTENCE_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "findByIdentityKey",
]);

export const ROSTER_PERSISTENCE_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "findByIdentityKey",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesTeamPersistencePort(port) {
  if (!port || typeof port !== "object") return false;
  return TEAM_PERSISTENCE_PORT_METHODS.every(
    (name) => typeof port[name] === "function"
  );
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRosterPersistencePort(port) {
  if (!port || typeof port !== "object") return false;
  return ROSTER_PERSISTENCE_PORT_METHODS.every(
    (name) => typeof port[name] === "function"
  );
}

/**
 * @returns {TeamPersistencePort}
 */
export function createInMemoryTeamPersistencePort() {
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
    async save(team) {
      if (!team || typeof team !== "object" || !team.id) {
        throw new TypeError("save requires team with id");
      }
      byId.set(String(team.id), team);
      if (team.identityKey) {
        identityToId.set(String(team.identityKey), String(team.id));
      }
      return team;
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
 * @returns {RosterPersistencePort}
 */
export function createInMemoryRosterPersistencePort() {
  return createInMemoryTeamPersistencePort();
}

/**
 * @returns {TeamPersistencePort}
 */
export function createNoopTeamPersistencePort() {
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

/**
 * @returns {RosterPersistencePort}
 */
export function createNoopRosterPersistencePort() {
  return createNoopTeamPersistencePort();
}

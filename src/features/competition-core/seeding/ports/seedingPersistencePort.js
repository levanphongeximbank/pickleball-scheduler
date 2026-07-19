/**
 * Phase 3G — Seeding persistence port (stub only).
 * No Supabase. No RPC. No Production writes from this runtime.
 */

/**
 * @typedef {Object} SeedingPersistencePort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(record: unknown) => Promise<unknown>} save
 * @property {(identity: { key: string }|string) => Promise<unknown|null>} findByIdentityKey
 * @property {(snapshot: unknown) => Promise<unknown>} [saveSnapshot]
 */

export const SEEDING_PERSISTENCE_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "findByIdentityKey",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesSeedingPersistencePort(port) {
  if (!port || typeof port !== "object") return false;
  return SEEDING_PERSISTENCE_PORT_METHODS.every(
    (name) => typeof port[name] === "function"
  );
}

/**
 * @returns {SeedingPersistencePort}
 */
export function createInMemorySeedingPersistencePort() {
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
    async save(record) {
      if (!record || typeof record !== "object" || !record.id) {
        throw new TypeError("save requires record with id");
      }
      byId.set(String(record.id), record);
      if (record.identityKey) {
        identityToId.set(String(record.identityKey), String(record.id));
      }
      return record;
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
    async saveSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== "object") {
        throw new TypeError("saveSnapshot requires object");
      }
      const id = String(
        /** @type {{ id?: string, identityKey?: string }} */ (snapshot).id ||
          /** @type {{ identityKey?: string }} */ (snapshot).identityKey ||
          ""
      );
      if (!id) throw new TypeError("saveSnapshot requires id or identityKey");
      return this.save({ ...snapshot, id });
    },
  };
}

/**
 * @returns {SeedingPersistencePort}
 */
export function createNoopSeedingPersistencePort() {
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
    async saveSnapshot() {
      throw new Error("NOOP_PERSISTENCE_WRITE_FORBIDDEN");
    },
  };
}

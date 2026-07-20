/**
 * CORE-06 Phase 1C — LineupPersistencePort (contract + test doubles only).
 * No Supabase. No RPC. No Production writes.
 *
 * Writes accept expectedVersion for optimistic concurrency.
 */

import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";

/**
 * @typedef {Object} LineupPersistenceSaveOptions
 * @property {number|null|undefined} [expectedVersion]
 * @property {string|null|undefined} [idempotencyKey]
 * @property {string|null|undefined} [actorId]
 */

/**
 * @typedef {Object} LineupPersistencePort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(lineup: unknown, options?: LineupPersistenceSaveOptions) => Promise<unknown>} save
 * @property {(lineup: unknown, options?: LineupPersistenceSaveOptions) => Promise<unknown>} [saveRevision]
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
    async save(lineup, options = {}) {
      if (!lineup || typeof lineup !== "object" || !lineup.id) {
        throw new TypeError("save requires lineup with id");
      }
      const id = String(lineup.id);
      const existing = byId.get(id);
      if (
        options &&
        options.expectedVersion != null &&
        Number.isInteger(options.expectedVersion)
      ) {
        const currentRevision =
          existing &&
          typeof existing === "object" &&
          typeof /** @type {{ revision?: number }} */ (existing).revision ===
            "number"
            ? /** @type {{ revision: number }} */ (existing).revision
            : null;
        if (currentRevision != null && currentRevision !== options.expectedVersion) {
          throw new LineupRuntimeError(
            LINEUP_RUNTIME_ERROR_CODE.LINEUP_VERSION_CONFLICT,
            "Lineup expectedVersion conflict",
            {
              id,
              expectedVersion: options.expectedVersion,
              actualVersion: currentRevision,
            }
          );
        }
      }
      byId.set(id, lineup);
      if (lineup.identityKey) {
        identityToId.set(String(lineup.identityKey), id);
      }
      return lineup;
    },
    async saveRevision(lineup, options = {}) {
      return this.save(lineup, options);
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

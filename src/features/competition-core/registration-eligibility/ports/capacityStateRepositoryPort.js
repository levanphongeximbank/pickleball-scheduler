/**
 * CapacityStateRepositoryPort — competition/division capacity counters.
 * In-memory only for Phase 1D. No SQL / Supabase adapter.
 *
 * @typedef {Object} CapacityStateRecord
 * @property {string} competitionId
 * @property {string|null} divisionId
 * @property {number|null} limit
 * @property {number} used
 * @property {number} reserved
 * @property {number} stateVersion
 * @property {string|null} updatedAt
 */

import { cloneJsonSafe } from "../contracts/shared.js";
import { buildCapacityScopeKey } from "../policies/capacityAccounting.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";

export const CAPACITY_STATE_REPOSITORY_PORT_METHODS = Object.freeze([
  "getState",
  "saveState",
  "listByCompetition",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCapacityStateRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return CAPACITY_STATE_REPOSITORY_PORT_METHODS.every(
    (name) => typeof /** @type {any} */ (port)[name] === "function"
  );
}

/**
 * @param {Partial<CapacityStateRecord> & { competitionId: string }} seed
 * @returns {CapacityStateRecord}
 */
function normalizeState(seed) {
  return {
    competitionId: String(seed.competitionId).trim(),
    divisionId:
      seed.divisionId != null && String(seed.divisionId).trim() !== ""
        ? String(seed.divisionId).trim()
        : null,
    limit: seed.limit == null ? null : Number(seed.limit),
    used: Number(seed.used ?? 0),
    reserved: Number(seed.reserved ?? 0),
    stateVersion: Number(seed.stateVersion ?? 0),
    updatedAt: seed.updatedAt ?? null,
  };
}

/**
 * @param {{
 *   competitionStates?: Array<Partial<CapacityStateRecord> & { competitionId: string }>,
 * }} [options]
 */
export function createInMemoryCapacityStateRepositoryPort(options = {}) {
  /** @type {Map<string, CapacityStateRecord>} */
  const byScope = new Map();

  for (const seed of options.competitionStates || []) {
    const state = normalizeState(seed);
    byScope.set(buildCapacityScopeKey(state.competitionId, state.divisionId), state);
  }

  /**
   * @param {CapacityStateRecord|null} state
   * @returns {CapacityStateRecord|null}
   */
  function cloneState(state) {
    return state ? /** @type {CapacityStateRecord} */ (cloneJsonSafe(state)) : null;
  }

  return {
    /**
     * @param {string} competitionId
     * @param {string|null|undefined} divisionId
     */
    async getState(competitionId, divisionId = null) {
      const key = buildCapacityScopeKey(competitionId, divisionId);
      const existing = byScope.get(key);
      if (existing) return cloneState(existing);
      return cloneState(
        normalizeState({
          competitionId,
          divisionId: divisionId ?? null,
          limit: null,
          used: 0,
          reserved: 0,
          stateVersion: 0,
          updatedAt: null,
        })
      );
    },

    /**
     * @param {CapacityStateRecord} state
     * @param {{ expectedStateVersion?: number|null }} [opts]
     */
    async saveState(state, opts = {}) {
      if (!state || typeof state !== "object" || !state.competitionId) {
        throw new TypeError("saveState requires capacity state with competitionId");
      }
      const next = normalizeState(state);
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

      const key = buildCapacityScopeKey(next.competitionId, next.divisionId);
      const existing = byScope.get(key);
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

      const stored = cloneState(next);
      byScope.set(key, stored);
      return cloneState(stored);
    },

    /**
     * @param {string} competitionId
     */
    async listByCompetition(competitionId) {
      const id = String(competitionId || "");
      return [...byScope.values()]
        .filter((s) => s.competitionId === id)
        .map((s) => cloneState(s));
    },
  };
}

/**
 * @returns {ReturnType<typeof createInMemoryCapacityStateRepositoryPort>}
 */
export function createNullCapacityStateRepositoryPort() {
  return {
    async getState() {
      throw new TypeError("NullCapacityStateRepositoryPort cannot getState");
    },
    async saveState() {
      throw new TypeError("NullCapacityStateRepositoryPort cannot saveState");
    },
    async listByCompetition() {
      throw new TypeError("NullCapacityStateRepositoryPort cannot listByCompetition");
    },
  };
}

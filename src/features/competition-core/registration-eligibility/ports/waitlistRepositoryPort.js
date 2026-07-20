/**
 * WaitlistRepositoryPort — ordered waitlist entries for a competition/division scope.
 * In-memory only for Phase 1D.
 *
 * @typedef {import('../contracts/capacity.js').WaitlistEntry} WaitlistEntry
 */

import { cloneJsonSafe } from "../contracts/shared.js";
import { createWaitlistEntry } from "../contracts/capacity.js";
import { buildCapacityScopeKey } from "../policies/capacityAccounting.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";

export const WAITLIST_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "findActiveByRegistrationId",
  "listActive",
  "save",
  "getScopeVersion",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesWaitlistRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return WAITLIST_REPOSITORY_PORT_METHODS.every(
    (name) => typeof /** @type {any} */ (port)[name] === "function"
  );
}

export function createInMemoryWaitlistRepositoryPort() {
  /** @type {Map<string, WaitlistEntry>} */
  const byId = new Map();
  /** @type {Map<string, string>} */
  const activeByRegistration = new Map();
  /** @type {Map<string, number>} */
  const scopeVersion = new Map();

  /**
   * @param {WaitlistEntry|null} entry
   * @returns {WaitlistEntry|null}
   */
  function cloneEntry(entry) {
    return entry ? /** @type {WaitlistEntry} */ (cloneJsonSafe(entry)) : null;
  }

  /**
   * @param {string} competitionId
   * @param {string|null|undefined} divisionId
   */
  function bumpScopeVersion(competitionId, divisionId) {
    const key = buildCapacityScopeKey(competitionId, divisionId);
    const next = (scopeVersion.get(key) || 0) + 1;
    scopeVersion.set(key, next);
    return next;
  }

  return {
    async getById(waitlistEntryId) {
      return cloneEntry(byId.get(String(waitlistEntryId || "")) ?? null);
    },

    async findActiveByRegistrationId(registrationId) {
      const id = activeByRegistration.get(String(registrationId || ""));
      if (!id) return null;
      const entry = byId.get(id);
      if (!entry || entry.status !== "ACTIVE") return null;
      return cloneEntry(entry);
    },

    /**
     * @param {string} competitionId
     * @param {string|null|undefined} divisionId
     */
    async listActive(competitionId, divisionId = null) {
      const comp = String(competitionId || "");
      const div =
        divisionId != null && String(divisionId).trim() !== ""
          ? String(divisionId).trim()
          : null;
      return [...byId.values()]
        .filter((e) => {
          if (e.status !== "ACTIVE") return false;
          if (e.competitionId !== comp) return false;
          if (div == null) return true;
          return e.divisionId === div;
        })
        .map((e) => cloneEntry(e));
    },

    /**
     * @param {WaitlistEntry} entry
     * @param {{ expectedWaitlistVersion?: number|null }} [opts]
     */
    async save(entry, opts = {}) {
      const stored = createWaitlistEntry(entry);
      const scopeKey = buildCapacityScopeKey(stored.competitionId, stored.divisionId);
      const currentVersion = scopeVersion.get(scopeKey) || 0;

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

      const existingActiveId = activeByRegistration.get(stored.registrationId);
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
        activeByRegistration.set(stored.registrationId, stored.waitlistEntryId);
      } else if (existingActiveId === stored.waitlistEntryId) {
        activeByRegistration.delete(stored.registrationId);
      }

      const nextVersion = bumpScopeVersion(stored.competitionId, stored.divisionId);
      const withVersion = createWaitlistEntry({
        ...stored,
        waitlistVersion: nextVersion,
      });
      byId.set(
        withVersion.waitlistEntryId,
        /** @type {WaitlistEntry} */ (cloneJsonSafe(withVersion))
      );
      return cloneEntry(byId.get(withVersion.waitlistEntryId) ?? null);
    },

    /**
     * @param {string} competitionId
     * @param {string|null|undefined} divisionId
     */
    async getScopeVersion(competitionId, divisionId = null) {
      return scopeVersion.get(buildCapacityScopeKey(competitionId, divisionId)) || 0;
    },
  };
}

export function createNullWaitlistRepositoryPort() {
  return {
    async getById() {
      throw new TypeError("NullWaitlistRepositoryPort cannot getById");
    },
    async findActiveByRegistrationId() {
      throw new TypeError("NullWaitlistRepositoryPort cannot findActiveByRegistrationId");
    },
    async listActive() {
      throw new TypeError("NullWaitlistRepositoryPort cannot listActive");
    },
    async save() {
      throw new TypeError("NullWaitlistRepositoryPort cannot save");
    },
    async getScopeVersion() {
      throw new TypeError("NullWaitlistRepositoryPort cannot getScopeVersion");
    },
  };
}

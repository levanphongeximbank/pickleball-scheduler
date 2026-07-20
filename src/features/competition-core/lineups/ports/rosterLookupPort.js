/**
 * CORE-06 Phase 1C — RosterLookupPort (DI bridge to Core-05 roster snapshots).
 * No deep import from competition-core/teams.
 */

/**
 * @typedef {Object} RosterLookupRequest
 * @property {string} competitionId
 * @property {string} teamId
 * @property {string|null} [rosterId]
 * @property {number|null} [rosterVersion]
 * @property {string|null} [tenantId]
 */

/**
 * @typedef {Object} RosterLookupResult
 * @property {boolean} ok
 * @property {unknown|null} [roster]
 * @property {string|null} [code]
 * @property {string|null} [message]
 */

/**
 * @typedef {Object} RosterLookupPort
 * @property {(request: RosterLookupRequest) => RosterLookupResult|Promise<RosterLookupResult>} lookup
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRosterLookupPort(port) {
  return Boolean(
    port && typeof port === "object" && typeof port.lookup === "function"
  );
}

/**
 * Fail-closed stub when roster lookup is required but not injected.
 * @returns {RosterLookupPort}
 */
export function createFailClosedRosterLookupPort() {
  return {
    async lookup() {
      return {
        ok: false,
        roster: null,
        code: "ROSTER_LOOKUP_NOT_CONFIGURED",
        message: "RosterLookupPort is not configured",
      };
    },
  };
}

/**
 * Test double that returns a fixed roster snapshot.
 * @param {unknown} roster
 * @returns {RosterLookupPort}
 */
export function createFixedRosterLookupPort(roster) {
  return {
    async lookup() {
      return {
        ok: true,
        roster,
        code: null,
        message: null,
      };
    },
  };
}

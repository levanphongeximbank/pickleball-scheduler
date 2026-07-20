/**
 * CORE-06 Phase 1C — LineupRandomPort (deterministic seeded fill contract).
 * No Math.random. Production algorithm remains Format-owned.
 */

/**
 * @typedef {Object} LineupRandomRequest
 * @property {string} seed
 * @property {unknown} roster
 * @property {unknown} [lineup]
 * @property {unknown} [disciplineTemplate]
 * @property {Record<string, unknown>} [extras]
 */

/**
 * @typedef {Object} LineupRandomResult
 * @property {boolean} ok
 * @property {unknown[]} [slots]
 * @property {string|null} [code]
 * @property {string|null} [message]
 * @property {import('../contracts/missingLineupResolution.js').MissingLineupResolution|null} [resolution]
 */

/**
 * @typedef {Object} LineupRandomPort
 * @property {(request: LineupRandomRequest) => LineupRandomResult|Promise<LineupRandomResult>} fillMissing
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesLineupRandomPort(port) {
  return Boolean(
    port && typeof port === "object" && typeof port.fillMissing === "function"
  );
}

/**
 * Fail-closed stub — does not invent random selections.
 * @returns {LineupRandomPort}
 */
export function createNoopLineupRandomPort() {
  return {
    async fillMissing() {
      return {
        ok: false,
        slots: [],
        code: "LINEUP_RANDOM_NOT_CONFIGURED",
        message: "LineupRandomPort is not configured",
        resolution: null,
      };
    },
  };
}

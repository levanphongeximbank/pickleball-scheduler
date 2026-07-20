/**
 * CORE-06 Phase 1C — LineupClockPort (injected server-now).
 * Domain services must not call Date.now / new Date for authoritative time.
 */

/**
 * @typedef {Object} LineupClockPort
 * @property {() => string} nowIso
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesLineupClockPort(port) {
  return Boolean(
    port && typeof port === "object" && typeof port.nowIso === "function"
  );
}

/**
 * @param {() => string} nowIso
 * @returns {LineupClockPort}
 */
export function createLineupClockPort(nowIso) {
  if (typeof nowIso !== "function") {
    throw new TypeError("createLineupClockPort requires nowIso function");
  }
  return {
    nowIso() {
      return String(nowIso());
    },
  };
}

/**
 * Fixed clock for deterministic unit tests.
 * @param {string} iso
 * @returns {LineupClockPort}
 */
export function createFixedLineupClockPort(iso) {
  const value = String(iso);
  return createLineupClockPort(() => value);
}

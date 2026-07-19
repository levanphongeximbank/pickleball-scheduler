/**
 * ClockPort — inject time; domain must not read wall-clock directly for decisions.
 *
 * @typedef {Object} ClockPort
 * @property {() => string} nowIso — ISO-8601 UTC timestamp
 */

/**
 * @returns {ClockPort}
 */
export function createNullClockPort() {
  return {
    nowIso() {
      throw new Error("ClockPort.nowIso is required (fail closed)");
    },
  };
}

/**
 * @param {string} fixedIso
 * @returns {ClockPort}
 */
export function createFixedClockPort(fixedIso) {
  const value = String(fixedIso || "").trim();
  if (!value) {
    throw new TypeError("createFixedClockPort requires fixedIso");
  }
  return {
    nowIso() {
      return value;
    },
  };
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function isClockPort(port) {
  return !!port && typeof port === "object" && typeof /** @type {any} */ (port).nowIso === "function";
}

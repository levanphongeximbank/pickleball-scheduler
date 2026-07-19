/**
 * IdGeneratorPort — IDs are generated outside pure evaluation aggregation.
 *
 * @typedef {Object} IdGeneratorPort
 * @property {(prefix?: string) => string} nextId
 */

/**
 * Deterministic sequence generator for tests / pure fixtures (not Production).
 * @param {string} [seed]
 * @returns {IdGeneratorPort}
 */
export function createSequentialIdGeneratorPort(seed = "reg") {
  let n = 0;
  const prefix = String(seed || "reg");
  return {
    nextId(localPrefix) {
      n += 1;
      return `${localPrefix || prefix}-${String(n).padStart(4, "0")}`;
    },
  };
}

/**
 * @returns {IdGeneratorPort}
 */
export function createNullIdGeneratorPort() {
  return {
    nextId() {
      throw new Error("IdGeneratorPort.nextId is required (fail closed)");
    },
  };
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function isIdGeneratorPort(port) {
  return (
    !!port &&
    typeof port === "object" &&
    typeof /** @type {any} */ (port).nextId === "function"
  );
}

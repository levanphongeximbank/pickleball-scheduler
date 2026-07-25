/**
 * ClockPort + IdProviderPort — injectable time/id (NEWS-01).
 * Domain rules remain pure: callers pass timestamps/ids explicitly.
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { NewsPublicContentError } from "../errors/NewsPublicContentError.js";

/**
 * @typedef {Object} ClockPort
 * @property {() => string} now
 */

/**
 * @typedef {Object} IdProviderPort
 * @property {(prefix?: string) => string} nextId
 */

export const CLOCK_PORT_METHODS = Object.freeze(["now"]);
export const ID_PROVIDER_PORT_METHODS = Object.freeze(["nextId"]);

/**
 * @param {unknown} port
 * @param {readonly string[]} methods
 * @returns {boolean}
 */
function matchesPortMethods(port, methods) {
  if (!port || typeof port !== "object") return false;
  return methods.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesClockPort(port) {
  return matchesPortMethods(port, CLOCK_PORT_METHODS);
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesIdProviderPort(port) {
  return matchesPortMethods(port, ID_PROVIDER_PORT_METHODS);
}

/**
 * @param {string} portName
 * @param {string} method
 * @returns {never}
 */
function throwPortUnimplemented(portName, method) {
  throw new NewsPublicContentError(
    NEWS_PUBLIC_CONTENT_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `${portName}.${method} is not implemented`,
    { portName, method }
  );
}

/**
 * @returns {ClockPort}
 */
export function createUnimplementedClockPort() {
  return {
    now() {
      throwPortUnimplemented("ClockPort", "now");
    },
  };
}

/**
 * @returns {IdProviderPort}
 */
export function createUnimplementedIdProviderPort() {
  return {
    nextId() {
      throwPortUnimplemented("IdProviderPort", "nextId");
    },
  };
}

/**
 * Deterministic fixed clock for tests / explicit operations.
 * @param {string} fixedIso
 * @returns {ClockPort}
 */
export function createFixedClockPort(fixedIso) {
  return {
    now() {
      return fixedIso;
    },
  };
}

/**
 * Deterministic sequential id provider.
 * @param {string} [prefix]
 * @returns {IdProviderPort}
 */
export function createSequentialIdProviderPort(prefix = "id") {
  let seq = 0;
  return {
    nextId(p) {
      seq += 1;
      return `${p || prefix}_${seq}`;
    },
  };
}

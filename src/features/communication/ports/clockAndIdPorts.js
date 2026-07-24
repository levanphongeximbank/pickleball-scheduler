/**
 * ClockPort + IdProviderPort — injectable time/id for later phases (COMMS-01).
 * Domain rules remain pure: callers pass timestamps/ids explicitly in COMMS-01.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} ClockPort
 * @property {() => string|number} now
 */

/**
 * @typedef {Object} IdProviderPort
 * @property {(prefix?: string) => string} nextId
 */

export const CLOCK_PORT_METHODS = Object.freeze(["now"]);
export const ID_PROVIDER_PORT_METHODS = Object.freeze(["nextId"]);

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

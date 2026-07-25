/**
 * Clock / Id ports (REPORTING-01).
 */

import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { ReportingError } from "../errors/ReportingError.js";

export const CLOCK_PORT_METHODS = Object.freeze(["now"]);
export const ID_PROVIDER_PORT_METHODS = Object.freeze(["nextId"]);

/**
 * @param {unknown} port
 */
export function matchesClockPort(port) {
  return Boolean(port) && typeof /** @type {{ now?: unknown }} */ (port).now === "function";
}

/**
 * @param {unknown} port
 */
export function matchesIdProviderPort(port) {
  return (
    Boolean(port) &&
    typeof /** @type {{ nextId?: unknown }} */ (port).nextId === "function"
  );
}

export function createUnimplementedClockPort() {
  return {
    now() {
      throw new ReportingError(
        REPORTING_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
        "ClockPort.now is not implemented",
        { portName: "ClockPort", method: "now" }
      );
    },
  };
}

export function createUnimplementedIdProviderPort() {
  return {
    nextId() {
      throw new ReportingError(
        REPORTING_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
        "IdProviderPort.nextId is not implemented",
        { portName: "IdProviderPort", method: "nextId" }
      );
    },
  };
}

/**
 * @param {string} iso
 */
export function createFixedClockPort(iso) {
  return {
    now() {
      return iso;
    },
  };
}

/**
 * @param {number} [start]
 */
export function createSequentialIdProviderPort(start = 1) {
  let n = start;
  return {
    /**
     * @param {string} [prefix]
     */
    nextId(prefix = "id") {
      const id = `${prefix}_${n}`;
      n += 1;
      return id;
    },
  };
}

/**
 * Fail-closed errors for CompetitionRefereeAdapterContract v1.
 */

import {
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_ADAPTER_ERROR_CODE_VALUES,
} from "./constants.js";

export class RefereeAdapterContractError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RefereeAdapterContractError";
    this.code =
      typeof code === "string" && code.trim()
        ? code.trim()
        : REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER;
    this.failClosed = true;
    this.details = Object.freeze({ ...details });
  }
}

export function isRefereeAdapterContractError(err) {
  return (
    err instanceof RefereeAdapterContractError ||
    (Boolean(err) &&
      typeof err === "object" &&
      /** @type {{ name?: unknown }} */ (err).name ===
        "RefereeAdapterContractError" &&
      typeof /** @type {{ code?: unknown }} */ (err).code === "string")
  );
}

export function isRefereeAdapterErrorCode(code) {
  return REFEREE_ADAPTER_ERROR_CODE_VALUES.includes(String(code || ""));
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failRefereeAdapter(code, message, details) {
  throw new RefereeAdapterContractError(code, message, details);
}

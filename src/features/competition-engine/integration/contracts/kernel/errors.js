/**
 * Fail-closed errors for Canonical Competition Adapter Contracts.
 */

import {
  SHARED_ADAPTER_ERROR_CODE,
  SHARED_ADAPTER_ERROR_CODE_VALUES,
} from "./constants.js";

export class CompetitionAdapterContractError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CompetitionAdapterContractError";
    this.code =
      typeof code === "string" && code.trim()
        ? code.trim()
        : SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER;
    this.failClosed = true;
    this.details = Object.freeze({ ...details });
  }
}

export function isCompetitionAdapterContractError(err) {
  return (
    err instanceof CompetitionAdapterContractError ||
    (Boolean(err) &&
      typeof err === "object" &&
      /** @type {{ name?: unknown }} */ (err).name ===
        "CompetitionAdapterContractError" &&
      typeof /** @type {{ code?: unknown }} */ (err).code === "string")
  );
}

export function isSharedAdapterErrorCode(code) {
  return SHARED_ADAPTER_ERROR_CODE_VALUES.includes(String(code || ""));
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failCompetitionAdapter(code, message, details) {
  throw new CompetitionAdapterContractError(code, message, details);
}

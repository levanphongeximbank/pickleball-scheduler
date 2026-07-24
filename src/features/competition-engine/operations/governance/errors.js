/**
 * E2E-06 typed errors — fail-closed governance reads/evaluations.
 */

import { GOVERNANCE_ERROR_CODE, GOVERNANCE_ERROR_CODE_VALUES } from "./constants.js";

export class GovernanceReliabilityError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "GovernanceReliabilityError";
    this.code =
      typeof code === "string" && code.trim()
        ? code.trim()
        : GOVERNANCE_ERROR_CODE.UNKNOWN;
    this.failClosed = true;
    this.details = Object.freeze({ ...details });
  }
}

/**
 * @param {unknown} err
 * @returns {err is GovernanceReliabilityError}
 */
export function isGovernanceReliabilityError(err) {
  return (
    err instanceof GovernanceReliabilityError ||
    (Boolean(err) &&
      typeof err === "object" &&
      /** @type {{ name?: unknown }} */ (err).name ===
        "GovernanceReliabilityError" &&
      typeof /** @type {{ code?: unknown }} */ (err).code === "string")
  );
}

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isGovernanceErrorCode(code) {
  return GOVERNANCE_ERROR_CODE_VALUES.includes(String(code || ""));
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function failGovernance(code, message, details) {
  throw new GovernanceReliabilityError(code, message, details);
}

/**
 * @param {unknown} err
 * @param {string} [fallbackCode]
 * @param {string} [fallbackMessage]
 * @returns {GovernanceReliabilityError}
 */
export function normalizeGovernanceError(
  err,
  fallbackCode = GOVERNANCE_ERROR_CODE.UNKNOWN,
  fallbackMessage = "Governance reliability evaluation failed"
) {
  if (isGovernanceReliabilityError(err)) {
    return /** @type {GovernanceReliabilityError} */ (err);
  }
  if (
    err &&
    typeof err === "object" &&
    typeof /** @type {{ code?: unknown }} */ (err).code === "string"
  ) {
    const code = String(/** @type {{ code: string }} */ (err).code);
    const message =
      err instanceof Error
        ? err.message
        : typeof /** @type {{ message?: unknown }} */ (err).message === "string"
          ? /** @type {{ message: string }} */ (err).message
          : fallbackMessage;
    return new GovernanceReliabilityError(code, message, {
      normalizedFrom: err instanceof Error ? err.name : typeof err,
    });
  }
  return new GovernanceReliabilityError(fallbackCode, fallbackMessage, {
    message: err instanceof Error ? err.message : String(err ?? "unknown"),
  });
}

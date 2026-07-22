/**
 * CORE-10 — fail-closed contract construction / validation error.
 */

export class OptimizerContractError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "OptimizerContractError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is OptimizerContractError}
 */
export function isOptimizerContractError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "OptimizerContractError"
  );
}

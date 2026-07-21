/**
 * CORE-09 — fail-closed contract construction error.
 */

export class MatchGenerationContractError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "MatchGenerationContractError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is MatchGenerationContractError}
 */
export function isMatchGenerationContractError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name ===
      "MatchGenerationContractError"
  );
}

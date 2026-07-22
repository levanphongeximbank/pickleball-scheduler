/**
 * CORE-12 — fail-closed contract construction / validation error.
 */

export class CourtAssignmentContractError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "CourtAssignmentContractError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is CourtAssignmentContractError}
 */
export function isCourtAssignmentContractError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "CourtAssignmentContractError"
  );
}

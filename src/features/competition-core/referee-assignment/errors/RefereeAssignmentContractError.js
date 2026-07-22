/**
 * CORE-13 — fail-closed contract construction / validation error.
 */

export class RefereeAssignmentContractError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "RefereeAssignmentContractError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is RefereeAssignmentContractError}
 */
export function isRefereeAssignmentContractError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name ===
      "RefereeAssignmentContractError"
  );
}

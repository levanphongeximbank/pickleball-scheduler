/**
 * CORE-14 — domain / contract error (fail closed).
 */

export class ResourceConflictContractError extends Error {
  /**
   * @param {string} code
   * @param {string} [message]
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || String(code));
    this.name = "ResourceConflictContractError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is ResourceConflictContractError}
 */
export function isResourceConflictContractError(err) {
  return err instanceof ResourceConflictContractError;
}

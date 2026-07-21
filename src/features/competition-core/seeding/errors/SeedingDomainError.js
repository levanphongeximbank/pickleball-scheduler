import {
  SEEDING_ERROR_CATEGORY,
  SEEDING_ERROR_CODE,
  SEEDING_ERROR_CODE_CATEGORY,
  isSeedingErrorCategory,
  isSeedingErrorCode,
} from "./seedingErrorCodes.js";

/**
 * CORE-07 domain validation / fail-closed error (doc 13 §4).
 */
export class SeedingDomainError extends Error {
  /**
   * @param {string} code
   * @param {string} [message]
   * @param {{
   *   category?: string,
   *   entryId?: string,
   *   overrideId?: string,
   *   details?: Record<string, unknown>,
   *   failClosed?: boolean,
   * }} [options]
   */
  constructor(code, message, options = {}) {
    const safeCode = isSeedingErrorCode(code)
      ? code
      : SEEDING_ERROR_CODE.INVALID_REQUEST;
    const category =
      options.category && isSeedingErrorCategory(options.category)
        ? options.category
        : SEEDING_ERROR_CODE_CATEGORY[safeCode] ||
          SEEDING_ERROR_CATEGORY.VALIDATION;
    super(String(message || safeCode));
    this.name = "SeedingDomainError";
    this.code = safeCode;
    this.category = category;
    this.entryId =
      options.entryId != null ? String(options.entryId) : undefined;
    this.overrideId =
      options.overrideId != null ? String(options.overrideId) : undefined;
    this.details =
      options.details &&
      typeof options.details === "object" &&
      !Array.isArray(options.details)
        ? { ...options.details }
        : {};
    this.failClosed = options.failClosed !== false;
  }
}

/**
 * @param {unknown} err
 * @returns {err is SeedingDomainError}
 */
export function isSeedingDomainError(err) {
  return err instanceof SeedingDomainError;
}

/**
 * @param {string} code
 * @param {string} [message]
 * @param {ConstructorParameters<typeof SeedingDomainError>[2]} [options]
 * @returns {SeedingDomainError}
 */
export function createSeedingDomainError(code, message, options) {
  return new SeedingDomainError(code, message, options);
}

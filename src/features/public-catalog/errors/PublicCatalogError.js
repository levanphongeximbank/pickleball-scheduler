import {
  PUBLIC_CATALOG_ERROR_CODE,
  isPublicCatalogErrorCode,
} from "./errorCodes.js";

export class PublicCatalogError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PublicCatalogError";
    this.code = isPublicCatalogErrorCode(code)
      ? code
      : PUBLIC_CATALOG_ERROR_CODE.INVALID_CONTRACT;
    this.details = details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} value
 * @returns {value is PublicCatalogError}
 */
export function isPublicCatalogError(value) {
  return value instanceof PublicCatalogError;
}

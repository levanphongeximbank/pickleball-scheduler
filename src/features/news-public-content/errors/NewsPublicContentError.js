/**
 * News & Public Content — typed domain / application error (NEWS-01).
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "./errorCodes.js";

export class NewsPublicContentError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "NewsPublicContentError";
    this.code = String(code);
    this.details =
      details && typeof details === "object" ? { ...details } : {};
  }
}

/**
 * @param {unknown} err
 * @returns {err is NewsPublicContentError}
 */
export function isNewsPublicContentError(err) {
  return (
    Boolean(err) &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "NewsPublicContentError"
  );
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isNewsPublicContentErrorCode(code) {
  return Object.values(NEWS_PUBLIC_CONTENT_ERROR_CODE).includes(String(code));
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function throwNewsError(code, message, details) {
  throw new NewsPublicContentError(code, message, details);
}

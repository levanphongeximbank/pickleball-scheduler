/**
 * E2E-07 Certification error model.
 */

import {
  CERTIFICATION_ERROR_CODE,
  E2E07_CERTIFICATION_VERSION,
} from "./constants.js";

export class CertificationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CertificationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
    this.certificationVersion = E2E07_CERTIFICATION_VERSION;
  }
}

/**
 * @param {unknown} err
 * @returns {err is CertificationError}
 */
export function isCertificationError(err) {
  return err instanceof CertificationError;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [details]
 * @returns {never}
 */
export function failCertification(code, message, details = {}) {
  throw new CertificationError(code, message, details);
}

/**
 * @param {unknown} err
 * @param {string} [fallbackCode]
 * @returns {CertificationError}
 */
export function normalizeCertificationError(
  err,
  fallbackCode = CERTIFICATION_ERROR_CODE.UNKNOWN
) {
  if (err instanceof CertificationError) return err;
  const message =
    err && typeof err === "object" && "message" in err
      ? String(/** @type {{ message: unknown }} */ (err).message)
      : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String(/** @type {{ code: unknown }} */ (err).code)
      : fallbackCode;
  return new CertificationError(code, message, {
    normalizedFrom: err && typeof err === "object" ? err.constructor?.name : typeof err,
  });
}

/**
 * CORE-07 FingerprintPort — capability-local contract (doc 10).
 * Hash implementation is injected; no Node crypto in this module.
 * No test stub lives here — tests inject their own port.
 */

import {
  createSeedingDomainError,
} from "../errors/SeedingDomainError.js";
import { SEEDING_ERROR_CODE } from "../errors/seedingErrorCodes.js";

/**
 * @typedef {Object} FingerprintPort
 * @property {string} contractVersion
 * @property {(canonicalPayload: string) => string} fingerprint
 */

/**
 * @param {unknown} port
 * @returns {port is FingerprintPort}
 */
export function isFingerprintPort(port) {
  return (
    !!port &&
    typeof port === "object" &&
    typeof /** @type {FingerprintPort} */ (port).fingerprint === "function" &&
    typeof /** @type {FingerprintPort} */ (port).contractVersion === "string"
  );
}

/**
 * @param {FingerprintPort} port
 * @param {string} canonicalPayload
 * @returns {string}
 */
export function fingerprintCanonicalPayload(port, canonicalPayload) {
  if (!isFingerprintPort(port)) {
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "FingerprintPort is required",
      { failClosed: true }
    );
  }
  try {
    const result = port.fingerprint(String(canonicalPayload));
    if (typeof result !== "string" || result.length === 0) {
      throw createSeedingDomainError(
        SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
        "FingerprintPort returned empty fingerprint",
        { failClosed: true }
      );
    }
    return result;
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      /** @type {{ code?: string }} */ (err).code ===
        SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
    ) {
      throw err;
    }
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "FingerprintPort failed",
      {
        failClosed: true,
        details: {
          message: err instanceof Error ? err.message : String(err),
        },
      }
    );
  }
}

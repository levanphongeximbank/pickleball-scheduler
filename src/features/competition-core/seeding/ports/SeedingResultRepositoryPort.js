/**
 * CORE-07 SeedingResultRepositoryPort — capability-local contract (Phase 1E).
 *
 * Atomicity expectations (integrator / future persistence):
 * - saveFinalized / saveSuperseded / saveCancelled are expected to be atomic
 *   per result identity at the persistence boundary.
 * - findAuthoritativeByScope must return at most one non-superseded FINALIZED
 *   result for a canonical SeedingScope.
 * - Phase 1E does not implement Production persistence or in-memory fallbacks.
 */

import {
  createSeedingDomainError,
} from "../errors/SeedingDomainError.js";
import { SEEDING_ERROR_CODE } from "../errors/seedingErrorCodes.js";
import { CORE07_RESULT_REPOSITORY_PORT_VERSION } from "../domain/constants.js";

export { CORE07_RESULT_REPOSITORY_PORT_VERSION };

/** @type {ReadonlyArray<string>} */
export const SEEDING_RESULT_REPOSITORY_PORT_METHODS = Object.freeze([
  "findByResultId",
  "findAuthoritativeByScope",
  "saveDraft",
  "saveFinalized",
  "saveSuperseded",
  "saveCancelled",
]);

/**
 * @typedef {Object} SeedingResultRepositoryPort
 * @property {string} contractVersion
 * @property {(resultId: string) => Promise<unknown>|unknown} findByResultId
 * @property {(scope: unknown) => Promise<unknown>|unknown} findAuthoritativeByScope
 * @property {(result: unknown) => Promise<unknown>|unknown} saveDraft
 * @property {(result: unknown) => Promise<unknown>|unknown} saveFinalized
 * @property {(result: unknown) => Promise<unknown>|unknown} saveSuperseded
 * @property {(result: unknown) => Promise<unknown>|unknown} saveCancelled
 */

/**
 * @param {unknown} port
 * @returns {port is SeedingResultRepositoryPort}
 */
export function isSeedingResultRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  const p = /** @type {Record<string, unknown>} */ (port);
  if (typeof p.contractVersion !== "string" || p.contractVersion.length === 0) {
    return false;
  }
  for (let i = 0; i < SEEDING_RESULT_REPOSITORY_PORT_METHODS.length; i += 1) {
    const method = SEEDING_RESULT_REPOSITORY_PORT_METHODS[i];
    if (typeof p[method] !== "function") return false;
  }
  return true;
}

/**
 * @param {unknown} port
 * @param {boolean} [required]
 * @returns {SeedingResultRepositoryPort|null}
 */
export function requireSeedingResultRepositoryPort(port, required = true) {
  if (port == null) {
    if (!required) return null;
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "SeedingResultRepositoryPort is required",
      { failClosed: true }
    );
  }
  if (!isSeedingResultRepositoryPort(port)) {
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "SeedingResultRepositoryPort contract is invalid",
      { failClosed: true }
    );
  }
  return port;
}

/**
 * Invoke a repository method and map infrastructure failures.
 *
 * @param {SeedingResultRepositoryPort} port
 * @param {string} method
 * @param {unknown[]} args
 * @returns {unknown}
 */
export function invokeSeedingResultRepository(port, method, args) {
  const safePort = requireSeedingResultRepositoryPort(port, true);
  if (typeof /** @type {Record<string, unknown>} */ (safePort)[method] !== "function") {
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      `SeedingResultRepositoryPort.${method} is missing`,
      { failClosed: true }
    );
  }
  try {
    return /** @type {Function} */ (
      /** @type {Record<string, unknown>} */ (safePort)[method]
    )(...args);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      /** @type {{ code?: string }} */ (err).code ===
        SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
    ) {
      throw err;
    }
    if (
      err &&
      typeof err === "object" &&
      typeof /** @type {{ code?: string }} */ (err).code === "string" &&
      /** @type {{ code: string }} */ (err).code !==
        SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
    ) {
      // Domain errors thrown by a test double are rethrown unchanged.
      throw err;
    }
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      `SeedingResultRepositoryPort.${method} failed`,
      {
        failClosed: true,
        details: {
          message: err instanceof Error ? err.message : String(err),
        },
      }
    );
  }
}

/**
 * Future persistence port for Competition Versioning (CM-03).
 * Unimplemented production port — capability-local in-memory repository is separate.
 */

import { COMPETITION_VERSION_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionVersionError } from "../errors/CompetitionVersionError.js";

export const COMPETITION_VERSION_REPOSITORY_PORT_METHODS = Object.freeze([
  "saveVersion",
  "findVersionById",
  "listVersions",
  "findLatestVersion",
  "findByIdempotencyKey",
]);

/**
 * @param {string} method
 * @returns {never}
 */
export function throwVersionPortUnimplemented(method) {
  throw new CompetitionVersionError(
    COMPETITION_VERSION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `CompetitionVersionRepositoryPort.${method} is not implemented as production persistence in CM-03 (dormant)`,
    { method, phase: "CM-03" }
  );
}

/**
 * @returns {Readonly<Record<string, Function>>}
 */
export function createUnimplementedCompetitionVersionRepositoryPort() {
  return Object.freeze({
    saveVersion() {
      throwVersionPortUnimplemented("saveVersion");
    },
    findVersionById() {
      throwVersionPortUnimplemented("findVersionById");
    },
    listVersions() {
      throwVersionPortUnimplemented("listVersions");
    },
    findLatestVersion() {
      throwVersionPortUnimplemented("findLatestVersion");
    },
    findByIdempotencyKey() {
      throwVersionPortUnimplemented("findByIdempotencyKey");
    },
  });
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCompetitionVersionRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return COMPETITION_VERSION_REPOSITORY_PORT_METHODS.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

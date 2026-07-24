/**
 * Future persistence port for Competition Publication (CM-06).
 * Unimplemented production port — capability-local in-memory repository is separate.
 */

import { COMPETITION_PUBLICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionPublicationError } from "../errors/CompetitionPublicationError.js";

/** Required repository capabilities every implementation must provide. */
export const COMPETITION_PUBLICATION_REPOSITORY_PORT_METHODS = Object.freeze([
  "createPublicationAtomically",
  "findPublicationById",
  "findCurrentPublication",
  "listPublications",
  "findByIdempotencyKey",
]);

/** Optional capability — implementations may omit it (duplicate slug detection). */
export const COMPETITION_PUBLICATION_REPOSITORY_PORT_OPTIONAL_METHODS = Object.freeze([
  "reservePublicReference",
]);

/**
 * @param {string} method
 * @returns {never}
 */
export function throwPublicationPortUnimplemented(method) {
  throw new CompetitionPublicationError(
    COMPETITION_PUBLICATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `CompetitionPublicationRepositoryPort.${method} is not implemented as production persistence in CM-06 (dormant)`,
    { method, phase: "CM-06" }
  );
}

/**
 * @returns {Readonly<Record<string, Function>>}
 */
export function createUnimplementedCompetitionPublicationRepositoryPort() {
  return Object.freeze({
    createPublicationAtomically() {
      throwPublicationPortUnimplemented("createPublicationAtomically");
    },
    findPublicationById() {
      throwPublicationPortUnimplemented("findPublicationById");
    },
    findCurrentPublication() {
      throwPublicationPortUnimplemented("findCurrentPublication");
    },
    listPublications() {
      throwPublicationPortUnimplemented("listPublications");
    },
    findByIdempotencyKey() {
      throwPublicationPortUnimplemented("findByIdempotencyKey");
    },
    reservePublicReference() {
      throwPublicationPortUnimplemented("reservePublicReference");
    },
  });
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCompetitionPublicationRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return COMPETITION_PUBLICATION_REPOSITORY_PORT_METHODS.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

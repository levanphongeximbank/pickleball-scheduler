/**
 * Future persistence port for Competition Archive (CM-08).
 * Unimplemented production port — capability-local in-memory repository is separate.
 */

import { COMPETITION_ARCHIVE_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionArchiveError } from "../errors/CompetitionArchiveError.js";

export const COMPETITION_ARCHIVE_REPOSITORY_PORT_METHODS = Object.freeze([
  "appendArchiveActionAtomically",
  "findArchiveRecord",
  "findCurrentArchiveState",
  "listArchiveHistory",
  "findByIdempotencyKey",
]);

/**
 * @param {string} method
 * @returns {never}
 */
export function throwArchivePortUnimplemented(method) {
  throw new CompetitionArchiveError(
    COMPETITION_ARCHIVE_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `CompetitionArchiveRepositoryPort.${method} is not implemented as production persistence in CM-08 (dormant)`,
    { method, phase: "CM-08" }
  );
}

/**
 * @returns {Readonly<Record<string, Function>>}
 */
export function createUnimplementedCompetitionArchiveRepositoryPort() {
  return Object.freeze({
    appendArchiveActionAtomically() {
      throwArchivePortUnimplemented("appendArchiveActionAtomically");
    },
    findArchiveRecord() {
      throwArchivePortUnimplemented("findArchiveRecord");
    },
    findCurrentArchiveState() {
      throwArchivePortUnimplemented("findCurrentArchiveState");
    },
    listArchiveHistory() {
      throwArchivePortUnimplemented("listArchiveHistory");
    },
    findByIdempotencyKey() {
      throwArchivePortUnimplemented("findByIdempotencyKey");
    },
  });
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCompetitionArchiveRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return COMPETITION_ARCHIVE_REPOSITORY_PORT_METHODS.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

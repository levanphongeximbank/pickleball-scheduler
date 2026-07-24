/**
 * Future persistence port for Competition Lifecycle (CM-07).
 * Unimplemented production port — capability-local in-memory repository is separate.
 */

import { COMPETITION_LIFECYCLE_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionLifecycleError } from "../errors/CompetitionLifecycleError.js";

export const COMPETITION_LIFECYCLE_REPOSITORY_PORT_METHODS = Object.freeze([
  "appendLifecycleTransitionAtomically",
  "findLifecycleRecord",
  "findCurrentLifecycle",
  "listLifecycleHistory",
  "findByIdempotencyKey",
]);

/**
 * @param {string} method
 * @returns {never}
 */
export function throwLifecyclePortUnimplemented(method) {
  throw new CompetitionLifecycleError(
    COMPETITION_LIFECYCLE_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `CompetitionLifecycleRepositoryPort.${method} is not implemented as production persistence in CM-07 (dormant)`,
    { method, phase: "CM-07" }
  );
}

/**
 * @returns {Readonly<Record<string, Function>>}
 */
export function createUnimplementedCompetitionLifecycleRepositoryPort() {
  return Object.freeze({
    appendLifecycleTransitionAtomically() {
      throwLifecyclePortUnimplemented("appendLifecycleTransitionAtomically");
    },
    findLifecycleRecord() {
      throwLifecyclePortUnimplemented("findLifecycleRecord");
    },
    findCurrentLifecycle() {
      throwLifecyclePortUnimplemented("findCurrentLifecycle");
    },
    listLifecycleHistory() {
      throwLifecyclePortUnimplemented("listLifecycleHistory");
    },
    findByIdempotencyKey() {
      throwLifecyclePortUnimplemented("findByIdempotencyKey");
    },
  });
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCompetitionLifecycleRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return COMPETITION_LIFECYCLE_REPOSITORY_PORT_METHODS.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

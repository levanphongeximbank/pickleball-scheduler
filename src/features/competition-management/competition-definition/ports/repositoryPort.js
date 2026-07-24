/**
 * Future persistence port for Competition Definition (CM-01).
 * Unimplemented in this phase — module remains dormant (no DB writes).
 */

import { COMPETITION_DEFINITION_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionDefinitionError } from "../errors/CompetitionDefinitionError.js";

export const COMPETITION_DEFINITION_REPOSITORY_PORT_METHODS = Object.freeze([
  "getByIdForTenant",
  "saveDraftForTenant",
]);

/**
 * @param {string} method
 * @returns {never}
 */
export function throwPortUnimplemented(method) {
  throw new CompetitionDefinitionError(
    COMPETITION_DEFINITION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `CompetitionDefinitionRepositoryPort.${method} is not implemented in CM-01 (dormant)`,
    { method, phase: "CM-01" }
  );
}

/**
 * @returns {Readonly<{
 *   getByIdForTenant: Function,
 *   saveDraftForTenant: Function,
 * }>}
 */
export function createUnimplementedCompetitionDefinitionRepositoryPort() {
  return Object.freeze({
    getByIdForTenant() {
      throwPortUnimplemented("getByIdForTenant");
    },
    saveDraftForTenant() {
      throwPortUnimplemented("saveDraftForTenant");
    },
  });
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCompetitionDefinitionRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return COMPETITION_DEFINITION_REPOSITORY_PORT_METHODS.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

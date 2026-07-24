/**
 * Future persistence port for Competition Configuration (CM-04).
 * Unimplemented production port — capability-local in-memory repository is separate.
 */

import { COMPETITION_CONFIGURATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionConfigurationError } from "../errors/CompetitionConfigurationError.js";

export const COMPETITION_CONFIGURATION_REPOSITORY_PORT_METHODS = Object.freeze([
  "createConfiguration",
  "findConfiguration",
  "saveConfigurationWithExpectedRevision",
]);

/**
 * @param {string} method
 * @returns {never}
 */
export function throwConfigurationPortUnimplemented(method) {
  throw new CompetitionConfigurationError(
    COMPETITION_CONFIGURATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `CompetitionConfigurationRepositoryPort.${method} is not implemented as production persistence in CM-04 (dormant)`,
    { method, phase: "CM-04" }
  );
}

/**
 * @returns {Readonly<Record<string, Function>>}
 */
export function createUnimplementedCompetitionConfigurationRepositoryPort() {
  return Object.freeze({
    createConfiguration() {
      throwConfigurationPortUnimplemented("createConfiguration");
    },
    findConfiguration() {
      throwConfigurationPortUnimplemented("findConfiguration");
    },
    saveConfigurationWithExpectedRevision() {
      throwConfigurationPortUnimplemented("saveConfigurationWithExpectedRevision");
    },
  });
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCompetitionConfigurationRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return COMPETITION_CONFIGURATION_REPOSITORY_PORT_METHODS.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

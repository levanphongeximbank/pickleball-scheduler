/**
 * Future persistence port for Competition Branding (CM-05).
 * Unimplemented production port — capability-local in-memory repository is separate.
 */

import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionBrandingError } from "../errors/CompetitionBrandingError.js";

export const COMPETITION_BRANDING_REPOSITORY_PORT_METHODS = Object.freeze([
  "createBranding",
  "findBranding",
  "saveBrandingWithExpectedRevision",
]);

/**
 * @param {string} method
 * @returns {never}
 */
export function throwBrandingPortUnimplemented(method) {
  throw new CompetitionBrandingError(
    COMPETITION_BRANDING_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `CompetitionBrandingRepositoryPort.${method} is not implemented as production persistence in CM-05 (dormant)`,
    { method, phase: "CM-05" }
  );
}

/**
 * @returns {Readonly<Record<string, Function>>}
 */
export function createUnimplementedCompetitionBrandingRepositoryPort() {
  return Object.freeze({
    createBranding() {
      throwBrandingPortUnimplemented("createBranding");
    },
    findBranding() {
      throwBrandingPortUnimplemented("findBranding");
    },
    saveBrandingWithExpectedRevision() {
      throwBrandingPortUnimplemented("saveBrandingWithExpectedRevision");
    },
  });
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCompetitionBrandingRepositoryPort(port) {
  if (!port || typeof port !== "object") return false;
  return COMPETITION_BRANDING_REPOSITORY_PORT_METHODS.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

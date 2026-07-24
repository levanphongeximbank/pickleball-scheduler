/**
 * Future catalog / persistence port for CM-02 (unimplemented — dormant).
 */

import { COMPETITION_TEMPLATE_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionTemplateError } from "../errors/CompetitionTemplateError.js";

export const COMPETITION_TEMPLATE_CATALOG_PORT_METHODS = Object.freeze([
  "listAvailableForTenant",
  "getByIdentityForTenant",
  "saveTemplateForTenant",
]);

/**
 * @param {string} method
 * @returns {never}
 */
export function throwCatalogPortUnimplemented(method) {
  throw new CompetitionTemplateError(
    COMPETITION_TEMPLATE_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `CompetitionTemplateCatalogPort.${method} is not implemented in CM-02 (dormant)`,
    { method, phase: "CM-02" }
  );
}

/**
 * @returns {Readonly<{
 *   listAvailableForTenant: Function,
 *   getByIdentityForTenant: Function,
 *   saveTemplateForTenant: Function,
 * }>}
 */
export function createUnimplementedCompetitionTemplateCatalogPort() {
  return Object.freeze({
    listAvailableForTenant() {
      throwCatalogPortUnimplemented("listAvailableForTenant");
    },
    getByIdentityForTenant() {
      throwCatalogPortUnimplemented("getByIdentityForTenant");
    },
    saveTemplateForTenant() {
      throwCatalogPortUnimplemented("saveTemplateForTenant");
    },
  });
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCompetitionTemplateCatalogPort(port) {
  if (!port || typeof port !== "object") return false;
  return COMPETITION_TEMPLATE_CATALOG_PORT_METHODS.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

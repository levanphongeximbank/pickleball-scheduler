/**
 * PublicCatalogRepositoryPort — remote read only (PUBLIC-CATALOG-01/02).
 * No create/update/delete. No mock fallback.
 */

import { PUBLIC_CATALOG_ERROR_CODE } from "../errors/errorCodes.js";
import { PublicCatalogError } from "../errors/PublicCatalogError.js";

export const PUBLIC_CATALOG_REPOSITORY_METHODS = Object.freeze([
  "listPublicClubs",
  "listPublicCourts",
  "listPublicTournaments",
  "listPublicRankings",
]);

/**
 * @param {unknown} candidate
 * @returns {boolean}
 */
export function matchesPublicCatalogRepositoryPort(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  return PUBLIC_CATALOG_REPOSITORY_METHODS.every(
    (method) => typeof candidate[method] === "function"
  );
}

/**
 * @param {string} method
 * @returns {never}
 */
function unimplemented(method) {
  throw new PublicCatalogError(
    PUBLIC_CATALOG_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `PublicCatalogRepositoryPort.${method} is not implemented`,
    { method }
  );
}

/**
 * @returns {{ listPublicClubs: Function, listPublicCourts: Function, listPublicTournaments: Function, listPublicRankings: Function }}
 */
export function createUnimplementedPublicCatalogRepositoryPort() {
  return {
    async listPublicClubs() {
      unimplemented("listPublicClubs");
    },
    async listPublicCourts() {
      unimplemented("listPublicCourts");
    },
    async listPublicTournaments() {
      unimplemented("listPublicTournaments");
    },
    async listPublicRankings() {
      unimplemented("listPublicRankings");
    },
  };
}

/**
 * Public Catalog facade — certified remote public read APIs (PUBLIC-CATALOG-01).
 * Typed Platform Result. No mock fallback. No mutations. No UI imports.
 */

import { ok, fail } from "../../../core/platform/contracts/result.js";
import { PUBLIC_CATALOG_PROVENANCE } from "../constants/provenance.js";
import {
  normalizeClubSort,
  normalizeCourtSort,
  normalizeOptionalClubIdFilter,
  normalizePaginationInput,
} from "../contracts/pagination.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { PUBLIC_CATALOG_ERROR_CODE } from "../errors/errorCodes.js";
import {
  PublicCatalogError,
  isPublicCatalogError,
} from "../errors/PublicCatalogError.js";
import { matchesPublicCatalogRepositoryPort } from "../ports/publicCatalogRepositoryPort.js";
import {
  projectPublicClub,
  projectPublicCourt,
} from "../projections/index.js";

/**
 * @param {unknown} err
 */
function toFail(err) {
  if (isPublicCatalogError(err)) {
    return fail(
      deepFreeze({
        code: err.code,
        message: err.message,
        details: err.details || {},
      })
    );
  }
  return fail(
    deepFreeze({
      code: PUBLIC_CATALOG_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
      message:
        err instanceof Error
          ? err.message
          : "Public catalog remote read failed",
      details: {},
    })
  );
}

/**
 * @param {{ repository: { listPublicClubs: Function, listPublicCourts: Function } }} deps
 */
export function createPublicCatalogFacade(deps) {
  if (!deps || !matchesPublicCatalogRepositoryPort(deps.repository)) {
    throw new PublicCatalogError(
      PUBLIC_CATALOG_ERROR_CODE.INVALID_CONTRACT,
      "createPublicCatalogFacade requires a PublicCatalogRepositoryPort",
      { field: "repository" }
    );
  }

  const { repository } = deps;

  /**
   * Unauthenticated public club list.
   * @param {Record<string, unknown>} [query]
   */
  async function listPublicClubs(query = {}) {
    try {
      if (query !== undefined && query !== null && !isPlainObject(query)) {
        throw new PublicCatalogError(
          PUBLIC_CATALOG_ERROR_CODE.INVALID_CONTRACT,
          "listPublicClubs query must be an object",
          { field: "query" }
        );
      }

      const pagination = normalizePaginationInput({
        limit: query.limit,
        offset: query.offset,
      });
      const sort = normalizeClubSort(query.sort);

      const remote = await repository.listPublicClubs({
        limit: pagination.limit,
        offset: pagination.offset,
        sort,
      });

      if (!remote || !Array.isArray(remote.rows)) {
        throw new PublicCatalogError(
          PUBLIC_CATALOG_ERROR_CODE.MALFORMED_RESPONSE,
          "Remote club list response is malformed",
          { field: "rows" }
        );
      }

      const items = remote.rows.map((row) => projectPublicClub(row));
      const total =
        typeof remote.total === "number" && Number.isInteger(remote.total)
          ? remote.total
          : items.length;

      return ok(
        deepFreeze({
          items,
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total,
            sort,
          },
          provenance: PUBLIC_CATALOG_PROVENANCE.LIVE,
        })
      );
    } catch (err) {
      return toFail(err);
    }
  }

  /**
   * Unauthenticated public court list.
   * @param {Record<string, unknown>} [query]
   */
  async function listPublicCourts(query = {}) {
    try {
      if (query !== undefined && query !== null && !isPlainObject(query)) {
        throw new PublicCatalogError(
          PUBLIC_CATALOG_ERROR_CODE.INVALID_CONTRACT,
          "listPublicCourts query must be an object",
          { field: "query" }
        );
      }

      const pagination = normalizePaginationInput({
        limit: query.limit,
        offset: query.offset,
      });
      const sort = normalizeCourtSort(query.sort);
      const clubId = normalizeOptionalClubIdFilter(query.clubId);

      const remote = await repository.listPublicCourts({
        limit: pagination.limit,
        offset: pagination.offset,
        sort,
        clubId,
      });

      if (!remote || !Array.isArray(remote.rows)) {
        throw new PublicCatalogError(
          PUBLIC_CATALOG_ERROR_CODE.MALFORMED_RESPONSE,
          "Remote court list response is malformed",
          { field: "rows" }
        );
      }

      const items = remote.rows.map((row) => projectPublicCourt(row));
      const total =
        typeof remote.total === "number" && Number.isInteger(remote.total)
          ? remote.total
          : items.length;

      return ok(
        deepFreeze({
          items,
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total,
            sort,
            clubId,
          },
          provenance: PUBLIC_CATALOG_PROVENANCE.LIVE,
        })
      );
    } catch (err) {
      return toFail(err);
    }
  }

  return deepFreeze({
    listPublicClubs,
    listPublicCourts,
  });
}

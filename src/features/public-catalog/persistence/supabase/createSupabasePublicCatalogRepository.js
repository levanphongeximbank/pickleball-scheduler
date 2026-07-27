/**
 * Supabase Public Catalog repository — RPC-only remote reads.
 * No mock fallback. No table select of private rows. No mutations.
 */

import { PUBLIC_CATALOG_ERROR_CODE } from "../../errors/errorCodes.js";
import { PublicCatalogError } from "../../errors/PublicCatalogError.js";
import { PUBLIC_CATALOG_RPC } from "../schema.js";
import { assertSupabasePublicCatalogClient } from "./clientContract.js";
import { mapSupabasePublicCatalogError } from "./errorMapping.js";

/**
 * @param {unknown} data
 * @returns {{ rows: object[], total: number }}
 */
function normalizeRpcListPayload(data, operation) {
  if (data === null || data === undefined) {
    return { rows: [], total: 0 };
  }

  // Prefer { rows, total } object payload
  if (!Array.isArray(data) && typeof data === "object") {
    const rows = data.rows ?? data.items ?? data.data;
    if (!Array.isArray(rows)) {
      throw new PublicCatalogError(
        PUBLIC_CATALOG_ERROR_CODE.MALFORMED_RESPONSE,
        `Malformed ${operation} RPC payload`,
        { field: "rows" }
      );
    }
    const total =
      typeof data.total === "number" && Number.isInteger(data.total)
        ? data.total
        : rows.length;
    return { rows, total };
  }

  if (Array.isArray(data)) {
    // TABLE-returning RPCs: optional total_count column on each row
    const total =
      data.length > 0 &&
      typeof data[0]?.total_count === "number" &&
      Number.isInteger(data[0].total_count)
        ? data[0].total_count
        : data.length;
    return { rows: data, total };
  }

  throw new PublicCatalogError(
    PUBLIC_CATALOG_ERROR_CODE.MALFORMED_RESPONSE,
    `Malformed ${operation} RPC payload`,
    { field: "data" }
  );
}

/**
 * @param {{ client: object }} options
 */
export function createSupabasePublicCatalogRepository(options) {
  const client = assertSupabasePublicCatalogClient(options?.client);

  return {
    /**
     * @param {{ limit: number, offset: number, sort: string }} query
     */
    async listPublicClubs(query) {
      try {
        const { data, error } = await client.rpc(PUBLIC_CATALOG_RPC.LIST_CLUBS, {
          p_limit: query.limit,
          p_offset: query.offset,
          p_sort: query.sort,
        });
        if (error) {
          throw mapSupabasePublicCatalogError(error, {
            operation: "listPublicClubs",
            rpc: PUBLIC_CATALOG_RPC.LIST_CLUBS,
          });
        }
        return normalizeRpcListPayload(data, "listPublicClubs");
      } catch (err) {
        throw mapSupabasePublicCatalogError(err, {
          operation: "listPublicClubs",
          rpc: PUBLIC_CATALOG_RPC.LIST_CLUBS,
        });
      }
    },

    /**
     * @param {{ limit: number, offset: number, sort: string, clubId: string|null }} query
     */
    async listPublicCourts(query) {
      try {
        const { data, error } = await client.rpc(
          PUBLIC_CATALOG_RPC.LIST_COURTS,
          {
            p_limit: query.limit,
            p_offset: query.offset,
            p_sort: query.sort,
            p_club_id: query.clubId,
          }
        );
        if (error) {
          throw mapSupabasePublicCatalogError(error, {
            operation: "listPublicCourts",
            rpc: PUBLIC_CATALOG_RPC.LIST_COURTS,
          });
        }
        return normalizeRpcListPayload(data, "listPublicCourts");
      } catch (err) {
        throw mapSupabasePublicCatalogError(err, {
          operation: "listPublicCourts",
          rpc: PUBLIC_CATALOG_RPC.LIST_COURTS,
        });
      }
    },

    /**
     * @param {{ limit: number, offset: number, sort: string }} query
     */
    async listPublicTournaments(query) {
      try {
        const { data, error } = await client.rpc(
          PUBLIC_CATALOG_RPC.LIST_TOURNAMENTS,
          {
            p_limit: query.limit,
            p_offset: query.offset,
            p_sort: query.sort,
          }
        );
        if (error) {
          throw mapSupabasePublicCatalogError(error, {
            operation: "listPublicTournaments",
            rpc: PUBLIC_CATALOG_RPC.LIST_TOURNAMENTS,
          });
        }
        return normalizeRpcListPayload(data, "listPublicTournaments");
      } catch (err) {
        throw mapSupabasePublicCatalogError(err, {
          operation: "listPublicTournaments",
          rpc: PUBLIC_CATALOG_RPC.LIST_TOURNAMENTS,
        });
      }
    },

    /**
     * @param {{ limit: number, offset: number, sort: string, category: string|null }} query
     */
    async listPublicRankings(query) {
      try {
        const { data, error } = await client.rpc(
          PUBLIC_CATALOG_RPC.LIST_RANKINGS,
          {
            p_limit: query.limit,
            p_offset: query.offset,
            p_sort: query.sort,
            p_category: query.category,
          }
        );
        if (error) {
          throw mapSupabasePublicCatalogError(error, {
            operation: "listPublicRankings",
            rpc: PUBLIC_CATALOG_RPC.LIST_RANKINGS,
          });
        }
        return normalizeRpcListPayload(data, "listPublicRankings");
      } catch (err) {
        throw mapSupabasePublicCatalogError(err, {
          operation: "listPublicRankings",
          rpc: PUBLIC_CATALOG_RPC.LIST_RANKINGS,
        });
      }
    },
  };
}

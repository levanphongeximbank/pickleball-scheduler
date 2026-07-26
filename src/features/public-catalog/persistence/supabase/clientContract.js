/**
 * Minimal Supabase client contract for public catalog RPC reads.
 */

import { PUBLIC_CATALOG_ERROR_CODE } from "../../errors/errorCodes.js";
import { PublicCatalogError } from "../../errors/PublicCatalogError.js";

/**
 * @param {unknown} client
 * @returns {object}
 */
export function assertSupabasePublicCatalogClient(client) {
  if (!client || typeof client !== "object") {
    throw new PublicCatalogError(
      PUBLIC_CATALOG_ERROR_CODE.CLIENT_UNAVAILABLE,
      "Supabase client is required for public catalog remote reads",
      { field: "client" }
    );
  }
  if (typeof client.rpc !== "function") {
    throw new PublicCatalogError(
      PUBLIC_CATALOG_ERROR_CODE.CLIENT_UNAVAILABLE,
      "Supabase client.rpc is required for public catalog remote reads",
      { field: "client.rpc" }
    );
  }
  return client;
}

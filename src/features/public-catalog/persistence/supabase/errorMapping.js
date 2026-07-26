/**
 * Map Supabase / network errors to PublicCatalogError (no empty success).
 */

import { PUBLIC_CATALOG_ERROR_CODE } from "../../errors/errorCodes.js";
import { PublicCatalogError } from "../../errors/PublicCatalogError.js";

/**
 * @param {unknown} err
 * @param {Record<string, unknown>} [context]
 * @returns {PublicCatalogError}
 */
export function mapSupabasePublicCatalogError(err, context = {}) {
  if (err instanceof PublicCatalogError) return err;

  const message =
    (err && typeof err === "object" && typeof err.message === "string"
      ? err.message
      : null) || "Public catalog remote read failed";

  const code =
    err && typeof err === "object" && typeof err.code === "string"
      ? err.code
      : null;

  if (
    code === "PGRST301" ||
    /permission|jwt|rls|not authorized/i.test(message)
  ) {
    return new PublicCatalogError(
      PUBLIC_CATALOG_ERROR_CODE.RPC_FAILURE,
      message,
      { ...context, supabaseCode: code }
    );
  }

  if (/network|fetch|timeout|ECONN|ENOTFOUND/i.test(message)) {
    return new PublicCatalogError(
      PUBLIC_CATALOG_ERROR_CODE.NETWORK_FAILURE,
      message,
      { ...context, supabaseCode: code }
    );
  }

  return new PublicCatalogError(
    PUBLIC_CATALOG_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
    message,
    { ...context, supabaseCode: code }
  );
}

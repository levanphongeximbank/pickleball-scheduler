/**
 * Remote public read entrypoints (PUBLIC-CATALOG-01).
 * Independent Clubs / Courts calls — one failure does not empty the other.
 * No UI imports. No mock fallback on remote failure.
 */

import { createPublicCatalogFacade } from "../application/createPublicCatalogFacade.js";
import { PUBLIC_CATALOG_ERROR_CODE } from "../errors/errorCodes.js";
import { PublicCatalogError } from "../errors/PublicCatalogError.js";
import { createSupabasePublicCatalogRepository } from "../persistence/supabase/createSupabasePublicCatalogRepository.js";
import { deepFreeze } from "../contracts/shared.js";
import { fail } from "../../../core/platform/contracts/result.js";

/**
 * Lazy auth import — avoids loading @supabase/supabase-js at module import time.
 */
async function loadAuthClientModule() {
  return import("../../../auth/supabaseClient.js");
}

/**
 * @param {{ client?: object, repository?: object }} [options]
 */
export async function createRemotePublicCatalogFacade(options = {}) {
  if (options.repository) {
    return createPublicCatalogFacade({ repository: options.repository });
  }

  let client = options.client;
  if (!client) {
    try {
      const auth = await loadAuthClientModule();
      if (typeof auth.getSupabaseAuthClient === "function") {
        client = auth.getSupabaseAuthClient();
      } else if (auth.supabase) {
        client = auth.supabase;
      }
    } catch (err) {
      throw new PublicCatalogError(
        PUBLIC_CATALOG_ERROR_CODE.CLIENT_UNAVAILABLE,
        err instanceof Error
          ? err.message
          : "Supabase client unavailable for public catalog",
        { cause: "auth_import" }
      );
    }
  }

  if (!client) {
    throw new PublicCatalogError(
      PUBLIC_CATALOG_ERROR_CODE.CLIENT_UNAVAILABLE,
      "Supabase client unavailable for public catalog",
      { field: "client" }
    );
  }

  const repository = createSupabasePublicCatalogRepository({ client });
  return createPublicCatalogFacade({ repository });
}

/**
 * @param {Record<string, unknown>} [query]
 * @param {{ client?: object, repository?: object, facade?: object }} [options]
 */
export async function listPublicClubsRemote(query = {}, options = {}) {
  try {
    const facade =
      options.facade || (await createRemotePublicCatalogFacade(options));
    return facade.listPublicClubs(query);
  } catch (err) {
    return fail(
      deepFreeze({
        code:
          err instanceof PublicCatalogError
            ? err.code
            : PUBLIC_CATALOG_ERROR_CODE.CLIENT_UNAVAILABLE,
        message:
          err instanceof Error
            ? err.message
            : "Public clubs remote read failed",
        details: err instanceof PublicCatalogError ? err.details || {} : {},
      })
    );
  }
}

/**
 * @param {Record<string, unknown>} [query]
 * @param {{ client?: object, repository?: object, facade?: object }} [options]
 */
export async function listPublicCourtsRemote(query = {}, options = {}) {
  try {
    const facade =
      options.facade || (await createRemotePublicCatalogFacade(options));
    return facade.listPublicCourts(query);
  } catch (err) {
    return fail(
      deepFreeze({
        code:
          err instanceof PublicCatalogError
            ? err.code
            : PUBLIC_CATALOG_ERROR_CODE.CLIENT_UNAVAILABLE,
        message:
          err instanceof Error
            ? err.message
            : "Public courts remote read failed",
        details: err instanceof PublicCatalogError ? err.details || {} : {},
      })
    );
  }
}

/**
 * @param {Record<string, unknown>} [query]
 * @param {{ client?: object, repository?: object, facade?: object }} [options]
 */
export async function listPublicTournamentsRemote(query = {}, options = {}) {
  try {
    const facade =
      options.facade || (await createRemotePublicCatalogFacade(options));
    return facade.listPublicTournaments(query);
  } catch (err) {
    return fail(
      deepFreeze({
        code:
          err instanceof PublicCatalogError
            ? err.code
            : PUBLIC_CATALOG_ERROR_CODE.CLIENT_UNAVAILABLE,
        message:
          err instanceof Error
            ? err.message
            : "Public tournaments remote read failed",
        details: err instanceof PublicCatalogError ? err.details || {} : {},
      })
    );
  }
}

/**
 * @param {Record<string, unknown>} [query]
 * @param {{ client?: object, repository?: object, facade?: object }} [options]
 */
export async function listPublicRankingsRemote(query = {}, options = {}) {
  try {
    const facade =
      options.facade || (await createRemotePublicCatalogFacade(options));
    return facade.listPublicRankings(query);
  } catch (err) {
    return fail(
      deepFreeze({
        code:
          err instanceof PublicCatalogError
            ? err.code
            : PUBLIC_CATALOG_ERROR_CODE.CLIENT_UNAVAILABLE,
        message:
          err instanceof Error
            ? err.message
            : "Public rankings remote read failed",
        details: err instanceof PublicCatalogError ? err.details || {} : {},
      })
    );
  }
}

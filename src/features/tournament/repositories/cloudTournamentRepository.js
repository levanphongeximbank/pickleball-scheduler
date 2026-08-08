/**
 * Cloud Tournament repository — canonical cloud authority (prepared locally).
 *
 * Requires live migration package + VITE_TOURNAMENT_CANONICAL_DATA_MODE=cloud.
 * Until RPCs exist, all operations fail closed (no blob fallback, no mock).
 */
import {
  TOURNAMENT_REPO_ERROR,
  TOURNAMENT_REPOSITORY_KINDS,
} from "./TournamentRepository.interface.js";
import { requireExplicitTenantForClub } from "./transitionalBlobTournamentRepository.js";
import { CANONICAL_TOURNAMENT_RPC } from "./canonicalTournamentRpcs.js";

export { CANONICAL_TOURNAMENT_RPC };

function unavailable(message) {
  return {
    ok: false,
    code: TOURNAMENT_REPO_ERROR.CLOUD_UNAVAILABLE,
    error: message || "Canonical Tournament cloud authority chưa sẵn sàng.",
  };
}

async function callRpc(name, args) {
  const { hasSupabaseConfig, getSupabaseClient } = await import(
    "../../../auth/supabaseClient.js"
  );
  if (!hasSupabaseConfig()) {
    return unavailable("Thiếu cấu hình Supabase cho Tournament cloud.");
  }
  const client = getSupabaseClient();
  if (!client?.rpc) {
    return unavailable("Supabase client không khả dụng.");
  }
  const { data, error } = await client.rpc(name, args);
  if (error) {
    return {
      ok: false,
      code: TOURNAMENT_REPO_ERROR.CLOUD_UNAVAILABLE,
      error: String(error.message || error),
    };
  }
  if (data && typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, data };
}

export function createCloudTournamentRepository() {
  return {
    kind: TOURNAMENT_REPOSITORY_KINDS.CLOUD,

    list(clubId, filters = {}) {
      const tenantCheck = requireExplicitTenantForClub(clubId);
      if (!tenantCheck.ok) return [];
      void filters;
      return [];
    },

    get() {
      return null;
    },

    listMine() {
      return [];
    },

    create(clubId) {
      const tenantCheck = requireExplicitTenantForClub(clubId);
      if (!tenantCheck.ok) return tenantCheck;
      return unavailable(
        "Canonical Tournament cloud create yêu cầu RPC canonical_tournament_create (chưa apply live)."
      );
    },

    update(clubId) {
      const tenantCheck = requireExplicitTenantForClub(clubId);
      if (!tenantCheck.ok) return tenantCheck;
      return unavailable(
        "Canonical Tournament cloud update yêu cầu RPC canonical_tournament_update (chưa apply live)."
      );
    },

    delete(clubId) {
      const tenantCheck = requireExplicitTenantForClub(clubId);
      if (!tenantCheck.ok) return tenantCheck;
      return unavailable(
        "Canonical Tournament cloud delete yêu cầu RPC canonical_tournament_delete (chưa apply live)."
      );
    },

    applyEngineState(clubId) {
      const tenantCheck = requireExplicitTenantForClub(clubId);
      if (!tenantCheck.ok) return tenantCheck;
      return unavailable(
        "Canonical Tournament cloud engine apply yêu cầu RPC canonical_tournament_apply_engine_state."
      );
    },

    async listAsync(clubId, filters = {}) {
      const tenantCheck = requireExplicitTenantForClub(clubId);
      if (!tenantCheck.ok) {
        return { ok: false, ...tenantCheck, tournaments: [] };
      }
      const result = await callRpc(CANONICAL_TOURNAMENT_RPC.LIST, {
        p_tenant_id: tenantCheck.tenantId,
        p_club_id: tenantCheck.clubId,
        p_filters: filters || {},
      });
      if (!result.ok) return { ...result, tournaments: [] };
      return {
        ok: true,
        tournaments: Array.isArray(result.tournaments)
          ? result.tournaments
          : Array.isArray(result.data)
            ? result.data
            : [],
      };
    },
  };
}

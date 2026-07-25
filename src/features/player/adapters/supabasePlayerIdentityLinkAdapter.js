/**
 * PM-ID-01 — Supabase / PostgREST adapter contract for mapping resolve RPC.
 *
 * Does not invent mappings. Calls player_identity_resolve_mapping via RPC.
 * Principal is established by the JWT (auth.uid()) on the server — never sent
 * as an RPC argument.
 */

import { PLAYER_IDENTITY_MAPPING_SOURCE } from "../constants/identityMapping.js";
import { buildPlayerIdentityMappingResult } from "../models/identityMappingResult.js";

/**
 * @typedef {object} PlayerIdentityRpcClient
 * @property {(fn: string, args: Record<string, unknown>) => Promise<{ data: unknown, error: unknown }>} rpc
 */

/**
 * @param {object} params
 * @param {PlayerIdentityRpcClient} params.client
 * @param {string} params.tenantId
 * @param {string} params.clubId
 */
export async function resolveMappingViaSupabaseRpc({ client, tenantId, clubId }) {
  if (!client || typeof client.rpc !== "function") {
    throw new Error("PLAYER_IDENTITY_RPC_CLIENT_REQUIRED");
  }

  const { data, error } = await client.rpc("player_identity_resolve_mapping", {
    p_tenant_id: tenantId,
    p_club_id: clubId,
  });

  if (error) {
    const err = new Error(error.message || "PLAYER_IDENTITY_RPC_FAILED");
    err.code = error.code || "RPC_ERROR";
    err.cause = error;
    throw err;
  }

  const row = data && typeof data === "object" ? data : {};
  return buildPlayerIdentityMappingResult({
    status: row.status,
    playerId: row.player_id ?? row.playerId ?? null,
    tenantId: row.tenant_id ?? row.tenantId ?? tenantId,
    clubId: row.club_id ?? row.clubId ?? clubId,
    source: row.source || PLAYER_IDENTITY_MAPPING_SOURCE.PLAYER_IDENTITY_LINKS,
    reasonCode: row.reason_code ?? row.reasonCode ?? null,
  });
}

/**
 * Adapter factory exposing the repository-shaped resolve used by the service
 * when a live RPC client is injected. For unit tests prefer the memory repository.
 *
 * @param {PlayerIdentityRpcClient} client
 */
export function createSupabasePlayerIdentityLinkAdapter(client) {
  return {
    /**
     * Live path bypasses local link enumeration — server RPC is SoT.
     * Kept for contract completeness; service prefers rpcResolve when present.
     */
    async rpcResolve({ tenantId, clubId }) {
      return resolveMappingViaSupabaseRpc({ client, tenantId, clubId });
    },
  };
}

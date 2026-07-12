import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { REFEREE_V5_ERROR } from "../persistence/errors.js";
import { isPublicBrowserRpc, REFEREE_V5_INTERNAL_RPC_NAMES } from "./refereeV5InternalRpcService.js";

let testRpcClientOverride = null;

/** Public read RPC — authenticated users with assignment. */
export const REFEREE_V5_PUBLIC_RPC_NAMES = Object.freeze({
  GET_MATCH_STATE: "referee_v5_get_match_state",
});

function getClient() {
  return testRpcClientOverride || getSupabaseAuthClient();
}

export function setRefereeV5RpcClientForTests(client) {
  testRpcClientOverride = client;
}

export function isRefereeV5RpcNotFoundError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("referee_v5_") && message.includes("not found");
}

function normalizeRpcResult(data, error) {
  if (error) {
    return {
      ok: false,
      code: error.code || REFEREE_V5_ERROR.VALIDATION_FAILED,
      error: error.message || String(error),
    };
  }
  if (data?.ok === false) {
    return data;
  }
  if (data?.ok === true || data?.state) {
    return { ok: true, ...data };
  }
  return { ok: true, data };
}

export async function refereeV5GetMatchState({ tenantId, tournamentId, matchId }) {
  const client = getClient();
  const { data, error } = await client.rpc(REFEREE_V5_PUBLIC_RPC_NAMES.GET_MATCH_STATE, {
    p_tenant_id: tenantId,
    p_tournament_id: tournamentId,
    p_match_id: matchId,
  });
  return normalizeRpcResult(data, error);
}

/**
 * Browser must use Edge Functions for mutations — not direct RPC.
 * @deprecated use refereeV5EdgeApplyCommand
 */
export async function refereeV5ApplyMatchCommand() {
  return {
    ok: false,
    code: REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN,
    error: "Dùng Edge Function referee-v5-apply-command, không gọi RPC trực tiếp.",
  };
}

/** @deprecated use refereeV5EdgeFinalize */
export async function refereeV5FinalizeMatchResult() {
  return {
    ok: false,
    code: REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN,
    error: "Dùng Edge Function referee-v5-finalize, không gọi RPC trực tiếp.",
  };
}

export function assertBrowserCannotCallInternalRpc(rpcName) {
  if (!isPublicBrowserRpc(rpcName)) {
    return {
      ok: false,
      code: REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN,
      rpcName,
    };
  }
  return { ok: true };
}

export { REFEREE_V5_INTERNAL_RPC_NAMES };

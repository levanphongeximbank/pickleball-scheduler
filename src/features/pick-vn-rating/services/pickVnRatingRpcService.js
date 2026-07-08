import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

let testRpcClientOverride = null;

export function __setPickVnRatingRpcClientForTests(client) {
  testRpcClientOverride = client;
}

export function __resetPickVnRatingRpcClientForTests() {
  testRpcClientOverride = null;
}

function resolveRpcClient() {
  return testRpcClientOverride || getSupabaseAuthClient();
}

function parseRpcJson(data) {
  if (!data) {
    return { ok: false, code: "EMPTY_RESPONSE", error: "RPC trả về rỗng." };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, ...data };
}

export function isPickVnRpcNotFoundError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    (message.includes("function") && message.includes("does not exist")) ||
    error?.code === "PGRST202"
  );
}

async function callPickVnRpc(rpcName, args = {}) {
  const client = resolveRpcClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc(rpcName, args);
  if (error) {
    if (isPickVnRpcNotFoundError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  return parseRpcJson(data);
}

export async function rpcPickVnSyncRating(record) {
  return callPickVnRpc("pick_vn_sync_rating", { p_row: record });
}

export async function rpcPickVnVerifyRating(payload) {
  return callPickVnRpc("pick_vn_verify_rating", { p_payload: payload });
}

export async function rpcPickVnListPendingVerifications() {
  return callPickVnRpc("pick_vn_list_pending_verifications", {});
}

export async function rpcPickVnGetRatingByAuthUser(authUserId) {
  return callPickVnRpc("pick_vn_get_rating_by_auth_user", {
    p_auth_user_id: authUserId,
  });
}

import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

let testRpcClientOverride = null;

export function __setRatingV5RpcClientForTests(client) {
  testRpcClientOverride = client;
}

export function __resetRatingV5RpcClientForTests() {
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

async function callRatingV5Rpc(rpcName, args = {}) {
  const client = resolveRpcClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc(rpcName, args);
  if (error) {
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }
  return parseRpcJson(data);
}

export async function rpcRatingV5StartAssessment(ratingMode = "doubles") {
  return callRatingV5Rpc("rating_v5_start_assessment", { p_rating_mode: ratingMode });
}

export async function rpcRatingV5GetMyPilotEnrollment() {
  return callRatingV5Rpc("rating_v5_get_my_pilot_enrollment");
}

export async function rpcRatingV5GetProfile(ratingMode = "doubles") {
  return callRatingV5Rpc("rating_v5_get_profile", { p_rating_mode: ratingMode });
}

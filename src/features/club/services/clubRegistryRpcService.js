import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

function isMissingRpcError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    (message.includes("function") && message.includes("does not exist")) ||
    error?.code === "PGRST202"
  );
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

export async function rpcClubUpsertRegistry({ club } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("club_upsert_registry", {
    p_club: club,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  return parseRpcJson(data);
}

/** Chủ tịch tự nhận CLB sau khi registry đã upsert lên cloud. */
export async function rpcClubClaimSelfRegistration(clubId) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("club_claim_self_registration", {
    p_club_id: String(clubId || "").trim(),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  return parseRpcJson(data);
}

export async function rpcClubListDiscoverable({ search = "", limit = 100 } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("club_list_discoverable", {
    p_search: search || "",
    p_limit: limit,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  const payload = parseRpcJson(data);
  if (!payload.ok) {
    return payload;
  }

  return {
    ok: true,
    clubs: payload.clubs || [],
    provider: "rpc",
  };
}

export async function rpcClubListRegistry({
  venueId = null,
  includeInactive = false,
  limit = 200,
} = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("club_list_registry", {
    p_venue_id: venueId || null,
    p_include_inactive: includeInactive,
    p_limit: limit,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  const payload = parseRpcJson(data);
  if (!payload.ok) {
    return payload;
  }

  return {
    ok: true,
    clubs: payload.clubs || [],
    provider: "rpc",
  };
}

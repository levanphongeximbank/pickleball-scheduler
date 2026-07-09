import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { normalizeCourtClaimRequest } from "../models/courtClaimRequest.js";
import { normalizeCourtCluster } from "../../../models/courtCluster.js";

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

export async function rpcListUnassignedClusters({ search = "", limit = 100 } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_list_unassigned_clusters", {
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

  const clusters = (payload.clusters || []).map((row) => ({
    ...normalizeCourtCluster(row),
    venueName: row.venue_name || "",
  }));
  return { ok: true, clusters, provider: "rpc" };
}

export async function rpcListRegisterableClusters({ search = "", limit = 100 } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_list_registerable_clusters", {
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

  const clusters = (payload.clusters || []).map((row) => ({
    ...normalizeCourtCluster(row),
    venueName: row.venue_name || "",
  }));
  return { ok: true, clusters, provider: "rpc" };
}

export async function rpcSubmitCourtClaimRequest({ clusterIds = [], message = "" } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_submit_claim_request", {
    p_cluster_ids: clusterIds,
    p_message: message || "",
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
    request: normalizeCourtClaimRequest(payload.request),
    provider: "rpc",
  };
}

export async function rpcListMyCourtClaimRequests() {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_list_my_claim_requests");

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

  const requests = (payload.requests || []).map((row) => normalizeCourtClaimRequest(row));
  return { ok: true, requests, provider: "rpc" };
}

export async function rpcListPendingCourtClaimRequests({ limit = 50 } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_list_pending_claim_requests", {
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

  const requests = (payload.requests || []).map((row) => normalizeCourtClaimRequest(row));
  return { ok: true, requests, provider: "rpc" };
}

export async function rpcReviewCourtClaimRequest({
  requestId,
  action,
  reviewNote = "",
} = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_review_claim_request", {
    p_request_id: requestId,
    p_action: action,
    p_review_note: reviewNote || "",
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
    request: normalizeCourtClaimRequest(payload.request),
    provider: "rpc",
  };
}

export async function rpcCancelCourtClaimRequest(requestId) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_cancel_claim_request", {
    p_request_id: requestId,
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
    request: normalizeCourtClaimRequest(payload.request),
    provider: "rpc",
  };
}

export async function rpcRegisterCourtOwnerIntent(note = "") {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("auth_register_court_owner_intent", {
    p_note: note || "",
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  return { ok: true, data, provider: "rpc" };
}

export async function rpcAdminAssignClusterOwner({ userId, clusterIds = [] } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_admin_assign_cluster_owner", {
    p_user_id: userId,
    p_cluster_ids: clusterIds,
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
    userId: payload.userId,
    clusterIds: payload.clusterIds || clusterIds,
    venueId: payload.venueId || null,
    provider: "rpc",
  };
}

export async function rpcAdminUpsertCluster({ cluster } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_admin_upsert_cluster", {
    p_cluster: cluster,
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
    cluster: payload.cluster ? normalizeCourtCluster(payload.cluster) : null,
    provider: "rpc",
  };
}

export async function rpcAdminRemoveClusterOwner({ clusterId } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_admin_remove_cluster_owner", {
    p_cluster_id: clusterId,
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
    clusterId: payload.clusterId || clusterId,
    provider: "rpc",
  };
}

export async function rpcAdminDeleteCluster({ clusterId } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("court_admin_delete_cluster", {
    p_cluster_id: clusterId,
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
    clusterId: payload.clusterId || clusterId,
    provider: "rpc",
  };
}

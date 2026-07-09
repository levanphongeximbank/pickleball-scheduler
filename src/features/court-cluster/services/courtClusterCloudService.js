import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { normalizeCourtCluster } from "../../../models/courtCluster.js";
import {
  rpcAdminDeleteCluster,
  rpcAdminRemoveClusterOwner,
  rpcAdminUpsertCluster,
} from "./courtClaimRequestRpcService.js";

function clusterToRpcPayload(cluster) {
  const normalized = normalizeCourtCluster(cluster);
  return {
    id: normalized.id,
    venue_id: normalized.venueId,
    name: normalized.name,
    slug: normalized.slug,
    status: normalized.status,
    court_count: normalized.courtCount,
    address: normalized.address || "",
    google_maps_url: normalized.googleMapsUrl || "",
  };
}

export async function upsertClusterToCloud(cluster) {
  if (!hasSupabaseConfig()) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa cấu hình." };
  }

  const rpcResult = await rpcAdminUpsertCluster({ cluster: clusterToRpcPayload(cluster) });
  if (!rpcResult.ok && rpcResult.code === "RPC_NOT_DEPLOYED") {
    return { ok: false, code: "RPC_NOT_DEPLOYED", error: rpcResult.error };
  }
  return rpcResult;
}

export async function removeClusterOwnerFromCloud(clusterId) {
  const normalizedId = String(clusterId || "").trim();
  if (!normalizedId) {
    return { ok: false, code: "CLUSTER_ID_REQUIRED", error: "Thiếu id cụm sân." };
  }

  if (!hasSupabaseConfig()) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa cấu hình." };
  }

  const rpcResult = await rpcAdminRemoveClusterOwner({ clusterId: normalizedId });
  if (!rpcResult.ok && rpcResult.code === "RPC_NOT_DEPLOYED") {
    return { ok: false, code: "RPC_NOT_DEPLOYED", error: rpcResult.error };
  }
  return rpcResult;
}

export async function deleteClusterFromCloud(clusterId) {
  const normalizedId = String(clusterId || "").trim();
  if (!normalizedId) {
    return { ok: false, code: "CLUSTER_ID_REQUIRED", error: "Thiếu id cụm sân." };
  }

  if (!hasSupabaseConfig()) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa cấu hình." };
  }

  const rpcResult = await rpcAdminDeleteCluster({ clusterId: normalizedId });
  if (!rpcResult.ok && rpcResult.code === "RPC_NOT_DEPLOYED") {
    return { ok: false, code: "RPC_NOT_DEPLOYED", error: rpcResult.error };
  }
  return rpcResult;
}

export async function syncVenueClustersToCloud(clusters = []) {
  const results = [];
  for (const cluster of clusters) {
    const result = await upsertClusterToCloud(cluster);
    results.push({ clusterId: cluster.id, ...result });
    if (!result.ok && result.code !== "RPC_NOT_DEPLOYED") {
      return {
        ok: false,
        error: result.error || `Không đồng bộ được cụm ${cluster.id}.`,
        code: result.code,
        results,
      };
    }
  }

  const failed = results.filter((item) => !item.ok && item.code !== "RPC_NOT_DEPLOYED");
  if (failed.length > 0) {
    return {
      ok: false,
      error: failed[0].error,
      code: failed[0].code,
      results,
    };
  }

  return {
    ok: true,
    synced: results.filter((item) => item.ok).length,
    results,
    provider: results.some((item) => item.provider === "rpc") ? "rpc" : "skipped",
  };
}

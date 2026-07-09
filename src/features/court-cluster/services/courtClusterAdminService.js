import { getCurrentUser, isDevAuthAllowed } from "../../../auth/authService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import {
  assignUserToCluster,
  deleteCourtCluster,
  getClusterById,
  listAssignmentsForCluster,
  setUserClusterAssignments,
  unassignUserFromCluster,
  updateCourtCluster,
} from "./courtClusterService.js";
import {
  pullClusterContextForUser,
  pruneInvalidLocalClusterOwners,
  pruneOrphanLocalClusters,
  remapClusterIdLocally,
} from "./courtClusterCloudSync.js";
import {
  deleteClusterFromCloud,
  removeClusterOwnerFromCloud,
  upsertClusterToCloud,
} from "./courtClusterCloudService.js";
import { isValidProfileUserId } from "../utils/profileUserId.js";
import {
  migrateLegacyClusterRecord,
  resolveCloudVenueIdForClusterOps,
} from "../utils/clusterCloudResolver.js";
import { rpcAdminAssignClusterOwner } from "./courtClaimRequestRpcService.js";

async function ensureClustersOnCloud(clusterIds = [], { venueId, actor, assigneeUserId } = {}) {
  const ids = [...new Set((clusterIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, error: "Chọn ít nhất một cụm sân.", code: "CLUSTER_IDS_REQUIRED" };
  }

  const cloudVenueId = await resolveCloudVenueIdForClusterOps({
    selectedVenueId: venueId,
    actor,
    assigneeUserId,
  });

  if (!cloudVenueId) {
    return {
      ok: false,
      code: "VENUE_ID_REQUIRED",
      error:
        "Không xác định được tổ chức cloud. Chọn tổ chức hợp lệ hoặc gán venue_id trên profile chủ sân.",
    };
  }

  const resolvedIds = [];

  for (const clusterId of ids) {
    const cluster = getClusterById(clusterId);
    if (!cluster) {
      return {
        ok: false,
        code: "CLUSTER_NOT_FOUND",
        error: `Không tìm thấy cụm: ${clusterId}`,
      };
    }

    const cloudCluster = migrateLegacyClusterRecord(cluster, cloudVenueId);
    if (cloudCluster.id !== cluster.id) {
      remapClusterIdLocally(cluster.id, cloudCluster);
    } else if (cloudCluster.venueId !== cluster.venueId) {
      updateCourtCluster(cluster.id, { venueId: cloudCluster.venueId }, { user: actor });
    }

    const latestCluster = getClusterById(cloudCluster.id) || cloudCluster;
    const upsertResult = await upsertClusterToCloud(latestCluster);
    if (!upsertResult.ok) {
      if (upsertResult.code === "RPC_NOT_DEPLOYED" && isDevAuthAllowed()) {
        resolvedIds.push(cloudCluster.id);
        continue;
      }
      return upsertResult;
    }

    resolvedIds.push(cloudCluster.id);
  }

  return { ok: true, clusterIds: resolvedIds, venueId: cloudVenueId };
}

export async function assignClusterOwnerToUser({
  userId,
  clusterIds = [],
  venueId = null,
  actor = getCurrentUser(),
} = {}) {
  const normalizedUserId = String(userId || "").trim();
  const ids = [...new Set((clusterIds || []).map((id) => String(id).trim()).filter(Boolean))];

  if (!normalizedUserId) {
    return { ok: false, error: "Chọn chủ sân.", code: "USER_ID_REQUIRED" };
  }

  if (!isValidProfileUserId(normalizedUserId)) {
    return {
      ok: false,
      error: "User ID phải là UUID profile hợp lệ.",
      code: "INVALID_USER_ID",
    };
  }

  if (ids.length === 0) {
    return { ok: false, error: "Chọn ít nhất một cụm sân.", code: "CLUSTER_IDS_REQUIRED" };
  }

  if (hasSupabaseConfig()) {
    const ensured = await ensureClustersOnCloud(ids, {
      venueId,
      actor,
      assigneeUserId: normalizedUserId,
    });
    if (!ensured.ok) {
      return ensured;
    }

    const cloudIds = ensured.clusterIds;
    const rpcResult = await rpcAdminAssignClusterOwner({
      userId: normalizedUserId,
      clusterIds: cloudIds,
    });
    if (rpcResult.ok) {
      await pullClusterContextForUser({ id: normalizedUserId });
      if (actor?.id) {
        await pullClusterContextForUser(actor);
      }
      for (const clusterId of cloudIds) {
        assignUserToCluster(normalizedUserId, clusterId, {
          role: "CLUSTER_OWNER",
          user: actor,
        });
        updateCourtCluster(clusterId, { ownerUserId: normalizedUserId }, { user: actor });
      }
      return { ...rpcResult, clusterIds: cloudIds, provider: "rpc" };
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  if (!isDevAuthAllowed()) {
    return { ok: false, error: "Chức năng cần Supabase RPC.", code: "NO_SOURCE" };
  }

  const result = setUserClusterAssignments(normalizedUserId, ids, { user: actor });
  if (!result.ok) {
    return result;
  }

  for (const clusterId of ids) {
    assignUserToCluster(normalizedUserId, clusterId, { role: "CLUSTER_OWNER", user: actor });
    updateCourtCluster(clusterId, { ownerUserId: normalizedUserId }, { user: actor });
  }

  return { ok: true, userId: normalizedUserId, clusterIds: ids, provider: "local" };
}

export async function removeClusterOwner({
  clusterId,
  venueId = null,
  actor = getCurrentUser(),
} = {}) {
  const normalizedClusterId = String(clusterId || "").trim();
  if (!normalizedClusterId) {
    return { ok: false, error: "Thiếu id cụm sân.", code: "CLUSTER_ID_REQUIRED" };
  }

  let targetClusterId = normalizedClusterId;

  if (hasSupabaseConfig()) {
    const ensured = await ensureClustersOnCloud([normalizedClusterId], { venueId, actor });
    if (!ensured.ok && ensured.code !== "RPC_NOT_DEPLOYED") {
      return ensured;
    }
    if (ensured.ok) {
      targetClusterId = ensured.clusterIds[0] || normalizedClusterId;
    }
  }

  const ownerAssignments = listAssignmentsForCluster(targetClusterId).filter(
    (item) => item.role === "CLUSTER_OWNER"
  );

  if (hasSupabaseConfig()) {
    const rpcResult = await removeClusterOwnerFromCloud(targetClusterId);
    if (rpcResult.ok) {
      for (const assignment of ownerAssignments) {
        unassignUserFromCluster(assignment.userId, targetClusterId, { user: actor });
      }
      updateCourtCluster(targetClusterId, { ownerUserId: null }, { user: actor });
      if (actor?.id) {
        await pullClusterContextForUser(actor);
      }
      pruneInvalidLocalClusterOwners();
      return { ...rpcResult, clusterId: targetClusterId, provider: "rpc" };
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  if (!isDevAuthAllowed()) {
    return { ok: false, error: "Chức năng cần Supabase RPC.", code: "NO_SOURCE" };
  }

  for (const assignment of ownerAssignments) {
    unassignUserFromCluster(assignment.userId, targetClusterId, { user: actor });
  }
  updateCourtCluster(targetClusterId, { ownerUserId: null }, { user: actor });
  pruneInvalidLocalClusterOwners();

  return { ok: true, clusterId: targetClusterId, provider: "local" };
}

export async function persistCourtClusterToCloud(cluster, { venueId = null, actor = getCurrentUser() } = {}) {
  if (!hasSupabaseConfig()) {
    if (!isDevAuthAllowed()) {
      return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa cấu hình." };
    }
    return { ok: true, provider: "local" };
  }

  const ensured = await ensureClustersOnCloud([cluster.id], { venueId, actor });
  if (!ensured.ok && ensured.code !== "RPC_NOT_DEPLOYED") {
    return ensured;
  }

  if (actor?.id) {
    await pullClusterContextForUser(actor);
  }

  return { ok: true, clusterId: ensured.clusterIds?.[0] || cluster.id, provider: "rpc" };
}

export async function syncClustersForVenueToCloud({
  clusters = [],
  venueId = null,
  actor = getCurrentUser(),
} = {}) {
  if (venueId) {
    pruneOrphanLocalClusters(venueId);
  }

  const clusterIds = (clusters || []).map((cluster) => cluster.id).filter(Boolean);
  const ensured = await ensureClustersOnCloud(clusterIds, { venueId, actor });
  if (!ensured.ok) {
    return ensured;
  }

  if (actor?.id) {
    await pullClusterContextForUser(actor);
    pruneInvalidLocalClusterOwners();
  }

  return {
    ok: true,
    synced: ensured.clusterIds.length,
    clusterIds: ensured.clusterIds,
    venueId: ensured.venueId,
    provider: "rpc",
  };
}

export async function removeCourtCluster({
  clusterId,
  venueId = null,
  actor = getCurrentUser(),
} = {}) {
  const normalizedClusterId = String(clusterId || "").trim();
  if (!normalizedClusterId) {
    return { ok: false, error: "Thiếu id cụm sân.", code: "CLUSTER_ID_REQUIRED" };
  }

  let targetClusterId = normalizedClusterId;

  if (hasSupabaseConfig()) {
    const cluster = getClusterById(normalizedClusterId);
    if (cluster) {
      const ensured = await ensureClustersOnCloud([normalizedClusterId], { venueId, actor });
      if (ensured.ok) {
        targetClusterId = ensured.clusterIds[0] || normalizedClusterId;
      }
    }

    const rpcResult = await deleteClusterFromCloud(targetClusterId);
    if (rpcResult.ok) {
      deleteCourtCluster(targetClusterId, { user: actor });
      if (targetClusterId !== normalizedClusterId) {
        deleteCourtCluster(normalizedClusterId, { user: actor });
      }
      if (actor?.id) {
        await pullClusterContextForUser(actor);
      }
      return { ...rpcResult, clusterId: targetClusterId, provider: "rpc" };
    }
    if (rpcResult.code === "CLUSTER_NOT_FOUND") {
      const localResult = deleteCourtCluster(normalizedClusterId, { user: actor });
      if (localResult.ok) {
        return { ok: true, clusterId: normalizedClusterId, provider: "local" };
      }
      return localResult;
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  if (!isDevAuthAllowed()) {
    return { ok: false, error: "Chức năng cần Supabase RPC.", code: "NO_SOURCE" };
  }

  return deleteCourtCluster(normalizedClusterId, { user: actor });
}

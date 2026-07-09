import { getCurrentUser, isDevAuthAllowed } from "../../../auth/authService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import {
  assignUserToCluster,
  listAssignmentsForCluster,
  setUserClusterAssignments,
  unassignUserFromCluster,
  updateCourtCluster,
} from "./courtClusterService.js";
import {
  pullClusterContextForUser,
  pruneInvalidLocalClusterOwners,
  pruneOrphanLocalClusters,
} from "./courtClusterCloudSync.js";
import {
  removeClusterOwnerFromCloud,
  syncVenueClustersToCloud,
  upsertClusterToCloud,
} from "./courtClusterCloudService.js";
import { isValidProfileUserId } from "../utils/profileUserId.js";
import { rpcAdminAssignClusterOwner } from "./courtClaimRequestRpcService.js";

export async function assignClusterOwnerToUser({
  userId,
  clusterIds = [],
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
    const rpcResult = await rpcAdminAssignClusterOwner({
      userId: normalizedUserId,
      clusterIds: ids,
    });
    if (rpcResult.ok) {
      await pullClusterContextForUser({ id: normalizedUserId });
      if (actor?.id) {
        await pullClusterContextForUser(actor);
      }
      for (const clusterId of ids) {
        assignUserToCluster(normalizedUserId, clusterId, {
          role: "CLUSTER_OWNER",
          user: actor,
        });
        updateCourtCluster(clusterId, { ownerUserId: normalizedUserId }, { user: actor });
      }
      return { ...rpcResult, provider: "rpc" };
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
  actor = getCurrentUser(),
} = {}) {
  const normalizedClusterId = String(clusterId || "").trim();
  if (!normalizedClusterId) {
    return { ok: false, error: "Thiếu id cụm sân.", code: "CLUSTER_ID_REQUIRED" };
  }

  const ownerAssignments = listAssignmentsForCluster(normalizedClusterId).filter(
    (item) => item.role === "CLUSTER_OWNER"
  );

  if (hasSupabaseConfig()) {
    const rpcResult = await removeClusterOwnerFromCloud(normalizedClusterId);
    if (rpcResult.ok) {
      for (const assignment of ownerAssignments) {
        unassignUserFromCluster(assignment.userId, normalizedClusterId, { user: actor });
      }
      updateCourtCluster(normalizedClusterId, { ownerUserId: null }, { user: actor });
      if (actor?.id) {
        await pullClusterContextForUser(actor);
      }
      pruneInvalidLocalClusterOwners();
      return { ...rpcResult, provider: "rpc" };
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  if (!isDevAuthAllowed()) {
    return { ok: false, error: "Chức năng cần Supabase RPC.", code: "NO_SOURCE" };
  }

  for (const assignment of ownerAssignments) {
    unassignUserFromCluster(assignment.userId, normalizedClusterId, { user: actor });
  }
  updateCourtCluster(normalizedClusterId, { ownerUserId: null }, { user: actor });
  pruneInvalidLocalClusterOwners();

  return { ok: true, clusterId: normalizedClusterId, provider: "local" };
}

export async function persistCourtClusterToCloud(cluster, { actor = getCurrentUser() } = {}) {
  if (!hasSupabaseConfig()) {
    if (!isDevAuthAllowed()) {
      return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa cấu hình." };
    }
    return { ok: true, provider: "local" };
  }

  const rpcResult = await upsertClusterToCloud(cluster);
  if (rpcResult.ok) {
    if (actor?.id) {
      await pullClusterContextForUser(actor);
    }
    return rpcResult;
  }
  if (rpcResult.code === "RPC_NOT_DEPLOYED" && isDevAuthAllowed()) {
    return { ok: true, provider: "local" };
  }
  return rpcResult;
}

export async function syncClustersForVenueToCloud({
  clusters = [],
  venueId = null,
  actor = getCurrentUser(),
} = {}) {
  if (venueId) {
    pruneOrphanLocalClusters(venueId);
  }

  const result = await syncVenueClustersToCloud(clusters);
  if (result.ok && actor?.id) {
    await pullClusterContextForUser(actor);
    pruneInvalidLocalClusterOwners();
  }
  return result;
}

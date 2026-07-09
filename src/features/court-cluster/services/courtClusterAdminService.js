import { getCurrentUser, isDevAuthAllowed } from "../../../auth/authService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import {
  assignUserToCluster,
  setUserClusterAssignments,
  updateCourtCluster,
} from "./courtClusterService.js";
import { pullClusterContextForUser } from "./courtClusterCloudSync.js";
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

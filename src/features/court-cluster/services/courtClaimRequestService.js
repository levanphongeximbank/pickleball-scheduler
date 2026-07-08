import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { guardPermission } from "../../../auth/guardAction.js";
import { getCurrentUser, isDevAuthAllowed } from "../../../auth/authService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { ROLES, normalizeRole } from "../../../auth/roles.js";
import { COURT_CLAIM_REQUEST_STATUSES } from "../constants/courtClaimRequestStatuses.js";
import {
  createCourtClaimRequestRecord,
  normalizeCourtClaimRequest,
} from "../models/courtClaimRequest.js";
import {
  loadCourtClaimRequests,
  saveCourtClaimRequests,
} from "../storage/courtClaimRequestStorage.js";
import {
  assignUserToCluster,
  canManageCourtClusters,
  getClusterById,
  listAssignmentsForCluster,
  listAssignmentsForUser,
  updateCourtCluster,
} from "./courtClusterService.js";
import { loadCourtClusters } from "../../../data/courtCluster.js";
import {
  rpcCancelCourtClaimRequest,
  rpcListMyCourtClaimRequests,
  rpcListPendingCourtClaimRequests,
  rpcListUnassignedClusters,
  rpcReviewCourtClaimRequest,
  rpcSubmitCourtClaimRequest,
} from "./courtClaimRequestRpcService.js";

function isClusterUnassignedLocal(clusterId) {
  const cluster = getClusterById(clusterId);
  if (!cluster || cluster.status !== "active") {
    return false;
  }

  if (cluster.ownerUserId) {
    return false;
  }

  return !listAssignmentsForCluster(clusterId).some((item) => item.role === "CLUSTER_OWNER");
}

function listUnassignedClustersLocal({ search = "" } = {}) {
  const term = String(search || "").trim().toLowerCase();
  return loadCourtClusters().filter((cluster) => {
    if (!isClusterUnassignedLocal(cluster.id)) {
      return false;
    }
    if (!term) {
      return true;
    }
    return (
      cluster.name.toLowerCase().includes(term) ||
      cluster.address.toLowerCase().includes(term) ||
      cluster.venueId.toLowerCase().includes(term)
    );
  });
}

function validateClusterSelection(clusterIds) {
  const ids = [...new Set((clusterIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, error: "Chọn ít nhất một cụm sân.", code: "CLUSTER_IDS_REQUIRED" };
  }

  const venues = new Set();
  for (const clusterId of ids) {
    const cluster = getClusterById(clusterId);
    if (!cluster) {
      return { ok: false, error: `Không tìm thấy cụm: ${clusterId}`, code: "CLUSTER_NOT_FOUND" };
    }
    if (!isClusterUnassignedLocal(clusterId)) {
      return { ok: false, error: `Cụm không còn trống: ${cluster.name}`, code: "CLUSTER_NOT_AVAILABLE" };
    }
    venues.add(cluster.venueId);
  }

  if (venues.size > 1) {
    return {
      ok: false,
      error: "Chỉ chọn cụm sân cùng một tổ chức trong một yêu cầu.",
      code: "MIXED_VENUE_NOT_ALLOWED",
    };
  }

  const venueId = [...venues][0];
  return { ok: true, clusterIds: ids, venueId };
}

export function canReviewCourtClaimRequests(user = getCurrentUser()) {
  if (!user) {
    return false;
  }
  if (canManageCourtClusters(user)) {
    return true;
  }
  const check = guardPermission(PERMISSIONS.CLUSTER_MANAGE, {});
  return check.ok;
}

export function userHasApprovedClusterAssignments(user = getCurrentUser()) {
  if (!user?.id) {
    return false;
  }
  return listAssignmentsForUser(user.id).some((item) => item.role === "CLUSTER_OWNER");
}

export async function listUnassignedClusters({ search = "" } = {}) {
  if (hasSupabaseConfig()) {
    const rpcResult = await rpcListUnassignedClusters({ search });
    if (rpcResult.ok) {
      return rpcResult;
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  return { ok: true, clusters: listUnassignedClustersLocal({ search }), provider: "local" };
}

export async function listMyCourtClaimRequests() {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  if (hasSupabaseConfig()) {
    const rpcResult = await rpcListMyCourtClaimRequests();
    if (rpcResult.ok) {
      return rpcResult;
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  const requests = loadCourtClaimRequests()
    .filter((item) => item.userId === user.id)
    .sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));

  return { ok: true, requests, provider: "local" };
}

export function getPendingCourtClaimRequestForUser(user = getCurrentUser()) {
  if (!user?.id) {
    return null;
  }
  return (
    loadCourtClaimRequests().find(
      (item) => item.userId === user.id && item.status === COURT_CLAIM_REQUEST_STATUSES.PENDING
    ) || null
  );
}

export async function submitCourtClaimRequest({ clusterIds = [], message = "" } = {}) {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  if (userHasApprovedClusterAssignments(user)) {
    return { ok: false, error: "Tài khoản đã có cụm sân.", code: "ALREADY_ASSIGNED" };
  }

  const selection = validateClusterSelection(clusterIds);
  if (!selection.ok) {
    return selection;
  }

  if (hasSupabaseConfig()) {
    const rpcResult = await rpcSubmitCourtClaimRequest({
      clusterIds: selection.clusterIds,
      message,
    });
    if (rpcResult.ok) {
      return rpcResult;
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  if (!isDevAuthAllowed()) {
    return { ok: false, error: "Chức năng cần Supabase RPC.", code: "NO_SOURCE" };
  }

  const existingPending = getPendingCourtClaimRequestForUser(user);
  if (existingPending) {
    return { ok: false, error: "Đã có yêu cầu đang chờ duyệt.", code: "DUPLICATE_PENDING" };
  }

  const request = createCourtClaimRequestRecord({
    userId: user.id,
    venueId: selection.venueId,
    clusterIds: selection.clusterIds,
    message,
  });

  const requests = [...loadCourtClaimRequests(), request];
  saveCourtClaimRequests(requests);
  return { ok: true, request, provider: "local" };
}

export async function listPendingCourtClaimRequests() {
  const user = getCurrentUser();
  if (!canReviewCourtClaimRequests(user)) {
    return { ok: false, error: "Không có quyền duyệt.", code: "FORBIDDEN" };
  }

  if (hasSupabaseConfig()) {
    const rpcResult = await rpcListPendingCourtClaimRequests();
    if (rpcResult.ok) {
      return rpcResult;
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  const requests = loadCourtClaimRequests()
    .filter((item) => item.status === COURT_CLAIM_REQUEST_STATUSES.PENDING)
    .map((item) =>
      normalizeCourtClaimRequest({
        ...item,
        userEmail: item.userEmail || "",
        userDisplayName: item.userDisplayName || item.userId,
      })
    );

  return { ok: true, requests, provider: "local" };
}

function applyLocalClaimApproval(request, actor, reviewNote = "") {
  for (const clusterId of request.clusterIds) {
    const assign = assignUserToCluster(request.userId, clusterId, {
      role: "CLUSTER_OWNER",
      user: actor,
    });
    if (!assign.ok) {
      return assign;
    }
    updateCourtCluster(clusterId, { ownerUserId: request.userId }, { user: actor });
  }

  const requests = loadCourtClaimRequests().map((item) =>
    item.id === request.id
      ? normalizeCourtClaimRequest({
          ...item,
          status: COURT_CLAIM_REQUEST_STATUSES.APPROVED,
          reviewedBy: actor?.id || null,
          reviewedAt: new Date().toISOString(),
          reviewNote,
        })
      : item
  );
  saveCourtClaimRequests(requests);

  return {
    ok: true,
    request: requests.find((item) => item.id === request.id),
    venueId: request.venueId,
  };
}

export async function reviewCourtClaimRequest({
  requestId,
  action,
  reviewNote = "",
} = {}) {
  const actor = getCurrentUser();
  if (!canReviewCourtClaimRequests(actor)) {
    return { ok: false, error: "Không có quyền duyệt.", code: "FORBIDDEN" };
  }

  const normalizedAction = String(action || "").trim().toLowerCase();
  if (!["approve", "reject"].includes(normalizedAction)) {
    return { ok: false, error: "Hành động không hợp lệ.", code: "INVALID_ACTION" };
  }

  if (hasSupabaseConfig()) {
    const rpcResult = await rpcReviewCourtClaimRequest({
      requestId,
      action: normalizedAction,
      reviewNote,
    });
    if (rpcResult.ok) {
      return rpcResult;
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  const request = loadCourtClaimRequests().find((item) => item.id === requestId);
  if (!request) {
    return { ok: false, error: "Không tìm thấy yêu cầu.", code: "REQUEST_NOT_FOUND" };
  }
  if (request.status !== COURT_CLAIM_REQUEST_STATUSES.PENDING) {
    return { ok: false, error: "Yêu cầu không còn pending.", code: "NOT_PENDING" };
  }

  if (normalizedAction === "reject") {
    const requests = loadCourtClaimRequests().map((item) =>
      item.id === requestId
        ? normalizeCourtClaimRequest({
            ...item,
            status: COURT_CLAIM_REQUEST_STATUSES.REJECTED,
            reviewedBy: actor?.id || null,
            reviewedAt: new Date().toISOString(),
            reviewNote,
          })
        : item
    );
    saveCourtClaimRequests(requests);
    return { ok: true, request: requests.find((item) => item.id === requestId), provider: "local" };
  }

  return { ...applyLocalClaimApproval(request, actor, reviewNote), provider: "local" };
}

export async function cancelCourtClaimRequest(requestId) {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  if (hasSupabaseConfig()) {
    const rpcResult = await rpcCancelCourtClaimRequest(requestId);
    if (rpcResult.ok) {
      return rpcResult;
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  const requests = loadCourtClaimRequests();
  const target = requests.find((item) => item.id === requestId && item.userId === user.id);
  if (!target || target.status !== COURT_CLAIM_REQUEST_STATUSES.PENDING) {
    return { ok: false, error: "Không tìm thấy yêu cầu pending.", code: "REQUEST_NOT_FOUND" };
  }

  const next = requests.map((item) =>
    item.id === requestId
      ? normalizeCourtClaimRequest({ ...item, status: COURT_CLAIM_REQUEST_STATUSES.CANCELLED })
      : item
  );
  saveCourtClaimRequests(next);
  return { ok: true, request: next.find((item) => item.id === requestId), provider: "local" };
}

export function isCourtOwnerAwaitingClaim(user = getCurrentUser()) {
  if (!user?.id) {
    return false;
  }
  const role = normalizeRole(user.role);
  const isCourtOwnerIntent =
    role === ROLES.PLAYER ||
    role === ROLES.TENANT_OWNER ||
    role === ROLES.COURT_OWNER;
  if (!isCourtOwnerIntent) {
    return false;
  }
  return !userHasApprovedClusterAssignments(user) && !user?.venueId;
}

export { COURT_CLAIM_REQUEST_STATUSES };

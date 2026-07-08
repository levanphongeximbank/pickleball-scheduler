import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import {
  loadClusterAssignments,
  loadCourtClusters,
  saveClusterAssignments,
  saveCourtClusters,
} from "../../../data/courtCluster.js";
import {
  normalizeClusterAssignment,
  normalizeCourtCluster,
} from "../../../models/courtCluster.js";
import { isCourtClustersEnabled } from "../config/clusterFlags.js";

function mergeClustersIntoLocal(incomingClusters) {
  const byId = new Map(loadCourtClusters().map((cluster) => [cluster.id, cluster]));
  for (const cluster of incomingClusters || []) {
    const normalized = normalizeCourtCluster(cluster);
    if (!normalized.id) {
      continue;
    }
    byId.set(normalized.id, { ...byId.get(normalized.id), ...normalized });
  }
  saveCourtClusters([...byId.values()]);
}

function mergeUserAssignmentsIntoLocal(userId, userAssignments) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return;
  }

  const others = loadClusterAssignments().filter((item) => item.userId !== normalizedUserId);
  const next = [
    ...others,
    ...(userAssignments || []).map((item) => normalizeClusterAssignment(item)),
  ];
  saveClusterAssignments(next);
}

/**
 * Pull cluster assignments + accessible court_clusters from Supabase (RLS) into localStorage.
 */
export async function pullClusterContextForUser(user) {
  if (!user?.id) {
    return { ok: false, code: "NO_USER", error: "Thiếu user." };
  }

  if (!isCourtClustersEnabled()) {
    return { ok: false, code: "FEATURE_DISABLED" };
  }

  if (!hasSupabaseConfig()) {
    return { ok: false, code: "NO_SUPABASE" };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data: assignmentRows, error: assignmentError } = await client
    .from("user_cluster_assignments")
    .select("user_id, cluster_id, role, created_at")
    .eq("user_id", user.id);

  if (assignmentError) {
    return {
      ok: false,
      code: "ASSIGNMENT_FETCH_FAILED",
      error: assignmentError.message,
    };
  }

  const { data: clusterRows, error: clusterError } = await client.from("court_clusters").select("*");

  if (clusterError) {
    return {
      ok: false,
      code: "CLUSTER_FETCH_FAILED",
      error: clusterError.message,
    };
  }

  const assignments = (assignmentRows || []).map((row) => normalizeClusterAssignment(row));
  const clusters = (clusterRows || []).map((row) => normalizeCourtCluster(row));

  mergeClustersIntoLocal(clusters);
  mergeUserAssignmentsIntoLocal(user.id, assignments);

  return {
    ok: true,
    clusters,
    assignments,
    provider: "supabase",
  };
}

export { mergeClustersIntoLocal, mergeUserAssignmentsIntoLocal };

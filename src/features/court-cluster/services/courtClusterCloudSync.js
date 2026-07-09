import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import {
  getActiveClusterId,
  loadClusterAssignments,
  loadCourtClusters,
  saveClusterAssignments,
  saveCourtClusters,
  setActiveClusterId,
} from "../../../data/courtCluster.js";
import {
  normalizeClusterAssignment,
  normalizeCourtCluster,
} from "../../../models/courtCluster.js";
import { isCourtClustersEnabled } from "../config/clusterFlags.js";
import { isLegacyClusterVenueId } from "../utils/clusterCloudResolver.js";
import { isValidProfileUserId } from "../utils/profileUserId.js";

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
  pruneInvalidLocalClusterOwners();

  return {
    ok: true,
    clusters,
    assignments,
    provider: "supabase",
  };
}

export function pruneInvalidLocalClusterOwners() {
  let changedClusters = false;
  let changedAssignments = false;

  const nextClusters = loadCourtClusters().map((cluster) => {
    if (cluster.ownerUserId && !isValidProfileUserId(cluster.ownerUserId)) {
      changedClusters = true;
      return { ...cluster, ownerUserId: null };
    }
    return cluster;
  });

  const nextAssignments = loadClusterAssignments().filter((assignment) => {
    if (!isValidProfileUserId(assignment.userId)) {
      changedAssignments = true;
      return false;
    }
    return true;
  });

  if (changedClusters) {
    saveCourtClusters(nextClusters);
  }
  if (changedAssignments) {
    saveClusterAssignments(nextAssignments);
  }

  return {
    ok: true,
    changedClusters,
    changedAssignments,
  };
}

export function pruneOrphanLocalClusters(currentVenueId) {
  const venueId = String(currentVenueId || "").trim();
  if (!venueId || isLegacyClusterVenueId(venueId)) {
    return { ok: true, removed: 0 };
  }

  const clusters = loadCourtClusters();
  const kept = clusters.filter((cluster) => !isLegacyClusterVenueId(cluster.venueId));
  const removed = clusters.length - kept.length;

  if (removed > 0) {
    saveCourtClusters(kept);

    const keptIds = new Set(kept.map((cluster) => cluster.id));
    const assignments = loadClusterAssignments().filter((item) => keptIds.has(item.clusterId));
    saveClusterAssignments(assignments);
  }

  return { ok: true, removed };
}

export function remapClusterIdLocally(oldClusterId, nextCluster) {
  const normalized = normalizeCourtCluster(nextCluster);
  const clusters = loadCourtClusters().filter((item) => item.id !== oldClusterId);
  const withoutDuplicate = clusters.filter((item) => item.id !== normalized.id);
  withoutDuplicate.push(normalized);
  saveCourtClusters(withoutDuplicate);

  const assignments = loadClusterAssignments().map((item) =>
    item.clusterId === oldClusterId ? { ...item, clusterId: normalized.id } : item
  );
  saveClusterAssignments(assignments);

  if (getActiveClusterId() === oldClusterId) {
    setActiveClusterId(normalized.id);
  }

  return normalized;
}

export { mergeClustersIntoLocal, mergeUserAssignmentsIntoLocal };

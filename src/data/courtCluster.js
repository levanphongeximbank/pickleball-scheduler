import {
  normalizeClusterAssignment,
  normalizeCourtCluster,
} from "../models/courtCluster.js";

const CLUSTERS_KEY = "pickleball-court-clusters-v1";
const ASSIGNMENTS_KEY = "pickleball-user-cluster-assignments-v1";
const ACTIVE_CLUSTER_KEY = "pickleball-active-cluster-v1";

function safeParseArray(raw, fallback = []) {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function loadCourtClusters() {
  return safeParseArray(localStorage.getItem(CLUSTERS_KEY), []).map(normalizeCourtCluster);
}

export function saveCourtClusters(clusters) {
  localStorage.setItem(
    CLUSTERS_KEY,
    JSON.stringify((clusters || []).map(normalizeCourtCluster))
  );
}

export function loadClusterAssignments() {
  return safeParseArray(localStorage.getItem(ASSIGNMENTS_KEY), []).map(
    normalizeClusterAssignment
  );
}

export function saveClusterAssignments(assignments) {
  localStorage.setItem(
    ASSIGNMENTS_KEY,
    JSON.stringify((assignments || []).map(normalizeClusterAssignment))
  );
}

export function getActiveClusterId() {
  return String(localStorage.getItem(ACTIVE_CLUSTER_KEY) || "").trim() || null;
}

export function setActiveClusterId(clusterId) {
  if (!clusterId) {
    localStorage.removeItem(ACTIVE_CLUSTER_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_CLUSTER_KEY, String(clusterId).trim());
}

export function getActiveClusterIdForVenue(venueId) {
  const activeId = getActiveClusterId();
  if (!activeId || !venueId) {
    return activeId;
  }

  const cluster = loadCourtClusters().find((item) => item.id === activeId);
  if (cluster && cluster.venueId === venueId) {
    return activeId;
  }

  return null;
}

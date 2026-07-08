import {
  normalizeClusterAssignment,
  normalizeCourtCluster,
} from "../models/courtCluster.js";

const CLUSTERS_KEY = "pickleball-court-clusters-v1";
const ASSIGNMENTS_KEY = "pickleball-user-cluster-assignments-v1";
const ACTIVE_CLUSTER_KEY = "pickleball-active-cluster-v1";

function getLocalStorage() {
  // Node test environment: `localStorage` may be undefined.
  if (typeof localStorage !== "undefined") return localStorage;
  if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  return null;
}

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
  const ls = getLocalStorage();
  if (!ls) return [];
  return safeParseArray(ls.getItem(CLUSTERS_KEY), []).map(normalizeCourtCluster);
}

export function saveCourtClusters(clusters) {
  const ls = getLocalStorage();
  if (!ls) return;
  ls.setItem(CLUSTERS_KEY, JSON.stringify((clusters || []).map(normalizeCourtCluster)));
}

export function loadClusterAssignments() {
  const ls = getLocalStorage();
  if (!ls) return [];
  return safeParseArray(ls.getItem(ASSIGNMENTS_KEY), []).map(normalizeClusterAssignment);
}

export function saveClusterAssignments(assignments) {
  const ls = getLocalStorage();
  if (!ls) return;
  ls.setItem(
    ASSIGNMENTS_KEY,
    JSON.stringify((assignments || []).map(normalizeClusterAssignment))
  );
}

export function getActiveClusterId() {
  const ls = getLocalStorage();
  if (!ls) return null;
  return String(ls.getItem(ACTIVE_CLUSTER_KEY) || "").trim() || null;
}

export function setActiveClusterId(clusterId) {
  const ls = getLocalStorage();
  if (!clusterId) {
    if (ls) ls.removeItem(ACTIVE_CLUSTER_KEY);
    return;
  }

  if (!ls) return;
  ls.setItem(ACTIVE_CLUSTER_KEY, String(clusterId).trim());
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

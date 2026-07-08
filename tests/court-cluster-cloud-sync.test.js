import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

globalThis.localStorage = createLocalStorageMock();

import {
  loadClusterAssignments,
  loadCourtClusters,
  saveClusterAssignments,
  saveCourtClusters,
} from "../src/data/courtCluster.js";
import {
  mergeClustersIntoLocal,
  mergeUserAssignmentsIntoLocal,
  pullClusterContextForUser,
} from "../src/features/court-cluster/services/courtClusterCloudSync.js";
import { listAccessibleClustersForUser } from "../src/features/court-cluster/services/courtClusterService.js";
import { ROLES } from "../src/auth/roles.js";
import { normalizeCourtCluster } from "../src/models/courtCluster.js";

const USER_ID = "owner-sync-1";
const VENUE_A = "venue-sync-a";

function resetStorage() {
  saveCourtClusters([]);
  saveClusterAssignments([]);
  globalThis.localStorage.clear();
}

describe("court cluster cloud sync", () => {
  beforeEach(() => {
    process.env.VITE_COURT_CLUSTERS_ENABLED = "true";
    if (typeof import.meta !== "undefined" && import.meta.env) {
      import.meta.env.VITE_COURT_CLUSTERS_ENABLED = "true";
    }
    resetStorage();
  });

  it("merges clusters by id without dropping unrelated local rows", () => {
    saveCourtClusters([
      normalizeCourtCluster({ id: "local-only", venueId: VENUE_A, name: "Local" }),
    ]);

    mergeClustersIntoLocal([
      normalizeCourtCluster({ id: "cloud-1", venueId: VENUE_A, name: "Cloud One", address: "123" }),
    ]);

    const clusters = loadCourtClusters();
    assert.equal(clusters.length, 2);
    assert.equal(clusters.find((item) => item.id === "cloud-1")?.address, "123");
    assert.equal(clusters.find((item) => item.id === "local-only")?.name, "Local");
  });

  it("replaces assignments for target user only", () => {
    saveClusterAssignments([
      { userId: USER_ID, clusterId: "old-cluster", role: "CLUSTER_OWNER" },
      { userId: "other-user", clusterId: "shared-cluster", role: "CLUSTER_OWNER" },
    ]);

    mergeUserAssignmentsIntoLocal(USER_ID, [
      { userId: USER_ID, clusterId: "new-cluster", role: "CLUSTER_OWNER" },
    ]);

    const assignments = loadClusterAssignments();
    assert.equal(assignments.length, 2);
    assert.deepEqual(
      assignments.filter((item) => item.userId === USER_ID).map((item) => item.clusterId),
      ["new-cluster"]
    );
    assert.equal(
      assignments.find((item) => item.userId === "other-user")?.clusterId,
      "shared-cluster"
    );
  });

  it("skips pull when supabase is not configured", async () => {
    const result = await pullClusterContextForUser({ id: USER_ID, role: ROLES.PLAYER });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NO_SUPABASE");
  });

  it("listAccessibleClustersForUser sees synced assignments", () => {
    mergeClustersIntoLocal([
      normalizeCourtCluster({ id: "cluster-a", venueId: VENUE_A, name: "Cluster A" }),
    ]);
    mergeUserAssignmentsIntoLocal(USER_ID, [
      { userId: USER_ID, clusterId: "cluster-a", role: "CLUSTER_OWNER" },
    ]);

    const user = { id: USER_ID, role: ROLES.TENANT_OWNER, venueId: VENUE_A, status: "active" };
    const accessible = listAccessibleClustersForUser(user, VENUE_A);
    assert.equal(accessible.length, 1);
    assert.equal(accessible[0].name, "Cluster A");
  });
});

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
  assignUserToCluster,
  canManageCourtClusters,
  canUserAccessCluster,
  createCourtCluster,
  ensureDefaultClusterForVenue,
  filterCourtsByCluster,
  getClusterById,
  isOrgWideClusterRole,
  listAccessibleClustersForUser,
  listClustersForVenue,
  listClustersForAdminManagement,
  ADMIN_ALL_TENANTS_ID,
  setUserClusterAssignments,
  updateCourtCluster,
  isClusterUnassigned,
} from "../src/features/court-cluster/services/courtClusterService.js";
import {
  loadClusterAssignments,
  loadCourtClusters,
  saveClusterAssignments,
  saveCourtClusters,
} from "../src/data/courtCluster.js";
import { ROLES } from "../src/auth/roles.js";
import { canAccessCluster } from "../src/auth/rbac.js";
import { buildDefaultClusterId, normalizeCourtCluster } from "../src/models/courtCluster.js";
import { isValidGoogleMapsUrl } from "../src/features/court-cluster/utils/clusterMapsUtils.js";
import { removeClusterOwner } from "../src/features/court-cluster/services/courtClusterAdminService.js";
import {
  pruneInvalidLocalClusterOwners,
  pruneOrphanLocalClusters,
  remapClusterIdLocally,
} from "../src/features/court-cluster/services/courtClusterCloudSync.js";
import {
  migrateLegacyClusterRecord,
} from "../src/features/court-cluster/utils/clusterCloudResolver.js";

const VENUE_A = "venue-test-a";
const VENUE_B = "venue-test-b";
const OWNER_A = { id: "user-owner-a", role: ROLES.TENANT_OWNER, venueId: VENUE_A, status: "active" };
const OWNER_B = { id: "user-owner-b", role: ROLES.TENANT_OWNER, venueId: VENUE_B, status: "active" };
const PLATFORM_ADMIN = { id: "user-platform", role: ROLES.PLATFORM_ADMIN, status: "active" };
const SYSTEM_TECHNICIAN = { id: "user-tech", role: ROLES.SYSTEM_TECHNICIAN, status: "active" };
const CLUSTER_OWNER = {
  id: "user-cluster-only",
  role: ROLES.CASHIER,
  venueId: VENUE_A,
  status: "active",
};

const VALID_MAPS_URL = "https://www.google.com/maps/dir/?api=1&destination=10.7,106.7";

function resetStorage() {
  saveCourtClusters([]);
  saveClusterAssignments([]);
  globalThis.localStorage.clear();
}

describe("court cluster model", () => {
  beforeEach(() => {
    process.env.VITE_COURT_CLUSTERS_ENABLED = "true";
    if (typeof import.meta !== "undefined" && import.meta.env) {
      import.meta.env.VITE_COURT_CLUSTERS_ENABLED = "true";
    }
    resetStorage();
  });

  it("creates default cluster per venue", () => {
    const result = ensureDefaultClusterForVenue(VENUE_A);
    assert.equal(result.ok, true);
    assert.equal(result.cluster.id, buildDefaultClusterId(VENUE_A));

    const again = ensureDefaultClusterForVenue(VENUE_A);
    assert.equal(again.created, false);
  });

  it("normalizes address and google maps url", () => {
    const cluster = normalizeCourtCluster({
      id: "venue-a-nam-long",
      venueId: VENUE_A,
      name: "Nam Long",
      address: "123 Nam Long",
      google_maps_url: VALID_MAPS_URL,
    });

    assert.equal(cluster.address, "123 Nam Long");
    assert.equal(cluster.googleMapsUrl, VALID_MAPS_URL);
  });

  it("validates google maps url", () => {
    assert.equal(isValidGoogleMapsUrl(VALID_MAPS_URL), true);
    assert.equal(isValidGoogleMapsUrl("javascript:alert(1)"), false);
    assert.equal(isValidGoogleMapsUrl(""), true);
  });

  it("only platform roles can manage clusters", () => {
    assert.equal(canManageCourtClusters(PLATFORM_ADMIN), true);
    assert.equal(canManageCourtClusters(SYSTEM_TECHNICIAN), true);
    assert.equal(canManageCourtClusters(OWNER_A), false);
  });

  it("blocks tenant owner from creating clusters", () => {
    const denied = createCourtCluster({
      venueId: VENUE_A,
      name: "Denied Cluster",
      slug: "denied",
      user: OWNER_A,
    });
    assert.equal(denied.ok, false);
  });

  it("creates named clusters under same venue", () => {
    ensureDefaultClusterForVenue(VENUE_A);
    createCourtCluster({
      venueId: VENUE_A,
      name: "Cụm sân Nam Long",
      slug: "nam-long",
      user: PLATFORM_ADMIN,
    });
    createCourtCluster({
      venueId: VENUE_A,
      name: "Cụm sân Nam Lý",
      slug: "nam-ly",
      user: PLATFORM_ADMIN,
    });

    assert.equal(listClustersForVenue(VENUE_A).length, 3);
  });

  it("system technician can create cluster with location metadata", () => {
    const created = createCourtCluster({
      venueId: VENUE_A,
      name: "Cụm Nam Long",
      slug: "nam-long",
      address: "123 Nam Long, Q.7",
      googleMapsUrl: VALID_MAPS_URL,
      user: SYSTEM_TECHNICIAN,
    });

    assert.equal(created.ok, true);
    assert.equal(created.cluster.address, "123 Nam Long, Q.7");
    assert.equal(created.cluster.googleMapsUrl, VALID_MAPS_URL);
  });

  it("rejects invalid google maps url on update", () => {
    const created = createCourtCluster({
      venueId: VENUE_A,
      name: "Nam Long",
      slug: "nam-long",
      user: PLATFORM_ADMIN,
    });

    const invalid = updateCourtCluster(
      created.cluster.id,
      { googleMapsUrl: "javascript:alert(1)" },
      { user: PLATFORM_ADMIN }
    );
    assert.equal(invalid.ok, false);
  });

  it("assigns multi-cluster owner", () => {
    const c1 = createCourtCluster({
      venueId: VENUE_A,
      name: "Nam Long",
      slug: "nam-long",
      user: PLATFORM_ADMIN,
    });
    const c2 = createCourtCluster({
      venueId: VENUE_A,
      name: "Nam Lý",
      slug: "nam-ly",
      user: PLATFORM_ADMIN,
    });

    setUserClusterAssignments(CLUSTER_OWNER.id, [c1.cluster.id, c2.cluster.id], {
      user: PLATFORM_ADMIN,
    });
    const assigned = loadClusterAssignments().filter((item) => item.userId === CLUSTER_OWNER.id);
    assert.equal(assigned.length, 2);
  });

  it("venue manager sees all venue clusters without assignment", () => {
    createCourtCluster({
      venueId: VENUE_A,
      name: "Nam Long",
      slug: "nam-long",
      user: PLATFORM_ADMIN,
    });
    createCourtCluster({
      venueId: VENUE_A,
      name: "Nam Lý",
      slug: "nam-ly",
      user: PLATFORM_ADMIN,
    });
    const venueManager = {
      id: "venue-mgr-1",
      role: ROLES.VENUE_MANAGER,
      venueId: VENUE_A,
      status: "active",
    };
    assert.equal(listAccessibleClustersForUser(venueManager, VENUE_A).length, 2);
  });

  it("tenant owner without assignment sees no clusters when flag enabled", () => {
    createCourtCluster({
      venueId: VENUE_A,
      name: "Nam Long",
      slug: "nam-long",
      user: PLATFORM_ADMIN,
    });
    assert.equal(listAccessibleClustersForUser(OWNER_A, VENUE_A).length, 0);
  });

  it("cluster-scoped user only sees assigned clusters", () => {
    const c1 = createCourtCluster({
      venueId: VENUE_A,
      name: "Nam Long",
      slug: "nam-long",
      user: PLATFORM_ADMIN,
    });
    createCourtCluster({
      venueId: VENUE_A,
      name: "Nam Lý",
      slug: "nam-ly",
      user: PLATFORM_ADMIN,
    });
    assignUserToCluster(CLUSTER_OWNER.id, c1.cluster.id, { user: PLATFORM_ADMIN });

    const visible = listAccessibleClustersForUser(CLUSTER_OWNER, VENUE_A);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, c1.cluster.id);
  });

  it("blocks cross-venue cluster access", () => {
    const cB = createCourtCluster({
      venueId: VENUE_B,
      name: "Cluster B",
      slug: "b",
      user: PLATFORM_ADMIN,
    });
    assert.equal(canUserAccessCluster(OWNER_A, cB.cluster.id), false);
    assignUserToCluster(OWNER_B.id, cB.cluster.id, { user: PLATFORM_ADMIN });
    assert.equal(canUserAccessCluster(OWNER_B, cB.cluster.id), true);
  });

  it("filters courts by active cluster", () => {
    const courts = [
      { id: "c1", clusterId: "cluster-a" },
      { id: "c2", clusterId: "cluster-b" },
      { id: "c3" },
    ];
    const filtered = filterCourtsByCluster(courts, "cluster-a");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "c1");
  });

  it("rbac canAccessCluster respects assignments", () => {
    const created = createCourtCluster({
      venueId: VENUE_A,
      name: "Nam Long",
      slug: "nam-long",
      user: PLATFORM_ADMIN,
    });
    assignUserToCluster(CLUSTER_OWNER.id, created.cluster.id, { user: PLATFORM_ADMIN });

    assert.equal(
      canAccessCluster(
        { ...CLUSTER_OWNER, assignedClusterIds: [created.cluster.id] },
        created.cluster.id,
        { venueId: VENUE_A },
        { rbacEnabled: true }
      ),
      true
    );

    assert.equal(
      canAccessCluster(OWNER_B, created.cluster.id, { venueId: VENUE_A }, { rbacEnabled: true }),
      false
    );
  });

  it("persists clusters in local registry", () => {
    createCourtCluster({
      venueId: VENUE_A,
      name: "Nam Long",
      slug: "nam-long",
      user: PLATFORM_ADMIN,
    });
    assert.equal(loadCourtClusters().length, 1);
  });

  it("prunes invalid email owner from local cluster", () => {
    saveCourtClusters([
      normalizeCourtCluster({
        id: "bad-cluster",
        venueId: VENUE_A,
        name: "Test",
        slug: "test",
        status: "active",
        ownerUserId: "email@test.com",
      }),
    ]);
    saveClusterAssignments([
      { userId: "email@test.com", clusterId: "bad-cluster", role: "CLUSTER_OWNER" },
    ]);

    const result = pruneInvalidLocalClusterOwners();
    assert.equal(result.changedClusters, true);
    assert.equal(loadCourtClusters()[0].ownerUserId, null);
    assert.equal(loadClusterAssignments().length, 0);
  });

  it("prunes legacy default-tenant clusters when on real venue", () => {
    saveCourtClusters([
      normalizeCourtCluster({
        id: "default-tenant-main",
        venueId: "default-tenant",
        name: "Legacy",
        slug: "main",
        status: "active",
      }),
      normalizeCourtCluster({
        id: `${VENUE_A}-main`,
        venueId: VENUE_A,
        name: "Real",
        slug: "main",
        status: "active",
      }),
    ]);

    const result = pruneOrphanLocalClusters(VENUE_A);
    assert.equal(result.removed, 1);
    assert.equal(loadCourtClusters().length, 1);
    assert.equal(loadCourtClusters()[0].id, `${VENUE_A}-main`);
  });

  it("lists all clusters when admin selects all tenants filter", () => {
    saveCourtClusters([
      normalizeCourtCluster({
        id: `${VENUE_A}-main`,
        venueId: VENUE_A,
        name: "A",
        slug: "main",
        status: "active",
      }),
      normalizeCourtCluster({
        id: `${VENUE_B}-main`,
        venueId: VENUE_B,
        name: "B",
        slug: "main",
        status: "active",
      }),
    ]);

    const listed = listClustersForAdminManagement(PLATFORM_ADMIN, ADMIN_ALL_TENANTS_ID);
    assert.equal(listed.length, 2);
  });

  it("lists all clusters for platform admin when tenant is legacy", () => {
    saveCourtClusters([
      normalizeCourtCluster({
        id: "venue-prod-main-main",
        venueId: VENUE_A,
        name: "Pickleball NAM LONG sports",
        slug: "main",
        status: "active",
      }),
    ]);

    const listed = listClustersForAdminManagement(PLATFORM_ADMIN, "default-tenant");
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, "venue-prod-main-main");
  });

  it("filters clusters for platform admin when tenant is cloud venue", () => {
    saveCourtClusters([
      normalizeCourtCluster({
        id: `${VENUE_A}-main`,
        venueId: VENUE_A,
        name: "A",
        slug: "main",
        status: "active",
      }),
      normalizeCourtCluster({
        id: `${VENUE_B}-main`,
        venueId: VENUE_B,
        name: "B",
        slug: "main",
        status: "active",
      }),
    ]);

    const listed = listClustersForAdminManagement(PLATFORM_ADMIN, VENUE_A);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].venueId, VENUE_A);
  });

  it("migrates legacy default-tenant-main to cloud venue id", () => {
    const legacy = normalizeCourtCluster({
      id: "default-tenant-main",
      venueId: "default-tenant",
      name: "Pickleball NAM LONG sports",
      slug: "main",
      status: "active",
    });

    const migrated = migrateLegacyClusterRecord(legacy, VENUE_A);
    assert.equal(migrated.id, `${VENUE_A}-main`);
    assert.equal(migrated.venueId, VENUE_A);

    remapClusterIdLocally(legacy.id, migrated);
    assert.equal(getClusterById(`${VENUE_A}-main`)?.name, "Pickleball NAM LONG sports");
    assert.equal(getClusterById("default-tenant-main"), null);
  });

  it("removeClusterOwner clears local assignment", async () => {
    const created = createCourtCluster({
      venueId: VENUE_A,
      name: "Owned",
      slug: "owned",
      user: PLATFORM_ADMIN,
    });
    assignUserToCluster(CLUSTER_OWNER.id, created.cluster.id, { user: PLATFORM_ADMIN });
    updateCourtCluster(
      created.cluster.id,
      { ownerUserId: CLUSTER_OWNER.id },
      { user: PLATFORM_ADMIN }
    );

    const result = await removeClusterOwner({
      clusterId: created.cluster.id,
      actor: PLATFORM_ADMIN,
    });
    assert.equal(result.ok, true);
    assert.equal(isClusterUnassigned(created.cluster.id), true);
  });
});

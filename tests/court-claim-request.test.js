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
  createCourtCluster,
  isClusterUnassigned,
  listUnassignedClusters,
} from "../src/features/court-cluster/services/courtClusterService.js";
import {
  loadClusterAssignments,
  saveClusterAssignments,
  saveCourtClusters,
} from "../src/data/courtCluster.js";
import {
  loadCourtClaimRequests,
  saveCourtClaimRequests,
} from "../src/features/court-cluster/storage/courtClaimRequestStorage.js";
import {
  isCourtOwnerAwaitingClaim,
  reviewCourtClaimRequest,
  submitCourtClaimRequest,
  userHasApprovedClusterAssignments,
} from "../src/features/court-cluster/services/courtClaimRequestService.js";
import { ROLES } from "../src/auth/roles.js";
import { enableRbac, signInAs } from "../src/auth/authService.js";
import { createUserRecord } from "../src/models/user.js";

const VENUE_A = "venue-claim-a";
const ADMIN = createUserRecord({ id: "admin-1", role: ROLES.SUPER_ADMIN, status: "active" });
const OWNER = createUserRecord({
  id: "owner-claim-1",
  role: ROLES.PLAYER,
  email: "owner@claim.test",
  status: "active",
});

function resetStorage() {
  saveCourtClusters([]);
  saveClusterAssignments([]);
  saveCourtClaimRequests([]);
  globalThis.localStorage.clear();
}

describe("court claim request", () => {
  beforeEach(() => {
    process.env.VITE_COURT_CLUSTERS_ENABLED = "true";
    if (typeof import.meta !== "undefined" && import.meta.env) {
      import.meta.env.VITE_COURT_CLUSTERS_ENABLED = "true";
    }
    resetStorage();
    enableRbac();
    signInAs(OWNER);
  });

  it("lists unassigned clusters only", () => {
    createCourtCluster({
      venueId: VENUE_A,
      name: "Cụm trống",
      user: ADMIN,
    });
    const assigned = createCourtCluster({
      venueId: VENUE_A,
      name: "Cụm đã gán",
      user: ADMIN,
    });
    assignUserToCluster("other-user", assigned.cluster.id, { user: ADMIN });

    const unassigned = listUnassignedClusters();
    assert.equal(unassigned.length, 1);
    assert.equal(unassigned[0].name, "Cụm trống");
    assert.equal(isClusterUnassigned(unassigned[0].id), true);
    assert.equal(isClusterUnassigned(assigned.cluster.id), false);
  });

  it("blocks mixed venue selection on submit", async () => {
    const c1 = createCourtCluster({ venueId: VENUE_A, name: "A1", user: ADMIN });
    const c2 = createCourtCluster({ venueId: "venue-claim-b", name: "B1", user: ADMIN });

    const result = await submitCourtClaimRequest({
      clusterIds: [c1.cluster.id, c2.cluster.id],
      message: "xin gắn",
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "MIXED_VENUE_NOT_ALLOWED");
  });

  it("submits and approves claim locally", async () => {
    const c1 = createCourtCluster({ venueId: VENUE_A, name: "Nam Long", user: ADMIN });
    const c2 = createCourtCluster({ venueId: VENUE_A, name: "Nam Lý", user: ADMIN });

    const submit = await submitCourtClaimRequest({
      clusterIds: [c1.cluster.id, c2.cluster.id],
      message: "Tôi là chủ hai cụm",
    });
    assert.equal(submit.ok, true);
    assert.equal(submit.request.status, "pending");

    signInAs(ADMIN);
    const review = await reviewCourtClaimRequest({
      requestId: submit.request.id,
      action: "approve",
      reviewNote: "OK",
    });
    assert.equal(review.ok, true);
    assert.equal(review.request.status, "approved");

    signInAs(OWNER);
    assert.equal(userHasApprovedClusterAssignments(OWNER), true);
    assert.equal(isCourtOwnerAwaitingClaim(OWNER), false);

    const assignments = loadClusterAssignments().filter((item) => item.userId === OWNER.id);
    assert.equal(assignments.length, 2);
  });

  it("rejects duplicate pending request", async () => {
    const c1 = createCourtCluster({ venueId: VENUE_A, name: "Only", user: ADMIN });
    const first = await submitCourtClaimRequest({ clusterIds: [c1.cluster.id] });
    assert.equal(first.ok, true);

    const second = await submitCourtClaimRequest({ clusterIds: [c1.cluster.id] });
    assert.equal(second.ok, false);
    assert.equal(second.code, "DUPLICATE_PENDING");
  });

  it("allows additional claim when user already owns a cluster", async () => {
    const owned = createCourtCluster({ venueId: VENUE_A, name: "Owned", user: ADMIN });
    const extra = createCourtCluster({ venueId: VENUE_A, name: "Extra", user: ADMIN });
    assignUserToCluster(OWNER.id, owned.cluster.id, { user: ADMIN, role: "CLUSTER_OWNER" });

    const result = await submitCourtClaimRequest({ clusterIds: [extra.cluster.id] });
    assert.equal(result.ok, true);
    assert.equal(result.request.status, "pending");
    assert.deepEqual(result.request.clusterIds, [extra.cluster.id]);
  });

  it("blocks claiming a cluster the user already owns", async () => {
    const owned = createCourtCluster({ venueId: VENUE_A, name: "Owned again", user: ADMIN });
    assignUserToCluster(OWNER.id, owned.cluster.id, { user: ADMIN, role: "CLUSTER_OWNER" });

    const result = await submitCourtClaimRequest({ clusterIds: [owned.cluster.id] });
    assert.equal(result.ok, false);
    assert.equal(result.code, "ALREADY_OWNED");
  });
});

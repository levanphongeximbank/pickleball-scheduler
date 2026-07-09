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
} from "../src/features/court-cluster/services/courtClusterService.js";
import { saveCourtClusters } from "../src/data/courtCluster.js";
import { loadVenues } from "../src/data/venue.js";
import {
  cacheRegisterableClusterLocally,
  listRegisterableClusters,
  listRegisterableClustersLocal,
} from "../src/features/court-cluster/services/courtClusterDiscoveryService.js";
import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";

const VENUE_A = "venue-prod-main";
const ADMIN = createUserRecord({ id: "admin-1", role: ROLES.SUPER_ADMIN, status: "active" });

function resetStorage() {
  saveCourtClusters([]);
  globalThis.localStorage.clear();
}

describe("court cluster discovery for club registration", () => {
  beforeEach(() => {
    resetStorage();
  });

  it("listRegisterableClustersLocal returns all active clusters including assigned", () => {
    const free = createCourtCluster({
      venueId: VENUE_A,
      name: "Pickleball NAM LONG sports",
      user: ADMIN,
    });
    const assigned = createCourtCluster({
      venueId: VENUE_A,
      name: "Cụm đã có chủ",
      user: ADMIN,
    });
    assignUserToCluster("owner-1", assigned.cluster.id, { user: ADMIN });

    const all = listRegisterableClustersLocal();
    assert.equal(all.length, 2);
    assert.ok(all.some((item) => item.id === free.cluster.id));
    assert.ok(all.some((item) => item.id === assigned.cluster.id));
  });

  it("listRegisterableClustersLocal filters by search term", () => {
    createCourtCluster({
      venueId: VENUE_A,
      name: "Pickleball NAM LONG sports",
      user: ADMIN,
    });
    createCourtCluster({
      venueId: VENUE_A,
      name: "Cụm Nam Lý",
      user: ADMIN,
    });

    const matches = listRegisterableClustersLocal({ search: "nam long" });
    assert.equal(matches.length, 1);
    assert.equal(matches[0].name, "Pickleball NAM LONG sports");
  });

  it("listRegisterableClusters falls back to local when Supabase unavailable", async () => {
    createCourtCluster({
      venueId: VENUE_A,
      name: "Cloud fallback cluster",
      user: ADMIN,
    });

    const result = await listRegisterableClusters({ search: "fallback" });
    assert.equal(result.ok, true);
    assert.equal(result.provider, "local");
    assert.equal(result.clusters.length, 1);
    assert.equal(result.clusters[0].name, "Cloud fallback cluster");
  });

  it("cacheRegisterableClusterLocally mirrors cluster and venue", async () => {
    const cluster = {
      id: "venue-prod-main-main",
      venueId: VENUE_A,
      venueName: "Sân Nam Long",
      name: "Pickleball NAM LONG sports",
      slug: "main",
      status: "active",
      address: "123 Test St",
    };

    const result = await cacheRegisterableClusterLocally(cluster);
    assert.equal(result.ok, true);

    const venues = loadVenues();
    assert.ok(venues.some((item) => item.id === VENUE_A));
    assert.equal(venues.find((item) => item.id === VENUE_A)?.name, "Sân Nam Long");

    const cached = await listRegisterableClustersLocal({ search: "nam long" });
    assert.equal(cached.length, 1);
    assert.equal(cached[0].id, "venue-prod-main-main");
  });
});

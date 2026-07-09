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

import { loadClubs, saveClubs } from "../src/data/club.js";
import { createClubRecord } from "../src/models/club.js";
import {
  cloudRowToClubRecord,
  mergeClubsIntoLocal,
  listLocalClubsEligibleForCloudPush,
} from "../src/features/club/services/clubRegistryCloudSync.js";

const VENUE = "venue-prod-main";
const PRESIDENT = "6e90bbf2-556c-4052-a5f6-effeec7cd1cc";

describe("club registry cloud sync", () => {
  beforeEach(() => {
    localStorage.clear();
    saveClubs([]);
  });

  it("maps cloud row to local club record", () => {
    const club = cloudRowToClubRecord({
      club_id: "club-accc-1",
      venue_id: VENUE,
      name: "CLB ACCC",
      code: "ACCC",
      description: "Pickleball club",
      status: "active",
      owner_user_id: null,
      president_user_id: PRESIDENT,
      vice_president_user_id: null,
      registered_cluster_id: "venue-prod-main-main",
      registered_court_ids: [],
      venue_name: "Pickleball Scheduler Production",
    });

    assert.equal(club.id, "club-accc-1");
    assert.equal(club.name, "CLB ACCC");
    assert.equal(club.venueId, VENUE);
    assert.equal(club.governance.presidentUserId, PRESIDENT);
    assert.equal(club.governance.registeredClusterId, "venue-prod-main-main");
  });

  it("merges cloud clubs into local registry without dropping existing", () => {
    saveClubs([
      createClubRecord("Local only", {
        id: "club-local",
        venueId: VENUE,
        governance: { presidentUserId: PRESIDENT },
      }),
    ]);

    mergeClubsIntoLocal([
      {
        club_id: "club-accc-1",
        venue_id: VENUE,
        name: "CLB ACCC",
        status: "active",
        president_user_id: PRESIDENT,
        registered_court_ids: [],
      },
    ]);

    const clubs = loadClubs().filter((club) => !club.isDefault);
    assert.equal(clubs.length, 2);
    assert.ok(clubs.some((club) => club.id === "club-accc-1"));
    assert.ok(clubs.some((club) => club.id === "club-local"));
  });

  it("cloud registry overwrites stale local name for same club id", () => {
    saveClubs([
      createClubRecord("Old name", {
        id: "club-accc-1",
        venueId: VENUE,
        governance: { presidentUserId: PRESIDENT },
      }),
    ]);

    mergeClubsIntoLocal([
      {
        club_id: "club-accc-1",
        venue_id: VENUE,
        name: "CLB ACCC",
        status: "active",
        president_user_id: PRESIDENT,
        registered_court_ids: [],
      },
    ]);

    const club = loadClubs().find((item) => item.id === "club-accc-1");
    assert.equal(club?.name, "CLB ACCC");
  });

  it("lists president-owned clubs eligible for cloud push", () => {
    const presidentId = "6e90bbf2-556c-4052-a5f6-effeec7cd1cc";
    saveClubs([
      createClubRecord("CLB ACCC", {
        id: "club-accc",
        venueId: VENUE,
        governance: { presidentUserId: presidentId },
      }),
      createClubRecord("No president", {
        id: "club-bad",
        venueId: VENUE,
        governance: { presidentUserId: "legacy-email" },
      }),
    ]);

    const eligible = listLocalClubsEligibleForCloudPush({
      id: presidentId,
      role: "CLUB_MANAGER",
    });
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, "club-accc");
  });
});

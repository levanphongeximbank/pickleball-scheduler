import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { loadClubs, saveClubs } from "../src/data/club.js";
import { saveVenues } from "../src/data/venue.js";
import { createClubRecord } from "../src/models/club.js";
import { createTenantRecord, TENANT_STATUS } from "../src/models/tenant.js";
import {
  getClubsByTenant,
  createClub,
  getClubById,
} from "../src/features/club/index.js";
import {
  getClubMembers,
  addMemberToClub,
} from "../src/features/club/services/clubMemberService.js";
import { buildClubManagementView } from "../src/pages/clubManagement.logic.js";
import { getClubRatings, updateClubRating } from "../src/features/club/services/clubRatingService.js";
import { createFriendlyClubMatch } from "../src/features/club/services/clubActivityService.js";
import { saveClubData, getDefaultClubData } from "../src/domain/clubStorage.js";
import { normalizePlayers } from "../src/models/player.js";

const TENANT_A = "tenant-test-club-mgmt";
const TENANT_B = "tenant-test-club-mgmt-b";
const CLUB_A = "club-test-a";
const CLUB_B = "club-test-b";

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

function resetStorage() {
  saveVenues([
    createTenantRecord({ id: TENANT_A, name: "Tenant A", status: TENANT_STATUS.ACTIVE }),
    createTenantRecord({ id: TENANT_B, name: "Tenant B", status: TENANT_STATUS.ACTIVE }),
  ]);
  saveClubs([
    createClubRecord("CLB Test A", { id: CLUB_A, tenantId: TENANT_A, venueId: TENANT_A }),
    createClubRecord("CLB Test B", { id: CLUB_B, tenantId: TENANT_B, venueId: TENANT_B }),
  ]);

  const playersA = normalizePlayers([
    { id: "player-a1", name: "Player A1", tenantId: TENANT_A, level: 3.5, status: "active", active: true },
    { id: "player-a2", name: "Player A2", tenantId: TENANT_A, level: 4, status: "active", active: true },
  ]);
  saveClubData(CLUB_A, { ...getDefaultClubData(CLUB_A), players: playersA, tenantId: TENANT_A });

  const playersB = normalizePlayers([
    { id: "player-b1", name: "Player B1", tenantId: TENANT_B, level: 3, status: "active", active: true },
  ]);
  saveClubData(CLUB_B, { ...getDefaultClubData(CLUB_B), players: playersB, tenantId: TENANT_B });
}

describe("club management sprint 3", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    resetStorage();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("lists clubs scoped by tenant", () => {
    const tenantAClubs = getClubsByTenant(TENANT_A);
    assert.equal(tenantAClubs.length, 1);
    assert.equal(tenantAClubs[0].id, CLUB_A);

    const tenantBClubs = getClubsByTenant(TENANT_B);
    assert.equal(tenantBClubs.length, 1);
    assert.equal(tenantBClubs[0].id, CLUB_B);
  });

  it("does not expose cross-tenant club by id", () => {
    const club = getClubById(CLUB_A, TENANT_B);
    assert.equal(club, null);
  });

  it("syncs members from club blob players", () => {
    const members = getClubMembers(CLUB_A, TENANT_A);
    assert.equal(members.length, 2);
    assert.ok(members.some((m) => m.playerId === "player-a1"));
  });

  it("creates default rating when syncing members from blob", () => {
    getClubMembers(CLUB_A, TENANT_A);
    const ratings = getClubRatings(CLUB_A, TENANT_A);
    const rating = ratings.find((r) => r.playerId === "player-a1");
    assert.ok(rating);
    assert.equal(rating.elo, 1500);
  });

  it("rejects adding player from another tenant", () => {
    const result = addMemberToClub(CLUB_A, "player-b1", TENANT_A);
    assert.equal(result.ok, false);
  });

  it("allows player in multiple clubs within same tenant", () => {
    const clubC = createClubRecord("CLB Test C", {
      id: "club-test-c",
      tenantId: TENANT_A,
      venueId: TENANT_A,
    });
    saveClubs([...loadClubs(), clubC]);
    saveClubData("club-test-c", { ...getDefaultClubData("club-test-c"), players: [], tenantId: TENANT_A });

    const result = addMemberToClub("club-test-c", "player-a1", TENANT_A);
    assert.equal(result.ok, true);

    const membersA = getClubMembers(CLUB_A, TENANT_A);
    const membersC = getClubMembers("club-test-c", TENANT_A);
    assert.ok(membersA.some((m) => m.playerId === "player-a1"));
    assert.ok(membersC.some((m) => m.playerId === "player-a1"));
  });

  it("records elo history on manual update", () => {
    getClubMembers(CLUB_A, TENANT_A);
    const result = updateClubRating(CLUB_A, "player-a1", 1600, "Test adjust", TENANT_A);
    assert.equal(result.ok, true);
    assert.equal(result.rating.elo, 1600);
    assert.equal(result.history.oldElo, 1500);
    assert.equal(result.history.newElo, 1600);
  });

  it("createClub validates duplicate name in tenant", () => {
    const result = createClub({
      name: "CLB Test A",
      tenantId: TENANT_A,
      governance: { presidentUserId: "president-a" },
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /tồn tại/i);
  });

  it("friendly match updates club elo", () => {
    getClubMembers(CLUB_A, TENANT_A);

    const result = createFriendlyClubMatch(
      CLUB_A,
      {
        teamAPlayerIds: ["player-a1"],
        teamBPlayerIds: ["player-a2"],
        teamAScore: 11,
        teamBScore: 5,
      },
      TENANT_A
    );
    assert.equal(result.ok, true);

    const ratings = getClubRatings(CLUB_A, TENANT_A);
    const winner = ratings.find((r) => r.playerId === "player-a1");
    const loser = ratings.find((r) => r.playerId === "player-a2");
    assert.ok(winner.elo > 1500);
    assert.ok(loser.elo < 1500);
  });

  it("builds polished club overview cards for the new UI", () => {
    const view = buildClubManagementView({
      clubs: [{ id: CLUB_A, name: "CLB Test A" }],
      activeClubId: CLUB_A,
      summary: {
        totals: {
          players: 12,
          courts: 4,
          activeCourts: 3,
          seasons: 2,
          leagues: 5,
          sessions: 8,
          rounds: 6,
        },
      },
      seasons: [],
      leagues: [],
    });

    assert.equal(view.overviewCards[0].label, "Người chơi");
    assert.equal(view.overviewCards[0].value, 12);
    assert.equal(view.overviewCards[1].value, "3/4");
    assert.equal(view.overviewCards[2].value, "2 / 5");
  });
});

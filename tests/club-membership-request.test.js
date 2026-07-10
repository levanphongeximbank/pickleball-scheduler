import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { loadClubs, saveClubs } from "../src/data/club.js";
import { createClubRecord } from "../src/models/club.js";
import { enableRbac } from "../src/auth/authService.js";
import { ROLES } from "../src/auth/roles.js";
import { CLUB_STATUSES } from "../src/features/club/constants/clubStatus.js";
import { CLUB_MEMBERSHIP_REQUEST_STATUSES } from "../src/features/club/constants/clubMembershipRequestStatuses.js";
import {
  submitClubMembershipRequest,
  listPendingMembershipRequests,
  approveClubMembershipRequest,
  rejectClubMembershipRequest,
  listMyMembershipRequests,
  listDiscoverableClubs,
  getClubDiscoverySummary,
  listMyMembershipRequestsAll,
  canApproveClubMembershipRequests,
  leaveMyClub,
} from "../src/features/club/index.js";
import { loadPlayersForClub } from "../src/domain/clubStorage.js";
import { getClubMembers } from "../src/features/club/services/clubMemberService.js";
import { loadAthleteClubLink } from "../src/features/club/storage/athleteClubLinkStore.js";
import { loadClubExtension } from "../src/features/club/storage/clubExtensionStorage.js";
import { CLUB_MEMBER_STATUSES } from "../src/features/club/constants/clubMemberRoles.js";

const TENANT = "tenant-membership-test";
const CLUB_ID = "club-membership-test";
const ATHLETE_ID = "athlete-user-1";
const PRESIDENT_ID = "user-president";
const VICE_ID = "user-vice";
const VENUE_OWNER_ID = "venue-owner-other";

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

function forceLocalMembershipStorage() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_CLUB_STORAGE_V2 = "false";
  }
}

function makeClub(overrides = {}) {
  return createClubRecord("CLB Membership Test", {
    id: CLUB_ID,
    tenantId: TENANT,
    venueId: TENANT,
    status: CLUB_STATUSES.ACTIVE,
    governance: {
      presidentUserId: PRESIDENT_ID,
      ownerUserId: "user-owner",
      vicePresidentUserId: VICE_ID,
      registeredCourtIds: [],
    },
    ...overrides,
  });
}

function seedClub() {
  saveClubs([makeClub()]);
}

describe("club membership requests", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    forceLocalMembershipStorage();
    seedClub();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("athlete submits request when no club", async () => {
    const athlete = {
      id: ATHLETE_ID,
      role: ROLES.PLAYER,
      displayName: "VĐV Test",
      tenantId: TENANT,
    };

    const result = await submitClubMembershipRequest(CLUB_ID, TENANT, athlete, {
      message: "Muốn tham gia CLB",
    });

    assert.equal(result.ok, true);
    assert.equal(result.request.status, CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING);

    const mine = listMyMembershipRequests(TENANT, ATHLETE_ID);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].clubId, CLUB_ID);
  });

  it("blocks submit when athlete already has club", async () => {
    const athlete = {
      id: ATHLETE_ID,
      role: ROLES.PLAYER,
      clubId: "other-club",
      tenantId: TENANT,
    };

    const result = await submitClubMembershipRequest(CLUB_ID, TENANT, athlete);
    assert.equal(result.ok, false);
  });

  it("blocks duplicate pending request", async () => {
    const athlete = { id: ATHLETE_ID, role: ROLES.PLAYER, tenantId: TENANT };
    assert.equal((await submitClubMembershipRequest(CLUB_ID, TENANT, athlete)).ok, true);
    const duplicate = await submitClubMembershipRequest(CLUB_ID, TENANT, athlete);
    assert.equal(duplicate.ok, false);
  });

  it("president can approve and creates player + member + profile link", async () => {
    const athlete = { id: ATHLETE_ID, role: ROLES.PLAYER, displayName: "VĐV Test", tenantId: TENANT };
    const submit = await submitClubMembershipRequest(CLUB_ID, TENANT, athlete);
    assert.equal(submit.ok, true);

    const president = {
      id: PRESIDENT_ID,
      role: ROLES.CLUB_MANAGER,
      clubId: CLUB_ID,
      tenantId: TENANT,
    };
    const club = makeClub();
    assert.equal(canApproveClubMembershipRequests(president, club), true);

    const pending = await listPendingMembershipRequests(CLUB_ID, TENANT, president);
    assert.equal(pending.length, 1);

    const approved = await approveClubMembershipRequest(CLUB_ID, pending[0].id, TENANT, {
      user: president,
    });
    assert.equal(approved.ok, true);

    const players = loadPlayersForClub(CLUB_ID);
    assert.ok(players.some((player) => player.authUserId === ATHLETE_ID));

    const members = getClubMembers(CLUB_ID, TENANT, {
      user: president,
      skipGovernanceGuard: false,
    });
    assert.ok(members.some((member) => member.status === "active"));

    const link = loadAthleteClubLink(ATHLETE_ID);
    assert.equal(link.clubId, CLUB_ID);
    assert.ok(link.playerId);
  });

  it("vice president can approve", async () => {
    const athlete = { id: "athlete-vice", role: ROLES.PLAYER, displayName: "VP Athlete", tenantId: TENANT };
    await submitClubMembershipRequest(CLUB_ID, TENANT, athlete);

    const vice = { id: VICE_ID, role: ROLES.CLUB_MANAGER, clubId: CLUB_ID, tenantId: TENANT };
    const pending = await listPendingMembershipRequests(CLUB_ID, TENANT, vice);
    const approved = await approveClubMembershipRequest(CLUB_ID, pending[0].id, TENANT, {
      user: vice,
    });
    assert.equal(approved.ok, true);
  });

  it("staff without review permission cannot approve", async () => {
    const staff = { id: VENUE_OWNER_ID, role: ROLES.STAFF, venueId: TENANT };
    const club = makeClub();
    assert.equal(canApproveClubMembershipRequests(staff, club), false);
    assert.equal((await listPendingMembershipRequests(CLUB_ID, TENANT, staff)).length, 0);
  });

  it("reject updates request status", async () => {
    const athlete = { id: "athlete-reject", role: ROLES.PLAYER, displayName: "Reject Me", tenantId: TENANT };
    await submitClubMembershipRequest(CLUB_ID, TENANT, athlete);

    const president = { id: PRESIDENT_ID, role: ROLES.CLUB_MANAGER, clubId: CLUB_ID };
    const pending = await listPendingMembershipRequests(CLUB_ID, TENANT, president);
    const rejected = await rejectClubMembershipRequest(CLUB_ID, pending[0].id, TENANT, {
      user: president,
      reviewNote: "Chưa đủ điều kiện",
    });

    assert.equal(rejected.ok, true);
    assert.equal(rejected.request.status, CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED);

    const ext = loadClubExtension(CLUB_ID);
    const stored = ext.membershipRequests.find((request) => request.id === pending[0].id);
    assert.equal(stored.reviewNote, "Chưa đủ điều kiện");
  });

  it("listDiscoverableClubs returns active clubs across tenants", () => {
    const otherTenantClub = createClubRecord("CLB Other Tenant", {
      id: "club-other-tenant",
      tenantId: "tenant-other",
      venueId: "tenant-other",
      status: CLUB_STATUSES.ACTIVE,
      governance: { presidentUserId: "pres-other" },
    });
    saveClubs([makeClub(), otherTenantClub]);

    const discoverable = listDiscoverableClubs();
    assert.ok(discoverable.some((club) => club.id === CLUB_ID));
    assert.ok(discoverable.some((club) => club.id === "club-other-tenant"));
  });

  it("getClubDiscoverySummary works for athlete without club membership", () => {
    const summary = getClubDiscoverySummary(CLUB_ID);
    assert.ok(summary);
    assert.equal(summary.name, "CLB Membership Test");
    assert.equal(summary.activeMemberCount, 0);
    if (summary.clusterLabel != null) {
      assert.equal(typeof summary.clusterLabel, "string");
    }
  });

  it("listMyMembershipRequestsAll scans all discoverable clubs", async () => {
    const athlete = { id: ATHLETE_ID, role: ROLES.PLAYER, displayName: "VĐV Test", tenantId: TENANT };
    await submitClubMembershipRequest(CLUB_ID, TENANT, athlete);

    const mine = listMyMembershipRequestsAll(ATHLETE_ID);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].clubId, CLUB_ID);
  });

  it("player without tenant can submit when RBAC enabled", async () => {
    enableRbac(true);
    try {
      const athlete = {
        id: "athlete-no-tenant",
        role: ROLES.PLAYER,
        displayName: "No Tenant Athlete",
      };

      const result = await submitClubMembershipRequest(CLUB_ID, TENANT, athlete);
      assert.equal(result.ok, true);
      assert.equal(result.request.clubId, CLUB_ID);
    } finally {
      enableRbac(false);
    }
  });

  it("submit resolves club tenant when athlete tenant differs", async () => {
    const otherTenantClub = createClubRecord("CLB Cross Tenant", {
      id: "club-cross-tenant",
      tenantId: "tenant-other",
      venueId: "tenant-other",
      status: CLUB_STATUSES.ACTIVE,
      governance: { presidentUserId: "pres-cross" },
    });
    saveClubs([makeClub(), otherTenantClub]);

    const athlete = {
      id: "athlete-cross",
      role: ROLES.PLAYER,
      displayName: "Cross Tenant Athlete",
      tenantId: TENANT,
    };

    const result = await submitClubMembershipRequest("club-cross-tenant", TENANT, athlete);
    assert.equal(result.ok, true);
    assert.equal(result.request.clubId, "club-cross-tenant");
  });

  it("member can leave club and clears athlete link", async () => {
    const athlete = { id: ATHLETE_ID, role: ROLES.PLAYER, displayName: "VĐV Test", tenantId: TENANT };
    await submitClubMembershipRequest(CLUB_ID, TENANT, athlete);

    const president = { id: PRESIDENT_ID, role: ROLES.CLUB_MANAGER, clubId: CLUB_ID, tenantId: TENANT };
    const pending = await listPendingMembershipRequests(CLUB_ID, TENANT, president);
    const approved = await approveClubMembershipRequest(CLUB_ID, pending[0].id, TENANT, {
      user: president,
    });
    assert.equal(approved.ok, true);

    const link = loadAthleteClubLink(ATHLETE_ID);
    const memberUser = {
      id: ATHLETE_ID,
      role: ROLES.PLAYER,
      clubId: CLUB_ID,
      playerId: link.playerId,
      tenantId: TENANT,
    };

    const left = await leaveMyClub({ user: memberUser, tenantId: TENANT });
    assert.equal(left.ok, true);

    const cleared = loadAthleteClubLink(ATHLETE_ID);
    assert.equal(cleared.clubId, null);
    assert.equal(cleared.playerId, null);

    const ext = loadClubExtension(CLUB_ID);
    const member = ext.members.find((item) => item.playerId === link.playerId);
    assert.equal(member.status, CLUB_MEMBER_STATUSES.INACTIVE);
  });

  it("president cannot leave club without transferring role", async () => {
    const president = {
      id: PRESIDENT_ID,
      role: ROLES.CLUB_MANAGER,
      clubId: CLUB_ID,
      playerId: "player-president",
      tenantId: TENANT,
    };

    const result = await leaveMyClub({ user: president, tenantId: TENANT });
    assert.equal(result.ok, false);
    assert.match(result.error, /Chuyển vai trò/);
  });

  it("PLAYER president without tenantId can list pending requests", async () => {
    const athlete = {
      id: ATHLETE_ID,
      role: ROLES.PLAYER,
      displayName: "VĐV Test",
      tenantId: TENANT,
    };
    assert.equal((await submitClubMembershipRequest(CLUB_ID, TENANT, athlete)).ok, true);

    const president = {
      id: PRESIDENT_ID,
      role: ROLES.PLAYER,
      clubId: CLUB_ID,
      playerId: "player-president",
    };
    const club = makeClub();
    assert.equal(canApproveClubMembershipRequests(president, club), true);

    const pending = await listPendingMembershipRequests(CLUB_ID, TENANT, president);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].userId, ATHLETE_ID);
  });
});

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { loadClubs, saveClubs } from "../src/data/club.js";
import { createClubRecord } from "../src/models/club.js";
import { ROLES } from "../src/auth/roles.js";
import { enableRbac } from "../src/auth/authService.js";
import { saveAuthSession } from "../src/auth/authStorage.js";
import { CLUB_STATUSES } from "../src/features/club/constants/clubStatus.js";
import {
  canViewFullClubMembers,
  canViewClubMemberSummary,
  isClubOwner,
  canAssignClubOwner,
  canChangeClubPresident,
  canDeleteClub,
  canDeleteClubMembers,
  getClubMembers,
  getClubMembersForTournamentInvite,
  resolveGovernanceForCreate,
  canApproveClubRegistration,
  approveClubRegistration,
  rejectClubRegistration,
  getRegisteredClusterLabel,
  updateClubGovernance,
} from "../src/features/club/index.js";
import { deleteClub } from "../src/domain/clubService.js";
import { saveClubData, getDefaultClubData } from "../src/domain/clubStorage.js";
import { normalizePlayers } from "../src/models/player.js";
import {
  createCourtCluster,
  ensureDefaultClusterForVenue,
} from "../src/features/court-cluster/services/courtClusterService.js";
import { saveClusterAssignments, saveCourtClusters } from "../src/data/courtCluster.js";
import { ROLES as CLUSTER_ROLES } from "../src/auth/roles.js";

const TENANT = "tenant-gov-test";
const CLUB_ID = "club-gov-test";
const PLATFORM_ADMIN = { id: "platform-admin", role: CLUSTER_ROLES.PLATFORM_ADMIN, status: "active" };
let clusterNamLongId = "";

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

function makeClub(overrides = {}) {
  return createClubRecord("CLB Governance", {
    id: CLUB_ID,
    tenantId: TENANT,
    venueId: TENANT,
    governance: {
      presidentUserId: "user-president",
      ownerUserId: "user-owner",
      vicePresidentUserId: null,
      registeredCourtIds: [],
    },
    ...overrides,
  });
}

function seedCluster() {
  saveCourtClusters([]);
  saveClusterAssignments([]);
  ensureDefaultClusterForVenue(TENANT);
  const result = createCourtCluster({
    venueId: TENANT,
    name: "Cụm sân Nam Long",
    slug: "nam-long",
    user: PLATFORM_ADMIN,
  });
  clusterNamLongId = result.cluster.id;
}

function seedClub() {
  seedCluster();
  saveClubs([makeClub()]);
  const players = normalizePlayers([
    { id: "p1", name: "Player 1", tenantId: TENANT, level: 3, status: "active", active: true },
  ]);
  saveClubData(CLUB_ID, { ...getDefaultClubData(CLUB_ID), players, tenantId: TENANT });
}

describe("club governance", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    enableRbac(true);
    seedClub();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("club owner can view full members", () => {
    const club = makeClub();
    const owner = { id: "user-owner", role: ROLES.TENANT_OWNER, venueId: TENANT };
    assert.equal(isClubOwner(owner, club), true);
    assert.equal(canViewFullClubMembers(owner, club), true);
  });

  it("venue staff not club owner sees summary only", () => {
    const club = makeClub();
    const courtOwner = { id: "other-owner", role: ROLES.TENANT_OWNER, venueId: TENANT };
    assert.equal(canViewFullClubMembers(courtOwner, club), false);
    assert.equal(canViewClubMemberSummary(courtOwner, club), true);
  });

  it("venue staff without ownership gets empty member list", () => {
    const courtOwner = { id: "other-owner", role: ROLES.TENANT_OWNER, venueId: TENANT };
    const members = getClubMembers(CLUB_ID, TENANT, { user: courtOwner, skipGovernanceGuard: false });
    assert.equal(members.length, 0);
  });

  it("tournament invite bypass returns members for venue staff", () => {
    const inviteMembers = getClubMembersForTournamentInvite(CLUB_ID, TENANT);
    assert.ok(inviteMembers.length >= 1);
  });

  it("president can view full members", () => {
    const club = makeClub();
    const president = { id: "user-president", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID };
    assert.equal(canViewFullClubMembers(president, club), true);
  });

  it("vice president cannot delete members", () => {
    const club = makeClub({
      governance: {
        presidentUserId: "user-president",
        ownerUserId: "user-owner",
        vicePresidentUserId: "user-vice",
        registeredCourtIds: [],
      },
    });
    const vice = { id: "user-vice", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID };
    assert.equal(canViewFullClubMembers(vice, club), true);
    assert.equal(canDeleteClubMembers(vice, club), false);
  });

  it("only tenant owner can assign club owner", () => {
    const president = { id: "user-president", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID };
    const courtOwner = { id: "user-owner", role: ROLES.TENANT_OWNER, venueId: TENANT };
    assert.equal(canAssignClubOwner(president), false);
    assert.equal(canAssignClubOwner(courtOwner), true);
  });

  it("club manager self-register resolves to pending_approval", () => {
    const manager = { id: "mgr-1", role: ROLES.CLUB_MANAGER, clubId: null };
    const result = resolveGovernanceForCreate(
      { governance: { presidentUserId: "mgr-1" } },
      manager
    );
    assert.equal(result.status, CLUB_STATUSES.PENDING_APPROVAL);
    assert.equal(result.governance.presidentUserId, "mgr-1");
  });

  it("court owner create resolves to active", () => {
    const owner = { id: "owner-1", role: ROLES.TENANT_OWNER, venueId: TENANT };
    const result = resolveGovernanceForCreate(
      {
        governance: { presidentUserId: "pres-1" },
        assignOwnerToCreator: true,
      },
      owner
    );
    assert.equal(result.status, CLUB_STATUSES.ACTIVE);
    assert.equal(result.governance.ownerUserId, "owner-1");
  });

  it("tenant owner can approve pending club registration", () => {
    saveClubs([
      makeClub({
        status: CLUB_STATUSES.PENDING_APPROVAL,
        governance: {
          presidentUserId: "user-president",
          ownerUserId: null,
          vicePresidentUserId: null,
          registeredCourtIds: [],
        },
      }),
    ]);
    const courtOwner = { id: "venue-owner", role: ROLES.TENANT_OWNER, venueId: TENANT };
    saveAuthSession(courtOwner);
    const club = makeClub({ status: CLUB_STATUSES.PENDING_APPROVAL });
    assert.equal(canApproveClubRegistration(courtOwner, club), true);

    const result = approveClubRegistration(CLUB_ID, TENANT);
    assert.equal(result.ok, true);
    assert.equal(result.club.status, CLUB_STATUSES.ACTIVE);
    assert.equal(result.club.governance.approvedByUserId, "venue-owner");
    assert.ok(result.club.governance.approvedAt);
  });

  it("tenant owner can reject pending club registration", () => {
    saveClubs([
      makeClub({
        status: CLUB_STATUSES.PENDING_APPROVAL,
      }),
    ]);
    saveAuthSession({ id: "venue-owner", role: ROLES.TENANT_OWNER, venueId: TENANT });
    const result = rejectClubRegistration(CLUB_ID, TENANT);
    assert.equal(result.ok, true);
    assert.equal(result.club.status, CLUB_STATUSES.INACTIVE);
  });

  it("registered cluster label resolves from court_clusters", () => {
    const club = makeClub({
      governance: {
        presidentUserId: "user-president",
        ownerUserId: "user-owner",
        vicePresidentUserId: null,
        registeredClusterId: clusterNamLongId,
      },
    });
    const label = getRegisteredClusterLabel(club, TENANT);
    assert.ok(label);
    assert.equal(label.name, "Cụm sân Nam Long");
    assert.equal(label.id, clusterNamLongId);
  });

  it("migrates legacy registeredCourtIds to cluster label", () => {
    saveClubData(CLUB_ID, {
      ...getDefaultClubData(CLUB_ID),
      players: normalizePlayers([
        { id: "p1", name: "Player 1", tenantId: TENANT, level: 3, status: "active", active: true },
      ]),
      courts: [
        {
          id: "court-1",
          name: "Sân 1",
          number: 1,
          active: true,
          tenantId: TENANT,
          clusterId: clusterNamLongId,
        },
      ],
      tenantId: TENANT,
    });
    const club = makeClub({
      governance: {
        presidentUserId: "user-president",
        ownerUserId: "user-owner",
        vicePresidentUserId: null,
        registeredCourtIds: ["court-1"],
      },
    });
    const label = getRegisteredClusterLabel(club, TENANT);
    assert.ok(label);
    assert.equal(label.id, clusterNamLongId);
    assert.equal(label.name, "Cụm sân Nam Long");
  });

  it("stores registered cluster via governance update", () => {
    saveAuthSession({ id: "user-president", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID });
    const result = updateClubGovernance(CLUB_ID, {
      registeredClusterId: clusterNamLongId,
    });
    assert.equal(result.ok, true);
    assert.equal(result.club.governance.registeredClusterId, clusterNamLongId);
  });

  it("president cannot change club president", () => {
    const club = makeClub();
    const president = { id: "user-president", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID };
    saveAuthSession(president);

    assert.equal(canChangeClubPresident(president, club), false);

    const result = updateClubGovernance(CLUB_ID, {
      presidentUserId: "user-other-president",
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /Chủ tịch/);
  });

  it("governance owner can change club president", () => {
    const club = makeClub();
    const owner = { id: "user-owner", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID };
    saveAuthSession(owner);

    assert.equal(canChangeClubPresident(owner, club), true);

    const result = updateClubGovernance(CLUB_ID, {
      presidentUserId: "user-new-president",
    });
    assert.equal(result.ok, true);
    assert.equal(result.club.governance.presidentUserId, "user-new-president");
  });

  it("governance owner can delete club without club.delete permission", () => {
    const deletableClub = createClubRecord("CLB Delete Test", {
      id: "club-delete-test",
      tenantId: TENANT,
      venueId: TENANT,
      governance: {
        presidentUserId: "user-president",
        ownerUserId: "user-owner",
        vicePresidentUserId: null,
        registeredCourtIds: [],
      },
    });
    saveClubs([deletableClub]);
    saveClubData("club-delete-test", {
      ...getDefaultClubData("club-delete-test"),
      players: [],
      tenantId: TENANT,
    });

    const owner = { id: "user-owner", role: ROLES.CLUB_MANAGER, clubId: "club-delete-test" };
    saveAuthSession(owner);

    assert.equal(canDeleteClub(owner, deletableClub), true);

    const result = deleteClub("club-delete-test");
    assert.equal(result.ok, true);
    assert.equal(loadClubs().some((club) => club.id === "club-delete-test"), false);
  });

  it("president without ownership cannot delete club", () => {
    const president = { id: "user-president", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID };
    saveAuthSession(president);

    assert.equal(canDeleteClub(president, makeClub()), false);

    const result = deleteClub(CLUB_ID);
    assert.equal(result.ok, false);
  });
});

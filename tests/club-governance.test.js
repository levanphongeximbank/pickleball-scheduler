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
  canSelfRegisterClub,
  listLocalPresidentClubsForUser,
  canApproveClubRegistration,
  approveClubRegistration,
  rejectClubRegistration,
  getRegisteredClusterLabel,
  updateClubGovernance,
  assignClubVicePresident,
  listClubGovernanceCandidates,
} from "../src/features/club/index.js";
import { createClub } from "../src/features/club/index.js";
import { saveVenues } from "../src/data/venue.js";
import { createTenantRecord, TENANT_STATUS } from "../src/models/tenant.js";
import { loadAuthSession } from "../src/auth/authStorage.js";
import { saveAthleteClubLink, loadAthleteClubLink } from "../src/features/club/storage/athleteClubLinkStore.js";
import { deleteClub } from "../src/domain/clubService.js";
import { saveClubData, getDefaultClubData } from "../src/domain/clubStorage.js";
import { normalizePlayers } from "../src/models/player.js";
import {
  createCourtCluster,
  ensureDefaultClusterForVenue,
} from "../src/features/court-cluster/services/courtClusterService.js";
import { saveClusterAssignments, saveCourtClusters } from "../src/data/courtCluster.js";
import { ROLES as CLUSTER_ROLES } from "../src/auth/roles.js";
import {
  demoteGovernanceAthleteRole,
  hasClubGovernanceManagerAccess,
  resolveGovernanceElevatedRole,
} from "../src/features/club/services/governanceRoleElevation.js";
import { can } from "../src/auth/rbac.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { getDefaultHomePath, isMenuItemVisible } from "../src/auth/menuAccess.js";
import { CLUB_COACHING_MENU_ROOT } from "../src/config/v5Menu/clubCoachingMenu.js";

const RBAC_ON = { rbacEnabled: true };

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
    {
      id: "p-new-president",
      name: "New President",
      tenantId: TENANT,
      level: 3.5,
      status: "active",
      active: true,
    },
    {
      id: "p-vice",
      name: "Vice Player",
      tenantId: TENANT,
      level: 3,
      status: "active",
      active: true,
    },
  ]);
  saveClubData(CLUB_ID, { ...getDefaultClubData(CLUB_ID), players, tenantId: TENANT });
  saveAthleteClubLink("user-new-president", { clubId: CLUB_ID, playerId: "p-new-president" });
  saveAthleteClubLink("user-vice", { clubId: CLUB_ID, playerId: "p-vice" });
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

  it("canSelfRegisterClub allows PLAYER without clubId", () => {
    const player = { id: "player-1", role: ROLES.PLAYER, clubId: null, tenantId: TENANT };
    const linked = { id: "player-2", role: ROLES.PLAYER, clubId: CLUB_ID, tenantId: TENANT };
    assert.equal(canSelfRegisterClub(player), true);
    assert.equal(canSelfRegisterClub(linked), false);
  });

  it("canSelfRegisterClub allows CLUB_MANAGER when local club is missing", () => {
    saveClubs([]);
    const manager = {
      id: "mgr-orphan",
      role: ROLES.CLUB_MANAGER,
      clubId: "club-gone",
    };
    assert.equal(canSelfRegisterClub(manager), true);
  });

  it("listLocalPresidentClubsForUser finds clubs by presidentUserId", () => {
    saveClubs([
      createClubRecord("CLB ACCC", {
        id: "club-accc-local",
        venueId: TENANT,
        governance: { presidentUserId: "4cf24ed0-99f8-4997-b803-3c7ff8e32014" },
      }),
    ]);
    const owned = listLocalPresidentClubsForUser({
      id: "4cf24ed0-99f8-4997-b803-3c7ff8e32014",
      role: ROLES.PLAYER,
    });
    assert.equal(owned.length, 1);
    assert.equal(owned[0].id, "club-accc-local");
  });

  it("club scoped self-register resolves to active", () => {
    const manager = { id: "mgr-1", role: ROLES.CLUB_MANAGER, clubId: null };
    const player = { id: "player-1", role: ROLES.PLAYER, clubId: null, tenantId: TENANT };
    const managerResult = resolveGovernanceForCreate(
      { governance: { presidentUserId: "mgr-1" } },
      manager
    );
    const playerResult = resolveGovernanceForCreate({}, player);
    assert.equal(managerResult.status, CLUB_STATUSES.ACTIVE);
    assert.equal(managerResult.governance.presidentUserId, "mgr-1");
    assert.equal(playerResult.status, CLUB_STATUSES.ACTIVE);
    assert.equal(playerResult.governance.presidentUserId, "player-1");
  });

  it("submitForApproval still resolves to pending_approval", () => {
    const manager = { id: "mgr-1", role: ROLES.CLUB_MANAGER, clubId: null };
    const result = resolveGovernanceForCreate(
      { governance: { presidentUserId: "mgr-1" }, submitForApproval: true },
      manager
    );
    assert.equal(result.status, CLUB_STATUSES.PENDING_APPROVAL);
    assert.equal(result.governance.presidentUserId, "mgr-1");
  });

  it("PLAYER self-register createClub bootstraps president membership", async () => {
    saveVenues([
      createTenantRecord({ id: TENANT, name: "Tenant Gov", status: TENANT_STATUS.ACTIVE }),
    ]);
    saveClubs([]);
    const athlete = {
      id: "athlete-create",
      role: ROLES.PLAYER,
      clubId: null,
      tenantId: TENANT,
      displayName: "VĐV Tạo CLB",
      email: "athlete@example.com",
    };
    saveAuthSession(athlete);

    const result = await createClub({
      name: "CLB VĐV Mới",
      tenantId: TENANT,
      governance: { presidentUserId: "athlete-create" },
    });

    assert.equal(result.ok, true);
    assert.equal(result.club.status, CLUB_STATUSES.ACTIVE);
    assert.equal(result.club.governance.presidentUserId, "athlete-create");

    const session = loadAuthSession();
    assert.equal(session.user.clubId, result.club.id);
    assert.ok(session.user.playerId);
    assert.equal(session.user.role, ROLES.CLUB_MANAGER);

    const members = getClubMembers(result.club.id, TENANT, { skipGovernanceGuard: true });
    assert.ok(members.some((member) => member.playerId === session.user.playerId));
  });

  it("PLAYER without tenantId self-register createClub via cluster tenant", async () => {
    saveVenues([
      createTenantRecord({ id: TENANT, name: "Tenant Gov", status: TENANT_STATUS.ACTIVE }),
    ]);
    saveClubs([]);
    const athlete = {
      id: "athlete-no-tenant",
      role: ROLES.PLAYER,
      clubId: null,
      displayName: "Huỳnh Văn Anh",
      email: "anh@example.com",
    };
    saveAuthSession(athlete);

    const result = await createClub({
      name: "CLB ACCC PRO",
      tenantId: TENANT,
      governance: { presidentUserId: "athlete-no-tenant" },
    });

    assert.equal(result.ok, true);
    assert.equal(result.club.status, CLUB_STATUSES.ACTIVE);
    assert.equal(result.club.tenantId, TENANT);

    const session = loadAuthSession();
    assert.equal(session.user.clubId, result.club.id);
    assert.equal(session.user.tenantId, TENANT);
    assert.equal(session.user.venueId, TENANT);
    assert.equal(session.user.role, ROLES.CLUB_MANAGER);
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

  it("governance owner can change club president to linked athlete", () => {
    const club = makeClub();
    const owner = { id: "user-owner", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID };
    saveAuthSession(owner);

    assert.equal(canChangeClubPresident(owner, club), true);

    const result = updateClubGovernance(CLUB_ID, {
      presidentUserId: "user-new-president",
    }, TENANT);
    assert.equal(result.ok, true);
    assert.equal(result.club.governance.presidentUserId, "user-new-president");
    assert.equal(loadAthleteClubLink("user-new-president")?.playerId, "p-new-president");
  });

  it("rejects vice president who is not a linked club athlete", async () => {
    saveAuthSession({ id: "user-president", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID });
    const result = await assignClubVicePresident(CLUB_ID, "user-random", TENANT);
    assert.equal(result.ok, false);
    assert.match(result.error, /vận động viên/i);
  });

  it("assigns vice president from linked club athlete", async () => {
    saveAuthSession({ id: "user-president", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID });
    const result = await assignClubVicePresident(CLUB_ID, "user-vice", TENANT);
    assert.equal(result.ok, true);
    assert.equal(result.club.governance.vicePresidentUserId, "user-vice");
    assert.equal(loadAthleteClubLink("user-vice")?.playerId, "p-vice");
  });

  it("rejects vice president same as president", async () => {
    saveAuthSession({ id: "user-president", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID });
    const result = await assignClubVicePresident(CLUB_ID, "user-president", TENANT);
    assert.equal(result.ok, false);
    assert.match(result.error, /trùng Chủ tịch/i);
  });

  it("lists only linked athletes as governance candidates", () => {
    const candidates = listClubGovernanceCandidates(CLUB_ID, TENANT);
    assert.ok(candidates.some((item) => item.userId === "user-new-president"));
    assert.ok(candidates.some((item) => item.userId === "user-vice"));
    assert.equal(
      candidates.every((item) => item.playerId),
      true
    );
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

  it("PLAYER president is elevated to CLUB_MANAGER for RBAC", () => {
    const president = {
      id: "user-president",
      role: ROLES.PLAYER,
      clubId: CLUB_ID,
      playerId: "p1",
      status: "active",
    };

    assert.equal(hasClubGovernanceManagerAccess(president, makeClub()), true);
    assert.equal(resolveGovernanceElevatedRole(president), ROLES.CLUB_MANAGER);
    assert.equal(can(president, PERMISSIONS.CLUB_VIEW, { clubId: CLUB_ID }, RBAC_ON), true);
    assert.equal(can(president, PERMISSIONS.CLUB_UPDATE, { clubId: CLUB_ID }, RBAC_ON), true);
  });

  it("PLAYER vice president is elevated to CLUB_MANAGER for RBAC", () => {
    const clubWithVice = makeClub({
      governance: {
        presidentUserId: "user-president",
        ownerUserId: "user-owner",
        vicePresidentUserId: "user-vice",
        registeredCourtIds: [],
      },
    });
    saveClubs([clubWithVice]);

    const vice = {
      id: "user-vice",
      role: ROLES.PLAYER,
      clubId: CLUB_ID,
      playerId: "p-vice",
      status: "active",
    };

    assert.equal(hasClubGovernanceManagerAccess(vice, clubWithVice), true);
    assert.equal(resolveGovernanceElevatedRole(vice), ROLES.CLUB_MANAGER);
    assert.equal(can(vice, PERMISSIONS.CLUB_VIEW, { clubId: CLUB_ID }, RBAC_ON), true);
  });

  it("plain PLAYER without governance title is not elevated", () => {
    const member = {
      id: "user-member",
      role: ROLES.PLAYER,
      clubId: CLUB_ID,
      playerId: "p1",
      status: "active",
    };

    assert.equal(hasClubGovernanceManagerAccess(member, makeClub()), false);
    assert.equal(resolveGovernanceElevatedRole(member), ROLES.PLAYER);
    assert.equal(can(member, PERMISSIONS.CLUB_UPDATE, { clubId: CLUB_ID }, RBAC_ON), false);
  });

  it("loadAuthSession promotes PLAYER president to CLUB_MANAGER", () => {
    saveAuthSession({
      id: "user-president",
      role: ROLES.PLAYER,
      clubId: CLUB_ID,
      playerId: "p1",
      status: "active",
    });

    const session = loadAuthSession();
    assert.equal(session.user.role, ROLES.CLUB_MANAGER);
  });

  it("governance transfer demotes former president auth role when no longer in governance", () => {
    const demoted = demoteGovernanceAthleteRole(CLUB_ID, "user-president", {
      presidentUserId: "user-new-president",
      ownerUserId: "user-owner",
      vicePresidentUserId: null,
      vicePresidentUserIds: [],
    });
    assert.ok(demoted);
    assert.equal(demoted.role, ROLES.PLAYER);
  });

  it("PLAYER president uses /club home path and club activity menu", () => {
    const president = {
      id: "user-president",
      role: ROLES.PLAYER,
      clubId: CLUB_ID,
      status: "active",
    };
    const clubActivityItem = CLUB_COACHING_MENU_ROOT.children.find(
      (item) => item.path === "/club"
    );

    assert.equal(getDefaultHomePath(president, true), "/club");
    assert.equal(
      isMenuItemVisible(clubActivityItem, {
        can: (permission, scope) => can(president, permission, scope, RBAC_ON),
        rbacEnabled: true,
        isAuthenticated: true,
        user: president,
        scope: { clubId: CLUB_ID },
      }),
      true
    );
  });
});

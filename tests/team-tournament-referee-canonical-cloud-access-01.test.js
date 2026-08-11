/**
 * TEAM-TOURNAMENT-REFEREE-CANONICAL-CLOUD-ACCESS-01
 *
 * Owner failure: TeamRefereePortal loaded get_setup then authorized via
 * assertTournamentPortalAccess → local blob getTournament → "Không tìm thấy giải."
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import { assertTournamentAccess } from "../src/domain/tournamentService.js";
import {
  clearClubScope,
  primeClubScopeForTest,
} from "../src/auth/clubScopeResolver.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import { createUserRecord } from "../src/models/user.js";
import { DREAMBREAKER_STATUS } from "../src/features/team-tournament/constants.js";
import {
  resolveTeamRefereeCloudPageAccess,
} from "../src/features/team-tournament/ui/teamTournamentCloudAccess.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const TOURNAMENT_ID = "team-tournament-4zllu71z";
const MATCHUP_ID = "matchup-ilj0220c";

const CLOUD_TOURNAMENT = {
  id: TOURNAMENT_ID,
  clubId: CLUB_ID,
  tenantId: TENANT_A,
  mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
  status: "draft",
  name: "Giải đồng đội",
  teamData: {
    teams: [
      { id: "team-hfpuyf7a", name: "Đội 1", captainPlayerId: "player-m03" },
      { id: "team-svlogkw9", name: "Đội 3", captainPlayerId: "player-m04" },
    ],
    matchups: [
      {
        id: MATCHUP_ID,
        teamAId: "team-hfpuyf7a",
        teamBId: "team-svlogkw9",
        status: "in_progress",
        dreambreaker: {
          status: DREAMBREAKER_STATUS.READY,
          version: 3,
          teamAOrder: ["p1", "p2", "p3", "p4"],
          teamBOrder: ["p5", "p6", "p7", "p8"],
        },
      },
    ],
    settings: {},
  },
};

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

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function ownerA() {
  return createUserRecord({
    id: "13e0968b-53c5-4ba6-8ae0-dce12b1faf9c",
    email: "owner@staging.local",
    role: ROLES.VENUE_OWNER,
    tenantId: TENANT_A,
    venueId: TENANT_A,
    clubId: null,
  });
}

function ownerB() {
  return createUserRecord({
    id: "owner-b",
    email: "owner-b@staging.local",
    role: ROLES.VENUE_OWNER,
    tenantId: TENANT_B,
    venueId: TENANT_B,
    clubId: null,
  });
}

function playerUser() {
  return createUserRecord({
    id: "player-1",
    role: ROLES.PLAYER,
    tenantId: TENANT_A,
    venueId: TENANT_A,
    clubId: CLUB_ID,
    playerId: "player-m03",
  });
}

function refereeUser() {
  return createUserRecord({
    id: "referee-1",
    role: ROLES.REFEREE,
    tenantId: TENANT_A,
    venueId: TENANT_A,
  });
}

function allowOwnerCan(permission) {
  return (
    permission === PERMISSIONS.TEAM_MANAGE ||
    permission === PERMISSIONS.TOURNAMENT_UPDATE ||
    permission === PERMISSIONS.TEAM_VIEW ||
    permission === PERMISSIONS.TOURNAMENT_VIEW
  );
}

function primeScope(user, tenantId = user.venueId) {
  primeClubScopeForTest({
    user,
    tenantId,
    clubs: [
      {
        id: CLUB_ID,
        name: "HC Operator Seed Club venue-staging-a",
        venueId: TENANT_A,
        tenantId: TENANT_A,
      },
    ],
  });
}

function resolveFor(user, extras = {}) {
  primeScope(user, extras.currentTenantId ?? user.venueId);
  return resolveTeamRefereeCloudPageAccess({
    loading: false,
    tournament: CLOUD_TOURNAMENT,
    clubId: CLUB_ID,
    currentTenantId: extras.currentTenantId ?? user.venueId,
    user,
    rbacEnabled: true,
    isAuthenticated: true,
    can: extras.can || allowOwnerCan,
    ...extras,
  });
}

describe("team-tournament-referee-canonical-cloud-access-01", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    clearClubScope();
    primeClubScopeForTest({
      user: ownerA(),
      tenantId: TENANT_A,
      clubs: [
        {
          id: CLUB_ID,
          name: "HC Operator Seed Club venue-staging-a",
          venueId: TENANT_A,
          tenantId: TENANT_A,
        },
      ],
    });
  });

  afterEach(() => {
    clearClubScope();
    delete globalThis.localStorage;
  });

  it("A: cloud-loaded tournament + TENANT_OWNER + no local blob → allowed", () => {
    const user = ownerA();
    const legacy = assertTournamentAccess(CLUB_ID, TOURNAMENT_ID, {
      tenantId: TENANT_A,
      rbacEnabled: true,
      user,
    });
    assert.equal(legacy.ok, false);
    assert.equal(legacy.error, "Không tìm thấy giải.");

    const access = resolveFor(user);
    assert.equal(access.pending, false);
    assert.equal(access.allowed, true, access.error);
    assert.equal(access.canManage, true);
    assert.equal(access.error, null);
  });

  it("B: missing local blob must not emit Không tìm thấy giải. when cloud tournament exists", () => {
    const access = resolveFor(ownerA());
    assert.equal(access.allowed, true);
    assert.equal(access.error, null);
    assert.equal(String(access.error || "").includes("Không tìm thấy giải."), false);
  });

  it("C: unauthorized cross-tenant user remains denied", () => {
    const access = resolveFor(ownerB(), { currentTenantId: TENANT_B });
    assert.equal(access.allowed, false);
    assert.equal(access.pending, false);
    assert.notEqual(access.code, "PENDING_CLOUD_LOAD");

    const foreignPlayer = createUserRecord({
      id: "player-b",
      role: ROLES.PLAYER,
      tenantId: TENANT_B,
      venueId: TENANT_B,
      clubId: "club-other",
      playerId: "player-other",
    });
    const playerAccess = resolveFor(foreignPlayer, { currentTenantId: TENANT_B });
    assert.equal(playerAccess.allowed, false);
    assert.equal(playerAccess.pending, false);
  });

  it("D: canonical tournament-not-found remains denied", () => {
    const access = resolveTeamRefereeCloudPageAccess({
      loading: false,
      tournament: null,
      clubId: CLUB_ID,
      currentTenantId: TENANT_A,
      user: ownerA(),
      rbacEnabled: true,
      isAuthenticated: true,
      can: allowOwnerCan,
    });
    assert.equal(access.allowed, false);
    assert.equal(access.pending, false);
    assert.equal(access.code, "NOT_FOUND");
    assert.match(String(access.error || ""), /Không tìm thấy giải/);
  });

  it("D2: loading cloud tournament is pending, not not-found", () => {
    const access = resolveTeamRefereeCloudPageAccess({
      loading: true,
      tournament: null,
      clubId: CLUB_ID,
      currentTenantId: TENANT_A,
      user: ownerA(),
      rbacEnabled: true,
      isAuthenticated: true,
      can: allowOwnerCan,
    });
    assert.equal(access.pending, true);
    assert.equal(access.allowed, false);
    assert.equal(access.error, null);
    assert.equal(String(access.error || "").includes("Không tìm thấy giải"), false);
  });

  it("E: PLAYER can view referee page; REFEREE can manage results", () => {
    const playerAccess = resolveFor(playerUser());
    assert.equal(playerAccess.allowed, true, playerAccess.error);
    assert.equal(playerAccess.canView, true);
    assert.equal(playerAccess.canManage, false);

    const refereeAccess = resolveFor(refereeUser());
    assert.equal(refereeAccess.allowed, true, refereeAccess.error);
    assert.equal(refereeAccess.canView, true);
    assert.equal(refereeAccess.canManage, true);
  });

  it("F: TeamRefereePortal does not use legacy getTournament / blob assert as authority", () => {
    const portal = readSrc("src/pages/tournament/TeamRefereePortal.jsx");
    const helper = readSrc(
      "src/features/team-tournament/ui/teamTournamentCloudAccess.js"
    );

    assert.match(portal, /resolveTeamRefereeCloudPageAccess/);
    assert.match(helper, /assertLoadedTournamentAccess/);
    assert.match(helper, /resolveTeamTournamentCloudPageAccess/);
    assert.equal(portal.includes("assertTournamentPortalAccess"), false);
    assert.equal(portal.includes("assertTournamentAccess"), false);
    assert.equal(portal.includes("getTournament("), false);
    assert.equal(portal.includes("domain/tournamentService"), false);
    assert.equal(helper.includes("assertTournamentAccess"), false);
    assert.equal(helper.includes("domain/tournamentService"), false);
    assert.equal(/getTournament\s*\(/.test(helper), false);
  });

  it("G: Dreambreaker READY UI remains reachable for authorized cloud-only tournament", () => {
    const access = resolveFor(ownerA());
    assert.equal(access.allowed, true);
    assert.equal(access.canManage, true);

    const matchup = CLOUD_TOURNAMENT.teamData.matchups[0];
    assert.equal(matchup.dreambreaker.status, DREAMBREAKER_STATUS.READY);

    const portal = readSrc("src/pages/tournament/TeamRefereePortal.jsx");
    const panel = readSrc("src/components/tournament/team/DreambreakerPanel.jsx");
    assert.match(portal, /RefereeDreambreakerPanel/);
    assert.match(portal, /canManageDreambreaker=\{canManage\}/);
    assert.match(panel, /DREAMBREAKER_STATUS\.READY/);
    assert.match(panel, /Dreambreaker sẵn sàng/);
    assert.match(panel, /Bắt đầu Dreambreaker/);
  });
});

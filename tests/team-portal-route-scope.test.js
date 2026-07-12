import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { can } from "../src/auth/rbac.js";
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { ROLES } from "../src/auth/roles.js";
import { normalizeUser } from "../src/models/user.js";
import { saveClubs } from "../src/data/club.js";
import { saveClubData } from "../src/domain/clubStorage.js";
import { resolveRouteAccessScope } from "../src/features/tenant/services/profileVenueService.js";
import {
  applyTeamPortalRouteScope,
  extractTournamentIdFromPortalPath,
  isTeamTournamentPortalPath,
} from "../src/features/team-tournament/routing/teamPortalRouteScope.js";
import { isAuthenticatedOnlyRoute } from "../src/auth/authGuard.js";

const PROBE_TOURNAMENT_ID = "phase23d-probe-tournament";
const PROBE_CLUB_ID = "club-staging-demo";
const STALE_CLUB_ID = "club-smoke-42i1";
const RBAC_ON = { rbacEnabled: true };

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

function seedProbeTournamentBlob() {
  saveClubs([
    { id: PROBE_CLUB_ID, name: "CLB Staging Demo", venueId: "venue-staging-a" },
    { id: STALE_CLUB_ID, name: "Stale smoke club", venueId: "venue-staging-a" },
  ]);
  saveClubData(PROBE_CLUB_ID, {
    tournaments: [
      {
        id: PROBE_TOURNAMENT_ID,
        name: "TT probe",
        clubId: PROBE_CLUB_ID,
        tenantId: "venue-staging-a",
        mode: "team",
      },
    ],
    players: [],
    courts: [],
  });
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  seedProbeTournamentBlob();
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe("team portal route scope", () => {
  it("detects team portal deep-link paths", () => {
    assert.equal(isTeamTournamentPortalPath("/team-portal/abc"), true);
    assert.equal(isTeamTournamentPortalPath("/team-referee/abc"), true);
    assert.equal(isTeamTournamentPortalPath("/tournament/abc"), false);
    assert.equal(extractTournamentIdFromPortalPath("/team-portal/phase23d-probe"), "phase23d-probe");
  });

  it("resolveRouteAccessScope uses tournament club instead of stale activeClubId", () => {
    const player = normalizeUser({
      id: "captain-a",
      role: ROLES.PLAYER,
      playerId: "player-staging-a-1",
      venueId: "venue-staging-a",
      clubId: null,
      status: "active",
    });

    const scope = resolveRouteAccessScope({
      user: player,
      activeClubId: STALE_CLUB_ID,
      activeClub: { id: STALE_CLUB_ID, venueId: "venue-staging-a" },
      pathname: `/team-portal/${PROBE_TOURNAMENT_ID}`,
    });

    assert.equal(scope.tournamentId, PROBE_TOURNAMENT_ID);
    assert.equal(scope.clubId, PROBE_CLUB_ID);
  });

  it("team portal deep links are auth-only routes (page-level captain guard)", () => {
    assert.equal(isAuthenticatedOnlyRoute("/team-portal/phase23d-probe-tournament"), true);
    assert.equal(isAuthenticatedOnlyRoute("/team-referee/phase23d-probe-tournament"), true);
  });

  it("PLAYER captain can access /team-portal without profiles.club_id", () => {
    const player = normalizeUser({
      id: "captain-a",
      role: ROLES.PLAYER,
      playerId: "player-staging-a-1",
      venueId: "venue-staging-a",
      clubId: null,
      status: "active",
    });

    const pathname = `/team-portal/${PROBE_TOURNAMENT_ID}`;
    const scope = resolveRouteAccessScope({
      user: player,
      activeClubId: STALE_CLUB_ID,
      activeClub: { id: STALE_CLUB_ID },
      pathname,
    });
    const playerCan = (perm, routeScope) => can(player, perm, routeScope, RBAC_ON);

    assert.equal(canAccessRoute(playerCan, pathname, scope, player), true);
    assert.equal(can(player, PERMISSIONS.TEAM_VIEW, scope, RBAC_ON), true);
  });

  it("applyTeamPortalRouteScope clears stale club when blob missing and profile has no club", () => {
    saveClubs([{ id: STALE_CLUB_ID, name: "Stale" }]);
    const player = normalizeUser({
      id: "captain-a",
      role: ROLES.PLAYER,
      playerId: "player-staging-a-1",
      clubId: null,
    });

    const next = applyTeamPortalRouteScope(
      "/team-portal/unknown-tournament",
      { clubId: STALE_CLUB_ID, playerId: player.playerId },
      { user: player }
    );

    assert.equal(next.tournamentId, "unknown-tournament");
    assert.equal(next.clubId, null);
  });
});

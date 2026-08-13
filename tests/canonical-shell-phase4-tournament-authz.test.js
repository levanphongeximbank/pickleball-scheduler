import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  isPublicAuthPath,
  isAuthenticatedOnlyRoute,
  shouldRedirectToLogin,
  shouldRedirectToForbidden,
} from "../src/auth/authGuard.js";
import { getRouteAccessPermissions, canAccessRoute } from "../src/auth/menuAccess.js";
import {
  decideTournamentEngineRouteGate,
  evaluateTournamentEngineRouteAccess,
  isMyTournamentsHubPath,
  isPublicTournamentsCatalogPath,
  isTournamentDashboardPath,
  isTournamentEnginePath,
  parseTournamentEnginePath,
  TOURNAMENT_ENGINE_ROUTE_PERMISSIONS,
} from "../src/auth/tournamentEngineRouteAccess.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { ROLES } from "../src/auth/roles.js";
import { can } from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";
import { saveClubs } from "../src/data/club.js";
import { saveClubData } from "../src/domain/clubStorage.js";
import { createTournamentRecord } from "../src/models/tournament/tournament.js";
import { CANONICAL_ROUTE_CATALOG } from "../src/features/canonical-shell/config/canonicalRouteCatalog.js";
import {
  filterCanonicalMenu,
  flattenCanonicalMenu,
} from "../src/features/canonical-shell/services/filterCanonicalMenu.js";
import { B02_TOURNAMENT_HUB_MENU_ALLOWLIST } from "../src/features/canonical-shell/config/ownerDecisions.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ENGINE_TABS = ["engine", "seed", "draw", "schedule", "courts", "ranking", "logs"];
const TENANT_A = "venue-phase4-a";
const TENANT_B = "venue-phase4-b";
const CLUB_A = "club-phase4-a";
const CLUB_B = "club-phase4-b";
const TOURNAMENT_A = "tournament-phase4-a";

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

function seedClubsAndTournament() {
  saveClubs([
    {
      id: CLUB_A,
      name: "CLB Phase4 A",
      venueId: TENANT_A,
      tenantId: TENANT_A,
    },
    {
      id: CLUB_B,
      name: "CLB Phase4 B",
      venueId: TENANT_B,
      tenantId: TENANT_B,
    },
  ]);

  const tournament = createTournamentRecord(CLUB_A, {
    id: TOURNAMENT_A,
    name: "Giải Phase4 A",
    tenantId: TENANT_A,
  });
  saveClubData(CLUB_A, { tournaments: [tournament] });
  saveClubData(CLUB_B, { tournaments: [] });
  return tournament;
}

function ownerA() {
  return createUserRecord({
    id: "owner-a",
    role: ROLES.VENUE_OWNER,
    venueId: TENANT_A,
    tenantId: TENANT_A,
    email: "owner-a@phase4.local",
    status: "active",
  });
}

function ownerB() {
  return createUserRecord({
    id: "owner-b",
    role: ROLES.VENUE_OWNER,
    venueId: TENANT_B,
    tenantId: TENANT_B,
    email: "owner-b@phase4.local",
    status: "active",
  });
}

function player() {
  return createUserRecord({
    id: "player-1",
    role: ROLES.PLAYER,
    venueId: TENANT_A,
    tenantId: TENANT_A,
    clubId: CLUB_A,
    email: "player@phase4.local",
    status: "active",
  });
}

function unknownRoleUser() {
  return {
    id: "unk-1",
    role: "NOT_A_REAL_ROLE_XYZ",
    venueId: TENANT_A,
    tenantId: TENANT_A,
    email: "unk@phase4.local",
    status: "active",
  };
}

function scopeFor(clubId, venueId) {
  return { clubId, venueId, tenantId: venueId, clusterId: null };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  seedClubsAndTournament();
});

afterEach(() => {
  delete globalThis.localStorage;
});

test("phase4 plural — /tournaments is authenticated My Tournaments hub (not public catalog)", () => {
  assert.equal(isPublicTournamentsCatalogPath("/tournaments"), false);
  assert.equal(isPublicTournamentsCatalogPath("/tournaments/"), false);
  assert.equal(isPublicTournamentsCatalogPath("/tournaments/t1/engine"), false);
  assert.equal(isMyTournamentsHubPath("/tournaments"), true);
  assert.equal(isMyTournamentsHubPath("/tournaments/"), true);
  assert.equal(isMyTournamentsHubPath("/tournaments/t1"), false);

  const opts = { authProductionEnabled: true, rbacEnabled: true };
  assert.equal(isPublicAuthPath("/tournaments", opts), false);
  assert.equal(isPublicAuthPath("/tournaments/", opts), false);
  assert.equal(
    shouldRedirectToLogin("/tournaments", { ...opts, isAuthenticated: false }),
    true
  );
  assert.equal(
    shouldRedirectToLogin("/tournaments/", { ...opts, isAuthenticated: false }),
    true
  );
  assert.equal(isAuthenticatedOnlyRoute("/tournaments"), true);
  assert.equal(isAuthenticatedOnlyRoute("/tournaments/"), true);

  // Hub must not inherit Engine permission mapping.
  assert.deepEqual(getRouteAccessPermissions("/tournaments"), []);
  assert.deepEqual(getRouteAccessPermissions("/tournaments/"), []);
});

test("phase4 plural — nested Engine paths are not public and require login when unauthenticated", () => {
  const opts = { authProductionEnabled: true, rbacEnabled: false };
  for (const tab of ENGINE_TABS) {
    const path = `/tournaments/${TOURNAMENT_A}/${tab}`;
    assert.equal(isPublicAuthPath(path, opts), false, tab);
    assert.equal(
      shouldRedirectToLogin(path, { ...opts, isAuthenticated: false }),
      true,
      tab
    );
    const decision = decideTournamentEngineRouteGate({
      pathname: path,
      user: null,
      isAuthenticated: false,
      scope: scopeFor(CLUB_A, TENANT_A),
      activeClubId: CLUB_A,
      authProductionEnabled: true,
      rbacEnabled: false,
    });
    assert.equal(decision.apply, true, tab);
    assert.equal(decision.ok, false, tab);
    assert.equal(decision.redirect, "login", tab);
  }
});

test("phase4 plural — auth ON + RBAC OFF: no tournament.update = denied", () => {
  const decision = decideTournamentEngineRouteGate({
    pathname: `/tournaments/${TOURNAMENT_A}/engine`,
    user: player(),
    isAuthenticated: true,
    scope: scopeFor(CLUB_A, TENANT_A),
    activeClubId: CLUB_A,
    authProductionEnabled: true,
    rbacEnabled: false,
  });
  assert.equal(decision.apply, true);
  assert.equal(decision.ok, false);
  assert.equal(decision.redirect, "forbidden");
  assert.equal(decision.code, "FORBIDDEN_PERMISSION");
});

test("phase4 plural — auth ON + RBAC OFF: permission but no ownership/tenant = denied", () => {
  // ownerA has tournament.update for club A; force a foreign tenantId so ownership/tenant fails.
  const decision = decideTournamentEngineRouteGate({
    pathname: `/tournaments/${TOURNAMENT_A}/engine`,
    user: ownerA(),
    isAuthenticated: true,
    scope: scopeFor(CLUB_A, TENANT_A),
    activeClubId: CLUB_A,
    authProductionEnabled: true,
    rbacEnabled: false,
    tenantId: TENANT_B,
  });
  assert.equal(decision.apply, true);
  assert.equal(decision.ok, false);
  assert.equal(decision.redirect, "forbidden");
  assert.notEqual(decision.code, "FORBIDDEN_PERMISSION");

  // Cross-tenant owner also denied (may fail at permission scope or ownership — either is closed).
  const crossTenant = decideTournamentEngineRouteGate({
    pathname: `/tournaments/${TOURNAMENT_A}/engine`,
    user: ownerB(),
    isAuthenticated: true,
    scope: scopeFor(CLUB_A, TENANT_A),
    activeClubId: CLUB_A,
    authProductionEnabled: true,
    rbacEnabled: false,
    tenantId: TENANT_B,
  });
  assert.equal(crossTenant.ok, false);
  assert.equal(crossTenant.redirect, "forbidden");
});

test("phase4 plural — auth ON + RBAC OFF: permission + ownership = allowed", () => {
  const decision = decideTournamentEngineRouteGate({
    pathname: `/tournaments/${TOURNAMENT_A}/engine`,
    user: ownerA(),
    isAuthenticated: true,
    scope: scopeFor(CLUB_A, TENANT_A),
    activeClubId: CLUB_A,
    authProductionEnabled: true,
    rbacEnabled: false,
    tenantId: TENANT_A,
  });
  assert.equal(decision.apply, true);
  assert.equal(decision.ok, true);
  assert.equal(decision.redirect, null);
  assert.equal(decision.code, "OK");
});

test("phase4 plural — RBAC ON: same authorization requirements remain enforced", () => {
  const deniedPerm = decideTournamentEngineRouteGate({
    pathname: `/tournaments/${TOURNAMENT_A}/seed`,
    user: player(),
    isAuthenticated: true,
    scope: scopeFor(CLUB_A, TENANT_A),
    activeClubId: CLUB_A,
    authProductionEnabled: true,
    rbacEnabled: true,
  });
  assert.equal(deniedPerm.ok, false);
  assert.equal(deniedPerm.code, "FORBIDDEN_PERMISSION");

  const deniedOwner = decideTournamentEngineRouteGate({
    pathname: `/tournaments/${TOURNAMENT_A}/draw`,
    user: ownerB(),
    isAuthenticated: true,
    scope: scopeFor(CLUB_A, TENANT_A),
    activeClubId: CLUB_A,
    authProductionEnabled: true,
    rbacEnabled: true,
    tenantId: TENANT_B,
  });
  assert.equal(deniedOwner.ok, false);

  const allowed = decideTournamentEngineRouteGate({
    pathname: `/tournaments/${TOURNAMENT_A}/schedule`,
    user: ownerA(),
    isAuthenticated: true,
    scope: scopeFor(CLUB_A, TENANT_A),
    activeClubId: CLUB_A,
    authProductionEnabled: true,
    rbacEnabled: true,
    tenantId: TENANT_A,
  });
  assert.equal(allowed.ok, true);
});

test("phase4 plural — unknown role fail-closed under auth-active", () => {
  const decision = decideTournamentEngineRouteGate({
    pathname: `/tournaments/${TOURNAMENT_A}/engine`,
    user: unknownRoleUser(),
    isAuthenticated: true,
    scope: scopeFor(CLUB_A, TENANT_A),
    activeClubId: CLUB_A,
    authProductionEnabled: true,
    rbacEnabled: false,
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.redirect, "forbidden");
});

test("phase4 plural — all seven engine routes detected + permission parity", () => {
  for (const tab of ENGINE_TABS) {
    const path = `/tournaments/abc/${tab}`;
    assert.equal(isTournamentEnginePath(path), true, tab);
    assert.deepEqual(parseTournamentEnginePath(path), {
      tournamentId: "abc",
      tab,
    });
    assert.deepEqual(getRouteAccessPermissions(path), [PERMISSIONS.TOURNAMENT_UPDATE]);
  }
  assert.deepEqual(TOURNAMENT_ENGINE_ROUTE_PERMISSIONS, [PERMISSIONS.TOURNAMENT_UPDATE]);
  assert.equal(isTournamentEnginePath("/tournament/list"), false);
  assert.equal(isTournamentEnginePath("/tournaments"), false);
  assert.equal(isTournamentEnginePath("/tournaments/"), false);
});

test("phase4 plural — exact dashboard is authenticated shell, not TOURNAMENT_UPDATE Engine", () => {
  const dashboardId = "7d1fe5a0-f312-4e4e-9869-53eff9383c54";
  const dashboard = `/tournaments/${dashboardId}`;
  const dashboardSlash = `${dashboard}/`;

  assert.equal(isPublicTournamentsCatalogPath(dashboard), false);
  assert.equal(isTournamentDashboardPath(dashboard), true);
  assert.equal(isTournamentDashboardPath(dashboardSlash), true);
  assert.equal(isTournamentEnginePath(dashboard), false);
  assert.equal(isTournamentEnginePath(dashboardSlash), false);

  assert.deepEqual(getRouteAccessPermissions(dashboard), []);
  assert.deepEqual(getRouteAccessPermissions(dashboardSlash), []);
  assert.equal(isAuthenticatedOnlyRoute(dashboard), true);
  assert.equal(isAuthenticatedOnlyRoute(dashboardSlash), true);

  // Catalog stays public; dashboard is not public anonymous.
  assert.equal(isPublicAuthPath(dashboard, { authProductionEnabled: true, rbacEnabled: true }), false);
  assert.equal(
    shouldRedirectToLogin(dashboard, {
      authProductionEnabled: true,
      rbacEnabled: true,
      isAuthenticated: false,
    }),
    true
  );

  // PLAYER may open Dashboard (no TOURNAMENT_UPDATE) — must NOT redirect to /discover-clubs.
  const athlete = player();
  const athleteScope = scopeFor(CLUB_A, TENANT_A);
  const athleteCan = (permission, scope) =>
    can(athlete, permission, scope, { rbacEnabled: true });
  assert.equal(
    canAccessRoute(athleteCan, dashboard, athleteScope, athlete),
    true
  );
  assert.equal(
    shouldRedirectToForbidden(dashboard, {
      rbacEnabled: true,
      isAuthenticated: true,
      can: athleteCan,
      scope: athleteScope,
      user: athlete,
    }),
    false
  );

  // PLAYER Engine remains denied (permission + hard gate).
  const engine = `/tournaments/${dashboardId}/engine`;
  assert.deepEqual(getRouteAccessPermissions(engine), [PERMISSIONS.TOURNAMENT_UPDATE]);
  assert.equal(isAuthenticatedOnlyRoute(engine), false);
  assert.equal(
    canAccessRoute(athleteCan, engine, athleteScope, athlete),
    false
  );
  assert.equal(
    shouldRedirectToForbidden(engine, {
      rbacEnabled: true,
      isAuthenticated: true,
      can: athleteCan,
      scope: athleteScope,
      user: athlete,
    }),
    true
  );

  const engineGate = decideTournamentEngineRouteGate({
    pathname: engine,
    user: athlete,
    isAuthenticated: true,
    scope: athleteScope,
    activeClubId: CLUB_A,
    authProductionEnabled: true,
    rbacEnabled: true,
  });
  assert.equal(engineGate.apply, true);
  assert.equal(engineGate.ok, false);
  assert.equal(engineGate.redirect, "forbidden");

  // Unknown descendant stays fail-closed organizer (not dashboard).
  assert.deepEqual(
    getRouteAccessPermissions(`/tournaments/${dashboardId}/unknown-tab`),
    [PERMISSIONS.TOURNAMENT_UPDATE]
  );
});

test("phase4 B02 — retain routes, expose only the Wave 1 approved hub allowlist, no invented redirects", () => {
  const router = readFileSync(join(root, "src/router.jsx"), "utf8");
  const legacy = CANONICAL_ROUTE_CATALOG.routes.filter(
    (r) =>
      r.path.startsWith("/tournament") &&
      !r.path.startsWith("/tournaments") &&
      r.classification === "LEGACY"
  );
  assert.ok(legacy.length >= 42, `expected >=42 legacy tournament routes, got ${legacy.length}`);
  assert.equal(legacy.length, 43);

  assert.equal(
    /path="\/tournament\/list"[\s\S]{0,80}Navigate\s+to="\/tournaments\//.test(router),
    false
  );
  assert.equal(
    /path="\/tournament\/create"[\s\S]{0,80}Navigate\s+to="\/tournaments\//.test(router),
    false
  );

  const leaves = flattenCanonicalMenu(
    filterCanonicalMenu(
      {
        user: { id: "u", role: "SUPER_ADMIN" },
        rbacEnabled: true,
        permissions: ["*"],
        hasPermission: () => true,
        isAuthenticated: true,
      },
      { viewport: "desktop" }
    )
  );
  const visibleLegacyTournamentRoutes = leaves
    .map((n) => n.route)
    .filter((route) => route === "/tournament" || route?.startsWith("/tournament/"));

  assert.deepEqual(
    [...visibleLegacyTournamentRoutes].sort(),
    [...B02_TOURNAMENT_HUB_MENU_ALLOWLIST].sort()
  );
  assert.equal(
    visibleLegacyTournamentRoutes.some((route) => !B02_TOURNAMENT_HUB_MENU_ALLOWLIST.includes(route)),
    false
  );
});

test("phase4 plural — ownership fail-closed when tournament cannot be resolved", () => {
  const result = evaluateTournamentEngineRouteAccess({
    pathname: "/tournaments/does-not-exist-zz/engine",
    user: { id: "u1", role: "SUPER_ADMIN", tenantId: "t1" },
    activeClubId: "club-missing",
    forceAuthz: true,
    tenantId: "t1",
  });
  assert.equal(result.ok, false);
  assert.ok(["TOURNAMENT_NOT_FOUND", "NOT_FOUND", "FORBIDDEN"].includes(result.code));
});

test("phase4 plural — RouteAccessGate wires decideTournamentEngineRouteGate (not RBAC-only)", () => {
  const gate = readFileSync(join(root, "src/components/auth/RouteAccessGate.jsx"), "utf8");
  assert.match(gate, /decideTournamentEngineRouteGate/);
  assert.equal(gate.includes("rbacEnabled &&\n      shouldRedirectToForbidden"), false);
  const enginePage = readFileSync(join(root, "src/pages/tournament/TournamentEnginePage.jsx"), "utf8");
  assert.match(enginePage, /navigate\("\/tournaments"\)/);
  assert.equal(enginePage.includes('navigate("/tournament")'), false);
});

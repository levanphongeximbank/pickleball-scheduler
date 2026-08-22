/**
 * Wave 0 P0 — Tournament Experience organizer direct-URL authorization.
 */
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getRouteAccessPermissions, canAccessRoute } from "../src/auth/menuAccess.js";
import {
  TOURNAMENT_EXPERIENCE_ORGANIZER_SEGMENTS,
  isTournamentExperienceOrganizerPath,
  isTournamentExperienceRegisterPath,
  isTournamentExperiencePublicPath,
  resolveTournamentExperienceRoutePermissions,
} from "../src/auth/tournamentExperienceRouteAccess.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { ROLES } from "../src/auth/roles.js";
import { can } from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";
import { shouldRedirectToForbidden } from "../src/auth/authGuard.js";
import { saveClubs } from "../src/data/club.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TID = "exp-wave0-t1";
const VENUE_A = "venue-a";
const VENUE_B = "venue-b";
const CLUB_A = "club-1";
const CLUB_B = "club-2";
const SCOPE_A = { clubId: CLUB_A, venueId: VENUE_A, tenantId: VENUE_A };
const RBAC_ON = { rbacEnabled: true };

const ORGANIZER_SEGMENTS = [
  "overview",
  "settings",
  "registration",
  "participants",
  "pairs",
  "pair-draw",
  "group-draw",
  "groups",
  "schedule",
  "matches",
  "standings",
  "knockout",
  "bracket",
  "director",
  "courts",
  "referees",
  "exceptions",
  "communications",
  "media",
  "awards",
  "complete",
];

const HIGH_RISK = [
  "settings",
  "participants",
  "schedule",
  "director",
  "referees",
  "communications",
  "media",
  "awards",
  "complete",
  "overview",
  "matches",
  "standings",
  "knockout",
  "bracket",
];

function createLocalStorageMock() {
  const store = new Map();
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

function seedClubs() {
  saveClubs([
    { id: CLUB_A, name: "CLB Wave0 A", venueId: VENUE_A, tenantId: VENUE_A },
    { id: CLUB_B, name: "CLB Wave0 B", venueId: VENUE_B, tenantId: VENUE_B },
  ]);
}

function experiencePath(segment) {
  return `/tournament/${TID}/${segment}`;
}

function user(role, extra = {}) {
  const normalized = String(role || "");
  const needsClubEntitlement =
    normalized === ROLES.CLUB_MANAGER ||
    normalized === ROLES.CLUB_OWNER ||
    normalized === "CLUB_MANAGER" ||
    normalized === "CLUB_OWNER";

  return createUserRecord({
    id: `u-${String(role).toLowerCase()}`,
    role,
    venueId: VENUE_A,
    tenantId: VENUE_A,
    clubId: CLUB_A,
    playerId: role === ROLES.PLAYER ? "p-1" : undefined,
    status: "active",
    ...(needsClubEntitlement
      ? {
          entitlementEvidence: {
            clubs: [{ clubId: CLUB_A, status: "active" }],
          },
        }
      : {}),
    ...extra,
  });
}

function checker(roleUser, scope = SCOPE_A) {
  return (pathname) =>
    canAccessRoute(
      (permission, routeScope) => can(roleUser, permission, routeScope, RBAC_ON),
      pathname,
      scope,
      roleUser
    );
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  seedClubs();
});

afterEach(() => {
  delete globalThis.localStorage;
});

test("wave0 classification — organizer segment set matches Owner final matrix", () => {
  assert.deepEqual(
    [...TOURNAMENT_EXPERIENCE_ORGANIZER_SEGMENTS].sort(),
    [...ORGANIZER_SEGMENTS].sort()
  );
  for (const segment of ORGANIZER_SEGMENTS) {
    assert.equal(isTournamentExperienceOrganizerPath(experiencePath(segment)), true, segment);
  }
  assert.equal(isTournamentExperienceRegisterPath(experiencePath("register")), true);
  assert.equal(isTournamentExperiencePublicPath(experiencePath("public")), true);
  assert.equal(isTournamentExperienceOrganizerPath(experiencePath("register")), false);
  assert.equal(isTournamentExperienceOrganizerPath(experiencePath("public")), false);
});

test("wave0 getRouteAccessPermissions — organizer workspace requires TOURNAMENT_UPDATE", () => {
  for (const segment of ORGANIZER_SEGMENTS) {
    const path = experiencePath(segment);
    assert.deepEqual(getRouteAccessPermissions(path), [PERMISSIONS.TOURNAMENT_UPDATE], path);
  }
});

test("wave0 getRouteAccessPermissions — register + public remain TOURNAMENT_VIEW", () => {
  assert.deepEqual(getRouteAccessPermissions(experiencePath("register")), [
    PERMISSIONS.TOURNAMENT_VIEW,
  ]);
  assert.deepEqual(getRouteAccessPermissions(experiencePath("public")), [
    PERMISSIONS.TOURNAMENT_VIEW,
  ]);
});

test("wave0 getRouteAccessPermissions — hubs / legacy /tournament/* stay VIEW fallthrough", () => {
  assert.deepEqual(getRouteAccessPermissions("/tournament"), [PERMISSIONS.TOURNAMENT_VIEW]);
  assert.deepEqual(getRouteAccessPermissions("/tournament/list"), [PERMISSIONS.TOURNAMENT_VIEW]);
  assert.deepEqual(getRouteAccessPermissions("/tournament/my"), [PERMISSIONS.TOURNAMENT_VIEW]);
  assert.deepEqual(getRouteAccessPermissions(`/tournament/my/${TID}`), [
    PERMISSIONS.TOURNAMENT_VIEW,
  ]);
  assert.deepEqual(getRouteAccessPermissions("/tournament/organize"), [
    PERMISSIONS.TOURNAMENT_VIEW,
  ]);
  assert.deepEqual(getRouteAccessPermissions("/tournament/bracket"), [
    PERMISSIONS.TOURNAMENT_VIEW,
  ]);
});

test("wave0 getRouteAccessPermissions — referee runtime unchanged", () => {
  assert.deepEqual(getRouteAccessPermissions("/referee"), [
    PERMISSIONS.TOURNAMENT_VIEW,
    PERMISSIONS.MATCH_UPDATE,
  ]);
  assert.deepEqual(getRouteAccessPermissions("/referee/match/m-1"), []);
});

test("wave0 A — PLAYER direct URL to organizer routes = DENY", () => {
  const check = checker(user(ROLES.PLAYER));
  for (const segment of HIGH_RISK) {
    assert.equal(check(experiencePath(segment)), false, `PLAYER must be denied ${segment}`);
  }
  for (const segment of ORGANIZER_SEGMENTS) {
    assert.equal(check(experiencePath(segment)), false, `PLAYER denied ${segment}`);
  }
});

test("wave0 B — authorized organizer roles = ALLOW", () => {
  const organizers = [
    ROLES.PLATFORM_ADMIN,
    ROLES.SUPER_ADMIN,
    ROLES.TENANT_OWNER,
    ROLES.VENUE_OWNER,
    ROLES.VENUE_MANAGER,
    ROLES.TOURNAMENT_MANAGER,
    ROLES.CLUB_MANAGER,
    ROLES.CLUB_OWNER,
  ];
  for (const role of organizers) {
    const check = checker(user(role));
    for (const segment of HIGH_RISK) {
      assert.equal(check(experiencePath(segment)), true, `${role} allow ${segment}`);
    }
  }
});

test("wave0 C — public + register access unchanged for PLAYER", () => {
  const check = checker(user(ROLES.PLAYER));
  assert.equal(check(experiencePath("register")), true);
  assert.equal(check(experiencePath("public")), true);
  assert.equal(check("/tournament"), true);
  assert.equal(check("/tournament/my"), true);
});

test("wave0 D — menu-hidden but direct-URL still denied for PLAYER", () => {
  const player = user(ROLES.PLAYER);
  assert.equal(can(player, PERMISSIONS.TOURNAMENT_VIEW, SCOPE_A, RBAC_ON), true);
  assert.equal(can(player, PERMISSIONS.TOURNAMENT_UPDATE, SCOPE_A, RBAC_ON), false);
  assert.equal(checker(player)(experiencePath("settings")), false);
  assert.equal(checker(player)(experiencePath("director")), false);
});

test("wave0 E — tenant/club scope preserved for organizer UPDATE", () => {
  const homeOwner = user(ROLES.VENUE_OWNER, {
    venueId: VENUE_A,
    tenantId: VENUE_A,
    clubId: CLUB_A,
  });
  const foreignOwner = user(ROLES.VENUE_OWNER, {
    id: "u-foreign-owner",
    venueId: VENUE_B,
    tenantId: VENUE_B,
    clubId: CLUB_B,
  });
  const path = experiencePath("settings");

  assert.equal(checker(homeOwner)(path), true);
  assert.equal(
    checker(foreignOwner)(path),
    false,
    "foreign venue owner must not pass club/venue scoped UPDATE"
  );
});

test("wave0 F — TOURNAMENT_VIEW alone cannot grant organizer workspace", () => {
  const viewOnlyRoles = [ROLES.PLAYER, ROLES.COACH, ROLES.REFEREE, ROLES.STAFF];
  for (const role of viewOnlyRoles) {
    const roleUser = user(role);
    assert.equal(can(roleUser, PERMISSIONS.TOURNAMENT_VIEW, SCOPE_A, RBAC_ON), true, role);
    assert.equal(can(roleUser, PERMISSIONS.TOURNAMENT_UPDATE, SCOPE_A, RBAC_ON), false, role);
    assert.equal(checker(roleUser)(experiencePath("overview")), false, role);
    assert.equal(checker(roleUser)(experiencePath("standings")), false, role);
    assert.equal(checker(roleUser)(experiencePath("complete")), false, role);
  }

  // TEAM_CAPTAIN has TOURNAMENT_VIEW in role matrix but team-scoped evaluation may
  // deny VIEW without tournament binding; still must never open organizer workspace.
  const captain = user(ROLES.TEAM_CAPTAIN, { tournamentId: TID });
  assert.equal(can(captain, PERMISSIONS.TOURNAMENT_UPDATE, SCOPE_A, RBAC_ON), false);
  assert.equal(checker(captain)(experiencePath("overview")), false);
  assert.equal(checker(captain)(experiencePath("complete")), false);

  const cashier = user(ROLES.CASHIER);
  assert.equal(can(cashier, PERMISSIONS.TOURNAMENT_VIEW, SCOPE_A, RBAC_ON), false);
  assert.equal(checker(cashier)(experiencePath("settings")), false);
});

test("wave0 — REFEREE runtime allow; Experience organizer DENY", () => {
  const check = checker(user(ROLES.REFEREE));
  assert.equal(check("/referee"), true);
  assert.equal(check("/referee/match/m-1"), true);
  assert.equal(check(experiencePath("referees")), false);
  assert.equal(check(experiencePath("director")), false);
});

test("wave0 — COACH organizer workspace DENY", () => {
  const check = checker(user(ROLES.COACH));
  assert.equal(check(experiencePath("overview")), false);
  assert.equal(check(experiencePath("settings")), false);
  assert.equal(check(experiencePath("register")), true);
});

test("wave0 — authGuard forbidden decision for PLAYER organizer URL", () => {
  const player = user(ROLES.PLAYER);
  const canFn = (permission, scope) => can(player, permission, scope, RBAC_ON);
  for (const segment of ["settings", "director", "standings", "complete"]) {
    assert.equal(
      shouldRedirectToForbidden(experiencePath(segment), {
        rbacEnabled: true,
        isAuthenticated: true,
        can: canFn,
        scope: SCOPE_A,
        user: player,
      }),
      true,
      segment
    );
  }
  assert.equal(
    shouldRedirectToForbidden(experiencePath("register"), {
      rbacEnabled: true,
      isAuthenticated: true,
      can: canFn,
      scope: SCOPE_A,
      user: player,
    }),
    false
  );
});

test("wave0 — unknown /tournament/:id/<segment> fails closed to UPDATE", () => {
  assert.deepEqual(getRouteAccessPermissions(`/tournament/${TID}/secret-ops`), [
    PERMISSIONS.TOURNAMENT_UPDATE,
  ]);
  assert.equal(checker(user(ROLES.PLAYER))(`/tournament/${TID}/secret-ops`), false);
});

test("wave0 — resolve helper returns null for non-experience hubs", () => {
  assert.equal(resolveTournamentExperienceRoutePermissions("/tournament/list"), null);
  assert.equal(resolveTournamentExperienceRoutePermissions("/tournament/config/settings"), null);
  assert.equal(resolveTournamentExperienceRoutePermissions("/tournament/director/x"), null);
  assert.equal(resolveTournamentExperienceRoutePermissions("/referee"), null);
});

test("wave0 — RouteAccessGate still owns denial (no parallel guard / no UI redesign)", () => {
  const gate = readFileSync(join(root, "src/components/auth/RouteAccessGate.jsx"), "utf8");
  const menu = readFileSync(join(root, "src/auth/menuAccess.js"), "utf8");
  assert.match(gate, /shouldRedirectToForbidden/);
  assert.match(gate, /Navigate to="\/403"/);
  assert.match(menu, /resolveTournamentExperienceRoutePermissions/);
  assert.equal(gate.includes("tournamentExperienceRouteAccess"), false);
});

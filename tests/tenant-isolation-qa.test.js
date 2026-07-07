/**
 * Phase Tenant Isolation QA — automated app-layer checks
 * Bổ sung cho browser QA: Owner A vs Owner B isolation logic.
 */
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import { canAccessVenue } from "../src/auth/rbac.js";
import { guardClubAccess } from "../src/auth/guardAction.js";
import {
  guardClubTenant,
  listClubsForTenant,
  assertSameTenant,
} from "../src/features/tenant/guards/tenantGuard.js";
import { saveClubs, setActiveClubId } from "../src/data/club.js";
import { saveCourtsForClub } from "../src/domain/clubStorage.js";
import {
  loadCourtsForVenueScoped,
  loadCourtsForClubScoped,
} from "../src/domain/courtService.js";
import { normalizeCourt } from "../src/models/court.js";
import { assertTournamentAccess } from "../src/domain/tournamentService.js";
import { createTournament } from "../src/domain/tournamentService.js";
import { enableRbac, signInAs, signOut } from "../src/auth/authService.js";

const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const CLUB_A = "club-staging-a";
const CLUB_B = "club-staging-b";

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

function ownerA() {
  return createUserRecord({
    role: ROLES.VENUE_OWNER,
    venueId: TENANT_A,
    tenantId: TENANT_A,
    email: "owner@staging.local",
  });
}

function ownerB() {
  return createUserRecord({
    role: ROLES.VENUE_OWNER,
    venueId: TENANT_B,
    tenantId: TENANT_B,
    email: "owner-b@staging.local",
  });
}

function seedTenantIsolationClubs() {
  saveClubs([
    {
      id: CLUB_A,
      name: "CLB Staging A",
      venueId: TENANT_A,
      tenantId: TENANT_A,
    },
    {
      id: CLUB_B,
      name: "CLB Staging B",
      venueId: TENANT_B,
      tenantId: TENANT_B,
    },
  ]);

  saveCourtsForClub(
    ["court-a1", "court-a2", "court-a3"].map((id, index) =>
      normalizeCourt({
        id,
        name: `Sân A${index + 1}`,
        number: index + 1,
        active: true,
        tenantId: TENANT_A,
      })
    ),
    CLUB_A
  );

  saveCourtsForClub(
    ["court-b1", "court-b2", "court-b3", "court-b4", "court-b5"].map((id, index) =>
      normalizeCourt({
        id,
        name: `Sân B${index + 1}`,
        number: index + 1,
        active: true,
        tenantId: TENANT_B,
      })
    ),
    CLUB_B
  );
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac();
  seedTenantIsolationClubs();
});

afterEach(() => {
  signOut();
  delete globalThis.localStorage;
});

test("G3 — Owner A thấy 3 sân, Owner B thấy 5 sân", () => {
  const courtsA = loadCourtsForVenueScoped(TENANT_A, TENANT_A);
  const courtsB = loadCourtsForVenueScoped(TENANT_B, TENANT_B);

  assert.equal(courtsA.length, 3);
  assert.equal(courtsB.length, 5);
  assert.ok(courtsA.every((court) => court.name.startsWith("Sân A")));
  assert.ok(courtsB.every((court) => court.name.startsWith("Sân B")));
});

test("CL1 — listClubsForTenant chỉ trả CLB thuộc tenant", () => {
  const clubsA = listClubsForTenant(TENANT_A);
  const clubsB = listClubsForTenant(TENANT_B);

  assert.deepEqual(
    clubsA.map((club) => club.id),
    [CLUB_A]
  );
  assert.deepEqual(
    clubsB.map((club) => club.id),
    [CLUB_B]
  );
});

test("N1 — guardClubAccess chặn owner A truy cập CLB B", () => {
  const access = guardClubAccess(CLUB_B, {
    user: ownerA(),
    rbacEnabled: true,
  });

  assert.equal(access.ok, false);
  assert.match(String(access.error || ""), /tenant|CLB|quyền/i);
});

test("N1 — guardClubTenant chặn cross-tenant club", () => {
  const check = guardClubTenant(CLUB_B, TENANT_A, {
    user: ownerA(),
    rbacEnabled: true,
  });

  assert.equal(check.ok, false);
  assert.equal(check.code, "TENANT_FORBIDDEN");
});

test("N3 — đổi active club sang CLB B khi user là owner A bị guard chặn", () => {
  const user = ownerA();
  setActiveClubId(CLUB_B);

  const access = guardClubAccess(CLUB_B, { user, rbacEnabled: true });
  assert.equal(access.ok, false);
});

test("VENUE_OWNER không truy cập venue khác", () => {
  assert.equal(canAccessVenue(ownerA(), TENANT_A, RBAC_ON), true);
  assert.equal(canAccessVenue(ownerA(), TENANT_B, RBAC_ON), false);
  assert.equal(canAccessVenue(ownerB(), TENANT_B, RBAC_ON), true);
  assert.equal(canAccessVenue(ownerB(), TENANT_A, RBAC_ON), false);
});

test("loadCourtsForClubScoped — owner A không load sân CLB B", () => {
  assert.equal(loadCourtsForClubScoped(CLUB_B, TENANT_A).length, 0);
  assert.equal(loadCourtsForClubScoped(CLUB_A, TENANT_A).length, 3);
});

test("T1 — tournament tenant A không truy cập được từ scope B", () => {
  signInAs(ownerA());
  setActiveClubId(CLUB_A);

  const tournament = createTournament({
    name: "Giải A",
    clubId: CLUB_A,
    meta: { tenantId: TENANT_A, clubId: CLUB_A },
  });

  signOut();
  signInAs(ownerB());

  const access = assertTournamentAccess(CLUB_A, tournament.id, {
    user: ownerB(),
    rbacEnabled: true,
  });
  assert.equal(access.ok, false);
});

test("assertSameTenant — bidirectional isolation", () => {
  assert.equal(assertSameTenant(TENANT_A, TENANT_A).ok, true);
  assert.equal(assertSameTenant(TENANT_B, TENANT_B).ok, true);
  assert.equal(assertSameTenant(TENANT_A, TENANT_B).ok, false);
  assert.equal(assertSameTenant(TENANT_B, TENANT_A).ok, false);
});

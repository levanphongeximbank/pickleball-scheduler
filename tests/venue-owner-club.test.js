import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { enableRbac, signInAs, signOut } from "../src/auth/authService.js";
import { canAccessClub } from "../src/auth/rbac.js";
import { guardClubAccess } from "../src/auth/guardAction.js";
import { createUserRecord } from "../src/models/user.js";
import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../src/data/club.js";
import { saveVenues, saveSubscriptions } from "../src/data/venue.js";
import { createVenueRecord } from "../src/models/venue.js";
import { createSubscriptionRecord } from "../src/models/subscription.js";
import {
  getDefaultClubData,
  saveClubData,
  saveCourtsForClub,
} from "../src/domain/clubStorage.js";
import { ensureWritableClubForVenueOwner } from "../src/features/club/services/venueOwnerClubService.js";
import { saveCourts, createCourtsBulk, validateCourtLimitBulk } from "../src/pages/courts.logic.js";
import { normalizeCourt } from "../src/models/court.js";
import { getClubById } from "../src/domain/clubService.js";

const RBAC_ON = { rbacEnabled: true };
const VENUE_ID = "venue-owner-test";

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

function venueOwner(extra = {}) {
  return createUserRecord({
    role: ROLES.TENANT_OWNER,
    venueId: VENUE_ID,
    tenantId: VENUE_ID,
    ...extra,
  });
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  enableRbac(false);
  signOut();

  saveVenues([
    createVenueRecord("Pickleball Test", {
      id: VENUE_ID,
      status: "trial",
    }),
  ]);
  saveSubscriptions({
    [VENUE_ID]: createSubscriptionRecord(VENUE_ID, "trial"),
  });
});

afterEach(() => {
  signOut();
  enableRbac(false);
  delete globalThis.localStorage;
});

test("canAccessClub — venue owner được phép khi registry venueId khớp dù tenantId blob lệch", () => {
  saveClubs([
    {
      id: "club-mismatch",
      name: "CLB mismatch",
      venueId: VENUE_ID,
      tenantId: "legacy-wrong-tenant",
    },
  ]);

  const owner = venueOwner();
  assert.equal(canAccessClub(owner, "club-mismatch", {}, RBAC_ON), true);
});

test("guardClubAccess — auto-bind venueId cho CLB chưa gắn cơ sở", () => {
  saveClubs([
    {
      id: "club-untagged",
      name: "CLB untagged",
    },
  ]);
  saveClubData("club-untagged", getDefaultClubData("club-untagged"));

  const owner = venueOwner();
  const access = guardClubAccess("club-untagged", { user: owner, rbacEnabled: true });
  assert.equal(access.ok, true);

  const club = getClubById("club-untagged");
  assert.equal(club.venueId, VENUE_ID);
  assert.equal(club.tenantId, VENUE_ID);
});

test("saveCourts — venue owner lưu sân khi club.venueId khớp profile", () => {
  saveClubs([
    {
      id: "club-mismatch",
      name: "CLB mismatch",
      venueId: VENUE_ID,
      tenantId: "legacy-wrong-tenant",
    },
  ]);
  saveClubData("club-mismatch", getDefaultClubData("club-mismatch"));

  enableRbac(true);
  signInAs(venueOwner());
  setActiveClubId("club-mismatch");

  const result = saveCourts(
    [normalizeCourt({ id: "court-1", name: "Sân 1", number: 1, active: true })],
    "club-mismatch",
    { permission: PERMISSIONS.COURT_CREATE }
  );

  assert.equal(result.ok, true);
});

test("ensureWritableClubForVenueOwner — tạo CLB khi chưa có club thuộc venue", () => {
  saveClubs([DEFAULT_CLUB]);
  saveClubData(DEFAULT_CLUB.id, getDefaultClubData(DEFAULT_CLUB.id));

  enableRbac(true);
  const owner = venueOwner();
  signInAs(owner);

  const ensured = ensureWritableClubForVenueOwner(owner, { activeClubId: DEFAULT_CLUB.id });
  assert.equal(ensured.ok, true);
  assert.ok(ensured.clubId);
  assert.equal(ensured.created, true);

  const club = getClubById(ensured.clubId);
  assert.equal(club.venueId, VENUE_ID);
});

test("createCourtsBulk + validateCourtLimitBulk — chặn vượt maxCourts gói trial", () => {
  saveClubs([
    {
      id: "club-a",
      name: "CLB A",
      venueId: VENUE_ID,
      tenantId: VENUE_ID,
    },
  ]);
  saveClubData("club-a", getDefaultClubData("club-a"));
  saveCourtsForClub(
    [
      normalizeCourt({ id: "c1", name: "Sân 1", number: 1, active: true }),
      normalizeCourt({ id: "c2", name: "Sân 2", number: 2, active: true }),
    ],
    "club-a"
  );

  const limitError = validateCourtLimitBulk("club-a", 3);
  assert.ok(limitError);
  assert.match(limitError, /tối đa 4 sân/i);

  const courts = createCourtsBulk(
    [
      normalizeCourt({ id: "c1", name: "Sân 1", number: 1, active: true }),
      normalizeCourt({ id: "c2", name: "Sân 2", number: 2, active: true }),
    ],
    2
  );
  assert.equal(courts.length, 4);
  assert.equal(courts[2].name, "Sân 3");
  assert.equal(courts[3].name, "Sân 4");
});

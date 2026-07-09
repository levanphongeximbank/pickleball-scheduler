import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import { saveClubs } from "../src/data/club.js";
import { canAccessClub } from "../src/auth/rbac.js";
import { getClubsVisibleToUser } from "../src/features/club/services/clubAccessService.js";
import { enableRbac } from "../src/auth/authService.js";

const TENANT_A = "venue-a";
const TENANT_B = "venue-b";
const CLUB_A = "club-a";
const CLUB_B = "club-b";

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

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac();
  saveClubs([
    { id: CLUB_A, name: "CLB A", venueId: TENANT_A, tenantId: TENANT_A },
    { id: CLUB_B, name: "CLB B", venueId: TENANT_B, tenantId: TENANT_B },
  ]);
});

afterEach(() => {
  delete globalThis.localStorage;
});

test("SUPER_ADMIN thấy tất cả CLB kể cả tenant khác", () => {
  const user = createUserRecord({ role: ROLES.SUPER_ADMIN, status: "active" });
  const clubs = getClubsVisibleToUser(TENANT_A, user);

  assert.equal(clubs.length, 2);
  assert.ok(clubs.some((club) => club.id === CLUB_B));
});

test("SYSTEM_TECHNICIAN (Admin) thấy tất cả CLB", () => {
  const user = createUserRecord({ role: ROLES.SYSTEM_TECHNICIAN, status: "active" });
  const clubs = getClubsVisibleToUser(TENANT_A, user);

  assert.equal(clubs.length, 2);
});

test("SYSTEM_TECHNICIAN truy cập CLB tenant khác", () => {
  const user = createUserRecord({ role: ROLES.SYSTEM_TECHNICIAN, status: "active" });

  assert.equal(
    canAccessClub(user, CLUB_B, { venueId: TENANT_B }, { rbacEnabled: true }),
    true
  );
});

test("VENUE_OWNER chỉ thấy CLB trong tenant", () => {
  const user = createUserRecord({
    role: ROLES.VENUE_OWNER,
    venueId: TENANT_A,
    tenantId: TENANT_A,
    status: "active",
  });
  const clubs = getClubsVisibleToUser(TENANT_A, user);

  assert.equal(clubs.length, 1);
  assert.equal(clubs[0].id, CLUB_A);
});

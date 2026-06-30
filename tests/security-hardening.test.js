import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import {
  enableRbac,
  signInAs,
  signInDev,
  isDevAuthAllowed,
} from "../src/auth/authService.js";
import {
  mapUserToSelfProfilePatch,
  mapUserToProfileRow,
  resolveAuthUserFromProfile,
  SELF_EDITABLE_PROFILE_FIELDS,
} from "../src/auth/profileService.js";
import { createUserRecord } from "../src/models/user.js";
import { getSupabaseClient } from "../src/domain/matchLiveSync.js";
import { getSupabaseAuthClient, hasSupabaseConfig } from "../src/auth/supabaseClient.js";

const HAS_SUPABASE_ENV = hasSupabaseConfig();

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

test("security v3.5.7 — mapUserToSelfProfilePatch không gồm role/venue/club/status", () => {
  const user = createUserRecord({
    id: "u1",
    email: "p@test.vn",
    displayName: "Player A",
    role: ROLES.SUPER_ADMIN,
    venueId: "venue-a",
    clubId: "club-1",
    status: "active",
  });

  const patch = mapUserToSelfProfilePatch(user);
  assert.equal(patch.display_name, "Player A");
  assert.equal("role" in patch, false);
  assert.equal("venue_id" in patch, false);
  assert.equal("club_id" in patch, false);
  assert.equal("status" in patch, false);
  assert.ok(SELF_EDITABLE_PROFILE_FIELDS.includes("display_name"));
});

test("security v3.5.7 — mapUserToProfileRow staff vẫn có role (invite admin)", () => {
  const row = mapUserToProfileRow(
    createUserRecord({
      id: "u2",
      email: "m@test.vn",
      role: ROLES.VENUE_MANAGER,
      venueId: "venue-a",
    })
  );
  assert.equal(row.role, ROLES.VENUE_MANAGER);
  assert.equal(row.venue_id, "venue-a");
});

test("security v3.5.7 — secure runtime bắt buộc profile, bỏ metadata role", () => {
  if (!HAS_SUPABASE_ENV) {
    return;
  }

  const authUser = {
    id: "uuid-x",
    email: "x@test.vn",
    user_metadata: { role: "SUPER_ADMIN" },
  };

  const result = resolveAuthUserFromProfile(
    authUser,
    { ok: false, code: "PROFILE_NOT_FOUND", error: "Không tìm thấy profile." },
    { rbacEnabled: false }
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "PROFILE_NOT_FOUND");
});

test("security v3.5.7 — dev local cho metadata fallback PLAYER khi RBAC tắt", () => {
  if (HAS_SUPABASE_ENV) {
    return;
  }

  const authUser = {
    id: "uuid-x",
    email: "x@test.vn",
    user_metadata: {},
  };

  const result = resolveAuthUserFromProfile(
    authUser,
    { ok: false, code: "PROFILE_NOT_FOUND", error: "Không tìm thấy profile." },
    { rbacEnabled: false }
  );

  assert.equal(result.ok, true);
  assert.equal(result.user.role, ROLES.PLAYER);
});

test("security v3.5.7 — user thường không nâng quyền qua resolveAuthUserFromProfile", () => {
  const authUser = {
    id: "uuid-1",
    email: "player@test.vn",
    user_metadata: { role: "SUPER_ADMIN" },
  };
  const profileResult = {
    ok: true,
    user: createUserRecord({
      id: "uuid-1",
      email: "player@test.vn",
      role: ROLES.PLAYER,
      venueId: "venue-a",
      clubId: "club-1",
      status: "active",
    }),
  };

  const resolved = resolveAuthUserFromProfile(authUser, profileResult, { rbacEnabled: true });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.user.role, ROLES.PLAYER);
});

test("security v3.5.7 — enableRbac / signInDev / signInAs khóa khi secure runtime", () => {
  globalThis.localStorage = createLocalStorageMock();

  if (!HAS_SUPABASE_ENV) {
    assert.equal(isDevAuthAllowed(), true);
    const dev = signInDev("owner@venue.local");
    assert.equal(dev.ok, true);

    const rbac = enableRbac(true);
    assert.equal(rbac.ok, true);
    return;
  }

  assert.equal(isDevAuthAllowed(), false);

  const devDenied = signInDev("owner@venue.local");
  assert.equal(devDenied.ok, false);
  assert.equal(devDenied.code, "DEV_AUTH_DISABLED");

  const asDenied = signInAs(
    createUserRecord({ id: "x", email: "x@t.vn", role: ROLES.SUPER_ADMIN })
  );
  assert.equal(asDenied.ok, false);

  const rbacLocked = enableRbac(false);
  assert.equal(rbacLocked.ok, false);
  assert.equal(rbacLocked.code, "RBAC_LOCKED");
});

test("security v3.5.7 — Director getSupabaseClient dùng auth client khi có Supabase", () => {
  if (!HAS_SUPABASE_ENV) {
    assert.equal(getSupabaseClient(), null);
    return;
  }

  const staffClient = getSupabaseClient();
  const authClient = getSupabaseAuthClient();
  assert.ok(staffClient);
  assert.equal(staffClient, authClient);
});

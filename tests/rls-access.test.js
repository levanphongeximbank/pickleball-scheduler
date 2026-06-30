import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import {
  can,
  canAccessVenue,
  canAccessClub,
  isRbacEnforced,
} from "../src/auth/rbac.js";
import { resolveAuthUserFromProfile } from "../src/auth/profileService.js";
import { mapProfileRowToUser } from "../src/auth/profileService.js";
import { createUserRecord } from "../src/models/user.js";
import { USER_STATUS } from "../src/models/user.js";

const RBAC_ON = { rbacEnabled: true };

function user(role, extra = {}) {
  return createUserRecord({ role, status: USER_STATUS.ACTIVE, ...extra });
}

test("RLS intent — RBAC bật, thiếu profile → từ chối đăng nhập", () => {
  const authUser = { id: "u1", email: "no-profile@test.vn", user_metadata: {} };
  const result = resolveAuthUserFromProfile(
    authUser,
    { ok: false, code: "PROFILE_NOT_FOUND", error: "Không tìm thấy profile." },
    { rbacEnabled: true }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "PROFILE_NOT_FOUND");
});

test("RLS intent — user suspended → mọi permission bị chặn", () => {
  const suspended = user(ROLES.VENUE_OWNER, {
    venueId: "venue-a",
    status: USER_STATUS.SUSPENDED,
  });
  assert.equal(isRbacEnforced({ rbacEnabled: true, user: suspended }), true);
  assert.equal(
    can(suspended, PERMISSIONS.VENUE_MANAGE, { venueId: "venue-a" }, RBAC_ON),
    false
  );
  assert.equal(canAccessVenue(suspended, "venue-a", RBAC_ON), false);
});

test("RLS intent — VENUE_OWNER sai venue_id", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a" });

  assert.equal(can(owner, PERMISSIONS.VENUE_MANAGE, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(owner, PERMISSIONS.VENUE_MANAGE, { venueId: "venue-b" }, RBAC_ON), false);
  assert.equal(canAccessVenue(owner, "venue-b", RBAC_ON), false);
});

test("RLS intent — CLUB_OWNER sai club_id", () => {
  const clubOwner = user(ROLES.CLUB_OWNER, {
    venueId: "venue-a",
    clubId: "club-1",
  });

  assert.equal(
    canAccessClub(clubOwner, "club-1", { venueId: "venue-a" }, RBAC_ON),
    true
  );
  assert.equal(
    canAccessClub(clubOwner, "club-2", { venueId: "venue-a" }, RBAC_ON),
    false
  );
  assert.equal(
    can(clubOwner, PERMISSIONS.PLAYERS_MANAGE, { clubId: "club-2", venueId: "venue-a" }, RBAC_ON),
    false
  );
});

test("RLS intent — VENUE_MANAGER chỉ thao tác trong venue được gán", () => {
  const manager = user(ROLES.VENUE_MANAGER, { venueId: "venue-a", clubId: "club-1" });

  assert.equal(can(manager, PERMISSIONS.COURTS_MANAGE, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(manager, PERMISSIONS.COURTS_MANAGE, { venueId: "venue-x" }, RBAC_ON), false);
  assert.equal(can(manager, PERMISSIONS.SYSTEM_MANAGE, {}, RBAC_ON), false);
});

test("RLS intent — CASHIER chỉ booking/payment trong venue", () => {
  const cashier = user(ROLES.CASHIER, { venueId: "venue-a" });

  assert.equal(can(cashier, PERMISSIONS.BOOKINGS_VIEW, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(cashier, PERMISSIONS.PAYMENTS_COLLECT, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(cashier, PERMISSIONS.BOOKINGS_VIEW, { venueId: "venue-b" }, RBAC_ON), false);
  assert.equal(can(cashier, PERMISSIONS.PLAYERS_MANAGE, { clubId: "club-1" }, RBAC_ON), false);
  assert.equal(can(cashier, PERMISSIONS.ACCOUNTING_EXPORT, { venueId: "venue-a" }, RBAC_ON), false);
});

test("RLS intent — PLAYER chỉ dữ liệu club/player của mình", () => {
  const player = user(ROLES.PLAYER, {
    venueId: "venue-a",
    clubId: "club-1",
    playerId: "p-1",
  });

  assert.equal(
    can(player, PERMISSIONS.PLAYER_SCHEDULE_VIEW, { clubId: "club-1", playerId: "p-1" }, RBAC_ON),
    true
  );
  assert.equal(
    can(player, PERMISSIONS.PLAYER_SCHEDULE_VIEW, { clubId: "club-2", playerId: "p-1" }, RBAC_ON),
    false
  );
  assert.equal(
    can(player, PERMISSIONS.PLAYER_PROFILE_VIEW, { clubId: "club-1", playerId: "p-2" }, RBAC_ON),
    false
  );
  assert.equal(
    can(player, PERMISSIONS.PLAYERS_VIEW, { clubId: "club-1" }, RBAC_ON),
    false
  );
});

test("RLS intent — SUPER_ADMIN xem mọi scope", () => {
  const admin = user(ROLES.SUPER_ADMIN);

  assert.equal(can(admin, PERMISSIONS.CLUB_DELETE, { clubId: "any-club" }, RBAC_ON), true);
  assert.equal(canAccessVenue(admin, "any-venue", RBAC_ON), true);
  assert.equal(canAccessClub(admin, "any-club", {}, RBAC_ON), true);
});

test("RLS intent — profile hợp lệ từ DB, không dùng metadata role", () => {
  const authUser = {
    id: "uuid-1",
    email: "x@test.vn",
    user_metadata: { role: "SUPER_ADMIN" },
  };
  const profileResult = {
    ok: true,
    user: mapProfileRowToUser({
      id: "uuid-1",
      email: "x@test.vn",
      display_name: "Player",
      role: "PLAYER",
      venue_id: "venue-a",
      club_id: "club-1",
      player_id: "p-1",
      status: "active",
    }),
  };

  const resolved = resolveAuthUserFromProfile(authUser, profileResult, { rbacEnabled: true });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.user.role, ROLES.PLAYER);
  assert.equal(resolved.user.clubId, "club-1");
  assert.equal(resolved.user.venueId, "venue-a");
});

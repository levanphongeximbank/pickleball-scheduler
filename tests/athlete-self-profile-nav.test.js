import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import {
  MENU_GROUPS,
  MOBILE_BOTTOM_NAV_PROFILES,
  ROUTE_PERMISSIONS,
} from "../src/config/navigationConfig.js";
import {
  canAccessRoute,
  resolveMenuItemPath,
} from "../src/auth/menuAccess.js";
import { can } from "../src/auth/rbac.js";

const RBAC_ON = true;

function findMenuItem(key) {
  for (const group of MENU_GROUPS) {
    const item = group.items?.find((entry) => entry.key === key);
    if (item) {
      return item;
    }
  }
  return null;
}

test("athlete self profile — sidebar menu resolves to /player/profile", () => {
  const item = findMenuItem("player-profile");
  assert.ok(item, "player-profile menu item should exist");

  const player = createUserRecord({
    role: ROLES.PLAYER,
    clubId: "c1",
    id: "player-user-1",
  });

  assert.equal(resolveMenuItemPath(item, player), "/player/profile");
  assert.equal(item.permissions, undefined);
});

test("athlete self profile — route permissions are public", () => {
  assert.deepEqual(ROUTE_PERMISSIONS["/player/profile"], []);
});

test("athlete self profile — PLAYER can access without playerId scope", () => {
  const player = createUserRecord({
    role: ROLES.PLAYER,
    clubId: "c1",
    id: "player-user-2",
  });

  const allowed = canAccessRoute(
    (permission, scope) => can(player, permission, scope, RBAC_ON),
    "/player/profile",
    { clubId: "c1" },
    player
  );

  assert.equal(allowed, true);
});

test("athlete self profile — mobile bottom nav config uses /player/profile", () => {
  const mobileItem = MOBILE_BOTTOM_NAV_PROFILES.player.find(
    (entry) => entry.key === "player-profile"
  );
  assert.ok(mobileItem);
  assert.equal(mobileItem.path, "/player/profile");
  assert.ok(mobileItem.roles?.includes(ROLES.PLAYER));
});

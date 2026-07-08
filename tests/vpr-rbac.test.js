import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { roleHasPermission, getPermissionsForRole } from "../src/auth/rolePermissions.js";
import { can } from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";

const RBAC_ON = { rbacEnabled: true };

test("SYSTEM_TECHNICIAN has ranking.manage and tournament.certify", () => {
  assert.equal(roleHasPermission(ROLES.SYSTEM_TECHNICIAN, PERMISSIONS.RANKING_MANAGE), true);
  assert.equal(roleHasPermission(ROLES.SYSTEM_TECHNICIAN, PERMISSIONS.TOURNAMENT_CERTIFY), true);
});

test("VENUE_OWNER has ranking.view only", () => {
  const perms = getPermissionsForRole(ROLES.VENUE_OWNER);
  assert.equal(perms.includes(PERMISSIONS.RANKING_VIEW), true);
  assert.equal(perms.includes(PERMISSIONS.RANKING_MANAGE), false);
});

test("PLAYER cannot manage ranking when RBAC on", () => {
  const player = createUserRecord({ role: ROLES.PLAYER });
  assert.equal(can(player, PERMISSIONS.RANKING_MANAGE, {}, RBAC_ON), false);
  assert.equal(can(player, PERMISSIONS.RANKING_VIEW, {}, RBAC_ON), false);
});

test("SUPER_ADMIN can ranking.manage", () => {
  const admin = createUserRecord({ role: ROLES.SUPER_ADMIN });
  assert.equal(can(admin, PERMISSIONS.RANKING_MANAGE, {}, RBAC_ON), true);
});

import test from "node:test";
import assert from "node:assert/strict";

import { ROLES, normalizeRole, ROLE_LABELS } from "../src/auth/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { PERMISSION_GROUPS, getPermissionLabel } from "../src/auth/permissions.js";
import { roleHasPermission, getPermissionsForRole } from "../src/auth/rolePermissions.js";
import { can, canAccessVenue } from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";
import {
  resolveRoleMenuAccess,
  MENU_GROUP_IDS,
  ROUTE_PERMISSIONS,
} from "../src/config/navigationConfig.js";
import { NAVIGATION_PERMISSIONS } from "../src/config/navigationPermissions.js";
import {
  filterMenuGroups,
  filterInPageNavHub,
  getDefaultHomePath,
  getRouteAccessPermissions,
  canAccessRoute,
} from "../src/auth/menuAccess.js";
import { MENU_GROUPS } from "../src/config/navigationConfig.js";
import { TOURNAMENT_IN_PAGE_NAV } from "../src/config/v5Menu/tournamentInPageNav.js";
import { SYSTEM_TECHNICIAN_MENU_ROOT } from "../src/config/v5Menu/systemTechnicianMenu.js";

const RBAC_ON = { rbacEnabled: true };

function user(role, extra = {}) {
  return createUserRecord({ role, ...extra });
}

test("V5.2 role labels — tiếng Việt", () => {
  assert.equal(ROLE_LABELS[ROLES.SYSTEM_TECHNICIAN], "Admin");
  assert.equal(ROLE_LABELS[ROLES.TEAM_CAPTAIN], "Trưởng nhóm / Đội trưởng");
  assert.equal(ROLE_LABELS[ROLES.PLATFORM_ADMIN], "Quản trị nền tảng / Super Admin");
  assert.equal(ROLE_LABELS[ROLES.TENANT_OWNER], "Chủ đơn vị / Chủ sân");
});

test("Legacy role aliases normalize sang V5 canonical", () => {
  assert.equal(normalizeRole(ROLES.SUPER_ADMIN), ROLES.PLATFORM_ADMIN);
  assert.equal(normalizeRole(ROLES.COURT_OWNER), ROLES.TENANT_OWNER);
  assert.equal(normalizeRole(ROLES.CLUB_OWNER), ROLES.CLUB_MANAGER);
});

test("SYSTEM_TECHNICIAN — quyền kỹ thuật, không quyền phá production", () => {
  const tech = user(ROLES.SYSTEM_TECHNICIAN);
  assert.equal(roleHasPermission(tech.role, PERMISSIONS.TENANT_VIEW), true);
  assert.equal(roleHasPermission(tech.role, PERMISSIONS.SYSTEM_HEALTH_VIEW), true);
  assert.equal(roleHasPermission(tech.role, PERMISSIONS.PLAYER_VIEW), true);
  assert.equal(roleHasPermission(tech.role, PERMISSIONS.ROLE_MANAGE), false);
  assert.equal(roleHasPermission(tech.role, PERMISSIONS.BILLING_TENANT_LOCK), false);
  assert.equal(roleHasPermission(tech.role, PERMISSIONS.TOURNAMENT_DELETE), false);
  assert.equal(can(tech, PERMISSIONS.TENANT_VIEW, {}, RBAC_ON), true);
  assert.equal(can(tech, PERMISSIONS.PLAYER_VIEW, {}, RBAC_ON), true);
  assert.equal(can(tech, PERMISSIONS.ROLE_MANAGE, {}, RBAC_ON), false);
});

test("SYSTEM_TECHNICIAN — truy cập /players toàn hệ thống", () => {
  const tech = user(ROLES.SYSTEM_TECHNICIAN);
  const check = (path) =>
    canAccessRoute(
      (perm, scope) => can(tech, perm, scope, RBAC_ON),
      path,
      {}
    );

  assert.equal(check("/players"), true);
});

test("SYSTEM_TECHNICIAN — xem venue platform scope", () => {
  const tech = user(ROLES.SYSTEM_TECHNICIAN);
  assert.equal(can(tech, PERMISSIONS.VENUE_VIEW, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(canAccessVenue(tech, "venue-a", RBAC_ON), false);
});

test("TEAM_CAPTAIN — chỉ đội được phân công (tournament + team scope)", () => {
  const captain = user(ROLES.TEAM_CAPTAIN, {
    tournamentId: "t1",
    teamId: "team-a",
  });

  assert.equal(roleHasPermission(captain.role, PERMISSIONS.TEAM_LINEUP_SUBMIT_V5), true);
  assert.equal(roleHasPermission(captain.role, PERMISSIONS.TEAM_EVENT_MANAGE), false);
  assert.equal(roleHasPermission(captain.role, PERMISSIONS.TOURNAMENT_DELETE), false);

  assert.equal(
    can(captain, PERMISSIONS.TEAM_LINEUP_VIEW, { tournamentId: "t1", teamId: "team-a" }, RBAC_ON),
    true
  );
  assert.equal(
    can(captain, PERMISSIONS.TEAM_LINEUP_VIEW, { tournamentId: "t1", teamId: "team-b" }, RBAC_ON),
    false
  );
  assert.equal(
    can(captain, PERMISSIONS.TEAM_LINEUP_VIEW, { tournamentId: "t2", teamId: "team-a" }, RBAC_ON),
    false
  );
  assert.equal(can(captain, PERMISSIONS.TEAM_LINEUP_VIEW, {}, RBAC_ON), false);
});

test("TOURNAMENT_MANAGER — quyền giải đồng đội", () => {
  const manager = user(ROLES.TOURNAMENT_MANAGER, { venueId: "v1" });
  assert.equal(roleHasPermission(manager.role, PERMISSIONS.TEAM_CAPTAIN_ASSIGN), true);
  assert.equal(roleHasPermission(manager.role, PERMISSIONS.IN_TOURNAMENT_TEAM_CREATE), true);
  assert.equal(roleHasPermission(manager.role, PERMISSIONS.BOOKING_CREATE), false);
});

test("ROLE_MENU_MAP — SYSTEM_TECHNICIAN và TEAM_CAPTAIN", () => {
  const techGroups = resolveRoleMenuAccess(ROLES.SYSTEM_TECHNICIAN);
  assert.ok(techGroups.includes(MENU_GROUP_IDS.SYSTEM_TECH_ZONE));

  const captainGroups = resolveRoleMenuAccess(ROLES.TEAM_CAPTAIN);
  assert.ok(captainGroups.includes(MENU_GROUP_IDS.TEAM_CAPTAIN_ZONE));
});

test("navigationPermissions — menu key có permission tập trung", () => {
  assert.ok(NAVIGATION_PERMISSIONS["tech-overview"].includes(PERMISSIONS.SYSTEM_HEALTH_VIEW));
  assert.ok(NAVIGATION_PERMISSIONS["captain-lineup"].includes(PERMISSIONS.TEAM_LINEUP_VIEW));
});

test("permissionsConfig — nhóm permission V5.2", () => {
  const techGroup = PERMISSION_GROUPS.find((g) => g.id === "system-technician");
  const captainGroup = PERMISSION_GROUPS.find((g) => g.id === "team-captain");
  assert.ok(techGroup.permissions.includes(PERMISSIONS.MIGRATION_STATUS_VIEW));
  assert.ok(captainGroup.permissions.includes(PERMISSIONS.TEAM_SUBSTITUTION_REQUEST));
  assert.match(getPermissionLabel(PERMISSIONS.TEAM_CAPTAIN_ASSIGN), /đội trưởng/i);
});

test("Route permissions — technician view-only users/audit", () => {
  assert.ok(ROUTE_PERMISSIONS["/users"].includes(PERMISSIONS.USER_VIEW));
  assert.ok(ROUTE_PERMISSIONS["/audit"].includes(PERMISSIONS.ACTIVITY_LOG_VIEW));
  assert.ok(getRouteAccessPermissions("/team-portal/t1").includes(PERMISSIONS.TEAM_VIEW));
});

test("Menu filter — TEAM_CAPTAIN thấy menu đội trưởng", () => {
  const captain = user(ROLES.TEAM_CAPTAIN, { tournamentId: "t1", teamId: "team-a" });
  const canFn = (permission, scope) => can(captain, permission, scope, RBAC_ON);
  const groups = filterMenuGroups(MENU_GROUPS, {
    can: canFn,
    rbacEnabled: true,
    isAuthenticated: true,
    user: captain,
  });
  const captainGroup = groups.find((g) => g.id === MENU_GROUP_IDS.TEAM_CAPTAIN_ZONE);
  assert.ok(captainGroup);
  assert.ok(captainGroup.items.length > 0);
});

test("Default home — TEAM_CAPTAIN về team portal", () => {
  const captain = user(ROLES.TEAM_CAPTAIN, { tournamentId: "t99", teamId: "team-x" });
  assert.equal(getDefaultHomePath(captain, true), "/team-portal/t99");
});

test("Menu filter — SYSTEM_TECHNICIAN không thấy nhóm vận hành sân", () => {
  const tech = user(ROLES.SYSTEM_TECHNICIAN);
  const canFn = (permission, scope) => can(tech, permission, scope, RBAC_ON);
  const groups = filterMenuGroups(MENU_GROUPS, {
    can: canFn,
    rbacEnabled: true,
    isAuthenticated: true,
    user: tech,
  });
  const groupIds = groups.map((g) => g.id);
  assert.ok(!groupIds.includes(MENU_GROUP_IDS.VENUE_OPS));
  assert.ok(!groupIds.includes(MENU_GROUP_IDS.FINANCE));
  assert.ok(groupIds.includes(MENU_GROUP_IDS.SYSTEM_TECH_ZONE));
});

test("SYSTEM_TECHNICIAN menu — có mục Vận động viên", () => {
  const labels = (SYSTEM_TECHNICIAN_MENU_ROOT.children || []).map((item) => item.text);
  assert.ok(labels.includes("Vận động viên"));
  const playersItem = SYSTEM_TECHNICIAN_MENU_ROOT.children.find((item) => item.path === "/players");
  assert.ok(playersItem);
});

test("Menu filter — CASHIER không thấy mục tạo giải", () => {
  const cashier = user(ROLES.CASHIER, { venueId: "v1" });
  const canFn = (permission, scope) => can(cashier, permission, scope, RBAC_ON);
  const groups = filterMenuGroups(MENU_GROUPS, {
    can: canFn,
    rbacEnabled: true,
    isAuthenticated: true,
    user: cashier,
  }, { venueId: "v1" });
  const allKeys = [];
  for (const group of groups) {
    for (const root of group.items || []) {
      for (const child of root.children || []) {
        allKeys.push(child.key);
      }
    }
  }
  assert.ok(!allKeys.includes("tournament-create"));
  assert.ok(allKeys.includes("venue-bookings") || allKeys.includes("venue-calendar"));
});

test("In-page nav — TEAM_CAPTAIN chỉ thấy mục đội, không thấy tạo giải", () => {
  const captain = user(ROLES.TEAM_CAPTAIN, {
    tournamentId: "t1",
    teamId: "team-a",
  });
  const canFn = (permission, scope) =>
    can(captain, permission, { ...scope, tournamentId: "t1", teamId: "team-a" }, RBAC_ON);
  const hub = filterInPageNavHub(
    TOURNAMENT_IN_PAGE_NAV.roster,
    { can: canFn, rbacEnabled: true, isAuthenticated: true, user: captain },
    { tournamentId: "t1", teamId: "team-a" }
  );
  const keys = hub?.sections?.flatMap((s) => s.items.map((i) => i.key)) || [];
  assert.ok(keys.includes("tournament-team-list"));
  assert.ok(!keys.includes("tournament-register"));
});

test("PLATFORM_ADMIN (SUPER_ADMIN legacy) giữ toàn quyền", () => {
  const admin = user(ROLES.SUPER_ADMIN);
  assert.equal(getPermissionsForRole(admin.role).length, Object.keys(PERMISSIONS).length);
  assert.equal(can(admin, PERMISSIONS.ROLE_MANAGE, {}, RBAC_ON), true);
});

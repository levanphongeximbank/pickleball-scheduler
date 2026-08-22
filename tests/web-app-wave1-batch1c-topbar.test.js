/**
 * Wave 1 Batch 1C — CanonicalTopBar composition (Help / support / reuse locks).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCanonicalTopbarNoOverlap,
  resolveCanonicalTopbarZoneStyles,
} from "../src/features/canonical-shell/layout/canonicalTopbarLayout.js";
import { getRouteAccessPermissions, canAccessRoute } from "../src/auth/menuAccess.js";
import { ROLES } from "../src/auth/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { can } from "../src/auth/rbac.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

test("batch1c — CanonicalTopBar reuses selectors/search/notification/account; adds Help", () => {
  const topbar = read("src/features/canonical-shell/components/CanonicalTopBar.jsx");
  assert.match(topbar, /CanonicalTenantSwitcher/);
  assert.match(topbar, /VenueSwitcher/);
  assert.match(topbar, /ClubSwitcher/);
  assert.match(topbar, /CanonicalGlobalSearchTrigger/);
  assert.match(topbar, /CanonicalNotificationButton/);
  assert.match(topbar, /CanonicalHelpButton/);
  assert.match(topbar, /CanonicalUserMenu/);
  assert.doesNotMatch(topbar, /navigate\(\s*["']\/settings["']\s*\)/);
  assert.doesNotMatch(topbar, /from ["'].*\/GlobalSearch\.jsx["']/);
});

test("batch1c — Help targets /support only", () => {
  const help = read("src/features/canonical-shell/components/CanonicalHelpButton.jsx");
  assert.match(help, /CANONICAL_HELP_TARGET\s*=\s*["']\/support["']/);
  assert.match(help, /navigate\(CANONICAL_HELP_TARGET\)/);
  assert.doesNotMatch(help, /navigate\(\s*["']\/settings["']\s*\)/);
  assert.match(help, /data-testid=["']canonical-help-button["']/);
  assert.match(help, /canAccessRoute/);
});

test("batch1c — Help route access PASS for Owner review roles", () => {
  const perms = getRouteAccessPermissions("/support");
  assert.ok(perms.includes(PERMISSIONS.SUPPORT_TICKET_MANAGE) || perms.includes(PERMISSIONS.BILLING_VIEW));

  const roles = [
    ROLES.PLATFORM_ADMIN,
    ROLES.TENANT_OWNER,
    ROLES.VENUE_MANAGER,
    ROLES.CLUB_MANAGER,
    ROLES.PLAYER,
    ROLES.CASHIER,
    ROLES.REFEREE,
  ];
  const denied = [];
  for (const role of roles) {
    const user = { role, id: "u1", venueId: "v1", tenantId: "t1" };
    const canFn = (p, scope) => can(user, p, scope, true);
    if (!canAccessRoute(canFn, "/support", {}, user)) {
      denied.push(role);
    }
  }
  assert.deepEqual(denied, [], `SUPPORT_AUTH_GAP roles: ${denied.join(",")}`);
});

test("batch1c — AccountMenu reused via CanonicalUserMenu (no new account menu)", () => {
  const userMenu = read("src/features/canonical-shell/components/CanonicalUserMenu.jsx");
  assert.match(userMenu, /AccountMenu/);
  assert.match(userMenu, /components\/shell\/AccountMenu\.jsx/);
  assert.doesNotMatch(userMenu, /createContext/);
});

test("batch1c — search + notification reuse locks", () => {
  const search = read("src/features/canonical-shell/components/CanonicalGlobalSearchTrigger.jsx");
  const notif = read("src/features/canonical-shell/components/CanonicalNotificationButton.jsx");
  assert.match(search, /CanonicalGlobalSearch/);
  assert.match(notif, /useNotificationInbox/);
});

test("batch1c — desktop/tablet topbar zone contract still no overlap", () => {
  assert.equal(assertCanonicalTopbarNoOverlap("desktop").ok, true);
  assert.equal(assertCanonicalTopbarNoOverlap("tablet").ok, true);
  const desktop = resolveCanonicalTopbarZoneStyles("desktop");
  assert.equal(desktop.context.visible, true);
  assert.equal(desktop.organization.visible, true);
});

test("batch1c — Batch 1A exclusivity + 1B menu locks untouched by topbar Help", () => {
  const layout = read("src/layouts/MainLayout.jsx");
  assert.match(layout, /CanonicalAppShell/);
  const batch1b = read("tests/web-app-wave1-batch1b-menu-ia.test.js");
  assert.match(batch1b, /batch1b/);
});

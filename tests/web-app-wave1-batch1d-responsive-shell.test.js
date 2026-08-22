/**
 * Wave 1 Batch 1D — tablet/mobile shell convergence (structural).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FIGURE1_BREAKPOINTS, FIGURE1_LAYOUT } from "../src/theme/figure1Tokens.js";
import {
  assertCanonicalTopbarNoOverlap,
  resolveCanonicalTopbarRuntimeViewport,
  resolveCanonicalTopbarZoneStyles,
} from "../src/features/canonical-shell/layout/canonicalTopbarLayout.js";
import { MOBILE_BOTTOM_NAV_PROFILES } from "../src/config/navigationConfig.js";
import { filterMobileBottomNav } from "../src/features/mobile/services/mobileNavAccess.js";
import { ROLES } from "../src/auth/roles.js";
import { can } from "../src/auth/rbac.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

test("batch1d — FIGURE1 breakpoints align with Owner mobile/tablet/desktop bands", () => {
  assert.equal(FIGURE1_BREAKPOINTS.mobileMax, 899);
  assert.equal(FIGURE1_BREAKPOINTS.tabletMin, 900);
  assert.equal(FIGURE1_BREAKPOINTS.tabletMax, 1199);
  assert.equal(FIGURE1_BREAKPOINTS.desktopMin, 1200);
  assert.equal(resolveCanonicalTopbarRuntimeViewport(899), "mobile");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(900), "tablet");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(1199), "tablet");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(1200), "desktop");
});

test("batch1d — sidebar widths 260 expanded / 64 collapsed", () => {
  assert.equal(FIGURE1_LAYOUT.sidebarWidthExpanded, 260);
  assert.equal(FIGURE1_LAYOUT.sidebarWidthCollapsed, 64);
});

test("batch1d — tablet default rail via CanonicalShellProvider (no new persistence key)", () => {
  const provider = read("src/features/canonical-shell/context/CanonicalShellProvider.jsx");
  assert.match(provider, /viewportDefaultCollapsed/);
  assert.match(provider, /isTablet/);
  assert.match(provider, /sidebarCollapsedOverride/);
  assert.doesNotMatch(provider, /localStorage/);
  assert.doesNotMatch(provider, /sessionStorage/);
});

test("batch1d — mobile hides persistent sidebar; uses drawer + bottom nav", () => {
  const sidebar = read("src/features/canonical-shell/components/CanonicalSidebar.jsx");
  const shell = read("src/features/canonical-shell/components/CanonicalAppShell.jsx");
  assert.match(sidebar, /if \(isMobile\) return null/);
  assert.match(shell, /CanonicalMobileDrawer/);
  assert.match(shell, /MobileBottomNav/);
  assert.match(shell, /\{isMobile && <MobileBottomNav \/>\}/);
});

test("batch1d — mobile topbar relocates selectors; keeps help/notification/account/search", () => {
  const topbar = read("src/features/canonical-shell/components/CanonicalTopBar.jsx");
  assert.match(topbar, /canonical-topbar-mobile-title/);
  assert.match(topbar, /!isMobile && zones\.organization\.visible/);
  assert.match(topbar, /!isMobile \? \([\s\S]*canonical-topbar-venue-zone/);
  assert.match(topbar, /CanonicalHelpButton/);
  assert.match(topbar, /CanonicalNotificationButton/);
  assert.match(topbar, /CanonicalUserMenu/);
  assert.match(topbar, /CanonicalGlobalSearchTrigger/);
  assert.doesNotMatch(topbar, /NewMobileHeader|MobileTopBar/);
});

test("batch1d — drawer reuses context selectors (no duplicate authority)", () => {
  const drawer = read("src/features/canonical-shell/components/CanonicalMobileDrawer.jsx");
  const ctx = read("src/features/canonical-shell/components/CanonicalMobileDrawerContext.jsx");
  assert.match(drawer, /CanonicalMobileDrawerContext/);
  assert.match(ctx, /CanonicalTenantSwitcher/);
  assert.match(ctx, /VenueSwitcher/);
  assert.match(ctx, /ClubSwitcher/);
  assert.match(ctx, /canonical-mobile-drawer-context/);
});

test("batch1d — no new shell / mobile nav systems", () => {
  const shellIndex = read("src/features/canonical-shell/index.js");
  assert.doesNotMatch(shellIndex, /NewAppShell|NewTabletSidebar|NewMobileDrawer|NewBottomNav/);
  assert.match(shellIndex, /CanonicalAppShell/);
  assert.match(shellIndex, /CanonicalMobileDrawer/);
});

test("batch1d — topbar zone contracts still no overlap", () => {
  assert.equal(assertCanonicalTopbarNoOverlap("desktop").ok, true);
  assert.equal(assertCanonicalTopbarNoOverlap("tablet").ok, true);
  assert.equal(assertCanonicalTopbarNoOverlap("mobile").ok, true);
  const mobile = resolveCanonicalTopbarZoneStyles("mobile");
  assert.ok(mobile.search.maxWidth <= 160);
});

test("batch1d — bottom nav has no null paths; CASHIER excludes check-in chrome", () => {
  for (const [profile, items] of Object.entries(MOBILE_BOTTOM_NAV_PROFILES)) {
    for (const item of items) {
      if (item.action) continue;
      assert.ok(item.path, `${profile}/${item.key} missing path`);
      assert.notEqual(item.path, null);
    }
  }

  const cashier = { role: ROLES.CASHIER, id: "c1", venueId: "v1" };
  const items = filterMobileBottomNav({
    user: cashier,
    rbacEnabled: true,
    isAuthenticated: true,
    can: (p, scope) => can(cashier, p, scope, true),
  });
  assert.ok(!items.some((item) => item.path === "/mobile/check-in"));
  assert.ok(items.every((item) => item.action || item.path));
});

test("batch1d — Batch 1A/1B/1C regression locks present", () => {
  assert.match(read("src/layouts/MainLayout.jsx"), /CanonicalAppShell/);
  assert.match(read("tests/web-app-wave1-batch1b-menu-ia.test.js"), /batch1b/);
  assert.match(read("tests/web-app-wave1-batch1c-topbar.test.js"), /batch1c/);
  assert.match(read("src/features/canonical-shell/components/CanonicalHelpButton.jsx"), /\/support/);
});

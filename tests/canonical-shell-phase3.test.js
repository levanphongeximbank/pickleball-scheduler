import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isCanonicalAppShellEnabled,
  CANONICAL_APP_SHELL_FLAG,
  buildCanonicalMenuTree,
  getCanonicalLevel1Groups,
  getCanonicalMenuMeta,
  filterCanonicalMenu,
  flattenCanonicalMenu,
  assertOwnerDecisionMenuInvariants,
  isCanonicalRouteActive,
  findActiveCanonicalNode,
  buildCanonicalBreadcrumbs,
  buildCanonicalSearchIndex,
  isPrivatePairingVisible,
  isCanonicalMenuNodeVisible,
  PHASE3_QA_ROLES,
  FIGURE1_TOKENS,
  FIGURE1_FONT_LOADING,
  B01_LEGACY_MESSAGES_ROUTE,
  B01_CANONICAL_MESSAGES_ROUTE,
  B03_SHADOW_SKILL_ASSESSMENT_V5,
  validateCanonicalRegistry,
  reconcileInventoryHandling,
  resolveCanonicalRouteHref,
  resolveCanonicalRouteLabel,
  assertNoActivePlaceholder,
  getParamFallbackLabel,
  createFigure1ShellTheme,
  CANONICAL_ROUTE_CATALOG,
} from "../src/features/canonical-shell/runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function authFor(role, overrides = {}) {
  return {
    user: { id: `user-${role}`, role, ...overrides.user },
    rbacEnabled: overrides.rbacEnabled ?? true,
    permissions: overrides.permissions || [],
    hasPermission: overrides.hasPermission,
  };
}

test("phase3 flag — default OFF unchanged", () => {
  assert.equal(CANONICAL_APP_SHELL_FLAG, "VITE_CANONICAL_APP_SHELL_ENABLED");
  assert.equal(isCanonicalAppShellEnabled({}), false);
  assert.equal(isCanonicalAppShellEnabled({ VITE_CANONICAL_APP_SHELL_ENABLED: "true" }), true);
});

test("phase3 registry validation — complete coverage + zero duplicates", () => {
  const result = validateCanonicalRegistry();
  assert.equal(result.ok, true, JSON.stringify(result.blockers));
  assert.equal(result.counts.level1Groups, 13);
  assert.ok(result.counts.level2Modules >= 40);
  assert.ok(result.counts.level3Actions >= 70);
  assert.equal(result.counts.duplicateActiveEntries, 0);
  assert.equal(result.counts.inventoriedRoutes, 179);
  assert.equal(result.counts.proposedCanonicalMenu, 83);
  assert.equal(result.counts.legacyRoutesHidden, 47);
  assert.equal(result.counts.shadowRoutesHidden, 1);
  assert.equal(result.counts.partialMenuNodes, 6);
  assert.equal(result.ownerDecisions.B01.hasLegacy, false);
  assert.equal(result.ownerDecisions.B01.hasCanonical, true);
  assert.equal(result.ownerDecisions.B01.dualCanonical, true);
  assert.equal(result.ownerDecisions.B01.hasMessagingExperience, true);
  assert.equal(result.ownerDecisions.B01.hasCrmMessages, true);
  assert.equal(result.ownerDecisions.B03.hasShadow, false);
  assert.ok(result.ownerDecisions.B02.canonicalCount >= 1);
  assert.equal(result.ownerDecisions.B02.legacyHubCount, 0);
});

test("phase3 menu — 13 Level-1, PARTIAL badges, contextual params hidden", () => {
  const groups = getCanonicalLevel1Groups();
  assert.equal(groups.length, 13);
  assert.equal(getCanonicalMenuMeta().phase, "3-menu-completion");

  const tree = buildCanonicalMenuTree();
  const flat = flattenCanonicalMenu(tree);
  const partial = flat.filter((n) => n.visibilityStatus === "partial");
  assert.equal(partial.length, 6);
  assert.ok(partial.every((n) => n.badge?.label === "PARTIAL"));

  const visibleDesktop = flattenCanonicalMenu(
    filterCanonicalMenu(authFor("SUPER_ADMIN"), { viewport: "desktop" })
  );
  assert.equal(
    visibleDesktop.some((n) => String(n.route || "").includes(":")),
    false
  );
  assert.equal(
    visibleDesktop.some((n) => n.route === B03_SHADOW_SKILL_ASSESSMENT_V5),
    false
  );
  // OD-B01 Phase 4: dual-canonical — both messaging experience and CRM messages.
  assert.equal(
    visibleDesktop.filter((n) => n.route === B01_LEGACY_MESSAGES_ROUTE).length,
    1
  );
  assert.equal(
    visibleDesktop.filter((n) => n.route === B01_CANONICAL_MESSAGES_ROUTE).length,
    1
  );
});

test("phase3 W01 — Inter font loading metadata (no remote CDN)", () => {
  assert.equal(FIGURE1_FONT_LOADING.package, "@fontsource/inter");
  assert.equal(FIGURE1_FONT_LOADING.remoteCdn, false);
  assert.equal(FIGURE1_FONT_LOADING.display, "swap");
  assert.equal(FIGURE1_FONT_LOADING.loadStrategy, "dynamic-import-on-canonical-shell-mount");
  assert.ok(FIGURE1_FONT_LOADING.stack.includes("Inter"));
  const shell = readSrc("src/features/canonical-shell/components/CanonicalAppShell.jsx");
  assert.ok(shell.includes('import("../fonts/figure1Fonts.js")'));
  assert.equal(shell.includes('import "../fonts/figure1Fonts.js"'), false);
  assert.ok(shell.includes("data-figure1-font"));
  const pkg = JSON.parse(readSrc("package.json"));
  assert.ok(pkg.dependencies["@fontsource/inter"]);
});

test("phase3 W02 — canonical search respects RBAC and hides shadow/legacy", () => {
  const adminHits = buildCanonicalSearchIndex(authFor("SUPER_ADMIN"));
  assert.ok(adminHits.some((h) => h.path === B01_CANONICAL_MESSAGES_ROUTE));
  assert.ok(adminHits.some((h) => h.path === B01_LEGACY_MESSAGES_ROUTE));
  assert.equal(adminHits.some((h) => h.path === B03_SHADOW_SKILL_ASSESSMENT_V5), false);
  assert.equal(adminHits.some((h) => String(h.path).includes(":")), false);
  assert.equal(
    adminHits.filter((h) => h.path === B01_CANONICAL_MESSAGES_ROUTE).length,
    1
  );
  assert.equal(
    adminHits.filter((h) => h.path === B01_LEGACY_MESSAGES_ROUTE).length,
    1
  );

  const playerHits = buildCanonicalSearchIndex(authFor("PLAYER"));
  assert.equal(playerHits.some((h) => h.path === "/admin/ai-pairing/private-rules"), false);
  assert.equal(playerHits.some((h) => h.path === B03_SHADOW_SKILL_ASSESSMENT_V5), false);
  // PLAYER may see Communication inbox; must not see CRM outreach without perms.
  assert.equal(playerHits.some((h) => h.path === B01_CANONICAL_MESSAGES_ROUTE), false);

  const unknownHits = buildCanonicalSearchIndex(authFor("UNKNOWN_ROLE_XYZ"));
  assert.equal(unknownHits.length, 0);
});

test("phase3 W03 — card radius 12 via nested shell theme without Paper leak", () => {
  assert.equal(FIGURE1_TOKENS.layout.cardRadius, 12);
  const themeSrc = readSrc("src/features/canonical-shell/theme/figure1ShellTheme.js");
  assert.ok(themeSrc.includes("FIGURE1_LAYOUT.cardRadius"));
  assert.ok(themeSrc.includes("MuiCard"));
  assert.equal(/MuiPaper\s*:/.test(themeSrc), false);
  assert.equal(typeof createFigure1ShellTheme, "function");
  const shell = readSrc("src/features/canonical-shell/components/CanonicalAppShell.jsx");
  assert.ok(shell.includes("createFigure1ShellTheme"));
  assert.ok(shell.includes("ThemeProvider"));
});

test("phase3 W04 — parameterized labels never use active / raw ids", () => {
  const hrefMissing = resolveCanonicalRouteHref("/tournaments/:tournamentId/engine", {});
  assert.equal(hrefMissing.href, null);
  assert.ok(hrefMissing.missing.includes("tournamentId"));

  const hrefOk = resolveCanonicalRouteHref("/tournaments/:tournamentId/engine", {
    params: { tournamentId: "t-100" },
  });
  assert.equal(hrefOk.href, "/tournaments/t-100/engine");
  assert.equal(assertNoActivePlaceholder(hrefOk.href), true);

  assert.equal(getParamFallbackLabel("tournamentId"), "Giải đấu");
  assert.equal(getParamFallbackLabel("clubId"), "CLB");
  assert.equal(getParamFallbackLabel("courtId"), "Sân");
  assert.equal(getParamFallbackLabel("playerId"), "VĐV");

  const label = resolveCanonicalRouteLabel(
    { label: "Engine", route: "/tournaments/:tournamentId/engine" },
    { pathname: "/tournaments/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/engine" }
  );
  assert.equal(label, "Engine");
  assert.notEqual(label.toLowerCase(), "active");

  // UUID path segment must not appear as breadcrumb label fallback.
  const crumbs = buildCanonicalBreadcrumbs(
    "/tournaments/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/engine",
    {
      auth: authFor("SUPER_ADMIN", { permissions: ["tournament.view"] }),
      params: { tournamentId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
    }
  );
  assert.equal(crumbs.some((c) => String(c.href || "").includes(":")), false);
  assert.equal(crumbs.at(-1)?.href, undefined);
  assert.equal(String(crumbs.map((c) => c.label).join(" ")).toLowerCase().includes("active"), false);
  assert.equal(crumbs.some((c) => c.denied), false);

  // Trailing slash / query string normalize safely.
  const crumbsQs = buildCanonicalBreadcrumbs("/tournaments/abc-tournament/engine/?tab=1", {
    auth: authFor("SUPER_ADMIN", { permissions: ["tournament.view"] }),
  });
  assert.equal(crumbsQs.some((c) => String(c.label).toLowerCase() === "active"), false);

  const denied = buildCanonicalBreadcrumbs("/tournaments/abc-tournament/engine", {
    auth: authFor("UNKNOWN_ROLE_XYZ"),
  });
  assert.ok(denied.some((c) => c.denied));
  assert.equal(denied.some((c) => c.label === "Engine"), false);
});

test("phase3 W05 — drawer focus restore contracts present", () => {
  const drawer = readSrc("src/features/canonical-shell/components/CanonicalMobileDrawer.jsx");
  assert.ok(drawer.includes("menuTriggerRef"));
  assert.ok(drawer.includes("restoreTriggerFocus"));
  assert.ok(drawer.includes("closeButtonRef"));
  assert.ok(drawer.includes("focus"));
  assert.ok(drawer.includes("showDrawerShell"));
  assert.equal(drawer.includes('.replace(/:tournamentId/g, "active")'), false);
  assert.ok(drawer.includes("resolveCanonicalRouteHref"));

  const topBar = readSrc("src/features/canonical-shell/components/CanonicalTopBar.jsx");
  assert.ok(topBar.includes("menuTriggerRef"));
  assert.ok(topBar.includes("canonical-mobile-menu-trigger"));
});

test("phase3 inventory handling reconciles to 179", () => {
  const result = reconcileInventoryHandling();
  assert.equal(result.ok, true);
  assert.equal(result.total, 179);
  assert.equal(result.sumStates, 179);
  assert.equal(result.counts.ACTIVE_MENU, 76);
  assert.equal(result.counts.CONTEXTUAL_NAVIGATION, 7);
  assert.equal(result.counts.HIDDEN_SHADOW, 1);
  assert.ok(result.counts.HIDDEN_LEGACY + result.counts.REDIRECT_METADATA >= 47);
});

test("phase3 B01/B02/B03 owner decisions", () => {
  const invariants = assertOwnerDecisionMenuInvariants(buildCanonicalMenuTree());
  assert.equal(invariants.hasLegacyMessages, false);
  assert.equal(invariants.hasCanonicalMessages, true);
  assert.equal(invariants.hasMessagingExperience, true);
  assert.equal(invariants.hasCrmMessages, true);
  assert.equal(invariants.dualCanonicalMessages, true);
  assert.equal(invariants.duplicateMessagesEntries, false);
  assert.equal(invariants.hasShadowSkillV5, false);
  assert.equal(invariants.legacyTournamentHubCount, 0);
  assert.ok(invariants.canonicalTournamentCount >= 1);

  const catalogShadow = CANONICAL_ROUTE_CATALOG.routes.filter((r) => r.classification === "SHADOW");
  assert.equal(catalogShadow.length, 1);
  assert.equal(catalogShadow[0].path, B03_SHADOW_SKILL_ASSESSMENT_V5);
});

test("phase3 RBAC — 10 roles + unknown fail-closed + Private Pairing", () => {
  assert.equal(PHASE3_QA_ROLES.length, 10);
  for (const role of PHASE3_QA_ROLES) {
    const leaves = flattenCanonicalMenu(filterCanonicalMenu(authFor(role), { viewport: "desktop" }));
    assert.ok(Array.isArray(leaves));
    assert.equal(leaves.some((n) => n.route === B03_SHADOW_SKILL_ASSESSMENT_V5), false);
    // OD-B01: /messages may appear (AUTHENTICATED); CRM remains permission-scoped.
    assert.equal(
      leaves.filter((n) => n.route === B01_LEGACY_MESSAGES_ROUTE).length <= 1,
      true
    );
    if (role !== "SUPER_ADMIN") {
      assert.equal(
        leaves.some((n) => n.route === "/admin/ai-pairing/private-rules"),
        false
      );
    }
  }

  const unknown = flattenCanonicalMenu(
    filterCanonicalMenu(authFor("NOT_A_REAL_ROLE"), { viewport: "desktop" })
  );
  assert.equal(unknown.length, 0);

  assert.equal(isPrivatePairingVisible(authFor("PLAYER")), false);
});

test("phase3 active route matching — parameterized tournament family", () => {
  const tree = buildCanonicalMenuTree();
  const active = findActiveCanonicalNode("/tournaments/t-9/engine", tree);
  assert.ok(active);
  assert.equal(active.route, "/tournaments/:tournamentId/engine");
  assert.equal(
    isCanonicalRouteActive("/tournaments/t-9/engine", {
      route: "/tournaments/:tournamentId/engine",
      activeMatch: "pattern",
    }),
    true
  );
});

test("phase3 desktop/mobile same registry", () => {
  const auth = authFor("VENUE_OWNER", { permissions: ["booking.view", "customer.view"] });
  const desktop = flattenCanonicalMenu(filterCanonicalMenu(auth, { viewport: "desktop" }));
  const mobile = flattenCanonicalMenu(filterCanonicalMenu(auth, { viewport: "mobile" }));
  // Same registry source; mobile may hide mobileVisible:false leaves.
  assert.ok(desktop.length >= mobile.length);
  // OD-B01 Phase 4: dual-canonical messaging experience present for VENUE_OWNER.
  assert.equal(desktop.some((n) => n.route === "/messages"), true);
  assert.equal(mobile.some((n) => n.route === "/messages"), true);
  assert.equal(desktop.some((n) => n.route === "/crm/messages"), true);
});

test("phase3 permission filtering — finance denied without permission", () => {
  const player = authFor("PLAYER", { rbacEnabled: true, permissions: [] });
  const node = {
    id: "finance-test",
    route: "/finance",
    level1: "07",
    requiredPermissions: ["finance.view"],
    rbacVisibility: ["RBAC_SCOPED"],
    desktopVisible: true,
    mobileVisible: true,
  };
  assert.equal(isCanonicalMenuNodeVisible(node, player, { viewport: "desktop" }), false);
});

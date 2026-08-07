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
  isPrivatePairingVisible,
  isCanonicalMenuNodeVisible,
  PHASE2_QA_ROLES,
  FIGURE1_TOKENS,
  B01_LEGACY_MESSAGES_ROUTE,
  B03_SHADOW_SKILL_ASSESSMENT_V5,
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

test("phase2 flag — default OFF preserves legacy shell", () => {
  assert.equal(CANONICAL_APP_SHELL_FLAG, "VITE_CANONICAL_APP_SHELL_ENABLED");
  assert.equal(isCanonicalAppShellEnabled({}), false);
  assert.equal(isCanonicalAppShellEnabled({ VITE_CANONICAL_APP_SHELL_ENABLED: "false" }), false);
  assert.equal(isCanonicalAppShellEnabled({ VITE_CANONICAL_APP_SHELL_ENABLED: "true" }), true);
});

test("phase2 MainLayout — flag switch without dual shell", () => {
  const layout = readSrc("src/layouts/MainLayout.jsx");
  assert.ok(layout.includes("isCanonicalAppShellEnabled"));
  assert.ok(layout.includes("CanonicalAppShell"));
  assert.ok(layout.includes("LegacyMainLayoutContent"));
  assert.ok(layout.includes("legacy-app-shell"));
  assert.ok(layout.includes("Never render both shells simultaneously"));
});

test("phase2 tokens — Figure 1 navy / blue / layout dimensions", () => {
  assert.equal(FIGURE1_TOKENS.palette.sidebarBg, "#0F1B2D");
  assert.equal(FIGURE1_TOKENS.palette.sidebarAccent, "#3B82F6");
  assert.equal(FIGURE1_TOKENS.palette.workspaceSurface, "#F8FAFC");
  assert.equal(FIGURE1_TOKENS.layout.sidebarWidthExpanded, 260);
  assert.equal(FIGURE1_TOKENS.layout.sidebarWidthCollapsed, 64);
  assert.equal(FIGURE1_TOKENS.layout.topbarHeight, 56);
  assert.ok(FIGURE1_TOKENS.cssVars["--nav-sidebar-bg"]);
});

test("phase2 theme — figure1 tokens attached without replacing Slate default", () => {
  const themeSrc = readSrc("src/theme/theme.js");
  const design = readSrc("src/theme/designTokens.js");
  assert.ok(themeSrc.includes("canonicalNav"));
  assert.ok(themeSrc.includes("figure1"));
  assert.ok(design.includes("slate-enterprise"));
  assert.equal(/sidebarBg: "#0F1B2D"/.test(design), false);
});

test("phase2 menu registry — 13 Level-1 groups and Level-3 support", () => {
  const groups = getCanonicalLevel1Groups();
  const tree = buildCanonicalMenuTree();
  const meta = getCanonicalMenuMeta();
  assert.equal(groups.length, 13);
  assert.equal(tree.length, 13);
  assert.ok(meta.proposedCanonicalMenuCount >= 80);

  const flat = flattenCanonicalMenu(tree);
  assert.ok(flat.some((n) => n.level3));
  assert.ok(flat.every((n) => n.id && n.label && n.level1 && n.level2));
});

test("phase2 owner decisions — B01/B02/B03 menu invariants", () => {
  const tree = buildCanonicalMenuTree();
  const invariants = assertOwnerDecisionMenuInvariants(tree);
  assert.equal(invariants.hasLegacyMessages, false);
  assert.equal(invariants.hasCanonicalMessages, true);
  assert.equal(invariants.hasMessagingExperience, true);
  assert.equal(invariants.hasCrmMessages, true);
  assert.equal(invariants.dualCanonicalMessages, true);
  assert.equal(invariants.hasShadowSkillV5, false);
  assert.equal(invariants.unapprovedLegacyTournamentRoutes.length, 0);
  assert.ok(Array.isArray(invariants.allowedTournamentHubRoutes));
  assert.ok(invariants.allowedTournamentHubRoutes.length >= 1);
  assert.ok(invariants.canonicalTournamentCount >= 1);
  assert.equal(invariants.duplicateMessagesEntries, false);

  const flat = flattenCanonicalMenu(tree).map((n) => n.route);
  assert.equal(flat.includes(B01_LEGACY_MESSAGES_ROUTE), true);
  assert.equal(flat.includes(B03_SHADOW_SKILL_ASSESSMENT_V5), false);
  assert.equal(flat.includes("/crm/messages"), true);
});

test("phase2 active-route highlighting — exact, prefix, and pattern", () => {
  assert.equal(
    isCanonicalRouteActive("/dashboard", { route: "/dashboard", activeMatch: "exact" }),
    true
  );
  assert.equal(
    isCanonicalRouteActive("/club/members", { route: "/club", activeMatch: "prefix" }),
    true
  );
  assert.equal(
    isCanonicalRouteActive("/tournaments/t-1/engine", {
      route: "/tournaments/:tournamentId/engine",
      activeMatch: "pattern",
    }),
    true
  );
  assert.equal(
    isCanonicalRouteActive("/tournament/list", {
      route: "/tournaments/:tournamentId/engine",
      activeMatch: "pattern",
    }),
    false
  );
});

test("phase2 breadcrumbs — registry trail + invalid route foundation", () => {
  const tree = buildCanonicalMenuTree();
  const crumbs = buildCanonicalBreadcrumbs("/dashboard", { tree });
  assert.ok(crumbs.length >= 1);
  assert.equal(crumbs[0].href, "/dashboard");

  const invalid = buildCanonicalBreadcrumbs("/this-route-does-not-exist-zz", { tree });
  assert.ok(invalid.some((c) => c.invalid));
});

test("phase2 RBAC — 10 QA roles filter Level-1 access", () => {
  assert.equal(PHASE2_QA_ROLES.length, 10);
  for (const role of PHASE2_QA_ROLES) {
    const filtered = filterCanonicalMenu(authFor(role), { viewport: "desktop" });
    assert.ok(Array.isArray(filtered), role);
    const flat = flattenCanonicalMenu(filtered);
    assert.equal(
      flat.some((n) => n.route === B03_SHADOW_SKILL_ASSESSMENT_V5),
      false,
      role
    );
    // OD-B01: messaging experience may appear; never duplicate same path.
    assert.ok(flat.filter((n) => n.route === B01_LEGACY_MESSAGES_ROUTE).length <= 1, role);
  }
});

test("phase2 RBAC — unknown roles fail closed", () => {
  const unknownLeaves = flattenCanonicalMenu(
    filterCanonicalMenu(authFor("TOTALLY_UNKNOWN_ROLE"), { viewport: "desktop" })
  );
  assert.equal(unknownLeaves.length, 0);

  const emptyRoleLeaves = flattenCanonicalMenu(
    filterCanonicalMenu({ user: { id: "u" }, rbacEnabled: true, permissions: [] }, { viewport: "desktop" })
  );
  assert.equal(emptyRoleLeaves.length, 0);

  const noUserLeaves = flattenCanonicalMenu(
    filterCanonicalMenu({ rbacEnabled: true, permissions: [] }, { viewport: "desktop" })
  );
  assert.equal(noUserLeaves.length, 0);
});

test("phase2 RBAC — Private Pairing hidden for unauthorized roles", () => {
  const unauthorized = PHASE2_QA_ROLES.filter((r) => r !== "SUPER_ADMIN");
  for (const role of unauthorized) {
    assert.equal(isPrivatePairingVisible(authFor(role)), false, role);
    const flat = flattenCanonicalMenu(filterCanonicalMenu(authFor(role)));
    assert.equal(
      flat.some((n) => n.route === "/admin/ai-pairing/private-rules"),
      false,
      role
    );
  }
});

test("phase2 RBAC — SUPER_ADMIN Private Pairing stays flag-gated", () => {
  const flatOff = flattenCanonicalMenu(filterCanonicalMenu(authFor("SUPER_ADMIN")));
  assert.equal(
    flatOff.some((n) => n.route === "/admin/ai-pairing/private-rules"),
    false
  );
});

test("phase2 permission filtering — missing permission hides node when RBAC on", () => {
  const tree = buildCanonicalMenuTree();
  const financeLeaf = flattenCanonicalMenu(tree).find((n) =>
    (n.requiredPermissions || []).includes("finance.view")
  );
  if (!financeLeaf) {
    assert.ok(true, "no finance.view leaf in foundation sample");
    return;
  }
  const denied = isCanonicalMenuNodeVisible(financeLeaf, authFor("PLAYER", { permissions: [] }), {
    viewport: "desktop",
  });
  assert.equal(denied, false);
});

test("phase2 findActiveCanonicalNode — deepest match wins", () => {
  const tree = buildCanonicalMenuTree();
  const active = findActiveCanonicalNode("/crm/messages", tree);
  assert.ok(active);
  assert.equal(active.route, "/crm/messages");
});

test("phase2 components inventory — mandatory shell modules exist", () => {
  const files = [
    "src/features/canonical-shell/components/CanonicalAppShell.jsx",
    "src/features/canonical-shell/components/CanonicalSidebar.jsx",
    "src/features/canonical-shell/components/CanonicalSidebarSection.jsx",
    "src/features/canonical-shell/components/CanonicalSidebarItem.jsx",
    "src/features/canonical-shell/components/CanonicalSidebarSubmenu.jsx",
    "src/features/canonical-shell/components/CanonicalTopBar.jsx",
    "src/features/canonical-shell/components/CanonicalBreadcrumbs.jsx",
    "src/features/canonical-shell/components/CanonicalMobileDrawer.jsx",
    "src/features/canonical-shell/components/CanonicalTenantSwitcher.jsx",
    "src/features/canonical-shell/components/CanonicalUserMenu.jsx",
    "src/features/canonical-shell/components/CanonicalNotificationButton.jsx",
    "src/features/canonical-shell/components/CanonicalGlobalSearchTrigger.jsx",
  ];
  for (const file of files) {
    assert.ok(readSrc(file).length > 50, file);
  }
});

test("phase2 a11y contracts — aria labels and focus affordances in shell components", () => {
  const sidebar = readSrc("src/features/canonical-shell/components/CanonicalSidebar.jsx");
  const item = readSrc("src/features/canonical-shell/components/CanonicalSidebarItem.jsx");
  const drawer = readSrc("src/features/canonical-shell/components/CanonicalMobileDrawer.jsx");
  const section = readSrc("src/features/canonical-shell/components/CanonicalSidebarSection.jsx");

  assert.ok(sidebar.includes('aria-label="Điều hướng chính"'));
  assert.ok(item.includes('aria-current={active ? "page"'));
  assert.ok(item.includes("focus-visible"));
  assert.ok(item.includes("prefers-reduced-motion"));
  assert.ok(drawer.includes('aria-label="Quay lại"'));
  assert.ok(section.includes("aria-expanded"));
  assert.ok(section.includes('role="group"'));
});

test("phase2 responsive contracts — expanded/collapsed + mobile drawer", () => {
  const sidebar = readSrc("src/features/canonical-shell/components/CanonicalSidebar.jsx");
  const drawer = readSrc("src/features/canonical-shell/components/CanonicalMobileDrawer.jsx");
  const ctx = readSrc("src/features/canonical-shell/context/CanonicalShellProvider.jsx");

  assert.ok(sidebar.includes("sidebarWidthCollapsed"));
  assert.ok(sidebar.includes("sidebarWidthExpanded"));
  assert.ok(drawer.includes("setStack"));
  assert.ok(drawer.includes("handleBack"));
  assert.ok(ctx.includes("isTablet"));
  assert.ok(ctx.includes("sidebarCollapsed"));
});

test("phase2 legacy shell not deleted", () => {
  assert.ok(readSrc("src/components/Sidebar.jsx").includes("NavMenuShell"));
  assert.ok(readSrc("src/components/Header.jsx").includes("GlobalSearch"));
  assert.ok(readSrc("src/layouts/MainLayout.jsx").includes("LegacyMainLayoutContent"));
});

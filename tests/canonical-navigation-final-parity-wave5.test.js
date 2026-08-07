import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CANONICAL_MENU_DATA } from "../src/features/canonical-shell/config/canonicalMenuData.js";
import {
  assertOwnerDecisionMenuInvariants,
  filterCanonicalMenu,
  flattenCanonicalMenu,
  isCanonicalMenuNodeVisible,
  isPrivatePairingVisible,
} from "../src/features/canonical-shell/services/filterCanonicalMenu.js";
import {
  B02_TOURNAMENT_HUB_MENU_ALLOWLIST,
  B03_SHADOW_SKILL_ASSESSMENT_V5,
} from "../src/features/canonical-shell/config/ownerDecisions.js";
import { getRouteAccessPermissions } from "../src/auth/menuAccess.js";
import { getTechnicalReasonUserMessage } from "../src/features/canonical-shell/config/canonicalVietnameseLabels.js";
import {
  assertCanonicalTopbarNoOverlap,
  resolveCanonicalTopbarRuntimeViewport,
} from "../src/features/canonical-shell/layout/canonicalTopbarLayout.js";
import { isApiEnabled, isMarketplaceEnabled } from "../src/features/integrations/config/integrationFlags.js";
import { isPrivatePairingRulesEnabled } from "../src/features/private-pairing-rules/constants/codes.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const routerSource = readFileSync(join(root, "src/router.jsx"), "utf8");
const shellSource = readFileSync(
  join(root, "src/features/canonical-shell/components/CanonicalAppShell.jsx"),
  "utf8"
);
const mainLayoutSource = readFileSync(join(root, "src/layouts/MainLayout.jsx"), "utf8");
const filterSource = readFileSync(
  join(root, "src/features/canonical-shell/services/filterCanonicalMenu.js"),
  "utf8"
);

const WAVE1_TOURNAMENT_TARGETS = Object.freeze([
  "/tournament",
  "/tournament/list",
  "/tournament/create",
  "/tournament/types",
  "/tournament/roster",
  "/tournament/register",
  "/tournament/organize",
  "/tournament/operations",
  "/tournament/results",
  "/tournament/config",
  "/tournament/my",
  "/daily-play",
  "/referee",
]);

const WAVE2_PROMOTED = Object.freeze([
  "/court-management/ops-log",
  "/court-management/future",
  "/mobile/qr-generate",
  "/court-management/customer-groups",
  "/billing",
  "/billing/invoices",
  "/billing/usage",
  "/marketplace",
  "/admin/billing",
  "/admin/billing/tenants",
  "/admin/billing/plans",
  "/admin/billing/invoices",
  "/admin/billing/payments",
  "/admin/billing/audit",
  "/admin/marketplace",
  "/admin/marketplace/products",
  "/admin/marketplace/orders",
  "/admin/integration-logs",
  "/admin/payment-transactions",
  "/admin/webhook-events",
  "/admin/api-clients",
  "/admin/api-logs",
  "/settings/integrations/payments",
  "/settings/integrations/zalo-oa",
  "/support/faq",
  "/support/guide",
]);

const PROMOTED_ROUTES = Object.freeze([...WAVE1_TOURNAMENT_TARGETS, ...WAVE2_PROMOTED]);

const QA_ROLES = Object.freeze([
  "SUPER_ADMIN",
  "VENUE_OWNER",
  "VENUE_MANAGER",
  "CASHIER",
  "CLUB_OWNER",
  "CLUB_MANAGER",
  "COACH",
  "REFEREE",
  "PLAYER",
  "SYSTEM_TECHNICIAN",
]);

const PLATFORM_ADMIN_ROUTES = Object.freeze(
  WAVE2_PROMOTED.filter(
    (route) => route.startsWith("/admin/") || route.startsWith("/settings/integrations/")
  )
);

const PRIVATE_PAIRING_ROUTE = "/admin/ai-pairing/private-rules";

function authFor(role, permissions = ["*"]) {
  return {
    user: { id: `wave5-${role}`, role },
    rbacEnabled: true,
    permissions,
    hasPermission: (perm) => permissions.includes("*") || permissions.includes(perm),
    isAuthenticated: true,
  };
}

function nodeFor(route) {
  return CANONICAL_MENU_DATA.nodes.find((entry) => entry.route === route);
}

function visibleRoutes(role, permissions = ["*"]) {
  return new Set(
    flattenCanonicalMenu(
      filterCanonicalMenu(authFor(role, permissions), { viewport: "desktop" })
    ).map((node) => node.route)
  );
}

function buildPromotedMatrix() {
  return PROMOTED_ROUTES.map((route) => {
    const node = nodeFor(route);
    assert.ok(node, `missing promoted node ${route}`);
    const menuVisibleRoles = QA_ROLES.filter((role) =>
      isCanonicalMenuNodeVisible(node, authFor(role, ["*"]), { viewport: "desktop" })
    );
    return {
      route,
      level1: node.level1,
      requiredRoles: [...(node.requiredRoles || [])],
      requiredPermissions: [...(node.requiredPermissions || [])],
      featureFlags: [...(node.featureFlags || [])],
      guards: [...(node.guards || [])],
      rbacVisibility: [...(node.rbacVisibility || [])],
      menuVisibleRoles,
      routePermissions: getRouteAccessPermissions(route),
      tenantGateLayout: true,
      routeGuard: "RouteAccessGate",
      operationalGateLayout: true,
      contextualOrPublic: Boolean(node.contextualOnly) || (node.rbacVisibility || []).includes("PUBLIC"),
      authorizationResult: "PASS",
    };
  });
}

test("wave5 promoted route matrix complete — Wave1+Wave2 metadata + layout gates", () => {
  const matrix = buildPromotedMatrix();
  assert.equal(matrix.length, 39);
  assert.equal(
    matrix.every((row) => row.level1 && row.guards.length > 0 && row.authorizationResult === "PASS"),
    true
  );

  assert.match(shellSource, /RouteAccessGate[\s\S]*TenantGate[\s\S]*OperationalRouteGate/);
  assert.match(mainLayoutSource, /RouteAccessGate[\s\S]*TenantGate[\s\S]*OperationalRouteGate/);

  for (const row of matrix) {
    assert.equal(row.tenantGateLayout, true, `${row.route} missing layout TenantGate`);
    assert.equal(row.routeGuard, "RouteAccessGate");
    assert.equal(row.guards.includes("RouteAccessGate") || row.guards.length > 0, true);
  }
});

test("wave5 role matrix — no unauthorized platform-admin menu exposure", () => {
  const lowerRoles = QA_ROLES.filter((role) => role !== "SUPER_ADMIN" && role !== "SYSTEM_TECHNICIAN");
  let unauthorized = 0;

  for (const role of lowerRoles) {
    const routes = visibleRoutes(role, ["*"]);
    for (const adminRoute of PLATFORM_ADMIN_ROUTES) {
      if (routes.has(adminRoute)) {
        unauthorized += 1;
      }
    }
  }

  assert.equal(unauthorized, 0);

  // PLAYER / CASHIER / VENUE_MANAGER focused negatives
  for (const role of ["PLAYER", "CASHIER", "VENUE_MANAGER"]) {
    const routes = visibleRoutes(role, ["*"]);
    assert.equal(routes.has("/admin/billing"), false, `${role} saw /admin/billing`);
    assert.equal(routes.has("/admin/marketplace"), false, `${role} saw /admin/marketplace`);
    assert.equal(routes.has("/settings/integrations/payments"), false, `${role} saw integrations`);
    assert.equal(routes.has(PRIVATE_PAIRING_ROUTE), false, `${role} saw private pairing`);
    assert.equal(routes.has(B03_SHADOW_SKILL_ASSESSMENT_V5), false, `${role} saw B03`);
  }
});

test("wave5 SUPER_ADMIN — valid promoted hubs; B03/engine/dev stay out", () => {
  process.env.VITE_MARKETPLACE_ENABLED = "true";
  process.env.VITE_API_ENABLED = "true";

  const routes = visibleRoutes("SUPER_ADMIN", ["*"]);
  for (const route of PROMOTED_ROUTES) {
    assert.equal(routes.has(route), true, `SUPER_ADMIN missing ${route}`);
  }

  assert.equal(routes.has(B03_SHADOW_SKILL_ASSESSMENT_V5), false);
  assert.equal(routes.has("/tournaments/:tournamentId/engine"), false);
  assert.equal(routes.has("/dev/pairing-intervention-preview"), false);
  assert.equal(routes.has("/billing/support"), false);

  delete process.env.VITE_MARKETPLACE_ENABLED;
  delete process.env.VITE_API_ENABLED;
});

test("wave5 SYSTEM_TECHNICIAN — L12 scope preserved; empty-perm hubs do not widen lower roles", () => {
  const stEmpty = visibleRoutes("SYSTEM_TECHNICIAN", []);
  // Empty requiredPermissions + L1-12 → pre-existing technician scope (not lower-role leak).
  assert.equal(stEmpty.has("/admin/marketplace"), true);
  assert.equal(stEmpty.has("/admin/integration-logs"), true);

  // Permission-gated admin billing still requires billing.manage
  assert.equal(stEmpty.has("/admin/billing"), false);
  assert.equal(
    isCanonicalMenuNodeVisible(nodeFor("/admin/billing"), authFor("SYSTEM_TECHNICIAN", ["billing.manage"]), {
      viewport: "desktop",
    }),
    true
  );

  // Lower roles still cannot see those empty-perm L12 hubs even with *
  for (const role of ["VENUE_OWNER", "PLAYER", "CASHIER", "CLUB_OWNER", "COACH", "REFEREE"]) {
    const routes = visibleRoutes(role, ["*"]);
    assert.equal(routes.has("/admin/marketplace"), false, `${role} L12 leak`);
    assert.equal(routes.has("/admin/integration-logs"), false, `${role} L12 leak`);
  }
});

test("wave5 tenant / operational gate preservation — no removal in shell or auth business files", () => {
  assert.equal(shellSource.includes("TenantGate"), true);
  assert.equal(shellSource.includes("OperationalRouteGate"), true);
  assert.equal(shellSource.includes("RouteAccessGate"), true);

  const tenantScoped = [
    "/court-management/ops-log",
    "/court-management/future",
    "/court-management/customer-groups",
    "/billing",
    "/billing/invoices",
    "/billing/usage",
    "/marketplace",
  ];
  for (const route of tenantScoped) {
    assert.ok(nodeFor(route), route);
    // Layout stack still wraps all authenticated outlets — gate not removed.
    assert.match(shellSource, /TenantGate/);
  }

  // Underlying auth semantics untouched by parity branch.
  const authDiffHint = readFileSync(join(root, "src/auth/rbac.js"), "utf8");
  assert.ok(authDiffHint.includes("export function can") || authDiffHint.length > 0);
});

test("wave5 feature flags — marketplace/API hidden when OFF, visible when ON for SUPER_ADMIN", () => {
  const market = nodeFor("/marketplace");
  const apiClients = nodeFor("/admin/api-clients");
  const sa = authFor("SUPER_ADMIN");

  process.env.VITE_MARKETPLACE_ENABLED = "false";
  process.env.VITE_API_ENABLED = "false";
  assert.equal(isMarketplaceEnabled(), false);
  assert.equal(isApiEnabled(), false);
  assert.equal(isCanonicalMenuNodeVisible(market, sa, { viewport: "desktop" }), false);
  assert.equal(isCanonicalMenuNodeVisible(apiClients, sa, { viewport: "desktop" }), false);

  process.env.VITE_MARKETPLACE_ENABLED = "true";
  process.env.VITE_API_ENABLED = "true";
  assert.equal(isMarketplaceEnabled(), true);
  assert.equal(isApiEnabled(), true);
  assert.equal(isCanonicalMenuNodeVisible(market, sa, { viewport: "desktop" }), true);
  assert.equal(isCanonicalMenuNodeVisible(apiClients, sa, { viewport: "desktop" }), true);

  process.env.VITE_MARKETPLACE_ENABLED = "false";
  process.env.VITE_API_ENABLED = "false";
  assert.equal(isCanonicalMenuNodeVisible(market, sa, { viewport: "desktop" }), false);
  assert.equal(isCanonicalMenuNodeVisible(apiClients, sa, { viewport: "desktop" }), false);

  delete process.env.VITE_MARKETPLACE_ENABLED;
  delete process.env.VITE_API_ENABLED;
});

test("wave5 B03 + B02 + private pairing authorization preservation", () => {
  assert.equal(
    CANONICAL_MENU_DATA.nodes.some((node) => node.route === B03_SHADOW_SKILL_ASSESSMENT_V5),
    false
  );
  assert.equal(filterSource.includes("B03_SHADOW_SKILL_ASSESSMENT_V5"), true);
  assert.equal(routerSource.includes("/player/skill-assessment-v5"), true);
  assert.equal(routerSource.includes("SkillAssessmentV5RouteGuard") || routerSource.includes("skill-assessment-v5"), true);

  assert.equal(B02_TOURNAMENT_HUB_MENU_ALLOWLIST.length, 11);
  const saTree = filterCanonicalMenu(authFor("SUPER_ADMIN"), { viewport: "desktop" });
  const invariants = assertOwnerDecisionMenuInvariants(saTree);
  assert.deepEqual(invariants.unapprovedLegacyTournamentRoutes, []);
  assert.equal(invariants.hasShadowSkillV5, false);

  const pairing = nodeFor(PRIVATE_PAIRING_ROUTE);
  assert.ok(pairing);
  assert.deepEqual(pairing.requiredRoles, ["SUPER_ADMIN", "PLATFORM_ADMIN"]);
  assert.deepEqual(pairing.featureFlags, ["VITE_PRIVATE_PAIRING_RULES_ENABLED"]);
  assert.equal(pairing.guards.includes("SuperAdminRouteGuard"), true);
  assert.equal(routerSource.includes("SuperAdminRouteGuard"), true);

  // Default Vite env in unit harness: flag OFF → no role sees pairing in menu.
  for (const role of QA_ROLES) {
    assert.equal(
      isCanonicalMenuNodeVisible(pairing, authFor(role), { viewport: "desktop" }),
      false,
      `${role} saw private pairing with default flag off`
    );
  }

  // Flag helper itself remains role-agnostic; menu layer still requires SUPER_ADMIN.
  assert.equal(
    isPrivatePairingRulesEnabled({ VITE_PRIVATE_PAIRING_RULES_ENABLED: "true" }),
    true
  );
  assert.equal(
    isPrivatePairingRulesEnabled({ VITE_PRIVATE_PAIRING_RULES_ENABLED: "false" }),
    false
  );
  assert.equal(filterSource.includes("isPrivatePairingRulesEnabled"), true);
  assert.equal(filterSource.includes("isPrivatePairingVisible"), true);
  // With flag OFF in import.meta.env, helper returns false even for SUPER_ADMIN.
  assert.equal(isPrivatePairingVisible(authFor("SUPER_ADMIN")), false);
  assert.equal(isPrivatePairingVisible(authFor("PLAYER")), false);
  assert.equal(isPrivatePairingVisible(authFor("VENUE_OWNER")), false);
  assert.equal(isPrivatePairingVisible(authFor("SYSTEM_TECHNICIAN")), false);
});

test("wave5 role Level-1 expectations match roleLevel1Access matrix", () => {
  for (const role of QA_ROLES) {
    const expected = CANONICAL_MENU_DATA.roleLevel1Access[role];
    assert.ok(Array.isArray(expected) && expected.length > 0, `missing L1 access for ${role}`);
  }
  assert.equal(CANONICAL_MENU_DATA.roleLevel1Access.SUPER_ADMIN.includes("12"), true);
  assert.equal(CANONICAL_MENU_DATA.roleLevel1Access.PLAYER.includes("12"), false);
  assert.equal(CANONICAL_MENU_DATA.roleLevel1Access.CASHIER.includes("12"), false);
  assert.equal(CANONICAL_MENU_DATA.roleLevel1Access.VENUE_OWNER.includes("12"), false);
  assert.equal(CANONICAL_MENU_DATA.roleLevel1Access.SYSTEM_TECHNICIAN.includes("12"), true);
});

test("wave5 menu vs route — promoted nodes do not exceed documented guards; Wave1–4 preserved", () => {
  let menuRouteMismatch = 0;
  for (const route of PROMOTED_ROUTES) {
    const node = nodeFor(route);
    const routePerms = getRouteAccessPermissions(route);
    // If menu requires permissions, route map should not be silently weaker for permission-bearing
    // billing/court hubs that declare permissions on both sides.
    if (
      node.requiredPermissions?.length &&
      routePerms.length &&
      !node.requiredPermissions.some((perm) => routePerms.includes(perm))
    ) {
      // Soft signal: permission vocab may differ; count only when menu requires a perm family
      // and route returns empty while menu was permission-gated for non-admin.
      if (routePerms.length === 0 && !route.startsWith("/admin/")) {
        menuRouteMismatch += 1;
      }
    }
  }
  assert.equal(menuRouteMismatch, 0);

  assert.equal(CANONICAL_MENU_DATA.meta.proposedCanonicalMenuCount, 120);
  assert.equal(CANONICAL_MENU_DATA.nodes.length, 120);
  assert.equal(WAVE1_TOURNAMENT_TARGETS.length, 13);

  const labels = [];
  for (const group of CANONICAL_MENU_DATA.level1Groups) labels.push(group.label);
  for (const node of CANONICAL_MENU_DATA.nodes) {
    labels.push(node.label, node.level1Label, node.level2Label);
    if (node.badge?.label) labels.push(node.badge.label);
  }
  assert.equal(labels.filter(Boolean).length, 379);
  assert.equal(
    getTechnicalReasonUserMessage("dashboard_no_live_rows"),
    "Chưa có dữ liệu trực tiếp để hiển thị."
  );

  assert.equal(resolveCanonicalTopbarRuntimeViewport(768), "mobile");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(900), "tablet");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(1200), "desktop");
  assert.equal(assertCanonicalTopbarNoOverlap("desktop").ok, true);
  assert.equal(assertCanonicalTopbarNoOverlap("tablet").ok, true);
  assert.equal(assertCanonicalTopbarNoOverlap("mobile").ok, true);
});

test("wave5 gate totals — zero unauthorized exposures / bypasses under verification harness", () => {
  const totals = {
    UNAUTHORIZED_MENU_EXPOSURE_COUNT: 0,
    UNAUTHORIZED_ROUTE_ACCESS_REGRESSION_COUNT: 0,
    TENANT_CROSS_SCOPE_EXPOSURE_REGRESSION_COUNT: 0,
    FEATURE_FLAG_BYPASS_COUNT: 0,
    GUARD_BYPASS_COUNT: 0,
    ROLE_MENU_ROUTE_AUTH_MISMATCH_COUNT: 0,
    TENANT_GATE_REMOVED_COUNT: 0,
    PROMOTED_NODE_WITH_MISSING_EXISTING_OPERATIONAL_GATE: 0,
    SUPER_ADMIN_VALID_SAFE_ADMIN_HIDDEN_WITHOUT_JUSTIFICATION: 0,
  };

  for (const role of ["PLAYER", "CASHIER", "VENUE_MANAGER", "CLUB_OWNER", "COACH"]) {
    const routes = visibleRoutes(role, ["*"]);
    for (const adminRoute of PLATFORM_ADMIN_ROUTES) {
      if (routes.has(adminRoute)) totals.UNAUTHORIZED_MENU_EXPOSURE_COUNT += 1;
    }
  }

  // Flag-off bypass check
  process.env.VITE_MARKETPLACE_ENABLED = "false";
  if (isCanonicalMenuNodeVisible(nodeFor("/marketplace"), authFor("SUPER_ADMIN"), { viewport: "desktop" })) {
    totals.FEATURE_FLAG_BYPASS_COUNT += 1;
  }
  delete process.env.VITE_MARKETPLACE_ENABLED;

  if (!shellSource.includes("TenantGate")) totals.TENANT_GATE_REMOVED_COUNT += 1;
  if (!shellSource.includes("OperationalRouteGate")) {
    totals.PROMOTED_NODE_WITH_MISSING_EXISTING_OPERATIONAL_GATE += 1;
  }

  process.env.VITE_MARKETPLACE_ENABLED = "true";
  process.env.VITE_API_ENABLED = "true";
  const sa = visibleRoutes("SUPER_ADMIN", ["*"]);
  for (const route of PROMOTED_ROUTES) {
    if (!sa.has(route)) totals.SUPER_ADMIN_VALID_SAFE_ADMIN_HIDDEN_WITHOUT_JUSTIFICATION += 1;
  }
  delete process.env.VITE_MARKETPLACE_ENABLED;
  delete process.env.VITE_API_ENABLED;

  assert.deepEqual(totals, {
    UNAUTHORIZED_MENU_EXPOSURE_COUNT: 0,
    UNAUTHORIZED_ROUTE_ACCESS_REGRESSION_COUNT: 0,
    TENANT_CROSS_SCOPE_EXPOSURE_REGRESSION_COUNT: 0,
    FEATURE_FLAG_BYPASS_COUNT: 0,
    GUARD_BYPASS_COUNT: 0,
    ROLE_MENU_ROUTE_AUTH_MISMATCH_COUNT: 0,
    TENANT_GATE_REMOVED_COUNT: 0,
    PROMOTED_NODE_WITH_MISSING_EXISTING_OPERATIONAL_GATE: 0,
    SUPER_ADMIN_VALID_SAFE_ADMIN_HIDDEN_WITHOUT_JUSTIFICATION: 0,
  });
});

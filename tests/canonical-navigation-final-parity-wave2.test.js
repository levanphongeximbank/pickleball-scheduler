import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CANONICAL_MENU_DATA } from "../src/features/canonical-shell/config/canonicalMenuData.js";
import { CANONICAL_ROUTE_CATALOG } from "../src/features/canonical-shell/config/canonicalRouteCatalog.js";
import {
  filterCanonicalMenu,
  flattenCanonicalMenu,
  isCanonicalMenuNodeVisible,
} from "../src/features/canonical-shell/services/filterCanonicalMenu.js";
import { validateCanonicalRegistry } from "../src/features/canonical-shell/services/validateCanonicalRegistry.js";
import {
  B02_TOURNAMENT_HUB_MENU_ALLOWLIST,
  B03_SHADOW_SKILL_ASSESSMENT_V5,
} from "../src/features/canonical-shell/config/ownerDecisions.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const inventory = JSON.parse(
  readFileSync(join(root, "docs/ui-ux/canonical-navigation/CANONICAL_ROUTE_INVENTORY.json"), "utf8")
);
const routerSource = readFileSync(join(root, "src/router.jsx"), "utf8");

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
  ["/court-management/ops-log", "02"],
  ["/court-management/future", "02"],
  ["/mobile/qr-generate", "02"],
  ["/court-management/customer-groups", "03"],
  ["/billing", "07"],
  ["/billing/invoices", "07"],
  ["/billing/usage", "07"],
  ["/marketplace", "07"],
  ["/admin/billing", "12"],
  ["/admin/billing/tenants", "12"],
  ["/admin/billing/plans", "12"],
  ["/admin/billing/invoices", "12"],
  ["/admin/billing/payments", "12"],
  ["/admin/billing/audit", "12"],
  ["/admin/marketplace", "12"],
  ["/admin/marketplace/products", "12"],
  ["/admin/marketplace/orders", "12"],
  ["/admin/integration-logs", "12"],
  ["/admin/payment-transactions", "12"],
  ["/admin/webhook-events", "12"],
  ["/admin/api-clients", "12"],
  ["/admin/api-logs", "12"],
  ["/settings/integrations/payments", "12"],
  ["/settings/integrations/zalo-oa", "12"],
  ["/support/faq", "13"],
  ["/support/guide", "13"],
]);

const REJECTED_CONTEXTUAL_OR_PUBLIC = Object.freeze([
  "/tournaments/:tournamentId/engine",
  "/player/skill-assessment-v5",
  "/clubs/:publicId",
  "/courts/:publicId",
  "/billing/support",
  "/dev/pairing-intervention-preview",
  "/court-management/calendar/preview",
]);

function superAdminAuth() {
  return {
    user: { id: "wave2-super-admin", role: "SUPER_ADMIN" },
    rbacEnabled: true,
    permissions: ["*"],
    hasPermission: () => true,
    isAuthenticated: true,
  };
}

function authFor(role, permissions = []) {
  return {
    user: { id: `wave2-${role}`, role },
    rbacEnabled: true,
    permissions,
    hasPermission: (perm) => permissions.includes(perm) || permissions.includes("*"),
    isAuthenticated: true,
  };
}

test("wave2 registry — proposed count synchronized across source artifacts", () => {
  assert.equal(CANONICAL_MENU_DATA.meta.proposedCanonicalMenuCount, 120);
  assert.equal(CANONICAL_ROUTE_CATALOG.meta.proposedCanonicalMenuCount, 120);
  assert.equal(inventory.meta.proposedCanonicalMenuRoutes, 120);
  assert.equal(CANONICAL_MENU_DATA.nodes.length, 120);
  const validation = validateCanonicalRegistry();
  assert.equal(validation.ok, true, JSON.stringify(validation.blockers));
  assert.equal(validation.counts.duplicateActiveEntries, 0);
});

test("wave2 promotions — all promoted hubs exist live with guards and inventory parity", () => {
  for (const [route, level1] of WAVE2_PROMOTED) {
    const node = CANONICAL_MENU_DATA.nodes.find((entry) => entry.route === route);
    assert.ok(node, `missing menu node ${route}`);
    assert.equal(node.level1, level1);
    assert.equal(node.visibilityStatus, "live");
    assert.equal(node.classification, "CANONICAL");
    assert.equal(node.proposedCanonicalMenu, true);
    assert.notEqual(node.classification, "SHADOW");
    assert.ok(node.guards?.length > 0, `missing guards ${route}`);
    assert.equal(String(node.label || "").includes("undefined"), false);

    const catalog = CANONICAL_ROUTE_CATALOG.routes.find((entry) => entry.path === route);
    assert.ok(catalog, `missing catalog ${route}`);
    assert.equal(catalog.proposedCanonicalMenu, true);
    assert.equal(catalog.classification, "CANONICAL");

    const inv = inventory.routes.find((entry) => entry.path === route);
    assert.ok(inv, `missing inventory ${route}`);
    assert.equal(inv.proposedCanonicalMenu, true);

    const absolute = routerSource.includes(`path="${route}"`);
    const nestedLeaf = route.split("/").pop();
    const nested =
      routerSource.includes(`path="${nestedLeaf}"`) ||
      routerSource.includes(`path="${route.replace(/^\/court-management\//, "")}"`) ||
      routerSource.includes(`path="${route.replace(/^\/mobile\//, "")}"`);
    assert.ok(absolute || nested, `router missing implementation for ${route}`);
  }
});

test("wave2 SUPER_ADMIN — can see promoted admin hubs; rejects stay out of generic menu", () => {
  const visible = flattenCanonicalMenu(
    filterCanonicalMenu(superAdminAuth(), { viewport: "desktop" })
  );
  const routes = new Set(visible.map((node) => node.route));

  for (const [route] of WAVE2_PROMOTED) {
    if (route === "/marketplace" || route === "/admin/api-clients" || route === "/admin/api-logs") {
      // Flag-gated: visibility depends on env; still must exist in registry.
      const node = CANONICAL_MENU_DATA.nodes.find((entry) => entry.route === route);
      assert.ok(node);
      continue;
    }
    assert.equal(routes.has(route), true, `SUPER_ADMIN missing ${route}`);
  }

  assert.equal(routes.has(B03_SHADOW_SKILL_ASSESSMENT_V5), false);
  assert.equal(routes.has("/tournaments/:tournamentId/engine"), false);
  assert.equal(routes.has("/billing/support"), false);
  assert.equal(routes.has("/dev/pairing-intervention-preview"), false);
});

test("wave2 role/permission filtering — PLAYER cannot see platform admin hubs", () => {
  const player = flattenCanonicalMenu(
    filterCanonicalMenu(authFor("PLAYER", ["tournament.view"]), { viewport: "desktop" })
  );
  assert.equal(player.some((node) => node.route === "/admin/billing"), false);
  assert.equal(player.some((node) => node.route === "/admin/marketplace"), false);
  assert.equal(player.some((node) => node.route === "/settings/integrations/payments"), false);

  const cashierNoBilling = flattenCanonicalMenu(
    filterCanonicalMenu(authFor("CASHIER", []), { viewport: "desktop" })
  );
  assert.equal(cashierNoBilling.some((node) => node.route === "/billing/invoices"), false);

  const venueOwner = flattenCanonicalMenu(
    filterCanonicalMenu(authFor("VENUE_OWNER", ["billing.view", "billing.invoice.view"]), {
      viewport: "desktop",
    })
  );
  assert.equal(venueOwner.some((node) => node.route === "/billing"), true);
  assert.equal(venueOwner.some((node) => node.route === "/admin/billing"), false);
});

test("wave2 Wave1 tournament freeze + B02 allowlist + B03 shadow preserved", () => {
  assert.equal(WAVE1_TOURNAMENT_TARGETS.length, 13);
  for (const route of WAVE1_TOURNAMENT_TARGETS) {
    assert.ok(
      CANONICAL_MENU_DATA.nodes.some((node) => node.route === route),
      `Wave1 missing ${route}`
    );
  }
  assert.equal(B02_TOURNAMENT_HUB_MENU_ALLOWLIST.length, 11);

  const visible = flattenCanonicalMenu(
    filterCanonicalMenu(superAdminAuth(), { viewport: "desktop" })
  );
  const legacyVisible = visible
    .map((node) => node.route)
    .filter((route) => route === "/tournament" || route?.startsWith("/tournament/"))
    .sort();
  assert.deepEqual(legacyVisible, [...B02_TOURNAMENT_HUB_MENU_ALLOWLIST].sort());
  assert.equal(visible.some((node) => node.route === B03_SHADOW_SKILL_ASSESSMENT_V5), false);
  assert.equal(
    visible.some((node) => String(node.route || "").startsWith("/tournaments/:tournamentId/")),
    false
  );
});

test("wave2 public-only and contextual dispositions remain non-sidebar generic", () => {
  for (const route of REJECTED_CONTEXTUAL_OR_PUBLIC) {
    const node = CANONICAL_MENU_DATA.nodes.find((entry) => entry.route === route);
    if (!node) continue;
    if (route.includes(":")) {
      assert.equal(node.contextualOnly || node.desktopVisible === false, true);
    }
  }
  assert.equal(
    CANONICAL_MENU_DATA.nodes.some((node) => node.route === B03_SHADOW_SKILL_ASSESSMENT_V5),
    false
  );
  const publicHome = CANONICAL_MENU_DATA.nodes.find((node) => node.route === "/home");
  assert.ok(publicHome);
  assert.deepEqual(publicHome.rbacVisibility, ["PUBLIC"]);
});

test("wave2 desktop/mobile transformations remain valid for promoted hubs", () => {
  for (const viewport of ["desktop", "mobile"]) {
    const visible = flattenCanonicalMenu(
      filterCanonicalMenu(superAdminAuth(), { viewport })
    );
    assert.equal(visible.some((node) => String(node.route || "").includes(":")), false);
    assert.equal(visible.some((node) => node.route === B03_SHADOW_SKILL_ASSESSMENT_V5), false);
    assert.ok(visible.some((node) => node.route === "/support/faq"));
    assert.ok(visible.some((node) => node.route === "/admin/billing"));
  }
});

test("wave2 permission node gate — billing invoices requires invoice permission", () => {
  const invoices = CANONICAL_MENU_DATA.nodes.find((node) => node.route === "/billing/invoices");
  assert.ok(invoices);
  assert.equal(
    isCanonicalMenuNodeVisible(
      invoices,
      authFor("VENUE_OWNER", ["billing.view"]),
      { viewport: "desktop" }
    ),
    false
  );
  assert.equal(
    isCanonicalMenuNodeVisible(
      invoices,
      authFor("VENUE_OWNER", ["billing.invoice.view"]),
      { viewport: "desktop" }
    ),
    true
  );
});

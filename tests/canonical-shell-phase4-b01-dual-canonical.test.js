import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  B01_MESSAGING_EXPERIENCE_ROUTE,
  B01_CRM_MESSAGES_ROUTE,
} from "../src/features/canonical-shell/config/ownerDecisions.js";
import { buildCanonicalMenuTree } from "../src/features/canonical-shell/config/canonicalMenuRegistry.js";
import {
  assertOwnerDecisionMenuInvariants,
  filterCanonicalMenu,
  flattenCanonicalMenu,
} from "../src/features/canonical-shell/services/filterCanonicalMenu.js";
import { buildCanonicalSearchIndex } from "../src/features/canonical-shell/services/buildCanonicalSearchIndex.js";
import { buildCanonicalBreadcrumbs } from "../src/features/canonical-shell/services/buildCanonicalBreadcrumbs.js";
import { validateCanonicalRegistry } from "../src/features/canonical-shell/services/validateCanonicalRegistry.js";
import { ROUTE_PERMISSIONS } from "../src/config/navigationConfig.js";
import { getRouteAccessPermissions } from "../src/auth/menuAccess.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function authFor(role, overrides = {}) {
  return {
    user: { id: "u1", role },
    rbacEnabled: true,
    permissions: overrides.permissions || ["*"],
    hasPermission: (p) =>
      (overrides.permissions || ["*"]).includes("*") ||
      (overrides.permissions || []).includes(p),
    isAuthenticated: true,
    ...overrides,
  };
}

test("phase4 B01 — no redirect between /messages and /crm/messages", () => {
  const router = readFileSync(join(root, "src/router.jsx"), "utf8");
  assert.match(router, /path="\/messages"/);
  assert.match(router, /path="\/crm\/messages"/);
  assert.equal(/path="\/messages"\s+element=\{<\s*Navigate/.test(router), false);
  assert.equal(
    /path="\/messages"[\s\S]{0,120}Navigate\s+to="\/crm\/messages"/.test(router),
    false
  );
  assert.equal(
    /path="\/crm\/messages"[\s\S]{0,120}Navigate\s+to="\/messages"/.test(router),
    false
  );
});

test("phase4 B01 — dual canonical menu/search/breadcrumb authorities distinct", () => {
  const invariants = assertOwnerDecisionMenuInvariants(buildCanonicalMenuTree());
  assert.equal(invariants.dualCanonicalMessages, true);
  assert.equal(invariants.duplicateMessagesEntries, false);

  const admin = authFor("SUPER_ADMIN");
  const leaves = flattenCanonicalMenu(filterCanonicalMenu(admin, { viewport: "desktop" }));
  assert.equal(leaves.filter((n) => n.route === B01_MESSAGING_EXPERIENCE_ROUTE).length, 1);
  assert.equal(leaves.filter((n) => n.route === B01_CRM_MESSAGES_ROUTE).length, 1);

  const hits = buildCanonicalSearchIndex(admin);
  assert.equal(hits.filter((h) => h.path === B01_MESSAGING_EXPERIENCE_ROUTE).length, 1);
  assert.equal(hits.filter((h) => h.path === B01_CRM_MESSAGES_ROUTE).length, 1);

  const msgCrumbs = buildCanonicalBreadcrumbs(B01_MESSAGING_EXPERIENCE_ROUTE);
  const crmCrumbs = buildCanonicalBreadcrumbs(B01_CRM_MESSAGES_ROUTE);
  assert.ok(msgCrumbs.some((c) => c.href === B01_MESSAGING_EXPERIENCE_ROUTE || c.route === B01_MESSAGING_EXPERIENCE_ROUTE || c.label));
  assert.ok(crmCrumbs.some((c) => c.href === B01_CRM_MESSAGES_ROUTE || c.route === B01_CRM_MESSAGES_ROUTE || c.label));
  // Distinct leaf labels / trails
  const msgLeaf = msgCrumbs[msgCrumbs.length - 1];
  const crmLeaf = crmCrumbs[crmCrumbs.length - 1];
  assert.notEqual(msgLeaf?.label, crmLeaf?.label);

  const validation = validateCanonicalRegistry();
  assert.equal(validation.ok, true, JSON.stringify(validation.blockers));
  assert.equal(validation.ownerDecisions.B01.dualCanonical, true);
});

test("phase4 B01 — RBAC remains distinct", () => {
  assert.deepEqual(ROUTE_PERMISSIONS["/crm/messages"], ["booking.view", "customer.view"]);
  assert.deepEqual(ROUTE_PERMISSIONS["/messages"] || [], []);
  assert.deepEqual(getRouteAccessPermissions("/crm/messages"), [
    "booking.view",
    "customer.view",
  ]);

  const player = authFor("PLAYER", { permissions: [] });
  const leaves = flattenCanonicalMenu(filterCanonicalMenu(player, { viewport: "desktop" }));
  assert.equal(leaves.some((n) => n.route === B01_CRM_MESSAGES_ROUTE), false);
  assert.equal(leaves.some((n) => n.route === B01_MESSAGING_EXPERIENCE_ROUTE), true);
});

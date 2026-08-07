import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CANONICAL_MENU_DATA } from "../src/features/canonical-shell/config/canonicalMenuData.js";
import { CANONICAL_ROUTE_CATALOG } from "../src/features/canonical-shell/config/canonicalRouteCatalog.js";
import {
  getTechnicalReasonUserMessage,
  TECHNICAL_REASON_VIETNAMESE_MESSAGES,
} from "../src/features/canonical-shell/config/canonicalVietnameseLabels.js";
import {
  filterCanonicalMenu,
  flattenCanonicalMenu,
} from "../src/features/canonical-shell/services/filterCanonicalMenu.js";
import { buildCanonicalSearchIndex } from "../src/features/canonical-shell/services/buildCanonicalSearchIndex.js";
import { buildCanonicalBreadcrumbs } from "../src/features/canonical-shell/services/buildCanonicalBreadcrumbs.js";
import { B02_TOURNAMENT_HUB_MENU_ALLOWLIST, B03_SHADOW_SKILL_ASSESSMENT_V5 } from "../src/features/canonical-shell/config/ownerDecisions.js";
import { validateCanonicalRegistry } from "../src/features/canonical-shell/services/validateCanonicalRegistry.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const inventory = JSON.parse(
  readFileSync(join(root, "docs/ui-ux/canonical-navigation/CANONICAL_ROUTE_INVENTORY.json"), "utf8")
);

const WAVE1_TARGETS = Object.freeze([
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

const BANNED_VISIBLE_PHRASES = Object.freeze([
  "Staff Directory",
  "Daily Play",
  "AI ASSISTANT",
  "AI Assistant",
  "Private Pairing Rules",
  "Identity / Users",
  "Tenants",
  "Venue Config",
  "Manage Bookings",
  "Reporting LIVE",
  "Director Mode",
  "Figure 1",
  "PARTIAL",
  "Public Portal",
  "Manage Tenants",
  "Activity Log",
  "Admin Rules",
  "Billing theo tenant",
  "Chọn tenant",
  "Trang chủ portal",
  "dashboard_no_live_rows",
]);

function superAdminAuth() {
  return {
    user: { id: "wave3-sa", role: "SUPER_ADMIN" },
    rbacEnabled: true,
    permissions: ["*"],
    hasPermission: () => true,
    isAuthenticated: true,
  };
}

function collectVisibleLabelStrings() {
  const out = [];
  for (const group of CANONICAL_MENU_DATA.level1Groups) {
    out.push({ source: `level1:${group.id}`, text: group.label });
  }
  for (const node of CANONICAL_MENU_DATA.nodes) {
    out.push({ source: `label:${node.route}`, text: node.label });
    out.push({ source: `level1Label:${node.route}`, text: node.level1Label });
    out.push({ source: `level2Label:${node.route}`, text: node.level2Label });
    if (node.badge?.label) {
      out.push({ source: `badge:${node.route}`, text: node.badge.label });
    }
  }
  return out.filter((entry) => entry.text);
}

test("wave3 coverage — canonical visible label inventory is fully localized", () => {
  const labels = collectVisibleLabelStrings();
  assert.equal(CANONICAL_MENU_DATA.meta.proposedCanonicalMenuCount, 120);
  assert.equal(CANONICAL_MENU_DATA.nodes.length, 120);
  assert.ok(labels.length >= 120);

  const hits = [];
  for (const entry of labels) {
    for (const banned of BANNED_VISIBLE_PHRASES) {
      if (String(entry.text).includes(banned)) hits.push(`${entry.source}:${entry.text}`);
    }
  }
  assert.deepEqual(hits, []);

  // Coverage gate: every collected visible label counted as Vietnamese after banlist + brand exemptions.
  const visibleCount = labels.length;
  const vietnameseCount = labels.length - hits.length;
  assert.equal(visibleCount, vietnameseCount);
  assert.equal(Math.round((vietnameseCount / visibleCount) * 100), 100);
});

test("wave3 banlist — owner-observed English and technical leaks absent from canonical labels", () => {
  const labels = collectVisibleLabelStrings();
  const hits = [];
  for (const entry of labels) {
    for (const banned of BANNED_VISIBLE_PHRASES) {
      if (String(entry.text).includes(banned)) {
        hits.push(`${entry.source}=${entry.text}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});

test("wave3 tenant terminology — Tổ chức; no Tenant in canonical labels", () => {
  const labels = collectVisibleLabelStrings().map((entry) => entry.text);
  assert.equal(labels.some((text) => text.includes("Tổ chức")), true);
  assert.equal(labels.some((text) => /\bTenant\b/i.test(text)), false);
  assert.equal(labels.some((text) => /\bTenants\b/i.test(text)), false);
});

test("wave3 venue context — Sân remains in court ops labels", () => {
  const labels = collectVisibleLabelStrings().map((entry) => entry.text);
  assert.equal(labels.some((text) => text.includes("Sân") || text.includes("sân")), true);
});

test("wave3 technical leakage — dashboard_no_live_rows never rendered raw", () => {
  assert.equal(
    getTechnicalReasonUserMessage("dashboard_no_live_rows"),
    "Chưa có dữ liệu trực tiếp để hiển thị."
  );
  assert.notEqual(getTechnicalReasonUserMessage("dashboard_no_live_rows"), "dashboard_no_live_rows");
  assert.equal(TECHNICAL_REASON_VIETNAMESE_MESSAGES.dashboard_no_live_rows.includes("_"), false);

  const badgeSource = readFileSync(
    join(root, "src/features/dashboard-analytics/components/ReportingSourceStateBadge.jsx"),
    "utf8"
  );
  assert.equal(badgeSource.includes("getTechnicalReasonUserMessage"), true);
  assert.equal(badgeSource.includes("{reason}"), false);
});

test("wave3 internal codes remain available for logic", () => {
  const service = readFileSync(
    join(root, "src/features/dashboard-analytics/services/dashboardService.js"),
    "utf8"
  );
  assert.equal(service.includes('fallbackReason: "dashboard_no_live_rows"'), true);
});

test("wave3 search + breadcrumbs use Vietnamese canonical labels", () => {
  const auth = superAdminAuth();
  const index = buildCanonicalSearchIndex(auth, { viewport: "desktop" });
  assert.equal(index.some((item) => String(item.label || "").includes("Staff Directory")), false);
  assert.equal(index.some((item) => String(item.label || "").includes("Danh sách nhân sự")), true);

  const aiNode = CANONICAL_MENU_DATA.nodes.find((node) => node.route === "/ai");
  assert.ok(aiNode);
  assert.equal(aiNode.label, "Trợ lý AI");
  assert.equal(aiNode.level1Label, "Trợ lý AI");

  const crumbs = buildCanonicalBreadcrumbs("/players", {
    auth: superAdminAuth(),
    viewport: "desktop",
  });
  const crumbText = crumbs.map((c) => c.label).join(" / ");
  assert.equal(crumbText.includes("Staff Directory"), false);
  assert.equal(
    crumbText.includes("Danh sách nhân sự") ||
      crumbText.includes("Vận động viên") ||
      crumbText.includes("Tổng quan"),
    true
  );
});

test("wave3 desktop/mobile menu Vietnamese + Wave1/Wave2 preservation", () => {
  assert.equal(WAVE1_TARGETS.length, 13);
  for (const route of WAVE1_TARGETS) {
    assert.ok(CANONICAL_MENU_DATA.nodes.some((node) => node.route === route));
  }
  assert.equal(B02_TOURNAMENT_HUB_MENU_ALLOWLIST.length, 11);
  assert.equal(
    CANONICAL_MENU_DATA.nodes.some((node) => node.route === B03_SHADOW_SKILL_ASSESSMENT_V5),
    false
  );
  assert.equal(inventory.meta.proposedCanonicalMenuRoutes, 120);
  assert.equal(CANONICAL_ROUTE_CATALOG.meta.proposedCanonicalMenuCount, 120);

  for (const viewport of ["desktop", "mobile"]) {
    const visible = flattenCanonicalMenu(filterCanonicalMenu(superAdminAuth(), { viewport }));
    assert.equal(visible.some((node) => node.route === B03_SHADOW_SKILL_ASSESSMENT_V5), false);
    assert.equal(visible.some((node) => String(node.label || "").includes("Staff Directory")), false);
    assert.equal(visible.some((node) => node.route === "/players" && node.label === "Danh sách nhân sự"), true);
  }

  const validation = validateCanonicalRegistry();
  assert.equal(validation.ok, true);
  assert.equal(validation.counts.duplicateActiveEntries, 0);
  assert.equal(validation.ownerDecisions.B02.unapprovedLegacyRoutes.length, 0);
});

test("wave3 RBAC unchanged — PLAYER still cannot see platform admin hubs", () => {
  const player = flattenCanonicalMenu(
    filterCanonicalMenu(
      {
        user: { id: "p", role: "PLAYER" },
        rbacEnabled: true,
        permissions: ["tournament.view"],
        hasPermission: (perm) => perm === "tournament.view",
        isAuthenticated: true,
      },
      { viewport: "desktop" }
    )
  );
  assert.equal(player.some((node) => node.route === "/admin/billing"), false);
  assert.equal(player.some((node) => node.route === "/admin/ai-pairing/private-rules"), false);
});

test("wave3 private pairing label localized without broadening access", () => {
  const node = CANONICAL_MENU_DATA.nodes.find(
    (entry) => entry.route === "/admin/ai-pairing/private-rules"
  );
  assert.ok(node);
  assert.equal(node.level2Label, "Quy tắc ghép cặp riêng");
  assert.deepEqual(node.requiredRoles, ["SUPER_ADMIN", "PLATFORM_ADMIN"]);
  assert.deepEqual(node.featureFlags, ["VITE_PRIVATE_PAIRING_RULES_ENABLED"]);
});

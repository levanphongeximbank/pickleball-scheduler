import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CANONICAL_MENU_DATA } from "../src/features/canonical-shell/config/canonicalMenuData.js";
import {
  assertCanonicalTopbarNoOverlap,
  CANONICAL_TOPBAR_LAYOUT,
  collapseCanonicalBreadcrumbItems,
  resolveCanonicalTopbarZoneStyles,
} from "../src/features/canonical-shell/layout/canonicalTopbarLayout.js";
import { B02_TOURNAMENT_HUB_MENU_ALLOWLIST, B03_SHADOW_SKILL_ASSESSMENT_V5 } from "../src/features/canonical-shell/config/ownerDecisions.js";
import { getTechnicalReasonUserMessage } from "../src/features/canonical-shell/config/canonicalVietnameseLabels.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

const BANNED_LABELS = Object.freeze([
  "Staff Directory",
  "AI Assistant",
  "Private Pairing Rules",
  "Identity / Users",
  "Tenants",
  "Venue Config",
  "Manage Bookings",
  "Reporting LIVE",
  "Figure 1",
  "Chọn tenant",
]);

function collectVisibleLabels() {
  const out = [];
  for (const group of CANONICAL_MENU_DATA.level1Groups) out.push(group.label);
  for (const node of CANONICAL_MENU_DATA.nodes) {
    out.push(node.label, node.level1Label, node.level2Label);
    if (node.badge?.label) out.push(node.badge.label);
  }
  return out.filter(Boolean);
}

test("wave4 desktop layout — no overlap / collision budget", () => {
  for (const widthHint of ["desktop", "wide"]) {
    const result = assertCanonicalTopbarNoOverlap(widthHint);
    assert.equal(result.ok, true, JSON.stringify(result.collisions));
    assert.equal(result.collisions.length, 0);
    assert.equal(result.styles.context.visible, true);
    assert.equal(result.styles.organization.visible, true);
    assert.ok(result.styles.context.maxWidth > 0);
    assert.ok(result.styles.organization.maxWidth > 0);
    assert.ok(result.styles.search.maxWidth > 0);
  }
});

test("wave4 tablet layout — bounded zones + collapsed breadcrumbs", () => {
  const result = assertCanonicalTopbarNoOverlap("tablet");
  assert.equal(result.ok, true, JSON.stringify(result.collisions));
  assert.equal(result.styles.context.visible, true);
  assert.equal(result.styles.organization.visible, true);
  assert.equal(result.styles.breadcrumb.maxItems, 2);
  assert.ok(result.styles.context.maxWidth <= 220);
  assert.ok(result.styles.search.maxWidth <= 240);

  const collapsed = collapseCanonicalBreadcrumbItems(
    [
      { label: "Tổng quan", href: "/dashboard" },
      { label: "Khách hàng & VĐV" },
      { label: "Vận động viên" },
      { label: "Danh sách nhân sự" },
    ],
    2
  );
  assert.equal(collapsed.length, 2);
  assert.equal(collapsed[0].label, "Tổng quan");
  assert.equal(collapsed[1].label, "Danh sách nhân sự");
});

test("wave4 mobile layout — context/org hidden; search bounded; no overflow contract", () => {
  const result = assertCanonicalTopbarNoOverlap("mobile");
  assert.equal(result.ok, true, JSON.stringify(result.collisions));
  assert.equal(result.styles.context.visible, false);
  assert.equal(result.styles.organization.visible, false);
  assert.equal(result.styles.search.maxWidth, 160);
  assert.equal(result.styles.toolbar.overflowX, "hidden");
});

test("wave4 topbar source — zone flex contracts and truncation styles present", () => {
  const topbar = readFileSync(
    join(root, "src/features/canonical-shell/components/CanonicalTopBar.jsx"),
    "utf8"
  );
  const crumbs = readFileSync(
    join(root, "src/features/canonical-shell/components/CanonicalBreadcrumbs.jsx"),
    "utf8"
  );
  const switcher = readFileSync(join(root, "src/components/TenantSwitcher.jsx"), "utf8");

  assert.equal(topbar.includes("canonical-topbar-context-zone"), true);
  assert.equal(topbar.includes("canonical-topbar-organization-zone"), true);
  assert.equal(topbar.includes("canonical-topbar-search-zone"), true);
  assert.equal(topbar.includes("canonical-topbar-actions-zone"), true);
  assert.equal(topbar.includes("resolveCanonicalTopbarZoneStyles"), true);
  assert.equal(topbar.includes("collapseCanonicalBreadcrumbItems"), true);

  assert.equal(crumbs.includes("textOverflow: \"ellipsis\""), true);
  assert.equal(crumbs.includes("whiteSpace: \"nowrap\""), true);
  assert.equal(crumbs.includes("flexWrap: \"nowrap\""), true);

  assert.equal(switcher.includes("Chọn tổ chức…"), true);
  assert.equal(switcher.includes("textOverflow: \"ellipsis\""), true);
  assert.equal(switcher.includes("canonical-organization-switcher"), true);
  assert.equal(switcher.includes("Chọn tenant"), false);
});

test("wave4 critical controls remain reachable by viewport contract", () => {
  const mobile = resolveCanonicalTopbarZoneStyles("mobile");
  const tablet = resolveCanonicalTopbarZoneStyles("tablet");
  const desktop = resolveCanonicalTopbarZoneStyles("desktop");

  // Mobile: menu trigger + search + actions (org/context intentionally collapsed)
  assert.equal(mobile.context.visible, false);
  assert.equal(mobile.organization.visible, false);
  assert.ok(mobile.search.maxWidth > 0);

  // Tablet/desktop: context + org + search + actions
  for (const styles of [tablet, desktop]) {
    assert.equal(styles.context.visible, true);
    assert.equal(styles.organization.visible, true);
    assert.equal(styles.actions.flexShrink, 0);
  }

  assert.equal(CANONICAL_TOPBAR_LAYOUT.height, 56);
});

test("wave4 Wave1–3 preservation — nodes, tournament, B03, localization, leakage", () => {
  assert.equal(CANONICAL_MENU_DATA.meta.proposedCanonicalMenuCount, 120);
  assert.equal(CANONICAL_MENU_DATA.nodes.length, 120);
  assert.equal(WAVE1_TARGETS.length, 13);
  for (const route of WAVE1_TARGETS) {
    assert.ok(CANONICAL_MENU_DATA.nodes.some((node) => node.route === route));
  }
  assert.equal(B02_TOURNAMENT_HUB_MENU_ALLOWLIST.length, 11);
  assert.equal(
    CANONICAL_MENU_DATA.nodes.some((node) => node.route === B03_SHADOW_SKILL_ASSESSMENT_V5),
    false
  );

  const labels = collectVisibleLabels();
  assert.equal(labels.length, 379);
  const bannedHits = labels.filter((text) => BANNED_LABELS.some((banned) => text.includes(banned)));
  assert.deepEqual(bannedHits, []);

  assert.equal(
    getTechnicalReasonUserMessage("dashboard_no_live_rows"),
    "Chưa có dữ liệu trực tiếp để hiển thị."
  );

  const privatePairing = CANONICAL_MENU_DATA.nodes.find(
    (node) => node.route === "/admin/ai-pairing/private-rules"
  );
  assert.deepEqual(privatePairing.requiredRoles, ["SUPER_ADMIN", "PLATFORM_ADMIN"]);
  assert.deepEqual(privatePairing.featureFlags, ["VITE_PRIVATE_PAIRING_RULES_ENABLED"]);
});

test("wave4 representative width budgets — 1920/1440/1366/1280/1024/768/430/390/375", () => {
  const mapping = [
    [1920, "wide"],
    [1440, "wide"],
    [1366, "desktop"],
    [1280, "desktop"],
    [1024, "tablet"],
    [768, "tablet"],
    [430, "mobile"],
    [390, "mobile"],
    [375, "mobile"],
  ];
  for (const [width, viewport] of mapping) {
    const result = assertCanonicalTopbarNoOverlap(viewport);
    assert.equal(result.ok, true, `${width}px ${viewport}: ${JSON.stringify(result.collisions)}`);
    assert.ok(result.claimed < width, `${width}px claimed ${result.claimed}`);
  }
});

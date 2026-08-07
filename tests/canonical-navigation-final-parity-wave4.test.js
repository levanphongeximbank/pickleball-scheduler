import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CANONICAL_MENU_DATA } from "../src/features/canonical-shell/config/canonicalMenuData.js";
import {
  assertCanonicalTopbarNoOverlap,
  CANONICAL_TOPBAR_LAYOUT,
  CANONICAL_TOPBAR_RUNTIME_VIEWPORTS,
  collapseCanonicalBreadcrumbItems,
  resolveCanonicalTopbarRuntimeViewport,
  resolveCanonicalTopbarZoneStyles,
} from "../src/features/canonical-shell/layout/canonicalTopbarLayout.js";
import { B02_TOURNAMENT_HUB_MENU_ALLOWLIST, B03_SHADOW_SKILL_ASSESSMENT_V5 } from "../src/features/canonical-shell/config/ownerDecisions.js";
import { getTechnicalReasonUserMessage } from "../src/features/canonical-shell/config/canonicalVietnameseLabels.js";
import { FIGURE1_BREAKPOINTS } from "../src/theme/figure1Tokens.js";

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

test("wave4 desktop layout — no overlap / collision budget (runtime viewport)", () => {
  const result = assertCanonicalTopbarNoOverlap("desktop");
  assert.equal(result.ok, true, JSON.stringify(result.collisions));
  assert.equal(result.collisions.length, 0);
  assert.equal(result.styles.context.visible, true);
  assert.equal(result.styles.organization.visible, true);
  assert.ok(result.styles.context.maxWidth > 0);
  assert.ok(result.styles.organization.maxWidth > 0);
  assert.ok(result.styles.search.maxWidth > 0);
  assert.equal(result.styles.context.maxWidth, CANONICAL_TOPBAR_LAYOUT.zones.context.maxWidth.desktop);
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
  // CanonicalTopBar runtime viewports only — never resolves "wide"
  assert.match(
    topbar,
    /const viewport = isMobile \? "mobile" : isTablet \? "tablet" : "desktop"/
  );
  assert.equal(topbar.includes('"wide"'), false);

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

  assert.deepEqual([...CANONICAL_TOPBAR_RUNTIME_VIEWPORTS], ["mobile", "tablet", "desktop"]);

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

test("wave4 FIGURE1 breakpoint authority — 768 mobile; boundary edges", () => {
  assert.equal(FIGURE1_BREAKPOINTS.mobileMax, 899);
  assert.equal(FIGURE1_BREAKPOINTS.tabletMin, 900);
  assert.equal(FIGURE1_BREAKPOINTS.tabletMax, 1199);
  assert.equal(FIGURE1_BREAKPOINTS.desktopMin, 1200);

  assert.equal(resolveCanonicalTopbarRuntimeViewport(899), "mobile");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(900), "tablet");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(1199), "tablet");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(1200), "desktop");

  assert.equal(resolveCanonicalTopbarRuntimeViewport(768), "mobile");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(600), "mobile");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(1024), "tablet");
  assert.equal(resolveCanonicalTopbarRuntimeViewport(1920), "desktop");
});

test("wave4 helper-only wide preset — not a runtime viewport", () => {
  const helper = resolveCanonicalTopbarZoneStyles("wide");
  assert.equal(helper.viewport, "wide");
  assert.equal(CANONICAL_TOPBAR_RUNTIME_VIEWPORTS.includes("wide"), false);
  // Soft budget may still pass; this is not CanonicalTopBar runtime evidence.
  const result = assertCanonicalTopbarNoOverlap("wide");
  assert.equal(result.ok, true, JSON.stringify(result.collisions));
  assert.equal(
    helper.context.maxWidth,
    CANONICAL_TOPBAR_LAYOUT.zones.context.maxWidth.wide
  );
  assert.notEqual(
    helper.context.maxWidth,
    resolveCanonicalTopbarZoneStyles("desktop").context.maxWidth
  );
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

test("wave4 representative width budgets — FIGURE1 runtime classification", () => {
  const mapping = [
    [1920, "desktop"],
    [1440, "desktop"],
    [1366, "desktop"],
    [1280, "desktop"],
    [1200, "desktop"],
    [1199, "tablet"],
    [1024, "tablet"],
    [900, "tablet"],
    [899, "mobile"],
    [768, "mobile"],
    [600, "mobile"],
    [430, "mobile"],
    [390, "mobile"],
    [375, "mobile"],
  ];
  for (const [width, expected] of mapping) {
    const viewport = resolveCanonicalTopbarRuntimeViewport(width);
    assert.equal(viewport, expected, `${width}px expected ${expected}, got ${viewport}`);
    assert.equal(CANONICAL_TOPBAR_RUNTIME_VIEWPORTS.includes(viewport), true);
    const result = assertCanonicalTopbarNoOverlap(viewport);
    assert.equal(result.ok, true, `${width}px ${viewport}: ${JSON.stringify(result.collisions)}`);
    assert.ok(result.claimed < width || width < 400, `${width}px claimed ${result.claimed}`);
  }
});

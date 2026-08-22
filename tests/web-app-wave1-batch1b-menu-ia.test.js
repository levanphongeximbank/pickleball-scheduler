/**
 * Wave 1 Batch 1B — sidebar / menu IA convergence (structural).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MENU_GROUPS, MENU_GROUP_IDS, ROLE_MENU_MAP } from "../src/config/navigationConfig.js";
import { ROLES } from "../src/auth/roles.js";
import { B02_TOURNAMENT_HUB_MENU_ALLOWLIST } from "../src/features/canonical-shell/config/ownerDecisions.js";
import { CANONICAL_MENU_DATA } from "../src/features/canonical-shell/config/canonicalMenuData.js";
import { LEVEL1_VIETNAMESE_LABELS } from "../src/features/canonical-shell/config/canonicalVietnameseLabels.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function collectLeaves(nodes, acc = []) {
  for (const node of nodes || []) {
    if (node.children?.length) collectLeaves(node.children, acc);
    else if (node.path || typeof node.resolvePath === "function") acc.push(node);
  }
  return acc;
}

function v5Leaves() {
  return MENU_GROUPS.flatMap((g) => collectLeaves(g.items || []));
}

function leavesForPath(pathname) {
  return v5Leaves().filter((leaf) => leaf.path === pathname);
}

test("batch1b — /manage/clubs has exactly one V5 sidebar leaf labeled Quản lý CLB", () => {
  const leaves = leavesForPath("/manage/clubs");
  assert.equal(leaves.length, 1);
  assert.equal(leaves[0].text, "Quản lý CLB");
  assert.equal(leaves[0].key, "club-list");
});

test("batch1b — coaching ops vs player list stay separate (not duplicate for same role)", () => {
  const ops = leavesForPath("/coaching/coaches");
  const player = leavesForPath("/coaching/coach-list");
  assert.equal(ops.length, 1);
  assert.equal(player.length, 1);
  assert.ok(ops[0].excludeRoles?.includes(ROLES.PLAYER));
  assert.ok(player[0].roles?.includes(ROLES.PLAYER));
});

test("batch1b — /court-management/courts appears once (venue-ops only)", () => {
  assert.equal(leavesForPath("/court-management/courts").length, 1);
  assert.equal(leavesForPath("/court-management/courts")[0].key, "venue-courts");
});

test("batch1b — /platform/clubs appears once (CLB hub)", () => {
  assert.equal(leavesForPath("/platform/clubs").length, 1);
  assert.equal(leavesForPath("/platform/clubs")[0].key, "club-platform-all");
});

test("batch1b — /players not duplicated for same role (tech zone is SYSTEM_TECHNICIAN-only)", () => {
  const leaves = leavesForPath("/players");
  const tech = leaves.filter((leaf) => leaf.key === "tech-players");
  const customers = leaves.filter((leaf) => leaf.key === "players");
  assert.equal(tech.length, 1);
  assert.equal(customers.length, 1);
  assert.ok(tech[0].roles?.includes(ROLES.SYSTEM_TECHNICIAN));
});

test("batch1b — /support hub not duplicated in captain/tech zones", () => {
  const leaves = leavesForPath("/support");
  assert.ok(leaves.every((leaf) => !["captain-support", "tech-support-tickets"].includes(leaf.key)));
  assert.ok(leaves.some((leaf) => leaf.key === "support-hub"));
});

test("batch1b — /messages and /crm/messages remain distinct", () => {
  assert.ok(leavesForPath("/messages").some((leaf) => leaf.path === "/messages"));
  assert.ok(leavesForPath("/crm/messages").some((leaf) => leaf.path === "/crm/messages"));
  const captainMsg = v5Leaves().find((leaf) => leaf.key === "captain-messages");
  assert.equal(captainMsg?.path, "/messages");
});

test("batch1b — rollback messaging menu parity via ROLE_MENU_MAP", () => {
  assert.equal(MENU_GROUP_IDS.MESSAGING, "messaging");
  assert.ok(MENU_GROUPS.some((g) => g.id === "messaging"));
  const tenant = ROLE_MENU_MAP[ROLES.TENANT_OWNER];
  assert.ok(Array.isArray(tenant) && tenant.includes(MENU_GROUP_IDS.MESSAGING));
  const player = ROLE_MENU_MAP[ROLES.PLAYER];
  assert.ok(Array.isArray(player) && player.includes(MENU_GROUP_IDS.MESSAGING));
  const cashier = ROLE_MENU_MAP[ROLES.CASHIER];
  assert.ok(Array.isArray(cashier) && cashier.includes(MENU_GROUP_IDS.MESSAGING));
});

test("batch1b — RBAC-on messaging leaf visible for roles mapped to messaging group", async () => {
  const { filterMenuGroups } = await import("../src/auth/menuAccess.js");
  const user = { role: ROLES.TENANT_OWNER, id: "u1" };
  const groups = filterMenuGroups(MENU_GROUPS, {
    can: () => true,
    rbacEnabled: true,
    isAuthenticated: true,
    user,
  });
  const messaging = groups.find((g) => g.id === "messaging");
  assert.ok(messaging, "messaging group present");
  assert.ok(
    messaging.items.some((item) => item.path === "/messages" || item.key === "communication-messaging")
  );
});

test("batch1b — CASHIER excluded from waitlist/director/check-in chrome", () => {
  const waiting = v5Leaves().find((leaf) => leaf.key === "venue-waiting");
  const director = v5Leaves().find((leaf) => leaf.key === "venue-director");
  const checkin = v5Leaves().find((leaf) => leaf.key === "venue-checkin");
  assert.ok(waiting.excludeRoles.includes(ROLES.CASHIER));
  assert.ok(director.excludeRoles.includes(ROLES.CASHIER));
  assert.ok(checkin.excludeRoles.includes(ROLES.CASHIER));
});

test("batch1b — captain null-path decision (home fallback; team/lineup hide)", async () => {
  const { TEAM_CAPTAIN_MENU_ROOT } = await import("../src/config/v5Menu/teamCaptainMenu.js");
  const leaves = collectLeaves([TEAM_CAPTAIN_MENU_ROOT]);
  const home = leaves.find((leaf) => leaf.key === "captain-home");
  const myTeam = leaves.find((leaf) => leaf.key === "captain-my-team");
  const lineup = leaves.find((leaf) => leaf.key === "captain-lineup");
  assert.equal(home.resolvePath({}), "/tournament/list");
  assert.equal(home.resolvePath({ tournamentId: "t1" }), "/team-portal/t1");
  assert.equal(myTeam.resolvePath({}), null);
  assert.equal(lineup.resolvePath({}), null);
});

test("batch1b — tournament strangler hubs preserved; no Experience 23 sidebar leaves", () => {
  const ownerStranglerHubs = [
    "/tournament",
    "/tournament/list",
    "/tournament/types",
    "/tournament/roster",
    "/tournament/organize",
    "/tournament/operations",
    "/tournament/results",
    "/tournament/config",
  ];
  for (const hub of ownerStranglerHubs) {
    assert.ok(
      v5Leaves().some((leaf) => leaf.path === hub) ||
        CANONICAL_MENU_DATA.nodes.some((n) => n.route === hub && n.sidebar === true),
      `missing strangler hub: ${hub}`
    );
  }
  const experienceSeg =
    /\/tournament\/[^/]+\/(overview|settings|registration|participants|pairs|pair-draw|group-draw|groups|schedule|matches|standings|knockout|bracket|director|courts|referees|exceptions|communications|media|awards|complete)$/;
  for (const leaf of v5Leaves()) {
    if (leaf.path) assert.equal(experienceSeg.test(leaf.path), false);
  }
  for (const node of CANONICAL_MENU_DATA.nodes) {
    if (node.sidebar === true && node.route) {
      assert.equal(experienceSeg.test(node.route), false);
    }
  }
  // Allowlist remains the broader owner decision set (includes create/register/my).
  assert.ok(B02_TOURNAMENT_HUB_MENU_ALLOWLIST.includes("/tournament/list"));
});

test("batch1b — canonical L1 labels cover Owner primary modules without parallel hierarchy", () => {
  const labels = Object.values(LEVEL1_VIETNAMESE_LABELS);
  for (const required of [
    "Tổng quan",
    "Vận hành sân",
    "Khách hàng & VĐV",
    "CLB & Huấn luyện",
    "Giải đấu",
    "Tài chính",
    "Hỗ trợ",
  ]) {
    assert.ok(labels.includes(required), `missing L1: ${required}`);
  }
  // Owner Tổ chức / Báo cáo / CSKH / Tài khoản / Trợ lý map into existing L1s — no new parallel tree.
  assert.ok(CANONICAL_MENU_DATA.level1Groups.length >= 10);
});

test("batch1b — MainLayout exclusivity lock files unchanged by menu IA", () => {
  const layout = readFileSync(path.join(root, "src/layouts/MainLayout.jsx"), "utf8");
  assert.match(layout, /Batch 1A exclusivity lock|Never render both shells simultaneously/);
  assert.match(layout, /CanonicalAppShell/);
  assert.match(layout, /LegacyMainLayoutContent/);
});

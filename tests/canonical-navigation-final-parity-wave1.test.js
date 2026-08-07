import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CANONICAL_MENU_DATA } from "../src/features/canonical-shell/config/canonicalMenuData.js";
import {
  filterCanonicalMenu,
  flattenCanonicalMenu,
  isCanonicalMenuNodeVisible,
} from "../src/features/canonical-shell/services/filterCanonicalMenu.js";
import {
  B02_TOURNAMENT_HUB_MENU_ALLOWLIST,
  B03_SHADOW_SKILL_ASSESSMENT_V5,
} from "../src/features/canonical-shell/config/ownerDecisions.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const APPROVED_TOURNAMENT_MENU = Object.freeze([
  ["/tournament", "Tổng quan"],
  ["/tournament/list", "Danh sách giải"],
  ["/tournament/create", "Tạo giải"],
  ["/tournament/types", "Loại giải"],
  ["/tournament/roster", "Danh sách VĐV"],
  ["/tournament/register", "Đăng ký"],
  ["/tournament/organize", "Tổ chức giải"],
  ["/tournament/operations", "Điều hành giải"],
  ["/tournament/results", "Kết quả"],
  ["/tournament/config", "Cấu hình"],
  ["/tournament/my", "Giải của tôi"],
  ["/daily-play", "Mở phiên"],
  ["/referee", "Hub"],
]);

function superAdminAuth() {
  return {
    user: { id: "wave1-super-admin", role: "SUPER_ADMIN" },
    rbacEnabled: true,
    permissions: ["*"],
    hasPermission: () => true,
    isAuthenticated: true,
  };
}

test("wave1 tournament promotion — all approved routes exist, are live, and carry valid menu metadata", () => {
  const routerSource = readFileSync(join(root, "src/router.jsx"), "utf8");

  for (const [route, label] of APPROVED_TOURNAMENT_MENU) {
    const node = CANONICAL_MENU_DATA.nodes.find((entry) => entry.route === route);
    assert.ok(node, `missing canonical node for ${route}`);
    assert.equal(node.label, label, `Vietnamese menu label drift for ${route}`);
    assert.equal(node.visibilityStatus, "live", `non-live node promoted: ${route}`);
    assert.notEqual(node.classification, "SHADOW", `shadow node promoted: ${route}`);
    assert.ok(node.guards.length > 0, `missing guard metadata: ${route}`);
    assert.ok(
      routerSource.includes(`path="${route}"`),
      `router implementation missing for approved target ${route}`
    );
  }

  const dailyPlay = CANONICAL_MENU_DATA.nodes.find((entry) => entry.route === "/daily-play");
  const referee = CANONICAL_MENU_DATA.nodes.find((entry) => entry.route === "/referee");
  assert.equal(dailyPlay.level2Label, "Chơi hằng ngày");
  assert.equal(referee.level2Label, "Trọng tài");
});

test("wave1 B02 allowlist — SUPER_ADMIN gets only approved retained hubs, desktop and mobile", () => {
  const expectedHubRoutes = [...B02_TOURNAMENT_HUB_MENU_ALLOWLIST].sort();

  for (const viewport of ["desktop", "mobile"]) {
    const visible = flattenCanonicalMenu(filterCanonicalMenu(superAdminAuth(), { viewport }));
    const visibleHubRoutes = visible
      .map((node) => node.route)
      .filter((route) => route === "/tournament" || route?.startsWith("/tournament/"))
      .sort();

    assert.deepEqual(visibleHubRoutes, expectedHubRoutes, `${viewport} B02 hub allowlist mismatch`);
    assert.equal(visible.some((node) => node.route === "/tournament/schedule"), false);
    assert.equal(visible.some((node) => node.route === "/tournament/bracket"), false);
    assert.equal(visible.some((node) => node.route === "/tournament/referee-assign"), false);
  }
});

test("wave1 preserves contextual Engine, B03 shadow, and role filtering", () => {
  const superAdmin = superAdminAuth();
  const visible = flattenCanonicalMenu(filterCanonicalMenu(superAdmin, { viewport: "desktop" }));

  assert.equal(
    visible.some((node) => String(node.route).startsWith("/tournaments/:tournamentId/")),
    false
  );
  assert.equal(visible.some((node) => node.route === B03_SHADOW_SKILL_ASSESSMENT_V5), false);

  const createNode = CANONICAL_MENU_DATA.nodes.find((node) => node.route === "/tournament/create");
  assert.equal(
    isCanonicalMenuNodeVisible(
      createNode,
      {
        user: { id: "wave1-player", role: "PLAYER" },
        rbacEnabled: true,
        permissions: ["tournament.view"],
        hasPermission: (permission) => permission === "tournament.view",
      },
      { viewport: "desktop" }
    ),
    false
  );
});

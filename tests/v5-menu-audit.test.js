import test from "node:test";
import assert from "node:assert/strict";

import { MENU_GROUPS } from "../src/config/navigationConfig.js";
import {
  auditMenuFeatureCoverage,
  auditSidebarMenuDepth,
  collectTournamentInPageLabels,
  FEATURE_STATUS,
} from "../src/config/v5Menu/index.js";
import { collectMenuItemLabels } from "../src/config/navigationConfig.js";

test("v5 menu audit — cây menu spec có đủ nhóm nghiệp vụ chính", () => {
  const groupIds = MENU_GROUPS.map((group) => group.id);
  const required = [
    "dashboard",
    "venue-ops",
    "customers",
    "club",
    "tournament",
    "finance",
    "reports",
    "crm",
    "admin",
    "support",
  ];

  for (const id of required) {
    assert.ok(groupIds.includes(id), `thiếu nhóm menu: ${id}`);
  }
});

test("v5 menu audit — sidebar phẳng tối đa 2 cấp (không folder lồng)", () => {
  const depth = auditSidebarMenuDepth(MENU_GROUPS);
  assert.equal(depth.ok, true, `sidebar có folder lồng: ${JSON.stringify(depth.violations)}`);
});

test("v5 menu audit — mục sidebar chính theo spec V5", () => {
  const labels = collectMenuItemLabels(MENU_GROUPS);
  const mustHave = [
    "Tổng quan",
    "Lịch sân",
    "Khách hàng",
    "Danh sách CLB",
    "Vui chơi mỗi ngày",
    "Danh sách giải",
    "Loại giải",
    "Vận động viên / Đội",
    "Tổ chức thi đấu",
    "Doanh thu",
    "Báo cáo",
    "Tin nhắn",
    "Người dùng",
    "Hỗ trợ",
  ];

  for (const label of mustHave) {
    assert.ok(labels.includes(label), `menu thiếu mục spec: ${label}`);
  }
});

test("v5 menu audit — thống kê live / partial / planned (sidebar)", () => {
  const audit = auditMenuFeatureCoverage(MENU_GROUPS);

  assert.ok(audit.summary.totalLeaves >= 35, "sidebar phải có >= 35 mục lá");
  assert.ok(audit.summary.totalLeaves <= 100, "sidebar không quá 100 mục lá (phẳng)");
  assert.ok(audit.summary.live > 0);
  assert.ok(audit.summary.coveragePercent >= 40);
  assert.ok(audit.summary.coveragePercent <= 100);

  console.log(
    `[v5-menu-audit] leaves=${audit.summary.totalLeaves} live=${audit.summary.live} partial=${audit.summary.partial} planned=${audit.summary.planned} coverage=${audit.summary.coveragePercent}%`
  );
});

test("v5 menu audit — mục planned dùng coming-soon route", () => {
  const audit = auditMenuFeatureCoverage(MENU_GROUPS);
  const planned = audit.plannedItems;

  for (const row of planned.slice(0, 5)) {
    assert.equal(row.featureStatus, FEATURE_STATUS.PLANNED);
    assert.ok(row.path.startsWith("/coming-soon/"), row.trail);
  }
});

test("v5 menu audit — giải cá nhân có đủ nội dung thi đấu (in-page nav)", () => {
  const labels = collectTournamentInPageLabels();
  for (const label of ["Đơn nam", "Đơn nữ", "Đôi nam", "Đôi nữ", "Đôi nam nữ", "Đôi tự do"]) {
    assert.ok(labels.includes(label), `thiếu loại giải in-page: ${label}`);
  }
  for (const label of ["Chia thủ công", "Bốc thăm tự động", "Chọn đội theo lượt"]) {
    assert.ok(labels.includes(label), `thiếu team build in-page: ${label}`);
  }
});

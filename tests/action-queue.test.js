import test from "node:test";
import assert from "node:assert/strict";

import { buildActionQueue } from "../src/features/action-queue/services/actionQueueService.js";

test("action queue — trả về mảng có thể sắp xếp", () => {
  if (typeof localStorage === "undefined") {
    assert.ok(true, "skip — không có localStorage trong môi trường test");
    return;
  }
  const items = buildActionQueue({ clubId: "club-test-empty" });
  assert.ok(Array.isArray(items));
});

import { auditFullMenuCoverage } from "../src/config/v5Menu/fullMenuAudit.js";
import { FEATURE_STATUS } from "../src/config/v5Menu/menuBuilders.js";

test("v5 full menu audit — gate 100% coverage target", () => {
  const audit = auditFullMenuCoverage();
  console.log(
    `[v5-full-menu-audit] leaves=${audit.summary.totalLeaves} live=${audit.summary.live} partial=${audit.summary.partial} planned=${audit.summary.planned} coverage=${audit.summary.coveragePercent}%`
  );

  assert.ok(audit.summary.totalLeaves >= 80, "full spec phải có >= 80 mục");
  assert.ok(audit.summary.live >= audit.summary.planned, "live phải >= planned");
  assert.equal(audit.summary.planned, 0, `còn planned: ${audit.plannedItems.map((i) => i.text).join(", ")}`);
  assert.equal(audit.summary.partial, 0, `còn partial: ${audit.partialItems.map((i) => i.text).join(", ")}`);
  assert.equal(audit.summary.coveragePercent, 100);

  for (const row of audit.liveItems.slice(0, 10)) {
    assert.equal(row.featureStatus, FEATURE_STATUS.LIVE);
  }
});

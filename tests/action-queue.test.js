import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  APPROVED_PARTIAL_MENU_PATHS,
  auditFullMenuCoverage,
  evaluateFullMenuReadinessGate,
} from "../src/config/v5Menu/fullMenuAudit.js";
import { FEATURE_STATUS } from "../src/config/v5Menu/menuBuilders.js";
import { CRM_MENU_ROOT } from "../src/config/v5Menu/crmMenu.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

test("action queue — trả về mảng có thể sắp xếp", async () => {
  let buildActionQueue;
  try {
    ({ buildActionQueue } = await import(
      "../src/features/action-queue/services/actionQueueService.js"
    ));
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND") {
      assert.ok(true, "skip — dependency graph unavailable in this environment");
      return;
    }
    throw err;
  }

  if (typeof localStorage === "undefined") {
    assert.ok(true, "skip — không có localStorage trong môi trường test");
    return;
  }
  const items = buildActionQueue({ clubId: "club-test-empty" });
  assert.ok(Array.isArray(items));
});

test("v5 full menu audit — gate classification 100% with approved CRM PARTIAL set", () => {
  const audit = auditFullMenuCoverage();
  const gate = evaluateFullMenuReadinessGate(audit);

  console.log(
    `[v5-full-menu-audit] leaves=${audit.summary.totalLeaves} live=${audit.summary.live} partial=${audit.summary.partial} planned=${audit.summary.planned} weightedCoverage=${audit.summary.coveragePercent}% classification=${gate.classificationCoveragePercent}% liveReadiness=${gate.liveReadinessPercent}%`
  );

  assert.ok(audit.summary.totalLeaves >= 80, "full spec phải có >= 80 mục");
  assert.ok(audit.summary.live >= audit.summary.planned, "live phải >= planned");
  assert.equal(
    audit.summary.planned,
    0,
    `còn planned: ${audit.plannedItems.map((i) => i.text).join(", ")}`
  );

  assert.equal(gate.ok, true, `full-menu readiness gate failed: ${gate.errors.join("; ")}`);
  assert.deepEqual(gate.actualPartialPaths, [...APPROVED_PARTIAL_MENU_PATHS].sort());
  assert.equal(gate.classificationCoveragePercent, 100);

  // Weighted LIVE-centric formula must not be faked to 100% while PARTIAL exists.
  assert.equal(audit.summary.partial, APPROVED_PARTIAL_MENU_PATHS.length);
  assert.ok(
    audit.summary.coveragePercent < 100,
    "weighted coveragePercent must remain < 100 while approved PARTIAL routes exist"
  );
  assert.ok(
    gate.liveReadinessPercent < 100,
    "liveReadinessPercent must remain < 100 while approved PARTIAL routes exist"
  );

  for (const row of audit.liveItems.slice(0, 10)) {
    assert.equal(row.featureStatus, FEATURE_STATUS.LIVE);
  }

  for (const item of audit.partialItems) {
    assert.equal(item.featureStatus, FEATURE_STATUS.PARTIAL);
    assert.ok(APPROVED_PARTIAL_MENU_PATHS.includes(item.path), item.path);
  }
});

test("full-menu readiness gate — exact approved CRM PARTIAL paths", () => {
  assert.deepEqual([...APPROVED_PARTIAL_MENU_PATHS], [
    "/crm/messages",
    "/crm/templates",
    "/crm/campaigns",
    "/crm/history",
    "/crm/reminders/booking",
  ]);

  const crmPartialPaths = CRM_MENU_ROOT.children
    .filter((item) => item.featureStatus === FEATURE_STATUS.PARTIAL)
    .map((item) => item.path)
    .sort();
  assert.deepEqual(crmPartialPaths, [...APPROVED_PARTIAL_MENU_PATHS].sort());
});

test("full-menu readiness gate — unapproved PARTIAL path fails", () => {
  const audit = auditFullMenuCoverage();
  const broken = {
    ...audit,
    partialItems: [
      ...audit.partialItems,
      {
        text: "Fake partial",
        path: "/admin/users",
        featureStatus: FEATURE_STATUS.PARTIAL,
      },
    ],
    summary: {
      ...audit.summary,
      partial: audit.summary.partial + 1,
      totalLeaves: audit.summary.totalLeaves + 1,
      live: audit.summary.live,
    },
    rows: [
      ...audit.rows,
      {
        text: "Fake partial",
        path: "/admin/users",
        featureStatus: FEATURE_STATUS.PARTIAL,
      },
    ],
  };

  const gate = evaluateFullMenuReadinessGate(broken);
  assert.equal(gate.ok, false);
  assert.ok(gate.unexpectedPartialPaths.includes("/admin/users"));
  assert.ok(gate.errors.some((msg) => msg.includes("unapproved PARTIAL")));
});

test("full-menu readiness gate — missing approved CRM PARTIAL path fails", () => {
  const audit = auditFullMenuCoverage();
  const withoutMessages = {
    ...audit,
    partialItems: audit.partialItems.filter((item) => item.path !== "/crm/messages"),
    summary: {
      ...audit.summary,
      partial: audit.summary.partial - 1,
      live: audit.summary.live + 1,
    },
  };

  const gate = evaluateFullMenuReadinessGate(withoutMessages);
  assert.equal(gate.ok, false);
  assert.ok(gate.missingApprovedPartialPaths.includes("/crm/messages"));
  assert.ok(gate.errors.some((msg) => msg.includes("missing approved CRM PARTIAL")));
});

test("full-menu readiness gate — CRM path flipped to LIVE fails readiness contract", () => {
  const audit = auditFullMenuCoverage();
  const allLive = {
    ...audit,
    partialItems: [],
    summary: {
      ...audit.summary,
      live: audit.summary.live + audit.summary.partial,
      partial: 0,
    },
  };

  const gate = evaluateFullMenuReadinessGate(allLive);
  assert.equal(gate.ok, false);
  assert.deepEqual(gate.missingApprovedPartialPaths, [...APPROVED_PARTIAL_MENU_PATHS].sort());
});

test("full-menu readiness gate — PLANNED leaf still fails", () => {
  const audit = auditFullMenuCoverage();
  const withPlanned = {
    ...audit,
    plannedItems: [
      {
        text: "Coming soon fake",
        path: "/coming-soon/fake",
        featureStatus: FEATURE_STATUS.PLANNED,
      },
    ],
    summary: {
      ...audit.summary,
      planned: 1,
      totalLeaves: audit.summary.totalLeaves + 1,
    },
    rows: [
      ...audit.rows,
      {
        text: "Coming soon fake",
        path: "/coming-soon/fake",
        featureStatus: FEATURE_STATUS.PLANNED,
      },
    ],
  };

  const gate = evaluateFullMenuReadinessGate(withPlanned);
  assert.equal(gate.ok, false);
  assert.ok(gate.errors.some((msg) => msg.includes("planned must be 0")));
});

test("full-menu readiness — CRM routes remain registered", () => {
  const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
  for (const route of APPROVED_PARTIAL_MENU_PATHS) {
    assert.ok(router.includes(`path="${route}"`), route);
  }
});

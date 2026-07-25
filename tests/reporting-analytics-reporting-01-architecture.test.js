/**
 * REPORTING-01 architecture / ownership boundary / Platform Core adoption.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as reporting from "../src/features/reporting-analytics/index.js";
import * as intelligence from "../src/features/intelligence-analytics/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(ROOT, "src", "features", "reporting-analytics");

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["'].*core\/platform\/(?!index\.js)[^"']+["']/,
  /from\s+["'].*features\/intelligence-analytics\/(contracts|runtime|registry|dashboard-reporting|facade|projections|aggregation)\//,
  /from\s+["'].*features\/finance\//,
  /from\s+["'].*features\/crm\//,
  /from\s+["'].*features\/customer\//,
  /from\s+["'].*features\/competition/,
  /from\s+["'].*features\/club\//,
  /from\s+["'].*features\/venue/,
  /from\s+["'].*features\/player/,
  /from\s+["'].*features\/experience/,
  /from\s+["'].*features\/public-portal\//,
];

const FORBIDDEN_SOURCE_TOKENS = [
  "process.env",
  "localStorage.",
  "indexedDB.",
  "createClient(",
];

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

test("REPORTING-01 canonical module and docs exist", () => {
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "index.js")));
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "ARCHITECTURE.md")));
  assert.ok(
    fs.existsSync(
      path.join(
        ROOT,
        "docs",
        "reporting-analytics",
        "reporting-01",
        "01_OWNERSHIP_AND_OPERATIONAL_REPORTING_FOUNDATION.md"
      )
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(
        ROOT,
        "src",
        "features",
        "dashboard-analytics",
        "adapters",
        "dashboardProvenanceBridge.js"
      )
    )
  );
});

test("REPORTING-01 single public facade and platform adoption surface", () => {
  assert.equal(typeof reporting.createReportingAnalyticsFacade, "function");
  assert.equal(typeof reporting.reportingAnalyticsFacade, "function");
  assert.ok(reporting.REPORTING_ANALYTICS_FACADE_METHODS.includes("executeReport"));
  assert.ok(reporting.REPORTING_ANALYTICS_FACADE_METHODS.includes("exportReport"));
  const surface = reporting.assertReportingAnalyticsPlatformSurface();
  assert.equal(surface.moduleId, "reporting-analytics");
  assert.ok(surface.consumes.includes("projectIdentityActor"));

  const actor = reporting.projectReportingAnalyticsActor({ userId: "u1" });
  assert.equal(actor.ok, true);
  const scope = reporting.projectReportingAnalyticsTenantScope({ tenantId: "t1" });
  assert.equal(scope.ok, true);
  const instant = reporting.projectReportingOperationInstant("2026-07-25T00:00:00.000Z");
  assert.equal(instant.ok, true);
});

test("ownership boundary: Reporting does not own I&A metric registry or query runtime", () => {
  assert.equal("createMetricRegistry" in reporting, false);
  assert.equal("createAnalyticsQueryRuntime" in reporting, false);
  assert.ok(intelligence.INTELLIGENCE_ANALYTICS_METRIC_REGISTRY);
  assert.ok(intelligence.INTELLIGENCE_ANALYTICS_QUERY_RUNTIME);
  assert.ok(typeof intelligence.createMetricRegistry === "function");
  assert.ok(typeof intelligence.createAnalyticsQueryRuntime === "function");
  // Public I&A consume is allowed; Reporting module must not re-export I&A runtime.
  assert.equal(reporting.REPORT_SOURCE_KIND.INTELLIGENCE_PROJECTION, "INTELLIGENCE_PROJECTION");
});

test("REPORTING-01 has no forbidden reverse dependencies or env/storage", () => {
  const files = listJsFiles(MODULE_ROOT);
  assert.ok(files.length >= 15);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      assert.equal(
        pattern.test(text),
        false,
        `${rel} must not match forbidden import ${pattern}`
      );
    }
    for (const token of FORBIDDEN_SOURCE_TOKENS) {
      assert.equal(
        text.includes(token),
        false,
        `${rel} must not include forbidden token ${token}`
      );
    }
  }
});

test("Statistics ownership is not seized by Reporting public facade", () => {
  const statsIndex = fs.readFileSync(
    path.join(ROOT, "src", "features", "statistics", "index.js"),
    "utf8"
  );
  assert.match(statsIndex, /Statistics\.jsx/);
  assert.equal("Statistics" in reporting, false);
  assert.equal(typeof reporting.createStatisticsSourceReference, "function");
});

test("dashboard presentation remains outside Reporting domain ownership", () => {
  assert.equal("DashboardAnalyticsView" in reporting, false);
  assert.equal(typeof reporting.classifyDashboardPayloadProvenance, "function");
});

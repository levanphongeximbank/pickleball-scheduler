/**
 * REPORTING-05 — Final certification contracts (closure package).
 * Does not mutate Staging/Production. Does not apply SQL.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as reporting from "../src/features/reporting-analytics/index.js";
import {
  baseActor,
  baseDefinitionInput,
  clubScope,
  createReportingTestFacade,
} from "./support/reporting-analytics-test-doubles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_05 = path.join(ROOT, "docs", "reporting-analytics", "reporting-05");
const MODULE_ROOT = path.join(ROOT, "src", "features", "reporting-analytics");

const REQUIRED_DOCS = [
  "01_FINAL_CERTIFICATION_REPORT.md",
  "02_BUSINESS_MODULE_2_10_CLOSURE.md",
  "03_CAPABILITY_INVENTORY.md",
  "04_OWNERSHIP_BOUNDARY.md",
  "05_STAGING_SECURITY_EVIDENCE.md",
  "06_ACCEPTED_RESIDUALS_AND_PRODUCTION_READINESS.md",
  "07_SUPPORT_OPERATIONAL_HANDOFF.md",
  "08_HONESTY_LIFECYCLE_A11Y_SUMMARY.md",
];

const EXPECTED_PERMISSIONS = [
  "reporting.dashboard.view",
  "reporting.report.execute",
  "reporting.report.save",
  "reporting.report.export",
  "reporting.field.sensitive.view",
  "reporting.filter.save",
  "reporting.scope.tenant",
  "reporting.scope.club",
  "reporting.scope.venue",
  "reporting.scope.cross_tenant",
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

test("REPORTING-05 phase and platform surface reflect final certification", () => {
  assert.equal(reporting.REPORTING_ANALYTICS_PHASE.id, "REPORTING-05");
  assert.equal(
    reporting.REPORTING_ANALYTICS_PHASE.foundationWorkstreamId,
    "REPORTING-01"
  );
  const surface = reporting.assertReportingAnalyticsPlatformSurface();
  assert.equal(surface.moduleId, "reporting-analytics");
  assert.equal(surface.workstreamId, "REPORTING-05");
  assert.equal(surface.foundationWorkstreamId, "REPORTING-01");
  assert.equal(
    surface.publicFacade,
    "src/features/reporting-analytics/index.js"
  );
});

test("REPORTING-05 closure documentation package is present", () => {
  for (const name of REQUIRED_DOCS) {
    assert.ok(
      fs.existsSync(path.join(DOCS_05, name)),
      `missing closure doc: ${name}`
    );
  }
  const readme = fs.readFileSync(
    path.join(ROOT, "docs", "reporting-analytics", "README.md"),
    "utf8"
  );
  assert.match(readme, /REPORTING-05/);
  assert.match(readme, /reporting-05\/01_FINAL_CERTIFICATION_REPORT/);
});

test("REPORTING-05 permission catalog remains exact and unmapped in JS SoT", () => {
  assert.deepEqual(
    [...reporting.REPORTING_PERMISSION_VALUES].sort(),
    [...EXPECTED_PERMISSIONS].sort()
  );
  assert.equal(reporting.REPORTING_PERMISSION_VALUES.length, 10);
});

test("REPORTING-05 lifecycle graphs reject invalid transitions", () => {
  assert.equal(
    reporting.isAllowedLifecycleTransition(
      "PENDING",
      "SUCCEEDED",
      reporting.REPORT_EXECUTION_STATUS_TRANSITIONS
    ),
    false
  );
  assert.equal(
    reporting.isAllowedLifecycleTransition(
      "PENDING",
      "RUNNING",
      reporting.REPORT_EXECUTION_STATUS_TRANSITIONS
    ),
    true
  );
  assert.equal(
    reporting.isAllowedLifecycleTransition(
      "SUCCEEDED",
      "RUNNING",
      reporting.REPORT_EXPORT_JOB_STATUS_TRANSITIONS
    ),
    false
  );
  assert.equal(
    reporting.isAllowedLifecycleTransition(
      "RUNNING",
      "UNAVAILABLE",
      reporting.REPORT_EXPORT_JOB_STATUS_TRANSITIONS
    ),
    true
  );
});

test("REPORTING-05 rejects fake/mock export refs and keeps runtime fail-closed", () => {
  assert.equal(reporting.isValidExportOutputReference("fake://x"), false);
  assert.equal(reporting.isValidExportOutputReference("mock://x"), false);
  assert.equal(
    reporting.isValidExportOutputReference("https://example.test/out.csv"),
    true
  );

  reporting.clearReportingAnalyticsRuntime();
  const runtime = reporting.resolveReportingAnalyticsRuntime();
  assert.equal(runtime.status, "UNAVAILABLE");
  assert.equal(runtime.usesLocalStorage, false);
  assert.equal(runtime.usesServiceRole, false);
  assert.equal(runtime.sourceState, "UNAVAILABLE");
});

test("REPORTING-05 I&A projection adapter stays UNAVAILABLE without deployed contract", async () => {
  const port = reporting.createIntelligenceProjectionDataSourcePort();
  const definition = reporting.createReportDefinition({
    ...baseDefinitionInput(),
    source: reporting.createIntelligenceProjectionReference({
      sourceId: "ia-proj-src-r05",
      projectionId: "proj_demo",
      configured: true,
    }),
  });
  const result = await port.execute({
    definition,
    request: {
      actor: baseActor(),
      scope: definition.scope,
      reportDefinitionId: definition.reportDefinitionId,
    },
  });
  assert.equal(result.availability, reporting.REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED);
  assert.equal(
    result.errorCode,
    reporting.REPORTING_ERROR_CODE.PROJECTION_SOURCE_NOT_DEPLOYED
  );
  assert.ok(result.warnings.includes("PROJECTION_SOURCE_NOT_DEPLOYED"));
  assert.equal(
    reporting.IA_PUBLIC_PROJECTION_EXECUTION_CONTRACT.mappingStatus,
    "PROJECTION_SOURCE_NOT_DEPLOYED"
  );
  assert.equal(
    reporting.IA_PUBLIC_PROJECTION_EXECUTION_CONTRACT.executeByProjectionId,
    false
  );
});

test("REPORTING-05 reporting sources forbid localStorage durability and service_role credentials", () => {
  const files = listJsFiles(MODULE_ROOT);
  assert.ok(files.length >= 20);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    assert.equal(
      text.includes("localStorage."),
      false,
      `${rel} must not use localStorage API`
    );
    assert.equal(
      text.includes("sessionStorage."),
      false,
      `${rel} must not use sessionStorage API`
    );
    assert.equal(
      /service_role\s*[:=]|SUPABASE_SERVICE_ROLE|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./.test(
        text
      ),
      false,
      `${rel} must not embed service_role credentials`
    );
    assert.doesNotMatch(
      text,
      /from\s+["'].*intelligence-analytics\/(?!index\.js)[^"']+["']/
    );
  }
});

test("REPORTING-05 facade still fails closed on live data-source failure (no mock success)", async () => {
  const { facade } = createReportingTestFacade({
    dataSource: {
      async execute() {
        throw Object.assign(new Error("live failed"), { liveFailed: true });
      },
    },
  });
  await facade.saveReportDefinition(baseDefinitionInput());
  const result = await facade.executeReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    parameters: { from: "a", to: "b" },
    columns: ["bookingId"],
    idempotencyKey: "idem_r05_fail",
  });
  assert.equal(result.ok, false);
});

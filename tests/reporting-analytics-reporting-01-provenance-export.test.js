/**
 * REPORTING-01 provenance + export contract coverage.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as reporting from "../src/features/reporting-analytics/index.js";
import {
  baseActor,
  baseDefinitionInput,
  clubScope,
  createReportingTestFacade,
} from "./support/reporting-analytics-test-doubles.js";

test("provenance LIVE/MOCK/PREVIEW/UNAVAILABLE/STALE and MIXED rules", () => {
  assert.equal(
    reporting.createProvenanceMetadata({ state: reporting.REPORT_PROVENANCE.LIVE }).state,
    "LIVE"
  );
  assert.equal(
    reporting.createProvenanceMetadata({ state: reporting.REPORT_PROVENANCE.MOCK }).state,
    "MOCK"
  );
  assert.equal(
    reporting.createProvenanceMetadata({ state: reporting.REPORT_PROVENANCE.PREVIEW }).state,
    "PREVIEW"
  );
  assert.equal(
    reporting.createProvenanceMetadata({ state: reporting.REPORT_PROVENANCE.UNAVAILABLE }).state,
    "UNAVAILABLE"
  );
  assert.equal(
    reporting.createProvenanceMetadata({ state: reporting.REPORT_PROVENANCE.STALE }).state,
    "STALE"
  );

  assert.throws(
    () =>
      reporting.createProvenanceMetadata({
        state: reporting.REPORT_PROVENANCE.MIXED,
        componentSources: [{ sourceKind: "OPERATIONAL", state: "LIVE" }],
      }),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.PROVENANCE_MISMATCH
  );

  const mixed = reporting.composeMixedProvenance([
    { sourceKind: "OPERATIONAL", state: "LIVE" },
    { sourceKind: "STATISTICS", state: "STALE" },
  ]);
  assert.equal(mixed.state, reporting.REPORT_PROVENANCE.MIXED);
  assert.equal(mixed.componentSources.length, 2);
});

test("mockDashboardData classified as MOCK; live failure does not become mock success", () => {
  assert.equal(
    reporting.MOCK_DASHBOARD_DATA_CLASSIFICATION.provenance,
    reporting.REPORT_PROVENANCE.MOCK
  );
  assert.equal(reporting.MOCK_DASHBOARD_DATA_CLASSIFICATION.isDurablePersistence, false);
  assert.equal(
    reporting.MOCK_DASHBOARD_DATA_CLASSIFICATION.silentLiveFallbackAllowed,
    false
  );

  const mockClass = reporting.classifyDashboardPayloadProvenance({ isMock: true });
  assert.equal(mockClass.state, reporting.REPORT_PROVENANCE.MOCK);

  const liveClass = reporting.classifyDashboardPayloadProvenance({ isMock: false });
  assert.equal(liveClass.state, reporting.REPORT_PROVENANCE.LIVE);

  assert.throws(
    () =>
      reporting.assertNoSilentLiveToMockFallback({
        liveFailed: true,
        resultProvenance: reporting.REPORT_PROVENANCE.MOCK,
      }),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.SILENT_FALLBACK_REJECTED
  );

  assert.throws(
    () =>
      reporting.classifyDashboardPayloadProvenance(
        { isMock: true },
        { liveFailed: true }
      ),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.SILENT_FALLBACK_REJECTED
  );
});

test("export contracts: valid, invalid format, unauthorized, not configured", async () => {
  const req = reporting.createExportRequest({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    format: reporting.REPORT_EXPORT_FORMAT.CSV,
    columns: ["bookingId"],
  });
  assert.equal(req.format, "CSV");

  assert.throws(
    () =>
      reporting.createExportRequest({
        actor: baseActor(),
        scope: clubScope(),
        reportDefinitionId: "rdef_demo",
        format: "HTML",
      }),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.INVALID_EXPORT_FORMAT
  );

  const harness = createReportingTestFacade();
  await harness.facade.saveReportDefinition(baseDefinitionInput());

  const unauthorized = await harness.facade.exportReport({
    actor: baseActor({
      permissions: baseActor().permissions.filter(
        (p) => p !== reporting.REPORTING_PERMISSIONS.REPORT_EXPORT
      ),
    }),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    format: reporting.REPORT_EXPORT_FORMAT.CSV,
    columns: ["bookingId"],
    parameters: { from: "a", to: "b" },
  });
  assert.equal(unauthorized.ok, false);

  const okExport = await harness.facade.exportReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    format: reporting.REPORT_EXPORT_FORMAT.CSV,
    columns: ["bookingId"],
    parameters: { from: "a", to: "b" },
  });
  assert.equal(okExport.ok, true);
  assert.equal(okExport.value.provenance.state, reporting.REPORT_PROVENANCE.LIVE);

  const noExecutor = createReportingTestFacade({ exportExecutor: null });
  await noExecutor.facade.saveReportDefinition(baseDefinitionInput());
  const notConfigured = await noExecutor.facade.exportReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    format: reporting.REPORT_EXPORT_FORMAT.PDF,
    columns: ["bookingId"],
    parameters: { from: "a", to: "b" },
  });
  assert.equal(notConfigured.ok, false);

  const unavailableSource = createReportingTestFacade({
    dataSource: {
      async execute() {
        return {
          availability: reporting.REPORT_AVAILABILITY.UNAVAILABLE,
          provenance: { state: reporting.REPORT_PROVENANCE.UNAVAILABLE },
        };
      },
    },
  });
  await unavailableSource.facade.saveReportDefinition(baseDefinitionInput());
  // execute returns ok:false for UNAVAILABLE because createReportExecutionResult ok only for AVAILABLE/STALE/PARTIAL/MIXED
  // Wait - UNAVAILABLE has ok:false, so export should fail
  const blocked = await unavailableSource.facade.exportReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    format: reporting.REPORT_EXPORT_FORMAT.JSON,
    columns: ["bookingId"],
    parameters: { from: "a", to: "b" },
  });
  assert.equal(blocked.ok, false);
});

test("intelligence projection unwired returns UNAVAILABLE reference result", () => {
  const ref = reporting.createIntelligenceProjectionReference({
    sourceId: "ia-proj",
    projectionId: "proj-1",
    configured: false,
  });
  assert.equal(ref.kind, reporting.REPORT_SOURCE_KIND.INTELLIGENCE_PROJECTION);
  assert.equal(ref.configured, false);
  const unavailable = reporting.createUnavailableIntelligenceProjectionResult(
    "not_wired_in_reporting_01"
  );
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.provenance.state, reporting.REPORT_PROVENANCE.UNAVAILABLE);
});

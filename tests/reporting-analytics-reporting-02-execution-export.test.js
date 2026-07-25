import assert from "node:assert/strict";
import test from "node:test";

import * as reporting from "../src/features/reporting-analytics/index.js";
import {
  baseActor,
  baseDefinitionInput,
  clubScope,
  createDurableReportingTestFacade,
} from "./support/reporting-analytics-test-doubles.js";

const request = (overrides = {}) => ({
  actor: baseActor(),
  scope: clubScope(),
  reportDefinitionId: "rdef_demo",
  parameters: { from: "a", to: "b" },
  columns: ["bookingId", "status"],
  ...overrides,
});

async function saveDefinition(harness, input = baseDefinitionInput()) {
  const saved = await harness.facade.saveReportDefinition(input);
  assert.equal(saved.ok, true);
}

test("durable execution succeeds with LIVE rows and persists metadata, not rows", async () => {
  const harness = createDurableReportingTestFacade();
  await saveDefinition(harness);
  const result = await harness.facade.executeReport(request({ idempotencyKey: "live-1" }));
  assert.equal(result.ok, true);
  assert.equal(result.value.rows.length, 1);
  const record = await harness.repos.executions.getById(result.value.executionId);
  assert.equal(record.status, reporting.REPORT_EXECUTION_STATUS.SUCCEEDED);
  assert.equal(record.rowCount, 1);
  assert.equal("rows" in record.requestSnapshot, false);
});

test("execution denies missing definitions, scope mismatch, sensitive columns, and unwired sources", async () => {
  const missing = createDurableReportingTestFacade();
  const noDefinition = await missing.facade.executeReport(request());
  assert.equal(noDefinition.ok, false);
  assert.equal(noDefinition.error.code, reporting.REPORTING_ERROR_CODE.DEFINITION_NOT_FOUND);

  const harness = createDurableReportingTestFacade();
  await saveDefinition(harness);
  const mismatched = await harness.facade.executeReport(
    request({ scope: { kind: reporting.REPORT_SCOPE_KIND.TENANT, tenantId: "tenant-1" } })
  );
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.error.code, reporting.REPORTING_ERROR_CODE.INVALID_SCOPE);

  const actor = baseActor({
    permissions: baseActor().permissions.filter(
      (permission) => permission !== reporting.REPORTING_PERMISSIONS.SENSITIVE_FIELD_VIEW
    ),
  });
  const sensitive = await harness.facade.executeReport(request({ actor, columns: ["amount"] }));
  assert.equal(sensitive.ok, false);

  const unwired = createDurableReportingTestFacade({ dataSource: null });
  await saveDefinition(unwired);
  const sourceMissing = await unwired.facade.executeReport(request());
  assert.equal(sourceMissing.ok, false);
  assert.equal(sourceMissing.error.code, reporting.REPORTING_ERROR_CODE.SOURCE_NOT_CONFIGURED);
});

test("execution authorizes before source and never uses mock rows after live failure", async () => {
  const sequence = [];
  const harness = createDurableReportingTestFacade({
    dataSource: {
      async execute() {
        sequence.push("source");
        return {
          liveFailed: true,
          provenance: { state: reporting.REPORT_PROVENANCE.MOCK },
          rows: [{ bookingId: "mock-row" }],
        };
      },
    },
  });
  await saveDefinition(harness);
  const denied = await harness.facade.executeReport(request({ actor: baseActor({ permissions: [] }) }));
  assert.equal(denied.ok, false);
  assert.deepEqual(sequence, []);

  const failed = await harness.facade.executeReport(request({ idempotencyKey: "failed-live-1" }));
  assert.equal(failed.ok, false);
  assert.equal(sequence.length, 1);
  assert.equal(failed.error.code, reporting.REPORTING_ERROR_CODE.SILENT_FALLBACK_REJECTED);
});

test("terminal execution retry is idempotent and lifecycle allow-list is enforced", async () => {
  let calls = 0;
  const harness = createDurableReportingTestFacade({
    dataSource: {
      async execute() {
        calls += 1;
        return { provenance: { state: reporting.REPORT_PROVENANCE.LIVE }, rows: [] };
      },
    },
  });
  await saveDefinition(harness);
  const first = await harness.facade.executeReport(request({ idempotencyKey: "retry-1" }));
  const retry = await harness.facade.executeReport(request({ idempotencyKey: "retry-1" }));
  assert.equal(first.ok, true);
  assert.equal(retry.ok, true);
  assert.equal(retry.value.payload.durableReplay, true);
  assert.equal(calls, 1);
  assert.equal(
    reporting.isAllowedLifecycleTransition(
      "RUNNING",
      "SUCCEEDED",
      reporting.REPORT_EXECUTION_STATUS_TRANSITIONS
    ),
    true
  );
  assert.equal(
    reporting.isAllowedLifecycleTransition(
      "SUCCEEDED",
      "RUNNING",
      reporting.REPORT_EXECUTION_STATUS_TRANSITIONS
    ),
    false
  );
});

test("export uses presentation executor/storage, handles failures, and retries idempotently", async () => {
  const storage = reporting.createInMemoryArtifactStoragePort();
  const harness = createDurableReportingTestFacade({
    exportExecutor: reporting.createPresentationExportExecutor({ artifactStorage: storage }),
  });
  await saveDefinition(harness);
  const exported = await harness.facade.exportReport({
    ...request({ idempotencyKey: "export-1" }),
    format: reporting.REPORT_EXPORT_FORMAT.CSV,
  });
  assert.equal(exported.ok, true);
  assert.ok(exported.value.outputReference);
  assert.equal((await harness.facade.exportReport({
    ...request({ idempotencyKey: "export-1" }),
    format: reporting.REPORT_EXPORT_FORMAT.CSV,
  })).value.outputReference.storageKind, exported.value.outputReference.storageKind);
  assert.equal(
    (await harness.repos.exportJobs.findByIdempotencyKey("tenant-1", "export-1")).status,
    reporting.REPORT_EXPORT_JOB_STATUS.SUCCEEDED
  );

  const denied = await harness.facade.exportReport({
    ...request({ actor: baseActor({ permissions: [] }), idempotencyKey: "export-denied" }),
    format: reporting.REPORT_EXPORT_FORMAT.CSV,
  });
  assert.equal(denied.ok, false);

  const noStorage = createDurableReportingTestFacade({
    exportExecutor: reporting.createPresentationExportExecutor({ artifactStorage: null }),
  });
  await saveDefinition(noStorage);
  const storageMissing = await noStorage.facade.exportReport({
    ...request({ idempotencyKey: "storage-missing" }),
    format: reporting.REPORT_EXPORT_FORMAT.CSV,
  });
  assert.equal(storageMissing.ok, false);
  assert.equal(storageMissing.error.code, reporting.REPORTING_ERROR_CODE.EXPORT_STORAGE_NOT_CONFIGURED);
  assert.notEqual(
    (await noStorage.repos.exportJobs.findByIdempotencyKey("tenant-1", "storage-missing")).status,
    reporting.REPORT_EXPORT_JOB_STATUS.SUCCEEDED
  );
});

test("CSV escaping is deterministic and a renderer failure cannot succeed", async () => {
  assert.equal(
    reporting.renderCsvFromPresentationRows(
      ["alpha", "beta"],
      [{ beta: "a,b", alpha: "say \"hi\"" }]
    ),
    "alpha,beta\n\"say \"\"hi\"\"\",\"a,b\""
  );
  const harness = createDurableReportingTestFacade({
    exportExecutor: { async execute() { throw new Error("renderer exploded"); } },
  });
  await saveDefinition(harness);
  const result = await harness.facade.exportReport({
    ...request({ idempotencyKey: "renderer-failure" }),
    format: reporting.REPORT_EXPORT_FORMAT.CSV,
  });
  assert.equal(result.ok, false);
  assert.equal(
    (await harness.repos.exportJobs.findByIdempotencyKey("tenant-1", "renderer-failure")).status,
    reporting.REPORT_EXPORT_JOB_STATUS.FAILED
  );
});

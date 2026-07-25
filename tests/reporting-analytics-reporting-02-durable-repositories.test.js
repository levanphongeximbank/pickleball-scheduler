import assert from "node:assert/strict";
import test from "node:test";

import * as reporting from "../src/features/reporting-analytics/index.js";
import {
  baseActor,
  baseDefinitionInput,
  clubScope,
  createDurableReportingTestFacade,
} from "./support/reporting-analytics-test-doubles.js";

const NOW = "2026-07-25T00:00:00.000Z";

function execution(overrides = {}) {
  return reporting.createReportExecutionRecord({
    executionId: "rex_1",
    reportDefinitionId: "rdef_demo",
    actorId: "user-1",
    scope: clubScope(),
    idempotencyKey: "execution-key-1",
    status: reporting.REPORT_EXECUTION_STATUS.PENDING,
    provenance: { state: reporting.REPORT_PROVENANCE.UNAVAILABLE },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function exportJob(overrides = {}) {
  return reporting.createExportJobRecord({
    exportJobId: "xjob_1",
    reportDefinitionId: "rdef_demo",
    actorId: "user-1",
    scope: clubScope(),
    format: reporting.REPORT_EXPORT_FORMAT.CSV,
    idempotencyKey: "export-key-1",
    status: reporting.REPORT_EXPORT_JOB_STATUS.PENDING,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

test("durable factory requires an injected ReportingDatabaseClientPort without fallback", () => {
  assert.throws(
    () => reporting.createDurableReportingRepositories(),
    (error) => error.code === reporting.REPORTING_ERROR_CODE.REPOSITORY_UNAVAILABLE
  );
});

test("durable definitions map domain rows and enforce optimistic version updates", async () => {
  const { repos } = createDurableReportingTestFacade();
  const created = await repos.reportDefinitions.save(
    reporting.createReportDefinition({ ...baseDefinitionInput(), createdAt: NOW, updatedAt: NOW })
  );
  assert.equal(created.reportDefinitionId, "rdef_demo");
  assert.equal(created.scope.clubId, "club-1");

  const updated = await repos.reportDefinitions.save(
    reporting.createReportDefinition({
      ...baseDefinitionInput({ title: "Updated title" }),
      version: created.version + 1,
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
  assert.equal(updated.version, 2);
  assert.equal((await repos.reportDefinitions.getById("rdef_demo")).title, "Updated title");

  await assert.rejects(
    () =>
      repos.reportDefinitions.save(
        reporting.createReportDefinition({
          ...baseDefinitionInput(),
          version: 1,
          createdAt: NOW,
          updatedAt: NOW,
        })
      ),
    (error) => error.code === reporting.REPORTING_ERROR_CODE.VERSION_CONFLICT
  );
});

test("durable repositories isolate tenants and saved reports by owner", async () => {
  const { repos } = createDurableReportingTestFacade();
  await repos.reportDefinitions.save(
    reporting.createReportDefinition({ ...baseDefinitionInput(), createdAt: NOW, updatedAt: NOW })
  );
  await repos.reportDefinitions.save(
    reporting.createReportDefinition({
      ...baseDefinitionInput({
        reportDefinitionId: "rdef_tenant_b",
        scope: clubScope({ tenantId: "tenant-b", clubId: "club-b" }),
      }),
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
  assert.deepEqual(
    (await repos.reportDefinitions.listByTenant("tenant-1")).map((item) => item.reportDefinitionId),
    ["rdef_demo"]
  );

  await repos.savedReports.save(
    reporting.createSavedReportConfiguration({
      savedReportId: "saved_1",
      reportDefinitionId: "rdef_demo",
      ownerId: baseActor().userId,
      scope: clubScope(),
      name: "My report",
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
  assert.equal((await repos.savedReports.listByOwner("user-2", "tenant-1")).length, 0);
  assert.equal((await repos.savedReports.listByOwner("user-1", "tenant-b")).length, 0);
  assert.equal((await repos.savedReports.listByOwner("user-1", "tenant-1")).length, 1);
});

test("durable execution/export identity and idempotency reads are tenant-scoped", async () => {
  const { repos } = createDurableReportingTestFacade();
  await repos.executions.save(execution());
  await assert.rejects(
    () => repos.executions.save(execution({ executionId: "rex_2" })),
    (error) =>
      error.code === reporting.REPORTING_ERROR_CODE.DUPLICATE_IDENTITY ||
      error.code === reporting.REPORTING_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
  assert.equal((await repos.executions.findByIdempotencyKey("tenant-1", "execution-key-1")).executionId, "rex_1");
  assert.equal(await repos.executions.findByIdempotencyKey("tenant-b", "execution-key-1"), null);

  await repos.exportJobs.save(exportJob());
  assert.equal((await repos.exportJobs.findByIdempotencyKey("tenant-1", "export-key-1")).exportJobId, "xjob_1");
  assert.equal(await repos.exportJobs.findByIdempotencyKey("tenant-b", "export-key-1"), null);
});

test("durable repository translates unavailable client failures and rejects invalid execution lifecycle", async () => {
  const unavailable = {
    async select() {
      throw new Error("database connection unavailable");
    },
    async insert() {},
    async update() {},
    async delete() {},
    async rpc() {},
  };
  const repos = reporting.createDurableReportingRepositories({ db: unavailable });
  await assert.rejects(
    () => repos.reportDefinitions.getById("rdef_demo"),
    (error) => error.code === reporting.REPORTING_ERROR_CODE.REPOSITORY_UNAVAILABLE
  );

  const { repos: durable } = createDurableReportingTestFacade();
  const pending = await durable.executions.save(execution());
  await assert.rejects(
    () =>
      durable.executions.save(
        execution({ ...pending, status: reporting.REPORT_EXECUTION_STATUS.SUCCEEDED, version: 2 })
      ),
    (error) => error.code === reporting.REPORTING_ERROR_CODE.INVALID_STATUS_TRANSITION
  );
});

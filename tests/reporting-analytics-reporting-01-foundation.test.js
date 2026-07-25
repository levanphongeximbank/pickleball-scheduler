/**
 * REPORTING-01 foundation — facade, definitions, filters, persistence ports.
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

test("REPORTING-01 public export allowlist is stable", () => {
  for (const name of reporting.REPORTING_ANALYTICS_PUBLIC_EXPORTS) {
    assert.equal(name in reporting, true, `missing public export: ${name}`);
  }
  assert.equal(reporting.REPORTING_ANALYTICS_PHASE.id, "REPORTING-01");
  assert.equal(
    reporting.reportingAnalyticsFacade,
    reporting.createReportingAnalyticsFacade
  );
});

test("report definition validates identity, scope, source, parameters, sensitivity", () => {
  const def = reporting.createReportDefinition(baseDefinitionInput());
  assert.equal(def.reportDefinitionId, "rdef_demo");
  assert.equal(def.scope.kind, reporting.REPORT_SCOPE_KIND.CLUB);
  assert.equal(def.sensitivity.containsSensitiveFields, true);
  assert.deepEqual(def.sensitivity.sensitiveFieldNames, ["amount"]);

  assert.throws(
    () => reporting.requireOpaqueId("", "reportDefinitionId"),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.INVALID_IDENTITY
  );
  assert.throws(
    () =>
      reporting.createReportDefinition(
        baseDefinitionInput({
          scope: { kind: reporting.REPORT_SCOPE_KIND.CLUB, clubId: "club-1" },
        })
      ),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.INVALID_SCOPE
  );
  assert.throws(
    () =>
      reporting.createReportDefinition(
        baseDefinitionInput({
          source: { kind: "ANALYTICAL_RUNTIME", sourceId: "x", configured: true },
        })
      ),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.INVALID_SOURCE_REFERENCE
  );
  assert.throws(
    () =>
      reporting.createReportDefinition(
        baseDefinitionInput({
          columns: [
            { field: "a", label: "A" },
            { field: "a", label: "A2" },
          ],
        })
      ),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.INVALID_REPORT_DEFINITION
  );
});

test("filters, sorting, grouping, deterministic column order", () => {
  const def = reporting.createReportDefinition(baseDefinitionInput());
  const filters = reporting.validateFilterValues(def.filterDefinitions, [
    { field: "status", operator: reporting.REPORT_FILTER_OPERATOR.EQ, value: "confirmed" },
  ]);
  assert.equal(filters.length, 1);

  assert.throws(
    () =>
      reporting.validateFilterValues(def.filterDefinitions, [
        { field: "status", operator: reporting.REPORT_FILTER_OPERATOR.GT, value: "x" },
      ]),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.INVALID_FILTER
  );
  assert.throws(
    () =>
      reporting.validateFilterValues(def.filterDefinitions, [
        { field: "unknown", operator: reporting.REPORT_FILTER_OPERATOR.EQ, value: "x" },
      ]),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.INVALID_FILTER
  );
  assert.throws(
    () =>
      reporting.validateFilterValues(def.filterDefinitions, [
        { field: "status", operator: reporting.REPORT_FILTER_OPERATOR.EQ, value: 1 },
      ]),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.INVALID_FILTER
  );

  const sortedCols = reporting.orderColumnsDeterministically([
    { field: "z", label: "Z", order: 2 },
    { field: "a", label: "A", order: 1 },
    { field: "b", label: "B", order: 1 },
  ]);
  assert.deepEqual(
    sortedCols.map((c) => c.field),
    ["a", "b", "z"]
  );

  reporting.validateSorting(def.sortableFields, [
    { field: "status", direction: reporting.REPORT_SORT_DIRECTION.ASC },
  ]);
  assert.throws(
    () => reporting.validateSorting(def.sortableFields, [{ field: "nope", direction: "ASC" }]),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.INVALID_SORT
  );
  assert.throws(
    () => reporting.validateGrouping(def.groupableFields, [{ field: "bookingId" }]),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.INVALID_GROUPING
  );
});

test("saved report/filter configuration validation and scope association", () => {
  const savedReport = reporting.createSavedReportConfiguration({
    savedReportId: "srep_1",
    ownerId: "user-1",
    reportDefinitionId: "rdef_demo",
    scope: clubScope(),
    name: "My club report",
    parameters: { from: "2026-01-01", to: "2026-01-31" },
    filters: [],
    sorting: [],
    grouping: [],
    columns: ["bookingId", "status"],
  });
  assert.equal(savedReport.scope.clubId, "club-1");

  const savedFilter = reporting.createSavedFilterConfiguration({
    savedFilterId: "sflt_1",
    ownerId: "user-1",
    reportDefinitionId: "rdef_demo",
    scope: clubScope(),
    name: "Confirmed only",
    filters: [{ field: "status", operator: "EQ", value: "confirmed" }],
  });
  assert.equal(savedFilter.reportDefinitionId, "rdef_demo");
});

test("in-memory repositories isolate tenants and support not-found/conflict", async () => {
  const repos = reporting.createInMemoryReportingRepositories();
  const def = reporting.createReportDefinition(baseDefinitionInput());
  await repos.reportDefinitions.save(def);
  const listed = await repos.reportDefinitions.listByTenant("tenant-1");
  assert.equal(listed.length, 1);
  const other = await repos.reportDefinitions.listByTenant("tenant-2");
  assert.equal(other.length, 0);

  assert.equal(await repos.reportDefinitions.getById("missing"), null);
  await assert.rejects(
    () => repos.reportDefinitions.deleteById("missing"),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.DEFINITION_NOT_FOUND
  );

  await assert.rejects(
    () =>
      repos.reportDefinitions.save(
        reporting.createReportDefinition(
          baseDefinitionInput({ version: 1, name: "dup" })
        )
      ),
    (err) => err.code === reporting.REPORTING_ERROR_CODE.VERSION_CONFLICT
  );

  const saved = reporting.createSavedReportConfiguration({
    savedReportId: "srep_1",
    ownerId: "user-1",
    reportDefinitionId: "rdef_demo",
    scope: clubScope(),
    name: "Saved",
  });
  await repos.savedReports.save(saved);
  const mine = await repos.savedReports.listByOwner("user-1", "tenant-1");
  assert.equal(mine.length, 1);
  const theirs = await repos.savedReports.listByOwner("user-2", "tenant-1");
  assert.equal(theirs.length, 0);

  const filter = reporting.createSavedFilterConfiguration({
    savedFilterId: "sflt_1",
    ownerId: "user-1",
    reportDefinitionId: "rdef_demo",
    scope: clubScope(),
    name: "Filter",
  });
  await repos.savedFilters.save(filter);
  assert.ok(await repos.savedFilters.getById("sflt_1"));
});

test("facade save definition and execute happy path", async () => {
  const { facade } = createReportingTestFacade();
  const saved = await facade.saveReportDefinition(baseDefinitionInput());
  assert.equal(saved.ok, true);

  const result = await facade.executeReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    parameters: { from: "2026-01-01", to: "2026-01-31" },
    columns: ["bookingId", "status"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.availability, reporting.REPORT_AVAILABILITY.AVAILABLE);
  assert.equal(result.value.provenance.state, reporting.REPORT_PROVENANCE.LIVE);
});

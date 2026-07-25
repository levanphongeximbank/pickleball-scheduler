/**
 * REPORTING-01 authorization + execution fail-closed coverage.
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

test("authorization fail-closed: missing actor / unknown permission / tenant mismatch", () => {
  assert.equal(reporting.requireReportingActor(null).ok, false);
  assert.equal(
    reporting.requireReportingActor({ authenticated: false, userId: "u", tenantId: "t" }).ok,
    false
  );

  const deniedUnknown = reporting.authorizeReporting(
    baseActor(),
    "reporting.unknown.action",
    clubScope()
  );
  assert.equal(deniedUnknown.ok, false);
  assert.equal(deniedUnknown.code, reporting.REPORTING_ERROR_CODE.FORBIDDEN_PERMISSION);

  const deniedMissing = reporting.authorizeExecuteReport(
    baseActor({ permissions: [reporting.REPORTING_PERMISSIONS.SCOPE_CLUB] }),
    clubScope()
  );
  assert.equal(deniedMissing.ok, false);

  const tenantMismatch = reporting.authorizeExecuteReport(
    baseActor({ tenantId: "other-tenant" }),
    clubScope()
  );
  assert.equal(tenantMismatch.ok, false);
  assert.equal(tenantMismatch.code, reporting.REPORTING_ERROR_CODE.FORBIDDEN_SCOPE);
});

test("cross-tenant / venue / club mismatch denied without explicit permission", () => {
  const cross = reporting.authorizeReporting(
    baseActor(),
    reporting.REPORTING_PERMISSIONS.REPORT_EXECUTE,
    { kind: reporting.REPORT_SCOPE_KIND.PLATFORM_CROSS_TENANT }
  );
  assert.equal(cross.ok, false);

  const crossOk = reporting.authorizeReporting(
    baseActor({
      permissions: [
        ...baseActor().permissions,
        reporting.REPORTING_PERMISSIONS.SCOPE_CROSS_TENANT,
      ],
    }),
    reporting.REPORTING_PERMISSIONS.REPORT_EXECUTE,
    { kind: reporting.REPORT_SCOPE_KIND.PLATFORM_CROSS_TENANT }
  );
  assert.equal(crossOk.ok, true);

  const venueMismatch = reporting.authorizeReporting(
    baseActor({ venueIds: ["venue-9"] }),
    reporting.REPORTING_PERMISSIONS.REPORT_EXECUTE,
    {
      kind: reporting.REPORT_SCOPE_KIND.VENUE,
      tenantId: "tenant-1",
      venueId: "venue-1",
    }
  );
  assert.equal(venueMismatch.ok, false);

  const clubMismatch = reporting.authorizeReporting(
    baseActor({ clubIds: ["club-9"] }),
    reporting.REPORTING_PERMISSIONS.REPORT_EXECUTE,
    clubScope()
  );
  assert.equal(clubMismatch.ok, false);
});

test("sensitive / export / save authorized separately", () => {
  const actorNoSensitive = baseActor({
    permissions: baseActor().permissions.filter(
      (p) => p !== reporting.REPORTING_PERMISSIONS.SENSITIVE_FIELD_VIEW
    ),
  });
  assert.equal(reporting.authorizeSensitiveFields(actorNoSensitive, clubScope()).ok, false);
  assert.equal(reporting.authorizeExport(actorNoSensitive, clubScope()).ok, true);

  const actorNoExport = baseActor({
    permissions: baseActor().permissions.filter(
      (p) => p !== reporting.REPORTING_PERMISSIONS.REPORT_EXPORT
    ),
  });
  assert.equal(reporting.authorizeExport(actorNoExport, clubScope()).ok, false);

  const actorNoSave = baseActor({
    permissions: baseActor().permissions.filter(
      (p) =>
        p !== reporting.REPORTING_PERMISSIONS.REPORT_SAVE &&
        p !== reporting.REPORTING_PERMISSIONS.FILTER_SAVE
    ),
  });
  assert.equal(reporting.authorizeSaveReport(actorNoSave, clubScope()).ok, false);
  assert.equal(reporting.authorizeSaveFilter(actorNoSave, clubScope()).ok, false);
});

test("execution: definition not found, source not configured, invalid params/filters/columns", async () => {
  const { facade, repos } = createReportingTestFacade({
    dataSource: null,
  });

  const missing = await facade.executeReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "missing",
    parameters: { from: "a", to: "b" },
  });
  assert.equal(missing.ok, false);

  await repos.reportDefinitions.save(
    reporting.createReportDefinition(
      baseDefinitionInput({
        source: {
          kind: reporting.REPORT_SOURCE_KIND.OPERATIONAL,
          sourceId: "ops",
          configured: false,
        },
      })
    )
  );
  // Need facade with unwired source but definition present — recreate
  const harness = createReportingTestFacade({ dataSource: null });
  await harness.repos.reportDefinitions.save(
    reporting.createReportDefinition(
      baseDefinitionInput({
        source: {
          kind: reporting.REPORT_SOURCE_KIND.UNAVAILABLE,
          sourceId: "none",
          configured: false,
        },
      })
    )
  );
  const unconfigured = await harness.facade.executeReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    parameters: { from: "a", to: "b" },
    columns: ["bookingId"],
  });
  assert.equal(unconfigured.ok, false);
  assert.match(String(unconfigured.error?.code || ""), /SOURCE_NOT_CONFIGURED|UNAVAILABLE/);

  const { facade: f2 } = createReportingTestFacade();
  await f2.saveReportDefinition(baseDefinitionInput());
  const badParams = await f2.executeReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    parameters: { from: "a" },
    columns: ["bookingId"],
  });
  assert.equal(badParams.ok, false);

  const badFilter = await f2.executeReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    parameters: { from: "a", to: "b" },
    filters: [{ field: "status", operator: "GT", value: "x" }],
    columns: ["bookingId"],
  });
  assert.equal(badFilter.ok, false);

  const badCol = await f2.executeReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    parameters: { from: "a", to: "b" },
    columns: ["not_a_column"],
  });
  assert.equal(badCol.ok, false);
});

test("authorization happens before source execution", async () => {
  const harness = createReportingTestFacade();
  await harness.facade.saveReportDefinition(baseDefinitionInput());
  harness.resetFlags();

  const denied = await harness.facade.executeReport({
    actor: baseActor({ permissions: [] }),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    parameters: { from: "a", to: "b" },
    columns: ["bookingId"],
  });
  assert.equal(denied.ok, false);
  assert.equal(harness.wasSourceExecuted(), false);
});

test("executor failure normalizes to typed failure; no mock success", async () => {
  const harness = createReportingTestFacade({
    dataSource: {
      async execute() {
        return {
          liveFailed: true,
          provenance: { state: reporting.REPORT_PROVENANCE.MOCK },
          errorMessage: "live failed",
        };
      },
    },
  });
  await harness.facade.saveReportDefinition(baseDefinitionInput());
  const result = await harness.facade.executeReport({
    actor: baseActor(),
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    parameters: { from: "a", to: "b" },
    columns: ["bookingId"],
  });
  assert.equal(result.ok, false);
  assert.notEqual(result.error?.code, undefined);
});

test("sensitive column denied separately from execute", async () => {
  const harness = createReportingTestFacade();
  await harness.facade.saveReportDefinition(baseDefinitionInput());
  const actor = baseActor({
    permissions: baseActor().permissions.filter(
      (p) => p !== reporting.REPORTING_PERMISSIONS.SENSITIVE_FIELD_VIEW
    ),
  });
  const denied = await harness.facade.executeReport({
    actor,
    scope: clubScope(),
    reportDefinitionId: "rdef_demo",
    parameters: { from: "a", to: "b" },
    columns: ["bookingId", "amount"],
  });
  assert.equal(denied.ok, false);
});

test("invalid scope on execution denied", async () => {
  const harness = createReportingTestFacade();
  await harness.facade.saveReportDefinition(baseDefinitionInput());
  const mismatch = await harness.facade.executeReport({
    actor: baseActor(),
    scope: {
      kind: reporting.REPORT_SCOPE_KIND.TENANT,
      tenantId: "tenant-1",
    },
    reportDefinitionId: "rdef_demo",
    parameters: { from: "a", to: "b" },
    columns: ["bookingId"],
  });
  assert.equal(mismatch.ok, false);
});

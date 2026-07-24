/**
 * I&A-04 — Dashboard and Reporting Data Contracts certification tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as IA from "../src/features/intelligence-analytics/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(
  __dirname,
  "../src/features/intelligence-analytics"
);
const DR_ROOT = path.join(MODULE_ROOT, "dashboard-reporting");

const SOURCE = Object.freeze({
  sourceId: "explicit-observations",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "caller-supplied",
});

const PROVENANCE = Object.freeze({
  source: SOURCE,
  observedAt: "2026-07-01T12:00:00.000Z",
  ingestedAt: "2026-07-01T12:05:00.000Z",
  transformer: "fixture",
});

const WINDOW = Object.freeze({
  startAt: "2026-07-01T00:00:00.000Z",
  endAt: "2026-07-31T23:59:59.000Z",
  inclusive: true,
});

function tenantScope(overrides = {}) {
  return {
    kind: IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT,
    tenantId: "tenant-a",
    ...overrides,
  };
}

function queryInput(overrides = {}) {
  return {
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    tenantScope: tenantScope(),
    timeWindow: WINDOW,
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    granularity: IA.ANALYTICS_GRANULARITY.WINDOW,
    filters: [],
    ...overrides,
  };
}

function metricBinding(overrides = {}) {
  return {
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    ...overrides,
  };
}

function baseWidget(overrides = {}) {
  return {
    widgetId: "w-kpi-1",
    widgetKind: IA.ANALYTICS_WIDGET_KIND.KPI,
    presentationIntent: { intent: IA.ANALYTICS_PRESENTATION_INTENT.SINGLE_VALUE },
    metricBinding: metricBinding(),
    ...overrides,
  };
}

function baseDashboard(overrides = {}) {
  return {
    dashboardId: "ia.demo.ops_dashboard",
    version: "1.0.0",
    title: "Ops Dashboard",
    description: "Certification fixture dashboard",
    lifecycleState: IA.ANALYTICS_DASHBOARD_LIFECYCLE_STATE.ACTIVE,
    tenantApplicability: {
      supportedTenantScopeKinds: [IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT],
    },
    accessScope: {
      roles: ["director"],
      permissions: ["analytics.read"],
      requireAuthenticated: true,
    },
    sections: [
      {
        sectionId: "sec-overview",
        title: "Overview",
        layoutIntent: IA.ANALYTICS_LAYOUT_INTENT.STACK,
        widgets: [baseWidget()],
      },
    ],
    filters: [
      {
        filterId: "time-range",
        parameterType: IA.ANALYTICS_PARAMETER_TYPE.TIME_RANGE,
        required: true,
        defaultValue: WINDOW,
        tenantSafe: true,
      },
    ],
    provenanceExpectation: "required",
    freshnessExpectation: "prefer_fresh",
    ...overrides,
  };
}

function baseReport(overrides = {}) {
  return {
    reportId: "ia.demo.ops_report",
    version: "1.0.0",
    title: "Ops Report",
    description: "Certification fixture report",
    lifecycleState: IA.ANALYTICS_REPORT_LIFECYCLE_STATE.ACTIVE,
    tenantApplicability: {
      supportedTenantScopeKinds: [IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT],
    },
    accessScope: {
      roles: ["director"],
      permissions: ["analytics.read"],
      requireAuthenticated: true,
    },
    sections: [
      {
        sectionId: "rep-sec-1",
        title: "Summary",
        columns: [
          {
            columnId: "col-metric",
            label: "Metric",
            valueType: "number",
            metricBinding: metricBinding(),
          },
        ],
      },
    ],
    filters: [
      {
        filterId: "time-range",
        parameterType: IA.ANALYTICS_PARAMETER_TYPE.TIME_RANGE,
        required: true,
        defaultValue: WINDOW,
        tenantSafe: true,
      },
    ],
    exportIntent: {
      formats: [IA.ANALYTICS_EXPORT_FORMAT.CSV, IA.ANALYTICS_EXPORT_FORMAT.PDF],
      includeProvenance: true,
    },
    scheduleIntent: {
      enabled: false,
    },
    provenanceExpectation: "required",
    freshnessExpectation: "prefer_fresh",
    ...overrides,
  };
}

function baseDefinition(overrides = {}) {
  return {
    metricId: "ia.demo.observation_sum",
    version: "1.0.0",
    definition: "Sum of caller-supplied observation values.",
    unit: IA.ANALYTICS_METRIC_UNIT.COUNT,
    aggregationKind: IA.ANALYTICS_AGGREGATION_KIND.SUM,
    metricKind: IA.ANALYTICS_METRIC_KIND.OBSERVATIONAL,
    source: SOURCE,
    supportedTenantScopeKinds: [IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT],
    supportedGranularities: [IA.ANALYTICS_GRANULARITY.WINDOW],
    allowedDimensions: [{ key: "segment" }],
    missingDataSemantics: IA.ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL,
    ...overrides,
  };
}

function collectJsFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...collectJsFiles(full));
    else if (entry.endsWith(".js")) files.push(full);
  }
  return files;
}

test("1. valid dashboard definition is created", () => {
  const result = IA.createAnalyticsDashboardDefinition(baseDashboard());
  assert.equal(result.ok, true);
  assert.equal(result.value.dashboardId, "ia.demo.ops_dashboard");
  assert.equal(result.value.version, "1.0.0");
  assert.equal(Object.isFrozen(result.value), true);
});

test("2. valid report definition is created", () => {
  const result = IA.createAnalyticsReportDefinition(baseReport());
  assert.equal(result.ok, true);
  assert.equal(result.value.reportId, "ia.demo.ops_report");
  assert.equal(result.value.version, "1.0.0");
});

test("3. dashboard missing ID is rejected", () => {
  const result = IA.createAnalyticsDashboardDefinition(
    baseDashboard({ dashboardId: "" })
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.DASHBOARD_ID_REQUIRED);
});

test("4. dashboard missing version is rejected", () => {
  const result = IA.createAnalyticsDashboardDefinition(
    baseDashboard({ version: "   " })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.DASHBOARD_VERSION_REQUIRED
  );
});

test("5. report missing ID/version is rejected", () => {
  const missingId = IA.createAnalyticsReportDefinition(
    baseReport({ reportId: null })
  );
  assert.equal(missingId.ok, false);
  const missingVersion = IA.createAnalyticsReportDefinition(
    baseReport({ version: "" })
  );
  assert.equal(missingVersion.ok, false);
});

test("6. duplicate widget ID is rejected", () => {
  const result = IA.createAnalyticsDashboardDefinition(
    baseDashboard({
      sections: [
        {
          sectionId: "sec-1",
          widgets: [baseWidget(), baseWidget({ widgetId: "w-kpi-1" })],
        },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Duplicate widget ID/);
});

test("7. duplicate section ID is rejected", () => {
  const result = IA.createAnalyticsDashboardDefinition(
    baseDashboard({
      sections: [
        { sectionId: "sec-1", widgets: [baseWidget()] },
        {
          sectionId: "sec-1",
          widgets: [baseWidget({ widgetId: "w-2" })],
        },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Duplicate section ID/);
});

test("8. duplicate report column ID is rejected", () => {
  const result = IA.createAnalyticsReportDefinition(
    baseReport({
      sections: [
        {
          sectionId: "s1",
          columns: [
            { columnId: "c1", metricBinding: metricBinding() },
            { columnId: "c1", metricBinding: metricBinding() },
          ],
        },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Duplicate report column ID/);
});

test("9. metric binding missing version is rejected", () => {
  const result = IA.createAnalyticsMetricBinding({
    metricId: "ia.demo.observation_sum",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.METRIC_VERSION_REQUIRED
  );
});

test("10. query binding does not mutate input", () => {
  const query = queryInput();
  const filters = query.filters;
  const result = IA.createAnalyticsQueryBinding({
    bindingId: "qb-1",
    query,
  });
  assert.equal(result.ok, true);
  assert.equal(query.filters, filters);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.query), true);
});

test("11. dashboard definition is immutable", () => {
  const result = IA.createAnalyticsDashboardDefinition(baseDashboard());
  assert.equal(result.ok, true);
  assert.throws(() => {
    result.value.title = "mutated";
  });
});

test("12. report definition is immutable", () => {
  const result = IA.createAnalyticsReportDefinition(baseReport());
  assert.equal(result.ok, true);
  assert.throws(() => {
    result.value.title = "mutated";
  });
});

test("13-14. catalog input not mutated and output does not leak mutable internals", () => {
  const dashboards = [baseDashboard()];
  const reports = [baseReport()];
  const input = { dashboards, reports };
  const created = IA.createDashboardReportCatalog(input);
  assert.equal(created.ok, true);
  dashboards.push(baseDashboard({ dashboardId: "extra" }));
  assert.equal(created.value.catalog.dashboardCount, 1);
  const listed = created.value.catalog.listDashboards();
  assert.equal(listed.ok, true);
  assert.equal(Object.isFrozen(listed.value[0]), true);
  const mutableCopy = JSON.parse(JSON.stringify(listed.value[0]));
  mutableCopy.title = "mutated-copy";
  const again = created.value.catalog.getDashboard(
    "ia.demo.ops_dashboard",
    "1.0.0"
  );
  assert.equal(again.ok, true);
  assert.equal(again.value.title, "Ops Dashboard");
  assert.notEqual(mutableCopy.title, again.value.title);
});

test("15-16. exact dashboard/report ID/version lookup", () => {
  const created = IA.createReadOnlyDashboardReportCatalog({
    dashboards: [baseDashboard()],
    reports: [baseReport()],
  });
  assert.equal(created.ok, true);
  const dash = created.value.getDashboard("ia.demo.ops_dashboard", "1.0.0");
  assert.equal(dash.ok, true);
  const missingDash = created.value.getDashboard("ia.demo.ops_dashboard", "9.9.9");
  assert.equal(missingDash.ok, false);
  const report = created.value.getReport("ia.demo.ops_report", "1.0.0");
  assert.equal(report.ok, true);
});

test("17. same ID/version + same definition is deterministic/idempotent", () => {
  const created = IA.createDashboardReportCatalog({
    dashboards: [baseDashboard(), baseDashboard()],
    reports: [baseReport(), baseReport()],
  });
  assert.equal(created.ok, true);
  assert.equal(created.value.dashboardCount, 1);
  assert.equal(created.value.reportCount, 1);
  assert.equal(
    created.value.dashboardRegistrations[1].value.status,
    IA.ANALYTICS_CATALOG_REGISTRATION_STATUS.IDEMPOTENT
  );
});

test("18. same ID/version + different definition returns conflict", () => {
  const created = IA.createDashboardReportCatalog({
    dashboards: [
      baseDashboard(),
      baseDashboard({ title: "Different Title" }),
    ],
  });
  assert.equal(created.ok, true);
  assert.equal(created.value.dashboardRegistrations[1].ok, false);
  assert.equal(
    created.value.dashboardRegistrations[1].error.code,
    IA.ANALYTICS_ERROR_CODE.CATALOG_CONFLICT
  );
});

test("19. tenant applicability filter is correct", () => {
  const created = IA.createReadOnlyDashboardReportCatalog({
    dashboards: [
      baseDashboard(),
      baseDashboard({
        dashboardId: "ia.demo.platform_dashboard",
        tenantApplicability: {
          supportedTenantScopeKinds: [IA.ANALYTICS_TENANT_SCOPE_KIND.PLATFORM],
        },
      }),
    ],
  });
  assert.equal(created.ok, true);
  const tenantOnly = created.value.listDashboards({
    tenantScopeKind: IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT,
  });
  assert.equal(tenantOnly.ok, true);
  assert.equal(tenantOnly.value.length, 1);
  assert.equal(tenantOnly.value[0].dashboardId, "ia.demo.ops_dashboard");
});

test("20. access scope filter is deterministic", () => {
  const created = IA.createReadOnlyDashboardReportCatalog({
    dashboards: [
      baseDashboard(),
      baseDashboard({
        dashboardId: "ia.demo.admin_dashboard",
        accessScope: { roles: ["admin"], permissions: ["analytics.admin"] },
      }),
    ],
  });
  assert.equal(created.ok, true);
  const filtered = created.value.listDashboards({ role: "director" });
  assert.equal(filtered.ok, true);
  assert.equal(filtered.value.length, 1);
  assert.equal(filtered.value[0].dashboardId, "ia.demo.ops_dashboard");
});

test("21-24. dashboard rejects React/JSX/Supabase/route callback content", () => {
  const withComponent = IA.createAnalyticsDashboardDefinition(
    baseDashboard({ component: "DashboardView" })
  );
  assert.equal(withComponent.ok, false);
  assert.equal(withComponent.error.code, IA.ANALYTICS_ERROR_CODE.FORBIDDEN_CONTRACT);

  const withJsx = IA.createAnalyticsDashboardDefinition(
    baseDashboard({ description: "<DashboardChart />" })
  );
  assert.equal(withJsx.ok, false);

  const withTable = IA.createAnalyticsDashboardDefinition(
    baseDashboard({ tableName: "club_data_v3" })
  );
  assert.equal(withTable.ok, false);

  const withRoute = IA.createAnalyticsDashboardDefinition(
    baseDashboard({ routePath: "/dashboard" })
  );
  assert.equal(withRoute.ok, false);
});

test("25-29. data state semantics", () => {
  const empty = IA.createAnalyticsDataState({ state: IA.ANALYTICS_DATA_STATE.EMPTY });
  const ready = IA.createAnalyticsDataState({ state: IA.ANALYTICS_DATA_STATE.READY });
  const partial = IA.createAnalyticsDataState({
    state: IA.ANALYTICS_DATA_STATE.PARTIAL,
    warnings: [{ code: "PARTIAL_SOURCE", message: "partial" }],
  });
  const stale = IA.createAnalyticsDataState({
    state: IA.ANALYTICS_DATA_STATE.STALE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE,
  });
  const error = IA.createAnalyticsDataState({
    state: IA.ANALYTICS_DATA_STATE.ERROR,
    error: { code: "SOURCE_DOWN", message: "unavailable" },
  });
  const unavailable = IA.createAnalyticsDataState({
    state: IA.ANALYTICS_DATA_STATE.UNAVAILABLE,
  });

  assert.equal(empty.ok, true);
  assert.equal(ready.ok, true);
  assert.notEqual(empty.value.state, ready.value.state);
  assert.notEqual(partial.value.state, ready.value.state);
  assert.equal(stale.ok, true);
  assert.equal(stale.value.freshness, IA.ANALYTICS_FRESHNESS_STATE.STALE);
  assert.equal(stale.value.isCurrent, false);
  assert.equal(error.ok, true);
  assert.equal(error.value.error.code, "SOURCE_DOWN");
  assert.equal(unavailable.ok, true);
  assert.notEqual(unavailable.value.state, IA.ANALYTICS_DATA_STATE.EMPTY);

  const staleAsFresh = IA.createAnalyticsDataState({
    state: IA.ANALYTICS_DATA_STATE.STALE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
  });
  assert.equal(staleAsFresh.ok, false);

  const unavailableAsEmpty = IA.createAnalyticsDataState({
    state: IA.ANALYTICS_DATA_STATE.UNAVAILABLE,
    treatAsEmpty: true,
  });
  assert.equal(unavailableAsEmpty.ok, false);
});

test("30-31. KPI payload keeps metric identity/version and provenance", () => {
  const result = IA.createAnalyticsKpiPayload({
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    value: 42,
    unit: "count",
    effectiveWindow: WINDOW,
    provenance: PROVENANCE,
    dataState: { state: IA.ANALYTICS_DATA_STATE.READY },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.metricId, "ia.demo.observation_sum");
  assert.equal(result.value.metricVersion, "1.0.0");
  assert.equal(result.value.provenance.source.sourceId, "explicit-observations");
});

test("32. time-series points have deterministic ordering", () => {
  const result = IA.createAnalyticsTimeSeriesPayload({
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    seriesId: "s1",
    granularity: IA.ANALYTICS_GRANULARITY.DAY,
    effectiveWindow: WINDOW,
    provenance: PROVENANCE,
    dataState: { state: IA.ANALYTICS_DATA_STATE.READY },
    points: [
      { key: "2026-07-03", value: 3 },
      { key: "2026-07-01", value: 1 },
      { key: "2026-07-02", value: 2 },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.value.points.map((p) => p.key),
    ["2026-07-01", "2026-07-02", "2026-07-03"]
  );
});

test("33. breakdown has deterministic category ordering", () => {
  const result = IA.createAnalyticsBreakdownPayload({
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    dimension: "segment",
    categories: ["C", "A", "B"],
    values: [3, 1, 2],
    provenance: PROVENANCE,
    dataState: { state: IA.ANALYTICS_DATA_STATE.READY },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.categories, ["A", "B", "C"]);
  assert.deepEqual(result.value.values, [1, 2, 3]);
});

test("34. table rows/columns are immutable", () => {
  const result = IA.createAnalyticsTablePayload({
    columns: [{ columnId: "c1", label: "A" }],
    rows: [{ rowId: "r2", cells: { c1: 2 } }, { rowId: "r1", cells: { c1: 1 } }],
    dataState: { state: IA.ANALYTICS_DATA_STATE.READY },
    provenance: PROVENANCE,
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.value.columns), true);
  assert.equal(Object.isFrozen(result.value.rows), true);
  assert.deepEqual(
    result.value.rows.map((r) => r.rowId),
    ["r1", "r2"]
  );
});

test("35. missing data is not silently coerced to zero", () => {
  const result = IA.createAnalyticsKpiPayload({
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    value: null,
    effectiveWindow: WINDOW,
    provenance: PROVENANCE,
    dataState: { state: IA.ANALYTICS_DATA_STATE.EMPTY },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.value, null);

  const coerced = IA.createAnalyticsKpiPayload({
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    value: 0,
    missingCoercedToZero: true,
    effectiveWindow: WINDOW,
    provenance: PROVENANCE,
    dataState: { state: IA.ANALYTICS_DATA_STATE.EMPTY },
  });
  assert.equal(coerced.ok, false);
});

test("36-38. drill-down rejects callbacks and preserves tenant scope", () => {
  const good = IA.createAnalyticsDrillDownDescriptor({
    targetIntentId: "report.ops.detail",
    sourceContextId: "w-kpi-1",
    parameterMappings: [
      { sourceParameterId: "time-range", targetParameterId: "window" },
    ],
    allowedDimensions: ["segment"],
    tenantScope: tenantScope(),
  });
  assert.equal(good.ok, true);
  assert.equal(good.value.tenantScope.tenantId, "tenant-a");

  const withCallback = IA.createAnalyticsDrillDownDescriptor({
    targetIntentId: "report.ops.detail",
    sourceContextId: "w-kpi-1",
    parameterMappings: [],
    allowedDimensions: [],
    tenantScope: tenantScope(),
    callback: () => {},
  });
  assert.equal(withCallback.ok, false);
  assert.equal(withCallback.error.code, IA.ANALYTICS_ERROR_CODE.FORBIDDEN_CONTRACT);

  const withUrl = IA.createAnalyticsDrillDownDescriptor({
    targetIntentId: "report.ops.detail",
    sourceContextId: "w-kpi-1",
    parameterMappings: [],
    allowedDimensions: [],
    tenantScope: tenantScope(),
    url: "https://example.com/x",
  });
  assert.equal(withUrl.ok, false);
});

test("39. required filter without default/allowed/rule is rejected", () => {
  const result = IA.createAnalyticsFilterDefinition({
    filterId: "f1",
    parameterType: IA.ANALYTICS_PARAMETER_TYPE.ENUM,
    required: true,
    tenantSafe: true,
  });
  assert.equal(result.ok, false);
});

test("40. export intent metadata is valid", () => {
  const result = IA.createAnalyticsExportIntent({
    formats: [IA.ANALYTICS_EXPORT_FORMAT.CSV, IA.ANALYTICS_EXPORT_FORMAT.XLSX],
    includeProvenance: true,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.formats, ["CSV", "XLSX"]);
});

test("41. schedule intent does not initialize runtime", () => {
  const result = IA.createAnalyticsScheduleIntent({
    enabled: true,
    cadence: "weekly",
    timezone: "Asia/Ho_Chi_Minh",
    recipientPolicyRef: "policy.ops.directors",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.runtimeInitialized, false);
  assert.equal(typeof result.value.start, "undefined");
});

test("42. compatibility IDENTICAL", () => {
  const a = IA.createAnalyticsDashboardDefinition(baseDashboard());
  const b = IA.createAnalyticsDashboardDefinition(baseDashboard());
  const compared = IA.compareDashboardDefinitions(a.value, b.value);
  assert.equal(compared.ok, true);
  assert.equal(
    compared.value.classification,
    IA.ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.IDENTICAL
  );
});

test("43. metric version change is classified deterministically", () => {
  const before = IA.createAnalyticsDashboardDefinition(baseDashboard());
  const after = IA.createAnalyticsDashboardDefinition(
    baseDashboard({
      version: "1.1.0",
      sections: [
        {
          sectionId: "sec-overview",
          widgets: [
            baseWidget({
              metricBinding: metricBinding({ metricVersion: "2.0.0" }),
            }),
          ],
        },
      ],
    })
  );
  const compared = IA.compareDashboardDefinitions(before.value, after.value);
  assert.equal(compared.ok, true);
  assert.equal(
    compared.value.classification,
    IA.ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.BREAKING
  );
  assert.ok(
    compared.value.reasons.includes("metric_binding_version_changed")
  );
});

test("44. removing widget/column is BREAKING", () => {
  const beforeDash = IA.createAnalyticsDashboardDefinition(
    baseDashboard({
      sections: [
        {
          sectionId: "sec-overview",
          widgets: [
            baseWidget(),
            baseWidget({ widgetId: "w-kpi-2" }),
          ],
        },
      ],
    })
  );
  const afterDash = IA.createAnalyticsDashboardDefinition(baseDashboard());
  const dashCmp = IA.compareDashboardDefinitions(beforeDash.value, afterDash.value);
  assert.equal(dashCmp.value.classification, IA.ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.BREAKING);

  const beforeReport = IA.createAnalyticsReportDefinition(
    baseReport({
      sections: [
        {
          sectionId: "rep-sec-1",
          columns: [
            { columnId: "col-metric", metricBinding: metricBinding() },
            { columnId: "col-extra", metricBinding: metricBinding() },
          ],
        },
      ],
    })
  );
  const afterReport = IA.createAnalyticsReportDefinition(baseReport());
  const reportCmp = IA.compareReportDefinitions(
    beforeReport.value,
    afterReport.value
  );
  assert.equal(
    reportCmp.value.classification,
    IA.ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.BREAKING
  );
});

test("45. adding optional section/column is backward compatible", () => {
  const before = IA.createAnalyticsDashboardDefinition(baseDashboard());
  const after = IA.createAnalyticsDashboardDefinition(
    baseDashboard({
      version: "1.1.0",
      sections: [
        ...baseDashboard().sections,
        {
          sectionId: "sec-extra",
          widgets: [baseWidget({ widgetId: "w-extra" })],
        },
      ],
    })
  );
  const compared = IA.compareDashboardDefinitions(before.value, after.value);
  assert.equal(
    compared.value.classification,
    IA.ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.BACKWARD_COMPATIBLE
  );
});

test("46. read-only catalog does not expose write/persistence", () => {
  const created = IA.createReadOnlyDashboardReportCatalog({});
  assert.equal(created.ok, true);
  assert.equal(created.value.isEmpty, true);
  const write = created.value.register();
  assert.equal(write.ok, false);
  assert.equal(write.error.code, IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED);
  const persist = created.value.persist();
  assert.equal(persist.ok, false);
});

test("47-50. no React / Platform Core / business / Supabase imports", () => {
  const files = collectJsFiles(DR_ROOT);
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("from \"react\""), false, file);
    assert.equal(source.includes("from 'react'"), false, file);
    assert.equal(source.includes("src/core/platform"), false, file);
    assert.equal(source.includes("@supabase"), false, file);
    assert.equal(source.includes("createClient"), false, file);
    assert.equal(source.includes("features/finance"), false, file);
    assert.equal(source.includes("features/crm"), false, file);
    assert.equal(source.includes("features/customer"), false, file);
    assert.equal(source.includes("features/player"), false, file);
    assert.equal(source.includes("competition-engine"), false, file);
  }
});

test("51. no global singleton catalog", () => {
  const a = IA.createReadOnlyDashboardReportCatalog({
    dashboards: [baseDashboard()],
  });
  const b = IA.createReadOnlyDashboardReportCatalog({
    dashboards: [baseDashboard({ dashboardId: "other" })],
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.notEqual(a.value, b.value);
  assert.equal(a.value.dashboardCount, 1);
  assert.equal(b.value.dashboardCount, 1);
  assert.equal(a.value.hasDashboard("ia.demo.ops_dashboard", "1.0.0"), true);
  assert.equal(b.value.hasDashboard("ia.demo.ops_dashboard", "1.0.0"), false);
});

test("52. empty catalog has clear behavior", () => {
  const created = IA.createReadOnlyDashboardReportCatalog({});
  assert.equal(created.ok, true);
  assert.equal(created.value.isEmpty, true);
  assert.equal(created.value.size, 0);
  const listed = created.value.listDashboards();
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.value, []);
});

test("53. same input creates same output", () => {
  const a = IA.createAnalyticsDashboardDefinition(baseDashboard());
  const b = IA.createAnalyticsDashboardDefinition(baseDashboard());
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(JSON.stringify(a.value), JSON.stringify(b.value));
});

test("54. retired metric binding is rejected when registry provided", () => {
  const registry = IA.createMetricRegistry({
    entries: [
      {
        definition: baseDefinition(),
        lifecycleState: IA.ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED,
      },
    ],
  });
  assert.equal(registry.ok, true);
  const binding = IA.createAnalyticsMetricBinding(metricBinding(), {
    registry: registry.value.registry,
  });
  assert.equal(binding.ok, false);
  assert.equal(binding.error.code, IA.ANALYTICS_ERROR_CODE.METRIC_RETIRED);
});

test("55. unsupported presentation intent is rejected", () => {
  const result = IA.createAnalyticsPresentationIntent({
    intent: "FANCY_CHART",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.PRESENTATION_INTENT_INVALID
  );
});

test("56. duplicate binding alias is rejected", () => {
  const result = IA.createAnalyticsDashboardDefinition(
    baseDashboard({
      sections: [
        {
          sectionId: "sec-1",
          widgets: [
            baseWidget({
              metricBinding: metricBinding({ presentationAlias: "revenue" }),
            }),
            baseWidget({
              widgetId: "w-2",
              metricBinding: metricBinding({ presentationAlias: "revenue" }),
            }),
          ],
        },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Duplicate binding presentationAlias/);
});

test("57. partial payload keeps warnings", () => {
  const result = IA.createAnalyticsKpiPayload({
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    value: 10,
    effectiveWindow: WINDOW,
    provenance: PROVENANCE,
    dataState: {
      state: IA.ANALYTICS_DATA_STATE.PARTIAL,
      warnings: [{ code: "PARTIAL_WINDOW", message: "incomplete window" }],
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.warnings.length, 1);
});

test("58. stale payload is not marked current", () => {
  const result = IA.createAnalyticsKpiPayload({
    metricId: "ia.demo.observation_sum",
    metricVersion: "1.0.0",
    value: 10,
    effectiveWindow: WINDOW,
    provenance: PROVENANCE,
    dataState: {
      state: IA.ANALYTICS_DATA_STATE.STALE,
      freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE,
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.dataState.isCurrent, false);
});

test("59. report column rejects executable formatter", () => {
  const result = IA.createAnalyticsReportColumn({
    columnId: "c1",
    formatter: (v) => String(v),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.FORBIDDEN_CONTRACT);
});

test("60. presentation metadata rejects chart-library config object", () => {
  const result = IA.createAnalyticsPresentationIntent({
    intent: IA.ANALYTICS_PRESENTATION_INTENT.SERIES,
    chartOptions: { type: "line", plugins: [] },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.FORBIDDEN_CONTRACT);
});

test("public marker and validate helpers are exported", () => {
  assert.equal(IA.INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING.workstreamId, "I&A-04");
  const validated = IA.validateDashboardDefinition(baseDashboard());
  assert.equal(validated.ok, true);
  const validatedReport = IA.validateReportDefinition(baseReport());
  assert.equal(validatedReport.ok, true);
});

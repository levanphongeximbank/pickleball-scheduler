/**
 * Intelligence & Analytics public module surface.
 *
 * I&A-01 — Canonical Analytics Contracts Foundation
 * I&A-02 — Metric Registry and Definition Governance
 * I&A-03 — Analytics Query and Projection Runtime
 * I&A-04 — Dashboard and Reporting Data Contracts
 *
 * Module-neutral metric/query/result contracts, metric registry governance,
 * deterministic query/projection runtime over explicit source adapters,
 * presentation-neutral dashboard/report data contracts, and read-only facades.
 * No dashboard UI wiring, no Platform Core / Competition E2E / business-rule
 * deps, no SQL/Supabase adapters, no export/scheduler runtime.
 */

export * from "./contracts/index.js";
export * from "./projections/index.js";
export * from "./aggregation/index.js";
export * from "./facade/index.js";
export * from "./registry/index.js";
export * from "./runtime/index.js";
export * from "./dashboard-reporting/index.js";

export const INTELLIGENCE_ANALYTICS_FOUNDATION = Object.freeze({
  workstreamId: "I&A-01",
  name: "Canonical Analytics Contracts Foundation",
  version: "1.0.0",
});

export const INTELLIGENCE_ANALYTICS_METRIC_REGISTRY = Object.freeze({
  workstreamId: "I&A-02",
  name: "Metric Registry and Definition Governance",
  version: "1.0.0",
});

export const INTELLIGENCE_ANALYTICS_QUERY_RUNTIME = Object.freeze({
  workstreamId: "I&A-03",
  name: "Analytics Query and Projection Runtime",
  version: "1.0.0",
});

export const INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING = Object.freeze({
  workstreamId: "I&A-04",
  name: "Dashboard and Reporting Data Contracts",
  version: "1.0.0",
});

export const INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS = Object.freeze([
  "INTELLIGENCE_ANALYTICS_FOUNDATION",
  "INTELLIGENCE_ANALYTICS_METRIC_REGISTRY",
  "INTELLIGENCE_ANALYTICS_QUERY_RUNTIME",
  "INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING",
  "createAnalyticsMetricId",
  "createAnalyticsMetricVersion",
  "createAnalyticsMetricDefinition",
  "createAnalyticsQueryDescriptor",
  "createAnalyticsTenantScope",
  "createAnalyticsResult",
  "aggregateExplicit",
  "createReadOnlyAnalyticsFacade",
  "projectAnalyticsDataPoint",
  "projectAnalyticsSeries",
  "createMetricRegistry",
  "createReadOnlyMetricRegistry",
  "validateMetricDefinition",
  "compareMetricDefinitions",
  "ANALYTICS_METRIC_LIFECYCLE_STATE",
  "ANALYTICS_METRIC_COMPATIBILITY",
  "createAnalyticsQueryRuntime",
  "createReadOnlyAnalyticsQueryRuntime",
  "createInMemoryAnalyticsSourceAdapter",
  "normalizeAnalyticsQuery",
  "validateAnalyticsQueryExecution",
  "executeAnalyticsProjection",
  "createAnalyticsObservation",
  "createAnalyticsRuntimeContext",
  "createAnalyticsAccessContext",
  "createAnalyticsDashboardDefinition",
  "createAnalyticsReportDefinition",
  "validateDashboardDefinition",
  "validateReportDefinition",
  "createDashboardReportCatalog",
  "createReadOnlyDashboardReportCatalog",
  "compareDashboardDefinitions",
  "compareReportDefinitions",
  "createAnalyticsMetricBinding",
  "createAnalyticsQueryBinding",
  "createAnalyticsPresentationIntent",
  "createAnalyticsDataState",
  "createAnalyticsKpiPayload",
  "createAnalyticsTimeSeriesPayload",
  "createAnalyticsBreakdownPayload",
  "createAnalyticsComparisonPayload",
  "createAnalyticsTablePayload",
  "createAnalyticsDrillDownDescriptor",
  "createAnalyticsFilterDefinition",
  "createAnalyticsParameterDefinition",
  "createAnalyticsExportIntent",
  "createAnalyticsScheduleIntent",
  "ANALYTICS_DATA_STATE",
  "ANALYTICS_WIDGET_KIND",
  "ANALYTICS_PRESENTATION_INTENT",
  "ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY",
]);

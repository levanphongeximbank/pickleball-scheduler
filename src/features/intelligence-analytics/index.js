/**
 * Intelligence & Analytics public module surface.
 *
 * I&A-01 — Canonical Analytics Contracts Foundation
 * I&A-02 — Metric Registry and Definition Governance
 * I&A-03 — Analytics Query and Projection Runtime
 *
 * Module-neutral metric/query/result contracts, metric registry governance,
 * deterministic query/projection runtime over explicit source adapters, and
 * read-only facades. No dashboard wiring, no Platform Core / Competition E2E /
 * business-rule deps, no SQL/Supabase adapters.
 */

export * from "./contracts/index.js";
export * from "./projections/index.js";
export * from "./aggregation/index.js";
export * from "./facade/index.js";
export * from "./registry/index.js";
export * from "./runtime/index.js";

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

export const INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS = Object.freeze([
  "INTELLIGENCE_ANALYTICS_FOUNDATION",
  "INTELLIGENCE_ANALYTICS_METRIC_REGISTRY",
  "INTELLIGENCE_ANALYTICS_QUERY_RUNTIME",
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
]);

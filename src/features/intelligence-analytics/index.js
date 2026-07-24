/**
 * Intelligence & Analytics public module surface.
 *
 * I&A-01 — Canonical Analytics Contracts Foundation
 * I&A-02 — Metric Registry and Definition Governance
 *
 * Module-neutral metric/query/result contracts, deterministic aggregation over
 * explicit input, metric registry governance, and read-only facades.
 * No runtime source adapters, no dashboard wiring, no Platform Core /
 * Competition E2E / business-rule deps.
 */

export * from "./contracts/index.js";
export * from "./projections/index.js";
export * from "./aggregation/index.js";
export * from "./facade/index.js";
export * from "./registry/index.js";

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

export const INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS = Object.freeze([
  "INTELLIGENCE_ANALYTICS_FOUNDATION",
  "INTELLIGENCE_ANALYTICS_METRIC_REGISTRY",
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
]);

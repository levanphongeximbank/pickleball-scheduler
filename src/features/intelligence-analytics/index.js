/**
 * Intelligence & Analytics — Canonical Analytics Contracts Foundation (I&A-01).
 *
 * Module-neutral metric/query/result contracts, deterministic aggregation over
 * explicit input, and a read-only facade. No runtime source adapters, no
 * dashboard wiring, no Platform Core / Competition E2E / business-rule deps.
 */

export * from "./contracts/index.js";
export * from "./projections/index.js";
export * from "./aggregation/index.js";
export * from "./facade/index.js";

export const INTELLIGENCE_ANALYTICS_FOUNDATION = Object.freeze({
  workstreamId: "I&A-01",
  name: "Canonical Analytics Contracts Foundation",
  version: "1.0.0",
});

export const INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS = Object.freeze([
  "INTELLIGENCE_ANALYTICS_FOUNDATION",
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
]);

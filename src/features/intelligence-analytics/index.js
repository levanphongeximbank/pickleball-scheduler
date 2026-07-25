/**
 * Intelligence & Analytics public module surface.
 *
 * I&A-01 — Canonical Analytics Contracts Foundation
 * I&A-02 — Metric Registry and Definition Governance
 * I&A-03 — Analytics Query and Projection Runtime
 * I&A-04 — Dashboard and Reporting Data Contracts
 * I&A-05 — Historical and Trend Analysis
 * I&A-06 — Competition Analytics
 * I&A-07 — Venue, Court and Club Analytics
 * I&A-08 — Customer and Player Analytics
 *
 * Module-neutral metric/query/result contracts, metric registry governance,
 * deterministic query/projection runtime over explicit source adapters,
 * presentation-neutral dashboard/report data contracts, historical/trend
 * analysis, competition analytics projections, venue/court/club analytics
 * projections, privacy-safe customer/player analytics projections, and
 * read-only facades.
 * No dashboard UI wiring, no Platform Core / Competition E2E / business-rule
 * deps, no SQL/Supabase adapters, no export/scheduler runtime, no forecasting.
 */

export * from "./contracts/index.js";
export * from "./projections/index.js";
export * from "./aggregation/index.js";
export * from "./facade/index.js";
export * from "./registry/index.js";
export * from "./runtime/index.js";
export * from "./dashboard-reporting/index.js";
export * from "./historical-trend/index.js";
export * from "./competition-analytics/index.js";
export * from "./venue-court-club-analytics/index.js";
export * from "./customer-player-analytics/index.js";

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

export const INTELLIGENCE_ANALYTICS_HISTORICAL_TREND = Object.freeze({
  workstreamId: "I&A-05",
  name: "Historical and Trend Analysis",
  version: "1.0.0",
});

export const INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS = Object.freeze({
  workstreamId: "I&A-06",
  name: "Competition Analytics",
  version: "1.0.0",
});

export const INTELLIGENCE_ANALYTICS_VENUE_COURT_CLUB_ANALYTICS = Object.freeze({
  workstreamId: "I&A-07",
  name: "Venue, Court and Club Analytics",
  version: "1.0.0",
});

export const INTELLIGENCE_ANALYTICS_CUSTOMER_PLAYER_ANALYTICS = Object.freeze({
  workstreamId: "I&A-08",
  name: "Customer and Player Analytics",
  version: "1.0.0",
});

export const INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS = Object.freeze([
  "INTELLIGENCE_ANALYTICS_FOUNDATION",
  "INTELLIGENCE_ANALYTICS_METRIC_REGISTRY",
  "INTELLIGENCE_ANALYTICS_QUERY_RUNTIME",
  "INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING",
  "INTELLIGENCE_ANALYTICS_HISTORICAL_TREND",
  "INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS",
  "INTELLIGENCE_ANALYTICS_VENUE_COURT_CLUB_ANALYTICS",
  "INTELLIGENCE_ANALYTICS_CUSTOMER_PLAYER_ANALYTICS",
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
  "createAnalyticsHistoricalQuery",
  "normalizeHistoricalQuery",
  "createAnalyticsHistoricalObservation",
  "createAnalyticsHistoricalSeries",
  "createAnalyticsCoverage",
  "bucketHistoricalObservations",
  "compareHistoricalPeriods",
  "analyzeTrend",
  "applyMovingWindow",
  "applyCumulative",
  "createHistoricalAnalyticsRuntime",
  "createReadOnlyHistoricalAnalyticsFacade",
  "createInMemoryHistoricalSourceAdapter",
  "ANALYTICS_MISSING_PERIOD_POLICY",
  "ANALYTICS_TREND_DIRECTION",
  "ANALYTICS_TREND_STRENGTH",
  "ANALYTICS_CHANGE_DIRECTION",
  "ANALYTICS_COMPLETENESS_STATE",
  "createCompetitionAnalyticsContext",
  "createCompetitionAnalyticsSnapshot",
  "createCompetitionAnalyticsSourceRequest",
  "createInMemoryCompetitionAnalyticsSource",
  "createCompetitionAnalyticsQuery",
  "normalizeCompetitionAnalyticsQuery",
  "createCompetitionAnalyticsMetricDefinitions",
  "createCompetitionAnalyticsMetricCatalogEntries",
  "COMPETITION_ANALYTICS_METRIC_IDS",
  "projectCompetitionSummary",
  "projectCompetitionDistributions",
  "projectCompetitionProgress",
  "projectCompetitionResultAcceptance",
  "projectCompetitionScheduleAdherence",
  "projectCompetitionDurations",
  "projectCompetitionAssignments",
  "composeCompetitionHistoricalObservations",
  "composeCompetitionDashboardPayloads",
  "createCompetitionAnalyticsFacade",
  "createReadOnlyCompetitionAnalyticsFacade",
  "COMPETITION_ANALYTICS_METHOD_VERSION",
  "COMPETITION_PROGRESS_EXCLUSION_POLICY",
  "COMPETITION_ANALYTICS_COMPLETENESS",
  "createVenueCourtClubAnalyticsContext",
  "createVenueCourtClubAnalyticsSnapshot",
  "createVenueCourtClubAnalyticsSourceRequest",
  "createInMemoryVenueCourtClubAnalyticsSource",
  "createVenueCourtClubAnalyticsQuery",
  "normalizeVenueCourtClubAnalyticsQuery",
  "createVenueCourtClubAnalyticsMetricDefinitions",
  "createVenueCourtClubAnalyticsMetricCatalogEntries",
  "VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS",
  "projectVenueCourtClubSummary",
  "projectVenueSummary",
  "projectCourtInventory",
  "projectCourtAvailability",
  "projectOperatingHours",
  "projectBookingVolume",
  "projectCourtUtilization",
  "projectCourtDowntime",
  "projectClubSummary",
  "composeVenueCourtClubHistoricalObservations",
  "composeVenueCourtClubDashboardPayloads",
  "createVenueCourtClubAnalyticsFacade",
  "createReadOnlyVenueCourtClubAnalyticsFacade",
  "VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION",
  "BOOKING_CANCELLATION_POLICY",
  "VENUE_COURT_CLUB_ANALYTICS_COMPLETENESS",
  "createCustomerPlayerAnalyticsContext",
  "createCustomerPlayerAnalyticsSnapshot",
  "createCustomerPlayerAnalyticsSourceRequest",
  "createInMemoryCustomerPlayerAnalyticsSource",
  "createCustomerPlayerAnalyticsQuery",
  "normalizeCustomerPlayerAnalyticsQuery",
  "createCustomerPlayerAnalyticsMetricDefinitions",
  "createCustomerPlayerAnalyticsMetricCatalogEntries",
  "CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS",
  "projectCustomerPlayerSummary",
  "projectCustomerSummary",
  "projectPlayerSummary",
  "projectCustomerPlayerLinkage",
  "projectCustomerPlayerActivity",
  "projectPlayerCompetitionParticipation",
  "projectPlayerClubMembership",
  "composeCustomerPlayerHistoricalObservations",
  "composeCustomerPlayerDashboardPayloads",
  "createCustomerPlayerAnalyticsFacade",
  "createReadOnlyCustomerPlayerAnalyticsFacade",
  "CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION",
  "CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS",
  "FORBIDDEN_PII_FACT_KEYS",
]);

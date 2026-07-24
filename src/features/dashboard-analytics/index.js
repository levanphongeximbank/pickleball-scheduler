export { default as DashboardAnalyticsView } from "./components/DashboardAnalyticsView.jsx";
export { useDashboardAnalytics } from "./hooks/useDashboardAnalytics.js";
export { resolveDashboardAccess } from "./services/dashboardScope.js";
export {
  getDashboardAnalytics,
  getDashboardSummary,
  getRevenueAnalytics,
  getPlayerAnalytics,
  getClubAnalytics,
  getTopPlayers,
  getTopCourts,
  getCourtHeatmap,
  getPeakHours,
  getOperationalInsights,
  formatCurrency,
  formatTrend,
} from "./services/dashboardService.js";
export { generateOperationalInsights } from "./services/insightEngine.js";
export {
  TIME_RANGE_PRESETS,
  TIME_RANGE_OPTIONS,
  resolveTimeRange,
  resolvePreviousPeriod,
} from "./constants/timeRangePresets.js";

// ---------------------------------------------------------------------------
// Platform Core adoption — pure projections (additive; no runtime wiring)
// ---------------------------------------------------------------------------

export {
  REPORTING_PLATFORM_ADAPTER_ERROR,
  projectReportingActor,
  projectReportingSecurityContext,
  projectReportingScope,
  projectReportingSubject,
  projectReportingOperation,
  projectReportingVersion,
  projectReportingCompatibility,
  projectReportingEvent,
  projectReportingError,
  projectReportingCapability,
} from "./platform/index.js";

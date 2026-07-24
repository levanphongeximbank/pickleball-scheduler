/**
 * I&A-04 — Dashboard and Reporting Data Contracts public barrel.
 */

export {
  ANALYTICS_DASHBOARD_LIFECYCLE_STATE,
  ANALYTICS_REPORT_LIFECYCLE_STATE,
  ANALYTICS_WIDGET_KIND,
  ANALYTICS_PRESENTATION_INTENT,
  ANALYTICS_DATA_STATE,
  ANALYTICS_EXPORT_FORMAT,
  ANALYTICS_PARAMETER_TYPE,
  ANALYTICS_LAYOUT_INTENT,
  ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY,
  ANALYTICS_COMPARISON_METHOD,
  ANALYTICS_MISSING_CATEGORY_SEMANTICS,
  isEnumValue,
} from "./enums.js";

export {
  createAnalyticsDashboardId,
  createAnalyticsDashboardVersion,
  createAnalyticsReportId,
  createAnalyticsReportVersion,
  dashboardIdentityKey,
  reportIdentityKey,
} from "./identifiers.js";

export {
  createAnalyticsAccessScope,
  createAnalyticsTenantApplicability,
} from "./accessScope.js";

export {
  createAnalyticsMetricBinding,
  createAnalyticsQueryBinding,
} from "./bindings.js";

export {
  createAnalyticsPresentationIntent,
  createAnalyticsFilterDefinition,
  createAnalyticsParameterDefinition,
  createAnalyticsDrillDownDescriptor,
  createAnalyticsExportIntent,
  createAnalyticsScheduleIntent,
} from "./presentation.js";

export {
  createAnalyticsDataState,
  createAnalyticsKpiPayload,
  createAnalyticsTimeSeriesPayload,
  createAnalyticsBreakdownPayload,
  createAnalyticsComparisonPayload,
  createAnalyticsTablePayload,
} from "./payloads.js";

export {
  createAnalyticsDashboardWidget,
  createAnalyticsDashboardSection,
  createAnalyticsDashboardDefinition,
  validateDashboardDefinition,
} from "./dashboardDefinition.js";

export {
  createAnalyticsReportColumn,
  createAnalyticsReportSection,
  createAnalyticsReportDefinition,
  validateReportDefinition,
} from "./reportDefinition.js";

export {
  compareDashboardDefinitions,
  compareReportDefinitions,
} from "./compatibility.js";

export {
  ANALYTICS_CATALOG_REGISTRATION_STATUS,
  createDashboardReportCatalog,
  createReadOnlyDashboardReportCatalog,
} from "./catalog.js";

export { assertNoForbiddenContractContent } from "./forbidden.js";

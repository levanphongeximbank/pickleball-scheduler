/**
 * Additive dashboard provenance bridge for REPORTING-04.
 *
 * Re-exports Reporting public classification helpers so UI can adopt honest
 * provenance without deep-importing Reporting internals.
 */

export {
  classifyDashboardPayloadProvenance,
  MOCK_DASHBOARD_DATA_CLASSIFICATION,
  composeMixedProvenance,
  resolveDashboardPresentationSourceState,
  REPORTING_PRESENTATION_SOURCE_STATE,
  getReportingPresentationSourceStateLabel,
} from "../../reporting-analytics/index.js";

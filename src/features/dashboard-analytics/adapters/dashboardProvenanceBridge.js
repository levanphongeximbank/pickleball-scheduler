/**
 * Additive dashboard provenance bridge for REPORTING-04 handoff.
 *
 * Does not change dashboard UI or live/mock service behavior.
 * Re-exports Reporting classification helpers so Experience Channels / UI
 * can later adopt honest provenance without deep-importing Reporting internals.
 */

export {
  classifyDashboardPayloadProvenance,
  MOCK_DASHBOARD_DATA_CLASSIFICATION,
} from "../../reporting-analytics/adapters/dashboardProvenance.js";

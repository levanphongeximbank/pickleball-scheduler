/**
 * Metric lifecycle states for I&A-02 registry governance.
 */

export const ANALYTICS_METRIC_LIFECYCLE_STATE = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  DEPRECATED: "deprecated",
  RETIRED: "retired",
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAnalyticsMetricLifecycleState(value) {
  return (
    typeof value === "string" &&
    Object.values(ANALYTICS_METRIC_LIFECYCLE_STATE).includes(value)
  );
}

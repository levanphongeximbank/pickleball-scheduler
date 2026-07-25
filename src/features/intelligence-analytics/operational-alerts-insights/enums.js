/**
 * I&A-10 — Operational Alerts and Insights enums and analytical-method
 * constants. Analytical alert/insight foundation only — no notification
 * delivery, persistence, remediation, or AI.
 */

export const OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION = Object.freeze({
  SIGNAL: "ia10.operational_signal_v1",
  EVALUATION: "ia10.alert_evaluation_v1",
  THRESHOLD: "ia10.threshold_evaluator_v1",
  STATE: "ia10.state_evaluator_v1",
  TREND: "ia10.trend_evaluator_v1",
  MISSING_DATA: "ia10.missing_data_evaluator_v1",
  FRESHNESS: "ia10.freshness_evaluator_v1",
  DEDUP: "ia10.dedup_key_v1",
  CORRELATION: "ia10.correlation_key_v1",
  LIFECYCLE: "ia10.lifecycle_projection_v1",
  DASHBOARD: "ia10.alerts_insights_dashboard_v1",
  INSIGHT: "ia10.insight_evaluation_v1",
});

export const OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS = Object.freeze({
  COMPLETE: "complete",
  PARTIAL: "partial",
  UNKNOWN: "unknown",
});

/**
 * Versioned alert severity vocabulary.
 */
export const ALERT_SEVERITY = Object.freeze({
  INFO: "INFO",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
});

export const ALERT_SEVERITY_SEMANTICS = Object.freeze({
  INFO: "informational, no immediate action required",
  LOW: "minor degradation or early signal",
  MEDIUM: "meaningful operational attention",
  HIGH: "material operational issue",
  CRITICAL: "severe fail-closed condition or major business interruption",
});

/**
 * Analytical lifecycle projection states. I&A-10 projects metadata only —
 * it never persists acknowledgement or mutates consumer state.
 */
export const ALERT_LIFECYCLE_STATE = Object.freeze({
  OPEN: "OPEN",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RESOLVED: "RESOLVED",
  EXPIRED: "EXPIRED",
  SUPPRESSED: "SUPPRESSED",
});

export const ALERT_EVALUATION_TYPE = Object.freeze({
  THRESHOLD: "threshold",
  STATE: "state",
  TREND: "trend",
  MISSING_DATA: "missing_data",
  FRESHNESS: "freshness",
  SOURCE_FAILURE: "source_failure",
});

export const ALERT_THRESHOLD_OPERATOR = Object.freeze({
  GT: "gt",
  GTE: "gte",
  LT: "lt",
  LTE: "lte",
  EQ: "eq",
  NEQ: "neq",
  INSIDE_RANGE: "inside_range",
  OUTSIDE_RANGE: "outside_range",
});

export const OPERATIONAL_SIGNAL_DOMAIN = Object.freeze({
  DATA_QUALITY: "data_quality",
  VENUE_COURT: "venue_court",
  COMPETITION: "competition",
  CUSTOMER_PLAYER: "customer_player",
  FINANCE: "finance",
  RANKING_PERFORMANCE: "ranking_performance",
});

export const OPERATIONAL_SIGNAL_VALUE_KIND = Object.freeze({
  NUMBER: "number",
  PERCENTAGE: "percentage",
  MONEY: "money",
  STATE: "state",
  BOOLEAN: "boolean",
  TREND: "trend",
  ABSENT: "absent",
});

export const MISSING_SIGNAL_POLICY = Object.freeze({
  ALERT: "alert",
  WARN: "warn",
  SKIP: "skip",
  FAIL: "fail",
});

export const STALE_SIGNAL_POLICY = Object.freeze({
  ALERT: "alert",
  WARN: "warn",
  SKIP: "skip",
  FAIL: "fail",
});

export const RESULT_KIND = Object.freeze({
  ALERT: "alert",
  INSIGHT: "insight",
});

/**
 * @param {unknown} value
 * @param {Readonly<Record<string, string>>} enumObject
 * @returns {boolean}
 */
export function isOperationalAlertsInsightsEnumValue(value, enumObject) {
  return Object.values(enumObject).includes(/** @type {string} */ (value));
}

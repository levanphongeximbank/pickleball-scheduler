/**
 * Immutable foundation rule catalog for Operational Alerts and Insights
 * (I&A-10). Rules bind only to stable merged I&A metric IDs.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import {
  ALERT_EVALUATION_TYPE,
  ALERT_SEVERITY,
  ALERT_THRESHOLD_OPERATOR,
  MISSING_SIGNAL_POLICY,
  OPERATIONAL_SIGNAL_DOMAIN,
  OPERATIONAL_SIGNAL_VALUE_KIND,
  STALE_SIGNAL_POLICY,
} from "./enums.js";
import {
  createOperationalAlertRule,
  createOperationalInsightRule,
} from "./rules.js";
import { VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS } from "../venue-court-club-analytics/metrics.js";
import { COMPETITION_ANALYTICS_METRIC_IDS } from "../competition-analytics/metrics.js";
import { CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS } from "../customer-player-analytics/metrics.js";
import { FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS } from "../finance-ranking-performance-analytics/metrics.js";

const METRIC_VERSION = "1.0.0";

/**
 * Deferred rules — metric/fact not stable enough or requires production
 * signal adapters beyond explicit I&A facts.
 */
export const OPERATIONAL_ALERT_RULES_DEFERRED = Object.freeze([
  Object.freeze({
    ruleId: "operational.booking.cancellation_spike",
    reason:
      "Requires explicit cancellation-rate time series / spike baseline not yet exposed as a stable I&A-07 scalar metric",
  }),
  Object.freeze({
    ruleId: "operational.competition.progress_stalled",
    reason:
      "Requires multi-period progress trend with stall semantics; use trend insight on competition.progress.percentage instead",
  }),
]);

/**
 * @returns {import("../contracts/result.js").Result}
 */
function buildFoundationRuleInputs() {
  /** @type {unknown[]} */
  const alertRules = [
    {
      ruleId: "operational.data.missing",
      ruleVersion: "1.0.0",
      title: "Operational data missing",
      description: "Source signal is missing for a required operational metric",
      evaluationType: ALERT_EVALUATION_TYPE.MISSING_DATA,
      severity: ALERT_SEVERITY.HIGH,
      domain: OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
      metricId: "operational.data.availability",
      metricVersion: METRIC_VERSION,
      condition: { alertOnMissing: true, neverFillZero: true },
      missingDataPolicy: MISSING_SIGNAL_POLICY.ALERT,
      staleDataPolicy: STALE_SIGNAL_POLICY.WARN,
      explanationTemplate:
        "Data unavailable for {metricId}; missing signal cannot be treated as zero",
      cooldownPolicy: { durationMs: 1800000, suppressionReason: "missing_data_cooldown" },
      correlationGroup: "data_quality",
    },
    {
      ruleId: "operational.data.stale",
      ruleVersion: "1.0.0",
      title: "Operational data stale",
      description: "Source signal freshness is stale",
      evaluationType: ALERT_EVALUATION_TYPE.FRESHNESS,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
      metricId: "operational.data.freshness",
      metricVersion: METRIC_VERSION,
      condition: { alertOnStale: true },
      missingDataPolicy: MISSING_SIGNAL_POLICY.WARN,
      staleDataPolicy: STALE_SIGNAL_POLICY.ALERT,
      explanationTemplate:
        "Source data is stale since {sourceTimestamp}; freshness is not treated as fresh",
      cooldownPolicy: { durationMs: 1800000, suppressionReason: "stale_data_cooldown" },
      correlationGroup: "data_quality",
    },
    {
      ruleId: "operational.data.incomplete",
      ruleVersion: "1.0.0",
      title: "Operational data incomplete",
      description: "Snapshot completeness is partial or unknown",
      evaluationType: ALERT_EVALUATION_TYPE.MISSING_DATA,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
      metricId: "operational.data.completeness",
      metricVersion: METRIC_VERSION,
      condition: { alertOnIncomplete: true, neverFillZero: true },
      explanationTemplate:
        "Source completeness is incomplete (coverage/completeness not assumed complete)",
      cooldownPolicy: { durationMs: 1800000 },
      correlationGroup: "data_quality",
    },
    {
      ruleId: "operational.source.failure",
      ruleVersion: "1.0.0",
      title: "Operational source failure",
      description: "Explicit source failure signal",
      evaluationType: ALERT_EVALUATION_TYPE.SOURCE_FAILURE,
      severity: ALERT_SEVERITY.CRITICAL,
      domain: OPERATIONAL_SIGNAL_DOMAIN.DATA_QUALITY,
      metricId: "operational.source.status",
      metricVersion: METRIC_VERSION,
      condition: { alertOnSourceFailure: true, neverFillZero: true },
      explanationTemplate: "Operational signal source failure for {metricId}",
      cooldownPolicy: { durationMs: 900000 },
      correlationGroup: "data_quality",
    },
    {
      ruleId: "operational.court.availability_low",
      ruleVersion: "1.0.0",
      title: "Court availability low",
      description: "Court availability rate below threshold (I&A-07)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      domain: OPERATIONAL_SIGNAL_DOMAIN.VENUE_COURT,
      metricId: VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE,
      metricVersion: METRIC_VERSION,
      unit: "ratio",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.LT,
        threshold: 0.4,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
        unit: "ratio",
      },
      explanationTemplate:
        "Court availability rate {value} is below threshold {threshold} (I&A-07 signal only)",
      cooldownPolicy: { durationMs: 3600000 },
      correlationGroup: "venue_court",
    },
    {
      ruleId: "operational.court.utilization_high",
      ruleVersion: "1.0.0",
      title: "Court utilization high",
      description: "Court utilization rate above threshold (I&A-07)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.VENUE_COURT,
      metricId: VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_UTILIZATION_RATE,
      metricVersion: METRIC_VERSION,
      unit: "ratio",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.GT,
        threshold: 0.9,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
        unit: "ratio",
      },
      explanationTemplate:
        "Court utilization rate {value} is above threshold {threshold}",
      cooldownPolicy: { durationMs: 3600000 },
      correlationGroup: "venue_court",
    },
    {
      ruleId: "operational.court.downtime_high",
      ruleVersion: "1.0.0",
      title: "Court downtime high",
      description: "Court downtime rate above threshold (I&A-07)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      domain: OPERATIONAL_SIGNAL_DOMAIN.VENUE_COURT,
      metricId: VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_DOWNTIME_RATE,
      metricVersion: METRIC_VERSION,
      unit: "ratio",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.GTE,
        threshold: 0.25,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
        unit: "ratio",
      },
      explanationTemplate: "Court downtime rate {value} meets/exceeds {threshold}",
      cooldownPolicy: { durationMs: 3600000 },
      correlationGroup: "venue_court",
    },
    {
      ruleId: "operational.competition.schedule_delay_high",
      ruleVersion: "1.0.0",
      title: "Competition schedule delay high",
      description: "Delayed start count above threshold (I&A-06)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      domain: OPERATIONAL_SIGNAL_DOMAIN.COMPETITION,
      metricId: COMPETITION_ANALYTICS_METRIC_IDS.SCHEDULE_DELAYED_START_COUNT,
      metricVersion: METRIC_VERSION,
      unit: "count",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.GT,
        threshold: 5,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER,
        unit: "count",
      },
      explanationTemplate:
        "Competition delayed starts {value} exceed threshold {threshold}",
      cooldownPolicy: { durationMs: 1800000 },
      correlationGroup: "competition",
    },
    {
      ruleId: "operational.competition.result_rejection_spike",
      ruleVersion: "1.0.0",
      title: "Competition result rejection spike",
      description: "Rejected results count above threshold (I&A-06)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      domain: OPERATIONAL_SIGNAL_DOMAIN.COMPETITION,
      metricId: COMPETITION_ANALYTICS_METRIC_IDS.RESULTS_REJECTED_COUNT,
      metricVersion: METRIC_VERSION,
      unit: "count",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.GTE,
        threshold: 3,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER,
        unit: "count",
      },
      explanationTemplate: "Rejected results {value} meet/exceed threshold {threshold}",
      cooldownPolicy: { durationMs: 1800000 },
      correlationGroup: "competition",
    },
    {
      ruleId: "operational.competition.incomplete_data",
      ruleVersion: "1.0.0",
      title: "Competition incomplete data",
      description: "Competition completeness signal incomplete (I&A-06)",
      evaluationType: ALERT_EVALUATION_TYPE.MISSING_DATA,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.COMPETITION,
      metricId: COMPETITION_ANALYTICS_METRIC_IDS.PROGRESS_PERCENTAGE,
      metricVersion: METRIC_VERSION,
      condition: { alertOnIncomplete: true, neverFillZero: true },
      explanationTemplate:
        "Competition analytical data incomplete; progress not assumed complete",
      cooldownPolicy: { durationMs: 1800000 },
      correlationGroup: "competition",
    },
    {
      ruleId: "operational.customer.activity_drop",
      ruleVersion: "1.0.0",
      title: "Customer activity drop",
      description: "Customer activity count declining trend (I&A-08 + I&A-05)",
      evaluationType: ALERT_EVALUATION_TYPE.TREND,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.CUSTOMER_PLAYER,
      metricId: CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_ACTIVITIES_COUNT,
      metricVersion: METRIC_VERSION,
      condition: {
        expectedDirection: "decreasing",
        minimumPeriods: 3,
        minimumCoverage: 0.6,
      },
      explanationTemplate:
        "Customer activity declined over the selected window compared with prior periods",
      cooldownPolicy: { durationMs: 86400000 },
      correlationGroup: "customer_player",
    },
    {
      ruleId: "operational.player.activity_drop",
      ruleVersion: "1.0.0",
      title: "Player activity drop",
      description: "Player activity count declining trend (I&A-08 + I&A-05)",
      evaluationType: ALERT_EVALUATION_TYPE.TREND,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.CUSTOMER_PLAYER,
      metricId: CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_ACTIVITIES_COUNT,
      metricVersion: METRIC_VERSION,
      condition: {
        expectedDirection: "decreasing",
        minimumPeriods: 3,
        minimumCoverage: 0.6,
      },
      explanationTemplate:
        "Player activity declined over the selected window",
      cooldownPolicy: { durationMs: 86400000 },
      correlationGroup: "customer_player",
    },
    {
      ruleId: "operational.customer.player_linkage_low",
      ruleVersion: "1.0.0",
      title: "Customer-player linkage low",
      description: "Customer-player linkage rate below threshold (I&A-08)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.LOW,
      domain: OPERATIONAL_SIGNAL_DOMAIN.CUSTOMER_PLAYER,
      metricId: CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_PLAYER_LINKAGE_RATE,
      metricVersion: METRIC_VERSION,
      unit: "ratio",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.LT,
        threshold: 0.5,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
        unit: "ratio",
      },
      explanationTemplate: "Customer-player linkage rate {value} is below {threshold}",
      cooldownPolicy: { durationMs: 86400000 },
      correlationGroup: "customer_player",
    },
    {
      ruleId: "operational.profile.completeness_low",
      ruleVersion: "1.0.0",
      title: "Profile completeness low",
      description: "Customer profile completeness rate below threshold (I&A-08)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.LOW,
      domain: OPERATIONAL_SIGNAL_DOMAIN.CUSTOMER_PLAYER,
      metricId: CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_PROFILE_COMPLETENESS_RATE,
      metricVersion: METRIC_VERSION,
      unit: "ratio",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.LTE,
        threshold: 0.6,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
        unit: "ratio",
      },
      explanationTemplate:
        "Profile completeness rate {value} is at/below {threshold}",
      cooldownPolicy: { durationMs: 86400000 },
      correlationGroup: "customer_player",
    },
    {
      ruleId: "operational.finance.receivables_overdue_high",
      ruleVersion: "1.0.0",
      title: "Receivables overdue high",
      description: "Overdue receivables count above threshold (I&A-09 explicit)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      domain: OPERATIONAL_SIGNAL_DOMAIN.FINANCE,
      metricId:
        FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_RECEIVABLES_OVERDUE_COUNT,
      metricVersion: METRIC_VERSION,
      unit: "count",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.GT,
        threshold: 0,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER,
        unit: "count",
      },
      explanationTemplate:
        "Overdue receivables count {value} exceeds threshold {threshold} (explicit I&A-09 fact)",
      cooldownPolicy: { durationMs: 43200000 },
      correlationGroup: "finance",
    },
    {
      ruleId: "operational.finance.collection_rate_low",
      ruleVersion: "1.0.0",
      title: "Collection rate low",
      description: "Collection rate below threshold (I&A-09)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      domain: OPERATIONAL_SIGNAL_DOMAIN.FINANCE,
      metricId: FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_COLLECTIONS_RATE,
      metricVersion: METRIC_VERSION,
      unit: "ratio",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.LT,
        threshold: 0.7,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE,
        unit: "ratio",
      },
      explanationTemplate: "Collection rate {value} is below {threshold}",
      cooldownPolicy: { durationMs: 43200000 },
      correlationGroup: "finance",
    },
    {
      ruleId: "operational.finance.refund_spike",
      ruleVersion: "1.0.0",
      title: "Refund spike",
      description: "Refund count above threshold (I&A-09)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.FINANCE,
      metricId: FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_REFUNDS_COUNT,
      metricVersion: METRIC_VERSION,
      unit: "count",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.GTE,
        threshold: 5,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER,
        unit: "count",
      },
      explanationTemplate: "Refund count {value} meets/exceeds {threshold}",
      cooldownPolicy: { durationMs: 43200000 },
      correlationGroup: "finance",
    },
    {
      ruleId: "operational.finance.settlement_stale",
      ruleVersion: "1.0.0",
      title: "Settlement data stale",
      description: "Settlement-related signal freshness is stale (I&A-09)",
      evaluationType: ALERT_EVALUATION_TYPE.FRESHNESS,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.FINANCE,
      metricId: FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_SETTLEMENTS_COUNT,
      metricVersion: METRIC_VERSION,
      condition: { alertOnStale: true },
      staleDataPolicy: STALE_SIGNAL_POLICY.ALERT,
      explanationTemplate:
        "Settlement source is stale since {sourceTimestamp}",
      cooldownPolicy: { durationMs: 21600000 },
      correlationGroup: "finance",
    },
    {
      ruleId: "operational.ranking.snapshot_stale",
      ruleVersion: "1.0.0",
      title: "Ranking snapshot stale",
      description: "Ranking snapshot freshness is stale (I&A-09)",
      evaluationType: ALERT_EVALUATION_TYPE.FRESHNESS,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.RANKING_PERFORMANCE,
      metricId: FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.RANKING_SNAPSHOTS_COUNT,
      metricVersion: METRIC_VERSION,
      condition: { alertOnStale: true },
      staleDataPolicy: STALE_SIGNAL_POLICY.ALERT,
      explanationTemplate: "Ranking snapshot is stale since {sourceTimestamp}",
      cooldownPolicy: { durationMs: 21600000 },
      correlationGroup: "ranking_performance",
    },
    {
      ruleId: "operational.rating.snapshot_stale",
      ruleVersion: "1.0.0",
      title: "Rating snapshot stale",
      description: "Rating snapshot freshness is stale (I&A-09)",
      evaluationType: ALERT_EVALUATION_TYPE.FRESHNESS,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.RANKING_PERFORMANCE,
      metricId: FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.RATING_SNAPSHOTS_COUNT,
      metricVersion: METRIC_VERSION,
      condition: { alertOnStale: true },
      staleDataPolicy: STALE_SIGNAL_POLICY.ALERT,
      explanationTemplate: "Rating snapshot is stale since {sourceTimestamp}",
      cooldownPolicy: { durationMs: 21600000 },
      correlationGroup: "ranking_performance",
    },
    {
      ruleId: "operational.performance.result_data_incomplete",
      ruleVersion: "1.0.0",
      title: "Performance result data incomplete",
      description: "Performance analytical completeness incomplete (I&A-09)",
      evaluationType: ALERT_EVALUATION_TYPE.MISSING_DATA,
      severity: ALERT_SEVERITY.MEDIUM,
      domain: OPERATIONAL_SIGNAL_DOMAIN.RANKING_PERFORMANCE,
      metricId: FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.PERFORMANCE_COMPLETION_RATE,
      metricVersion: METRIC_VERSION,
      condition: { alertOnIncomplete: true, neverFillZero: true },
      explanationTemplate:
        "Performance result data incomplete; completion not assumed complete",
      cooldownPolicy: { durationMs: 21600000 },
      correlationGroup: "ranking_performance",
    },
  ];

  /** @type {unknown[]} */
  const insightRules = [
    {
      ruleId: "insight.court.utilization_changed",
      ruleVersion: "1.0.0",
      title: "Court utilization changed",
      description: "Utilization increased or decreased versus prior period",
      evaluationType: ALERT_EVALUATION_TYPE.TREND,
      severity: ALERT_SEVERITY.INFO,
      domain: OPERATIONAL_SIGNAL_DOMAIN.VENUE_COURT,
      metricId: VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_UTILIZATION_RATE,
      metricVersion: METRIC_VERSION,
      condition: {
        expectedDirection: "increasing",
        minimumPeriods: 2,
        minimumCoverage: 0.5,
        insufficientPeriodsPolicy: "warn_no_alert",
      },
      explanationTemplate:
        "Court utilization increased compared with previous period over the selected window",
      cooldownPolicy: { durationMs: 86400000 },
      correlationGroup: "venue_court_insight",
    },
    {
      ruleId: "insight.competition.schedule_adherence_trend",
      ruleVersion: "1.0.0",
      title: "Schedule adherence trend",
      description: "Schedule adherence declined over the selected window",
      evaluationType: ALERT_EVALUATION_TYPE.TREND,
      severity: ALERT_SEVERITY.INFO,
      domain: OPERATIONAL_SIGNAL_DOMAIN.COMPETITION,
      metricId: COMPETITION_ANALYTICS_METRIC_IDS.SCHEDULE_ADHERENCE_RATE,
      metricVersion: METRIC_VERSION,
      condition: {
        expectedDirection: "decreasing",
        minimumPeriods: 2,
        minimumCoverage: 0.5,
      },
      explanationTemplate:
        "Schedule adherence declined over the selected window",
      cooldownPolicy: { durationMs: 86400000 },
      correlationGroup: "competition_insight",
    },
    {
      ruleId: "insight.finance.collection_rate_changed",
      ruleVersion: "1.0.0",
      title: "Collection rate changed",
      description: "Collection rate change observation (I&A-09)",
      evaluationType: ALERT_EVALUATION_TYPE.TREND,
      severity: ALERT_SEVERITY.INFO,
      domain: OPERATIONAL_SIGNAL_DOMAIN.FINANCE,
      metricId: FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_COLLECTIONS_RATE,
      metricVersion: METRIC_VERSION,
      condition: {
        expectedDirection: "decreasing",
        minimumPeriods: 2,
        minimumCoverage: 0.5,
      },
      explanationTemplate:
        "Collection rate declined over the selected window",
      cooldownPolicy: { durationMs: 86400000 },
      correlationGroup: "finance_insight",
    },
    {
      ruleId: "insight.ranking.movement_summary",
      ruleVersion: "1.0.0",
      title: "Ranking movement summary",
      description: "Ranking upward movement observation (I&A-09)",
      evaluationType: ALERT_EVALUATION_TYPE.THRESHOLD,
      severity: ALERT_SEVERITY.INFO,
      domain: OPERATIONAL_SIGNAL_DOMAIN.RANKING_PERFORMANCE,
      metricId: FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.RANKING_MOVEMENT_UP_COUNT,
      metricVersion: METRIC_VERSION,
      unit: "count",
      condition: {
        operator: ALERT_THRESHOLD_OPERATOR.GT,
        threshold: 0,
        valueKind: OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER,
        unit: "count",
      },
      explanationTemplate:
        "Ranking upward movements observed: {value} in the selected window",
      cooldownPolicy: { durationMs: 86400000 },
      correlationGroup: "ranking_insight",
    },
    {
      ruleId: "insight.player.activity_trend",
      ruleVersion: "1.0.0",
      title: "Player activity trend",
      description: "Player activity increasing observation (I&A-08)",
      evaluationType: ALERT_EVALUATION_TYPE.TREND,
      severity: ALERT_SEVERITY.INFO,
      domain: OPERATIONAL_SIGNAL_DOMAIN.CUSTOMER_PLAYER,
      metricId: CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_ACTIVITIES_COUNT,
      metricVersion: METRIC_VERSION,
      condition: {
        expectedDirection: "increasing",
        minimumPeriods: 2,
        minimumCoverage: 0.5,
      },
      explanationTemplate:
        "Player activity increased compared with previous period",
      cooldownPolicy: { durationMs: 86400000 },
      correlationGroup: "customer_player_insight",
    },
    {
      ruleId: "insight.court.downtime_trend",
      ruleVersion: "1.0.0",
      title: "Court downtime trend",
      description: "Court downtime increasing observation (I&A-07)",
      evaluationType: ALERT_EVALUATION_TYPE.TREND,
      severity: ALERT_SEVERITY.INFO,
      domain: OPERATIONAL_SIGNAL_DOMAIN.VENUE_COURT,
      metricId: VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_DOWNTIME_RATE,
      metricVersion: METRIC_VERSION,
      condition: {
        expectedDirection: "increasing",
        minimumPeriods: 2,
        minimumCoverage: 0.5,
      },
      explanationTemplate:
        "Court downtime increased compared with previous period",
      cooldownPolicy: { durationMs: 86400000 },
      correlationGroup: "venue_court_insight",
    },
  ];

  return { alertRules, insightRules };
}

/**
 * @param {unknown[]} ruleInputs
 * @param {(input: unknown) => import("../contracts/result.js").Result} factory
 * @returns {import("../contracts/result.js").Result}
 */
function materializeRules(ruleInputs, factory) {
  /** @type {unknown[]} */
  const rules = [];
  /** @type {Map<string, string>} */
  const seen = new Map();
  for (let i = 0; i < ruleInputs.length; i += 1) {
    const created = factory(ruleInputs[i]);
    if (!created.ok) return created;
    const rule = created.value;
    const key = `${rule.ruleId}@${rule.ruleVersion}`;
    if (seen.has(rule.ruleId) && seen.get(rule.ruleId) !== rule.ruleVersion) {
      // same id different version is allowed; conflict is same id+version
    }
    if (seen.has(key)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_CONFLICT,
          `Duplicate rule registration for ${key}`,
          "ruleCatalog",
          { ruleId: rule.ruleId, ruleVersion: rule.ruleVersion }
        )
      );
    }
    seen.set(key, rule.ruleVersion);
    seen.set(rule.ruleId, rule.ruleVersion);
    rules.push(rule);
  }
  return ok(Object.freeze(rules));
}

/**
 * Create the immutable foundation catalog. Optional extra rules may be
 * supplied for certification of conflict handling.
 * @param {unknown} [input]
 * @returns {import("../contracts/result.js").Result}
 */
export function createOperationalAlertRuleCatalog(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "rule catalog input must be a plain object",
        "catalog"
      )
    );
  }

  const foundation = buildFoundationRuleInputs();
  const alertInputs = [
    ...foundation.alertRules,
    ...(Array.isArray(input.extraAlertRules) ? input.extraAlertRules : []),
  ];
  const insightInputs = [
    ...foundation.insightRules,
    ...(Array.isArray(input.extraInsightRules) ? input.extraInsightRules : []),
  ];

  const alertsResult = materializeRules(alertInputs, createOperationalAlertRule);
  if (!alertsResult.ok) return alertsResult;
  const insightsResult = materializeRules(
    insightInputs,
    createOperationalInsightRule
  );
  if (!insightsResult.ok) return insightsResult;

  /** @type {Map<string, unknown>} */
  const byId = new Map();
  for (const rule of [...alertsResult.value, ...insightsResult.value]) {
    const key = `${rule.ruleId}@${rule.ruleVersion}`;
    if (byId.has(key)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_CONFLICT,
          `Duplicate rule conflict for ${key}`,
          "ruleCatalog",
          { ruleId: rule.ruleId, ruleVersion: rule.ruleVersion }
        )
      );
    }
    byId.set(key, rule);
  }

  const catalog = deepFreeze({
    alertRules: alertsResult.value,
    insightRules: insightsResult.value,
    deferredRules: OPERATIONAL_ALERT_RULES_DEFERRED,
    size: alertsResult.value.length + insightsResult.value.length,
    getById(ruleId, ruleVersion) {
      return byId.get(`${ruleId}@${ruleVersion}`) || null;
    },
    list() {
      return Object.freeze([...alertsResult.value, ...insightsResult.value]);
    },
  });

  return ok(catalog);
}

/**
 * Returns a freshly constructed immutable foundation catalog.
 * No mutable global singleton service — each call builds from frozen rule inputs.
 * @returns {import("../contracts/result.js").Result}
 */
export function getFoundationOperationalAlertRuleCatalog() {
  return createOperationalAlertRuleCatalog();
}

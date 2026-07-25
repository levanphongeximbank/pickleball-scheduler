/**
 * I&A-10 — Operational Alerts and Insights public barrel.
 */

export {
  OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION,
  OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS,
  ALERT_SEVERITY,
  ALERT_SEVERITY_SEMANTICS,
  ALERT_LIFECYCLE_STATE,
  ALERT_EVALUATION_TYPE,
  ALERT_THRESHOLD_OPERATOR,
  OPERATIONAL_SIGNAL_DOMAIN,
  OPERATIONAL_SIGNAL_VALUE_KIND,
  MISSING_SIGNAL_POLICY,
  STALE_SIGNAL_POLICY,
  RESULT_KIND,
  isOperationalAlertsInsightsEnumValue,
} from "./enums.js";

export {
  FORBIDDEN_OPERATIONAL_ALERT_KEYS,
  rejectForbiddenOperationalAlertFields,
  sanitizeErrorMessage,
} from "./privacy.js";

export {
  createAlertEvaluationContext,
  createOperationalAlertsInsightsContext,
} from "./context.js";

export {
  createOperationalSignalIdentity,
  createOperationalSignal,
} from "./signals.js";

export {
  createAlertDeduplicationPolicy,
  createAlertCooldownPolicy,
  createAlertSuppressionPolicy,
  createAlertResolutionPolicy,
} from "./policies.js";

export {
  createAlertDeduplicationKey,
  createAlertCorrelationKey,
} from "./keys.js";

export {
  createAlertThresholdCondition,
  createAlertStateCondition,
  createAlertTrendCondition,
  createAlertFreshnessCondition,
  createAlertMissingDataCondition,
  createOperationalAlertRule,
  createOperationalInsightRule,
} from "./rules.js";

export {
  OPERATIONAL_ALERT_RULES_DEFERRED,
  createOperationalAlertRuleCatalog,
  getFoundationOperationalAlertRuleCatalog,
} from "./catalog.js";

export {
  evaluateThresholdCondition,
  evaluateStateCondition,
  evaluateTrendCondition,
  evaluateMissingDataCondition,
  evaluateFreshnessCondition,
} from "./evaluators.js";

export {
  createAlertEvidence,
  createOperationalAlert,
  createOperationalInsight,
  createAlertNotificationCandidate,
  renderExplanation,
} from "./results.js";

export { evaluateOperationalAlertsInsights } from "./evaluation.js";

export { createOperationalSignalsSnapshot } from "./snapshot.js";

export { guardOperationalSignalsSnapshot } from "./guards.js";

export {
  createOperationalSignalSourceRequest,
  createOperationalSignalSourceResponse,
  wrapOperationalAlertsSourceFailure,
  isOperationalSignalSourceAdapter,
} from "./sourceAdapter.js";

export { createInMemoryOperationalSignalsSource } from "./inMemorySource.js";

export {
  createOperationalAlertsInsightsQuery,
  normalizeOperationalAlertsInsightsQuery,
} from "./query.js";

export { composeOperationalAlertsInsightsDashboardPayloads } from "./dashboardPayloads.js";

export {
  createOperationalAlertsInsightsFacade,
  createReadOnlyOperationalAlertsInsightsFacade,
} from "./facade.js";

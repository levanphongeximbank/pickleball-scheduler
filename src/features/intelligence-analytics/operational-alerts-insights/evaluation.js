/**
 * Deterministic alert / insight evaluation orchestration (I&A-10).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import {
  deepFreeze,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  ALERT_EVALUATION_TYPE,
  ALERT_LIFECYCLE_STATE,
  MISSING_SIGNAL_POLICY,
  OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS,
  OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION,
  RESULT_KIND,
  STALE_SIGNAL_POLICY,
} from "./enums.js";
import {
  evaluateFreshnessCondition,
  evaluateMissingDataCondition,
  evaluateStateCondition,
  evaluateThresholdCondition,
  evaluateTrendCondition,
} from "./evaluators.js";
import {
  createAlertCorrelationKey,
  createAlertDeduplicationKey,
} from "./keys.js";
import {
  createAlertEvidence,
  createAlertNotificationCandidate,
  createOperationalAlert,
  createOperationalInsight,
  renderExplanation,
} from "./results.js";
import { getFoundationOperationalAlertRuleCatalog } from "./catalog.js";

/**
 * @param {unknown} signal
 * @param {unknown} rule
 * @returns {boolean}
 */
function signalMatchesRule(signal, rule) {
  if (!signal || !rule) return false;
  if (signal.metricId !== rule.metricId) return false;
  if (signal.metricVersion !== rule.metricVersion) return false;
  if (rule.signalId && signal.signalIdentity?.signalId !== rule.signalId) {
    // allow metric-id-as-signal-id default
    if (signal.signalIdentity?.signalId !== rule.metricId) return false;
  }
  if (signal.domain !== rule.domain) return false;
  return true;
}

/**
 * @param {unknown[]} signals
 * @param {unknown} rule
 * @returns {unknown | null}
 */
function findSignalForRule(signals, rule) {
  for (const signal of signals) {
    if (signalMatchesRule(signal, rule)) return signal;
  }
  return null;
}

/**
 * @param {unknown} priorAlerts
 * @param {string} deduplicationKey
 * @param {unknown} cooldownPolicy
 * @param {string} evaluatedAt
 * @param {string} tenantId
 * @param {unknown} entityScope
 * @returns {{ suppressed: boolean, reason?: string, prior?: unknown }}
 */
function evaluateCooldown(
  priorAlerts,
  deduplicationKey,
  cooldownPolicy,
  evaluatedAt,
  tenantId,
  entityScope
) {
  if (!Array.isArray(priorAlerts) || !cooldownPolicy) {
    return { suppressed: false };
  }
  const evaluatedMs = Date.parse(evaluatedAt);
  for (const prior of priorAlerts) {
    if (!isPlainObject(prior)) continue;
    if (prior.deduplicationKey !== deduplicationKey) continue;
    if (prior.tenantId !== tenantId) continue;
    const priorEntity = JSON.stringify(prior.entityScope || {});
    const currentEntity = JSON.stringify(entityScope || {});
    if (priorEntity !== currentEntity) continue;
    if (
      Array.isArray(cooldownPolicy.applicableStatuses) &&
      !cooldownPolicy.applicableStatuses.includes(prior.status)
    ) {
      continue;
    }
    const startAt =
      prior.evaluatedAt ||
      prior.sourceSnapshotTimestamp ||
      prior.occurredAt;
    if (!isValidIsoTimestamp(startAt)) continue;
    const elapsed = evaluatedMs - Date.parse(startAt);
    if (elapsed >= 0 && elapsed < cooldownPolicy.durationMs) {
      return {
        suppressed: true,
        reason: cooldownPolicy.suppressionReason || "cooldown_active",
        prior,
      };
    }
  }
  return { suppressed: false };
}

/**
 * @param {unknown} rule
 * @param {unknown} signal
 * @param {unknown} evaluation
 * @param {unknown} context
 * @param {{
 *   evaluatedAt: string,
 *   sourceTimestamp?: string,
 *   requestedTimeWindow?: unknown,
 *   priorAlerts?: unknown[],
 *   acknowledgements?: Record<string, unknown>,
 * }} options
 * @returns {import("../contracts/result.js").Result}
 */
function buildMatchedResult(rule, signal, evaluation, context, options) {
  const tenantId = context.tenantScope.tenantId;
  const entityScope = signal?.entityScope || {};
  const timeBucket =
    signal?.timeWindow?.startAt && signal?.timeWindow?.endAt
      ? `${signal.timeWindow.startAt}/${signal.timeWindow.endAt}`
      : "-";

  const conditionIdentity = [
    rule.evaluationType,
    evaluation.operator || evaluation.expectedDirection || evaluation.reason || "match",
    evaluation.threshold !== undefined
      ? String(
          isPlainObject(evaluation.threshold)
            ? evaluation.threshold.amountMinor
            : evaluation.threshold
        )
      : "",
  ].join(":");

  const dedupResult = createAlertDeduplicationKey({
    tenantId,
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    entityScope,
    signalId: rule.signalId,
    signalVersion: rule.signalVersion,
    metricId: rule.metricId,
    metricVersion: rule.metricVersion,
    timeBucket: rule.deduplicationPolicy?.includeTimeBucket ? timeBucket : "-",
    conditionIdentity: rule.deduplicationPolicy?.includeConditionIdentity
      ? conditionIdentity
      : "-",
  });
  if (!dedupResult.ok) return dedupResult;

  const corrResult = createAlertCorrelationKey({
    tenantId,
    domain: rule.domain,
    entityScope,
    metricId: rule.metricId,
    correlationGroup: rule.correlationGroup,
  });
  if (!corrResult.ok) return corrResult;

  const cooldown = evaluateCooldown(
    options.priorAlerts,
    dedupResult.value.deduplicationKey,
    rule.cooldownPolicy,
    options.evaluatedAt,
    tenantId,
    entityScope
  );

  /** @type {unknown[]} */
  const warnings = [];
  if (signal?.freshness === ANALYTICS_FRESHNESS_STATE.STALE) {
    const warning = createAnalyticsWarning({
      code: "STALE_SOURCE",
      message: "Source signal freshness is stale",
      field: "signal.freshness",
    });
    if (warning.ok) warnings.push(warning.value);
  }
  if (
    signal?.completeness === OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.PARTIAL ||
    signal?.completeness === OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.UNKNOWN
  ) {
    const warning = createAnalyticsWarning({
      code: "INCOMPLETE_SOURCE",
      message: "Source signal completeness is not complete",
      field: "signal.completeness",
    });
    if (warning.ok) warnings.push(warning.value);
  }
  if (evaluation.warningCode) {
    const warning = createAnalyticsWarning({
      code: evaluation.warningCode,
      message: String(evaluation.reason || evaluation.warningCode),
      field: "evaluation",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  const evidenceResult = createAlertEvidence({
    metricId: rule.metricId,
    metricVersion: rule.metricVersion,
    signalId: signal?.signalIdentity?.signalId || rule.signalId,
    signalVersion: signal?.signalIdentity?.signalVersion || rule.signalVersion,
    observedValue: evaluation.observedValue ?? signal?.value,
    observedState: evaluation.observedState ?? signal?.state,
    threshold: evaluation.threshold ?? rule.condition?.threshold,
    operator: evaluation.operator,
    trend: signal?.trend || evaluation,
    sourceTimestamp: signal?.sourceTimestamp || options.sourceTimestamp,
    freshness: signal?.freshness,
    completeness: signal?.completeness,
    evaluation,
  });
  if (!evidenceResult.ok) return evidenceResult;

  const explanation = renderExplanation(rule.explanationTemplate, {
    title: rule.title,
    metricId: rule.metricId,
    value: evaluation.observedValue ?? signal?.value ?? "",
    threshold: isPlainObject(rule.condition?.threshold)
      ? rule.condition.threshold.amountMinor
      : rule.condition?.threshold ?? "",
    sourceTimestamp: signal?.sourceTimestamp || options.sourceTimestamp || "",
  });

  let status = ALERT_LIFECYCLE_STATE.OPEN;
  /** @type {Record<string, unknown> | null} */
  let suppression = null;
  /** @type {Record<string, unknown> | null} */
  let acknowledgement = null;
  /** @type {Record<string, unknown> | null} */
  let resolution = null;
  /** @type {Record<string, unknown> | null} */
  let expiration = null;

  if (cooldown.suppressed) {
    status = ALERT_LIFECYCLE_STATE.SUPPRESSED;
    suppression = deepFreeze({
      suppressed: true,
      reason: cooldown.reason,
      policy: rule.cooldownPolicy,
      priorDeduplicationKey: dedupResult.value.deduplicationKey,
    });
  }

  const ackKey = dedupResult.value.deduplicationKey;
  if (
    options.acknowledgements &&
    isPlainObject(options.acknowledgements[ackKey])
  ) {
    // ACKNOWLEDGED only from explicit consumer input
    status =
      status === ALERT_LIFECYCLE_STATE.SUPPRESSED
        ? status
        : ALERT_LIFECYCLE_STATE.ACKNOWLEDGED;
    acknowledgement = deepFreeze({
      ...options.acknowledgements[ackKey],
      explicit: true,
    });
  }

  if (
    rule.resolutionPolicy?.resolveWhenConditionClears === true &&
    evaluation.matched === false &&
    evaluation.cleared === true
  ) {
    status = ALERT_LIFECYCLE_STATE.RESOLVED;
    resolution = deepFreeze({
      resolved: true,
      reason: "condition_cleared",
      explicitRule: true,
    });
  }

  if (
    rule.resolutionPolicy?.expireAfterMs != null &&
    isValidIsoTimestamp(signal?.observedAt || options.sourceTimestamp)
  ) {
    const start = Date.parse(signal?.observedAt || options.sourceTimestamp);
    const now = Date.parse(options.evaluatedAt);
    if (now - start >= rule.resolutionPolicy.expireAfterMs) {
      status = ALERT_LIFECYCLE_STATE.EXPIRED;
      expiration = deepFreeze({
        expired: true,
        reason: "expire_after_policy",
        expireAfterMs: rule.resolutionPolicy.expireAfterMs,
      });
    }
  }

  const stableId = `${rule.ruleId}:${dedupResult.value.deduplicationKey}`;

  if (rule.resultKind === RESULT_KIND.INSIGHT) {
    return createOperationalInsight({
      insightId: stableId,
      tenantId,
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      title: rule.title,
      summary: rule.description,
      explanation,
      severity: rule.severity,
      domain: rule.domain,
      metricId: rule.metricId,
      metricVersion: rule.metricVersion,
      signalId: rule.signalId,
      signalVersion: rule.signalVersion,
      entityScope,
      requestedTimeWindow: options.requestedTimeWindow,
      effectiveTimeWindow: signal?.timeWindow,
      evaluatedAt: options.evaluatedAt,
      sourceSnapshotTimestamp: signal?.sourceTimestamp || options.sourceTimestamp,
      evidence: evidenceResult.value,
      provenance: signal?.provenance,
      freshness: signal?.freshness,
      completeness: signal?.completeness,
      warnings,
    });
  }

  return createOperationalAlert({
    alertId: stableId,
    tenantId,
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    title: rule.title,
    summary: rule.description,
    explanation,
    severity: rule.severity,
    status,
    domain: rule.domain,
    metricId: rule.metricId,
    metricVersion: rule.metricVersion,
    signalId: rule.signalId,
    signalVersion: rule.signalVersion,
    entityScope,
    requestedTimeWindow: options.requestedTimeWindow,
    effectiveTimeWindow: signal?.timeWindow,
    evaluatedAt: options.evaluatedAt,
    sourceSnapshotTimestamp: signal?.sourceTimestamp || options.sourceTimestamp,
    deduplicationKey: dedupResult.value.deduplicationKey,
    correlationKey: corrResult.value.correlationKey,
    suppression,
    cooldown: rule.cooldownPolicy,
    acknowledgement,
    resolution,
    expiration,
    evidence: evidenceResult.value,
    provenance: signal?.provenance,
    freshness: signal?.freshness,
    completeness: signal?.completeness,
    warnings,
  });
}

/**
 * @param {unknown} rule
 * @param {unknown | null} signal
 * @returns {import("../contracts/result.js").Result}
 */
function runCondition(rule, signal) {
  const type = rule.evaluationType;
  if (
    type === ALERT_EVALUATION_TYPE.MISSING_DATA ||
    type === ALERT_EVALUATION_TYPE.SOURCE_FAILURE
  ) {
    return evaluateMissingDataCondition(signal, rule.condition);
  }
  if (type === ALERT_EVALUATION_TYPE.FRESHNESS) {
    if (!signal) {
      return ok(
        deepFreeze({
          matched: false,
          skipped: true,
          reason: "missing_signal",
          methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.FRESHNESS,
        })
      );
    }
    return evaluateFreshnessCondition(signal, rule.condition);
  }
  if (!signal) {
    return ok(
      deepFreeze({
        matched: false,
        skipped: true,
        reason: "missing_signal",
        missing: true,
      })
    );
  }
  if (type === ALERT_EVALUATION_TYPE.THRESHOLD) {
    return evaluateThresholdCondition(signal, rule.condition, rule);
  }
  if (type === ALERT_EVALUATION_TYPE.STATE) {
    return evaluateStateCondition(signal, rule.condition);
  }
  if (type === ALERT_EVALUATION_TYPE.TREND) {
    return evaluateTrendCondition(signal, rule.condition);
  }
  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
      `unsupported evaluation type ${type}`,
      "rule.evaluationType"
    )
  );
}

/**
 * Evaluate operational alerts and insights against an explicit signal
 * snapshot. Deterministic. Read-only.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateOperationalAlertsInsights(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID,
        "evaluateOperationalAlertsInsights requires a plain object",
        "evaluation"
      )
    );
  }

  const context = input.context;
  if (!isPlainObject(context) || !context.tenantScope?.tenantId) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "evaluation requires AlertEvaluationContext with tenantId",
        "context"
      )
    );
  }

  const snapshot = input.snapshot;
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SNAPSHOT_INVALID,
        "evaluation requires a signal snapshot",
        "snapshot"
      )
    );
  }

  const signals = Array.isArray(snapshot.signals) ? snapshot.signals : [];
  const evaluatedAt = isValidIsoTimestamp(input.evaluatedAt)
    ? String(input.evaluatedAt)
    : new Date().toISOString();

  let catalog = input.catalog;
  if (!catalog) {
    const catalogResult = getFoundationOperationalAlertRuleCatalog();
    if (!catalogResult.ok) return catalogResult;
    catalog = catalogResult.value;
  }

  const rules = catalog.list ? catalog.list() : [...(catalog.alertRules || []), ...(catalog.insightRules || [])];
  const enabledRuleIds = Array.isArray(input.ruleIds)
    ? new Set(input.ruleIds)
    : null;

  /** @type {unknown[]} */
  const alerts = [];
  /** @type {unknown[]} */
  const insights = [];
  /** @type {unknown[]} */
  const warnings = [];
  /** @type {unknown[]} */
  const notificationCandidates = [];

  for (const rule of rules) {
    if (!rule.enabledByDefault && !enabledRuleIds) continue;
    if (enabledRuleIds && !enabledRuleIds.has(rule.ruleId)) continue;

    const signal = findSignalForRule(signals, rule);

    // Metric version mismatch on candidate signals with same metricId
    for (const candidate of signals) {
      if (
        candidate.metricId === rule.metricId &&
        candidate.metricVersion !== rule.metricVersion
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_METRIC_VERSION_MISMATCH,
            "Signal metric version does not match rule metric version",
            "signal.metricVersion",
            {
              ruleMetricVersion: rule.metricVersion,
              signalMetricVersion: candidate.metricVersion,
              metricId: rule.metricId,
            }
          )
        );
      }
    }

    if (!signal) {
      if (
        rule.evaluationType === ALERT_EVALUATION_TYPE.MISSING_DATA ||
        rule.evaluationType === ALERT_EVALUATION_TYPE.SOURCE_FAILURE
      ) {
        // synthetic missing signal for data-quality rules keyed to operational.* metrics
        if (
          rule.domain === "data_quality" ||
          rule.metricId.startsWith("operational.")
        ) {
          const missingEval = evaluateMissingDataCondition(
            { missing: true },
            rule.condition
          );
          if (!missingEval.ok) return missingEval;
          if (missingEval.value.matched) {
            const built = buildMatchedResult(
              rule,
              {
                tenantId: context.tenantScope.tenantId,
                metricId: rule.metricId,
                metricVersion: rule.metricVersion,
                signalIdentity: {
                  signalId: rule.signalId,
                  signalVersion: rule.signalVersion,
                },
                domain: rule.domain,
                missing: true,
                entityScope: {},
                freshness: ANALYTICS_FRESHNESS_STATE.UNKNOWN,
                completeness: OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.UNKNOWN,
                provenance: snapshot.provenance,
                sourceTimestamp: snapshot.sourceTimestamp,
              },
              missingEval.value,
              context,
              {
                evaluatedAt,
                sourceTimestamp: snapshot.sourceTimestamp,
                requestedTimeWindow: input.timeWindow,
                priorAlerts: input.priorAlerts,
                acknowledgements: input.acknowledgements,
              }
            );
            if (!built.ok) return built;
            if (built.value.kind === RESULT_KIND.INSIGHT) insights.push(built.value);
            else {
              alerts.push(built.value);
              if (input.includeNotificationCandidates === true) {
                const candidate = createAlertNotificationCandidate(built.value);
                if (!candidate.ok) return candidate;
                notificationCandidates.push(candidate.value);
              }
            }
          }
        } else if (rule.missingDataPolicy === MISSING_SIGNAL_POLICY.ALERT) {
          const missingEval = evaluateMissingDataCondition(
            { missing: true },
            { alertOnMissing: true, neverFillZero: true }
          );
          if (!missingEval.ok) return missingEval;
          if (missingEval.value.matched) {
            const built = buildMatchedResult(
              rule,
              {
                tenantId: context.tenantScope.tenantId,
                metricId: rule.metricId,
                metricVersion: rule.metricVersion,
                signalIdentity: {
                  signalId: rule.signalId,
                  signalVersion: rule.signalVersion,
                },
                domain: rule.domain,
                missing: true,
                entityScope: {},
                freshness: ANALYTICS_FRESHNESS_STATE.UNKNOWN,
                completeness: OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.UNKNOWN,
                provenance: snapshot.provenance,
                sourceTimestamp: snapshot.sourceTimestamp,
              },
              missingEval.value,
              context,
              {
                evaluatedAt,
                sourceTimestamp: snapshot.sourceTimestamp,
                requestedTimeWindow: input.timeWindow,
                priorAlerts: input.priorAlerts,
                acknowledgements: input.acknowledgements,
              }
            );
            if (!built.ok) return built;
            alerts.push(built.value);
          }
        } else if (rule.missingDataPolicy === MISSING_SIGNAL_POLICY.WARN) {
          const warning = createAnalyticsWarning({
            code: "MISSING_SIGNAL",
            message: `Missing signal for rule ${rule.ruleId}`,
            field: rule.metricId,
          });
          if (warning.ok) warnings.push(warning.value);
        } else if (rule.missingDataPolicy === MISSING_SIGNAL_POLICY.FAIL) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
              `Required signal missing for rule ${rule.ruleId}`,
              rule.metricId
            )
          );
        }
      } else if (rule.missingDataPolicy === MISSING_SIGNAL_POLICY.WARN) {
        const warning = createAnalyticsWarning({
          code: "MISSING_SIGNAL",
          message: `Missing signal for rule ${rule.ruleId}`,
          field: rule.metricId,
        });
        if (warning.ok) warnings.push(warning.value);
      } else if (rule.missingDataPolicy === MISSING_SIGNAL_POLICY.FAIL) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
            `Required signal missing for rule ${rule.ruleId}`,
            rule.metricId
          )
        );
      }
      continue;
    }

    if (signal.freshness === ANALYTICS_FRESHNESS_STATE.STALE) {
      if (rule.staleDataPolicy === STALE_SIGNAL_POLICY.FAIL) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID,
            `Stale signal rejected for rule ${rule.ruleId}`,
            "signal.freshness"
          )
        );
      }
      if (rule.staleDataPolicy === STALE_SIGNAL_POLICY.WARN) {
        const warning = createAnalyticsWarning({
          code: "STALE_SIGNAL",
          message: `Stale signal for rule ${rule.ruleId}`,
          field: "signal.freshness",
        });
        if (warning.ok) warnings.push(warning.value);
      }
      if (
        rule.staleDataPolicy === STALE_SIGNAL_POLICY.SKIP &&
        rule.evaluationType !== ALERT_EVALUATION_TYPE.FRESHNESS
      ) {
        continue;
      }
    }

    const evaluation = runCondition(rule, signal);
    if (!evaluation.ok) return evaluation;

    if (evaluation.value.skipped && evaluation.value.warningCode) {
      const warning = createAnalyticsWarning({
        code: evaluation.value.warningCode,
        message: String(evaluation.value.reason || evaluation.value.warningCode),
        field: rule.ruleId,
      });
      if (warning.ok) warnings.push(warning.value);
    }

    if (!evaluation.value.matched) continue;

    const built = buildMatchedResult(rule, signal, evaluation.value, context, {
      evaluatedAt,
      sourceTimestamp: snapshot.sourceTimestamp,
      requestedTimeWindow: input.timeWindow,
      priorAlerts: input.priorAlerts,
      acknowledgements: input.acknowledgements,
    });
    if (!built.ok) return built;

    if (built.value.kind === RESULT_KIND.INSIGHT) {
      insights.push(built.value);
    } else {
      alerts.push(built.value);
      if (input.includeNotificationCandidates === true) {
        const candidate = createAlertNotificationCandidate(built.value);
        if (!candidate.ok) return candidate;
        notificationCandidates.push(candidate.value);
      }
    }
  }

  return ok(
    deepFreeze({
      context,
      alerts: Object.freeze(alerts),
      insights: Object.freeze(insights),
      warnings: Object.freeze(warnings),
      notificationCandidates: Object.freeze(notificationCandidates),
      evaluatedAt,
      sourceSnapshotTimestamp: snapshot.sourceTimestamp,
      provenance: snapshot.provenance,
      freshness: snapshot.freshness,
      completeness: snapshot.completeness,
      analyticalMethodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.EVALUATION,
      emptySignals: signals.length === 0,
      isCanonicalDomainState: false,
      isDeliveredNotification: false,
    })
  );
}

/**
 * Alert / insight result builders and notification-candidate contract
 * (I&A-10). Candidates never carry recipient/channel/delivery fields.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ALERT_LIFECYCLE_STATE,
  OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION,
  RESULT_KIND,
} from "./enums.js";
import { rejectForbiddenOperationalAlertFields } from "./privacy.js";

/**
 * @param {string} template
 * @param {Record<string, unknown>} vars
 * @returns {string}
 */
function renderTemplate(template, vars) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertEvidence(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID,
        "AlertEvidence must be a plain object",
        "evidence"
      )
    );
  }
  return ok(
    deepFreeze({
      metricId: input.metricId,
      metricVersion: input.metricVersion,
      signalId: input.signalId,
      signalVersion: input.signalVersion,
      observedValue: input.observedValue,
      observedState: input.observedState,
      threshold: input.threshold,
      operator: input.operator,
      trend: input.trend,
      sourceTimestamp: input.sourceTimestamp,
      freshness: input.freshness,
      completeness: input.completeness,
      evaluation: input.evaluation,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createOperationalAlert(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID,
        "OperationalAlert must be a plain object",
        "alert"
      )
    );
  }
  const privacyReject = rejectForbiddenOperationalAlertFields(input, "alert");
  if (privacyReject) return privacyReject;

  if (!isNonEmptyString(input.tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "alert requires tenantId",
        "alert.tenantId"
      )
    );
  }

  /** @type {unknown[]} */
  const warnings = [];
  if (Array.isArray(input.warnings)) {
    for (const warning of input.warnings) {
      const created = createAnalyticsWarning(warning);
      if (!created.ok) return created;
      warnings.push(created.value);
    }
  }

  return ok(
    deepFreeze({
      kind: RESULT_KIND.ALERT,
      alertId: input.alertId,
      tenantId: input.tenantId,
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
      title: input.title,
      summary: input.summary,
      explanation: input.explanation,
      severity: input.severity,
      status: input.status || ALERT_LIFECYCLE_STATE.OPEN,
      domain: input.domain,
      metricId: input.metricId,
      metricVersion: input.metricVersion,
      signalId: input.signalId,
      signalVersion: input.signalVersion,
      entityScope: input.entityScope || Object.freeze({}),
      requestedTimeWindow: input.requestedTimeWindow,
      effectiveTimeWindow: input.effectiveTimeWindow,
      evaluatedAt: input.evaluatedAt,
      sourceSnapshotTimestamp: input.sourceSnapshotTimestamp,
      deduplicationKey: input.deduplicationKey,
      correlationKey: input.correlationKey,
      suppression: input.suppression || null,
      cooldown: input.cooldown || null,
      acknowledgement: input.acknowledgement || null,
      resolution: input.resolution || null,
      expiration: input.expiration || null,
      evidence: input.evidence,
      provenance: input.provenance,
      freshness: input.freshness,
      completeness: input.completeness,
      warnings: Object.freeze(warnings),
      analyticalMethodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.EVALUATION,
      isCanonicalDomainState: false,
      isDeliveredNotification: false,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createOperationalInsight(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID,
        "OperationalInsight must be a plain object",
        "insight"
      )
    );
  }
  const privacyReject = rejectForbiddenOperationalAlertFields(input, "insight");
  if (privacyReject) return privacyReject;

  const explanation = String(input.explanation || "");
  if (/\bbecause\b/i.test(explanation)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID,
        "Insight explanation must not claim causality with 'because'",
        "insight.explanation"
      )
    );
  }

  return ok(
    deepFreeze({
      kind: RESULT_KIND.INSIGHT,
      insightId: input.insightId,
      tenantId: input.tenantId,
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
      title: input.title,
      summary: input.summary,
      explanation,
      severity: input.severity,
      domain: input.domain,
      metricId: input.metricId,
      metricVersion: input.metricVersion,
      signalId: input.signalId,
      signalVersion: input.signalVersion,
      entityScope: input.entityScope || Object.freeze({}),
      requestedTimeWindow: input.requestedTimeWindow,
      effectiveTimeWindow: input.effectiveTimeWindow,
      evaluatedAt: input.evaluatedAt,
      sourceSnapshotTimestamp: input.sourceSnapshotTimestamp,
      evidence: input.evidence,
      provenance: input.provenance,
      freshness: input.freshness,
      completeness: input.completeness,
      warnings: Object.freeze(input.warnings || []),
      analyticalMethodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.INSIGHT,
      isCanonicalDomainState: false,
      isDeliveredNotification: false,
    })
  );
}

/**
 * Future-safe notification candidate — transport-neutral, undelivered.
 * @param {unknown} alert
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertNotificationCandidate(alert) {
  if (!isPlainObject(alert)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID,
        "AlertNotificationCandidate requires an alert",
        "alert"
      )
    );
  }
  const privacyReject = rejectForbiddenOperationalAlertFields(alert, "alert");
  if (privacyReject) return privacyReject;

  const candidate = deepFreeze({
    alertId: alert.alertId,
    tenantId: alert.tenantId,
    severity: alert.severity,
    title: alert.title,
    summary: alert.summary,
    entityReferences: alert.entityScope || Object.freeze({}),
    deduplicationKey: alert.deduplicationKey,
    occurredAt: alert.sourceSnapshotTimestamp || alert.evaluatedAt,
    evaluatedAt: alert.evaluatedAt,
    provenance: alert.provenance,
    safePayloadMetadata: deepFreeze({
      ruleId: alert.ruleId,
      ruleVersion: alert.ruleVersion,
      metricId: alert.metricId,
      metricVersion: alert.metricVersion,
      domain: alert.domain,
      status: alert.status,
    }),
    isDeliveredNotification: false,
    deliveryCoupled: false,
  });

  const candidatePrivacy = rejectForbiddenOperationalAlertFields(
    candidate,
    "notificationCandidate"
  );
  if (candidatePrivacy) return candidatePrivacy;

  return ok(candidate);
}

/**
 * @param {string} template
 * @param {Record<string, unknown>} vars
 */
export function renderExplanation(template, vars) {
  return renderTemplate(template, vars);
}

/**
 * Privacy-safe projectors for historical, dashboard/report, and alert/insight (I&A-11).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";
import {
  ANALYTICS_ACCESS_DECISION,
  ANALYTICS_PRIVACY_PAYLOAD_STATE,
} from "./enums.js";
import { certifyTenantIsolation } from "./guards.js";
import {
  evaluateDimensionAccess,
  evaluateMetricAccess,
} from "./metricDimensionAccess.js";
import { evaluateSmallCohortSuppression } from "./suppressionRedaction.js";

/**
 * @param {unknown} accessContext
 * @param {unknown} historicalResult
 * @param {{ policy?: unknown, evaluatedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectHistoricalResultPrivacy(
  accessContext,
  historicalResult,
  options = {}
) {
  if (!isPlainObject(historicalResult)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "historicalResult must be a plain object",
        "historicalResult"
      )
    );
  }

  const series = Array.isArray(historicalResult.series)
    ? historicalResult.series
    : Array.isArray(historicalResult.points)
      ? historicalResult.points
      : [];

  const tenantCert = certifyTenantIsolation(accessContext, series, {
    surface: "historical",
  });
  if (!tenantCert.ok) return tenantCert;

  const groupDimensions = Array.isArray(historicalResult.groupBy)
    ? historicalResult.groupBy
    : [];
  /** @type {string[]} */
  const allowedDimensions = [];

  for (const dim of groupDimensions) {
    const dimRef = isPlainObject(dim)
      ? dim
      : { dimensionId: dim, classification: "PUBLIC" };
    const decision = evaluateDimensionAccess(accessContext, dimRef, options);
    if (!decision.ok) return decision;
    if (decision.value.decision === ANALYTICS_ACCESS_DECISION.ALLOW) {
      allowedDimensions.push(String(dimRef.dimensionId));
    }
  }

  const deniedGroupDimensions = groupDimensions
    .map((dim) => (isPlainObject(dim) ? dim.dimensionId : dim))
    .filter((id) => isNonEmptyString(id) && !allowedDimensions.includes(String(id)));

  /** @type {unknown[]} */
  const projectedBuckets = [];
  const policy = options.policy;

  for (const point of series) {
    if (!isPlainObject(point)) continue;

    let privacyState = ANALYTICS_PRIVACY_PAYLOAD_STATE.ALLOWED;
    /** @type {unknown} */
    let value = point.value;

    if (
      policy &&
      typeof point.eligibleCohortCount === "number"
    ) {
      const suppression = evaluateSmallCohortSuppression(
        accessContext,
        {
          eligibleCohortCount: point.eligibleCohortCount,
          metricId: point.metricId ?? historicalResult.metricId,
          classification: point.classification,
        },
        policy,
        options
      );
      if (!suppression.ok) return suppression;
      if (suppression.value.decision === ANALYTICS_ACCESS_DECISION.SUPPRESS) {
        privacyState = ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED;
        value = Object.freeze({
          state: ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED,
          isZero: false,
          // Raw count intentionally absent.
        });
      }
    }

    if (point.accessDecision === ANALYTICS_ACCESS_DECISION.DENY) {
      privacyState = ANALYTICS_PRIVACY_PAYLOAD_STATE.DENIED;
      value = Object.freeze({
        state: ANALYTICS_PRIVACY_PAYLOAD_STATE.DENIED,
        isEmpty: false,
      });
    }

    if (point.accessDecision === ANALYTICS_ACCESS_DECISION.REDACT) {
      privacyState = ANALYTICS_PRIVACY_PAYLOAD_STATE.REDACTED;
      value = Object.freeze({
        state: ANALYTICS_PRIVACY_PAYLOAD_STATE.REDACTED,
        isMissing: false,
        placeholder: "[REDACTED]",
      });
    }

    /** @type {Record<string, unknown>} */
    const bucket = {
      bucketStart: point.bucketStart ?? point.timestamp ?? null,
      privacyState,
      value,
    };

    if (isPlainObject(point.dimensions)) {
      /** @type {Record<string, unknown>} */
      const dims = {};
      for (const [key, dimValue] of Object.entries(point.dimensions)) {
        if (allowedDimensions.includes(key) || allowedDimensions.length === 0) {
          if (!deniedGroupDimensions.includes(key)) {
            dims[key] = dimValue;
          }
        }
      }
      bucket.dimensions = Object.freeze(dims);
    }

    projectedBuckets.push(Object.freeze(bucket));
  }

  return ok(
    deepFreeze({
      surface: "historical",
      privacyState:
        projectedBuckets.some(
          (b) =>
            /** @type {{ privacyState?: string }} */ (b).privacyState ===
            ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED
        )
          ? ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED
          : deniedGroupDimensions.length > 0
            ? ANALYTICS_PRIVACY_PAYLOAD_STATE.DENIED
            : ANALYTICS_PRIVACY_PAYLOAD_STATE.ALLOWED,
      buckets: Object.freeze(projectedBuckets),
      deniedGroupDimensions: Object.freeze(
        deniedGroupDimensions.map((id) => String(id))
      ),
      isCanonicalAuthorizationState: false,
    })
  );
}

/**
 * @param {unknown} accessContext
 * @param {unknown} dashboardPayload
 * @param {{ policy?: unknown, evaluatedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectDashboardReportPrivacy(
  accessContext,
  dashboardPayload,
  options = {}
) {
  if (!isPlainObject(dashboardPayload)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "dashboardPayload must be a plain object",
        "dashboardPayload"
      )
    );
  }

  const widgets = Array.isArray(dashboardPayload.widgets)
    ? dashboardPayload.widgets
    : [];

  const factLike = widgets
    .filter((w) => isPlainObject(w))
    .map((w) => ({
      tenantId: w.tenantId ?? dashboardPayload.tenantId,
      ...w,
    }));

  const tenantCert = certifyTenantIsolation(accessContext, factLike, {
    surface: "dashboard",
  });
  if (!tenantCert.ok) return tenantCert;

  /** @type {unknown[]} */
  const projectedWidgets = [];

  for (const widget of widgets) {
    if (!isPlainObject(widget)) continue;

    if (widget.metricId) {
      const metricDecision = evaluateMetricAccess(
        accessContext,
        {
          metricId: widget.metricId,
          metricVersion: widget.metricVersion,
          classification: widget.classification,
        },
        options
      );
      if (!metricDecision.ok) return metricDecision;

      if (metricDecision.value.decision === ANALYTICS_ACCESS_DECISION.DENY) {
        projectedWidgets.push(
          Object.freeze({
            widgetId: widget.widgetId ?? null,
            privacyState: ANALYTICS_PRIVACY_PAYLOAD_STATE.DENIED,
            dataState: ANALYTICS_PRIVACY_PAYLOAD_STATE.DENIED,
            isEmpty: false,
            value: null,
          })
        );
        continue;
      }
    }

    if (
      options.policy &&
      typeof widget.eligibleCohortCount === "number"
    ) {
      const suppression = evaluateSmallCohortSuppression(
        accessContext,
        {
          eligibleCohortCount: widget.eligibleCohortCount,
          metricId: widget.metricId,
          classification: widget.classification,
        },
        options.policy,
        options
      );
      if (!suppression.ok) return suppression;
      if (suppression.value.decision === ANALYTICS_ACCESS_DECISION.SUPPRESS) {
        projectedWidgets.push(
          Object.freeze({
            widgetId: widget.widgetId ?? null,
            privacyState: ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED,
            dataState: ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED,
            isZero: false,
            value: null,
          })
        );
        continue;
      }
    }

    if (widget.restricted === true || widget.accessDecision === "OMIT") {
      projectedWidgets.push(
        Object.freeze({
          widgetId: widget.widgetId ?? null,
          privacyState: ANALYTICS_PRIVACY_PAYLOAD_STATE.OMITTED,
          dataState: ANALYTICS_PRIVACY_PAYLOAD_STATE.OMITTED,
          handledExplicitly: true,
        })
      );
      continue;
    }

    projectedWidgets.push(
      Object.freeze({
        widgetId: widget.widgetId ?? null,
        privacyState: ANALYTICS_PRIVACY_PAYLOAD_STATE.ALLOWED,
        dataState: widget.dataState ?? ANALYTICS_PRIVACY_PAYLOAD_STATE.ALLOWED,
        value: widget.value ?? null,
        isEmpty: widget.isEmpty === true,
      })
    );
  }

  /** @type {Record<string, unknown>} */
  const exportMetadata = isPlainObject(dashboardPayload.exportMetadata)
    ? { ...dashboardPayload.exportMetadata }
    : {};

  if (exportMetadata.includeRestricted === true) {
    exportMetadata.includeRestricted = false;
    exportMetadata.accessPolicyRespected = true;
  } else {
    exportMetadata.accessPolicyRespected = true;
  }

  return ok(
    deepFreeze({
      surface: "dashboard",
      widgets: Object.freeze(projectedWidgets),
      exportMetadata: Object.freeze(exportMetadata),
      scheduleMetadata: Object.freeze(
        isPlainObject(dashboardPayload.scheduleMetadata)
          ? {
              ...dashboardPayload.scheduleMetadata,
              accessPolicyRespected: true,
            }
          : { accessPolicyRespected: true }
      ),
      isCanonicalAuthorizationState: false,
    })
  );
}

/**
 * @param {unknown} accessContext
 * @param {unknown} alertOrInsight
 * @param {{ policy?: unknown, evaluatedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectAlertInsightPrivacy(
  accessContext,
  alertOrInsight,
  options = {}
) {
  if (!isPlainObject(alertOrInsight)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "alertOrInsight must be a plain object",
        "alertOrInsight"
      )
    );
  }

  const facts = [
    {
      tenantId:
        alertOrInsight.tenantId ??
        alertOrInsight.sourceTenantId ??
        alertOrInsight.targetTenantId,
      ...alertOrInsight,
    },
  ];

  const tenantCert = certifyTenantIsolation(accessContext, facts, {
    surface: "alert-insight",
  });
  if (!tenantCert.ok) return tenantCert;

  if (alertOrInsight.metricId) {
    const metricDecision = evaluateMetricAccess(
      accessContext,
      {
        metricId: alertOrInsight.metricId,
        metricVersion: alertOrInsight.metricVersion,
        classification: alertOrInsight.classification,
      },
      options
    );
    if (!metricDecision.ok) return metricDecision;

    if (metricDecision.value.decision === ANALYTICS_ACCESS_DECISION.DENY) {
      return ok(
        deepFreeze({
          surface: "alert-insight",
          privacyState: ANALYTICS_PRIVACY_PAYLOAD_STATE.DENIED,
          success: false,
          insightCreated: false,
          evidence: Object.freeze({
            safe: true,
            reasonCode: metricDecision.value.reasonCode,
            // Raw metric values intentionally absent.
          }),
          isCanonicalAuthorizationState: false,
        })
      );
    }
  }

  if (
    options.policy &&
    typeof alertOrInsight.eligibleCohortCount === "number"
  ) {
    const suppression = evaluateSmallCohortSuppression(
      accessContext,
      {
        eligibleCohortCount: alertOrInsight.eligibleCohortCount,
        metricId: alertOrInsight.metricId,
        classification: alertOrInsight.classification,
      },
      options.policy,
      options
    );
    if (!suppression.ok) return suppression;
    if (suppression.value.decision === ANALYTICS_ACCESS_DECISION.SUPPRESS) {
      return ok(
        deepFreeze({
          surface: "alert-insight",
          privacyState: ANALYTICS_PRIVACY_PAYLOAD_STATE.SUPPRESSED,
          success: false,
          insightCreated: false,
          evidence: Object.freeze({
            safe: true,
            suppressed: true,
            // Threshold count intentionally absent.
          }),
          isCanonicalAuthorizationState: false,
        })
      );
    }
  }

  /** @type {Record<string, unknown>} */
  const safeEvidence = {};
  if (isPlainObject(alertOrInsight.evidence)) {
    for (const [key, value] of Object.entries(alertOrInsight.evidence)) {
      if (
        [
          "rawValue",
          "value",
          "email",
          "phone",
          "cardNumber",
          "cohortCount",
          "eligibleCount",
          "fact",
        ].includes(key)
      ) {
        continue;
      }
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        safeEvidence[key] = value;
      }
    }
  }

  return ok(
    deepFreeze({
      surface: "alert-insight",
      privacyState: ANALYTICS_PRIVACY_PAYLOAD_STATE.ALLOWED,
      success: true,
      insightCreated: alertOrInsight.kind === "insight" || alertOrInsight.insight === true,
      alertId: isNonEmptyString(alertOrInsight.alertId)
        ? String(alertOrInsight.alertId).trim()
        : null,
      severity: isNonEmptyString(alertOrInsight.severity)
        ? String(alertOrInsight.severity).trim()
        : null,
      evidence: Object.freeze(safeEvidence),
      isCanonicalAuthorizationState: false,
    })
  );
}

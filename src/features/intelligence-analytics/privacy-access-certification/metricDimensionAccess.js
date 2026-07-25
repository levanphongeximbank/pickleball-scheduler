/**
 * Metric and dimension access evaluators + discovery filter (I&A-11).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";
import {
  ANALYTICS_ACCESS_DECISION,
  ANALYTICS_DATA_CLASSIFICATION_RANK,
  ANALYTICS_PRIVACY_REASON_CODE,
} from "./enums.js";
import { validateDataClassification } from "./classification.js";
import { createAnalyticsAccessDecision } from "./policy.js";
import { requireTrustedAccessContext } from "./guards.js";

/**
 * @param {unknown} accessContext
 * @param {unknown} metricRef
 * @param {{ evaluatedAt?: string, privacyPolicy?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateMetricAccess(accessContext, metricRef, options = {}) {
  const tenantResult = requireTrustedAccessContext(accessContext);
  if (!tenantResult.ok) return tenantResult;

  if (!isPlainObject(metricRef) || !isNonEmptyString(metricRef.metricId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_METRIC_ACCESS_DENIED,
        "metricId is required",
        "metricRef.metricId"
      )
    );
  }

  if (metricRef.classification === undefined) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_UNKNOWN,
        "Unknown metric classification denied (fail closed)",
        "metricRef.classification",
        { reasonCode: "UNKNOWN_CLASSIFICATION", metricId: String(metricRef.metricId).trim() }
      )
    );
  }

  const classificationResult = validateDataClassification(metricRef.classification);
  if (!classificationResult.ok) return classificationResult;

  const metricId = String(metricRef.metricId).trim();
  const metricVersion = isNonEmptyString(metricRef.metricVersion)
    ? String(metricRef.metricVersion).trim()
    : undefined;
  const grants = Array.isArray(accessContext.metricGrants)
    ? accessContext.metricGrants
    : [];

  const matchingGrant = grants.find((grant) => {
    if (!isPlainObject(grant)) return false;
    if (grant.metricId !== metricId) return false;
    if (metricVersion !== undefined && grant.metricVersion !== undefined) {
      return grant.metricVersion === metricVersion;
    }
    if (metricVersion !== undefined && grant.metricVersion === undefined) {
      return true;
    }
    if (metricVersion === undefined && grant.metricVersion !== undefined) {
      return false;
    }
    return true;
  });

  const maxClassification =
    accessContext.maxClassification ?? classificationResult.value;
  const maxRank = ANALYTICS_DATA_CLASSIFICATION_RANK[maxClassification];
  const metricRank =
    ANALYTICS_DATA_CLASSIFICATION_RANK[classificationResult.value];

  const evaluatedAt =
    options.evaluatedAt ??
    accessContext.issuedAt ??
    new Date().toISOString();

  const policyRef =
    options.privacyPolicy ??
    accessContext.privacyPolicy ?? {
      policyId: "missing",
      policyVersion: "0.0.0",
    };

  if (!matchingGrant) {
    // PUBLIC may be allowed by matching maxClassification policy without explicit grant.
    if (
      classificationResult.value === "PUBLIC" &&
      metricRank <= maxRank
    ) {
      return createAnalyticsAccessDecision({
        decision: ANALYTICS_ACCESS_DECISION.ALLOW,
        privacyPolicy: policyRef,
        reasonCode: ANALYTICS_PRIVACY_REASON_CODE.METRIC_ALLOWED,
        evaluatedAt,
        tenantId: tenantResult.value,
        metricId,
        metricVersion,
        classification: classificationResult.value,
        evidence: { grantRequired: false, publicAllowed: true },
      });
    }

    return createAnalyticsAccessDecision({
      decision: ANALYTICS_ACCESS_DECISION.DENY,
      privacyPolicy: policyRef,
      reasonCode: ANALYTICS_PRIVACY_REASON_CODE.METRIC_DENIED_NO_GRANT,
      evaluatedAt,
      tenantId: tenantResult.value,
      metricId,
      metricVersion,
      classification: classificationResult.value,
      evidence: { grantRequired: true, grantFound: false },
      isEmpty: false,
    });
  }

  if (
    metricVersion !== undefined &&
    matchingGrant.metricVersion !== undefined &&
    matchingGrant.metricVersion !== metricVersion
  ) {
    return createAnalyticsAccessDecision({
      decision: ANALYTICS_ACCESS_DECISION.DENY,
      privacyPolicy: policyRef,
      reasonCode: ANALYTICS_PRIVACY_REASON_CODE.METRIC_VERSION_MISMATCH,
      evaluatedAt,
      tenantId: tenantResult.value,
      metricId,
      metricVersion,
      classification: classificationResult.value,
      evidence: { grantFound: true, versionMatched: false },
      isEmpty: false,
    });
  }

  if (metricRank > maxRank) {
    return createAnalyticsAccessDecision({
      decision: ANALYTICS_ACCESS_DECISION.DENY,
      privacyPolicy: policyRef,
      reasonCode: ANALYTICS_PRIVACY_REASON_CODE.ACCESS_DENIED,
      evaluatedAt,
      tenantId: tenantResult.value,
      metricId,
      metricVersion,
      classification: classificationResult.value,
      evidence: { exceedsMaxClassification: true },
      isEmpty: false,
    });
  }

  return createAnalyticsAccessDecision({
    decision: ANALYTICS_ACCESS_DECISION.ALLOW,
    privacyPolicy: policyRef,
    reasonCode: ANALYTICS_PRIVACY_REASON_CODE.METRIC_ALLOWED,
    evaluatedAt,
    tenantId: tenantResult.value,
    metricId,
    metricVersion,
    classification: classificationResult.value,
    evidence: { grantFound: true },
  });
}

/**
 * @param {unknown} accessContext
 * @param {unknown} dimensionRef
 * @param {{ evaluatedAt?: string, privacyPolicy?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateDimensionAccess(
  accessContext,
  dimensionRef,
  options = {}
) {
  const tenantResult = requireTrustedAccessContext(accessContext);
  if (!tenantResult.ok) return tenantResult;

  if (
    !isPlainObject(dimensionRef) ||
    !isNonEmptyString(dimensionRef.dimensionId)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_DIMENSION_ACCESS_DENIED,
        "dimensionId is required",
        "dimensionRef.dimensionId"
      )
    );
  }

  if (dimensionRef.classification === undefined) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_UNKNOWN,
        "Unknown dimension classification denied (fail closed)",
        "dimensionRef.classification",
        {
          reasonCode: "UNKNOWN_CLASSIFICATION",
          dimensionId: String(dimensionRef.dimensionId).trim(),
        }
      )
    );
  }

  const classificationResult = validateDataClassification(
    dimensionRef.classification
  );
  if (!classificationResult.ok) return classificationResult;

  const dimensionId = String(dimensionRef.dimensionId).trim();
  const grants = Array.isArray(accessContext.dimensionGrants)
    ? accessContext.dimensionGrants
    : [];
  const matchingGrant = grants.find(
    (grant) => isPlainObject(grant) && grant.dimensionId === dimensionId
  );

  const evaluatedAt =
    options.evaluatedAt ??
    accessContext.issuedAt ??
    new Date().toISOString();
  const policyRef =
    options.privacyPolicy ??
    accessContext.privacyPolicy ?? {
      policyId: "missing",
      policyVersion: "0.0.0",
    };

  const maxClassification =
    accessContext.maxClassification ?? classificationResult.value;
  const maxRank = ANALYTICS_DATA_CLASSIFICATION_RANK[maxClassification];
  const dimensionRank =
    ANALYTICS_DATA_CLASSIFICATION_RANK[classificationResult.value];

  // Dimension access is independent of metric grants.
  if (!matchingGrant) {
    if (
      classificationResult.value === "PUBLIC" &&
      dimensionRank <= maxRank
    ) {
      return createAnalyticsAccessDecision({
        decision: ANALYTICS_ACCESS_DECISION.ALLOW,
        privacyPolicy: policyRef,
        reasonCode: ANALYTICS_PRIVACY_REASON_CODE.DIMENSION_ALLOWED,
        evaluatedAt,
        tenantId: tenantResult.value,
        dimensionId,
        classification: classificationResult.value,
        evidence: { grantRequired: false },
      });
    }

    return createAnalyticsAccessDecision({
      decision: ANALYTICS_ACCESS_DECISION.DENY,
      privacyPolicy: policyRef,
      reasonCode: ANALYTICS_PRIVACY_REASON_CODE.DIMENSION_DENIED,
      evaluatedAt,
      tenantId: tenantResult.value,
      dimensionId,
      classification: classificationResult.value,
      evidence: { grantFound: false, independentOfMetric: true },
      isEmpty: false,
    });
  }

  if (dimensionRank > maxRank) {
    return createAnalyticsAccessDecision({
      decision: ANALYTICS_ACCESS_DECISION.DENY,
      privacyPolicy: policyRef,
      reasonCode: ANALYTICS_PRIVACY_REASON_CODE.DIMENSION_DENIED,
      evaluatedAt,
      tenantId: tenantResult.value,
      dimensionId,
      classification: classificationResult.value,
      evidence: { exceedsMaxClassification: true },
      isEmpty: false,
    });
  }

  return createAnalyticsAccessDecision({
    decision: ANALYTICS_ACCESS_DECISION.ALLOW,
    privacyPolicy: policyRef,
    reasonCode: ANALYTICS_PRIVACY_REASON_CODE.DIMENSION_ALLOWED,
    evaluatedAt,
    tenantId: tenantResult.value,
    dimensionId,
    classification: classificationResult.value,
    evidence: { grantFound: true },
  });
}

/**
 * Filter metric discovery — denied/restricted metrics are omitted.
 * @param {unknown} accessContext
 * @param {unknown} metricDefinitions
 * @param {{ evaluatedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function filterMetricDiscovery(
  accessContext,
  metricDefinitions,
  options = {}
) {
  const tenantResult = requireTrustedAccessContext(accessContext);
  if (!tenantResult.ok) return tenantResult;

  if (!Array.isArray(metricDefinitions)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "metricDefinitions must be an array",
        "metricDefinitions"
      )
    );
  }

  /** @type {unknown[]} */
  const visible = [];
  /** @type {unknown[]} */
  const decisions = [];

  for (const def of metricDefinitions) {
    const decisionResult = evaluateMetricAccess(accessContext, def, options);
    if (!decisionResult.ok) return decisionResult;
    decisions.push(decisionResult.value);
    if (decisionResult.value.decision === ANALYTICS_ACCESS_DECISION.ALLOW) {
      visible.push(
        deepFreeze({
          metricId: def.metricId,
          ...(def.metricVersion !== undefined
            ? { metricVersion: def.metricVersion }
            : {}),
          ...(def.classification !== undefined
            ? { classification: def.classification }
            : {}),
          ...(def.lifecycleState !== undefined
            ? { lifecycleState: def.lifecycleState }
            : {}),
        })
      );
    }
  }

  return ok(
    deepFreeze({
      metrics: Object.freeze(visible),
      decisions: Object.freeze(decisions),
      hiddenCount: metricDefinitions.length - visible.length,
    })
  );
}

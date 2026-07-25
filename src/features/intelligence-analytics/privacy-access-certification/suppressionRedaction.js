/**
 * Small-cohort suppression, redaction, and omission evaluators (I&A-11).
 * Deterministic. No differential privacy / noise. No zero substitution.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isFiniteNumber,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ANALYTICS_ACCESS_DECISION,
  ANALYTICS_PRIVACY_REASON_CODE,
} from "./enums.js";
import { createAnalyticsAccessDecision, createAnalyticsPrivacyPolicy } from "./policy.js";
import { requireTrustedAccessContext } from "./guards.js";

/**
 * @param {unknown} accessContext
 * @param {unknown} cohortInput
 * @param {unknown} policyInput
 * @param {{ evaluatedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateSmallCohortSuppression(
  accessContext,
  cohortInput,
  policyInput,
  options = {}
) {
  const tenantResult = requireTrustedAccessContext(accessContext);
  if (!tenantResult.ok) return tenantResult;

  const policyResult = createAnalyticsPrivacyPolicy(
    policyInput ?? accessContext.privacyPolicy
  );
  if (!policyResult.ok) return policyResult;
  const policy = policyResult.value;

  if (policy.smallCohortThreshold === undefined) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
        "smallCohortThreshold must come from an explicit trusted policy",
        "privacyPolicy.smallCohortThreshold"
      )
    );
  }

  if (!isPlainObject(cohortInput)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "cohortInput must be a plain object",
        "cohortInput"
      )
    );
  }

  if (
    !isFiniteNumber(cohortInput.eligibleCohortCount) ||
    !Number.isInteger(cohortInput.eligibleCohortCount) ||
    cohortInput.eligibleCohortCount < 0
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "eligibleCohortCount must be a non-negative integer",
        "cohortInput.eligibleCohortCount"
      )
    );
  }

  const eligibleCohortCount = cohortInput.eligibleCohortCount;
  const threshold = policy.smallCohortThreshold;
  const evaluatedAt =
    options.evaluatedAt ??
    accessContext.issuedAt ??
    new Date().toISOString();

  const shouldSuppress =
    policy.suppressBelowThreshold === true && eligibleCohortCount < threshold;

  // Equal threshold is allowed (deterministic boundary).
  if (shouldSuppress) {
    return createAnalyticsAccessDecision({
      decision: ANALYTICS_ACCESS_DECISION.SUPPRESS,
      privacyPolicy: policy,
      reasonCode: ANALYTICS_PRIVACY_REASON_CODE.SMALL_COHORT_SUPPRESSED,
      evaluatedAt,
      tenantId: tenantResult.value,
      metricId: cohortInput.metricId,
      classification: cohortInput.classification,
      evidence: {
        // Never leak raw eligible count or threshold value as sensitive payload.
        thresholdPolicyId: policy.policyId,
        thresholdPolicyVersion: policy.policyVersion,
        thresholdConfigured: true,
        belowThreshold: true,
        equalThreshold: false,
      },
      isZero: false,
      warnings: [
        {
          code: ANALYTICS_ERROR_CODE.PRIVACY_SUPPRESSION_APPLIED,
          message: "Small cohort suppressed by policy; value is not zero",
        },
      ],
    });
  }

  return createAnalyticsAccessDecision({
    decision: ANALYTICS_ACCESS_DECISION.ALLOW,
    privacyPolicy: policy,
    reasonCode: ANALYTICS_PRIVACY_REASON_CODE.COHORT_ALLOWED,
    evaluatedAt,
    tenantId: tenantResult.value,
    metricId: cohortInput.metricId,
    classification: cohortInput.classification,
    evidence: {
      thresholdPolicyId: policy.policyId,
      thresholdPolicyVersion: policy.policyVersion,
      thresholdConfigured: true,
      belowThreshold: false,
      equalThreshold: eligibleCohortCount === threshold,
      // Safe boolean only — raw count not exposed in evidence.
      countAvailableForCaller: true,
    },
    isZero: false,
  });
}

/**
 * @param {unknown} accessContext
 * @param {unknown} payload
 * @param {unknown} policyInput
 * @param {{ evaluatedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateRedactionAndOmission(
  accessContext,
  payload,
  policyInput,
  options = {}
) {
  const tenantResult = requireTrustedAccessContext(accessContext);
  if (!tenantResult.ok) return tenantResult;

  const policyResult = createAnalyticsPrivacyPolicy(
    policyInput ?? accessContext.privacyPolicy
  );
  if (!policyResult.ok) return policyResult;
  const policy = policyResult.value;

  if (!isPlainObject(payload)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "payload must be a plain object",
        "payload"
      )
    );
  }

  const evaluatedAt =
    options.evaluatedAt ??
    accessContext.issuedAt ??
    new Date().toISOString();

  /** @type {Record<string, unknown>} */
  const projected = {};
  /** @type {unknown[]} */
  const decisions = [];

  for (const [key, value] of Object.entries(payload)) {
    if (policy.omitFields.includes(key)) {
      const decisionResult = createAnalyticsAccessDecision({
        decision: ANALYTICS_ACCESS_DECISION.OMIT,
        privacyPolicy: policy,
        reasonCode: ANALYTICS_PRIVACY_REASON_CODE.OMISSION_APPLIED,
        evaluatedAt,
        tenantId: tenantResult.value,
        field: key,
        evidence: { fieldOmitted: true, shapePreserved: false },
      });
      if (!decisionResult.ok) return decisionResult;
      decisions.push(decisionResult.value);
      // OMIT: field absent — do not write key.
      continue;
    }

    if (policy.redactFields.includes(key)) {
      const decisionResult = createAnalyticsAccessDecision({
        decision: ANALYTICS_ACCESS_DECISION.REDACT,
        privacyPolicy: policy,
        reasonCode: ANALYTICS_PRIVACY_REASON_CODE.REDACTION_APPLIED,
        evaluatedAt,
        tenantId: tenantResult.value,
        field: key,
        evidence: {
          fieldRedacted: true,
          placeholder: policy.redactionPlaceholder,
          originalExposed: false,
        },
        isMissing: false,
      });
      if (!decisionResult.ok) return decisionResult;
      decisions.push(decisionResult.value);

      if (policy.preservePayloadShape) {
        projected[key] = policy.redactionPlaceholder;
      }
      continue;
    }

    projected[key] = value;
  }

  return ok(
    deepFreeze({
      payload: Object.freeze(projected),
      decisions: Object.freeze(decisions),
      provenance: Object.freeze({
        evaluator: "ia-11-redaction-omission",
        policyId: policy.policyId,
        policyVersion: policy.policyVersion,
        evaluatedAt,
      }),
    })
  );
}

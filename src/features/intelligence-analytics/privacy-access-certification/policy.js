/**
 * Privacy policy contracts and access-decision builders (I&A-11).
 * Decisions never embed raw sensitive values in evidence.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  ANALYTICS_ACCESS_DECISION,
  ANALYTICS_PRIVACY_REASON_CODE,
  isPrivacyEnumValue,
} from "./enums.js";
import { validateDataClassification } from "./classification.js";
import { createAnalyticsPrivacyPolicyReference } from "./accessContext.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsPrivacyPolicy(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
        "PrivacyPolicy must be a plain object",
        "privacyPolicy"
      )
    );
  }

  const refResult = createAnalyticsPrivacyPolicyReference(input);
  if (!refResult.ok) return refResult;

  /** @type {Record<string, unknown>} */
  const policy = {
    ...refResult.value,
  };

  if (input.smallCohortThreshold !== undefined) {
    if (
      !isFiniteNumber(input.smallCohortThreshold) ||
      !Number.isInteger(input.smallCohortThreshold) ||
      input.smallCohortThreshold < 0
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "smallCohortThreshold must be a non-negative integer",
          "privacyPolicy.smallCohortThreshold"
        )
      );
    }
    policy.smallCohortThreshold = input.smallCohortThreshold;
  }

  if (input.suppressBelowThreshold !== undefined) {
    if (typeof input.suppressBelowThreshold !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "suppressBelowThreshold must be a boolean",
          "privacyPolicy.suppressBelowThreshold"
        )
      );
    }
    policy.suppressBelowThreshold = input.suppressBelowThreshold;
  } else if (policy.smallCohortThreshold !== undefined) {
    policy.suppressBelowThreshold = true;
  }

  if (input.redactFields !== undefined) {
    if (
      !Array.isArray(input.redactFields) ||
      !input.redactFields.every(isNonEmptyString)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "redactFields must be an array of non-empty strings",
          "privacyPolicy.redactFields"
        )
      );
    }
    policy.redactFields = Object.freeze(
      input.redactFields.map((f) => String(f).trim())
    );
  } else {
    policy.redactFields = Object.freeze([]);
  }

  if (input.omitFields !== undefined) {
    if (
      !Array.isArray(input.omitFields) ||
      !input.omitFields.every(isNonEmptyString)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "omitFields must be an array of non-empty strings",
          "privacyPolicy.omitFields"
        )
      );
    }
    policy.omitFields = Object.freeze(
      input.omitFields.map((f) => String(f).trim())
    );
  } else {
    policy.omitFields = Object.freeze([]);
  }

  if (input.redactionPlaceholder !== undefined) {
    if (!isNonEmptyString(input.redactionPlaceholder)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "redactionPlaceholder must be a non-empty string when provided",
          "privacyPolicy.redactionPlaceholder"
        )
      );
    }
    const placeholder = String(input.redactionPlaceholder).trim();
    if (/\d{4,}|@|\+?\d{6,}/.test(placeholder)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "redactionPlaceholder must not contain PII-like fragments",
          "privacyPolicy.redactionPlaceholder"
        )
      );
    }
    policy.redactionPlaceholder = placeholder;
  } else {
    policy.redactionPlaceholder = "[REDACTED]";
  }

  if (input.preservePayloadShape !== undefined) {
    if (typeof input.preservePayloadShape !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "preservePayloadShape must be a boolean",
          "privacyPolicy.preservePayloadShape"
        )
      );
    }
    policy.preservePayloadShape = input.preservePayloadShape;
  } else {
    policy.preservePayloadShape = true;
  }

  if (input.allowOpaqueTenantIdsInErrors !== undefined) {
    if (typeof input.allowOpaqueTenantIdsInErrors !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "allowOpaqueTenantIdsInErrors must be a boolean",
          "privacyPolicy.allowOpaqueTenantIdsInErrors"
        )
      );
    }
    policy.allowOpaqueTenantIdsInErrors = input.allowOpaqueTenantIdsInErrors;
  } else {
    policy.allowOpaqueTenantIdsInErrors = true;
  }

  return ok(deepFreeze(policy));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsAccessDecision(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "AccessDecision must be a plain object",
        "accessDecision"
      )
    );
  }

  if (!isPrivacyEnumValue(input.decision, ANALYTICS_ACCESS_DECISION)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "decision must be ALLOW|DENY|REDACT|OMIT|SUPPRESS",
        "accessDecision.decision"
      )
    );
  }

  const policyResult = createAnalyticsPrivacyPolicyReference(
    input.privacyPolicy ?? input.policyReference ?? {}
  );
  if (!policyResult.ok) return policyResult;

  if (!isNonEmptyString(input.reasonCode)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "reasonCode is required",
        "accessDecision.reasonCode"
      )
    );
  }

  if (!isValidIsoTimestamp(input.evaluatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "evaluatedAt must be a valid ISO timestamp",
        "accessDecision.evaluatedAt"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const decision = {
    decision: input.decision,
    privacyPolicy: policyResult.value,
    reasonCode: String(input.reasonCode).trim(),
    evaluatedAt: String(input.evaluatedAt).trim(),
    provenance: Object.freeze({
      evaluator: "ia-11-privacy-access-certification",
      methodVersion: "1.0.0",
      ...(isPlainObject(input.provenance) ? input.provenance : {}),
    }),
    warnings: Object.freeze(
      Array.isArray(input.warnings)
        ? input.warnings
            .filter((w) => isPlainObject(w))
            .map((w) =>
              Object.freeze({
                code: String(w.code ?? "PRIVACY_WARNING"),
                message: String(w.message ?? "privacy warning"),
              })
            )
        : []
    ),
    evidence: Object.freeze({
      // Privacy-safe evidence only — never raw sensitive values.
      ...(isPlainObject(input.evidence)
        ? Object.fromEntries(
            Object.entries(input.evidence).filter(
              ([key]) =>
                ![
                  "rawValue",
                  "originalValue",
                  "value",
                  "email",
                  "phone",
                  "cardNumber",
                  "fact",
                  "rawFact",
                  "cohortCount",
                  "eligibleCount",
                ].includes(key)
            )
          )
        : {}),
    }),
    isEmpty: input.decision === ANALYTICS_ACCESS_DECISION.DENY ? false : Boolean(input.isEmpty),
    isZero: input.decision === ANALYTICS_ACCESS_DECISION.SUPPRESS ? false : Boolean(input.isZero),
    isMissing: input.decision === ANALYTICS_ACCESS_DECISION.REDACT ? false : Boolean(input.isMissing),
  };

  if (input.tenantId !== undefined && isNonEmptyString(input.tenantId)) {
    decision.tenantScope = Object.freeze({
      tenantId: String(input.tenantId).trim(),
    });
  }

  if (isPlainObject(input.entityScope)) {
    decision.entityScope = deepFreeze({ ...input.entityScope });
  }

  if (input.metricId !== undefined && isNonEmptyString(input.metricId)) {
    decision.metricReference = Object.freeze({
      metricId: String(input.metricId).trim(),
      ...(isNonEmptyString(input.metricVersion)
        ? { metricVersion: String(input.metricVersion).trim() }
        : {}),
    });
  }

  if (input.dimensionId !== undefined && isNonEmptyString(input.dimensionId)) {
    decision.dimensionReference = Object.freeze({
      dimensionId: String(input.dimensionId).trim(),
      ...(isNonEmptyString(input.dimensionVersion)
        ? { dimensionVersion: String(input.dimensionVersion).trim() }
        : {}),
    });
  }

  if (input.classification !== undefined) {
    const classificationResult = validateDataClassification(input.classification);
    if (!classificationResult.ok) return classificationResult;
    decision.classification = classificationResult.value;
  }

  if (input.field !== undefined && isNonEmptyString(input.field)) {
    decision.field = String(input.field).trim();
  }

  return ok(deepFreeze(decision));
}

export { ANALYTICS_PRIVACY_REASON_CODE };

/**
 * Read-only privacy / access certification facade (I&A-11).
 * No write methods. No global singleton. No auth/RBAC mutation.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createAnalyticsPrivacyAccessContext } from "./accessContext.js";
import { createAnalyticsPrivacyPolicy } from "./policy.js";
import {
  certifyEntityIsolation,
  certifyTenantIsolation,
  requireTrustedAccessContext,
} from "./guards.js";
import {
  evaluateDimensionAccess,
  evaluateMetricAccess,
  filterMetricDiscovery,
} from "./metricDimensionAccess.js";
import {
  evaluateRedactionAndOmission,
  evaluateSmallCohortSuppression,
} from "./suppressionRedaction.js";
import { sanitizePrivacySafeError } from "./errorSanitizer.js";
import {
  projectAlertInsightPrivacy,
  projectDashboardReportPrivacy,
  projectHistoricalResultPrivacy,
} from "./projectors.js";
import {
  createPrivacyCertificationReport,
  runPrivacyCertificationSuite,
} from "./certification.js";
import { resolveMostRestrictiveClassification } from "./classification.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyPrivacyAccessCertificationFacade does not expose write/command operations";

/**
 * @param {unknown} [deps]
 * @returns {import("../contracts/result.js").Result}
 */
export function createPrivacyAccessCertificationFacade(deps = {}) {
  if (!isPlainObject(deps)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "createPrivacyAccessCertificationFacade requires a dependencies object",
        "deps"
      )
    );
  }

  const policySource =
    isPlainObject(deps.policySource) && typeof deps.policySource.load === "function"
      ? deps.policySource
      : null;

  /**
   * Validate-only — never invokes policy source.
   * @param {unknown} accessContextInput
   */
  function validateAccessContext(accessContextInput) {
    return createAnalyticsPrivacyAccessContext(accessContextInput);
  }

  /**
   * @param {unknown} policyInput
   */
  function validatePolicy(policyInput) {
    return createAnalyticsPrivacyPolicy(policyInput);
  }

  /**
   * @param {unknown} request
   */
  function loadPolicy(request) {
    if (!policySource) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_SOURCE_FAILURE,
          "No policy source configured",
          "policySource"
        )
      );
    }
    try {
      return policySource.load(request);
    } catch {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_SOURCE_FAILURE,
          "Privacy policy source failure",
          "policySource",
          { reasonCode: "POLICY_SOURCE_FAILURE" }
        )
      );
    }
  }

  /**
   * Invalid requests must not invoke the source.
   * @param {unknown} accessContextInput
   * @param {unknown} request
   */
  function certifyWithPolicy(accessContextInput, request) {
    const contextResult = createAnalyticsPrivacyAccessContext(accessContextInput);
    if (!contextResult.ok) {
      // Do not invoke source on invalid context.
      return contextResult;
    }

    if (!isPlainObject(request)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
          "certify request must be a plain object",
          "request"
        )
      );
    }

    let policy = request.policy;
    if (!policy && policySource) {
      const loaded = loadPolicy({
        policyId: contextResult.value.privacyPolicy.policyId,
        policyVersion: contextResult.value.privacyPolicy.policyVersion,
      });
      if (!loaded.ok) return loaded;
      policy = loaded.value;
    }

    const kind = request.kind;
    switch (kind) {
      case "tenant":
        return certifyTenantIsolation(
          contextResult.value,
          request.facts,
          { surface: request.surface }
        );
      case "entity":
        return certifyEntityIsolation(
          contextResult.value,
          request.requiredScope,
          request.facts,
          {
            surface: request.surface,
            allowAggregate: request.allowAggregate === true,
          }
        );
      case "metric":
        return evaluateMetricAccess(contextResult.value, request.metricRef, {
          privacyPolicy: policy,
          evaluatedAt: request.evaluatedAt,
        });
      case "dimension":
        return evaluateDimensionAccess(
          contextResult.value,
          request.dimensionRef,
          { privacyPolicy: policy, evaluatedAt: request.evaluatedAt }
        );
      case "discovery":
        return filterMetricDiscovery(
          contextResult.value,
          request.metricDefinitions,
          { evaluatedAt: request.evaluatedAt }
        );
      case "suppression":
        return evaluateSmallCohortSuppression(
          contextResult.value,
          request.cohortInput,
          policy,
          { evaluatedAt: request.evaluatedAt }
        );
      case "redaction":
        return evaluateRedactionAndOmission(
          contextResult.value,
          request.payload,
          policy,
          { evaluatedAt: request.evaluatedAt }
        );
      case "historical":
        return projectHistoricalResultPrivacy(
          contextResult.value,
          request.historicalResult,
          { policy, evaluatedAt: request.evaluatedAt }
        );
      case "dashboard":
        return projectDashboardReportPrivacy(
          contextResult.value,
          request.dashboardPayload,
          { policy, evaluatedAt: request.evaluatedAt }
        );
      case "alert":
        return projectAlertInsightPrivacy(
          contextResult.value,
          request.alertOrInsight,
          { policy, evaluatedAt: request.evaluatedAt }
        );
      case "classification":
        return resolveMostRestrictiveClassification(request.classifications);
      case "sanitizeError":
        return sanitizePrivacySafeError(request.error, request.options);
      case "suite":
        return runPrivacyCertificationSuite(request.suiteInput);
      case "report":
        return createPrivacyCertificationReport(request.reportInput);
      default:
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
            "Unknown certification kind",
            "request.kind"
          )
        );
    }
  }

  const facade = {
    validateAccessContext,
    validatePolicy,
    loadPolicy,
    certify: certifyWithPolicy,
    certifyTenantIsolation: (accessContext, facts, options) => {
      const required = requireTrustedAccessContext(accessContext);
      if (!required.ok) return required;
      return certifyTenantIsolation(accessContext, facts, options);
    },
    certifyEntityIsolation: (accessContext, requiredScope, facts, options) => {
      const required = requireTrustedAccessContext(accessContext);
      if (!required.ok) return required;
      return certifyEntityIsolation(
        accessContext,
        requiredScope,
        facts,
        options
      );
    },
    evaluateMetricAccess,
    evaluateDimensionAccess,
    filterMetricDiscovery,
    evaluateSmallCohortSuppression,
    evaluateRedactionAndOmission,
    projectHistoricalResultPrivacy,
    projectDashboardReportPrivacy,
    projectAlertInsightPrivacy,
    sanitizePrivacySafeError,
    runPrivacyCertificationSuite,
    createPrivacyCertificationReport,
    resolveMostRestrictiveClassification,
  };

  // Explicit rejected write surface (non-enumerable getters).
  const writeNames = [
    "write",
    "save",
    "update",
    "delete",
    "assignRole",
    "grantPermission",
    "mutateMembership",
    "persist",
  ];

  for (const name of writeNames) {
    Object.defineProperty(facade, name, {
      enumerable: false,
      configurable: false,
      get() {
        return () =>
          fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.PRIVACY_FACADE_WRITE_REJECTED,
              WRITE_REJECT_MESSAGE,
              name
            )
          );
      },
    });
  }

  return ok(deepFreeze(facade));
}

/**
 * Alias — facade is always read-only.
 * @param {unknown} [deps]
 * @returns {import("../contracts/result.js").Result}
 */
export function createReadOnlyPrivacyAccessCertificationFacade(deps) {
  return createPrivacyAccessCertificationFacade(deps);
}

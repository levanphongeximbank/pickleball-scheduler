/**
 * Read-only Intelligence & Analytics final certification facade (I&A-13).
 * No write / mutate / deploy / approve / merge / remediate / shell / network.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import {
  buildDefaultIntelligenceAnalyticsCertificationManifest,
  createIntelligenceAnalyticsCertificationManifest,
} from "./manifest.js";
import { listCanonicalCertifiedSurfaces } from "./surfaces.js";
import { listCanonicalCertificationDimensions } from "./dimensions.js";
import {
  createIntelligenceAnalyticsCertificationEvidence,
  createIntelligenceAnalyticsCertificationResult,
  createIntelligenceAnalyticsCertificationScenario,
  createIntelligenceAnalyticsFinalReport,
} from "./contracts.js";
import {
  runIntelligenceAnalyticsFinalCertification,
  verifyIntelligenceAnalyticsClosureReadiness,
} from "./runner.js";
import { createInMemoryIntelligenceAnalyticsCertificationSource } from "./inMemorySource.js";
import {
  verifyAiReadinessBoundary,
  verifyContractCompatibility,
  verifyCurrencyCompatibility,
  verifyDocumentationAndCi,
  verifyEntityIsolation,
  verifyErrorRegistryIntegrity,
  verifyMetricRegistryIntegrity,
  verifyMockHonestyAndSourceStates,
  verifyOperationalInsightCompatibility,
  verifyPrivacyAccess,
  verifyPublicExportIntegrity,
  verifyRankingRatingCompatibility,
  verifyReadOnlyAndDependencyBoundaries,
  verifyTenantIsolation,
} from "./verifiers.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyIntelligenceAnalyticsFinalCertificationFacade does not expose write/deploy/approve operations";

/**
 * @param {unknown} [deps]
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceAnalyticsFinalCertificationFacade(deps = {}) {
  if (!isPlainObject(deps)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "createIntelligenceAnalyticsFinalCertificationFacade requires a dependencies object",
        "deps"
      )
    );
  }

  const source =
    isPlainObject(deps.source) && typeof deps.source.load === "function"
      ? deps.source
      : null;

  /** @type {unknown} */
  let lastReport = null;

  function getManifest(overrides) {
    if (overrides === undefined) {
      return buildDefaultIntelligenceAnalyticsCertificationManifest({
        sourceCommit: deps.sourceCommit,
      });
    }
    return createIntelligenceAnalyticsCertificationManifest(overrides);
  }

  function listCertifiedSurfaces() {
    return ok(listCanonicalCertifiedSurfaces());
  }

  function listCertificationDimensions() {
    return ok(listCanonicalCertificationDimensions());
  }

  /**
   * Invalid requests must not invoke source.
   * @param {unknown} request
   */
  function runCertification(request) {
    if (!isPlainObject(request)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
          "runCertification request must be a plain object",
          "request"
        )
      );
    }

    const payload = { ...request };
    if (!payload.inventory && source) {
      payload.loadInventory = () => source.load();
    }

    const result = runIntelligenceAnalyticsFinalCertification(payload);
    if (result.ok) {
      lastReport = result.value;
    }
    return result;
  }

  function getCertificationReport() {
    if (!lastReport) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
          "No certification report available — runCertification first",
          "report"
        )
      );
    }
    return ok(lastReport);
  }

  function getBlockingFailures() {
    const reportResult = getCertificationReport();
    if (!reportResult.ok) return reportResult;
    return ok(
      deepFreeze(
        Array.isArray(reportResult.value.blockingFailures)
          ? reportResult.value.blockingFailures
          : []
      )
    );
  }

  function getWarnings() {
    const reportResult = getCertificationReport();
    if (!reportResult.ok) return reportResult;
    return ok(
      deepFreeze(
        Array.isArray(reportResult.value.warnings)
          ? reportResult.value.warnings
          : []
      )
    );
  }

  function verifyClosureReadiness(report) {
    if (report !== undefined) {
      return verifyIntelligenceAnalyticsClosureReadiness(report);
    }
    const reportResult = getCertificationReport();
    if (!reportResult.ok) return reportResult;
    return verifyIntelligenceAnalyticsClosureReadiness(reportResult.value);
  }

  const facade = {
    getManifest,
    listCertifiedSurfaces,
    listCertificationDimensions,
    runCertification,
    getCertificationReport,
    getBlockingFailures,
    getWarnings,
    verifyClosureReadiness,
    createManifest: createIntelligenceAnalyticsCertificationManifest,
    createScenario: createIntelligenceAnalyticsCertificationScenario,
    createEvidence: createIntelligenceAnalyticsCertificationEvidence,
    createResult: createIntelligenceAnalyticsCertificationResult,
    createFinalReport: createIntelligenceAnalyticsFinalReport,
    verifyPublicExportIntegrity,
    verifyMetricRegistryIntegrity,
    verifyErrorRegistryIntegrity,
    verifyTenantIsolation,
    verifyEntityIsolation,
    verifyPrivacyAccess,
    verifyCurrencyCompatibility,
    verifyRankingRatingCompatibility,
    verifyOperationalInsightCompatibility,
    verifyAiReadinessBoundary,
    verifyReadOnlyAndDependencyBoundaries,
    verifyMockHonestyAndSourceStates,
    verifyDocumentationAndCi,
    verifyContractCompatibility,
  };

  const writeNames = [
    "write",
    "mutate",
    "deploy",
    "approve",
    "merge",
    "remediate",
    "executeShell",
    "accessNetwork",
    "save",
    "update",
    "delete",
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
              ANALYTICS_ERROR_CODE.INTEGRATION_FACADE_WRITE_REJECTED,
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
export function createReadOnlyIntelligenceAnalyticsFinalCertificationFacade(
  deps
) {
  return createIntelligenceAnalyticsFinalCertificationFacade(deps);
}

export { createInMemoryIntelligenceAnalyticsCertificationSource };

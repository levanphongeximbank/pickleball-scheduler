/**
 * Deterministic final certification runner (I&A-13).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  ANALYTICS_CERTIFICATION_DIMENSION_ID,
  ANALYTICS_CERTIFICATION_SEVERITY,
  ANALYTICS_CERTIFICATION_STATUS,
  CERTIFICATION_VERSION,
} from "./enums.js";
import {
  createIntelligenceAnalyticsCertificationEvidence,
  createIntelligenceAnalyticsFinalReport,
} from "./contracts.js";
import {
  buildDefaultIntelligenceAnalyticsCertificationManifest,
} from "./manifest.js";
import { listCanonicalCertificationDimensions } from "./dimensions.js";
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
  wrapCertificationSourceFailure,
} from "./verifiers.js";

/**
 * @typedef {{ status: string, reasonCode: string, warning?: boolean, severity?: string, safeDetails?: Record<string, unknown> }} VerifyOutcome
 */

/**
 * @param {string} dimensionId
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
function runDimensionVerifier(dimensionId, inventory) {
  switch (dimensionId) {
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.CONTRACT_INTEGRITY:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.QUERY_RUNTIME_COMPATIBILITY:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.HISTORICAL_COMPATIBILITY:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.DASHBOARD_REPORT_COMPATIBILITY:
      return verifyContractCompatibility(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.PUBLIC_EXPORT_INTEGRITY:
      return verifyPublicExportIntegrity(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.METRIC_REGISTRY_INTEGRITY:
      return verifyMetricRegistryIntegrity(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.ERROR_REGISTRY_INTEGRITY:
      return verifyErrorRegistryIntegrity(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.TENANT_ISOLATION:
      return verifyTenantIsolation(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.ENTITY_ISOLATION:
      return verifyEntityIsolation(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.PRIVACY_ACCESS:
      return verifyPrivacyAccess(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.CURRENCY_COMPATIBILITY:
      return verifyCurrencyCompatibility(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.RANKING_RATING_COMPATIBILITY:
      return verifyRankingRatingCompatibility(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.OPERATIONAL_INSIGHT_COMPATIBILITY:
      return verifyOperationalInsightCompatibility(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.AI_READINESS_BOUNDARY:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.NO_PROVIDER_NETWORK_COUPLING:
      return verifyAiReadinessBoundary(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.READ_ONLY_GUARANTEE:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.NO_WRITE_GUARANTEE:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.NO_PRIVATE_IMPORT:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.NO_DATABASE_COUPLING:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.NO_SECRET_OR_PII_LEAKAGE:
      return verifyReadOnlyAndDependencyBoundaries(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.CI_REGISTRATION:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.OWNERSHIP_LOCK:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.DOCUMENTATION_COMPLETENESS:
      return verifyDocumentationAndCi(inventory);
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.REPRODUCIBILITY:
    case ANALYTICS_CERTIFICATION_DIMENSION_ID.FINAL_SCOPE_INTEGRITY:
      return verifyMockHonestyAndSourceStates(inventory);
    default:
      return {
        status: ANALYTICS_CERTIFICATION_STATUS.NOT_APPLICABLE,
        reasonCode: "CERTIFICATION_NOT_APPLICABLE",
        severity: ANALYTICS_CERTIFICATION_SEVERITY.INFO,
        safeDetails: { dimensionId },
      };
  }
}

/**
 * Build scenario evidence for a dimension using inventory scenario overrides.
 * @param {Readonly<Record<string, unknown>>} dimension
 * @param {Record<string, unknown>} inventory
 * @param {string} evaluatedAt
 * @returns {import("../contracts/result.js").Result}
 */
function buildDimensionEvidence(dimension, inventory, evaluatedAt) {
  /** @type {unknown[]} */
  const evidence = [];
  const scenarios = Array.isArray(dimension.certificationScenarios)
    ? dimension.certificationScenarios
    : [];

  const dimensionInventory = isPlainObject(inventory.byDimension)
    ? inventory.byDimension[/** @type {string} */ (dimension.dimensionId)] ||
      inventory
    : inventory;

  const scenarioOverrides = isPlainObject(inventory.scenarioOutcomes)
    ? inventory.scenarioOutcomes
    : {};

  const baseOutcome = runDimensionVerifier(
    /** @type {string} */ (dimension.dimensionId),
    dimensionInventory
  );

  for (const scenarioKey of scenarios) {
    const override = scenarioOverrides[scenarioKey];
    /** @type {VerifyOutcome} */
    let scenarioOutcome = baseOutcome;
    if (isPlainObject(override)) {
      scenarioOutcome = {
        status: isNonEmptyString(override.status)
          ? String(override.status)
          : baseOutcome.status,
        reasonCode: isNonEmptyString(override.reasonCode)
          ? String(override.reasonCode)
          : baseOutcome.reasonCode,
        warning: override.warning === true,
        severity: isNonEmptyString(override.severity)
          ? String(override.severity)
          : baseOutcome.severity || ANALYTICS_CERTIFICATION_SEVERITY.BLOCKER,
        safeDetails: isPlainObject(override.safeDetails)
          ? override.safeDetails
          : baseOutcome.safeDetails,
      };
    } else if (
      isPlainObject(dimensionInventory.scenarioFlags) &&
      dimensionInventory.scenarioFlags[scenarioKey] === false
    ) {
      scenarioOutcome = {
        status: ANALYTICS_CERTIFICATION_STATUS.FAIL,
        reasonCode: "CERTIFICATION_FAILED",
        severity: ANALYTICS_CERTIFICATION_SEVERITY.BLOCKER,
        safeDetails: { scenarioKey },
      };
    }

    const evidenceResult = createIntelligenceAnalyticsCertificationEvidence({
      scenarioId: `${dimension.dimensionId}:${scenarioKey}`,
      dimensionId: dimension.dimensionId,
      status: scenarioOutcome.status,
      evaluatedAt,
      reasonCode: scenarioOutcome.reasonCode,
      severity: scenarioOutcome.severity,
      warning: scenarioOutcome.warning === true,
      safeDetails: {
        scenarioKey,
        ...(scenarioOutcome.safeDetails || {}),
      },
    });
    if (!evidenceResult.ok) return evidenceResult;
    evidence.push(evidenceResult.value);
  }

  return ok(evidence);
}

/**
 * Run full certification against an inventory snapshot.
 * @param {unknown} request
 * @returns {import("../contracts/result.js").Result}
 */
export function runIntelligenceAnalyticsFinalCertification(request) {
  if (!isPlainObject(request)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "Certification request must be a plain object",
        "request"
      )
    );
  }

  if (!isNonEmptyString(request.reportId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "reportId is required",
        "request.reportId"
      )
    );
  }

  if (!isValidIsoTimestamp(request.generatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "generatedAt must be a valid ISO timestamp",
        "request.generatedAt"
      )
    );
  }

  // Invalid requests must not invoke source.
  let inventory = request.inventory;
  if (!inventory && typeof request.loadInventory === "function") {
    try {
      const loaded = request.loadInventory();
      if (isPlainObject(loaded) && loaded.ok === false) {
        return wrapCertificationSourceFailure(loaded.error);
      }
      inventory =
        isPlainObject(loaded) && loaded.ok === true ? loaded.value : loaded;
    } catch (error) {
      return wrapCertificationSourceFailure(error);
    }
  }

  if (!isPlainObject(inventory)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "inventory is required after validation",
        "request.inventory"
      )
    );
  }

  const manifestResult = isPlainObject(request.manifest)
    ? ok(deepFreeze(request.manifest))
    : buildDefaultIntelligenceAnalyticsCertificationManifest({
        generatedAt: request.generatedAt,
        sourceCommit: request.sourceCommit,
      });
  if (!manifestResult.ok) return manifestResult;
  const manifest = manifestResult.value;

  const dimensions = Array.isArray(request.dimensions)
    ? request.dimensions
    : listCanonicalCertificationDimensions();

  /** @type {unknown[]} */
  const allEvidence = [];
  /** @type {unknown[]} */
  const dimensionResults = [];

  for (const dimension of dimensions) {
    if (!isPlainObject(dimension) || !isNonEmptyString(dimension.dimensionId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTEGRATION_DIMENSION_INVALID,
          "Invalid dimension in certification run",
          "dimensions"
        )
      );
    }

    const evidenceResult = buildDimensionEvidence(
      dimension,
      inventory,
      String(request.generatedAt)
    );
    if (!evidenceResult.ok) return evidenceResult;
    const evidence = evidenceResult.value;
    allEvidence.push(...evidence);

    const warningCount = evidence.filter(
      (e) => /** @type {{ warning: boolean }} */ (e).warning === true
    ).length;
    const hasFail = evidence.some(
      (e) =>
        /** @type {{ status: string, severity: string }} */ (e).status ===
          ANALYTICS_CERTIFICATION_STATUS.FAIL &&
        /** @type {{ severity: string }} */ (e).severity ===
          ANALYTICS_CERTIFICATION_SEVERITY.BLOCKER
    );
    const hasBlocked = evidence.some(
      (e) =>
        /** @type {{ status: string }} */ (e).status ===
        ANALYTICS_CERTIFICATION_STATUS.BLOCKED
    );
    const allNa = evidence.every(
      (e) =>
        /** @type {{ status: string }} */ (e).status ===
        ANALYTICS_CERTIFICATION_STATUS.NOT_APPLICABLE
    );

    // Non-blocking warnings do not fail the dimension.
    let status = ANALYTICS_CERTIFICATION_STATUS.PASS;
    if (allNa) status = ANALYTICS_CERTIFICATION_STATUS.NOT_APPLICABLE;
    else if (hasBlocked) status = ANALYTICS_CERTIFICATION_STATUS.BLOCKED;
    else if (hasFail) status = ANALYTICS_CERTIFICATION_STATUS.FAIL;

    dimensionResults.push({
      dimensionId: dimension.dimensionId,
      status,
      warningCount,
      evidenceIds: evidence.map(
        (e) => /** @type {{ scenarioId: string }} */ (e).scenarioId
      ),
    });
  }

  return createIntelligenceAnalyticsFinalReport({
    reportId: String(request.reportId).trim(),
    generatedAt: String(request.generatedAt).trim(),
    manifestId: manifest.manifestId,
    manifestVersion: manifest.manifestVersion,
    certificationVersion: CERTIFICATION_VERSION,
    sourceCommit: isNonEmptyString(request.sourceCommit)
      ? String(request.sourceCommit).trim()
      : manifest.sourceCommit,
    evidence: allEvidence,
    dimensionResults,
    provenance: {
      workstreamId: "I&A-13",
      isCertificationOnly: true,
    },
  });
}

/**
 * Closure readiness evaluator.
 * @param {unknown} report
 * @returns {import("../contracts/result.js").Result}
 */
export function verifyIntelligenceAnalyticsClosureReadiness(report) {
  if (!isPlainObject(report)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "report must be a plain object",
        "report"
      )
    );
  }

  const blocking = Array.isArray(report.blockingFailures)
    ? report.blockingFailures
    : [];
  const overallStatus = String(report.overallStatus || "");
  const closureReady =
    blocking.length === 0 &&
    overallStatus === ANALYTICS_CERTIFICATION_STATUS.PASS &&
    report.closureReady === true;

  return ok(
    deepFreeze({
      closureReady,
      overallStatus,
      blockingFailureCount: blocking.length,
      reasonCode: closureReady
        ? "CERTIFICATION_PASSED"
        : "CLOSURE_BLOCKED",
      isProductionReadyClaim: false,
      intelligenceAnalyticsStructuralFoundationClosed: closureReady,
    })
  );
}

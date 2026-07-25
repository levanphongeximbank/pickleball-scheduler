/**
 * Canonical certified-surface registry for I&A-01..13.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ANALYTICS_SURFACE_CLASSIFICATION,
  CERTIFICATION_VERSION,
} from "./enums.js";

/** @type {ReadonlyArray<Readonly<Record<string, unknown>>>} */
export const CANONICAL_CERTIFIED_SURFACES = Object.freeze([
  Object.freeze({
    surfaceId: "I&A-01",
    version: "1.0.0",
    name: "Canonical Analytics Contracts Foundation",
    modulePath: "src/features/intelligence-analytics/contracts",
    testFile: "tests/intelligence-analytics-ia-01-foundation.test.js",
    docsPath: "docs/intelligence-analytics/ia-01/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_FOUNDATION",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CANONICAL_AND_STABLE,
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-02",
    version: "1.0.0",
    name: "Metric Registry and Definition Governance",
    modulePath: "src/features/intelligence-analytics/registry",
    testFile: "tests/intelligence-analytics-ia-02-metric-registry.test.js",
    docsPath: "docs/intelligence-analytics/ia-02/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_METRIC_REGISTRY",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-03",
    version: "1.0.0",
    name: "Analytics Query and Projection Runtime",
    modulePath: "src/features/intelligence-analytics/runtime",
    testFile: "tests/intelligence-analytics-ia-03-query-projection-runtime.test.js",
    docsPath: "docs/intelligence-analytics/ia-03/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_QUERY_RUNTIME",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
      ANALYTICS_SURFACE_CLASSIFICATION.MOCK_OR_CERTIFICATION_ONLY,
      ANALYTICS_SURFACE_CLASSIFICATION.DEFERRED_PRODUCTION_ADAPTER,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-04",
    version: "1.0.0",
    name: "Dashboard and Reporting Data Contracts",
    modulePath: "src/features/intelligence-analytics/dashboard-reporting",
    testFile: "tests/intelligence-analytics-ia-04-dashboard-reporting-contracts.test.js",
    docsPath: "docs/intelligence-analytics/ia-04/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-05",
    version: "1.0.0",
    name: "Historical and Trend Analysis",
    modulePath: "src/features/intelligence-analytics/historical-trend",
    testFile: "tests/intelligence-analytics-ia-05-historical-trend-analysis.test.js",
    docsPath: "docs/intelligence-analytics/ia-05/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_HISTORICAL_TREND",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
      ANALYTICS_SURFACE_CLASSIFICATION.MOCK_OR_CERTIFICATION_ONLY,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-06",
    version: "1.0.0",
    name: "Competition Analytics",
    modulePath: "src/features/intelligence-analytics/competition-analytics",
    testFile: "tests/intelligence-analytics-ia-06-competition-analytics.test.js",
    docsPath: "docs/intelligence-analytics/ia-06/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
      ANALYTICS_SURFACE_CLASSIFICATION.MOCK_OR_CERTIFICATION_ONLY,
      ANALYTICS_SURFACE_CLASSIFICATION.DEFERRED_PRODUCTION_ADAPTER,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-07",
    version: "1.0.0",
    name: "Venue, Court and Club Analytics",
    modulePath: "src/features/intelligence-analytics/venue-court-club-analytics",
    testFile: "tests/intelligence-analytics-ia-07-venue-court-club-analytics.test.js",
    docsPath: "docs/intelligence-analytics/ia-07/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_VENUE_COURT_CLUB_ANALYTICS",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
      ANALYTICS_SURFACE_CLASSIFICATION.MOCK_OR_CERTIFICATION_ONLY,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-08",
    version: "1.0.0",
    name: "Customer and Player Analytics",
    modulePath: "src/features/intelligence-analytics/customer-player-analytics",
    testFile: "tests/intelligence-analytics-ia-08-customer-player-analytics.test.js",
    docsPath: "docs/intelligence-analytics/ia-08/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_CUSTOMER_PLAYER_ANALYTICS",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
      ANALYTICS_SURFACE_CLASSIFICATION.PRIVACY_SENSITIVE,
      ANALYTICS_SURFACE_CLASSIFICATION.MOCK_OR_CERTIFICATION_ONLY,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-09",
    version: "1.0.0",
    name: "Finance, Ranking and Performance Analytics",
    modulePath:
      "src/features/intelligence-analytics/finance-ranking-performance-analytics",
    testFile:
      "tests/intelligence-analytics-ia-09-finance-ranking-performance-analytics.test.js",
    docsPath: "docs/intelligence-analytics/ia-09/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_FINANCE_RANKING_PERFORMANCE_ANALYTICS",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
      ANALYTICS_SURFACE_CLASSIFICATION.FINANCIAL_SENSITIVE,
      ANALYTICS_SURFACE_CLASSIFICATION.MOCK_OR_CERTIFICATION_ONLY,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-10",
    version: "1.0.0",
    name: "Operational Alerts and Insights",
    modulePath: "src/features/intelligence-analytics/operational-alerts-insights",
    testFile: "tests/intelligence-analytics-ia-10-operational-alerts-insights.test.js",
    docsPath: "docs/intelligence-analytics/ia-10/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_OPERATIONAL_ALERTS_INSIGHTS",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
      ANALYTICS_SURFACE_CLASSIFICATION.MOCK_OR_CERTIFICATION_ONLY,
      ANALYTICS_SURFACE_CLASSIFICATION.DEFERRED_PRODUCTION_ADAPTER,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-11",
    version: "1.0.0",
    name: "Privacy, Tenant Isolation and Access Certification",
    modulePath: "src/features/intelligence-analytics/privacy-access-certification",
    testFile:
      "tests/intelligence-analytics-ia-11-privacy-tenant-isolation-access-certification.test.js",
    docsPath: "docs/intelligence-analytics/ia-11/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_PRIVACY_ACCESS_CERTIFICATION",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
      ANALYTICS_SURFACE_CLASSIFICATION.PRIVACY_SENSITIVE,
      ANALYTICS_SURFACE_CLASSIFICATION.MOCK_OR_CERTIFICATION_ONLY,
      ANALYTICS_SURFACE_CLASSIFICATION.DEFERRED_PRODUCTION_ADAPTER,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-12",
    version: "1.0.0",
    name: "AI and Advanced Intelligence Readiness",
    modulePath:
      "src/features/intelligence-analytics/ai-advanced-intelligence-readiness",
    testFile:
      "tests/intelligence-analytics-ia-12-ai-advanced-intelligence-readiness.test.js",
    docsPath: "docs/intelligence-analytics/ia-12/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport: "INTELLIGENCE_ANALYTICS_AI_ADVANCED_INTELLIGENCE_READINESS",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
      ANALYTICS_SURFACE_CLASSIFICATION.MOCK_OR_CERTIFICATION_ONLY,
      ANALYTICS_SURFACE_CLASSIFICATION.DEFERRED_PRODUCTION_ADAPTER,
    ]),
  }),
  Object.freeze({
    surfaceId: "I&A-13",
    version: CERTIFICATION_VERSION,
    name: "Integration Hardening and Final Certification",
    modulePath:
      "src/features/intelligence-analytics/integration-hardening-final-certification",
    testFile:
      "tests/intelligence-analytics-ia-13-integration-hardening-final-certification.test.js",
    docsPath: "docs/intelligence-analytics/ia-13/00_ARCHITECTURE_AND_CERTIFICATION.md",
    markerExport:
      "INTELLIGENCE_ANALYTICS_INTEGRATION_HARDENING_FINAL_CERTIFICATION",
    classifications: Object.freeze([
      ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED,
      ANALYTICS_SURFACE_CLASSIFICATION.MOCK_OR_CERTIFICATION_ONLY,
    ]),
  }),
]);

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceAnalyticsCertifiedSurface(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_SURFACE_INVALID,
        "CertifiedSurface must be a plain object",
        "surface"
      )
    );
  }

  if (!isNonEmptyString(input.surfaceId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_SURFACE_INVALID,
        "surfaceId is required",
        "surface.surfaceId"
      )
    );
  }

  if (!isNonEmptyString(input.version)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_SURFACE_INVALID,
        "version is required",
        "surface.version"
      )
    );
  }

  if (!isNonEmptyString(input.name)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_SURFACE_INVALID,
        "name is required",
        "surface.name"
      )
    );
  }

  return ok(
    deepFreeze({
      surfaceId: String(input.surfaceId).trim(),
      version: String(input.version).trim(),
      name: String(input.name).trim(),
      modulePath: isNonEmptyString(input.modulePath)
        ? String(input.modulePath).trim()
        : null,
      testFile: isNonEmptyString(input.testFile)
        ? String(input.testFile).trim()
        : null,
      docsPath: isNonEmptyString(input.docsPath)
        ? String(input.docsPath).trim()
        : null,
      markerExport: isNonEmptyString(input.markerExport)
        ? String(input.markerExport).trim()
        : null,
      classifications: Object.freeze(
        Array.isArray(input.classifications)
          ? input.classifications
              .filter(isNonEmptyString)
              .map((c) => String(c).trim())
          : [ANALYTICS_SURFACE_CLASSIFICATION.CERTIFIED]
      ),
      publicExports: Object.freeze(
        Array.isArray(input.publicExports)
          ? input.publicExports
              .filter(isNonEmptyString)
              .map((e) => String(e).trim())
          : []
      ),
    })
  );
}

/**
 * Validate a surface list for duplicate IDs / conflicting versions.
 * @param {unknown} surfaces
 * @returns {import("../contracts/result.js").Result}
 */
export function validateCertifiedSurfaceRegistry(surfaces) {
  if (!Array.isArray(surfaces)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_SURFACE_INVALID,
        "surfaces must be an array",
        "surfaces"
      )
    );
  }

  /** @type {Map<string, string>} */
  const seen = new Map();
  /** @type {unknown[]} */
  const normalized = [];

  for (const surface of surfaces) {
    const created = createIntelligenceAnalyticsCertifiedSurface(surface);
    if (!created.ok) return created;
    const value = created.value;
    const prior = seen.get(value.surfaceId);
    if (prior !== undefined) {
      if (prior !== value.version) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTEGRATION_SURFACE_VERSION_CONFLICT,
            "Conflicting surface version for duplicate surfaceId",
            "surface.version",
            {
              surfaceId: value.surfaceId,
              existingVersion: prior,
              incomingVersion: value.version,
              reasonCode: "SURFACE_VERSION_CONFLICT",
            }
          )
        );
      }
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTEGRATION_SURFACE_DUPLICATE,
          "Duplicate surfaceId rejected",
          "surface.surfaceId",
          {
            surfaceId: value.surfaceId,
            reasonCode: "SURFACE_DUPLICATE",
          }
        )
      );
    }
    seen.set(value.surfaceId, value.version);
    normalized.push(value);
  }

  return ok(Object.freeze(normalized));
}

/**
 * @returns {ReadonlyArray<Readonly<Record<string, unknown>>>}
 */
export function listCanonicalCertifiedSurfaces() {
  return CANONICAL_CERTIFIED_SURFACES;
}

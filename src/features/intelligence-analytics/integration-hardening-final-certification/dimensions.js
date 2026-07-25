/**
 * Final certification dimensions (I&A-13).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ANALYTICS_CERTIFICATION_DIMENSION_ID,
  ANALYTICS_CERTIFICATION_SEVERITY,
  CERTIFICATION_VERSION,
} from "./enums.js";

/**
 * @param {string} dimensionId
 * @param {string} description
 * @param {string[]} requiredSurfaces
 * @param {string[]} scenarios
 * @returns {Readonly<Record<string, unknown>>}
 */
function dimension(
  dimensionId,
  description,
  requiredSurfaces,
  scenarios,
  severity = ANALYTICS_CERTIFICATION_SEVERITY.BLOCKER
) {
  return Object.freeze({
    dimensionId,
    version: CERTIFICATION_VERSION,
    description,
    requiredSurfaces: Object.freeze([...requiredSurfaces]),
    certificationScenarios: Object.freeze([...scenarios]),
    passFailSemantics: Object.freeze({
      PASS: "All required scenarios pass with no blocking failures",
      FAIL: "One or more blocking scenarios fail",
      BLOCKED: "Prerequisite surface or evidence unavailable",
      NOT_APPLICABLE: "Dimension explicitly out of scope for this run",
    }),
    evidenceReferences: Object.freeze([
      `dimension:${dimensionId}`,
      ...scenarios.map((s) => `scenario:${s}`),
    ]),
    severity,
    blockerPolicy:
      severity === ANALYTICS_CERTIFICATION_SEVERITY.BLOCKER
        ? "FAIL_OR_BLOCKED_PREVENTS_CLOSURE"
        : "WARNING_ONLY",
    provenance: Object.freeze({
      workstreamId: "I&A-13",
      certificationVersion: CERTIFICATION_VERSION,
      isCanonicalProductionClaim: false,
    }),
  });
}

const ALL_SURFACES = [
  "I&A-01",
  "I&A-02",
  "I&A-03",
  "I&A-04",
  "I&A-05",
  "I&A-06",
  "I&A-07",
  "I&A-08",
  "I&A-09",
  "I&A-10",
  "I&A-11",
  "I&A-12",
  "I&A-13",
];

/** @type {ReadonlyArray<Readonly<Record<string, unknown>>>} */
export const CANONICAL_CERTIFICATION_DIMENSIONS = Object.freeze([
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.CONTRACT_INTEGRITY,
    "Shared analytical contract shape and provenance consistency",
    ALL_SURFACES,
    ["contract-compatible", "provenance-preserved"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.PUBLIC_EXPORT_INTEGRITY,
    "Public export completeness, uniqueness, and non-write surface",
    ALL_SURFACES,
    [
      "required-exports-present",
      "no-duplicate-exports",
      "no-broken-exports",
      "no-mutable-private-exports",
      "no-write-capable-exports",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.METRIC_REGISTRY_INTEGRITY,
    "Metric ID/version uniqueness and definition compatibility",
    ["I&A-01", "I&A-02", "I&A-06", "I&A-07", "I&A-08", "I&A-09"],
    [
      "metric-registry-compatible",
      "equivalent-metric-idempotent",
      "conflicting-metric-fails",
      "missing-unit-fails",
      "broken-replacement-fails",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.ERROR_REGISTRY_INTEGRITY,
    "Typed error-code uniqueness and safe message semantics",
    ALL_SURFACES,
    [
      "error-registry-compatible",
      "conflicting-error-fails",
      "unsafe-error-message-fails",
      "raw-object-leakage-fails",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.QUERY_RUNTIME_COMPATIBILITY,
    "Query/result envelope compatibility across runtime surfaces",
    ["I&A-01", "I&A-03"],
    ["query-result-compatible"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.HISTORICAL_COMPATIBILITY,
    "Historical series composition remains tenant-safe and compatible",
    ["I&A-05", "I&A-06", "I&A-07", "I&A-08", "I&A-09"],
    ["historical-integration-compatible", "cross-tenant-historical-fails"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.DASHBOARD_REPORT_COMPATIBILITY,
    "Dashboard/report payload composition remains compatible",
    ["I&A-04", "I&A-06", "I&A-07", "I&A-08", "I&A-09", "I&A-10", "I&A-12"],
    ["dashboard-report-compatible", "cross-tenant-dashboard-fails"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.TENANT_ISOLATION,
    "Fail-closed tenant isolation across all analytical surfaces",
    ALL_SURFACES,
    [
      "tenant-missing-fails",
      "mixed-tenant-fails",
      "cross-tenant-alert-fails",
      "cross-tenant-ai-fails",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.ENTITY_ISOLATION,
    "Fail-closed entity isolation without arbitrary fallback",
    [
      "I&A-06",
      "I&A-07",
      "I&A-08",
      "I&A-09",
      "I&A-10",
      "I&A-11",
      "I&A-12",
    ],
    [
      "competition-mismatch-fails",
      "venue-mismatch-fails",
      "court-mismatch-fails",
      "club-mismatch-fails",
      "customer-mismatch-fails",
      "player-mismatch-fails",
      "team-mismatch-fails",
      "finance-scope-mismatch-fails",
      "ranking-system-mismatch-fails",
      "rating-system-mismatch-fails",
      "no-entity-fallback",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.PRIVACY_ACCESS,
    "DENY/EMPTY/SUPPRESS/ZERO/REDACT/MISSING/OMIT semantics preserved",
    ["I&A-11", "I&A-10", "I&A-12"],
    [
      "deny-differs-empty",
      "suppress-differs-zero",
      "redact-differs-missing",
      "omit-differs-redact",
      "restricted-metric-filtered",
      "restricted-dimension-filtered",
      "suppressed-alert-no-leak",
      "ai-excludes-denied",
      "ai-excludes-suppressed",
      "ai-excludes-redacted-original",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.CURRENCY_COMPATIBILITY,
    "Same-currency aggregation only; no implicit conversion",
    ["I&A-09"],
    [
      "same-currency-aggregation",
      "mixed-currency-rejected",
      "no-currency-conversion",
      "booking-not-revenue",
      "payment-not-recognized-revenue",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.RANKING_RATING_COMPATIBILITY,
    "No ranking/rating/standings recalculation or invented scores",
    ["I&A-09", "I&A-06"],
    [
      "ranking-not-recalculated",
      "rating-not-recalculated",
      "standings-not-recalculated",
      "winner-not-inferred",
      "unknown-outcome-not-loss",
      "no-invented-skill-score",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.OPERATIONAL_INSIGHT_COMPATIBILITY,
    "Operational alerts remain read-only and privacy-safe",
    ["I&A-10", "I&A-11"],
    [
      "alert-read-only",
      "insight-no-command",
      "alert-payload-compatible",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.AI_READINESS_BOUNDARY,
    "Provider-neutral AI readiness with no network/secrets/write",
    ["I&A-12", "I&A-11"],
    [
      "no-provider-sdk",
      "no-network",
      "no-secret",
      "prohibited-fails-closed",
      "high-risk-requires-review",
      "non-canonical-output",
      "ai-no-write",
      "malformed-response-fails",
      "confidence-not-fabricated",
      "no-hidden-prompt",
      "ai-presentation-compatible",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.READ_ONLY_GUARANTEE,
    "All public I&A facades remain read-only",
    ALL_SURFACES,
    ["facades-read-only"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.NO_WRITE_GUARANTEE,
    "No domain write/command/mutation surface",
    ALL_SURFACES,
    ["no-write-methods", "no-global-mutable-singleton"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.NO_PRIVATE_IMPORT,
    "No Platform Core or business-module private imports",
    ALL_SURFACES,
    [
      "no-platform-core-private",
      "no-business-private",
      "no-notification-delivery",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.NO_DATABASE_COUPLING,
    "No SQL, database-client SDK, browser-storage fallback, or table coupling",
    ALL_SURFACES,
    ["no-sql", "no-database-client", "no-browser-storage"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.NO_PROVIDER_NETWORK_COUPLING,
    "No external provider SDK or network inference",
    ["I&A-12", "I&A-13"],
    ["no-provider-sdk", "no-network"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.NO_SECRET_OR_PII_LEAKAGE,
    "No PII/secret/payment credential leakage in fixtures/docs/errors",
    ALL_SURFACES,
    ["no-pii-secret-payment"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.CI_REGISTRATION,
    "Required test files registered in CI unit registry",
    ALL_SURFACES,
    ["ci-registration-present", "required-test-present"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.OWNERSHIP_LOCK,
    "I&A remains under reporting-read-only ownership lock",
    ["I&A-13"],
    ["ownership-lock-present"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.DOCUMENTATION_COMPLETENESS,
    "Architecture and certification docs present for each surface",
    ALL_SURFACES,
    ["required-docs-present"]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.REPRODUCIBILITY,
    "Deterministic evidence ordering and structural report reproducibility",
    ["I&A-13"],
    [
      "deterministic-evidence-order",
      "same-inputs-same-structure",
      "report-includes-source-commit",
      "report-includes-manifest-version",
    ]
  ),
  dimension(
    ANALYTICS_CERTIFICATION_DIMENSION_ID.FINAL_SCOPE_INTEGRITY,
    "Final scope honesty: deferred Production, mock honesty, closure readiness",
    ["I&A-13"],
    [
      "in-memory-certification-only",
      "mock-not-live",
      "missing-source-not-silent",
      "empty-differs-unavailable",
      "denied-differs-empty",
      "suppressed-differs-empty",
      "stale-warning-preserved",
      "incomplete-not-complete",
      "blocking-prevents-closure",
    ]
  ),
]);

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceAnalyticsCertificationDimension(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_DIMENSION_INVALID,
        "CertificationDimension must be a plain object",
        "dimension"
      )
    );
  }

  if (!isNonEmptyString(input.dimensionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_DIMENSION_INVALID,
        "dimensionId is required",
        "dimension.dimensionId"
      )
    );
  }

  if (!isNonEmptyString(input.version)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_DIMENSION_INVALID,
        "version is required",
        "dimension.version"
      )
    );
  }

  if (!isNonEmptyString(input.description)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_DIMENSION_INVALID,
        "description is required",
        "dimension.description"
      )
    );
  }

  return ok(
    deepFreeze({
      dimensionId: String(input.dimensionId).trim(),
      version: String(input.version).trim(),
      description: String(input.description).trim(),
      requiredSurfaces: Object.freeze(
        Array.isArray(input.requiredSurfaces)
          ? input.requiredSurfaces
              .filter(isNonEmptyString)
              .map((s) => String(s).trim())
          : []
      ),
      certificationScenarios: Object.freeze(
        Array.isArray(input.certificationScenarios)
          ? input.certificationScenarios
              .filter(isNonEmptyString)
              .map((s) => String(s).trim())
          : []
      ),
      passFailSemantics: Object.freeze(
        isPlainObject(input.passFailSemantics)
          ? { ...input.passFailSemantics }
          : {}
      ),
      evidenceReferences: Object.freeze(
        Array.isArray(input.evidenceReferences)
          ? input.evidenceReferences
              .filter(isNonEmptyString)
              .map((s) => String(s).trim())
          : []
      ),
      severity: isNonEmptyString(input.severity)
        ? String(input.severity).trim()
        : ANALYTICS_CERTIFICATION_SEVERITY.BLOCKER,
      blockerPolicy: isNonEmptyString(input.blockerPolicy)
        ? String(input.blockerPolicy).trim()
        : "FAIL_OR_BLOCKED_PREVENTS_CLOSURE",
      provenance: Object.freeze(
        isPlainObject(input.provenance)
          ? { ...input.provenance, isCanonicalProductionClaim: false }
          : {
              workstreamId: "I&A-13",
              certificationVersion: CERTIFICATION_VERSION,
              isCanonicalProductionClaim: false,
            }
      ),
    })
  );
}

/**
 * @returns {ReadonlyArray<Readonly<Record<string, unknown>>>}
 */
export function listCanonicalCertificationDimensions() {
  return CANONICAL_CERTIFICATION_DIMENSIONS;
}

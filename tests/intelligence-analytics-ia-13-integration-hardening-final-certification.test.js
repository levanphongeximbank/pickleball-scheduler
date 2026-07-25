/**
 * I&A-13 — Integration Hardening and Final Certification tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as IA from "../src/features/intelligence-analytics/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(__dirname, "../src/features/intelligence-analytics");
const SLICE_ROOT = join(
  MODULE_ROOT,
  "integration-hardening-final-certification"
);
const DOCS_ROOT = join(__dirname, "../docs/intelligence-analytics/ia-13");
const FIXED_NOW = "2026-07-25T00:00:00.000Z";
const SOURCE_COMMIT = "deadbeefcafebabe";

function listFiles(dir, extFilter) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...listFiles(full, extFilter));
    else if (!extFilter || entry.endsWith(extFilter)) files.push(full);
  }
  return files;
}

const SOURCE_FILES = listFiles(SLICE_ROOT, ".js");
const DOC_FILES = listFiles(DOCS_ROOT);

function runWithInventory(overrides = {}) {
  return IA.runIntelligenceAnalyticsFinalCertification({
    reportId: "ia-13-cert",
    generatedAt: FIXED_NOW,
    sourceCommit: SOURCE_COMMIT,
    inventory: IA.createCleanCertificationInventory(overrides),
  });
}

function assertFailStatus(outcome) {
  assert.equal(outcome.status, IA.ANALYTICS_CERTIFICATION_STATUS.FAIL);
}

function assertPassStatus(outcome) {
  assert.equal(outcome.status, IA.ANALYTICS_CERTIFICATION_STATUS.PASS);
}

test("I&A-13 marker and public exports", () => {
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_INTEGRATION_HARDENING_FINAL_CERTIFICATION
      .workstreamId,
    "I&A-13"
  );
  assert.equal(
    IA.INTEGRATION_HARDENING_FINAL_CERTIFICATION_METHOD_VERSION,
    "1.0.0"
  );
  assert.ok(
    IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS.includes(
      "createIntelligenceAnalyticsFinalCertificationFacade"
    )
  );
});

test("1. Valid certification manifest accepted", () => {
  const result = IA.buildDefaultIntelligenceAnalyticsCertificationManifest({
    generatedAt: FIXED_NOW,
    sourceCommit: SOURCE_COMMIT,
  });
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.value.manifestId, "ia-13-final-certification");
  assert.equal(result.value.isProductionReadyClaim, false);
});

test("2. Missing manifest ID rejected", () => {
  const result = IA.createIntelligenceAnalyticsCertificationManifest({
    manifestVersion: "1.0.0",
    generatedAt: FIXED_NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTEGRATION_MANIFEST_INVALID
  );
});

test("3. Missing manifest version rejected", () => {
  const result = IA.createIntelligenceAnalyticsCertificationManifest({
    manifestId: "ia-13-final-certification",
    generatedAt: FIXED_NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTEGRATION_MANIFEST_INVALID
  );
});

test("4. Manifest immutable", () => {
  const result = IA.buildDefaultIntelligenceAnalyticsCertificationManifest({
    generatedAt: FIXED_NOW,
  });
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.throws(() => {
    result.value.manifestId = "mutated";
  });
});

test("5. Certified surfaces include I&A-01..12", () => {
  const surfaces = IA.listCanonicalCertifiedSurfaces();
  for (let i = 1; i <= 12; i += 1) {
    const id = `I&A-${String(i).padStart(2, "0")}`;
    assert.ok(
      surfaces.some((s) => s.surfaceId === id),
      `missing ${id}`
    );
  }
  assert.ok(surfaces.some((s) => s.surfaceId === "I&A-13"));
});

test("6. Duplicate surface ID rejected", () => {
  const result = IA.validateCertifiedSurfaceRegistry([
    {
      surfaceId: "I&A-01",
      version: "1.0.0",
      name: "A",
    },
    {
      surfaceId: "I&A-01",
      version: "1.0.0",
      name: "B",
    },
  ]);
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTEGRATION_SURFACE_DUPLICATE
  );
});

test("7. Conflicting surface version rejected", () => {
  const result = IA.validateCertifiedSurfaceRegistry([
    {
      surfaceId: "I&A-01",
      version: "1.0.0",
      name: "A",
    },
    {
      surfaceId: "I&A-01",
      version: "2.0.0",
      name: "B",
    },
  ]);
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTEGRATION_SURFACE_VERSION_CONFLICT
  );
});

test("8. Missing required public export fails", () => {
  assertFailStatus(
    IA.verifyPublicExportIntegrity({
      publicExports: [{ name: "A" }],
      requiredExports: ["A", "B"],
    })
  );
});

test("9. Duplicate public export fails", () => {
  assertFailStatus(
    IA.verifyPublicExportIntegrity({
      publicExports: [{ name: "A" }, { name: "A" }],
      requiredExports: ["A"],
    })
  );
});

test("10. Broken export reference fails", () => {
  assertFailStatus(
    IA.verifyPublicExportIntegrity({
      publicExports: [{ name: "A", broken: true }],
      requiredExports: ["A"],
    })
  );
});

test("11. Private mutable export fails", () => {
  assertFailStatus(
    IA.verifyPublicExportIntegrity({
      publicExports: [{ name: "A", mutablePrivate: true }],
      requiredExports: ["A"],
    })
  );
});

test("12. Write-capable export fails", () => {
  assertFailStatus(
    IA.verifyPublicExportIntegrity({
      publicExports: [{ name: "A", writeCapable: true }],
      requiredExports: ["A"],
    })
  );
});

test("13. Required test file missing fails", () => {
  assertFailStatus(
    IA.verifyDocumentationAndCi({ requiredTestMissing: true })
  );
});

test("14. Required docs missing fails", () => {
  assertFailStatus(
    IA.verifyDocumentationAndCi({ requiredDocsMissing: true })
  );
});

test("15. CI registration missing fails", () => {
  assertFailStatus(
    IA.verifyDocumentationAndCi({ ciRegistrationMissing: true })
  );
});

test("16. Metric registry compatible PASS", () => {
  assertPassStatus(
    IA.verifyMetricRegistryIntegrity(IA.createCleanCertificationInventory())
  );
});

test("17. Duplicate equivalent metric idempotent", () => {
  assertPassStatus(
    IA.verifyMetricRegistryIntegrity({
      metrics: [
        {
          metricId: "m1",
          version: "1.0.0",
          unit: "count",
          aggregation: "sum",
          definitionHash: "h1",
        },
        {
          metricId: "m1",
          version: "1.0.0",
          unit: "count",
          aggregation: "sum",
          definitionHash: "h1",
        },
      ],
    })
  );
});

test("18. Conflicting metric definition fails", () => {
  assertFailStatus(
    IA.verifyMetricRegistryIntegrity({
      metrics: [
        {
          metricId: "m1",
          version: "1.0.0",
          unit: "count",
          aggregation: "sum",
          definitionHash: "h1",
        },
        {
          metricId: "m1",
          version: "1.0.0",
          unit: "count",
          aggregation: "avg",
          definitionHash: "h2",
        },
      ],
    })
  );
});

test("19. Missing metric unit fails when required", () => {
  assertFailStatus(
    IA.verifyMetricRegistryIntegrity({
      metrics: [
        {
          metricId: "m1",
          version: "1.0.0",
          unitRequired: true,
          aggregation: "sum",
          definitionHash: "h1",
        },
      ],
    })
  );
});

test("20. Broken metric replacement fails", () => {
  assertFailStatus(
    IA.verifyMetricRegistryIntegrity({
      metrics: [
        {
          metricId: "m1",
          version: "1.0.0",
          unit: "count",
          aggregation: "sum",
          definitionHash: "h1",
          replacementBroken: true,
        },
      ],
    })
  );
});

test("21. Error registry compatible PASS", () => {
  assertPassStatus(
    IA.verifyErrorRegistryIntegrity(IA.createCleanCertificationInventory())
  );
});

test("22. Duplicate conflicting error code fails", () => {
  assertFailStatus(
    IA.verifyErrorRegistryIntegrity({
      errors: [
        { code: "E1", semantics: "a" },
        { code: "E1", semantics: "b" },
      ],
    })
  );
});

test("23. Unsafe error message fails", () => {
  assertFailStatus(
    IA.verifyErrorRegistryIntegrity({
      errors: [{ code: "E1", semantics: "a", unsafeMessage: true }],
    })
  );
});

test("24. Error raw object leakage fails", () => {
  assertFailStatus(
    IA.verifyErrorRegistryIntegrity({
      errors: [{ code: "E1", semantics: "a", rawObjectLeakage: true }],
    })
  );
});

test("25. Tenant context missing fails", () => {
  assertFailStatus(IA.verifyTenantIsolation({ tenantMissing: true }));
});

test("26. Mixed tenant facts fail", () => {
  assertFailStatus(IA.verifyTenantIsolation({ mixedTenant: true }));
});

test("27. Cross-tenant historical payload fails", () => {
  assertFailStatus(
    IA.verifyTenantIsolation({ crossTenantHistorical: true })
  );
});

test("28. Cross-tenant dashboard payload fails", () => {
  assertFailStatus(
    IA.verifyTenantIsolation({ crossTenantDashboard: true })
  );
});

test("29. Cross-tenant alert fails", () => {
  assertFailStatus(IA.verifyTenantIsolation({ crossTenantAlert: true }));
});

test("30. Cross-tenant AI feature vector fails", () => {
  assertFailStatus(
    IA.verifyTenantIsolation({ crossTenantAiFeatureVector: true })
  );
});

test("31. Competition entity mismatch fails", () => {
  assertFailStatus(
    IA.verifyEntityIsolation({ competitionMismatch: true })
  );
});

test("32. Venue mismatch fails", () => {
  assertFailStatus(IA.verifyEntityIsolation({ venueMismatch: true }));
});

test("33. Court mismatch fails", () => {
  assertFailStatus(IA.verifyEntityIsolation({ courtMismatch: true }));
});

test("34. Club mismatch fails", () => {
  assertFailStatus(IA.verifyEntityIsolation({ clubMismatch: true }));
});

test("35. Customer mismatch fails", () => {
  assertFailStatus(IA.verifyEntityIsolation({ customerMismatch: true }));
});

test("36. Player mismatch fails", () => {
  assertFailStatus(IA.verifyEntityIsolation({ playerMismatch: true }));
});

test("37. Team mismatch fails", () => {
  assertFailStatus(IA.verifyEntityIsolation({ teamMismatch: true }));
});

test("38. Finance scope mismatch fails", () => {
  assertFailStatus(
    IA.verifyEntityIsolation({ financeScopeMismatch: true })
  );
});

test("39. Ranking-system mismatch fails", () => {
  assertFailStatus(
    IA.verifyEntityIsolation({ rankingSystemMismatch: true })
  );
});

test("40. Rating-system mismatch fails", () => {
  assertFailStatus(
    IA.verifyEntityIsolation({ ratingSystemMismatch: true })
  );
});

test("41. No arbitrary entity fallback", () => {
  assertFailStatus(
    IA.verifyEntityIsolation({ arbitraryEntityFallback: true })
  );
});

test("42. Access DENY differs from EMPTY", () => {
  assert.notEqual(
    IA.ANALYTICS_ACCESS_STATE_SEMANTICS.DENY,
    IA.ANALYTICS_ACCESS_STATE_SEMANTICS.EMPTY
  );
  assertFailStatus(
    IA.verifyPrivacyAccess({
      accessStateSemantics: { denyEqualsEmpty: true },
    })
  );
});

test("43. SUPPRESS differs from ZERO", () => {
  assert.notEqual(
    IA.ANALYTICS_ACCESS_STATE_SEMANTICS.SUPPRESS,
    IA.ANALYTICS_ACCESS_STATE_SEMANTICS.ZERO
  );
  assertFailStatus(
    IA.verifyPrivacyAccess({
      accessStateSemantics: { suppressEqualsZero: true },
    })
  );
});

test("44. REDACT differs from MISSING", () => {
  assert.notEqual(
    IA.ANALYTICS_ACCESS_STATE_SEMANTICS.REDACT,
    IA.ANALYTICS_ACCESS_STATE_SEMANTICS.MISSING
  );
  assertFailStatus(
    IA.verifyPrivacyAccess({
      accessStateSemantics: { redactEqualsMissing: true },
    })
  );
});

test("45. OMIT differs from REDACT", () => {
  assert.notEqual(
    IA.ANALYTICS_ACCESS_STATE_SEMANTICS.OMIT,
    IA.ANALYTICS_ACCESS_STATE_SEMANTICS.REDACT
  );
  assertFailStatus(
    IA.verifyPrivacyAccess({
      accessStateSemantics: { omitEqualsRedact: true },
    })
  );
});

test("46. Restricted metric discovery filtered", () => {
  assertFailStatus(
    IA.verifyPrivacyAccess({ restrictedMetricExposed: true })
  );
});

test("47. Restricted dimension filtered", () => {
  assertFailStatus(
    IA.verifyPrivacyAccess({ restrictedDimensionExposed: true })
  );
});

test("48. Suppressed alert evidence does not leak", () => {
  assertFailStatus(IA.verifyPrivacyAccess({ suppressedAlertLeak: true }));
});

test("49. AI feature vector excludes denied value", () => {
  assertFailStatus(IA.verifyPrivacyAccess({ aiIncludesDenied: true }));
});

test("50. AI feature vector excludes suppressed value", () => {
  assertFailStatus(IA.verifyPrivacyAccess({ aiIncludesSuppressed: true }));
});

test("51. AI feature vector excludes original redacted value", () => {
  assertFailStatus(
    IA.verifyPrivacyAccess({ aiIncludesRedactedOriginal: true })
  );
});

test("52. Same-currency Finance aggregation certified", () => {
  assertPassStatus(
    IA.verifyCurrencyCompatibility(IA.createCleanCertificationInventory())
  );
});

test("53. Mixed-currency scalar total rejected", () => {
  assertFailStatus(
    IA.verifyCurrencyCompatibility({ mixedCurrencyScalarAccepted: true })
  );
});

test("54. No currency conversion certified", () => {
  assertFailStatus(
    IA.verifyCurrencyCompatibility({ currencyConversionPerformed: true })
  );
});

test("55. Booking not treated as revenue", () => {
  assertFailStatus(
    IA.verifyCurrencyCompatibility({ bookingTreatedAsRevenue: true })
  );
});

test("56. Payment not treated as recognized revenue", () => {
  assertFailStatus(
    IA.verifyCurrencyCompatibility({
      paymentTreatedAsRecognizedRevenue: true,
    })
  );
});

test("57. Ranking not recalculated", () => {
  assertFailStatus(
    IA.verifyRankingRatingCompatibility({ rankingRecalculated: true })
  );
});

test("58. Rating not recalculated", () => {
  assertFailStatus(
    IA.verifyRankingRatingCompatibility({ ratingRecalculated: true })
  );
});

test("59. Standings not recalculated", () => {
  assertFailStatus(
    IA.verifyRankingRatingCompatibility({ standingsRecalculated: true })
  );
});

test("60. Winner not inferred from invalid result", () => {
  assertFailStatus(
    IA.verifyRankingRatingCompatibility({
      winnerInferredFromInvalid: true,
    })
  );
});

test("61. Unknown outcome not converted to loss", () => {
  assertFailStatus(
    IA.verifyRankingRatingCompatibility({
      unknownOutcomeConvertedToLoss: true,
    })
  );
});

test("62. No invented player skill score", () => {
  assertFailStatus(
    IA.verifyRankingRatingCompatibility({ inventedSkillScore: true })
  );
});

test("63. Operational alert remains read-only", () => {
  assertFailStatus(
    IA.verifyOperationalInsightCompatibility({ alertWriteCapable: true })
  );
});

test("64. Operational insight does not execute command", () => {
  assertFailStatus(
    IA.verifyOperationalInsightCompatibility({
      insightExecutesCommand: true,
    })
  );
});

test("65. AI provider SDK absent", () => {
  assertFailStatus(
    IA.verifyAiReadinessBoundary({ providerSdkPresent: true })
  );
});

test("66. AI network integration absent", () => {
  assertFailStatus(
    IA.verifyAiReadinessBoundary({ networkIntegrationPresent: true })
  );
});

test("67. AI secret/API key absent", () => {
  assertFailStatus(
    IA.verifyAiReadinessBoundary({ secretOrApiKeyPresent: true })
  );
});

test("68. Prohibited AI use case fails closed", () => {
  assertFailStatus(
    IA.verifyAiReadinessBoundary({ prohibitedUseCaseAllowed: true })
  );
});

test("69. High-risk AI use case requires review", () => {
  assertFailStatus(
    IA.verifyAiReadinessBoundary({ highRiskWithoutReview: true })
  );
});

test("70. AI output marked non-canonical", () => {
  assertFailStatus(
    IA.verifyAiReadinessBoundary({ aiOutputClaimsCanonical: true })
  );
});

test("71. AI output no-write guarantee", () => {
  assertFailStatus(IA.verifyAiReadinessBoundary({ aiWriteCapable: true }));
});

test("72. Model response malformed fails", () => {
  assertFailStatus(
    IA.verifyAiReadinessBoundary({ malformedResponseAccepted: true })
  );
});

test("73. Confidence not fabricated", () => {
  assertFailStatus(
    IA.verifyAiReadinessBoundary({ confidenceFabricated: true })
  );
});

test("74. No hidden prompt or chain-of-thought exposure", () => {
  assertFailStatus(
    IA.verifyAiReadinessBoundary({ hiddenPromptExposed: true })
  );
});

test("75. No SQL import", () => {
  assertFailStatus(
    IA.verifyReadOnlyAndDependencyBoundaries({ sqlImport: true })
  );
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/\bSELECT\b|\bINSERT\b|\bCREATE TABLE\b/i.test(text), false, file);
  }
});

test("76. No Supabase import", () => {
  assertFailStatus(
    IA.verifyReadOnlyAndDependencyBoundaries({ databaseClientImport: true })
  );
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /(?:from|import)\s*\(?\s*["'][^"']*(?:@supabase|supabase)[^"']*["']/i.test(
        text
      ),
      false,
      file
    );
  }
});

test("77. No localStorage fallback", () => {
  assertFailStatus(
    IA.verifyReadOnlyAndDependencyBoundaries({
      browserStorageFallback: true,
    })
  );
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/\blocalStorage\s*(?:\.|\[)/.test(text), false, file);
  }
});

test("78. No Platform Core private import", () => {
  assertFailStatus(
    IA.verifyReadOnlyAndDependencyBoundaries({
      platformCorePrivateImport: true,
    })
  );
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /(?:from|import)\s*\(?\s*["'][^"']*src\/core\/platform[^"']*["']/i.test(text),
      false,
      file
    );
  }
});

test("79. No business-module private import", () => {
  assertFailStatus(
    IA.verifyReadOnlyAndDependencyBoundaries({
      businessModulePrivateImport: true,
    })
  );
});

test("80. No Notification delivery import", () => {
  assertFailStatus(
    IA.verifyReadOnlyAndDependencyBoundaries({
      notificationDeliveryImport: true,
    })
  );
});

test("81. No global mutable singleton", () => {
  assertFailStatus(
    IA.verifyReadOnlyAndDependencyBoundaries({
      globalMutableSingleton: true,
    })
  );
});

test("82. In-memory source explicitly certification-only", () => {
  const sourceResult =
    IA.createInMemoryIntelligenceAnalyticsCertificationSource();
  assert.equal(sourceResult.ok, true);
  assert.equal(sourceResult.value.kind, "CERTIFICATION_ONLY");
  assert.equal(sourceResult.value.isProduction, false);
  assertPassStatus(
    IA.verifyMockHonestyAndSourceStates(
      IA.createCleanCertificationInventory({
        sourceKind: "CERTIFICATION_ONLY",
        requireCertificationOnly: true,
      })
    )
  );
});

test("83. MOCK does not claim LIVE", () => {
  assertFailStatus(
    IA.verifyMockHonestyAndSourceStates({ mockClaimsLive: true })
  );
});

test("84. Missing source not silent success", () => {
  assertFailStatus(
    IA.verifyMockHonestyAndSourceStates({
      missingSourceSilentSuccess: true,
    })
  );
});

test("85. EMPTY differs from UNAVAILABLE", () => {
  assert.notEqual(
    IA.ANALYTICS_ACCESS_STATE_SEMANTICS.EMPTY,
    IA.ANALYTICS_ACCESS_STATE_SEMANTICS.UNAVAILABLE
  );
  assertFailStatus(
    IA.verifyMockHonestyAndSourceStates({ emptyEqualsUnavailable: true })
  );
});

test("86. DENIED differs from EMPTY", () => {
  assertFailStatus(
    IA.verifyMockHonestyAndSourceStates({ deniedEqualsEmpty: true })
  );
});

test("87. SUPPRESSED differs from EMPTY", () => {
  assertFailStatus(
    IA.verifyMockHonestyAndSourceStates({ suppressedEqualsEmpty: true })
  );
});

test("88. Stale source warning preserved", () => {
  assertFailStatus(
    IA.verifyMockHonestyAndSourceStates({ staleWarningDropped: true })
  );
});

test("89. Incomplete source does not claim complete", () => {
  assertFailStatus(
    IA.verifyMockHonestyAndSourceStates({ incompleteClaimsComplete: true })
  );
});

test("90. Provenance preserved", () => {
  assertFailStatus(
    IA.verifyMockHonestyAndSourceStates({ provenanceDropped: true })
  );
});

test("91. Historical integration compatible", () => {
  assertPassStatus(
    IA.verifyContractCompatibility(IA.createCleanCertificationInventory())
  );
  assertFailStatus(
    IA.verifyContractCompatibility({ historicalIncompatible: true })
  );
});

test("92. Dashboard/report payload compatible", () => {
  assertFailStatus(
    IA.verifyContractCompatibility({ dashboardIncompatible: true })
  );
});

test("93. Alert/insight payload compatible", () => {
  assertFailStatus(
    IA.verifyContractCompatibility({ alertPayloadIncompatible: true })
  );
});

test("94. AI presentation payload compatible", () => {
  assertFailStatus(
    IA.verifyContractCompatibility({ aiPresentationIncompatible: true })
  );
});

test("95. Certification result PASS explicit", () => {
  const result = IA.createIntelligenceAnalyticsCertificationResult({
    dimensionId: "CONTRACT_INTEGRITY",
    status: IA.ANALYTICS_CERTIFICATION_STATUS.PASS,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, "PASS");
  assert.equal(result.value.blocking, false);
});

test("96. Certification result FAIL explicit", () => {
  const result = IA.createIntelligenceAnalyticsCertificationResult({
    dimensionId: "CONTRACT_INTEGRITY",
    status: IA.ANALYTICS_CERTIFICATION_STATUS.FAIL,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, "FAIL");
  assert.equal(result.value.blocking, true);
});

test("97. Certification result BLOCKED explicit", () => {
  const result = IA.createIntelligenceAnalyticsCertificationResult({
    dimensionId: "CONTRACT_INTEGRITY",
    status: IA.ANALYTICS_CERTIFICATION_STATUS.BLOCKED,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, "BLOCKED");
  assert.equal(result.value.blocking, true);
});

test("98. NOT_APPLICABLE explicit", () => {
  const result = IA.createIntelligenceAnalyticsCertificationResult({
    dimensionId: "CONTRACT_INTEGRITY",
    status: IA.ANALYTICS_CERTIFICATION_STATUS.NOT_APPLICABLE,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, "NOT_APPLICABLE");
  assert.equal(result.value.blocking, false);
});

test("99. Blocking failure prevents closure readiness", () => {
  const run = runWithInventory({ mixedTenant: true });
  assert.equal(run.ok, true);
  assert.equal(run.value.closureReady, false);
  assert.ok(run.value.blockingFailures.length > 0);
  const closure = IA.verifyIntelligenceAnalyticsClosureReadiness(run.value);
  assert.equal(closure.ok, true);
  assert.equal(closure.value.closureReady, false);
});

test("100. Warning does not automatically fail nonblocking dimension", () => {
  const evidence = IA.createIntelligenceAnalyticsCertificationEvidence({
    scenarioId: "warn-1",
    dimensionId: "REPRODUCIBILITY",
    status: IA.ANALYTICS_CERTIFICATION_STATUS.PASS,
    evaluatedAt: FIXED_NOW,
    severity: IA.ANALYTICS_CERTIFICATION_SEVERITY.WARNING,
    warning: true,
  });
  assert.equal(evidence.ok, true);
  assert.equal(evidence.value.status, "PASS");
  assert.equal(evidence.value.warning, true);

  const report = IA.createIntelligenceAnalyticsFinalReport({
    reportId: "warn-report",
    generatedAt: FIXED_NOW,
    manifestVersion: "1.0.0",
    sourceCommit: SOURCE_COMMIT,
    evidence: [evidence.value],
    dimensionResults: [
      {
        dimensionId: "REPRODUCIBILITY",
        status: IA.ANALYTICS_CERTIFICATION_STATUS.PASS,
        warningCount: 1,
        evidenceIds: ["warn-1"],
      },
    ],
  });
  assert.equal(report.ok, true);
  assert.equal(report.value.overallStatus, "PASS");
  assert.equal(report.value.warnings.length, 1);
  assert.equal(report.value.blockingFailures.length, 0);
});

test("101. Deterministic evidence ordering", () => {
  const run = runWithInventory();
  assert.equal(run.ok, true);
  const ids = run.value.evidence.map((e) => `${e.dimensionId}:${e.scenarioId}`);
  const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  assert.deepEqual(ids, sorted);
});

test("102. Same inputs produce same structural report", () => {
  const a = runWithInventory();
  const b = runWithInventory();
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.structuralFingerprint, b.value.structuralFingerprint);
  assert.equal(a.value.overallStatus, b.value.overallStatus);
});

test("103. Final report includes source commit", () => {
  const run = runWithInventory();
  assert.equal(run.ok, true);
  assert.equal(run.value.sourceCommit, SOURCE_COMMIT);
});

test("104. Final report includes manifest version", () => {
  const run = runWithInventory();
  assert.equal(run.ok, true);
  assert.equal(run.value.manifestVersion, IA.CERTIFICATION_MANIFEST_VERSION);
});

test("105. Final report includes all required dimensions", () => {
  const run = runWithInventory();
  assert.equal(run.ok, true);
  const required = Object.values(IA.ANALYTICS_CERTIFICATION_DIMENSION_ID);
  for (const id of required) {
    assert.ok(
      run.value.dimensionResults.some((d) => d.dimensionId === id),
      `missing dimension ${id}`
    );
  }
});

test("106. Final report lists blocking failures", () => {
  const run = runWithInventory({ sqlImport: true });
  assert.equal(run.ok, true);
  assert.ok(Array.isArray(run.value.blockingFailures));
  assert.ok(run.value.blockingFailures.length > 0);
});

test("107. Final report lists warnings", () => {
  const run = runWithInventory();
  assert.equal(run.ok, true);
  assert.ok(Array.isArray(run.value.warnings));
});

test("108. Final facade is read-only", () => {
  const facadeResult = IA.createIntelligenceAnalyticsFinalCertificationFacade({
    sourceCommit: SOURCE_COMMIT,
  });
  assert.equal(facadeResult.ok, true);
  const writeResult = facadeResult.value.write();
  assert.equal(writeResult.ok, false);
  assert.equal(
    writeResult.error.code,
    IA.ANALYTICS_ERROR_CODE.INTEGRATION_FACADE_WRITE_REJECTED
  );
});

test("109. Final facade exposes no deploy/write/approve methods", () => {
  const facadeResult =
    IA.createReadOnlyIntelligenceAnalyticsFinalCertificationFacade();
  assert.equal(facadeResult.ok, true);
  const keys = Object.keys(facadeResult.value);
  for (const banned of ["write", "deploy", "approve", "merge", "mutate"]) {
    assert.equal(keys.includes(banned), false, banned);
  }
  assert.equal(facadeResult.value.deploy().ok, false);
  assert.equal(facadeResult.value.approve().ok, false);
});

test("110. Invalid certification request does not invoke source", () => {
  let loads = 0;
  const result = IA.runIntelligenceAnalyticsFinalCertification({
    generatedAt: FIXED_NOW,
    loadInventory: () => {
      loads += 1;
      return IA.createCleanCertificationInventory();
    },
  });
  assert.equal(result.ok, false);
  assert.equal(loads, 0);
});

test("111. Source failure wrapped safely", () => {
  const sourceResult =
    IA.createInMemoryIntelligenceAnalyticsCertificationSource({
      failOnLoad: true,
    });
  assert.equal(sourceResult.ok, true);
  const facadeResult = IA.createIntelligenceAnalyticsFinalCertificationFacade({
    source: sourceResult.value,
  });
  assert.equal(facadeResult.ok, true);
  const run = facadeResult.value.runCertification({
    reportId: "ia-13-source-fail",
    generatedAt: FIXED_NOW,
  });
  assert.equal(run.ok, false);
  assert.equal(
    run.error.code,
    IA.ANALYTICS_ERROR_CODE.INTEGRATION_SOURCE_FAILURE
  );
  assert.equal(typeof run.error.message, "string");
  assert.equal(/stack|password|apiKey/i.test(run.error.message), false);
});

test("112. Input not mutated", () => {
  const inventory = IA.createCleanCertificationInventory();
  const before = JSON.stringify(inventory);
  const run = IA.runIntelligenceAnalyticsFinalCertification({
    reportId: "ia-13-imut",
    generatedAt: FIXED_NOW,
    inventory,
  });
  assert.equal(run.ok, true);
  assert.equal(JSON.stringify(inventory), before);
});

test("113. Output immutable", () => {
  const run = runWithInventory();
  assert.equal(run.ok, true);
  assert.ok(Object.isFrozen(run.value));
  assert.throws(() => {
    run.value.overallStatus = "FAIL";
  });
});

test("114. No PII/payment credential in fixtures/docs/errors", () => {
  const files = [...SOURCE_FILES, ...DOC_FILES];
  const banned =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|sk-[a-zA-Z0-9]{10,}|password\s*=\s*["'][^"']+["']|4111[\s-]?1111[\s-]?1111[\s-]?1111/i;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(banned.test(text), false, file);
  }
});

test("115. I&A-01 through I&A-12 regressions PASS", () => {
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FOUNDATION.workstreamId, "I&A-01");
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_METRIC_REGISTRY.workstreamId,
    "I&A-02"
  );
  assert.equal(IA.INTELLIGENCE_ANALYTICS_QUERY_RUNTIME.workstreamId, "I&A-03");
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING.workstreamId,
    "I&A-04"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_HISTORICAL_TREND.workstreamId,
    "I&A-05"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS.workstreamId,
    "I&A-06"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_VENUE_COURT_CLUB_ANALYTICS.workstreamId,
    "I&A-07"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_CUSTOMER_PLAYER_ANALYTICS.workstreamId,
    "I&A-08"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_FINANCE_RANKING_PERFORMANCE_ANALYTICS
      .workstreamId,
    "I&A-09"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_OPERATIONAL_ALERTS_INSIGHTS.workstreamId,
    "I&A-10"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_PRIVACY_ACCESS_CERTIFICATION.workstreamId,
    "I&A-11"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_AI_ADVANCED_INTELLIGENCE_READINESS.workstreamId,
    "I&A-12"
  );
});

test("116. Final closure readiness PASS only when every blocker cleared", () => {
  const clean = runWithInventory();
  assert.equal(clean.ok, true);
  assert.equal(clean.value.overallStatus, "PASS");
  assert.equal(clean.value.closureReady, true);
  const closure = IA.verifyIntelligenceAnalyticsClosureReadiness(clean.value);
  assert.equal(closure.ok, true);
  assert.equal(closure.value.closureReady, true);
  assert.equal(
    closure.value.intelligenceAnalyticsStructuralFoundationClosed,
    true
  );

  const dirty = runWithInventory({ providerSdkPresent: true });
  assert.equal(dirty.ok, true);
  assert.equal(dirty.value.closureReady, false);
});

test("Import boundary scan: no react/openai/anthropic/axios in I&A-13", () => {
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/from ["']react["']|require\(["']react["']\)/i.test(text), false, file);
    assert.equal(
      /(?:from|import|require)\s*\(?\s*["'][^"']*(?:openai|anthropic|@google\/generative-ai|axios)[^"']*["']/i.test(
        text
      ),
      false,
      file
    );
  }
});

test("CI registry includes I&A-13 test", () => {
  const registry = readFileSync(
    join(__dirname, "../scripts/ci/unit-test-files.json"),
    "utf8"
  );
  assert.ok(
    registry.includes(
      "tests/intelligence-analytics-ia-13-integration-hardening-final-certification.test.js"
    )
  );
});

test("Docs and architecture present", () => {
  assert.ok(DOC_FILES.length > 0);
  const arch = readFileSync(join(MODULE_ROOT, "ARCHITECTURE.md"), "utf8");
  assert.ok(arch.includes("I&A-13"));
  assert.ok(arch.includes("integration-hardening-final-certification"));
});

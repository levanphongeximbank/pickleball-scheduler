/**
 * In-memory certification source (I&A-13).
 * Explicitly CERTIFICATION_ONLY — never Production.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { CANONICAL_CERTIFIED_SURFACES } from "./surfaces.js";

/**
 * Build a clean (PASS) certification inventory snapshot.
 * @param {Record<string, unknown>} [overrides]
 * @returns {Readonly<Record<string, unknown>>}
 */
export function createCleanCertificationInventory(overrides = {}) {
  const requiredExports = CANONICAL_CERTIFIED_SURFACES.map(
    (s) => s.markerExport
  ).filter(Boolean);

  return deepFreeze({
    sourceKind: "CERTIFICATION_ONLY",
    requireCertificationOnly: true,
    isProduction: false,
    claimsLive: false,
    publicExports: requiredExports.map((name) => ({
      name,
      broken: false,
      mutablePrivate: false,
      writeCapable: false,
    })),
    requiredExports,
    metrics: [
      {
        metricId: "competition.match.count",
        version: "1.0.0",
        unit: "count",
        aggregation: "sum",
        definitionHash: "abc123",
      },
      // equivalent duplicate — idempotent
      {
        metricId: "competition.match.count",
        version: "1.0.0",
        unit: "count",
        aggregation: "sum",
        definitionHash: "abc123",
      },
    ],
    errors: [
      {
        code: "ANALYTICS_TENANT_REQUIRED",
        semantics: "missing-tenant",
        unsafeMessage: false,
        rawObjectLeakage: false,
      },
    ],
    tenantMissing: false,
    mixedTenant: false,
    crossTenantHistorical: false,
    crossTenantDashboard: false,
    crossTenantAlert: false,
    crossTenantAiFeatureVector: false,
    competitionMismatch: false,
    venueMismatch: false,
    courtMismatch: false,
    clubMismatch: false,
    customerMismatch: false,
    playerMismatch: false,
    teamMismatch: false,
    financeScopeMismatch: false,
    rankingSystemMismatch: false,
    ratingSystemMismatch: false,
    arbitraryEntityFallback: false,
    accessStateSemantics: {
      denyEqualsEmpty: false,
      suppressEqualsZero: false,
      redactEqualsMissing: false,
      omitEqualsRedact: false,
    },
    restrictedMetricExposed: false,
    restrictedDimensionExposed: false,
    suppressedAlertLeak: false,
    aiIncludesDenied: false,
    aiIncludesSuppressed: false,
    aiIncludesRedactedOriginal: false,
    mixedCurrencyScalarAccepted: false,
    currencyConversionPerformed: false,
    bookingTreatedAsRevenue: false,
    paymentTreatedAsRecognizedRevenue: false,
    rankingRecalculated: false,
    ratingRecalculated: false,
    standingsRecalculated: false,
    winnerInferredFromInvalid: false,
    unknownOutcomeConvertedToLoss: false,
    inventedSkillScore: false,
    alertWriteCapable: false,
    insightExecutesCommand: false,
    providerSdkPresent: false,
    networkIntegrationPresent: false,
    secretOrApiKeyPresent: false,
    prohibitedUseCaseAllowed: false,
    highRiskWithoutReview: false,
    aiOutputClaimsCanonical: false,
    aiWriteCapable: false,
    malformedResponseAccepted: false,
    confidenceFabricated: false,
    hiddenPromptExposed: false,
    writeDetected: false,
    globalMutableSingleton: false,
    sqlImport: false,
    databaseClientImport: false,
    browserStorageFallback: false,
    platformCorePrivateImport: false,
    businessModulePrivateImport: false,
    notificationDeliveryImport: false,
    secretOrPiiLeakage: false,
    mockClaimsLive: false,
    inMemoryClaimsProduction: false,
    missingSourceSilentSuccess: false,
    emptyEqualsUnavailable: false,
    deniedEqualsEmpty: false,
    suppressedEqualsEmpty: false,
    staleWarningDropped: false,
    incompleteClaimsComplete: false,
    provenanceDropped: false,
    requiredTestMissing: false,
    requiredDocsMissing: false,
    ciRegistrationMissing: false,
    ownershipLockMissing: false,
    contractIncompatible: false,
    queryResultIncompatible: false,
    historicalIncompatible: false,
    dashboardIncompatible: false,
    alertPayloadIncompatible: false,
    aiPresentationIncompatible: false,
    ...overrides,
  });
}

/**
 * @param {unknown} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createInMemoryIntelligenceAnalyticsCertificationSource(
  options = {}
) {
  if (!isPlainObject(options)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_SOURCE_FAILURE,
        "createInMemoryIntelligenceAnalyticsCertificationSource requires options object",
        "options"
      )
    );
  }

  const inventory = createCleanCertificationInventory(
    isPlainObject(options.inventoryOverrides) ? options.inventoryOverrides : {}
  );

  let loadCount = 0;
  const shouldFail = options.failOnLoad === true;

  const source = deepFreeze({
    kind: "CERTIFICATION_ONLY",
    isProduction: false,
    claimsLive: false,
    description:
      "In-memory Intelligence & Analytics certification source (foundation-only)",
    load() {
      loadCount += 1;
      if (shouldFail) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTEGRATION_SOURCE_FAILURE,
            "Certification source failure",
            "source"
          )
        );
      }
      return ok(inventory);
    },
    getLoadCount() {
      return loadCount;
    },
  });

  return ok(source);
}

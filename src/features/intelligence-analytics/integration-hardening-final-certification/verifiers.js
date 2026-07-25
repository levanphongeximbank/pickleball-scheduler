/**
 * Integration certification verifiers (I&A-13).
 * Operate on explicit certification inventory snapshots — fail closed.
 */

import { fail } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { isNonEmptyString, isPlainObject } from "../contracts/shared.js";
import {
  ANALYTICS_ACCESS_STATE_SEMANTICS,
  ANALYTICS_CERTIFICATION_REASON_CODE,
  ANALYTICS_CERTIFICATION_SEVERITY,
  ANALYTICS_CERTIFICATION_STATUS,
} from "./enums.js";

/**
 * @typedef {{
 *   status: string,
 *   reasonCode: string,
 *   warning?: boolean,
 *   severity?: string,
 *   safeDetails?: Record<string, unknown>
 * }} VerifyOutcome
 */

/**
 * @param {string} status
 * @param {string} reasonCode
 * @param {Record<string, unknown>} [safeDetails]
 * @param {{ warning?: boolean, severity?: string }} [opts]
 * @returns {VerifyOutcome}
 */
function outcome(status, reasonCode, safeDetails = {}, opts = {}) {
  return {
    status,
    reasonCode,
    warning: opts.warning === true,
    severity: opts.severity || ANALYTICS_CERTIFICATION_SEVERITY.BLOCKER,
    safeDetails,
  };
}

function pass(reasonCode = ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_PASSED, safeDetails) {
  return outcome(ANALYTICS_CERTIFICATION_STATUS.PASS, reasonCode, safeDetails);
}

function failOutcome(reasonCode, safeDetails) {
  return outcome(ANALYTICS_CERTIFICATION_STATUS.FAIL, reasonCode, safeDetails);
}

function blocked(reasonCode, safeDetails) {
  return outcome(ANALYTICS_CERTIFICATION_STATUS.BLOCKED, reasonCode, safeDetails);
}

/**
 * @param {unknown} inventory
 * @returns {boolean}
 */
function hasInventory(inventory) {
  return isPlainObject(inventory);
}

/**
 * Public export integrity.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyPublicExportIntegrity(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  const exports = Array.isArray(inventory.publicExports)
    ? inventory.publicExports
    : [];
  const required = Array.isArray(inventory.requiredExports)
    ? inventory.requiredExports
    : [];
  const names = exports.map((e) =>
    isPlainObject(e) ? e.name : e
  );

  for (const req of required) {
    if (!names.includes(req)) {
      return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.EXPORT_MISSING, {
        exportName: String(req),
      });
    }
  }

  const seen = new Set();
  for (const name of names) {
    if (seen.has(name)) {
      return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.EXPORT_DUPLICATE, {
        exportName: String(name),
      });
    }
    seen.add(name);
  }

  for (const item of exports) {
    if (!isPlainObject(item)) continue;
    if (item.broken === true) {
      return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.EXPORT_BROKEN, {
        exportName: String(item.name || "unknown"),
      });
    }
    if (item.mutablePrivate === true) {
      return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.EXPORT_MUTABLE, {
        exportName: String(item.name || "unknown"),
      });
    }
    if (item.writeCapable === true) {
      return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.EXPORT_WRITE_CAPABLE, {
        exportName: String(item.name || "unknown"),
      });
    }
  }

  return pass();
}

/**
 * Metric registry integrity.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyMetricRegistryIntegrity(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  const metrics = Array.isArray(inventory.metrics) ? inventory.metrics : [];
  /** @type {Map<string, Record<string, unknown>>} */
  const byKey = new Map();

  for (const metric of metrics) {
    if (!isPlainObject(metric)) continue;
    const id = String(metric.metricId || "");
    const version = String(metric.version || "");
    const key = `${id}@${version}`;

    if (metric.unitRequired === true && !isNonEmptyString(metric.unit)) {
      return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.METRIC_MISSING_UNIT, {
        metricId: id,
      });
    }

    if (
      metric.lifecycle === "deprecated" &&
      isNonEmptyString(metric.replacementMetricId)
    ) {
      const replacementExists = metrics.some(
        (m) =>
          isPlainObject(m) &&
          m.metricId === metric.replacementMetricId &&
          (metric.replacementVersion == null ||
            m.version === metric.replacementVersion)
      );
      if (!replacementExists && metric.replacementBroken !== false) {
        if (metric.replacementBroken === true) {
          return failOutcome(
            ANALYTICS_CERTIFICATION_REASON_CODE.METRIC_REPLACEMENT_BROKEN,
            { metricId: id }
          );
        }
      }
    }

    if (metric.replacementBroken === true) {
      return failOutcome(
        ANALYTICS_CERTIFICATION_REASON_CODE.METRIC_REPLACEMENT_BROKEN,
        { metricId: id }
      );
    }

    const prior = byKey.get(key);
    if (prior) {
      const equivalent =
        prior.unit === metric.unit &&
        prior.aggregation === metric.aggregation &&
        prior.definitionHash === metric.definitionHash;
      if (!equivalent) {
        return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.METRIC_CONFLICT, {
          metricId: id,
          version,
        });
      }
      // equivalent duplicate — idempotent OK
      continue;
    }
    byKey.set(key, metric);
  }

  return pass();
}

/**
 * Error registry integrity.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyErrorRegistryIntegrity(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  const errors = Array.isArray(inventory.errors) ? inventory.errors : [];
  /** @type {Map<string, string>} */
  const byCode = new Map();

  for (const entry of errors) {
    if (!isPlainObject(entry)) continue;
    const code = String(entry.code || "");
    const semantics = String(entry.semantics || "");

    if (entry.unsafeMessage === true) {
      return failOutcome(
        ANALYTICS_CERTIFICATION_REASON_CODE.ERROR_UNSAFE_MESSAGE,
        { code }
      );
    }
    if (entry.rawObjectLeakage === true) {
      return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.ERROR_RAW_LEAKAGE, {
        code,
      });
    }

    const prior = byCode.get(code);
    if (prior !== undefined && prior !== semantics) {
      return failOutcome(
        ANALYTICS_CERTIFICATION_REASON_CODE.ERROR_CODE_CONFLICT,
        { code }
      );
    }
    byCode.set(code, semantics);
  }

  return pass();
}

/**
 * Tenant isolation.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyTenantIsolation(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  if (inventory.tenantMissing === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.TENANT_MISSING);
  }
  if (inventory.mixedTenant === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.TENANT_MIXED);
  }
  if (inventory.crossTenantHistorical === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.TENANT_MIXED, {
      surface: "historical",
    });
  }
  if (inventory.crossTenantDashboard === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.TENANT_MIXED, {
      surface: "dashboard",
    });
  }
  if (inventory.crossTenantAlert === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.TENANT_MIXED, {
      surface: "alert",
    });
  }
  if (inventory.crossTenantAiFeatureVector === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.TENANT_MIXED, {
      surface: "ai",
    });
  }
  return pass();
}

/**
 * Entity isolation.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyEntityIsolation(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  const mismatches = [
    ["competitionMismatch", "competition"],
    ["venueMismatch", "venue"],
    ["courtMismatch", "court"],
    ["clubMismatch", "club"],
    ["customerMismatch", "customer"],
    ["playerMismatch", "player"],
    ["teamMismatch", "team"],
    ["financeScopeMismatch", "finance"],
    ["rankingSystemMismatch", "rankingSystem"],
    ["ratingSystemMismatch", "ratingSystem"],
  ];
  for (const [flag, entity] of mismatches) {
    if (inventory[flag] === true) {
      return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.ENTITY_MISMATCH, {
        entity,
      });
    }
  }
  if (inventory.arbitraryEntityFallback === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.ENTITY_FALLBACK);
  }
  return pass();
}

/**
 * Privacy / access state integrity.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyPrivacyAccess(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }

  const states = isPlainObject(inventory.accessStateSemantics)
    ? inventory.accessStateSemantics
    : null;

  if (states) {
    if (states.denyEqualsEmpty === true) {
      return failOutcome(
        ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
        { pair: "DENY_EMPTY" }
      );
    }
    if (states.suppressEqualsZero === true) {
      return failOutcome(
        ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
        { pair: "SUPPRESS_ZERO" }
      );
    }
    if (states.redactEqualsMissing === true) {
      return failOutcome(
        ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
        { pair: "REDACT_MISSING" }
      );
    }
    if (states.omitEqualsRedact === true) {
      return failOutcome(
        ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
        { pair: "OMIT_REDACT" }
      );
    }
  }

  if (inventory.restrictedMetricExposed === true) {
    return failOutcome(
      ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
      { surface: "restricted-metric" }
    );
  }
  if (inventory.restrictedDimensionExposed === true) {
    return failOutcome(
      ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
      { surface: "restricted-dimension" }
    );
  }
  if (inventory.suppressedAlertLeak === true) {
    return failOutcome(
      ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
      { surface: "alert-evidence" }
    );
  }
  if (inventory.aiIncludesDenied === true) {
    return failOutcome(
      ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
      { surface: "ai-denied" }
    );
  }
  if (inventory.aiIncludesSuppressed === true) {
    return failOutcome(
      ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
      { surface: "ai-suppressed" }
    );
  }
  if (inventory.aiIncludesRedactedOriginal === true) {
    return failOutcome(
      ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
      { surface: "ai-redacted-original" }
    );
  }

  // Canonical semantics markers must remain distinct.
  const requiredDistinct = [
    ANALYTICS_ACCESS_STATE_SEMANTICS.DENY,
    ANALYTICS_ACCESS_STATE_SEMANTICS.EMPTY,
    ANALYTICS_ACCESS_STATE_SEMANTICS.SUPPRESS,
    ANALYTICS_ACCESS_STATE_SEMANTICS.ZERO,
    ANALYTICS_ACCESS_STATE_SEMANTICS.REDACT,
    ANALYTICS_ACCESS_STATE_SEMANTICS.MISSING,
    ANALYTICS_ACCESS_STATE_SEMANTICS.OMIT,
  ];
  if (new Set(requiredDistinct).size !== requiredDistinct.length) {
    return failOutcome(
      ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE
    );
  }

  return pass();
}

/**
 * Currency compatibility.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyCurrencyCompatibility(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  if (inventory.mixedCurrencyScalarAccepted === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CURRENCY_MIXED);
  }
  if (inventory.currencyConversionPerformed === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CURRENCY_CONVERSION);
  }
  if (inventory.bookingTreatedAsRevenue === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CURRENCY_MIXED, {
      surface: "booking-as-revenue",
    });
  }
  if (inventory.paymentTreatedAsRecognizedRevenue === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CURRENCY_MIXED, {
      surface: "payment-as-recognized-revenue",
    });
  }
  return pass();
}

/**
 * Ranking / rating compatibility.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyRankingRatingCompatibility(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  if (inventory.rankingRecalculated === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.RANKING_RECALCULATED);
  }
  if (inventory.ratingRecalculated === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.RATING_RECALCULATED);
  }
  if (inventory.standingsRecalculated === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.RANKING_RECALCULATED, {
      surface: "standings",
    });
  }
  if (inventory.winnerInferredFromInvalid === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.RANKING_RECALCULATED, {
      surface: "winner-inference",
    });
  }
  if (inventory.unknownOutcomeConvertedToLoss === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.RANKING_RECALCULATED, {
      surface: "unknown-outcome",
    });
  }
  if (inventory.inventedSkillScore === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.RATING_RECALCULATED, {
      surface: "invented-skill",
    });
  }
  return pass();
}

/**
 * Operational alert / insight compatibility.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyOperationalInsightCompatibility(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  if (inventory.alertWriteCapable === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.WRITE_DETECTED, {
      surface: "alert",
    });
  }
  if (inventory.insightExecutesCommand === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.WRITE_DETECTED, {
      surface: "insight",
    });
  }
  return pass();
}

/**
 * AI readiness boundary.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyAiReadinessBoundary(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  if (inventory.providerSdkPresent === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.PROVIDER_NETWORK, {
      surface: "sdk",
    });
  }
  if (inventory.networkIntegrationPresent === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.PROVIDER_NETWORK, {
      surface: "network",
    });
  }
  if (inventory.secretOrApiKeyPresent === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.SECRET_OR_PII, {
      surface: "ai-secret",
    });
  }
  if (inventory.prohibitedUseCaseAllowed === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "prohibited-use-case",
    });
  }
  if (inventory.highRiskWithoutReview === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "high-risk-review",
    });
  }
  if (inventory.aiOutputClaimsCanonical === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "canonical-claim",
    });
  }
  if (inventory.aiWriteCapable === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.WRITE_DETECTED, {
      surface: "ai",
    });
  }
  if (inventory.malformedResponseAccepted === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "malformed-response",
    });
  }
  if (inventory.confidenceFabricated === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "confidence",
    });
  }
  if (inventory.hiddenPromptExposed === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.SECRET_OR_PII, {
      surface: "prompt",
    });
  }
  return pass();
}

/**
 * Read-only / no-write / dependency boundaries.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyReadOnlyAndDependencyBoundaries(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  if (inventory.writeDetected === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.WRITE_DETECTED);
  }
  if (inventory.globalMutableSingleton === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.WRITE_DETECTED, {
      surface: "singleton",
    });
  }
  if (inventory.sqlImport === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.DATABASE_COUPLING, {
      surface: "sql",
    });
  }
  if (inventory.databaseClientImport === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.DATABASE_COUPLING, {
      surface: "database-client",
    });
  }
  if (inventory.browserStorageFallback === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.DATABASE_COUPLING, {
      surface: "browser-storage",
    });
  }
  if (inventory.platformCorePrivateImport === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.PRIVATE_IMPORT, {
      surface: "platform-core",
    });
  }
  if (inventory.businessModulePrivateImport === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.PRIVATE_IMPORT, {
      surface: "business-module",
    });
  }
  if (inventory.notificationDeliveryImport === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.PRIVATE_IMPORT, {
      surface: "notification",
    });
  }
  if (inventory.secretOrPiiLeakage === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.SECRET_OR_PII);
  }
  return pass();
}

/**
 * Mock honesty / source-state semantics.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyMockHonestyAndSourceStates(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  if (inventory.mockClaimsLive === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.MOCK_CLAIMS_LIVE);
  }
  if (inventory.inMemoryClaimsProduction === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.MOCK_CLAIMS_LIVE, {
      surface: "in-memory",
    });
  }
  if (inventory.missingSourceSilentSuccess === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.SILENT_SUCCESS);
  }
  if (inventory.emptyEqualsUnavailable === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.SILENT_SUCCESS, {
      pair: "EMPTY_UNAVAILABLE",
    });
  }
  if (inventory.deniedEqualsEmpty === true) {
    return failOutcome(
      ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
      { pair: "DENIED_EMPTY" }
    );
  }
  if (inventory.suppressedEqualsEmpty === true) {
    return failOutcome(
      ANALYTICS_CERTIFICATION_REASON_CODE.PRIVACY_STATE_COLLAPSE,
      { pair: "SUPPRESSED_EMPTY" }
    );
  }
  if (inventory.staleWarningDropped === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "stale-warning",
    });
  }
  if (inventory.incompleteClaimsComplete === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "completeness",
    });
  }
  if (inventory.provenanceDropped === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "provenance",
    });
  }
  if (inventory.sourceKind !== "CERTIFICATION_ONLY" && inventory.requireCertificationOnly === true) {
    return failOutcome(
      ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_CERTIFICATION_ONLY
    );
  }
  return pass();
}

/**
 * Docs / CI / ownership registration.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyDocumentationAndCi(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  if (inventory.requiredTestMissing === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.TEST_MISSING);
  }
  if (inventory.requiredDocsMissing === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.DOCS_MISSING);
  }
  if (inventory.ciRegistrationMissing === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CI_MISSING);
  }
  if (inventory.ownershipLockMissing === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "ownership-lock",
    });
  }
  return pass();
}

/**
 * Contract / composition compatibility flags.
 * @param {unknown} inventory
 * @returns {VerifyOutcome}
 */
export function verifyContractCompatibility(inventory) {
  if (!hasInventory(inventory)) {
    return blocked(ANALYTICS_CERTIFICATION_REASON_CODE.SOURCE_UNAVAILABLE);
  }
  if (inventory.contractIncompatible === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "contract",
    });
  }
  if (inventory.queryResultIncompatible === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "query-result",
    });
  }
  if (inventory.historicalIncompatible === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "historical",
    });
  }
  if (inventory.dashboardIncompatible === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "dashboard",
    });
  }
  if (inventory.alertPayloadIncompatible === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "alert-payload",
    });
  }
  if (inventory.aiPresentationIncompatible === true) {
    return failOutcome(ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED, {
      surface: "ai-presentation",
    });
  }
  return pass();
}

/**
 * Wrap source failures safely without leaking raw objects.
 * @param {unknown} error
 * @returns {import("../contracts/result.js").Result}
 */
export function wrapCertificationSourceFailure(error) {
  const code =
    isPlainObject(error) && isNonEmptyString(error.code)
      ? String(error.code)
      : ANALYTICS_ERROR_CODE.INTEGRATION_SOURCE_FAILURE;
  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.INTEGRATION_SOURCE_FAILURE,
      "Certification source failure",
      "source",
      {
        reasonCode: "SOURCE_FAILURE",
        upstreamCode: code,
      }
    )
  );
}

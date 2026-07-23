/**
 * Finance runtime capability report (Phase 1I).
 *
 * Frozen, accurate, no Production readiness claims.
 */

import { FINANCE_RUNTIME_MODE, FINANCE_PROVIDER_STRATEGY } from "./config.js";

/**
 * Static Staging certification reference (Phase 1H evidence).
 * Does not embed project URLs, tokens, or credentials.
 */
export const FINANCE_STAGING_CERTIFICATION_REFERENCE = Object.freeze({
  phase: "1H",
  document: "src/features/finance/persistence/staging/PHASE_1H_STAGING_CERTIFICATION.md",
  verdictClass: "READY_WITH_CONDITIONS",
  stagingCertified: true,
  productionAuthorized: false,
  sqlSchemaExpected: true,
  schemaNamespace: "public.finance_*",
});

/**
 * @param {object} params
 * @returns {Readonly<object>}
 */
export function buildFinanceCapabilityReport(params) {
  const {
    config,
    durablePersistenceAvailable = false,
    multiRecordTransactionCapability = false,
    providerInitiationAvailable = false,
    providerVerificationAvailable = false,
    refundProviderCapability = false,
    appendOnlyEventPersistence = false,
    tenantIsolationBoundary = "explicit-per-command",
    knownLimitations = [],
  } = params;

  const enabled = config.enabled === true && config.mode !== FINANCE_RUNTIME_MODE.DISABLED;

  const limitations = [
    ...knownLimitations,
    "Phase 1I does not authorize Production activation.",
    "Phase 1I does not wire Finance into Booking, Tournament, Competition, or UI.",
    "No live payment provider is authorized.",
  ];

  if (config.mode === FINANCE_RUNTIME_MODE.MEMORY) {
    limitations.push("Memory mode is non-durable and isolated per factory call.");
  }
  if (config.mode === FINANCE_RUNTIME_MODE.SUPABASE && !multiRecordTransactionCapability) {
    limitations.push(
      "Supabase adapter multi-record atomicity is unavailable without injected transactional executor."
    );
  }
  if (config.providerStrategy === FINANCE_PROVIDER_STRATEGY.NONE) {
    limitations.push("Provider strategy is none — initiation/verification not available.");
  }
  if (config.providerStrategy === FINANCE_PROVIDER_STRATEGY.MOCK) {
    limitations.push("Mock provider does not auto-confirm payments; application verification still required.");
  }

  return Object.freeze({
    financeEnabled: enabled,
    runtimeMode: config.mode,
    durablePersistenceAvailable: Boolean(durablePersistenceAvailable),
    sqlSchemaExpected: FINANCE_STAGING_CERTIFICATION_REFERENCE.sqlSchemaExpected,
    stagingCertified:
      config.mode === FINANCE_RUNTIME_MODE.SUPABASE
        ? FINANCE_STAGING_CERTIFICATION_REFERENCE.stagingCertified
        : false,
    stagingCertificationReference: Object.freeze({
      phase: FINANCE_STAGING_CERTIFICATION_REFERENCE.phase,
      document: FINANCE_STAGING_CERTIFICATION_REFERENCE.document,
      verdictClass: FINANCE_STAGING_CERTIFICATION_REFERENCE.verdictClass,
    }),
    productionAuthorized: false,
    providerStrategy: config.providerStrategy,
    providerInitiationAvailable: Boolean(providerInitiationAvailable),
    providerVerificationAvailable: Boolean(providerVerificationAvailable),
    refundProviderCapability: Boolean(refundProviderCapability),
    multiRecordTransactionCapability: Boolean(multiRecordTransactionCapability),
    appendOnlyEventPersistence: Boolean(appendOnlyEventPersistence),
    tenantIsolationBoundary,
    tenantStrategy: config.tenantStrategy,
    knownLimitations: Object.freeze([...new Set(limitations)]),
  });
}

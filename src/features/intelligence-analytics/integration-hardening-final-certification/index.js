/**
 * I&A-13 — Integration Hardening and Final Certification public barrel.
 */

export {
  INTEGRATION_HARDENING_FINAL_CERTIFICATION_METHOD_VERSION,
  CERTIFICATION_MANIFEST_VERSION,
  CERTIFICATION_VERSION,
  ANALYTICS_CERTIFICATION_STATUS,
  ANALYTICS_CERTIFICATION_SEVERITY,
  ANALYTICS_CERTIFICATION_DIMENSION_ID,
  ANALYTICS_SURFACE_CLASSIFICATION,
  ANALYTICS_CERTIFICATION_COMPLETENESS,
  ANALYTICS_CERTIFICATION_REASON_CODE,
  ANALYTICS_ACCESS_STATE_SEMANTICS,
  INTEGRATION_DEFERRED_SURFACES,
  isCertificationEnumValue,
} from "./enums.js";

export { createSafeCertificationFingerprint } from "./fingerprint.js";

export {
  CANONICAL_CERTIFIED_SURFACES,
  createIntelligenceAnalyticsCertifiedSurface,
  validateCertifiedSurfaceRegistry,
  listCanonicalCertifiedSurfaces,
} from "./surfaces.js";

export {
  CANONICAL_CERTIFICATION_DIMENSIONS,
  createIntelligenceAnalyticsCertificationDimension,
  listCanonicalCertificationDimensions,
} from "./dimensions.js";

export {
  createIntelligenceAnalyticsCertificationManifest,
  buildDefaultIntelligenceAnalyticsCertificationManifest,
  fingerprintCertificationManifest,
} from "./manifest.js";

export {
  createIntelligenceAnalyticsCertificationScenario,
  createIntelligenceAnalyticsCertificationEvidence,
  createIntelligenceAnalyticsCertificationResult,
  createIntelligenceAnalyticsFinalReport,
} from "./contracts.js";

export {
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
  wrapCertificationSourceFailure,
} from "./verifiers.js";

export {
  runIntelligenceAnalyticsFinalCertification,
  verifyIntelligenceAnalyticsClosureReadiness,
} from "./runner.js";

export {
  createCleanCertificationInventory,
  createInMemoryIntelligenceAnalyticsCertificationSource,
} from "./inMemorySource.js";

export {
  createIntelligenceAnalyticsFinalCertificationFacade,
  createReadOnlyIntelligenceAnalyticsFinalCertificationFacade,
} from "./facade.js";

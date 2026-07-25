/**
 * I&A-11 — Privacy, Tenant Isolation and Access Certification public barrel.
 */

export {
  ANALYTICS_DATA_CLASSIFICATION,
  ANALYTICS_DATA_CLASSIFICATION_RANK,
  ANALYTICS_ACCESS_DECISION,
  ANALYTICS_PRIVACY_PAYLOAD_STATE,
  ANALYTICS_ENTITY_SCOPE_KIND,
  ANALYTICS_PRIVACY_REASON_CODE,
  PRIVACY_ACCESS_CERTIFICATION_METHOD_VERSION,
  PRIVACY_ACCESS_CERTIFICATION_COMPLETENESS,
  isPrivacyEnumValue,
} from "./enums.js";

export {
  validateDataClassification,
  resolveMostRestrictiveClassification,
  resolveClassificationInheritance,
  createAnalyticsDataClassificationRef,
} from "./classification.js";

export {
  createAnalyticsPrivacyPolicyReference,
  createAnalyticsPrincipalReference,
  createAnalyticsPrivacyTenantScope,
  createAnalyticsPrivacyEntityScope,
  createAnalyticsMetricAccessGrant,
  createAnalyticsDimensionAccessGrant,
  createAnalyticsPrivacyAccessContext,
} from "./accessContext.js";

export {
  createAnalyticsPrivacyPolicy,
  createAnalyticsAccessDecision,
} from "./policy.js";

export {
  requireTrustedAccessContext,
  certifyTenantIsolation,
  certifyEntityIsolation,
} from "./guards.js";

export {
  evaluateMetricAccess,
  evaluateDimensionAccess,
  filterMetricDiscovery,
} from "./metricDimensionAccess.js";

export {
  evaluateSmallCohortSuppression,
  evaluateRedactionAndOmission,
} from "./suppressionRedaction.js";

export {
  sanitizePrivacySafeText,
  sanitizePrivacySafeError,
  wrapPrivacyPolicySourceFailure,
} from "./errorSanitizer.js";

export {
  projectHistoricalResultPrivacy,
  projectDashboardReportPrivacy,
  projectAlertInsightPrivacy,
} from "./projectors.js";

export {
  createPrivacyCertificationScenario,
  createPrivacyCertificationEvidence,
  createPrivacyCertificationReport,
  runPrivacyCertificationSuite,
} from "./certification.js";

export { createInMemoryPrivacyPolicySource } from "./inMemoryPolicySource.js";

export {
  createPrivacyAccessCertificationFacade,
  createReadOnlyPrivacyAccessCertificationFacade,
} from "./facade.js";

/**
 * I&A-08 — Customer and Player Analytics public barrel.
 */

export {
  CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION,
  CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS,
  ENTITY_LIFECYCLE_BUCKET,
  PROFILE_COMPLETENESS_STATUS,
  isCustomerPlayerAnalyticsEnumValue,
} from "./enums.js";

export {
  FORBIDDEN_PII_FACT_KEYS,
  rejectForbiddenPiiFields,
  sanitizeErrorMessage,
} from "./privacy.js";

export { createCustomerPlayerAnalyticsContext } from "./context.js";

export {
  createCustomerAnalyticalFact,
  createCustomerLifecycleFact,
  createCustomerProfileCompletenessFact,
  createCustomerActivityFact,
  createPlayerAnalyticalFact,
  createPlayerLifecycleFact,
  createPlayerProfileCompletenessFact,
  createPlayerActivityFact,
  createCustomerPlayerLinkFact,
  createPlayerCompetitionParticipationFact,
  createPlayerClubMembershipFact,
} from "./facts.js";

export { createCustomerPlayerAnalyticsSnapshot } from "./snapshot.js";

export { guardCustomerPlayerAnalyticsSnapshot } from "./guards.js";

export {
  createCustomerPlayerAnalyticsSourceRequest,
  createCustomerPlayerAnalyticsSourceResponse,
  wrapCustomerPlayerSourceFailure,
  isCustomerPlayerAnalyticsSourceAdapter,
} from "./sourceAdapter.js";

export { createInMemoryCustomerPlayerAnalyticsSource } from "./inMemorySource.js";

export {
  CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS,
  CUSTOMER_PLAYER_ANALYTICS_METRIC_SOURCE,
  createCustomerPlayerAnalyticsMetricDefinitions,
  createCustomerPlayerAnalyticsMetricCatalogEntries,
} from "./metrics.js";

export {
  createCustomerPlayerAnalyticsQuery,
  normalizeCustomerPlayerAnalyticsQuery,
} from "./query.js";

export {
  mapEntityLifecycleBucket,
  mapProfileCompletenessStatus,
  projectCustomerSummary,
  projectPlayerSummary,
  projectCustomerPlayerLinkage,
  projectCustomerPlayerActivity,
  projectPlayerCompetitionParticipation,
  projectPlayerClubMembership,
  projectCustomerPlayerSummary,
} from "./projections.js";

export { composeCustomerPlayerHistoricalObservations } from "./historical.js";

export { composeCustomerPlayerDashboardPayloads } from "./dashboardPayloads.js";

export {
  createCustomerPlayerAnalyticsFacade,
  createReadOnlyCustomerPlayerAnalyticsFacade,
} from "./facade.js";

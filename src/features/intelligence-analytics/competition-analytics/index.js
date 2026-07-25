/**
 * I&A-06 — Competition Analytics public barrel.
 */

export {
  COMPETITION_ANALYTICS_METHOD_VERSION,
  COMPETITION_SCHEDULE_ON_TIME_THRESHOLD_SECONDS_DEFAULT,
  COMPETITION_PROGRESS_EXCLUSION_POLICY,
  COMPETITION_ANALYTICS_COMPLETENESS,
  COMPETITION_MATCH_LIFECYCLE_BUCKET,
  COMPETITION_RESULT_ACCEPTANCE_BUCKET,
  isCompetitionAnalyticsEnumValue,
} from "./enums.js";

export { createCompetitionAnalyticsContext } from "./context.js";

export {
  createCompetitionParticipantFact,
  createCompetitionEntryFact,
  createCompetitionRegistrationFact,
  createCompetitionDivisionFact,
  createCompetitionCategoryFact,
  createCompetitionTeamFact,
  createCompetitionRosterFact,
  createCompetitionMatchFact,
  createCompetitionScheduleFact,
  createCompetitionAssignmentFact,
  createCompetitionResultFact,
  createCompetitionStandingsSnapshotFact,
  createCompetitionRankingSnapshotFact,
} from "./facts.js";

export { createCompetitionAnalyticsSnapshot } from "./snapshot.js";

export { guardCompetitionAnalyticsSnapshot } from "./guards.js";

export {
  createCompetitionAnalyticsSourceRequest,
  createCompetitionAnalyticsSourceResponse,
  wrapCompetitionSourceFailure,
  isCompetitionAnalyticsSourceAdapter,
} from "./sourceAdapter.js";

export { createInMemoryCompetitionAnalyticsSource } from "./inMemorySource.js";

export {
  COMPETITION_ANALYTICS_METRIC_IDS,
  COMPETITION_ANALYTICS_METRIC_SOURCE,
  createCompetitionAnalyticsMetricDefinitions,
  createCompetitionAnalyticsMetricCatalogEntries,
} from "./metrics.js";

export {
  createCompetitionAnalyticsQuery,
  normalizeCompetitionAnalyticsQuery,
} from "./query.js";

export {
  mapLifecycleBucket,
  mapAcceptanceBucket,
  projectCompetitionDistributions,
  projectCompetitionProgress,
  projectCompetitionResultAcceptance,
  projectCompetitionScheduleAdherence,
  projectCompetitionDurations,
  projectCompetitionAssignments,
  projectCompetitionStandingsConsumption,
  projectCompetitionSummary,
} from "./projections.js";

export { composeCompetitionHistoricalObservations } from "./historical.js";

export { composeCompetitionDashboardPayloads } from "./dashboardPayloads.js";

export {
  createCompetitionAnalyticsFacade,
  createReadOnlyCompetitionAnalyticsFacade,
} from "./facade.js";

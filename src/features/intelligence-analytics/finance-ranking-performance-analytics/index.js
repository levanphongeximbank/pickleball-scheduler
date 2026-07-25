/**
 * I&A-09 — Finance, Ranking and Performance Analytics public barrel.
 */

export {
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION,
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_COMPLETENESS,
  RANK_DIRECTION,
  PERFORMANCE_OUTCOME,
  OUTCOME_VALIDATION_STATUS,
  RECEIVABLE_STATUS_BUCKET,
  PERFORMANCE_ENTITY_TYPE,
  isFinanceRankingPerformanceAnalyticsEnumValue,
} from "./enums.js";

export {
  FORBIDDEN_PII_AND_PAYMENT_FACT_KEYS,
  rejectForbiddenSensitiveFields,
  sanitizeErrorMessage,
} from "./privacy.js";

export {
  createAnalyticalMoney,
  assertSameCurrency,
  sumCompatibleAnalyticalMoney,
} from "./money.js";

export { createFinanceRankingPerformanceAnalyticsContext } from "./context.js";

export {
  createFinanceTransactionFact,
  createFinanceInvoiceFact,
  createFinancePaymentFact,
  createFinanceRefundFact,
  createFinanceSettlementFact,
  createFinanceReceivableFact,
  createFinanceRecognizedAmountFact,
  createRankingSystemFact,
  createRankingSnapshotFact,
  createRankingPositionFact,
  createRatingSnapshotFact,
  createRatingChangeFact,
  createPerformanceParticipationFact,
  createPerformanceMatchFact,
  createPerformanceOutcomeFact,
} from "./facts.js";

export { createFinanceRankingPerformanceAnalyticsSnapshot } from "./snapshot.js";

export { guardFinanceRankingPerformanceAnalyticsSnapshot } from "./guards.js";

export {
  createFinanceRankingPerformanceAnalyticsSourceRequest,
  createFinanceRankingPerformanceAnalyticsSourceResponse,
  wrapFinanceRankingPerformanceSourceFailure,
  isFinanceRankingPerformanceAnalyticsSourceAdapter,
} from "./sourceAdapter.js";

export { createInMemoryFinanceRankingPerformanceAnalyticsSource } from "./inMemorySource.js";

export {
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS,
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_SOURCE,
  createFinanceRankingPerformanceAnalyticsMetricDefinitions,
  createFinanceRankingPerformanceAnalyticsMetricCatalogEntries,
} from "./metrics.js";

export {
  createFinanceRankingPerformanceAnalyticsQuery,
  normalizeFinanceRankingPerformanceAnalyticsQuery,
} from "./query.js";

export {
  projectFinanceSummary,
  projectRankingSummary,
  projectRankingMovement,
  projectRatingSummary,
  projectPerformanceSummary,
  projectFinanceRankingPerformanceSummary,
} from "./projections.js";

export { composeFinanceRankingPerformanceHistoricalObservations } from "./historical.js";

export { composeFinanceRankingPerformanceDashboardPayloads } from "./dashboardPayloads.js";

export {
  createFinanceRankingPerformanceAnalyticsFacade,
  createReadOnlyFinanceRankingPerformanceAnalyticsFacade,
} from "./facade.js";

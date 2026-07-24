/**
 * I&A-03 — Analytics Query and Projection Runtime public barrel.
 */

export {
  createAnalyticsRuntimeContext,
  createAnalyticsAccessContext,
} from "./context.js";
export { createAnalyticsObservation } from "./observation.js";
export {
  createAnalyticsSourceRequest,
  createAnalyticsSourceResponse,
  cloneAnalyticsSourceRequest,
  wrapSourceFailure,
} from "./sourceAdapter.js";
export { createInMemoryAnalyticsSourceAdapter } from "./inMemorySourceAdapter.js";
export {
  normalizeAnalyticsQuery,
  MAX_RESULT_LIMIT,
} from "./normalizeQuery.js";
export { validateAnalyticsQueryExecution } from "./validateExecution.js";
export {
  resolveMetricFromRegistry,
  validateQueryAgainstMetricDefinition,
} from "./resolveMetric.js";
export {
  applyObservationFilters,
  applyTenantGuard,
  applyTimeWindowFilter,
  groupObservations,
  orderDataPoints,
  buildGroupKey,
  observationMatchesFilter,
} from "./projectionPipeline.js";
export { executeAnalyticsProjection } from "./executeProjection.js";
export {
  createAnalyticsQueryRuntime,
  createReadOnlyAnalyticsQueryRuntime,
} from "./createAnalyticsQueryRuntime.js";

/**
 * I&A-02 — Metric Registry and Definition Governance public barrel.
 */

export {
  ANALYTICS_METRIC_LIFECYCLE_STATE,
  isAnalyticsMetricLifecycleState,
} from "./lifecycle.js";
export {
  ANALYTICS_METRIC_COMPATIBILITY,
  compareMetricDefinitions,
} from "./compatibility.js";
export {
  createAnalyticsMetricDeprecation,
  createAnalyticsMetricReplacementReference,
} from "./deprecation.js";
export { validateMetricDefinition } from "./validateMetricDefinition.js";
export {
  createAnalyticsMetricRegistryEntry,
  metricIdentityKey,
  stableDefinitionFingerprint,
  classifyRegistrationAgainstExisting,
} from "./entry.js";
export {
  ANALYTICS_METRIC_REGISTRATION_STATUS,
  createMetricRegistry,
} from "./createMetricRegistry.js";
export {
  buildReadOnlyMetricRegistry,
  createReadOnlyMetricRegistry,
} from "./createReadOnlyMetricRegistry.js";

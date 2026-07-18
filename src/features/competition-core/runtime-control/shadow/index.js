/**
 * Shadow Infrastructure public surface (Phase 3A.2).
 *
 * Infrastructure only:
 * - contracts / pure resolvers / comparison / diagnostics / audit factories
 * - no executor dispatch, persistence, Production wiring, or feature-flag enablement
 */

export {
  SHADOW_REASON_CODE,
  SHADOW_REASON_CODE_VALUES,
  isShadowReasonCode,
} from "./constants/shadowReasonCodes.js";

export {
  SHADOW_COMPARISON_STATUS,
  SHADOW_COMPARISON_STATUS_VALUES,
  isShadowComparisonStatus,
} from "./constants/shadowComparisonStatuses.js";

export {
  SHADOW_DIFFERENCE_KIND,
  SHADOW_DIFFERENCE_KIND_VALUES,
  isShadowDifferenceKind,
  SHADOW_DIFFERENCE_SEVERITY,
  SHADOW_DIFFERENCE_SEVERITY_VALUES,
  isShadowDifferenceSeverity,
  SHADOW_SEVERITY_RANK,
} from "./constants/shadowDifferenceKinds.js";

export {
  SHADOW_AUDIT_EVENT_TYPE,
  SHADOW_AUDIT_EVENT_TYPE_VALUES,
  isShadowAuditEventType,
} from "./constants/shadowAuditEventTypes.js";

export {
  SHADOW_PRIMARY_EXECUTION,
  SHADOW_SECONDARY_EXECUTION,
  SHADOW_RETURN_SOURCE,
  SHADOW_INFRASTRUCTURE_VERSION,
  SHADOW_COMPARATOR_VERSION,
} from "./constants/shadowExecutors.js";

export {
  createShadowExecutionRequest,
  assertShadowExecutionRequestShape,
} from "./contracts/shadowRequest.js";

export { createShadowEligibility } from "./contracts/shadowEligibility.js";

export { createShadowExecutionPlan } from "./contracts/shadowExecutionPlan.js";

export { createShadowResultEnvelope } from "./contracts/shadowResultEnvelope.js";

export { createShadowDifference } from "./contracts/shadowDifference.js";

export {
  createShadowNormalizationPolicy,
  createShadowNormalizationResult,
} from "./contracts/shadowNormalization.js";

export { createShadowComparisonResult } from "./contracts/shadowComparison.js";

export { createShadowDiagnostics } from "./contracts/shadowDiagnostics.js";

export {
  createShadowAuditEvent,
  createShadowEligibilityEvaluatedEvent,
  createShadowPlanCreatedEvent,
  createShadowExecutionSkippedEvent,
  createShadowComparisonCompletedEvent,
  createShadowDivergenceDetectedEvent,
} from "./contracts/shadowAuditEvents.js";

export { createShadowReportSummary } from "./contracts/shadowReportSummary.js";

export { resolveShadowEligibility } from "./resolvers/resolveShadowEligibility.js";
export { resolveShadowExecutionPlan } from "./resolvers/resolveShadowExecutionPlan.js";
export { normalizeShadowPayload } from "./resolvers/normalizeShadowPayload.js";
export { compareShadowResults } from "./resolvers/compareShadowResults.js";
export { summarizeShadowReport } from "./resolvers/summarizeShadowReport.js";
export { buildShadowDiagnostics } from "./resolvers/buildShadowDiagnostics.js";

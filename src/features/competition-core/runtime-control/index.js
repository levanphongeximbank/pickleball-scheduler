export {
  RUNTIME_SCOPE,
  RUNTIME_SCOPE_VALUES,
  isRuntimeScope,
  RUNTIME_CAPABILITY,
  RUNTIME_CAPABILITY_VALUES,
  isRuntimeCapability,
  CAPABILITY_FLAG_KEY,
  RUNTIME_FORMAT,
  RUNTIME_FORMAT_VALUES,
  isRuntimeFormat,
  FORMAT_FLAG_KEY,
  RUNTIME_EXECUTOR,
  RUNTIME_EXECUTOR_VALUES,
  isRuntimeExecutor,
  RUNTIME_CONTROL_VERSION,
} from "./constants/runtimeScopes.js";

export {
  RUNTIME_DECISION_CODE,
  RUNTIME_DECISION_CODE_VALUES,
  isRuntimeDecisionCode,
} from "./constants/runtimeDecisionCodes.js";

export {
  RUNTIME_MODE,
  RUNTIME_MODE_VALUES,
  isRuntimeMode,
  RUNTIME_MODE_TRANSITIONS,
  isRuntimeModeTransitionAllowed,
  isRuntimeModeActivatableInPhase3A1,
} from "./contracts/runtimeModes.js";

export {
  createExecutionContext,
  assertExecutionContextShape,
} from "./contracts/executionContext.js";

export {
  createDefaultFeatureFlagSnapshot,
  createFeatureFlagSnapshot,
} from "./contracts/featureFlagSnapshot.js";

export {
  createRuntimeOverride,
  assertRuntimeOverrideShape,
} from "./contracts/runtimeOverrides.js";

export {
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_SEVERITY_VALUES,
  createRuntimeDiagnostic,
} from "./contracts/decisionDiagnostics.js";

export {
  RUNTIME_AUDIT_EVENT_TYPE,
  createRuntimeAuditEvent,
} from "./contracts/auditEvents.js";

export {
  createRuntimeDecision,
  clampDecisionToPhase3A1,
} from "./contracts/runtimeDecision.js";

export { isJsonSafe, cloneJsonSafe } from "./contracts/jsonSafe.js";

export {
  validateExecutionContext,
  validateFeatureFlagSnapshot,
  validateRuntimeOverrides,
} from "./validation/validateExecutionContext.js";

export { resolveKillSwitch } from "./resolvers/resolveKillSwitch.js";
export {
  resolveFlagPrecedence,
  resolveRuntimeMode,
} from "./resolvers/resolveFlagPrecedence.js";
export { resolveRuntimeDecision } from "./resolvers/resolveRuntimeDecision.js";

/** Phase 3A.3 — Integration Bootstrap (empty registries; Integrator-owned). */
export {
  REGISTRY_REASON_CODE,
  REGISTRY_REASON_CODE_VALUES,
  isRegistryReasonCode,
  CAPABILITY_EXECUTOR_REGISTRY_VERSION,
  createCapabilityExecutorRegistry,
  defaultCapabilityExecutorRegistry,
  registerCapabilityExecutor,
  resolveCapabilityExecutor,
  getCapabilityExecutorRegistration,
  listCapabilityExecutorRegistrations,
  isCapabilityExecutorRegistryEmpty,
  unregisterCapabilityExecutor,
  freezeCapabilityExecutorRegistry,
  isCapabilityExecutorRegistryFrozen,
  resetCapabilityExecutorRegistryForTests,
  /** Phase 3B Integrator Wave 1 — explicit Participant capability registration. */
  PARTICIPANT_CAPABILITY_WAVE1_VERSION,
  PARTICIPANT_CAPABILITY_MODULE_PATHS,
  registerParticipantCapabilityWave1,
} from "./registries/index.js";

/** Phase 3A.2 — Shadow Infrastructure (contracts / pure resolvers only). */
export {
  SHADOW_REASON_CODE,
  SHADOW_REASON_CODE_VALUES,
  isShadowReasonCode,
  SHADOW_COMPARISON_STATUS,
  SHADOW_COMPARISON_STATUS_VALUES,
  isShadowComparisonStatus,
  SHADOW_DIFFERENCE_KIND,
  SHADOW_DIFFERENCE_KIND_VALUES,
  isShadowDifferenceKind,
  SHADOW_DIFFERENCE_SEVERITY,
  SHADOW_DIFFERENCE_SEVERITY_VALUES,
  isShadowDifferenceSeverity,
  SHADOW_AUDIT_EVENT_TYPE,
  SHADOW_AUDIT_EVENT_TYPE_VALUES,
  isShadowAuditEventType,
  SHADOW_PRIMARY_EXECUTION,
  SHADOW_SECONDARY_EXECUTION,
  SHADOW_RETURN_SOURCE,
  SHADOW_INFRASTRUCTURE_VERSION,
  SHADOW_COMPARATOR_VERSION,
  createShadowExecutionRequest,
  assertShadowExecutionRequestShape,
  createShadowEligibility,
  createShadowExecutionPlan,
  createShadowResultEnvelope,
  createShadowDifference,
  createShadowNormalizationPolicy,
  createShadowNormalizationResult,
  createShadowComparisonResult,
  createShadowDiagnostics,
  createShadowAuditEvent,
  createShadowEligibilityEvaluatedEvent,
  createShadowPlanCreatedEvent,
  createShadowExecutionSkippedEvent,
  createShadowComparisonCompletedEvent,
  createShadowDivergenceDetectedEvent,
  createShadowReportSummary,
  resolveShadowEligibility,
  resolveShadowExecutionPlan,
  normalizeShadowPayload,
  compareShadowResults,
  summarizeShadowReport,
  buildShadowDiagnostics,
  SHADOW_COMPARATOR_REGISTRY_VERSION,
  createShadowComparatorRegistry,
  defaultShadowComparatorRegistry,
  getShadowComparatorRegistration,
  listShadowComparatorRegistrations,
  isShadowComparatorRegistryEmpty,
  registerShadowComparator,
  resolveShadowComparator,
  unregisterShadowComparator,
  resetShadowComparatorRegistryForTests,
  SHADOW_NORMALIZER_REGISTRY_VERSION,
  createShadowNormalizerRegistry,
  defaultShadowNormalizerRegistry,
  getShadowNormalizerRegistration,
  listShadowNormalizerRegistrations,
  isShadowNormalizerRegistryEmpty,
  registerShadowNormalizer,
  resolveShadowNormalizer,
  unregisterShadowNormalizer,
  resetShadowNormalizerRegistryForTests,
  SHADOW_ELIGIBILITY_ALLOWLIST_REGISTRY_VERSION,
  createEligibilityAllowlistRegistry,
  defaultEligibilityAllowlistRegistry,
  getDefaultCapabilityAllowlist,
  getDefaultOperationAllowlist,
  getEligibilityAllowlistRegistration,
  resolveEligibilityAllowlist,
  resolveEligibilityAllowlistsFromRegistry,
  listEligibilityAllowlistRegistrations,
  isEligibilityAllowlistRegistryEmpty,
  registerEligibilityAllowlist,
  unregisterEligibilityAllowlist,
  resetEligibilityAllowlistRegistryForTests,
} from "./shadow/index.js";

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

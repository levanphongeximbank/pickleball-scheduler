/**
 * Finance runtime composition public surface (Phase 1I).
 */

export {
  FINANCE_RUNTIME_MODE,
  FINANCE_RUNTIME_MODE_VALUES,
  FINANCE_RUNTIME_ENVIRONMENT,
  FINANCE_RUNTIME_ENVIRONMENT_VALUES,
  FINANCE_TENANT_STRATEGY,
  FINANCE_TENANT_STRATEGY_VALUES,
  FINANCE_PROVIDER_STRATEGY,
  FINANCE_PROVIDER_STRATEGY_VALUES,
  FINANCE_PERSISTENCE_EXPECTATION,
  FINANCE_TRANSACTION_EXPECTATION,
  createDefaultFinanceRuntimeConfig,
  validateFinanceRuntimeConfig,
  isForbiddenRuntimeSecretKey,
} from "./config.js";

export {
  FINANCE_RUNTIME_ERROR_CODES,
  createFinanceRuntimeError,
  throwFinanceRuntimeError,
  throwRuntimeDisabled,
} from "./errors.js";

export {
  FINANCE_READINESS_STATE,
  FINANCE_READINESS_STATE_VALUES,
  FINANCE_DEFAULT_PROBE_TIMEOUT_MS,
  buildFinanceReadinessReport,
  serializeFinanceReadiness,
  deriveFinanceReadiness,
  inspectFinanceRuntimeHealth,
} from "./readiness.js";

export {
  FINANCE_STAGING_CERTIFICATION_REFERENCE,
  buildFinanceCapabilityReport,
} from "./capabilities.js";

export {
  createFinanceRuntime,
  createFinanceRuntimeTestHarness,
} from "./createFinanceRuntime.js";

export {
  FINANCE_STAGING_RUNTIME_FLAG,
  FINANCE_APP_ENV_KEY,
  FINANCE_APP_ENVIRONMENT,
  FINANCE_STAGING_ACTIVATION_REASON,
  classifyFinanceAppEnvironment,
  isFinanceStagingRuntimeFlagEnabled,
  readFinanceStagingEnvFromImportMeta,
  resolveFinanceStagingActivation,
} from "./stagingFlags.js";

export { createAuthenticatedFinanceTenantResolver } from "./adapters/createAuthenticatedFinanceTenantResolver.js";

export { createFinanceAppComposition } from "./createFinanceAppComposition.js";

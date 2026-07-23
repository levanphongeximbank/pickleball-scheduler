/**
 * Finance runtime configuration contract (Phase 1I).
 *
 * Explicit, validated, immutable after validation.
 * No environment variable reads. No secrets accepted.
 *
 * Unknown key policy: REJECT (fail closed). Documented here and in ARCHITECTURE.md.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { throwFinanceRuntimeError } from "./errors.js";

export const FINANCE_RUNTIME_MODE = Object.freeze({
  DISABLED: "disabled",
  MEMORY: "memory",
  SUPABASE: "supabase",
});

export const FINANCE_RUNTIME_MODE_VALUES = Object.freeze(
  Object.values(FINANCE_RUNTIME_MODE)
);

export const FINANCE_RUNTIME_ENVIRONMENT = Object.freeze({
  TEST: "test",
  DEVELOPMENT: "development",
  STAGING: "staging",
  PRODUCTION: "production",
});

export const FINANCE_RUNTIME_ENVIRONMENT_VALUES = Object.freeze(
  Object.values(FINANCE_RUNTIME_ENVIRONMENT)
);

export const FINANCE_TENANT_STRATEGY = Object.freeze({
  EXPLICIT_PER_COMMAND: "explicit-per-command",
  INJECTED_TRUSTED_RESOLVER: "injected-trusted-resolver",
});

export const FINANCE_TENANT_STRATEGY_VALUES = Object.freeze(
  Object.values(FINANCE_TENANT_STRATEGY)
);

export const FINANCE_PROVIDER_STRATEGY = Object.freeze({
  NONE: "none",
  MOCK: "mock",
});

export const FINANCE_PROVIDER_STRATEGY_VALUES = Object.freeze(
  Object.values(FINANCE_PROVIDER_STRATEGY)
);

export const FINANCE_PERSISTENCE_EXPECTATION = Object.freeze({
  NONE: "none",
  MEMORY_NON_DURABLE: "memory-non-durable",
  SUPABASE_DURABLE: "supabase-durable",
});

export const FINANCE_TRANSACTION_EXPECTATION = Object.freeze({
  NONE: "none",
  MEMORY_BEST_EFFORT: "memory-best-effort",
  SUPABASE_SINGLE_STATEMENT: "supabase-single-statement",
  SUPABASE_INJECTED_EXECUTOR: "supabase-injected-executor",
});

/** Keys rejected if present anywhere in raw config (secrets / credentials). */
const FORBIDDEN_SECRET_KEY_PATTERN =
  /^(.*[_.-]?)?(api[_-]?key|secret|password|passwd|token|service[_-]?role|private[_-]?key|access[_-]?key|credential|authorization|auth[_-]?header|connection[_-]?string|database[_-]?url|db[_-]?url|supabase[_-]?key|anon[_-]?key)([_.-].*)?$/i;

const ALLOWED_CONFIG_KEYS = Object.freeze([
  "enabled",
  "mode",
  "environment",
  "tenantStrategy",
  "providerStrategy",
  "persistenceExpectation",
  "transactionExpectation",
  "featureFlags",
  "diagnostics",
]);

const ALLOWED_FEATURE_FLAG_KEYS = Object.freeze([
  "allowMockProvider",
  "allowOptionalHealthProbes",
  "exposeTestHarness",
]);

const ALLOWED_DIAGNOSTICS_KEYS = Object.freeze([
  "includeKnownLimitations",
  "includeStagingCertificationReference",
  "redactUnmetDependencyDetails",
]);

/**
 * @param {unknown} key
 * @returns {boolean}
 */
export function isForbiddenRuntimeSecretKey(key) {
  if (typeof key !== "string" || !key.trim()) return false;
  return FORBIDDEN_SECRET_KEY_PATTERN.test(key.trim());
}

/**
 * Default Finance runtime configuration — disabled / opt-in.
 * @returns {object}
 */
export function createDefaultFinanceRuntimeConfig() {
  return Object.freeze({
    enabled: false,
    mode: FINANCE_RUNTIME_MODE.DISABLED,
    environment: FINANCE_RUNTIME_ENVIRONMENT.TEST,
    tenantStrategy: FINANCE_TENANT_STRATEGY.EXPLICIT_PER_COMMAND,
    providerStrategy: FINANCE_PROVIDER_STRATEGY.NONE,
    persistenceExpectation: FINANCE_PERSISTENCE_EXPECTATION.NONE,
    transactionExpectation: FINANCE_TRANSACTION_EXPECTATION.NONE,
    featureFlags: Object.freeze({
      allowMockProvider: false,
      allowOptionalHealthProbes: false,
      exposeTestHarness: false,
    }),
    diagnostics: Object.freeze({
      includeKnownLimitations: true,
      includeStagingCertificationReference: true,
      redactUnmetDependencyDetails: false,
    }),
  });
}

/**
 * @param {string} field
 * @param {string} message
 * @param {object} [context]
 * @returns {never}
 */
function rejectConfig(field, message, context = {}) {
  return throwFinanceRuntimeError(
    FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION,
    message,
    { field, ...context }
  );
}

/**
 * @param {object} raw
 * @param {string} path
 */
function assertNoSecretKeys(raw, path) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return;
  for (const key of Object.keys(raw)) {
    if (isForbiddenRuntimeSecretKey(key)) {
      rejectConfig(
        path ? `${path}.${key}` : key,
        "Finance runtime config must not contain secrets or credential keys.",
        { rejectedKey: key }
      );
    }
    const value = raw[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      assertNoSecretKeys(value, path ? `${path}.${key}` : key);
    }
  }
}

/**
 * @param {object} raw
 * @param {readonly string[]} allowed
 * @param {string} path
 */
function assertOnlyAllowedKeys(raw, allowed, path) {
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) {
      rejectConfig(
        path ? `${path}.${key}` : key,
        `Unknown Finance runtime config key rejected (fail-closed policy): ${key}`,
        { unknownKey: key, allowedKeys: [...allowed] }
      );
    }
  }
}

/**
 * @param {unknown} value
 * @param {readonly string[]} allowed
 * @param {string} field
 * @returns {string}
 */
function requireEnum(value, allowed, field) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    rejectConfig(field, `Invalid Finance runtime ${field}: ${String(value)}`, {
      allowedValues: [...allowed],
    });
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {boolean}
 */
function requireBoolean(value, field) {
  if (typeof value !== "boolean") {
    rejectConfig(field, `Finance runtime ${field} must be a boolean.`);
  }
  return value;
}

/**
 * @param {object} [flags]
 * @returns {object}
 */
function normalizeFeatureFlags(flags = {}) {
  assertOnlyAllowedKeys(flags, ALLOWED_FEATURE_FLAG_KEYS, "featureFlags");
  return Object.freeze({
    allowMockProvider: flags.allowMockProvider === true,
    allowOptionalHealthProbes: flags.allowOptionalHealthProbes === true,
    exposeTestHarness: flags.exposeTestHarness === true,
  });
}

/**
 * @param {object} [diagnostics]
 * @returns {object}
 */
function normalizeDiagnostics(diagnostics = {}) {
  assertOnlyAllowedKeys(diagnostics, ALLOWED_DIAGNOSTICS_KEYS, "diagnostics");
  return Object.freeze({
    includeKnownLimitations: diagnostics.includeKnownLimitations !== false,
    includeStagingCertificationReference:
      diagnostics.includeStagingCertificationReference !== false,
    redactUnmetDependencyDetails: diagnostics.redactUnmetDependencyDetails === true,
  });
}

/**
 * Infer persistence / transaction expectations from mode when omitted.
 * @param {string} mode
 * @param {object} raw
 */
function resolveExpectations(mode, raw) {
  let persistenceExpectation = raw.persistenceExpectation;
  let transactionExpectation = raw.transactionExpectation;

  if (persistenceExpectation == null) {
    if (mode === FINANCE_RUNTIME_MODE.DISABLED) {
      persistenceExpectation = FINANCE_PERSISTENCE_EXPECTATION.NONE;
    } else if (mode === FINANCE_RUNTIME_MODE.MEMORY) {
      persistenceExpectation = FINANCE_PERSISTENCE_EXPECTATION.MEMORY_NON_DURABLE;
    } else if (mode === FINANCE_RUNTIME_MODE.SUPABASE) {
      persistenceExpectation = FINANCE_PERSISTENCE_EXPECTATION.SUPABASE_DURABLE;
    }
  }

  if (transactionExpectation == null) {
    if (mode === FINANCE_RUNTIME_MODE.DISABLED) {
      transactionExpectation = FINANCE_TRANSACTION_EXPECTATION.NONE;
    } else if (mode === FINANCE_RUNTIME_MODE.MEMORY) {
      transactionExpectation = FINANCE_TRANSACTION_EXPECTATION.MEMORY_BEST_EFFORT;
    } else if (mode === FINANCE_RUNTIME_MODE.SUPABASE) {
      transactionExpectation = FINANCE_TRANSACTION_EXPECTATION.SUPABASE_SINGLE_STATEMENT;
    }
  }

  return {
    persistenceExpectation: requireEnum(
      persistenceExpectation,
      Object.values(FINANCE_PERSISTENCE_EXPECTATION),
      "persistenceExpectation"
    ),
    transactionExpectation: requireEnum(
      transactionExpectation,
      Object.values(FINANCE_TRANSACTION_EXPECTATION),
      "transactionExpectation"
    ),
  };
}

/**
 * Validate and freeze Finance runtime configuration.
 *
 * Omitted / null / undefined config → disabled defaults.
 *
 * @param {object|null|undefined} [rawConfig]
 * @returns {Readonly<object>}
 */
export function validateFinanceRuntimeConfig(rawConfig) {
  if (rawConfig == null) {
    return createDefaultFinanceRuntimeConfig();
  }
  if (typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    rejectConfig("config", "Finance runtime config must be a plain object.");
  }

  assertNoSecretKeys(rawConfig, "");
  assertOnlyAllowedKeys(rawConfig, ALLOWED_CONFIG_KEYS, "");

  const enabled =
    rawConfig.enabled == null ? false : requireBoolean(rawConfig.enabled, "enabled");

  const rawMode =
    rawConfig.mode == null
      ? enabled
        ? FINANCE_RUNTIME_MODE.MEMORY
        : FINANCE_RUNTIME_MODE.DISABLED
      : rawConfig.mode;

  if (typeof rawMode !== "string" || !FINANCE_RUNTIME_MODE_VALUES.includes(rawMode)) {
    throwFinanceRuntimeError(
      FINANCE_ERROR_CODES.UNSUPPORTED_RUNTIME_MODE,
      `Unsupported Finance runtime mode: ${String(rawMode)}`,
      {
        mode: rawMode,
        allowedModes: [...FINANCE_RUNTIME_MODE_VALUES],
      }
    );
  }

  const mode = rawMode;

  const environment = requireEnum(
    rawConfig.environment == null
      ? FINANCE_RUNTIME_ENVIRONMENT.TEST
      : rawConfig.environment,
    FINANCE_RUNTIME_ENVIRONMENT_VALUES,
    "environment"
  );

  const tenantStrategy = requireEnum(
    rawConfig.tenantStrategy == null
      ? FINANCE_TENANT_STRATEGY.EXPLICIT_PER_COMMAND
      : rawConfig.tenantStrategy,
    FINANCE_TENANT_STRATEGY_VALUES,
    "tenantStrategy"
  );

  const providerStrategy = requireEnum(
    rawConfig.providerStrategy == null
      ? FINANCE_PROVIDER_STRATEGY.NONE
      : rawConfig.providerStrategy,
    FINANCE_PROVIDER_STRATEGY_VALUES,
    "providerStrategy"
  );

  const featureFlags = normalizeFeatureFlags(rawConfig.featureFlags || {});
  const diagnostics = normalizeDiagnostics(rawConfig.diagnostics || {});
  const expectations = resolveExpectations(mode, rawConfig);

  // Consistency: disabled mode forces enabled=false surface.
  if (mode === FINANCE_RUNTIME_MODE.DISABLED && enabled === true) {
    rejectConfig(
      "enabled",
      "Finance runtime mode 'disabled' cannot be enabled.",
      { mode }
    );
  }

  if (mode !== FINANCE_RUNTIME_MODE.DISABLED && enabled === false) {
    rejectConfig(
      "enabled",
      "Non-disabled Finance runtime mode requires enabled: true.",
      { mode }
    );
  }

  // Production must remain disabled / rejected for activation in Phase 1I.
  if (environment === FINANCE_RUNTIME_ENVIRONMENT.PRODUCTION) {
    if (mode !== FINANCE_RUNTIME_MODE.DISABLED || enabled === true) {
      throwFinanceRuntimeError(
        FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED,
        "Finance Production environment activation is not authorized in Phase 1I.",
        { environment, mode, enabled }
      );
    }
  }

  if (mode === FINANCE_RUNTIME_MODE.MEMORY) {
    if (environment === FINANCE_RUNTIME_ENVIRONMENT.PRODUCTION) {
      throwFinanceRuntimeError(
        FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED,
        "Finance memory runtime rejects Production environment classification.",
        { environment, mode }
      );
    }
    if (
      expectations.persistenceExpectation !==
      FINANCE_PERSISTENCE_EXPECTATION.MEMORY_NON_DURABLE
    ) {
      rejectConfig(
        "persistenceExpectation",
        "Memory mode requires persistenceExpectation 'memory-non-durable'.",
        { persistenceExpectation: expectations.persistenceExpectation }
      );
    }
  }

  if (mode === FINANCE_RUNTIME_MODE.SUPABASE) {
    if (environment !== FINANCE_RUNTIME_ENVIRONMENT.STAGING) {
      throwFinanceRuntimeError(
        FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED,
        "Finance Supabase runtime allows Staging classification only in Phase 1I.",
        { environment, mode }
      );
    }
    if (
      expectations.persistenceExpectation !==
      FINANCE_PERSISTENCE_EXPECTATION.SUPABASE_DURABLE
    ) {
      rejectConfig(
        "persistenceExpectation",
        "Supabase mode requires persistenceExpectation 'supabase-durable'.",
        { persistenceExpectation: expectations.persistenceExpectation }
      );
    }
  }

  if (providerStrategy === FINANCE_PROVIDER_STRATEGY.MOCK) {
    if (environment === FINANCE_RUNTIME_ENVIRONMENT.PRODUCTION) {
      throwFinanceRuntimeError(
        FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED,
        "Finance mock provider strategy is rejected for Production.",
        { providerStrategy, environment }
      );
    }
    if (featureFlags.allowMockProvider !== true) {
      rejectConfig(
        "featureFlags.allowMockProvider",
        "Mock provider strategy requires featureFlags.allowMockProvider: true.",
        { providerStrategy }
      );
    }
  }

  return Object.freeze({
    enabled: mode === FINANCE_RUNTIME_MODE.DISABLED ? false : enabled,
    mode,
    environment,
    tenantStrategy,
    providerStrategy,
    persistenceExpectation: expectations.persistenceExpectation,
    transactionExpectation: expectations.transactionExpectation,
    featureFlags,
    diagnostics,
  });
}

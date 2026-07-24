/**
 * Customer runtime configuration (CUSTOMER-03).
 *
 * Explicit, validated, immutable after validation.
 * No environment variable reads. No secrets accepted.
 *
 * Production rule: Customer persistence is durable business master data and
 * must never silently fall back to an in-memory repository in Production.
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { CustomerError } from "../errors/CustomerError.js";

export const CUSTOMER_RUNTIME_MODE = Object.freeze({
  DISABLED: "disabled",
  MEMORY: "memory",
  DURABLE: "durable",
});

export const CUSTOMER_RUNTIME_MODE_VALUES = Object.freeze(
  Object.values(CUSTOMER_RUNTIME_MODE)
);

export const CUSTOMER_RUNTIME_ENVIRONMENT = Object.freeze({
  TEST: "test",
  DEVELOPMENT: "development",
  STAGING: "staging",
  PRODUCTION: "production",
});

export const CUSTOMER_RUNTIME_ENVIRONMENT_VALUES = Object.freeze(
  Object.values(CUSTOMER_RUNTIME_ENVIRONMENT)
);

const FORBIDDEN_SECRET_KEY_PATTERN =
  /^(.*[_.-]?)?(api[_-]?key|secret|password|passwd|token|service[_-]?role|private[_-]?key|access[_-]?key|credential|authorization|auth[_-]?header|connection[_-]?string|database[_-]?url|db[_-]?url|supabase[_-]?key|anon[_-]?key)([_.-].*)?$/i;

const ALLOWED_CONFIG_KEYS = Object.freeze([
  "enabled",
  "mode",
  "environment",
  "allowMemoryInNonProduction",
]);

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {never}
 */
function throwConfigError(code, message, context) {
  throw new CustomerError(code, message, context);
}

/**
 * @param {object} [rawConfig]
 * @returns {Readonly<object>}
 */
export function validateCustomerRuntimeConfig(rawConfig = {}) {
  if (rawConfig == null || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    throwConfigError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Customer runtime config must be a plain object.",
      { field: "config" }
    );
  }

  for (const key of Object.keys(rawConfig)) {
    if (FORBIDDEN_SECRET_KEY_PATTERN.test(key)) {
      throwConfigError(
        CUSTOMER_ERROR_CODES.INVALID_INPUT,
        "Customer runtime config must not include credential keys.",
        { field: key }
      );
    }
    if (!ALLOWED_CONFIG_KEYS.includes(key)) {
      throwConfigError(
        CUSTOMER_ERROR_CODES.INVALID_INPUT,
        `Unknown Customer runtime config key rejected: ${key}`,
        { field: key, allowedKeys: [...ALLOWED_CONFIG_KEYS] }
      );
    }
  }

  const enabled = rawConfig.enabled === true;
  const mode = String(rawConfig.mode || CUSTOMER_RUNTIME_MODE.DISABLED);
  const environment = String(
    rawConfig.environment || CUSTOMER_RUNTIME_ENVIRONMENT.DEVELOPMENT
  );
  const allowMemoryInNonProduction = rawConfig.allowMemoryInNonProduction === true;

  if (!CUSTOMER_RUNTIME_MODE_VALUES.includes(mode)) {
    throwConfigError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      `Customer runtime mode is invalid: ${mode}`,
      { field: "mode", mode }
    );
  }
  if (!CUSTOMER_RUNTIME_ENVIRONMENT_VALUES.includes(environment)) {
    throwConfigError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      `Customer runtime environment is invalid: ${environment}`,
      { field: "environment", environment }
    );
  }

  if (!enabled && mode !== CUSTOMER_RUNTIME_MODE.DISABLED) {
    throwConfigError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Disabled Customer runtime must use mode=disabled.",
      { field: "mode", mode }
    );
  }

  if (enabled && mode === CUSTOMER_RUNTIME_MODE.DISABLED) {
    throwConfigError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Enabled Customer runtime cannot use mode=disabled.",
      { field: "mode" }
    );
  }

  // Fail-closed: never allow memory persistence in Production.
  if (
    environment === CUSTOMER_RUNTIME_ENVIRONMENT.PRODUCTION &&
    mode === CUSTOMER_RUNTIME_MODE.MEMORY
  ) {
    throwConfigError(
      CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
      "Customer persistence must never silently fall back to an in-memory repository in Production.",
      { environment, mode }
    );
  }

  if (
    mode === CUSTOMER_RUNTIME_MODE.MEMORY &&
    environment !== CUSTOMER_RUNTIME_ENVIRONMENT.TEST &&
    !allowMemoryInNonProduction
  ) {
    throwConfigError(
      CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
      "Memory Customer runtime requires environment=test or allowMemoryInNonProduction=true.",
      { environment, mode }
    );
  }

  return Object.freeze({
    enabled,
    mode,
    environment,
    allowMemoryInNonProduction,
  });
}

/**
 * Finance Staging runtime feature-flag gate (Phase 1J).
 *
 * Feature-owned Vite flag — does not create a second global flag framework.
 * Prefer injected env maps in tests; import.meta.env only at app-shell boundary.
 *
 * Default: OFF. Production always forced disabled. Unknown env fails closed.
 */

export const FINANCE_STAGING_RUNTIME_FLAG = "VITE_FINANCE_STAGING_RUNTIME_ENABLED";

/** Reuses the existing app environment classification key (CRM / staging gates). */
export const FINANCE_APP_ENV_KEY = "VITE_APP_ENV";

export const FINANCE_APP_ENVIRONMENT = Object.freeze({
  STAGING: "staging",
  PRODUCTION: "production",
  DEVELOPMENT: "development",
  TEST: "test",
  UNKNOWN: "unknown",
});

export const FINANCE_STAGING_ACTIVATION_REASON = Object.freeze({
  FLAG_OFF: "flag-off",
  STAGING_ENABLED: "staging-enabled",
  PRODUCTION_NOT_AUTHORIZED: "production-not-authorized",
  UNKNOWN_ENVIRONMENT: "unknown-environment",
  NON_STAGING_ENVIRONMENT: "non-staging-environment",
});

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function classifyFinanceAppEnvironment(raw) {
  const value = String(raw == null ? "" : raw)
    .trim()
    .toLowerCase();
  if (!value) return FINANCE_APP_ENVIRONMENT.UNKNOWN;
  if (value === "staging" || value === "stage") {
    return FINANCE_APP_ENVIRONMENT.STAGING;
  }
  if (value === "production" || value === "prod") {
    return FINANCE_APP_ENVIRONMENT.PRODUCTION;
  }
  if (value === "development" || value === "dev") {
    return FINANCE_APP_ENVIRONMENT.DEVELOPMENT;
  }
  if (value === "test") return FINANCE_APP_ENVIRONMENT.TEST;
  return FINANCE_APP_ENVIRONMENT.UNKNOWN;
}

/**
 * Exact `"true"` only (case-insensitive trim). Missing/invalid → false.
 * @param {Record<string, unknown>} [env]
 * @returns {boolean}
 */
export function isFinanceStagingRuntimeFlagEnabled(env = {}) {
  const raw = env[FINANCE_STAGING_RUNTIME_FLAG];
  return String(raw == null ? "" : raw)
    .trim()
    .toLowerCase() === "true";
}

/**
 * Read Vite env map at the app-shell boundary only.
 * Safe when import.meta.env is absent (Node tests).
 * @returns {Record<string, string>}
 */
export function readFinanceStagingEnvFromImportMeta() {
  const meta =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env
      : {};
  /** @type {Record<string, string>} */
  const out = {};
  if (meta[FINANCE_STAGING_RUNTIME_FLAG] != null) {
    out[FINANCE_STAGING_RUNTIME_FLAG] = String(meta[FINANCE_STAGING_RUNTIME_FLAG]);
  }
  if (meta[FINANCE_APP_ENV_KEY] != null) {
    out[FINANCE_APP_ENV_KEY] = String(meta[FINANCE_APP_ENV_KEY]);
  }
  return out;
}

/**
 * Resolve whether Staging Finance runtime may activate.
 * Never activates Production. Unknown / non-staging + flag ON → fail closed (disabled).
 *
 * @param {{
 *   env?: Record<string, unknown>,
 *   appEnvironment?: string,
 * }} [options]
 * @returns {Readonly<{
 *   activate: boolean,
 *   flagEnabled: boolean,
 *   environment: string,
 *   reason: string,
 *   productionAuthorized: false,
 * }>}
 */
export function resolveFinanceStagingActivation(options = {}) {
  const env = options.env && typeof options.env === "object" ? options.env : {};
  const flagEnabled = isFinanceStagingRuntimeFlagEnabled(env);
  const environment = classifyFinanceAppEnvironment(
    options.appEnvironment != null ? options.appEnvironment : env[FINANCE_APP_ENV_KEY]
  );

  if (environment === FINANCE_APP_ENVIRONMENT.PRODUCTION) {
    return Object.freeze({
      activate: false,
      flagEnabled,
      environment,
      reason: FINANCE_STAGING_ACTIVATION_REASON.PRODUCTION_NOT_AUTHORIZED,
      productionAuthorized: false,
    });
  }

  if (!flagEnabled) {
    return Object.freeze({
      activate: false,
      flagEnabled: false,
      environment,
      reason: FINANCE_STAGING_ACTIVATION_REASON.FLAG_OFF,
      productionAuthorized: false,
    });
  }

  if (environment === FINANCE_APP_ENVIRONMENT.UNKNOWN) {
    return Object.freeze({
      activate: false,
      flagEnabled: true,
      environment,
      reason: FINANCE_STAGING_ACTIVATION_REASON.UNKNOWN_ENVIRONMENT,
      productionAuthorized: false,
    });
  }

  if (environment !== FINANCE_APP_ENVIRONMENT.STAGING) {
    return Object.freeze({
      activate: false,
      flagEnabled: true,
      environment,
      reason: FINANCE_STAGING_ACTIVATION_REASON.NON_STAGING_ENVIRONMENT,
      productionAuthorized: false,
    });
  }

  return Object.freeze({
    activate: true,
    flagEnabled: true,
    environment: FINANCE_APP_ENVIRONMENT.STAGING,
    reason: FINANCE_STAGING_ACTIVATION_REASON.STAGING_ENABLED,
    productionAuthorized: false,
  });
}

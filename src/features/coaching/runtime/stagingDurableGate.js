/**
 * COACHING-04 — Staging-only durable runtime gate.
 *
 * Default: OFF. Flipping COACHING_DURABLE_RUNTIME_DEFAULT is forbidden here.
 * Production always refused. Unknown / non-staging + flag ON → fail closed (legacy).
 *
 * Activation remains Owner-GO gated via build-time operational flags.
 */

/** Staging project ref — mirrors scripts/coaching/coaching-04-activation-lib.mjs */
export const COACHING_04_STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";

export const COACHING_STAGING_DURABLE_RUNTIME_FLAG =
  "VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED";

/** Explicit build-time Owner GO operational flag (Preview bake only). */
export const COACHING_STAGING_OWNER_GO_GRANTED_FLAG =
  "VITE_COACHING_STAGING_OWNER_GO_GRANTED";

export const COACHING_APP_ENV_KEY = "VITE_APP_ENV";

export const COACHING_APP_ENVIRONMENT = Object.freeze({
  STAGING: "staging",
  PRODUCTION: "production",
  DEVELOPMENT: "development",
  TEST: "test",
  UNKNOWN: "unknown",
});

export const COACHING_STAGING_DURABLE_ACTIVATION_REASON = Object.freeze({
  FLAG_OFF: "flag-off",
  STAGING_ENABLED: "staging-enabled",
  PRODUCTION_NOT_AUTHORIZED: "production-not-authorized",
  UNKNOWN_ENVIRONMENT: "unknown-environment",
  NON_STAGING_ENVIRONMENT: "non-staging-environment",
  STAGING_REF_MISMATCH: "staging-ref-mismatch",
  OWNER_GO_NOT_GRANTED: "owner-go-not-granted",
});

/** Owner GO required before any Staging Preview may set the Vite flag to true. */
export const COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING =
  "COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING";

/** Separate GO for localStorage retirement (not granted in this package). */
export const COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT =
  "COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT";

export const COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION =
  "COACHING_04_RUNTIME_CUTOVER_READY_WITH_PLAYER_UNMAPPED_GATE";

/**
 * Exact `"true"` only (case-insensitive trim). Missing/invalid → false.
 * @param {unknown} raw
 */
function isExactTrueFlag(raw) {
  return (
    String(raw == null ? "" : raw)
      .trim()
      .toLowerCase() === "true"
  );
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function classifyCoachingAppEnvironment(raw) {
  const value = String(raw == null ? "" : raw)
    .trim()
    .toLowerCase();
  if (!value) return COACHING_APP_ENVIRONMENT.UNKNOWN;
  if (value === "staging" || value === "stage") {
    return COACHING_APP_ENVIRONMENT.STAGING;
  }
  if (value === "production" || value === "prod") {
    return COACHING_APP_ENVIRONMENT.PRODUCTION;
  }
  if (value === "development" || value === "dev") {
    return COACHING_APP_ENVIRONMENT.DEVELOPMENT;
  }
  if (value === "test") return COACHING_APP_ENVIRONMENT.TEST;
  return COACHING_APP_ENVIRONMENT.UNKNOWN;
}

/**
 * Exact `"true"` only (case-insensitive trim). Missing/invalid → false.
 * @param {Record<string, unknown>} [env]
 */
export function isCoachingStagingDurableFlagEnabled(env = {}) {
  return isExactTrueFlag(env[COACHING_STAGING_DURABLE_RUNTIME_FLAG]);
}

/**
 * Build-time Owner GO operational flag. Exact `"true"` only.
 * @param {Record<string, unknown>} [env]
 */
export function isCoachingStagingOwnerGoGranted(env = {}) {
  return isExactTrueFlag(env[COACHING_STAGING_OWNER_GO_GRANTED_FLAG]);
}

/**
 * Resolve Owner GO for gate evaluation.
 * Explicit boolean override wins; otherwise derive from build-time env flag.
 *
 * @param {{
 *   env?: Record<string, unknown>,
 *   ownerGoGranted?: boolean,
 * }} [options]
 */
export function resolveCoachingStagingOwnerGoGranted(options = {}) {
  if (options.ownerGoGranted === true) return true;
  if (options.ownerGoGranted === false) return false;
  const env = options.env && typeof options.env === "object" ? options.env : {};
  return isCoachingStagingOwnerGoGranted(env);
}

/**
 * Read Vite env map at the app-shell boundary only.
 * @returns {Record<string, string>}
 */
export function readCoachingStagingDurableEnvFromImportMeta() {
  const meta =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env
      : {};
  /** @type {Record<string, string>} */
  const out = {};
  if (meta[COACHING_STAGING_DURABLE_RUNTIME_FLAG] != null) {
    out[COACHING_STAGING_DURABLE_RUNTIME_FLAG] = String(
      meta[COACHING_STAGING_DURABLE_RUNTIME_FLAG]
    );
  }
  if (meta[COACHING_STAGING_OWNER_GO_GRANTED_FLAG] != null) {
    out[COACHING_STAGING_OWNER_GO_GRANTED_FLAG] = String(
      meta[COACHING_STAGING_OWNER_GO_GRANTED_FLAG]
    );
  }
  if (meta[COACHING_APP_ENV_KEY] != null) {
    out[COACHING_APP_ENV_KEY] = String(meta[COACHING_APP_ENV_KEY]);
  }
  if (meta.VITE_SUPABASE_URL != null) {
    out.VITE_SUPABASE_URL = String(meta.VITE_SUPABASE_URL);
  }
  return out;
}

/**
 * Extract Supabase project ref from a URL host when present.
 * @param {unknown} url
 * @returns {string|null}
 */
export function extractSupabaseProjectRef(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname;
    const m = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Resolve whether Staging durable coaching runtime may activate.
 * Never activates Production. Default remains inactive (flag off).
 *
 * @param {{
 *   env?: Record<string, unknown>,
 *   appEnvironment?: string,
 *   ownerGoGranted?: boolean,
 *   expectedStagingRef?: string,
 * }} [options]
 */
export function resolveCoachingStagingDurableActivation(options = {}) {
  const env = options.env && typeof options.env === "object" ? options.env : {};
  const flagEnabled = isCoachingStagingDurableFlagEnabled(env);
  const environment = classifyCoachingAppEnvironment(
    options.appEnvironment != null
      ? options.appEnvironment
      : env[COACHING_APP_ENV_KEY]
  );
  const expectedRef = String(
    options.expectedStagingRef || COACHING_04_STAGING_PROJECT_REF
  )
    .trim()
    .toLowerCase();
  const urlRef = extractSupabaseProjectRef(
    env.VITE_SUPABASE_URL || env.STAGING_SUPABASE_URL || env.SUPABASE_URL
  );
  const ownerGoGranted = resolveCoachingStagingOwnerGoGranted({
    env,
    ownerGoGranted: options.ownerGoGranted,
  });

  if (environment === COACHING_APP_ENVIRONMENT.PRODUCTION) {
    return Object.freeze({
      activate: false,
      flagEnabled,
      environment,
      reason: COACHING_STAGING_DURABLE_ACTIVATION_REASON.PRODUCTION_NOT_AUTHORIZED,
      productionAuthorized: false,
      stagingProjectRef: urlRef,
      expectedStagingRef: expectedRef,
      ownerGoGranted: false,
      ownerGoToken: COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
    });
  }

  if (!flagEnabled) {
    return Object.freeze({
      activate: false,
      flagEnabled: false,
      environment,
      reason: COACHING_STAGING_DURABLE_ACTIVATION_REASON.FLAG_OFF,
      productionAuthorized: false,
      stagingProjectRef: urlRef,
      expectedStagingRef: expectedRef,
      ownerGoGranted: false,
      ownerGoToken: COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
    });
  }

  if (!ownerGoGranted) {
    return Object.freeze({
      activate: false,
      flagEnabled: true,
      environment,
      reason: COACHING_STAGING_DURABLE_ACTIVATION_REASON.OWNER_GO_NOT_GRANTED,
      productionAuthorized: false,
      stagingProjectRef: urlRef,
      expectedStagingRef: expectedRef,
      ownerGoGranted: false,
      ownerGoToken: COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
    });
  }

  if (environment === COACHING_APP_ENVIRONMENT.UNKNOWN) {
    return Object.freeze({
      activate: false,
      flagEnabled: true,
      environment,
      reason: COACHING_STAGING_DURABLE_ACTIVATION_REASON.UNKNOWN_ENVIRONMENT,
      productionAuthorized: false,
      stagingProjectRef: urlRef,
      expectedStagingRef: expectedRef,
      ownerGoGranted,
      ownerGoToken: COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
    });
  }

  if (environment !== COACHING_APP_ENVIRONMENT.STAGING) {
    return Object.freeze({
      activate: false,
      flagEnabled: true,
      environment,
      reason: COACHING_STAGING_DURABLE_ACTIVATION_REASON.NON_STAGING_ENVIRONMENT,
      productionAuthorized: false,
      stagingProjectRef: urlRef,
      expectedStagingRef: expectedRef,
      ownerGoGranted,
      ownerGoToken: COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
    });
  }

  if (urlRef && urlRef !== expectedRef) {
    return Object.freeze({
      activate: false,
      flagEnabled: true,
      environment,
      reason: COACHING_STAGING_DURABLE_ACTIVATION_REASON.STAGING_REF_MISMATCH,
      productionAuthorized: false,
      stagingProjectRef: urlRef,
      expectedStagingRef: expectedRef,
      ownerGoGranted,
      ownerGoToken: COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
    });
  }

  return Object.freeze({
    activate: true,
    flagEnabled: true,
    environment: COACHING_APP_ENVIRONMENT.STAGING,
    reason: COACHING_STAGING_DURABLE_ACTIVATION_REASON.STAGING_ENABLED,
    productionAuthorized: false,
    stagingProjectRef: urlRef || expectedRef,
    expectedStagingRef: expectedRef,
    ownerGoGranted: true,
    ownerGoToken: COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
  });
}

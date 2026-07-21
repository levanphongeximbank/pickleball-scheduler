/**
 * Runtime composition guard for durable CRM repositories (Phase 1H-A).
 *
 * Default runtime remains memory. Durable activation requires explicit config.
 * Production activation remains blocked. Missing env/client fails closed.
 * No dual writes. No silent fallback to unscoped implementations.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";

/** Explicit opt-in flag name (value must be exactly "durable"). */
export const CRM_PERSISTENCE_MODE_ENV = "VITE_CRM_PERSISTENCE_MODE";

/** Allowed non-durable modes. */
export const CRM_PERSISTENCE_MEMORY_MODE = "memory";

/** Durable opt-in mode value. */
export const CRM_PERSISTENCE_DURABLE_MODE = "durable";

/** Environments that must never activate durable CRM persistence in Phase 1H-A. */
export const CRM_DURABLE_BLOCKED_ENVIRONMENTS = Object.freeze([
  "production",
  "prod",
]);

/**
 * Resolve requested persistence mode from an injected env map (never process.env at import).
 * @param {Record<string, string|undefined>} [env]
 * @returns {"memory"|"durable"}
 */
export function resolveCrmPersistenceMode(env = {}) {
  const raw = String(env[CRM_PERSISTENCE_MODE_ENV] ?? CRM_PERSISTENCE_MEMORY_MODE)
    .trim()
    .toLowerCase();
  if (!raw || raw === CRM_PERSISTENCE_MEMORY_MODE) {
    return CRM_PERSISTENCE_MEMORY_MODE;
  }
  if (raw === CRM_PERSISTENCE_DURABLE_MODE) {
    return CRM_PERSISTENCE_DURABLE_MODE;
  }
  throw new CrmError(
    CRM_ERROR_CODES.INVALID_INPUT,
    `Unsupported ${CRM_PERSISTENCE_MODE_ENV}=${raw}. Use memory or durable.`
  );
}

/**
 * Assert durable CRM activation is allowed. Fail closed.
 *
 * @param {{
 *   env?: Record<string, string|undefined>,
 *   appEnvironment?: string,
 *   databaseClient?: unknown,
 *   ownerApprovedDurableStaging?: boolean,
 * }} [options]
 * @returns {{ mode: "memory"|"durable", durableAllowed: boolean }}
 */
export function assertCrmRuntimeCompositionGuard(options = {}) {
  const env = options.env && typeof options.env === "object" ? options.env : {};
  const mode = resolveCrmPersistenceMode(env);
  const appEnvironment = String(options.appEnvironment || env.VITE_APP_ENV || "")
    .trim()
    .toLowerCase();

  if (mode === CRM_PERSISTENCE_MEMORY_MODE) {
    return Object.freeze({ mode, durableAllowed: false });
  }

  // Durable requested — fail closed on production / missing client / missing approval.
  if (CRM_DURABLE_BLOCKED_ENVIRONMENTS.includes(appEnvironment)) {
    throw new CrmError(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "Durable CRM persistence is blocked in Production during Phase 1H-A."
    );
  }

  if (appEnvironment !== "staging") {
    throw new CrmError(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "Durable CRM persistence requires explicit staging app environment."
    );
  }

  if (!options.ownerApprovedDurableStaging) {
    throw new CrmError(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "Durable CRM persistence requires ownerApprovedDurableStaging=true."
    );
  }

  if (!options.databaseClient || typeof options.databaseClient !== "object") {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "Durable CRM persistence requires an injected database client. No fallback."
    );
  }

  return Object.freeze({ mode, durableAllowed: true });
}

/**
 * Phase 1H-A default: always memory. Does not construct durable repos.
 * @returns {"memory"}
 */
export function getCrmDefaultRuntimePersistenceMode() {
  return CRM_PERSISTENCE_MEMORY_MODE;
}

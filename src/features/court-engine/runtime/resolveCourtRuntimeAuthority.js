/**
 * Resolve Court runtime persistence authority once at the application boundary.
 * Never infer local mode from cloud / RPC failure.
 */

import { isProductionBuild } from "../../../auth/runtime.js";
import {
  COURT_ENGINE_STORE_ENV_KEY,
  COURT_RUNTIME_AUTHORITY,
  COURT_RUNTIME_AUTHORITY_ENV_KEY,
  COURT_RUNTIME_AUTHORITY_VALUES,
} from "./constants.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "./errors.js";

function readEnv(env) {
  if (env && typeof env === "object") {
    return env;
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env;
  }
  return {};
}

function normalizeAuthority(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (raw === "developmentlocal") {
    return COURT_RUNTIME_AUTHORITY.DEVELOPMENT_LOCAL;
  }
  if (raw === "offlinelocal") {
    return COURT_RUNTIME_AUTHORITY.OFFLINE_LOCAL;
  }
  if (raw === "testmemory" || raw === "memory") {
    return COURT_RUNTIME_AUTHORITY.TEST_MEMORY;
  }
  if (raw === "supabase" || raw === "cloud") {
    return COURT_RUNTIME_AUTHORITY.DURABLE;
  }
  if (COURT_RUNTIME_AUTHORITY_VALUES.includes(raw)) {
    return raw;
  }
  return null;
}

function isPreviewOrStagingEnv(env) {
  const vercel =
    String(env.VITE_VERCEL_ENV || env.VERCEL_ENV || "")
      .trim()
      .toLowerCase();
  if (vercel === "preview" || vercel === "staging") {
    return true;
  }
  const mode = String(env.MODE || env.VITE_APP_ENV || "")
    .trim()
    .toLowerCase();
  return mode === "preview" || mode === "staging";
}

function isSecureDeployEnv(env) {
  if (isProductionBuild()) {
    return true;
  }
  if (env.PROD === true || String(env.PROD).toLowerCase() === "true") {
    return true;
  }
  return isPreviewOrStagingEnv(env);
}

/**
 * @param {{
 *   authority?: string,
 *   env?: Record<string, unknown>,
 *   cloudFailure?: boolean,
 *   rpcNotDeployed?: boolean,
 * }} [input]
 * @returns {{ ok: true, authority: string, explicit: boolean, source: string } | { ok: false, code: string, error: string }}
 */
export function resolveCourtRuntimeAuthority(input = {}) {
  // Cloud / RPC failure must never flip authority.
  if (input.cloudFailure || input.rpcNotDeployed) {
    // Ignore failure signals for resolution; continue with normal rules.
  }

  if (input.authority != null && String(input.authority).trim() !== "") {
    const normalized = normalizeAuthority(input.authority);
    if (!normalized) {
      return createCourtRuntimeError(
        COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_AUTHORITY_UNRESOLVED,
        `Unknown Court runtime authority: ${input.authority}`
      );
    }
    return {
      ok: true,
      authority: normalized,
      explicit: true,
      source: "injection",
    };
  }

  const env = readEnv(input.env);
  const explicitEnv = normalizeAuthority(env[COURT_RUNTIME_AUTHORITY_ENV_KEY]);
  if (explicitEnv) {
    return {
      ok: true,
      authority: explicitEnv,
      explicit: true,
      source: COURT_RUNTIME_AUTHORITY_ENV_KEY,
    };
  }

  const secure = isSecureDeployEnv(env);
  if (secure) {
    return {
      ok: true,
      authority: COURT_RUNTIME_AUTHORITY.DURABLE,
      explicit: false,
      source: "secure_default",
    };
  }

  // Legacy VITE_COURT_ENGINE_STORE=local is explicit local only outside secure deploy.
  const storeMode = String(env[COURT_ENGINE_STORE_ENV_KEY] || "")
    .trim()
    .toLowerCase();
  if (storeMode === "local") {
    return {
      ok: true,
      authority: COURT_RUNTIME_AUTHORITY.DEVELOPMENT_LOCAL,
      explicit: true,
      source: COURT_ENGINE_STORE_ENV_KEY,
    };
  }
  if (storeMode === "supabase") {
    return {
      ok: true,
      authority: COURT_RUNTIME_AUTHORITY.DURABLE,
      explicit: true,
      source: COURT_ENGINE_STORE_ENV_KEY,
    };
  }

  // Development default: durable (fail-closed). Local requires explicit selection.
  return {
    ok: true,
    authority: COURT_RUNTIME_AUTHORITY.DURABLE,
    explicit: false,
    source: "development_default_durable",
  };
}

/**
 * @param {string} authority
 * @returns {boolean}
 */
export function isLocalCourtRuntimeAuthority(authority) {
  return (
    authority === COURT_RUNTIME_AUTHORITY.DEVELOPMENT_LOCAL ||
    authority === COURT_RUNTIME_AUTHORITY.OFFLINE_LOCAL ||
    authority === COURT_RUNTIME_AUTHORITY.TEST_MEMORY
  );
}

/**
 * @param {string} authority
 * @returns {boolean}
 */
export function isDurableCourtRuntimeAuthority(authority) {
  return authority === COURT_RUNTIME_AUTHORITY.DURABLE;
}

/**
 * Resolve Communication runtime mode (COMMS-07).
 *
 * Rules:
 * - DEMO only when explicitly allowed in development / preview / test.
 * - Production builds never fall back to DEMO.
 * - Missing Production dependencies → UNAVAILABLE.
 * - Client query parameters cannot enable DEMO.
 */

import { getCommunicationActivationSnapshot } from "../persistence/activationGates.js";
import {
  COMMUNICATION_RUNTIME_MODE,
  COMMUNICATION_RUNTIME_MODE_VALUES,
} from "./constants.js";

/**
 * @param {string} name
 * @param {Record<string, unknown>} [env]
 */
function readEnvFlag(name, env) {
  if (env && Object.prototype.hasOwnProperty.call(env, name)) {
    return env[name];
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.[name] !== undefined) {
    return import.meta.env[name];
  }
  const nodeEnv = globalThis.process?.env;
  if (nodeEnv?.[name] !== undefined) return nodeEnv[name];
  return undefined;
}

/**
 * @param {Record<string, unknown>} [env]
 */
function isTestEnv(env) {
  const nodeEnv = String(readEnvFlag("NODE_ENV", env) || "").toLowerCase();
  const vitest = String(readEnvFlag("VITEST", env) || "").toLowerCase();
  return nodeEnv === "test" || vitest === "true";
}

/**
 * @param {Record<string, unknown>} [env]
 */
function isProductionBuild(env) {
  if (isTestEnv(env)) return false;
  const mode = String(readEnvFlag("MODE", env) || readEnvFlag("NODE_ENV", env) || "")
    .toLowerCase();
  const prodFlag = readEnvFlag("PROD", env);
  if (prodFlag === true || String(prodFlag).toLowerCase() === "true") return true;
  return mode === "production";
}

/**
 * @param {Record<string, unknown>} [env]
 */
function isDevOrPreview(env) {
  if (isTestEnv(env)) return true;
  const mode = String(readEnvFlag("MODE", env) || readEnvFlag("NODE_ENV", env) || "")
    .toLowerCase();
  const devFlag = readEnvFlag("DEV", env);
  if (devFlag === true || String(devFlag).toLowerCase() === "true") return true;
  if (mode === "development") return true;
  const preview = String(readEnvFlag("VITE_VERCEL_PREVIEW", env) || "").toLowerCase();
  return preview === "true";
}

/**
 * Explicit env mode request (never from URL query).
 * @param {Record<string, unknown>} [env]
 * @returns {string|null}
 */
function readExplicitRuntimeMode(env) {
  const raw = String(
    readEnvFlag("VITE_COMMUNICATION_RUNTIME_MODE", env) || ""
  )
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (COMMUNICATION_RUNTIME_MODE_VALUES.includes(raw)) return raw;
  return null;
}

/**
 * @param {object} [options]
 * @param {Record<string, unknown>} [options.env]
 * @param {string} [options.forceMode] — tests only; ignored unless allowForceMode
 * @param {boolean} [options.allowForceMode]
 * @param {boolean} [options.productionDependenciesCertified]
 * @param {URLSearchParams|string|null} [options.searchParams] — must NOT enable demo
 * @param {object} [options.activationSnapshot]
 * @returns {{ mode: string, reason: string, demoAllowed: boolean, queryParamIgnored: boolean }}
 */
export function resolveCommunicationRuntimeMode(options = {}) {
  const env = options.env || undefined;
  const activation =
    options.activationSnapshot || getCommunicationActivationSnapshot();
  const explicit = readExplicitRuntimeMode(env);
  const productionBuild = isProductionBuild(env);
  const demoSurface = isDevOrPreview(env) || isTestEnv(env);
  const depsCertified = options.productionDependenciesCertified === true;
  const stagingReady = activation.STAGING_MIGRATION_READY === true;
  const productionReady = activation.PRODUCTION_READY === true;
  const remoteReady = stagingReady || productionReady;

  let queryParamIgnored = false;
  if (options.searchParams != null) {
    const params =
      typeof options.searchParams === "string"
        ? new URLSearchParams(options.searchParams)
        : options.searchParams;
    if (
      params.get?.("commsDemo") ||
      params.get?.("communicationDemo") ||
      params.get?.("demo") ||
      params.get?.("runtime") === "demo"
    ) {
      queryParamIgnored = true;
    }
  }

  if (options.allowForceMode === true && options.forceMode) {
    const forced = String(options.forceMode).toUpperCase();
    if (COMMUNICATION_RUNTIME_MODE_VALUES.includes(forced)) {
      if (
        forced === COMMUNICATION_RUNTIME_MODE.DEMO &&
        productionBuild &&
        !isTestEnv(env)
      ) {
        return {
          mode: COMMUNICATION_RUNTIME_MODE.UNAVAILABLE,
          reason: "FORCE_DEMO_REJECTED_IN_PRODUCTION_BUILD",
          demoAllowed: false,
          queryParamIgnored,
        };
      }
      return {
        mode: forced,
        reason: "FORCE_MODE",
        demoAllowed: forced === COMMUNICATION_RUNTIME_MODE.DEMO,
        queryParamIgnored,
      };
    }
  }

  // Production build: never DEMO. PRODUCTION only when certified + gates.
  if (productionBuild) {
    if (depsCertified && remoteReady) {
      return {
        mode: COMMUNICATION_RUNTIME_MODE.PRODUCTION,
        reason: "PRODUCTION_DEPS_AND_ACTIVATION_READY",
        demoAllowed: false,
        queryParamIgnored,
      };
    }
    if (explicit === COMMUNICATION_RUNTIME_MODE.DEMO) {
      return {
        mode: COMMUNICATION_RUNTIME_MODE.UNAVAILABLE,
        reason: "DEMO_ENV_REJECTED_IN_PRODUCTION_BUILD",
        demoAllowed: false,
        queryParamIgnored,
      };
    }
    return {
      mode: COMMUNICATION_RUNTIME_MODE.UNAVAILABLE,
      reason: depsCertified
        ? "ACTIVATION_GATES_BLOCKED"
        : "PRODUCTION_DEPENDENCIES_MISSING",
      demoAllowed: false,
      queryParamIgnored,
    };
  }

  // Development / preview / test surfaces.
  if (explicit === COMMUNICATION_RUNTIME_MODE.UNAVAILABLE) {
    return {
      mode: COMMUNICATION_RUNTIME_MODE.UNAVAILABLE,
      reason: "EXPLICIT_UNAVAILABLE",
      demoAllowed: false,
      queryParamIgnored,
    };
  }

  if (explicit === COMMUNICATION_RUNTIME_MODE.PRODUCTION) {
    if (depsCertified) {
      return {
        mode: COMMUNICATION_RUNTIME_MODE.PRODUCTION,
        reason: "EXPLICIT_PRODUCTION_WITH_DEPS",
        demoAllowed: false,
        queryParamIgnored,
      };
    }
    return {
      mode: COMMUNICATION_RUNTIME_MODE.UNAVAILABLE,
      reason: "EXPLICIT_PRODUCTION_MISSING_DEPS",
      demoAllowed: false,
      queryParamIgnored,
    };
  }

  if (explicit === COMMUNICATION_RUNTIME_MODE.DEMO && demoSurface) {
    return {
      mode: COMMUNICATION_RUNTIME_MODE.DEMO,
      reason: "EXPLICIT_DEMO",
      demoAllowed: true,
      queryParamIgnored,
    };
  }

  // Default on non-production surfaces: DEMO for local DX / tests.
  if (demoSurface) {
    return {
      mode: COMMUNICATION_RUNTIME_MODE.DEMO,
      reason: isTestEnv(env) ? "TEST_DEFAULT_DEMO" : "DEV_OR_PREVIEW_DEFAULT_DEMO",
      demoAllowed: true,
      queryParamIgnored,
    };
  }

  return {
    mode: COMMUNICATION_RUNTIME_MODE.UNAVAILABLE,
    reason: "FALLBACK_UNAVAILABLE",
    demoAllowed: false,
    queryParamIgnored,
  };
}

/**
 * @param {unknown} mode
 * @returns {boolean}
 */
export function isCommunicationRuntimeMode(mode) {
  return COMMUNICATION_RUNTIME_MODE_VALUES.includes(String(mode));
}

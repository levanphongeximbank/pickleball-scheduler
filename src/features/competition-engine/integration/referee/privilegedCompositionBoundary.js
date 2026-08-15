/**
 * Server/Edge privileged composition guards.
 *
 * Never reads secret values. Never constructs a service-role client.
 * Browser/Vite must not host internal commit RPC execution.
 */

import { REFEREE_ADAPTER_ERROR_CODE } from "./constants.js";
import { failRefereeAdapter } from "./errors.js";

const CLIENT_SERVICE_ROLE_ENV_RE =
  /^(VITE_.*SERVICE_ROLE|.*SERVICE_ROLE_KEY)$/i;

export function isBrowserRuntime() {
  return typeof globalThis.window !== "undefined";
}

/**
 * Privileged live RPC / service-role composition is server/Edge only.
 */
export function assertServerOnlyPrivilegedRefereeComposition() {
  if (isBrowserRuntime()) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
      "Privileged referee durable composition is server/Edge only",
      { boundary: "server-edge" }
    );
  }
}

/**
 * Refuse resolving service-role material from client/Vite env bags.
 * Callers must inject a server rpcClient; this function does not read secrets.
 *
 * @param {Record<string, unknown>|null|undefined} env
 */
export function assertNoClientServiceRoleEnv(env) {
  if (!env || typeof env !== "object") return;
  for (const key of Object.keys(env)) {
    if (!CLIENT_SERVICE_ROLE_ENV_RE.test(key)) continue;
    if (env[key] == null || env[key] === "") continue;
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
      "Service-role credentials must not be resolved from client/Vite env",
      { envKeyPresent: true }
    );
  }
}

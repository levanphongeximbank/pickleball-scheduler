/**
 * Browser-safe Reporting runtime resolver (REPORTING-04C).
 *
 * No global Supabase client. No service_role. No browser durable storage.
 * Without an injected facade composition, runtime is typed UNAVAILABLE.
 * Does not persist Reporting durability in the browser.
 */

import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { REPORTING_PRESENTATION_SOURCE_STATE } from "./sourceState.js";

export const REPORTING_RUNTIME_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
});

/** @type {{ facade: object|null, reason: string|null }|null} */
let injectedRuntime = null;

/**
 * @param {{ facade: object, reason?: string|null }} runtime
 */
export function injectReportingAnalyticsRuntime(runtime) {
  if (!isPlainObject(runtime) || !runtime.facade) {
    throw new Error("injectReportingAnalyticsRuntime requires { facade }");
  }
  injectedRuntime = {
    facade: runtime.facade,
    reason: runtime.reason || null,
  };
  return getReportingAnalyticsRuntimeSnapshot();
}

export function clearReportingAnalyticsRuntime() {
  injectedRuntime = null;
  return getReportingAnalyticsRuntimeSnapshot();
}

export function getReportingAnalyticsRuntimeSnapshot() {
  return resolveReportingAnalyticsRuntime();
}

/**
 * @param {string} [reason]
 */
export function createUnavailableReportingRuntime(reason) {
  return deepFreeze({
    status: REPORTING_RUNTIME_STATUS.UNAVAILABLE,
    available: false,
    facade: null,
    reason: reason || "REPORTING_RUNTIME_NOT_INJECTED",
    sourceState: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
    errorCode: REPORTING_ERROR_CODE.SOURCE_NOT_CONFIGURED,
    usesLocalStorage: false,
    usesServiceRole: false,
  });
}

/**
 * @param {object} facade
 * @param {{ reason?: string|null }} [opts]
 */
export function createReportingRuntimeFromFacade(facade, opts = {}) {
  if (!facade || typeof facade !== "object") {
    return createUnavailableReportingRuntime("invalid_facade");
  }
  return deepFreeze({
    status: REPORTING_RUNTIME_STATUS.AVAILABLE,
    available: true,
    facade,
    reason: opts.reason || null,
    sourceState: REPORTING_PRESENTATION_SOURCE_STATE.LIVE,
    errorCode: null,
    usesLocalStorage: false,
    usesServiceRole: false,
  });
}

/**
 * Resolve current runtime. Prefer explicit injection; never invent durable browser storage.
 *
 * @param {{ facade?: object|null }} [opts]
 */
export function resolveReportingAnalyticsRuntime(opts = {}) {
  if (opts && opts.facade) {
    return createReportingRuntimeFromFacade(opts.facade);
  }
  if (injectedRuntime?.facade) {
    return createReportingRuntimeFromFacade(injectedRuntime.facade, {
      reason: injectedRuntime.reason,
    });
  }
  return createUnavailableReportingRuntime(
    injectedRuntime?.reason || "REPORTING_RUNTIME_NOT_INJECTED"
  );
}

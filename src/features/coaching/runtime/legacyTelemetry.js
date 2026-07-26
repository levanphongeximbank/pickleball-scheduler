/**
 * Legacy localStorage telemetry / isolation helpers (COACHING-04 cutover).
 * Does not delete localStorage implementation. Does not activate retirement.
 */

import {
  COACHING_LEGACY_STORAGE_KEY_PREFIX,
  LOCALSTORAGE_RETIRED,
  COACHING_DURABLE_RUNTIME_DEFAULT,
} from "./constants.js";

/**
 * @param {string} clubId
 * @param {'legacy_read'|'legacy_write'|'durable_requested'|'silent_fallback_blocked'} event
 * @param {object} [details]
 */
export function emitCoachingLegacyTelemetry(clubId, event, details = {}) {
  const payload = Object.freeze({
    phase: "COACHING-04",
    storageKeyPrefix: COACHING_LEGACY_STORAGE_KEY_PREFIX,
    clubId: String(clubId || "").trim() || null,
    event: String(event || ""),
    localStorageRetired: LOCALSTORAGE_RETIRED,
    durableRuntimeDefault: COACHING_DURABLE_RUNTIME_DEFAULT,
    silentFallback: false,
    details: Object.freeze({ ...details }),
    at: new Date().toISOString(),
  });
  if (typeof globalThis !== "undefined" && Array.isArray(globalThis.__COACHING_LEGACY_TELEMETRY__)) {
    globalThis.__COACHING_LEGACY_TELEMETRY__.push(payload);
  }
  return payload;
}

/**
 * Explicit legacy isolation descriptor for cutover readiness.
 */
export function getCoachingLegacyIsolationContract() {
  return Object.freeze({
    implementationPresent: true,
    retired: LOCALSTORAGE_RETIRED,
    silentSuccessOnDurableFailure: false,
    defaultRuntime: COACHING_DURABLE_RUNTIME_DEFAULT ? "durable" : "legacy",
    retirementPlanDoc:
      "docs/coaching-training/coaching-04/04_COACHING_04_LOCALSTORAGE_RETIREMENT_PLAN.md",
    note: "localStorage remains available as explicit LEGACY mode only; never silent durable fallback.",
  });
}

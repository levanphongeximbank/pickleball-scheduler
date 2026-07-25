/**
 * Default coaching runtime composition (COACHING-04).
 *
 * App default remains legacy because COACHING_DURABLE_RUNTIME_DEFAULT === false.
 * Pages must use this boundary — not coachingService directly.
 */

import {
  COACHING_RUNTIME_MODE,
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
  COACHING_04_PHASE,
} from "./constants.js";
import { createCoachingRuntime } from "./createCoachingRuntime.js";

/** @type {ReturnType<typeof createCoachingRuntime>|null} */
let defaultRuntimeSingleton = null;

/**
 * Build the app-default runtime (legacy while durable default is false).
 * @param {object} [overrides]
 */
export function createDefaultCoachingRuntime(overrides = {}) {
  const mode =
    overrides.mode != null
      ? overrides.mode
      : COACHING_DURABLE_RUNTIME_DEFAULT
        ? COACHING_RUNTIME_MODE.DURABLE
        : COACHING_RUNTIME_MODE.LEGACY;

  return createCoachingRuntime({
    mode,
    databaseClient: overrides.databaseClient ?? null,
    resolveTenantClub: overrides.resolveTenantClub ?? null,
    resolveActor: overrides.resolveActor ?? null,
    applicationService: overrides.applicationService ?? null,
  });
}

/**
 * Lazy singleton used by page hooks.
 * @returns {ReturnType<typeof createCoachingRuntime>}
 */
export function getDefaultCoachingRuntime() {
  if (!defaultRuntimeSingleton) {
    defaultRuntimeSingleton = createDefaultCoachingRuntime();
  }
  return defaultRuntimeSingleton;
}

/**
 * Reset singleton (tests / explicit recompose only).
 */
export function resetDefaultCoachingRuntime() {
  defaultRuntimeSingleton = null;
}

/**
 * Page-facing gateway — collection ops only through the runtime boundary.
 */
export function getCoachingPageGateway() {
  const runtime = getDefaultCoachingRuntime();
  return Object.freeze({
    mode: runtime.mode,
    isDurable: runtime.isDurable,
    isLegacy: runtime.isLegacy,
    listCollection: (name, clubId) => runtime.listCollection(name, clubId),
    saveCollection: (name, clubId, row) =>
      runtime.saveCollection(name, clubId, row),
    deleteCollection: (name, clubId, id) =>
      runtime.deleteCollection(name, clubId, id),
    getStatus: () => runtime.getStatus(),
    phase: COACHING_04_PHASE,
    durableRuntimeDefault: COACHING_DURABLE_RUNTIME_DEFAULT,
    localStorageRetired: LOCALSTORAGE_RETIRED,
  });
}

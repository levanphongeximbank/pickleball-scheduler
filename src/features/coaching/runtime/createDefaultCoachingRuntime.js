/**
 * Default coaching runtime composition (COACHING-04).
 *
 * App default remains legacy because COACHING_DURABLE_RUNTIME_DEFAULT === false.
 * Staging-only durable opt-in requires:
 *   VITE_APP_ENV=staging
 *   VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED=true
 *   VITE_COACHING_STAGING_OWNER_GO_GRANTED=true
 * (see stagingDurableGate.js). Production is always refused.
 * Pages must use this boundary — not coachingService directly.
 */

import {
  COACHING_RUNTIME_MODE,
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
  COACHING_04_PHASE,
} from "./constants.js";
import { createCoachingRuntime } from "./createCoachingRuntime.js";
import {
  readCoachingStagingDurableEnvFromImportMeta,
  resolveCoachingStagingDurableActivation,
} from "./stagingDurableGate.js";
import {
  HARD_CUTOVER_FLAG,
  isPlatformHardCutoverEnabled,
} from "../../platform-hard-cutover/runtimeAuthorityMatrix.js";

/** @type {ReturnType<typeof createCoachingRuntime>|null} */
let defaultRuntimeSingleton = null;

/**
 * Resolve default mode without flipping COACHING_DURABLE_RUNTIME_DEFAULT.
 * ownerGoGranted derives from VITE_COACHING_STAGING_OWNER_GO_GRANTED unless
 * an explicit override is provided (tests / injection only).
 *
 * Under VITE_PLATFORM_HARD_CUTOVER_ENABLED: never LEGACY / localStorage SoT.
 * Durable only when staging Owner GO activates (or durable default ON);
 * otherwise UNAVAILABLE (fail closed).
 * @param {object} [overrides]
 */
function resolveDefaultMode(overrides = {}) {
  const env =
    overrides.env && typeof overrides.env === "object"
      ? overrides.env
      : readCoachingStagingDurableEnvFromImportMeta();
  const hardCutover =
    isPlatformHardCutoverEnabled(env) || overrides.hardCutover === true;

  if (overrides.mode != null) {
    if (
      String(overrides.mode) === COACHING_RUNTIME_MODE.LEGACY &&
      hardCutover
    ) {
      return COACHING_RUNTIME_MODE.UNAVAILABLE;
    }
    return overrides.mode;
  }
  if (COACHING_DURABLE_RUNTIME_DEFAULT) return COACHING_RUNTIME_MODE.DURABLE;

  /** @type {{ env: Record<string, unknown>, appEnvironment?: string, ownerGoGranted?: boolean }} */
  const gateOptions = {
    env,
    appEnvironment: overrides.appEnvironment,
  };
  if (Object.prototype.hasOwnProperty.call(overrides, "ownerGoGranted")) {
    gateOptions.ownerGoGranted = overrides.ownerGoGranted === true;
  }
  const activation = resolveCoachingStagingDurableActivation(gateOptions);
  if (activation.activate) return COACHING_RUNTIME_MODE.DURABLE;

  // Hard cutover: forbid silent legacy/localStorage authority.
  if (hardCutover) {
    return COACHING_RUNTIME_MODE.UNAVAILABLE;
  }
  return COACHING_RUNTIME_MODE.LEGACY;
}

/** Exported for unit tests — same rules as createDefaultCoachingRuntime. */
export function resolveDefaultCoachingRuntimeMode(overrides = {}) {
  return resolveDefaultMode(overrides);
}

export { HARD_CUTOVER_FLAG };

/**
 * Build the app-default runtime (legacy while durable default is false).
 * @param {object} [overrides]
 */
export function createDefaultCoachingRuntime(overrides = {}) {
  const mode = resolveDefaultMode(overrides);

  return createCoachingRuntime({
    mode,
    databaseClient: overrides.databaseClient ?? null,
    resolveTenantClub: overrides.resolveTenantClub ?? null,
    resolveActor: overrides.resolveActor ?? null,
    applicationService: overrides.applicationService ?? null,
    requirePlayerSelfScope: overrides.requirePlayerSelfScope === true,
    resolvePlayerSelfScope: overrides.resolvePlayerSelfScope,
  });
}

/**
 * Lazy singleton used by page hooks.
 * Reads build-time Staging Owner GO operational flags via import.meta.env.
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
  const env = readCoachingStagingDurableEnvFromImportMeta();
  const stagingGate = resolveCoachingStagingDurableActivation({ env });
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
    stagingDurableActivate: stagingGate.activate,
    stagingDurableReason: stagingGate.reason,
    productionAuthorized: false,
  });
}

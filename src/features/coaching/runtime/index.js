/**
 * COACHING-04 runtime public surface.
 *
 * Pages import collection APIs from here (or getCoachingPageGateway).
 * React hook is exported from ./useCoachingCollection.js (and re-exported below for Vite UI).
 * Non-UI Node tests should prefer createCoachingRuntime / getCoachingPageGateway over the hook.
 */

export {
  COACHING_RUNTIME_MODE,
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
  COACHING_LEGACY_STORAGE_KEY_PREFIX,
  COACHING_04_PHASE,
  COACHING_04_SCOPED_PERMISSION_IDS,
  COACHING_04_PLAYER_SELF_PERMISSION_IDS,
  COACHING_04_PLAYER_SELF_SCOPE_STATUS,
  COACHING_UI_COLLECTIONS,
} from "./constants.js";

export {
  COACHING_RUNTIME_ERROR_CODES,
  COACHING_RUNTIME_ERROR_CODE_VALUES,
  createCoachingRuntimeError,
  isCoachingRuntimeErrorResult,
} from "./errors.js";

export { createLegacyCoachingAdapter } from "./createLegacyCoachingAdapter.js";
export { createDurableCoachingAdapter } from "./createDurableCoachingAdapter.js";
export { createCoachingRuntime } from "./createCoachingRuntime.js";

export {
  detectLegacyStore,
  classifyLegacyStore,
  buildRetirementPlan,
  assertRetirementNotActivated,
} from "./localStorageRetirement.js";

export {
  COACHING_PLAYER_SCOPE_STATE,
  COACHING_PLAYER_SELF_READ_PERMISSION,
  resolveCoachingPlayerSelfScope,
  classifyCoachingDurableCollectionResult,
  assertCoachingPlayerDurableWriteAllowed,
} from "./playerSelfScope.js";

export {
  emitCoachingLegacyTelemetry,
  getCoachingLegacyIsolationContract,
} from "./legacyTelemetry.js";

export {
  COACHING_STAGING_DURABLE_RUNTIME_FLAG,
  COACHING_STAGING_OWNER_GO_GRANTED_FLAG,
  COACHING_APP_ENV_KEY,
  COACHING_APP_ENVIRONMENT,
  COACHING_STAGING_DURABLE_ACTIVATION_REASON,
  COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
  COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT,
  COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION,
  COACHING_04_STAGING_PROJECT_REF,
  classifyCoachingAppEnvironment,
  isCoachingStagingDurableFlagEnabled,
  isCoachingStagingOwnerGoGranted,
  resolveCoachingStagingOwnerGoGranted,
  readCoachingStagingDurableEnvFromImportMeta,
  extractSupabaseProjectRef,
  resolveCoachingStagingDurableActivation,
} from "./stagingDurableGate.js";

export {
  createDefaultCoachingRuntime,
  resolveDefaultCoachingRuntimeMode,
  getDefaultCoachingRuntime,
  resetDefaultCoachingRuntime,
  getCoachingPageGateway,
} from "./composition.js";

// useCoachingCollection lives in ./useCoachingCollection.js — import that file
// from pages so Node barrel consumers never resolve React.

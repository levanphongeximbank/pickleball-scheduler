/**
 * Court Engine runtime persistence authority (BM-FINAL-COURT-01).
 */

export {
  COURT_RUNTIME_AUTHORITY,
  COURT_RUNTIME_AUTHORITY_VALUES,
  COURT_RUNTIME_LOCAL_AUTHORITIES,
  COURT_RUNTIME_PHASE,
  COURT_RUNTIME_AUTHORITY_ENV_KEY,
  COURT_ENGINE_STORE_ENV_KEY,
} from "./constants.js";

export {
  COURT_RUNTIME_ERROR_CODES,
  COURT_RUNTIME_ERROR_CODE_VALUES,
  createCourtRuntimeError,
  isCourtRuntimeErrorResult,
} from "./errors.js";

export {
  resolveCourtRuntimeAuthority,
  isLocalCourtRuntimeAuthority,
  isDurableCourtRuntimeAuthority,
} from "./resolveCourtRuntimeAuthority.js";

export {
  createCourtRuntime,
  getCourtRuntimeWriter,
  getCourtRuntimeAuthority,
  assertLocalStorageWriteAllowed,
  __resetCourtRuntimeForTests,
} from "./composition.js";

export { createCourtRuntimeWriter } from "./createCourtRuntimeWriter.js";
export { createMemoryCourtRuntimeAdapter } from "./adapters/createMemoryCourtRuntimeAdapter.js";
export { createLocalCourtRuntimeAdapter } from "./adapters/createLocalCourtRuntimeAdapter.js";
export { createDurableCourtRuntimeAdapter } from "./adapters/createDurableCourtRuntimeAdapter.js";

export {
  inspectCourtRuntimeAuthority,
  loadCourtRuntime,
  loadActiveCourtSession,
  hydrateCourtRuntime,
  persistCourtSession,
  createCourtRuntimeSession,
  setActiveCourtSession,
  openCourtRuntimeSession,
  closeCourtRuntimeSession,
} from "./facade.js";

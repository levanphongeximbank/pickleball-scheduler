/**
 * BM-FINAL-COURT-01 — Court Operations runtime persistence authority constants.
 */

export const COURT_RUNTIME_AUTHORITY = Object.freeze({
  DURABLE: "durable",
  DEVELOPMENT_LOCAL: "development_local",
  OFFLINE_LOCAL: "offline_local",
  TEST_MEMORY: "test_memory",
});

export const COURT_RUNTIME_AUTHORITY_VALUES = Object.freeze(
  Object.values(COURT_RUNTIME_AUTHORITY)
);

/** Explicit local authorities — never inferred from cloud failure. */
export const COURT_RUNTIME_LOCAL_AUTHORITIES = Object.freeze([
  COURT_RUNTIME_AUTHORITY.DEVELOPMENT_LOCAL,
  COURT_RUNTIME_AUTHORITY.OFFLINE_LOCAL,
  COURT_RUNTIME_AUTHORITY.TEST_MEMORY,
]);

export const COURT_RUNTIME_PHASE = "BM-FINAL-COURT-01";

/** Env key for explicit authority selection. */
export const COURT_RUNTIME_AUTHORITY_ENV_KEY = "VITE_COURT_RUNTIME_AUTHORITY";

/** Legacy store mode env — only honored as explicit local outside secure runtimes. */
export const COURT_ENGINE_STORE_ENV_KEY = "VITE_COURT_ENGINE_STORE";

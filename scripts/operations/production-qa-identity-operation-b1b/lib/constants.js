/**
 * Operation B1B — QA quarantine authority runner (WP4 + WP6A staging rehearsal mode).
 *
 * PRODUCTION_GO=NO — no Production Owner GO is issued in this package.
 * STAGING_APPLY_GO=NO — WP6A readiness only; no Staging rehearsal execute.
 * Fresh Production authorization binding is populated by WP7 only.
 * Fresh Staging rehearsal binding is Owner-issued separately (never reuses Production GO/batch).
 *
 * OLD_OWNER_GO_REUSABLE=NO
 * OLD_BATCH_REUSABLE=NO
 */

export const OPERATION_ID = "OPERATION_B1B_QA_QUARANTINE_AUTHORITY";

/**
 * Explicit target mode — never auto-detect from project ref / env URL.
 * Unset input defaults to production (preserves pre-WP6A fail-closed semantics).
 */
export const OPERATION_TARGET_MODE = Object.freeze({
  PRODUCTION: "production",
  STAGING_REHEARSAL: "staging_rehearsal",
});

export const EXPECTED_PRODUCTION_PROJECT_REF = "expuvcohlcjzvrrauvud";

/** Exact Staging project ref for WP6 rehearsal — never accept Production ref in this mode. */
export const EXPECTED_STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";

export const EXPECTED_B1B_COUNT = 8;

/** RETIRED forever — must never authorize B1B (or any) Production mutation. */
export const RETIRED_OWNER_PRODUCTION_GO =
  "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY";

/**
 * Retired batch IDs — never authorize (Production or Staging rehearsal).
 * - b371… failed B1 live batch
 * - 9c9… unused / blocked no-adapter attempt
 */
export const RETIRED_OPERATION_B1_BATCH_IDS = Object.freeze([
  "b37186cf-e620-4f27-aba3-d7e8750ae7df",
  "9c9d5fc7-648e-44c6-a959-e62157f7c970",
]);

/**
 * WP4 does not issue a Production GO.
 * WP7 must supply a fresh binding via createFreshAuthorizationBinding / runtime input.
 * This constant remains null intentionally.
 */
export const FRESH_AUTHORIZATION_BINDING = null;

/**
 * WP6A does not issue a Staging rehearsal GO.
 * Owner supplies a fresh Staging binding at rehearsal time only.
 */
export const FRESH_STAGING_AUTHORIZATION_BINDING = null;

/** Exact confirmation string required alongside a future fresh Owner GO. */
export const REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION =
  "I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY_VIA_B1B_AUTHORITY";

/** Staging rehearsal confirmation — distinct from Production; never interchangeable. */
export const REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION =
  "I_UNDERSTAND_THIS_MUTATES_STAGING_QA_ONLY_VIA_B1B_STAGING_REHEARSAL";

/** Canonical Auth ban duration (same as historical hygiene tooling). */
export const QUARANTINE_BAN_DURATION = "876000h";

/** Official GoTrue unban value. */
export const AUTH_UNBAN_DURATION = "none";

/** Labels excluded as Operation B2 (referenced) — never process in B1B. */
export const B2_EXCLUDED_LABELS = Object.freeze([
  "QA-01",
  "QA-02",
  "QA-03",
]);

/** Certified B1/B1B exact-eight label range (subject to WP7 revalidation). */
export const CERTIFIED_B1_TARGET_LABELS = Object.freeze([
  "QA-04",
  "QA-05",
  "QA-06",
  "QA-07",
  "QA-08",
  "QA-09",
  "QA-10",
  "QA-11",
]);

/**
 * Staging-only disposable rehearsal labels — never interchangeable with Production QA-04..QA-11.
 */
export const CERTIFIED_STAGING_TARGET_LABELS = Object.freeze([
  "STG-QA-04",
  "STG-QA-05",
  "STG-QA-06",
  "STG-QA-07",
  "STG-QA-08",
  "STG-QA-09",
  "STG-QA-10",
  "STG-QA-11",
]);

/** Real-user lookalike that must never be treated as QA. */
export const FORBIDDEN_REAL_USER_EMAIL = "phase1b-smith@gmail.com";

export const ZERO_REFERENCE_KEYS = Object.freeze([
  "athlete_count",
  "membership_active",
  "membership_removed",
  "membership_total",
  "tenant_members",
  "tenants_owned",
  "club_governance_owner",
  "tournament_refs",
  "rating_refs",
  "finance_refs",
  "other_business_refs",
]);

export const ACTIVE_AUTH_BAN_STATES = Object.freeze([
  "applied",
  "not_required_preexisting",
]);

export const SOURCE_OPERATION = "OPERATION_B1B_QA_QUARANTINE_AUTHORITY";

/**
 * WP2 qa_quarantine_record_compensated_failure exact matrix.
 * Do not invent arbitrary classification strings in the runner.
 */
export const FAILURE_CLASSIFICATION_MATRIX = Object.freeze({
  auth_ban_failed: "failed",
  activation_failed_compensated: "reverted",
  compensation_incomplete: "failed",
  prepare_failure_recorded: "failed",
  activation_failed_preexisting: "failed",
});

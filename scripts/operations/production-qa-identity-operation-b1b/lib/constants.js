/**
 * Operation B1B — QA quarantine authority runner (WP4).
 *
 * PRODUCTION_GO=NO — no Production Owner GO is issued in this package.
 * Fresh authorization binding is populated by WP7 only.
 *
 * OLD_OWNER_GO_REUSABLE=NO
 * OLD_BATCH_REUSABLE=NO
 */

export const OPERATION_ID = "OPERATION_B1B_QA_QUARANTINE_AUTHORITY";

export const EXPECTED_PRODUCTION_PROJECT_REF = "expuvcohlcjzvrrauvud";

export const EXPECTED_B1B_COUNT = 8;

/** RETIRED forever — must never authorize B1B (or any) Production mutation. */
export const RETIRED_OWNER_PRODUCTION_GO =
  "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY";

/**
 * Retired batch IDs — never authorize.
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

/** Exact confirmation string required alongside a future fresh Owner GO. */
export const REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION =
  "I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY_VIA_B1B_AUTHORITY";

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

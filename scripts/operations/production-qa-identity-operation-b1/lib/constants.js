/**
 * Operation B1 — reversible QA identity quarantine (package constants).
 * PACKAGE ONLY. Forward live Production mutation path is RETIRED / INERT.
 *
 * OLD_OWNER_GO_REUSABLE=NO
 * OLD_BATCH_REUSABLE=NO
 * PRODUCTION_GO=NO
 */

export const OPERATION_ID = "OPERATION_B1_REVERSIBLE_QA_QUARANTINE";

export const EXPECTED_PRODUCTION_PROJECT_REF = "expuvcohlcjzvrrauvud";

export const EXPECTED_B1_COUNT = 8;

/**
 * RETIRED forever — must never authorize a new Production mutation.
 * Historical alias REQUIRED_OWNER_PRODUCTION_GO retained for audit/tests only.
 */
export const RETIRED_OWNER_PRODUCTION_GO =
  "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY";

/** @deprecated Retained as audit alias of RETIRED_OWNER_PRODUCTION_GO. Never authorizes. */
export const REQUIRED_OWNER_PRODUCTION_GO = RETIRED_OWNER_PRODUCTION_GO;

/**
 * Exact Owner GO for rollback/unquarantine only.
 * Forward GO must never authorize rollback.
 * Rollback remains historically gated; B1B is the forward successor.
 */
export const REQUIRED_OWNER_PRODUCTION_GO_ROLLBACK =
  "APPROVE_OPERATION_B1_ROLLBACK_UNQUARANTINE_ONLY";

/** Exact confirmation string required alongside Owner GO. */
export const REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION =
  "I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY";

/**
 * Retired batch IDs — never reuse for authorization.
 * - 9c9… unused / blocked no-adapter attempt
 * - b371… failed B1 live batch
 */
export const RETIRED_OPERATION_B1_BATCH_IDS = Object.freeze([
  "9c9d5fc7-648e-44c6-a959-e62157f7c970",
  "b37186cf-e620-4f27-aba3-d7e8750ae7df",
]);

/** Forward live execution permanently retired — B1B is the successor package. */
export const FORWARD_LIVE_EXECUTION_RETIRED = true;

/** Canonical reversible profile status (historical B1 write target — retired for forward). */
export const QUARANTINE_PROFILE_STATUS = "quarantined";

/** Canonical Auth ban duration used by prod-smoke-identity-hygiene. */
export const QUARANTINE_BAN_DURATION = "876000h";

/** Labels excluded as Operation B2 (referenced) — never process in B1. */
export const B2_EXCLUDED_LABELS = Object.freeze([
  "QA-01",
  "QA-02",
  "QA-03",
]);

/** Real-user lookalike that must never be treated as QA. */
export const FORBIDDEN_REAL_USER_EMAIL = "phase1b-smith@gmail.com";

export const ALLOWLIST_REQUIRED_FIELDS = Object.freeze([
  "auth_user_id",
  "profile_id",
  "expected_email",
  "profile_status",
  "auth_banned",
  "reference_counts",
  "captured_at",
  "production_project_ref",
]);

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

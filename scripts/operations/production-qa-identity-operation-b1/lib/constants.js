/**
 * Operation B1 — reversible QA identity quarantine (package constants).
 * PACKAGE ONLY. Production GO = NO until exact future Owner authorization.
 */

export const OPERATION_ID = "OPERATION_B1_REVERSIBLE_QA_QUARANTINE";

export const EXPECTED_PRODUCTION_PROJECT_REF = "expuvcohlcjzvrrauvud";

export const EXPECTED_B1_COUNT = 8;

/** Exact future Owner GO value required for forward mutation. */
export const REQUIRED_OWNER_PRODUCTION_GO =
  "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY";

/**
 * Exact Owner GO for rollback/unquarantine only.
 * Forward GO must never authorize rollback.
 */
export const REQUIRED_OWNER_PRODUCTION_GO_ROLLBACK =
  "APPROVE_OPERATION_B1_ROLLBACK_UNQUARANTINE_ONLY";

/** Exact confirmation string required alongside Owner GO. */
export const REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION =
  "I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY";

/**
 * Retired unused batch from blocked no-adapter attempt — never reuse.
 */
export const RETIRED_OPERATION_B1_BATCH_IDS = Object.freeze([
  "9c9d5fc7-648e-44c6-a959-e62157f7c970",
]);

/** Canonical reversible profile status (existing; no schema change). */
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

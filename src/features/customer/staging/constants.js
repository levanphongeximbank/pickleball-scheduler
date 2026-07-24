/**
 * CUSTOMER-07 — Staging identity constants (no secrets).
 */

export const CUSTOMER_07_STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";

export const CUSTOMER_07_STAGING_PROJECT_REF_ALLOWLIST = Object.freeze([
  CUSTOMER_07_STAGING_PROJECT_REF,
]);

export const CUSTOMER_07_PRODUCTION_PROJECT_REF_BLOCKLIST = Object.freeze([
  "expuvcohlcjzvrrauvud",
]);

export const CUSTOMER_07_PRODUCTION_DOMAIN_BLOCKLIST = Object.freeze([
  "pickvn.app",
]);

export const CUSTOMER_07_ENVIRONMENT_LABEL = "staging";

export const CUSTOMER_07_TEST_PREFIX = "CUSTOMER07_TEST_";

export const CUSTOMER_07_VERDICTS = Object.freeze({
  PASS_PR_OPEN: "CUSTOMER_07_PASS_PR_OPEN",
  STAGING_CERTIFIED: "CUSTOMER_07_STAGING_CERTIFIED",
  READY_WITH_BLOCKERS: "CUSTOMER_07_READY_WITH_BLOCKERS",
  BLOCKED_ENVIRONMENT_IDENTITY: "CUSTOMER_07_BLOCKED_ENVIRONMENT_IDENTITY",
  BLOCKED_BACKUP_ROLLBACK: "CUSTOMER_07_BLOCKED_BACKUP_ROLLBACK",
  BLOCKED: "CUSTOMER_07_BLOCKED",
  PARTIAL_APPLY_STOPPED: "CUSTOMER_07_PARTIAL_APPLY_STOPPED",
});

export const CUSTOMER_07_ENV_NAMES = Object.freeze({
  STAGING_SUPABASE_URL: "STAGING_SUPABASE_URL",
  VITE_SUPABASE_URL: "VITE_SUPABASE_URL",
  SUPABASE_URL: "SUPABASE_URL",
  STAGING_ANON_KEY: "STAGING_SUPABASE_ANON_KEY",
  VITE_ANON_KEY: "VITE_SUPABASE_ANON_KEY",
  STAGING_SERVICE_ROLE_KEY: "STAGING_SUPABASE_SERVICE_ROLE_KEY",
  ACCESS_TOKEN: "SUPABASE_ACCESS_TOKEN",
  BACKUP_EVIDENCE: "CUSTOMER_07_BACKUP_EVIDENCE",
  BACKUP_EVIDENCE_PATH: "CUSTOMER_07_BACKUP_EVIDENCE_PATH",
  OWNER_APPROVAL: "CUSTOMER_07_OWNER_APPROVAL",
  STAGING_ENV_FILE: "CUSTOMER_07_STAGING_ENV_FILE",
  VITE_APP_ENV: "VITE_APP_ENV",
});

export const CUSTOMER_07_MANIFEST_RELATIVE_PATH =
  "docs/customer-management/phase-7/staging-migration-manifest.json";

export const CUSTOMER_07_EVIDENCE_DIR =
  "docs/customer-management/phase-7/evidence";

export const CUSTOMER_07_SOFT_DISABLE_RELATIVE_PATH =
  "docs/customer-management/phase-7/90_CUSTOMER_07_SOFT_DISABLE.sql";

export const CUSTOMER_07_ROLLBACK_PATHS = Object.freeze([
  "docs/customer-management/phase-3/90_CUSTOMER_PHASE_3_ROLLBACK.sql",
  "docs/customer-management/phase-4/90_CUSTOMER_PHASE_4_ROLLBACK.sql",
  "docs/customer-management/phase-5/90_CUSTOMER_PHASE_5_ROLLBACK.sql",
  "docs/customer-management/phase-6/90_CUSTOMER_PHASE_6_ROLLBACK.sql",
  CUSTOMER_07_SOFT_DISABLE_RELATIVE_PATH,
]);

export const CUSTOMER_07_CRM_SAFETY_STASH_MARKERS = Object.freeze([
  "safety/customer-07-preserve-reappeared-crm-change",
  "safety/customer-06-preserve-crm-change",
]);

/** Committed contract for CI — not a live `git stash list` probe. */
export const CUSTOMER_07_CRM_SAFETY_STASH_EVIDENCE_RELATIVE_PATH =
  "docs/customer-management/phase-7/CRM_SAFETY_STASH_MARKERS.json";

/** CUSTOMER-06 feature commit that must be an ancestor of HEAD when reachable. */
export const CUSTOMER_07_CUSTOMER_06_COMMIT = "5349f1cf";

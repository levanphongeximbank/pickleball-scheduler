/**
 * OPERATION B1B — WP1 schema / migration static contract tests.
 * No database connection. No Staging/Production access.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_DIR = path.join(
  ROOT,
  "docs/v5/operations/production-qa-identity-operation-b1b-remediation/sql"
);
const FORWARD = "10_QA_IDENTITY_QUARANTINES_FORWARD.sql";
const ROLLBACK = "90_QA_IDENTITY_QUARANTINES_ROLLBACK.sql";

const REQUIRED_COLUMNS = [
  "id",
  "profile_id",
  "auth_user_id",
  "venue_id",
  "batch_id",
  "source_operation",
  "allowlist_sha256",
  "snapshot_sha256",
  "lifecycle_state",
  "auth_ban_state",
  "reason",
  "created_at",
  "created_by",
  "activated_at",
  "released_at",
  "released_by",
  "release_reason",
  "failure_classification",
  "lifecycle_version",
  "original_profile_status",
  "original_auth_banned",
  "expected_email",
  "allowlist_label",
  "metadata",
  "updated_at",
];

function read(name) {
  return fs.readFileSync(path.join(SQL_DIR, name), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

test("WP1 SQL package files exist and cross-reference the same table", () => {
  assert.ok(fs.existsSync(path.join(SQL_DIR, FORWARD)), FORWARD);
  assert.ok(fs.existsSync(path.join(SQL_DIR, ROLLBACK)), ROLLBACK);
  const forward = read(FORWARD);
  const rollback = read(ROLLBACK);
  assert.match(forward, /public\.qa_identity_quarantines/);
  assert.match(rollback, /public\.qa_identity_quarantines/);
  assert.match(forward, /AUTHORED ONLY|NOT APPLIED/i);
  assert.match(rollback, /AUTHORED ONLY|NOT EXECUTED/i);
});

test("1-3) forward creates canonical table with required columns and no auth_ban_applied", () => {
  const raw = read(FORWARD);
  const sql = stripSqlComments(raw);
  assert.match(
    sql,
    /create\s+table\s+if\s+not\s+exists\s+public\.qa_identity_quarantines/i
  );
  const createMatch = sql.match(
    /create\s+table\s+if\s+not\s+exists\s+public\.qa_identity_quarantines\s*\(([\s\S]*?)\)\s*;/i
  );
  assert.ok(createMatch, "CREATE TABLE body required");
  const createBody = createMatch[1];
  for (const col of REQUIRED_COLUMNS) {
    assert.match(
      createBody,
      new RegExp(`\\b${col}\\b`, "i"),
      `missing column contract: ${col}`
    );
  }
  assert.doesNotMatch(createBody, /\bauth_ban_applied\b/i);
  assert.match(raw, /auth_ban_applied column is forbidden/i);
});

test("4-5) lifecycle_state and auth_ban_state value domains are exact", () => {
  const sql = stripSqlComments(read(FORWARD));
  assert.match(
    sql,
    /lifecycle_state\s+in\s*\(\s*'pending'\s*,\s*'active'\s*,\s*'released'\s*,\s*'failed'\s*\)/i
  );
  assert.match(
    sql,
    /auth_ban_state\s+in\s*\(\s*'pending'\s*,\s*'applied'\s*,\s*'not_required_preexisting'\s*,\s*'reverted'\s*,\s*'failed'\s*\)/i
  );
  assert.doesNotMatch(
    sql,
    /lifecycle_state\s+in\s*\([^)]*'reverted'/i
  );
});

test("6-8) active-success, identity-bind, and original_status checks exist", () => {
  const sql = stripSqlComments(read(FORWARD));
  assert.match(sql, /qa_identity_quarantines_active_success_check/i);
  assert.match(
    sql,
    /auth_ban_state\s+in\s*\(\s*'applied'\s*,\s*'not_required_preexisting'\s*\)/i
  );
  assert.match(sql, /activated_at\s+is\s+not\s+null/i);
  assert.match(sql, /qa_identity_quarantines_identity_bind_check/i);
  assert.match(sql, /profile_id\s*=\s*auth_user_id/i);
  assert.match(sql, /qa_identity_quarantines_original_status_check/i);
  assert.match(
    sql,
    /original_profile_status\s+in\s*\(\s*'active'\s*,\s*'suspended'\s*,\s*'invited'\s*\)/i
  );
  assert.doesNotMatch(
    sql,
    /original_profile_status\s+in\s*\([^)]*quarantined/i
  );
});

test("pending / release / reverted-failure consistency checks are defined", () => {
  const sql = stripSqlComments(read(FORWARD));
  assert.match(sql, /qa_identity_quarantines_pending_auth_check/i);
  assert.match(sql, /qa_identity_quarantines_release_consistency_check/i);
  assert.match(sql, /qa_identity_quarantines_reverted_failure_check/i);
  assert.match(sql, /qa_identity_quarantines_failed_auth_not_active_check/i);
  assert.match(sql, /auth_ban_state\s*<>\s*'reverted'/i);
  assert.match(sql, /lifecycle_state\s*=\s*'failed'/i);
});

test("9-11) unique partial indexes for active profile, active auth, pending batch", () => {
  const sql = stripSqlComments(read(FORWARD));
  assert.match(sql, /qa_identity_quarantines_active_profile_uidx/i);
  assert.match(
    sql,
    /unique\s+index[\s\S]*qa_identity_quarantines_active_profile_uidx[\s\S]*\(profile_id\)[\s\S]*lifecycle_state\s*=\s*'active'/i
  );
  assert.match(sql, /qa_identity_quarantines_active_auth_uidx/i);
  assert.match(
    sql,
    /unique\s+index[\s\S]*qa_identity_quarantines_active_auth_uidx[\s\S]*\(auth_user_id\)[\s\S]*lifecycle_state\s*=\s*'active'/i
  );
  assert.match(sql, /qa_identity_quarantines_pending_profile_batch_uidx/i);
  assert.match(
    sql,
    /unique\s+index[\s\S]*qa_identity_quarantines_pending_profile_batch_uidx[\s\S]*\(profile_id\s*,\s*batch_id\)[\s\S]*lifecycle_state\s*=\s*'pending'/i
  );
  assert.match(sql, /qa_identity_quarantines_batch_lifecycle_idx/i);
  assert.match(sql, /qa_identity_quarantines_lifecycle_created_at_idx/i);
});

test("12-14) immutable-field trigger (no service_role exemption) and hard-delete denial", () => {
  const sql = stripSqlComments(read(FORWARD));
  assert.match(sql, /qa_identity_quarantines_immutable_fields_guard/i);
  assert.match(sql, /qa_identity_quarantines_immutable_fields_trg/i);
  assert.match(sql, /before\s+update\s+on\s+public\.qa_identity_quarantines/i);
  assert.match(sql, /QA_IDENTITY_QUARANTINE_IMMUTABLE_FIELD/);
  assert.match(sql, /including via service_role/i);
  assert.doesNotMatch(
    sql,
    /current_user\s*=\s*'service_role'|session_user\s*=\s*'service_role'|IF\s+.*service_role.*THEN\s+RETURN/i
  );
  assert.match(sql, /qa_identity_quarantines_deny_hard_delete/i);
  assert.match(sql, /qa_identity_quarantines_deny_hard_delete_trg/i);
  assert.match(sql, /before\s+delete\s+on\s+public\.qa_identity_quarantines/i);
  assert.match(sql, /QA_IDENTITY_QUARANTINE_HARD_DELETE_DENIED/);
});

test("15-18) no profiles mutation, no quarantined persistence, no anon/auth DML grants, no RLS/RPC", () => {
  const sql = stripSqlComments(read(FORWARD));
  assert.doesNotMatch(sql, /alter\s+table\s+public\.profiles\b/i);
  assert.doesNotMatch(
    sql,
    /alter\s+table[\s\S]{0,200}profiles_status_check|drop\s+constraint[\s\S]{0,80}profiles_status_check|add\s+constraint[\s\S]{0,80}profiles_status_check/i
  );
  assert.doesNotMatch(sql, /update\s+public\.profiles\b/i);
  assert.doesNotMatch(sql, /status\s*=\s*'quarantined'/i);
  assert.doesNotMatch(
    sql,
    /grant\s+(insert|update|delete|all)\b[\s\S]{0,120}\b(to\s+)?(anon|authenticated)\b/i
  );
  assert.doesNotMatch(sql, /create\s+policy\b/i);
  assert.doesNotMatch(sql, /enable\s+row\s+level\s+security/i);
  assert.doesNotMatch(sql, /security\s+definer/i);
  assert.doesNotMatch(sql, /qa_quarantine_prepare|qa_quarantine_release/i);
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.qa_identity_quarantines\s+from\s+anon/i);
  assert.match(
    sql,
    /revoke\s+all\s+on\s+table\s+public\.qa_identity_quarantines\s+from\s+authenticated/i
  );
});

test("19-20) rollback targets only WP1 objects and agrees with forward names", () => {
  const forward = stripSqlComments(read(FORWARD));
  const rollback = stripSqlComments(read(ROLLBACK));

  assert.match(rollback, /qa_identity_quarantines_deny_hard_delete_trg/i);
  assert.match(rollback, /qa_identity_quarantines_deny_hard_delete\s*\(/i);
  assert.match(rollback, /qa_identity_quarantines_immutable_fields_trg/i);
  assert.match(rollback, /qa_identity_quarantines_immutable_fields_guard\s*\(/i);
  assert.match(rollback, /drop\s+table\s+if\s+exists\s+public\.qa_identity_quarantines/i);

  assert.doesNotMatch(rollback, /alter\s+table\s+public\.profiles\b/i);
  assert.doesNotMatch(rollback, /profiles_status_check/i);
  assert.doesNotMatch(rollback, /auth\.users/i);
  assert.doesNotMatch(rollback, /\bcascade\b/i);
  assert.doesNotMatch(rollback, /drop\s+table\s+if\s+exists\s+public\.profiles\b/i);

  for (const name of [
    "qa_identity_quarantines_deny_hard_delete_trg",
    "qa_identity_quarantines_deny_hard_delete",
    "qa_identity_quarantines_immutable_fields_trg",
    "qa_identity_quarantines_immutable_fields_guard",
    "qa_identity_quarantines",
  ]) {
    assert.match(forward, new RegExp(name, "i"), `forward missing ${name}`);
    assert.match(rollback, new RegExp(name, "i"), `rollback missing ${name}`);
  }
});

test("FK types and fail-closed markers match repository profiles contract", () => {
  const sql = stripSqlComments(read(FORWARD));
  assert.match(sql, /profile_id\s+uuid\s+not\s+null/i);
  assert.match(sql, /auth_user_id\s+uuid\s+not\s+null/i);
  assert.match(sql, /venue_id\s+text\s+null/i);
  assert.match(sql, /references\s+public\.profiles\s*\(\s*id\s*\)/i);
  assert.match(sql, /references\s+auth\.users\s*\(\s*id\s*\)/i);
  assert.match(sql, /on\s+delete\s+restrict/i);
  assert.match(sql, /QA_IDENTITY_QUARANTINES_INCOMPATIBLE/);
  assert.match(sql, /NOT runtime-ready until WP2/i);
});

test("reason_nonempty: creation clause unchanged; preflight accepts PG TRIM(BOTH FROM)", () => {
  const sql = stripSqlComments(read(FORWARD));

  // Creation semantics must stay canonical (not rewritten to BOTH FROM).
  assert.match(
    sql,
    /ADD\s+CONSTRAINT\s+qa_identity_quarantines_reason_nonempty_check\s+CHECK\s*\(\s*length\s*\(\s*trim\s*\(\s*reason\s*\)\s*\)\s*>\s*0\s*\)/i
  );

  const preflightMatch = sql.match(
    /qa_identity_quarantines_reason_nonempty_check[\s\S]*?v_def\s*!~\*\s*'([^']+)'/i
  );
  assert.ok(preflightMatch, "reason_nonempty preflight comparator required");
  const comparatorSource = preflightMatch[1];
  assert.match(
    comparatorSource,
    /both\\s\+from\\s\+/i,
    "preflight must optionally accept BOTH FROM normalization"
  );

  const comparator = new RegExp(comparatorSource, "i");
  const pgNormalized =
    "CHECK ((length(TRIM(BOTH FROM reason)) > 0))";
  const authored = "CHECK (length(trim(reason)) > 0)";
  const authoredParen = "CHECK ((length(trim(reason)) > 0))";

  assert.match(pgNormalized, comparator);
  assert.match(authored, comparator);
  assert.match(authoredParen, comparator);

  // Fail-closed: trim is required; length(reason) alone is incompatible.
  assert.doesNotMatch("CHECK (length(reason) > 0)", comparator);
  assert.doesNotMatch("CHECK ((length(reason) > 0))", comparator);
  assert.doesNotMatch("CHECK (reason IS NOT NULL)", comparator);
  assert.doesNotMatch("CHECK (length(btrim(reason)) > 0)", comparator);
});

test("secret scan: WP1 SQL artifacts contain no credentials", () => {
  for (const file of [FORWARD, ROLLBACK]) {
    const text = read(file);
    assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\./);
    assert.doesNotMatch(text, /SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/i);
    assert.doesNotMatch(text, /supabase\.co\/[a-z]+\/[a-z0-9-]+/i);
    assert.doesNotMatch(text, /postgres:\/\/[^:\s]+:[^@\s]+@/i);
  }
});

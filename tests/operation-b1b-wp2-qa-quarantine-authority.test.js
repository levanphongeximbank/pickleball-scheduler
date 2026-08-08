/**
 * OPERATION B1B — WP2 RLS / controlled writer authority static contract tests.
 * No database connection. No Staging/Production access.
 *
 * Canonical active-list RPC name resolution:
 *   qa_quarantine_list_active  (canonical)
 *   qa_quarantine_list_active_batched  (forbidden; must not exist)
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
const WP1_FORWARD = "10_QA_IDENTITY_QUARANTINES_FORWARD.sql";
const WP1_ROLLBACK = "90_QA_IDENTITY_QUARANTINES_ROLLBACK.sql";
const FORWARD = "20_QA_IDENTITY_QUARANTINE_AUTHORITY_FORWARD.sql";
const ROLLBACK = "80_QA_IDENTITY_QUARANTINE_AUTHORITY_ROLLBACK.sql";

const WRITERS = [
  "qa_quarantine_prepare",
  "qa_quarantine_activate_after_auth_ban",
  "qa_quarantine_activate_preexisting_ban",
  "qa_quarantine_record_compensated_failure",
  "qa_quarantine_release",
];

const EXPOSED_RPCS = [
  ...WRITERS,
  "qa_quarantine_get_state",
  "qa_quarantine_list_active",
];

const AUDIT_ACTIONS = [
  "qa_quarantine.prepare",
  "qa_quarantine.activate_after_auth_ban",
  "qa_quarantine.activate_preexisting_ban",
  "qa_quarantine.compensated_failure",
  "qa_quarantine.release",
];

function read(name) {
  return fs.readFileSync(path.join(SQL_DIR, name), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

function functionBody(sql, name) {
  const re = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([\\s\\S]*?\\)\\s*returns[\\s\\S]*?as\\s*\\$\\$([\\s\\S]*?)\\$\\$\\s*;`,
    "i"
  );
  const m = sql.match(re);
  assert.ok(m, `function body required for ${name}`);
  return m[1];
}

function doBlockBody(sql, label) {
  const re = new RegExp(
    `do\\s+\\$${label}\\$([\\s\\S]*?)\\$${label}\\$\\s*;`,
    "i"
  );
  const m = sql.match(re);
  assert.ok(m, `DO block $${label}$ required`);
  return m[1];
}

const PHASE1B_KNOWN_ACTIONS = [
  "login",
  "login_failed",
  "logout",
  "create",
  "update",
  "delete",
  "assign_role",
  "permission_change",
  "password_change",
  "reset_password",
  "pairing_override",
  "group_override",
  "club.create",
  "club.update",
  "club.leave_membership",
  "club.delete",
  "club.membership_request.submit",
  "club.membership_request.review",
  "club.membership_request.correction",
  "club.membership_request.cancel",
  "club.member.add",
  "club.member.remove",
  "club.member.restore",
  "club.assign_owner",
  "club.clear_owner",
  "club.transfer_president",
  "club.assign_vice_president",
  "club.clear_vice_president",
  "club.owner.transfer",
  "club.president.transfer",
  "club.vice_president.assign",
  "rating.verify",
  "rating.propose",
  "audit.view",
  "workflow.notification",
  "user.manage.denied",
  "user.manage.status-change",
  "payment_success",
  "approve",
];

const RETIRED_BATCH = "b37186cf-e620-4f27-aba3-d7e8750ae7df";

let assertionCount = 0;
function check(condition, message) {
  assertionCount += 1;
  assert.ok(condition, message);
}

test("WP2 package files exist; WP1 unchanged and still present", () => {
  check(fs.existsSync(path.join(SQL_DIR, FORWARD)), FORWARD);
  check(fs.existsSync(path.join(SQL_DIR, ROLLBACK)), ROLLBACK);
  check(fs.existsSync(path.join(SQL_DIR, WP1_FORWARD)), WP1_FORWARD);
  check(fs.existsSync(path.join(SQL_DIR, WP1_ROLLBACK)), WP1_ROLLBACK);
  const forward = read(FORWARD);
  const rollback = read(ROLLBACK);
  check(/AUTHORED ONLY|NOT APPLIED/i.test(forward), "forward authored-only marker");
  check(/AUTHORED ONLY|NOT EXECUTED/i.test(rollback), "rollback authored-only marker");
  check(/OLD_OWNER_GO_REUSABLE\s*=\s*NO/.test(forward), "old GO non-reusable");
  check(/OLD_BATCH_REUSABLE\s*=\s*NO/.test(forward), "old batch non-reusable");
  check(
    /b37186cf-e620-4f27-aba3-d7e8750ae7df/.test(forward),
    "retired batch id recorded"
  );
  check(/APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY/.test(forward), "retired GO recorded");
});

test("1) WP2 forward requires WP1 table and WP1 guards", () => {
  const sql = stripSqlComments(read(FORWARD));
  const preflight = doBlockBody(sql, "preflight");
  check(
    /qa_identity_quarantines missing \(WP1 required\)/i.test(preflight) ||
      /to_regclass\('public\.qa_identity_quarantines'\)\s+IS\s+NULL/i.test(preflight),
    "WP1 table required preflight"
  );
  check(/pg_get_constraintdef/i.test(preflight), "constraint definition preflight");
  check(/pg_get_indexdef/i.test(preflight), "index definition preflight");
  check(/tgenabled/i.test(preflight), "trigger enabled preflight");
  check(/tgtype/i.test(preflight), "trigger timing/event preflight");
  check(/tgfoid|proname/i.test(preflight), "trigger function preflight");
  check(/qa_identity_quarantines_immutable_fields_trg/i.test(preflight), "immutable trigger preflight");
  check(/qa_identity_quarantines_deny_hard_delete_trg/i.test(preflight), "hard-delete trigger preflight");
  check(/auth_ban_applied column is forbidden/i.test(preflight), "no auth_ban_applied");
  check(/qa_identity_quarantines_active_profile_uidx/i.test(preflight), "active index preflight");
  check(/qa_identity_quarantines_pending_profile_batch_uidx/i.test(preflight), "pending index preflight");
  check(
    !/create\s+table\s+(if\s+not\s+exists\s+)?public\.qa_identity_quarantines/i.test(sql),
    "WP2 must not redefine WP1 table"
  );
  check(
    !/create\s+(unique\s+)?index|add\s+constraint|create\s+trigger/i.test(
      preflight.replace(/raise\s+exception[\s\S]*?;/gi, "")
    ) || !/create\s+trigger/i.test(sql),
    "WP2 preflight does not repair WP1 objects"
  );
  check(
    !/create\s+trigger\b/i.test(sql) &&
      !/add\s+constraint\s+qa_identity_quarantines_/i.test(sql) &&
      !/create\s+unique\s+index\s+.*qa_identity_quarantines_/i.test(sql),
    "WP2 does not recreate WP1 constraints/indexes/triggers"
  );
});

test("2-6) RLS enabled; no permissive policies; direct DML revoked incl service_role", () => {
  const sql = stripSqlComments(read(FORWARD));
  check(
    /alter\s+table\s+public\.qa_identity_quarantines\s+enable\s+row\s+level\s+security/i.test(
      sql
    ),
    "RLS enabled"
  );
  check(!/create\s+policy\b/i.test(sql), "no permissive table policies");
  check(!/force\s+row\s+level\s+security/i.test(sql), "FORCE RLS not used");
  check(
    /revoke\s+all\s+on\s+table\s+public\.qa_identity_quarantines\s+from\s+anon/i.test(sql),
    "anon table DML revoked"
  );
  check(
    /revoke\s+all\s+on\s+table\s+public\.qa_identity_quarantines\s+from\s+authenticated/i.test(
      sql
    ),
    "authenticated table DML revoked"
  );
  check(
    /revoke\s+all\s+on\s+table\s+public\.qa_identity_quarantines\s+from\s+service_role/i.test(
      sql
    ),
    "service_role direct table DML revoked"
  );
  check(
    !/grant\s+(select|insert|update|delete|all)\b[\s\S]{0,120}on\s+table\s+public\.qa_identity_quarantines/i.test(
      sql
    ),
    "no direct table grants"
  );
});

test("7-10) canonical RPCs exist; batched alias must not exist", () => {
  const sql = stripSqlComments(read(FORWARD));
  for (const name of WRITERS) {
    check(
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, "i").test(
        sql
      ),
      `writer ${name}`
    );
  }
  check(
    /create\s+or\s+replace\s+function\s+public\.qa_quarantine_get_state\s*\(/i.test(sql),
    "get_state"
  );
  check(
    /create\s+or\s+replace\s+function\s+public\.qa_quarantine_list_active\s*\(\s*p_profile_ids\s+uuid\[\]/i.test(
      sql
    ),
    "canonical list_active"
  );
  check(
    !/create\s+or\s+replace\s+function\s+public\.qa_quarantine_list_active_batched\b/i.test(
      sql
    ),
    "batched alias must not be defined"
  );
  check(
    /forbidden alias qa_quarantine_list_active_batched/i.test(sql),
    "batched alias fail-closed preflight"
  );
  check(
    /Canonical name resolution:\s*qa_quarantine_list_active/i.test(read(FORWARD)) ||
      /sole canonical set-based active read/i.test(read(FORWARD)),
    "canonical name resolution recorded"
  );
});

test("11-16) SECURITY DEFINER, fixed search_path, AuthZ, grants", () => {
  const raw = read(FORWARD);
  const sql = stripSqlComments(raw);
  for (const name of EXPOSED_RPCS) {
    const block = sql.match(
      new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([\\s\\S]*?\\$\\$\\s*;`,
        "i"
      )
    );
    check(Boolean(block), `function block ${name}`);
    check(/security\s+definer/i.test(block[0]), `${name} SECURITY DEFINER`);
    check(
      /set\s+search_path\s*=\s*public\s*,\s*auth\s*,\s*pg_temp/i.test(block[0]),
      `${name} fixed search_path`
    );
    const body = functionBody(sql, name);
    if (name === "qa_quarantine_list_active") {
      // WP3 corrective: directory-filter reader (SUPER_ADMIN/service_role/SYSTEM_TECHNICIAN).
      check(
        /qa_quarantine_is_directory_filter_reader\s*\(\s*\)/i.test(body),
        `${name} directory-filter AuthZ`
      );
      check(
        !/qa_quarantine_is_authorized_caller\s*\(\s*\)/i.test(body),
        `${name} does not use writer AuthZ helper`
      );
    } else {
      check(
        /qa_quarantine_is_authorized_caller\s*\(\s*\)/i.test(body),
        `${name} explicit writer/privileged AuthZ`
      );
    }
  }
  check(/is_super_admin\s*\(\s*\)/i.test(sql), "SUPER_ADMIN via is_super_admin");
  check(
    /SYSTEM_TECHNICIAN/i.test(functionBody(sql, "qa_quarantine_is_directory_filter_reader")),
    "directory-filter reader includes SYSTEM_TECHNICIAN"
  );
  check(
    /request\.jwt\.claim\.role[\s\S]{0,80}service_role|auth\.jwt\(\)\s*->>\s*'role'[\s\S]{0,40}service_role/i.test(
      sql
    ),
    "service_role claim path explicit"
  );
  for (const name of EXPOSED_RPCS) {
    check(
      new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${name}[\\s\\S]{0,200}from\\s+anon`,
        "i"
      ).test(sql),
      `${name} anon EXECUTE revoked`
    );
    check(
      new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+public\\.${name}[\\s\\S]{0,200}to\\s+authenticated`,
        "i"
      ).test(sql),
      `${name} authenticated EXECUTE (body AuthZ)`
    );
    check(
      new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+public\\.${name}[\\s\\S]{0,200}to\\s+service_role`,
        "i"
      ).test(sql),
      `${name} service_role EXECUTE`
    );
  }
  check(
    /revoke\s+all\s+on\s+function\s+public\.qa_quarantine_write_audit[\s\S]{0,200}from\s+authenticated/i.test(
      sql
    ),
    "internal audit helper not client-callable"
  );
});

test("17-22) prepare pending/pending, OPERATION_B1B, labels, bind, no profile/auth mutation", () => {
  const sql = stripSqlComments(read(FORWARD));
  const body = functionBody(sql, "qa_quarantine_prepare");
  check(/'pending'\s*,\s*'pending'/i.test(body) || (
    /lifecycle_state[\s\S]{0,40}'pending'/i.test(body) &&
    /auth_ban_state[\s\S]{0,40}'pending'/i.test(body) &&
    /lifecycle_version[\s\S]{0,40}1/i.test(body)
  ), "prepare inserts pending/pending");
  check(/'OPERATION_B1B'/i.test(body), "source_operation fixed OPERATION_B1B");
  check(/'QA-04'[\s\S]*'QA-05'[\s\S]*'QA-06'[\s\S]*'QA-07'[\s\S]*'QA-08'[\s\S]*'QA-09'[\s\S]*'QA-10'[\s\S]*'QA-11'/i.test(body), "exact eight labels");
  check(/profile_not_found|from\s+public\.profiles/i.test(body), "profile exists check");
  check(/auth_user_not_found|from\s+auth\.users/i.test(body), "auth user exists check");
  check(/identity_bind_mismatch|p_profile_id\s+is\s+distinct\s+from\s+p_auth_user_id/i.test(body), "identity bind");
  check(/email_mismatch|lower\(trim/i.test(body), "email binding");
  check(/invalid_artifact_hash|\^\[a-f0-9\]\{64\}\$/i.test(body), "artifact hash gate");
  check(!/update\s+public\.profiles\b/i.test(body), "prepare no profiles.status update");
  check(!/update\s+auth\.users\b/i.test(body), "prepare no auth.users mutation");
  check(!/update\s+public\.profiles\b/i.test(sql), "WP2 SQL no profiles update");
  check(!/update\s+auth\.users\b/i.test(sql), "WP2 SQL no auth.users update");
});

test("23-30) activation, compensated failure, release, should_unban", () => {
  const sql = stripSqlComments(read(FORWARD));
  const afterBan = functionBody(sql, "qa_quarantine_activate_after_auth_ban");
  const preexisting = functionBody(sql, "qa_quarantine_activate_preexisting_ban");
  const compensated = functionBody(sql, "qa_quarantine_record_compensated_failure");
  const release = functionBody(sql, "qa_quarantine_release");

  check(/lifecycle_state\s+is\s+distinct\s+from\s+'pending'/i.test(afterBan), "after-ban requires pending lifecycle");
  check(/auth_ban_state\s+is\s+distinct\s+from\s+'pending'/i.test(afterBan), "after-ban requires pending auth");
  check(/original_auth_banned\s+is\s+not\s+false/i.test(afterBan), "after-ban requires original_auth_banned=false");
  check(/auth_ban_readback_confirmed/i.test(afterBan), "after-ban requires readback confirmation");
  check(!/http|admin\.api|auth\.admin/i.test(afterBan), "after-ban does not call Auth Admin API");

  check(/original_auth_banned\s+is\s+not\s+true/i.test(preexisting), "preexisting requires original_auth_banned=true");
  check(/'not_required_preexisting'/i.test(preexisting), "preexisting auth_ban_state target");

  check(/'failed'\s*,\s*'reverted'|not\s+in\s*\(\s*'failed'\s*,\s*'reverted'\s*\)/i.test(compensated), "compensated allows only failed/reverted");
  check(/lifecycle_state\s*=\s*'failed'/i.test(compensated), "compensated sets lifecycle failed");
  check(!/lifecycle_state\s*=\s*'reverted'/i.test(compensated), "no lifecycle_state reverted");
  check(/auth_ban_failed|activation_failed_compensated|compensation_incomplete|prepare_failure_recorded/i.test(compensated), "approved classifications");
  check(
    /v_class\s*=\s*'auth_ban_failed'\s+and\s+v_target_auth\s*=\s*'failed'/i.test(compensated),
    "matrix auth_ban_failed→failed"
  );
  check(
    /v_class\s*=\s*'activation_failed_compensated'\s+and\s+v_target_auth\s*=\s*'reverted'/i.test(
      compensated
    ),
    "matrix activation_failed_compensated→reverted"
  );
  check(
    /v_class\s*=\s*'compensation_incomplete'\s+and\s+v_target_auth\s*=\s*'failed'/i.test(
      compensated
    ),
    "matrix compensation_incomplete→failed"
  );
  check(
    /v_class\s*=\s*'prepare_failure_recorded'\s+and\s+v_target_auth\s*=\s*'failed'/i.test(
      compensated
    ),
    "matrix prepare_failure_recorded→failed"
  );
  check(/invalid_compensation_pair/i.test(compensated), "unknown pair fails closed");
  check(
    !/compensation_incomplete'[\s\S]{0,80}reverted/i.test(compensated) ||
      /compensation_incomplete'\s+and\s+v_target_auth\s*=\s*'failed'/i.test(compensated),
    "compensation_incomplete never pairs with reverted"
  );

  check(/lifecycle_state\s+is\s+distinct\s+from\s+'active'/i.test(release), "release requires active");
  check(/'applied'\s*,\s*'not_required_preexisting'/i.test(release), "release requires successful auth state");
  check(/should_unban/.test(release), "should_unban returned");
  check(
    /auth_ban_state\s*=\s*'applied'[\s\S]{0,80}original_auth_banned\s+is\s+false/i.test(release),
    "should_unban rule"
  );
});

test("31-36) optimistic concurrency, updated_at, immutables, audit fail-closed", () => {
  const sql = stripSqlComments(read(FORWARD));
  for (const name of [
    "qa_quarantine_activate_after_auth_ban",
    "qa_quarantine_activate_preexisting_ban",
    "qa_quarantine_record_compensated_failure",
    "qa_quarantine_release",
  ]) {
    const body = functionBody(sql, name);
    check(/p_expected_lifecycle_version/i.test(body), `${name} expected version`);
    check(/version_mismatch/i.test(body), `${name} version mismatch fail-closed`);
    check(/lifecycle_version\s*=\s*q\.lifecycle_version\s*\+\s*1/i.test(body), `${name} increments version`);
    check(/updated_at\s*=\s*now\s*\(\s*\)/i.test(body), `${name} sets updated_at`);
    check(/for\s+update/i.test(body), `${name} row lock`);
  }

  for (const name of [
    "qa_quarantine_activate_after_auth_ban",
    "qa_quarantine_activate_preexisting_ban",
    "qa_quarantine_record_compensated_failure",
    "qa_quarantine_release",
  ]) {
    const body = functionBody(sql, name);
    const setMatch = body.match(/update\s+public\.qa_identity_quarantines[\s\S]*?set\s*([\s\S]*?)where/i);
    check(Boolean(setMatch), `${name} has UPDATE SET`);
    const setClause = setMatch[1];
    for (const immutable of [
      "profile_id",
      "auth_user_id",
      "venue_id",
      "batch_id",
      "source_operation",
      "allowlist_sha256",
      "snapshot_sha256",
      "expected_email",
      "allowlist_label",
      "original_profile_status",
      "original_auth_banned",
      "created_at",
      "created_by",
      "reason",
    ]) {
      check(
        !new RegExp(`\\b${immutable}\\s*=`, "i").test(setClause),
        `${name} must not update immutable ${immutable}`
      );
    }
  }

  for (const name of WRITERS) {
    const body = functionBody(sql, name);
    if (name === "qa_quarantine_prepare") {
      check(/qa_quarantine_write_audit\s*\(\s*'qa_quarantine\.prepare'/i.test(body), "prepare audit");
    } else if (name === "qa_quarantine_activate_after_auth_ban") {
      check(/qa_quarantine\.activate_after_auth_ban/i.test(body), "activate-after audit");
    } else if (name === "qa_quarantine_activate_preexisting_ban") {
      check(/qa_quarantine\.activate_preexisting_ban/i.test(body), "preexisting audit");
    } else if (name === "qa_quarantine_record_compensated_failure") {
      check(/qa_quarantine\.compensated_failure/i.test(body), "compensated audit");
    } else if (name === "qa_quarantine_release") {
      check(/qa_quarantine\.release/i.test(body), "release audit");
    }
  }

  for (const action of AUDIT_ACTIONS) {
    check(sql.includes(`'${action}'`), `audit action whitelisted/emitted: ${action}`);
  }

  const auditBody = functionBody(sql, "qa_quarantine_write_audit");
  check(/insert\s+into\s+public\.audit_logs/i.test(auditBody), "audit inserts into audit_logs");
  check(
    /Fail-closed|QA_QUARANTINE_AUDIT_ACTION_REQUIRED|abort the lifecycle transaction/i.test(
      read(FORWARD)
    ) || !/exception\s+when\s+others/i.test(auditBody),
    "audit failure fail-closed (no swallow)"
  );
  check(!/exception\s+when\s+others/i.test(auditBody), "audit helper does not swallow errors");
});

test("37-40) read RPCs hide secrets; list_active is set-based anti-N+1", () => {
  const sql = stripSqlComments(read(FORWARD));
  const getState = functionBody(sql, "qa_quarantine_get_state");
  const listActive = functionBody(sql, "qa_quarantine_list_active");
  const listActiveHeader = sql.match(
    /create\s+or\s+replace\s+function\s+public\.qa_quarantine_list_active\s*\([\s\S]*?\)\s*returns\s+table\s*\(([\s\S]*?)\)\s*language/i
  );
  check(Boolean(listActiveHeader), "list_active RETURNS TABLE header");
  const listReturnCols = listActiveHeader[1];

  check(!/expected_email/i.test(getState), "get_state does not expose expected_email");
  check(!/allowlist_sha256|snapshot_sha256/i.test(getState), "get_state hides hashes");
  check(!/expected_email/i.test(listActive), "list_active does not expose expected_email");
  check(!/allowlist_sha256|snapshot_sha256/i.test(listActive), "list_active hides hashes");

  // WP3 corrective wire minimization: membership key only.
  check(/^\s*profile_id\s+uuid\s*$/i.test(listReturnCols.trim()), "list_active returns profile_id only");
  check(!/\bbatch_id\b/i.test(listReturnCols), "list_active omits batch_id");
  check(!/\ballowlist_label\b/i.test(listReturnCols), "list_active omits allowlist_label");
  check(!/\bauth_ban_state\b/i.test(listReturnCols), "list_active omits auth_ban_state");
  check(!/\bvenue_id\b/i.test(listReturnCols), "list_active omits venue_id");

  check(/profile_id\s*=\s*any\s*\(/i.test(listActive), "set-based ANY lookup");
  check(
    !/for\s+\w+\s+in\s+select[\s\S]{0,80}loop/i.test(listActive),
    "no per-profile query loop"
  );
  check(
    /lifecycle_state\s*=\s*'active'/i.test(listActive) &&
      /auth_ban_state\s+in\s*\(\s*'applied'\s*,\s*'not_required_preexisting'\s*\)/i.test(
        listActive
      ),
    "list filters successful active only"
  );
  check(
    /c_max_ids\s+constant\s+integer\s*:=\s*10000/i.test(listActive),
    "bounded single-page input size (no client chunking)"
  );
});

test("WP3 corrective) SYSTEM_TECHNICIAN directory read; writers remain SUPER_ADMIN/service_role", () => {
  const sql = stripSqlComments(read(FORWARD));
  const reader = functionBody(sql, "qa_quarantine_is_directory_filter_reader");
  const writerAuthz = functionBody(sql, "qa_quarantine_is_authorized_caller");
  const prepare = functionBody(sql, "qa_quarantine_prepare");
  const listActive = functionBody(sql, "qa_quarantine_list_active");

  check(/is_super_admin\s*\(\s*\)/i.test(reader), "reader allows SUPER_ADMIN");
  check(/qa_quarantine_is_service_role\s*\(\s*\)/i.test(reader), "reader allows service_role");
  check(/SYSTEM_TECHNICIAN/i.test(reader), "reader allows SYSTEM_TECHNICIAN");
  check(!/SYSTEM_TECHNICIAN/i.test(writerAuthz), "writer AuthZ excludes SYSTEM_TECHNICIAN");
  check(
    /qa_quarantine_is_authorized_caller\s*\(\s*\)/i.test(prepare),
    "prepare still uses writer AuthZ"
  );
  check(
    /qa_quarantine_is_directory_filter_reader\s*\(\s*\)/i.test(listActive),
    "list_active uses directory-filter reader"
  );
  check(
    /drop\s+function\s+if\s+exists\s+public\.qa_quarantine_is_directory_filter_reader/i.test(
      stripSqlComments(read(ROLLBACK))
    ),
    "rollback drops directory-filter reader"
  );
});

test("41-45) rollback scope exact; no cascade; no remote refs; retired markers", () => {
  const forward = stripSqlComments(read(FORWARD));
  const rollback = stripSqlComments(read(ROLLBACK));
  const rollbackRaw = read(ROLLBACK);

  check(
    /drop\s+function\s+if\s+exists\s+public\.qa_quarantine_list_active/i.test(rollback),
    "rollback drops list_active"
  );
  check(
    /drop\s+function\s+if\s+exists\s+public\.qa_quarantine_get_state/i.test(rollback),
    "rollback drops get_state"
  );
  for (const name of WRITERS) {
    check(
      new RegExp(`drop\\s+function\\s+if\\s+exists\\s+public\\.${name}`, "i").test(rollback),
      `rollback drops ${name}`
    );
  }
  check(
    /drop\s+function\s+if\s+exists\s+public\.qa_quarantine_is_service_role/i.test(rollback),
    "rollback drops helper"
  );
  check(
    /drop\s+function\s+if\s+exists\s+public\.qa_quarantine_is_directory_filter_reader/i.test(
      rollback
    ),
    "rollback drops directory-filter reader helper"
  );
  check(
    /disable\s+row\s+level\s+security/i.test(rollback),
    "rollback disables WP2 RLS"
  );
  check(
    !/drop\s+table\s+if\s+exists\s+public\.qa_identity_quarantines/i.test(rollback),
    "rollback preserves WP1 table"
  );
  check(
    /immutable_fields_trg retained|qa_identity_quarantines_immutable_fields_trg/i.test(
      rollbackRaw
    ),
    "rollback preserves WP1 immutable trigger"
  );
  check(
    /deny_hard_delete_trg retained|qa_identity_quarantines_deny_hard_delete_trg/i.test(
      rollbackRaw
    ),
    "rollback preserves WP1 hard-delete trigger"
  );
  check(!/\bcascade\b/i.test(rollback), "rollback contains no CASCADE");
  check(
    !/drop\s+trigger\b/i.test(rollback),
    "rollback does not drop WP1 triggers"
  );
  check(
    !/90_QA_IDENTITY_QUARANTINES_ROLLBACK|drop\s+table\s+if\s+exists\s+public\.qa_identity_quarantines/i.test(
      rollback
    ),
    "rollback does not run WP1 destructive path"
  );

  for (const file of [FORWARD, ROLLBACK]) {
    const text = read(file);
    check(!/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\./.test(text), `${file} no JWT`);
    check(!/SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/i.test(text), `${file} no service role key`);
    check(!/supabase\.co\/[a-z]+\/[a-z0-9-]+/i.test(text), `${file} no project URL path`);
    check(!/postgres:\/\/[^:\s]+:[^@\s]+@/i.test(text), `${file} no postgres URL secret`);
    check(
      !/\b(xvnrrbaysavnudgeqjerr|pickvn-prod|project_ref\s*=\s*['"][a-z]{20})/i.test(text),
      `${file} no Staging/Production project reference`
    );
  }

  check(/OLD_OWNER_GO_REUSABLE\s*=\s*NO/.test(rollbackRaw), "rollback marks old GO non-reusable");
  check(/OLD_BATCH_REUSABLE\s*=\s*NO/.test(rollbackRaw), "rollback marks old batch non-reusable");
  check(
    /b37186cf-e620-4f27-aba3-d7e8750ae7df/.test(rollbackRaw),
    "retired batch remains marked"
  );

  // Numeric ordering: WP2 rollback (80) before WP1 rollback (90)
  check(ROLLBACK.startsWith("80_"), "WP2 rollback sequence 80");
  check(WP1_ROLLBACK.startsWith("90_"), "WP1 rollback sequence 90");
  check(FORWARD.startsWith("20_"), "WP2 forward sequence 20");
  check(WP1_FORWARD.startsWith("10_"), "WP1 forward sequence 10");

  // Silence unused forward reference while keeping dependency assertion
  check(/public\.qa_identity_quarantines/.test(forward), "forward references authority table");
});

test("H1/L2) prepare executable body rejects retired batch UUID", () => {
  const sql = stripSqlComments(read(FORWARD));
  const body = functionBody(sql, "qa_quarantine_prepare");
  check(
    new RegExp(
      `p_batch_id\\s*=\\s*'${RETIRED_BATCH}'::uuid`,
      "i"
    ).test(body),
    "retired UUID compared against p_batch_id in executable body"
  );
  check(
    /retired_batch_forbidden/i.test(body),
    "retired_batch_forbidden result code in executable body"
  );
  check(
    /p_batch_id\s+is\s+null/i.test(body) && /batch_required/i.test(body),
    "null batch still rejected"
  );
  // Comments-only appearance must not satisfy this test: body is already comment-stripped.
  check(
    body.includes(RETIRED_BATCH),
    "retired UUID present after comment strip in prepare body"
  );
});

test("H2) additive audit whitelist is PHASE_1B union + WP2 actions", () => {
  const sql = stripSqlComments(read(FORWARD));
  const whitelist = doBlockBody(sql, "audit_whitelist");
  check(
    /select\s+distinct\s+action[\s\S]*from\s+public\.audit_logs/i.test(whitelist),
    "current stored actions union present"
  );
  for (const action of PHASE1B_KNOWN_ACTIONS) {
    check(
      whitelist.includes(`'${action}'`),
      `Phase 1B known action present: ${action}`
    );
  }
  for (const action of AUDIT_ACTIONS) {
    check(whitelist.includes(`'${action}'`), `WP2 audit action present: ${action}`);
  }
  check(/club\.membership_request\.submit/i.test(whitelist), "membership actions present");
  check(/user\.manage\.status-change/i.test(whitelist), "user-management actions present");
  check(/payment_success/i.test(whitelist), "payment actions present");
  check(/rating\.verify/i.test(whitelist), "rating actions present");
  check(/workflow\.notification/i.test(whitelist), "workflow actions present");
  // Must not be only current rows + WP2 (Phase 1B defensive set required)
  check(
    /PHASE_1B|Known identity|phase1b/i.test(read(FORWARD)) &&
      PHASE1B_KNOWN_ACTIONS.every((a) => whitelist.includes(`'${a}'`)),
    "whitelist cannot be only current rows plus WP2 actions"
  );
  check(!/delete\s+from\s+public\.audit_logs|update\s+public\.audit_logs|truncate\s+public\.audit_logs/i.test(whitelist), "no audit row DML");
  check(
    /check\s*\(\s*action\s+in\s*\(%s\)\s*\)|action\s+IN\s*\(%s\)/i.test(whitelist),
    "bounded IN-list constraint rebuild"
  );
  check(!/action\s*~\*|action\s+like\s+'%'/i.test(whitelist), "not unrestricted action check");
});

test("M2) prepare unique_violation race handler is narrow and idempotent", () => {
  const sql = stripSqlComments(read(FORWARD));
  const body = functionBody(sql, "qa_quarantine_prepare");
  check(/when\s+unique_violation\s+then/i.test(body), "local unique_violation handler");
  check(/get\s+stacked\s+diagnostics/i.test(body), "GET STACKED DIAGNOSTICS used");
  check(
    /qa_identity_quarantines_active_profile_uidx/i.test(body) &&
      /qa_identity_quarantines_active_auth_uidx/i.test(body) &&
      /qa_identity_quarantines_pending_profile_batch_uidx/i.test(body),
    "expected constraint/index names filtered"
  );
  check(
    /if\s+v_constraint\s+not\s+in\s*\([\s\S]*?\)\s*then\s*raise\s*;/i.test(body),
    "unknown unique violations re-raised"
  );
  check(
    /select\s+\*\s+into\s+v_conflict[\s\S]*for\s+update/i.test(body),
    "post-conflict authority re-read"
  );
  for (const field of [
    "profile_id",
    "auth_user_id",
    "batch_id",
    "source_operation",
    "allowlist_sha256",
    "snapshot_sha256",
    "reason",
    "original_profile_status",
    "original_auth_banned",
    "expected_email",
    "allowlist_label",
    "venue_id",
  ]) {
    check(
      new RegExp(`v_conflict\\.${field}`, "i").test(body),
      `immutable correlation compares ${field}`
    );
  }
  check(/prepare_idempotent/i.test(body), "matching pending returns prepare_idempotent");
  check(/already_quarantined/i.test(body), "matching active returns already_quarantined");
  check(/pending_conflict|prepare_conflict|active_other_batch/i.test(body), "conflict stable codes");
  // Audit only after successful INSERT path (outside EXCEPTION); idempotent returns skip audit
  const insertAuditOrder = body.search(/insert\s+into\s+public\.qa_identity_quarantines/i);
  const exceptionPos = body.search(/when\s+unique_violation/i);
  const auditPos = body.search(/qa_quarantine_write_audit\s*\(\s*'qa_quarantine\.prepare'/i);
  check(insertAuditOrder >= 0 && exceptionPos > insertAuditOrder, "handler wraps INSERT");
  check(
    auditPos > exceptionPos &&
      !/qa_quarantine_write_audit[\s\S]*when\s+unique_violation/i.test(
        body.slice(exceptionPos, auditPos)
      ),
    "idempotent retry does not emit prepare audit inside exception path"
  );
  check(!/when\s+others\s+then/i.test(body), "no broad WHEN OTHERS in prepare");
  check(
    !/return[\s\S]{0,40}23505|sqlstate\s*=\s*'23505'/i.test(body),
    "raw expected 23505 is not the intended result contract"
  );
});

test("report WP2 static assertion count", () => {
  check(assertionCount >= 45, `expected >= 45 checks, got ${assertionCount}`);
  // Export for summary consumers via console
  console.log(`WP2_STATIC_ASSERTION_COUNT=${assertionCount}`);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sqlPath = join(
  __dirname,
  "../docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql"
);
const sql = readFileSync(sqlPath, "utf8");

const reportPath = join(
  __dirname,
  "../docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC_REPORT.md"
);
const report = readFileSync(reportPath, "utf8");

const RESTORE_SIGNATURE = `public.club_restore_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_expected_version integer default null
)`;

const norm = (s) => s.replace(/\s+/g, " ").trim();
const normSql = norm(sql);

function isolateBody(fnName) {
  const re = new RegExp(
    `create or replace function public\\.${fnName}\\([\\s\\S]*?\\n\\$\\$;`,
    "i"
  );
  const m = sql.match(re);
  assert.ok(m, `could not isolate ${fnName} body`);
  return m[0];
}

const restoreBody = isolateBody("club_restore_member");

describe("Phase 45A.4D.1 — club_restore_member SQL contract", () => {
  it("authors exactly one new RPC (restore only)", () => {
    const createFns = sql.match(/create or replace function/gi) || [];
    assert.equal(createFns.length, 1, "expected exactly one CREATE OR REPLACE FUNCTION");
    assert.match(sql, /create or replace function\s+public\.club_restore_member\(/i);

    for (const forbidden of [
      "club_update_member_role",
      "club_update_member_status",
      "club_set_member_role",
      "club_set_member_status",
      "club_add_member",
      "club_remove_member",
      "club_leave_membership",
      "club_create",
      "club_update",
    ]) {
      assert.doesNotMatch(
        sql,
        new RegExp(`function\\s+public\\.${forbidden}\\b`, "i"),
        `out-of-scope RPC leaked: ${forbidden}`
      );
    }
  });

  it("declares exact signature, security mode, search_path, returns json, grant", () => {
    assert.ok(normSql.includes(norm(`create or replace function ${RESTORE_SIGNATURE}`)));
    assert.match(restoreBody, /returns json/i);
    assert.match(restoreBody, /language plpgsql/i);
    assert.match(restoreBody, /security definer/i);
    assert.match(restoreBody, /set search_path = public/i);
    assert.ok(
      sql.includes(
        "grant execute on function public.club_restore_member(uuid, text, uuid, integer) to authenticated;"
      )
    );
  });

  it("whitelists club.member.restore and preserves add/remove audit actions", () => {
    assert.match(sql, /alter table public\.audit_logs drop constraint if exists audit_logs_action_check/);
    assert.match(sql, /'club\.member\.restore'/);
    assert.match(sql, /'club\.member\.add'/);
    assert.match(sql, /'club\.member\.remove'/);
    assert.match(sql, /'club\.leave_membership'/);
    assert.match(sql, /'club\.assign_owner'/);
  });

  it("enforces auth, request_id, idempotency, and add-class authz", () => {
    const bodyNorm = norm(restoreBody);
    assert.match(restoreBody, /auth\.uid\(\) is null/);
    assert.match(restoreBody, /NOT_AUTHENTICATED/);
    assert.match(restoreBody, /REQUEST_ID_REQUIRED/);
    assert.match(restoreBody, /VALIDATION/);
    assert.match(restoreBody, /phase42_idempotency_get\(p_request_id, 'club_restore_member'\)/);
    assert.ok(
      bodyNorm.includes("phase42_idempotency_put( p_request_id, v_club.tenant_id, 'club_restore_member'"),
      "missing club_restore_member idempotency put"
    );
    assert.match(restoreBody, /phase42_is_platform_super_admin\(\)/);
    assert.match(restoreBody, /phase42_can_review_membership\(v_club\.id\)/);
    assert.match(restoreBody, /FORBIDDEN/);
    // Must not use remove-style owner/president-only gate as the sole path
    assert.doesNotMatch(
      restoreBody,
      /phase42_has_gov_role\(v_club\.id, array\['club_owner', 'president'\]\)/
    );
  });

  it("implements removed→active restore and rejects left / active / never-seen", () => {
    assert.match(restoreBody, /status = 'removed'/);
    assert.match(restoreBody, /status = 'active'/);
    assert.match(restoreBody, /left_at = null/);
    assert.match(restoreBody, /version = version \+ 1/);
    assert.match(restoreBody, /ALREADY_MEMBER/);
    assert.match(restoreBody, /VERSION_CONFLICT/);
    assert.match(restoreBody, /status = 'left'/);
    assert.match(restoreBody, /CONFLICT/);
    assert.match(restoreBody, /club_add_member/);
    assert.match(restoreBody, /NOT_FOUND/);
    assert.match(restoreBody, /phase42_write_audit\(\s*'club\.member\.restore'/);
    assert.match(restoreBody, /from_version/);
    assert.match(restoreBody, /prior_status/);
    assert.match(restoreBody, /target_status/);
    assert.doesNotMatch(restoreBody, /\bdelete\s+from\s+public\.club_members\b/i);
    assert.doesNotMatch(restoreBody, /insert into public\.club_members/i);
    assert.doesNotMatch(restoreBody, /status = 'inactive'/);
    assert.doesNotMatch(restoreBody, /profiles\.club_id/);
    assert.doesNotMatch(restoreBody, /club_governance_assignments/);
  });

  it("records Option A locks — no role schema or status RPC", () => {
    assert.match(sql, /OPTION A/i);
    assert.match(sql, /captain \/ coach \/ manager roster titles are deferred/i);
    assert.doesNotMatch(sql, /add\s+column\b/i);
    assert.doesNotMatch(sql, /create\s+table\b/i);
    assert.doesNotMatch(sql, /function\s+public\.club_update_member_role\b/i);
    assert.doesNotMatch(sql, /function\s+public\.club_update_member_status\b/i);
  });

  it("uses only registered Phase 42 server error tokens required by restore", () => {
    for (const code of [
      "NOT_AUTHENTICATED",
      "REQUEST_ID_REQUIRED",
      "NOT_FOUND",
      "FORBIDDEN",
      "VALIDATION",
      "ALREADY_MEMBER",
      "VERSION_CONFLICT",
      "CONFLICT",
    ]) {
      assert.match(sql, new RegExp(code));
    }
  });

  it("is author-only: no drop function and not deployed", () => {
    assert.doesNotMatch(sql, /drop\s+function/i);
    assert.doesNotMatch(sql, /drop\s+table/i);
    assert.match(sql, /NOT DEPLOYED/i);
  });

  it("report documents owner locks and next phase 45A.4D.2", () => {
    assert.match(report, /NOT deployed|NOT executed/i);
    assert.match(report, /club_restore_member/);
    assert.match(report, /club\.member\.restore/);
    assert.match(report, /Option A/i);
    assert.match(report, /45A\.4D\.2/);
    assert.match(report, /club_add_member/);
  });
});

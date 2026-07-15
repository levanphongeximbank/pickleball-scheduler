import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sqlPath = join(
  __dirname,
  "../docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql"
);
const sql = readFileSync(sqlPath, "utf8");

const reportPath = join(
  __dirname,
  "../docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC_REPORT.md"
);
const report = readFileSync(reportPath, "utf8");

const ADD_SIGNATURE = `public.club_add_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_membership_type text default 'regular',
  p_expected_version integer default null
)`;

const REMOVE_SIGNATURE = `public.club_remove_member(
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

const addBody = isolateBody("club_add_member");
const removeBody = isolateBody("club_remove_member");

describe("Phase 45A.4C.1 — club_add_member / club_remove_member SQL contract", () => {
  it("authors exactly two new RPCs (add + remove)", () => {
    const createFns = sql.match(/create or replace function/gi) || [];
    assert.equal(createFns.length, 2, "expected exactly two CREATE OR REPLACE FUNCTION");
    assert.match(sql, /create or replace function\s+public\.club_add_member\(/i);
    assert.match(sql, /create or replace function\s+public\.club_remove_member\(/i);

    for (const forbidden of [
      "club_restore_member",
      "club_set_member_role",
      "club_set_member_status",
      "club_create",
      "club_update",
      "club_leave_membership",
      "club_submit_membership_request",
      "club_review_membership_request",
      "club_assign_owner",
      "club_clear_owner",
      "club_transfer_president",
    ]) {
      assert.doesNotMatch(
        sql,
        new RegExp(`function\\s+public\\.${forbidden}\\b`, "i"),
        `out-of-scope RPC leaked: ${forbidden}`
      );
    }
  });

  it("declares exact signatures, security mode, search_path, returns json, grants", () => {
    assert.ok(normSql.includes(norm(`create or replace function ${ADD_SIGNATURE}`)));
    assert.ok(normSql.includes(norm(`create or replace function ${REMOVE_SIGNATURE}`)));

    assert.match(addBody, /returns json/i);
    assert.match(removeBody, /returns json/i);
    assert.match(addBody, /language plpgsql/i);
    assert.match(removeBody, /language plpgsql/i);
    assert.match(addBody, /security definer/i);
    assert.match(removeBody, /security definer/i);
    assert.match(addBody, /set search_path = public/i);
    assert.match(removeBody, /set search_path = public/i);

    assert.ok(
      sql.includes(
        "grant execute on function public.club_add_member(uuid, text, uuid, text, integer) to authenticated;"
      )
    );
    assert.ok(
      sql.includes(
        "grant execute on function public.club_remove_member(uuid, text, uuid, integer) to authenticated;"
      )
    );
  });

  it("whitelists club.member.add and club.member.remove audit actions", () => {
    assert.match(sql, /alter table public\.audit_logs drop constraint if exists audit_logs_action_check/);
    assert.match(sql, /'club\.member\.add'/);
    assert.match(sql, /'club\.member\.remove'/);
    // Preserve prior club lifecycle / request / governance actions
    assert.match(sql, /'club\.update'/);
    assert.match(sql, /'club\.leave_membership'/);
    assert.match(sql, /'club\.membership_request\.submit'/);
    assert.match(sql, /'club\.assign_owner'/);
  });

  it("club_add_member enforces auth, request_id, idempotency, and authz", () => {
    const addNorm = norm(addBody);
    assert.match(addBody, /auth\.uid\(\) is null/);
    assert.match(addBody, /NOT_AUTHENTICATED/);
    assert.match(addBody, /REQUEST_ID_REQUIRED/);
    assert.match(addBody, /phase42_idempotency_get\(p_request_id, 'club_add_member'\)/);
    assert.ok(
      addNorm.includes("phase42_idempotency_put( p_request_id, v_club.tenant_id, 'club_add_member'"),
      "missing club_add_member idempotency put"
    );
    assert.match(addBody, /phase42_is_platform_super_admin\(\)/);
    assert.match(addBody, /phase42_can_review_membership\(v_club\.id\)/);
    assert.match(addBody, /FORBIDDEN/);
  });

  it("club_add_member implements insert / left-reactivate / removed-reject / active-duplicate", () => {
    assert.match(addBody, /status = 'active'/);
    assert.match(addBody, /ALREADY_MEMBER/);
    assert.match(addBody, /status = 'left'/);
    assert.match(addBody, /status = 'active'/); // reactivate path
    assert.match(addBody, /VERSION_CONFLICT/);
    assert.match(addBody, /status = 'removed'/);
    assert.match(addBody, /CONFLICT/);
    assert.match(addBody, /insert into public\.club_members/);
    assert.match(addBody, /phase42n_ensure_athlete_for_user/);
    assert.match(addBody, /reactivated/);
    assert.match(addBody, /phase42_write_audit\(\s*'club\.member\.add'/);
    assert.doesNotMatch(addBody, /\bdelete\s+from\s+public\.club_members\b/i);
  });

  it("club_remove_member enforces authz excluding VP-only and protects president/owner", () => {
    assert.match(removeBody, /NOT_AUTHENTICATED/);
    assert.match(removeBody, /REQUEST_ID_REQUIRED/);
    assert.match(removeBody, /phase42_idempotency_get\(p_request_id, 'club_remove_member'\)/);
    assert.match(removeBody, /phase42_is_platform_super_admin\(\)/);
    assert.match(
      removeBody,
      /phase42_has_gov_role\(v_club\.id, array\['club_owner', 'president'\]\)/
    );
    assert.match(removeBody, /user_has_permission\('club\.membership\.review'\)/);
    assert.match(removeBody, /phase42_is_tenant_member\(v_club\.tenant_id\)/);
    // VP must not appear alone as authorized for remove
    assert.doesNotMatch(
      removeBody,
      /phase42_has_gov_role\(v_club\.id, array\[[^\]]*vice_president[^\]]*\]\)/
    );
    assert.match(removeBody, /role_code in \('president', 'club_owner'\)/);
    assert.match(removeBody, /GOVERNANCE_BLOCK/);
  });

  it("club_remove_member soft-removes to removed (not left), preserves history, audits", () => {
    assert.match(removeBody, /status = 'removed'/);
    assert.match(removeBody, /NOT_MEMBER/);
    assert.match(removeBody, /VERSION_CONFLICT/);
    assert.match(removeBody, /phase42_clear_profile_club_links\(p_target_user_id\)/);
    assert.match(removeBody, /phase42_write_audit\(\s*'club\.member\.remove'/);
    assert.match(removeBody, /club_governance_assignments/);
    assert.match(removeBody, /status = 'ended'/);
    assert.doesNotMatch(removeBody, /\bdelete\s+from\s+public\.club_members\b/i);
    // Must not use leave semantics for admin remove
    assert.doesNotMatch(removeBody, /set status = 'left'/);
  });

  it("uses only registered Phase 42 server error tokens", () => {
    for (const code of [
      "NOT_AUTHENTICATED",
      "REQUEST_ID_REQUIRED",
      "NOT_FOUND",
      "FORBIDDEN",
      "VALIDATION",
      "ALREADY_MEMBER",
      "NOT_MEMBER",
      "GOVERNANCE_BLOCK",
      "VERSION_CONFLICT",
      "CONFLICT",
    ]) {
      assert.match(sql, new RegExp(code));
    }
  });

  it("is author-only: no drop function and no runtime wiring claims", () => {
    assert.doesNotMatch(sql, /drop\s+function/i);
    assert.doesNotMatch(sql, /drop\s+table/i);
    assert.match(sql, /NOT DEPLOYED/i);
  });

  it("report documents scoped authoring and next phase 45A.4C.2", () => {
    assert.match(report, /NOT deployed|NOT executed/i);
    assert.match(report, /club_add_member/);
    assert.match(report, /club_remove_member/);
    assert.match(report, /club\.member\.add/);
    assert.match(report, /club\.member\.remove/);
    assert.match(report, /45A\.4C\.2/);
    assert.match(report, /READY AFTER NEW RPCs|authored/i);
  });
});

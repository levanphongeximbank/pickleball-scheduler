import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sqlPath = join(
  __dirname,
  "../docs/v5/phase45a4a/PHASE_45A4A_MEMBERSHIP_REQUEST_RPC_RECONCILIATION.sql"
);
const sql = readFileSync(sqlPath, "utf8");

const reportPath = join(
  __dirname,
  "../docs/v5/phase45a4a/PHASE_45A4A_MEMBERSHIP_REQUEST_RPC_RECONCILIATION_REPORT.md"
);
const report = readFileSync(reportPath, "utf8");

const clientPath = join(
  __dirname,
  "../src/features/club/services/clubStorageV2RpcService.js"
);
const client = readFileSync(clientPath, "utf8");

const REQUEST_RPCS = [
  {
    name: "club_submit_membership_request",
    signature:
      "public.club_submit_membership_request(p_request_id uuid, p_club_id text, p_message text DEFAULT ''::text)",
    grant: "public.club_submit_membership_request(uuid, text, text)",
  },
  {
    name: "club_cancel_membership_request",
    signature:
      "public.club_cancel_membership_request(p_request_id uuid, p_membership_request_id uuid, p_expected_version integer)",
    grant: "public.club_cancel_membership_request(uuid, uuid, integer)",
  },
  {
    name: "club_list_my_requests",
    signature: "public.club_list_my_requests()",
    grant: "public.club_list_my_requests()",
  },
];

describe("Phase 45A.4A — Membership request RPC DDL reconciliation (SQL contract)", () => {
  it("defines exactly the three membership-request functions (no out-of-scope RPCs)", () => {
    const createMatches = sql.match(/create or replace function/gi) || [];
    assert.equal(createMatches.length, 3, "expected exactly 3 CREATE OR REPLACE FUNCTION");

    for (const forbidden of [
      "club_review_membership_request",
      "club_list_pending_requests",
      "club_leave_membership",
      "club_assign_owner",
      "club_clear_owner",
      "club_transfer_president",
      "club_assign_vice_president",
      "club_remove_vice_president",
      "club_add_member",
      "club_remove_member",
      "club_set_member_role",
      "club_set_member_status",
      "club_restore_member",
      "club_archive",
      "club_delete",
    ]) {
      assert.doesNotMatch(
        sql,
        new RegExp(`function\\s+public\\.${forbidden}\\b`, "i"),
        `out-of-scope RPC leaked into reconciliation: ${forbidden}`
      );
    }
  });

  it("contains each function with the exact deployed signature and grant", () => {
    for (const rpc of REQUEST_RPCS) {
      assert.ok(
        sql.includes(`CREATE OR REPLACE FUNCTION ${rpc.signature}`),
        `missing/incorrect signature for ${rpc.name}`
      );
      assert.ok(
        sql.includes(`grant execute on function ${rpc.grant} to authenticated;`),
        `missing grant for ${rpc.name}`
      );
    }
  });

  it("declares canonical security mode, language and search_path per function", () => {
    assert.equal((sql.match(/SECURITY DEFINER/g) || []).length, 3);
    assert.equal((sql.match(/LANGUAGE plpgsql/g) || []).length, 3);
    assert.equal((sql.match(/SET search_path TO 'public'/g) || []).length, 3);
    assert.equal((sql.match(/RETURNS json/g) || []).length, 3);
  });

  it("anchors submit to club_membership_requests_v42 with Phase 42 helpers", () => {
    assert.match(sql, /insert into public\.club_membership_requests_v42/);
    assert.match(sql, /phase42_write_audit\('club\.membership_request\.submit'/);
    assert.match(sql, /phase42_is_platform_super_admin\(\)/);
    assert.match(sql, /phase42_active_club_member_id\(/);
    assert.equal((sql.match(/phase42_idempotency_get\(p_request_id,/g) || []).length, 2);
    assert.equal((sql.match(/phase42_idempotency_put\(p_request_id,/g) || []).length, 2);
  });

  it("enforces cancel ownership + pending + version contract", () => {
    assert.match(sql, /v_row\.user_id <> auth\.uid\(\)/);
    assert.match(sql, /v_row\.status <> 'pending'/);
    assert.match(sql, /p_expected_version/);
    assert.match(sql, /VERSION_CONFLICT/);
    assert.match(sql, /status = 'cancelled'/);
  });

  it("lists my requests scoped to auth.uid() with success envelope", () => {
    assert.match(sql, /r\.user_id = auth\.uid\(\)/);
    assert.match(sql, /json_build_object\('ok', true, 'data', v_rows\)/);
  });

  it("includes canonical error tokens for the three RPCs", () => {
    for (const code of [
      "NOT_AUTHENTICATED",
      "REQUEST_ID_REQUIRED",
      "FORBIDDEN",
      "NOT_FOUND",
      "ALREADY_MEMBER",
      "PENDING_EXISTS",
      "INVALID_STATUS",
      "VERSION_CONFLICT",
    ]) {
      assert.match(sql, new RegExp(code));
    }
  });

  it("is record-only: no DROP/ALTER-table and no new-RPC surface", () => {
    assert.doesNotMatch(sql, /drop\s+function/i);
    assert.doesNotMatch(sql, /drop\s+table/i);
    assert.doesNotMatch(sql, /alter\s+table/i);
  });

  it("report documents EXACT confidence and prod≡staging recovery", () => {
    assert.match(report, /\*\*EXACT\*\*/);
    assert.match(report, /Prod.*Staging|Staging.*Prod/);
    assert.match(report, /phase_42c_membership_and_governance_rpcs/);
    assert.match(report, /26d9398/);
  });

  it("matches the deployed client wrapper argument contract", () => {
    assert.match(
      client,
      /callRpc\("club_submit_membership_request",\s*{[\s\S]*?p_request_id:[\s\S]*?p_club_id:[\s\S]*?p_message:/
    );
    assert.match(client, /callRpc\("club_list_my_requests",\s*{}\)/);
    assert.match(
      client,
      /callRpc\("club_cancel_membership_request",\s*{[\s\S]*?p_request_id:[\s\S]*?p_membership_request_id:[\s\S]*?p_expected_version:/
    );
  });
});

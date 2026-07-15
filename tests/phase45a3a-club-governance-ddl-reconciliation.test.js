import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sqlPath = join(
  __dirname,
  "../docs/v5/phase45a3a/PHASE_45A3A_CLUB_GOVERNANCE_RPC_RECONCILIATION.sql"
);
const sql = readFileSync(sqlPath, "utf8");

const clientPath = join(
  __dirname,
  "../src/features/club/services/clubStorageV2RpcService.js"
);
const client = readFileSync(clientPath, "utf8");

const GOVERNANCE_RPCS = [
  {
    name: "club_assign_owner",
    signature:
      "public.club_assign_owner(p_request_id uuid, p_club_id text, p_member_user_id uuid, p_expected_club_version integer)",
    grant: "public.club_assign_owner(uuid, text, uuid, integer)",
    auditAction: "club.assign_owner",
  },
  {
    name: "club_clear_owner",
    signature:
      "public.club_clear_owner(p_request_id uuid, p_club_id text, p_expected_club_version integer)",
    grant: "public.club_clear_owner(uuid, text, integer)",
    auditAction: "club.clear_owner",
  },
  {
    name: "club_transfer_president",
    signature:
      "public.club_transfer_president(p_request_id uuid, p_club_id text, p_next_user_id uuid, p_expected_club_version integer)",
    grant: "public.club_transfer_president(uuid, text, uuid, integer)",
    auditAction: "club.transfer_president",
  },
];

describe("Phase 45A.3A — Club governance RPC DDL reconciliation (SQL contract)", () => {
  it("defines exactly the three governance functions (no 4th Club command RPC)", () => {
    const createMatches = sql.match(/create or replace function/gi) || [];
    assert.equal(createMatches.length, 3, "expected exactly 3 CREATE OR REPLACE FUNCTION");

    // Guard against accidentally reconciling out-of-scope RPCs from the same migration.
    for (const forbidden of [
      "club_assign_vice_president",
      "club_remove_vice_president",
      "club_submit_membership_request",
      "club_review_membership_request",
      "club_cancel_membership_request",
      "club_list_pending_requests",
      "club_list_my_requests",
      "club_leave_membership",
    ]) {
      assert.doesNotMatch(
        sql,
        new RegExp(`function\\s+public\\.${forbidden}\\b`, "i"),
        `out-of-scope RPC leaked into reconciliation: ${forbidden}`
      );
    }
  });

  it("contains each function with the exact deployed signature and grant", () => {
    for (const rpc of GOVERNANCE_RPCS) {
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
    // 3 functions × (SECURITY DEFINER, plpgsql, search_path public)
    assert.equal((sql.match(/SECURITY DEFINER/g) || []).length, 3);
    assert.equal((sql.match(/LANGUAGE plpgsql/g) || []).length, 3);
    assert.equal((sql.match(/SET search_path TO 'public'/g) || []).length, 3);
    assert.equal((sql.match(/RETURNS json/g) || []).length, 3);
  });

  it("emits the exact canonical audit actions", () => {
    for (const rpc of GOVERNANCE_RPCS) {
      assert.match(
        sql,
        new RegExp(`phase42_write_audit\\('${rpc.auditAction.replace(".", "\\.")}'`),
        `missing audit action ${rpc.auditAction}`
      );
    }
  });

  it("enforces version + idempotency + canonical error tokens", () => {
    // Optimistic concurrency
    assert.equal((sql.match(/p_expected_club_version/g) || []).length >= 3, true);
    assert.equal((sql.match(/set version = version \+ 1 where id = v_club\.id/g) || []).length, 3);
    assert.match(sql, /VERSION_CONFLICT/);
    // Idempotency (match call sites in bodies, not the prerequisite list in the header)
    assert.equal((sql.match(/phase42_idempotency_get\(p_request_id,/g) || []).length, 3);
    assert.equal((sql.match(/phase42_idempotency_put\(p_request_id,/g) || []).length, 3);
    assert.match(sql, /REQUEST_ID_REQUIRED/);
    // Canonical error codes
    for (const code of ["NOT_AUTHENTICATED", "NOT_FOUND", "FORBIDDEN", "MEMBER_REQUIRED"]) {
      assert.match(sql, new RegExp(code));
    }
  });

  it("is record-only: no DROP/ALTER-table and no new-RPC surface", () => {
    assert.doesNotMatch(sql, /drop\s+function/i);
    assert.doesNotMatch(sql, /drop\s+table/i);
    assert.doesNotMatch(sql, /alter\s+table/i);
  });

  it("matches the deployed client wrapper argument contract", () => {
    // club_assign_owner
    assert.match(client, /callRpc\("club_assign_owner",\s*{[\s\S]*?p_request_id:[\s\S]*?p_club_id:[\s\S]*?p_member_user_id:[\s\S]*?p_expected_club_version:/);
    // club_clear_owner
    assert.match(client, /callRpc\("club_clear_owner",\s*{[\s\S]*?p_request_id:[\s\S]*?p_club_id:[\s\S]*?p_expected_club_version:/);
    // club_transfer_president
    assert.match(client, /callRpc\("club_transfer_president",\s*{[\s\S]*?p_request_id:[\s\S]*?p_club_id:[\s\S]*?p_next_user_id:[\s\S]*?p_expected_club_version:/);
  });
});

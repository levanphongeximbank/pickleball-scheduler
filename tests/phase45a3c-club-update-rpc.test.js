import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sqlPath = join(
  __dirname,
  "../docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql"
);
const sql = readFileSync(sqlPath, "utf8");

const SIGNATURE =
  "public.club_update( p_request_id uuid, p_club_id text, p_expected_club_version integer, p_name text default null, p_code text default null, p_description text default null, p_status text default null, p_registered_cluster_id text default null )";

const GRANT =
  "public.club_update(uuid, text, integer, text, text, text, text, text)";

// Whitespace-insensitive (CRLF/LF-agnostic) view of the SQL.
const normSql = sql.replace(/\s+/g, " ").trim();
const norm = (s) => s.replace(/\s+/g, " ").trim();

// Body between the create-function header and the closing $$.
const body = (() => {
  const start = sql.indexOf("returns json");
  const end = sql.indexOf("\n$$;", start);
  assert.ok(start >= 0 && end > start, "could not isolate club_update body");
  return sql.slice(start, end);
})();

describe("Phase 45A.3C — canonical club_update RPC (SQL contract)", () => {
  it("authors club_update plus phase42_can_update_club helper only", () => {
    const createFns = sql.match(/create or replace function/gi) || [];
    assert.equal(createFns.length, 2, "expected helper + club_update");
    assert.match(sql, /create or replace function\s+public\.phase42_can_update_club\(/i);
    assert.match(sql, /create or replace function\s+public\.club_update\(/i);

    // No sibling / out-of-scope RPCs may leak in.
    for (const forbidden of [
      "club_create",
      "club_delete",
      "club_archive",
      "club_assign_owner",
      "club_clear_owner",
      "club_transfer_president",
      "club_assign_vice_president",
      "club_remove_vice_president",
      "club_submit_membership_request",
      "club_leave_membership",
    ]) {
      assert.doesNotMatch(
        sql,
        new RegExp(`function\\s+public\\.${forbidden}\\b`, "i"),
        `out-of-scope RPC leaked: ${forbidden}`
      );
    }
  });

  it("declares the exact signature, mode and grant", () => {
    assert.ok(
      normSql.includes(norm(`create or replace function ${SIGNATURE}`)),
      "missing/incorrect club_update signature"
    );
    assert.match(sql, /returns json/);
    assert.match(sql, /language plpgsql/);
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = public/);
    assert.ok(
      sql.includes(`grant execute on function ${GRANT} to authenticated;`),
      "missing/incorrect grant"
    );
  });

  it("enforces auth, request_id and idempotency scoped to club_update", () => {
    assert.match(body, /auth\.uid\(\) is null/);
    assert.match(body, /NOT_AUTHENTICATED/);
    assert.match(body, /REQUEST_ID_REQUIRED/);
    assert.match(body, /phase42_idempotency_get\(p_request_id, 'club_update'\)/);
    assert.match(body, /phase42_idempotency_put\(p_request_id, v_club\.tenant_id, 'club_update'/);
  });

  it("locks the row and enforces optimistic concurrency", () => {
    const normBody = norm(body);
    assert.match(normBody, /where id = trim\(coalesce\(p_club_id, ''\)\) and deleted_at is null for update/);
    assert.match(body, /v_club\.version <> coalesce\(p_expected_club_version, v_club\.version\)/);
    assert.match(body, /VERSION_CONFLICT/);
    assert.match(normBody, /set name = v_name.*version = version \+ 1 where id = v_club\.id/);
  });

  it("uses narrow phase42_can_update_club authorization (not bare tenant membership)", () => {
    assert.match(body, /phase42_can_update_club\(v_club\.id\)/);
    assert.doesNotMatch(body, /phase42_is_tenant_member\s*\(/);
    assert.match(sql, /create or replace function\s+public\.phase42_can_update_club\(/i);
    assert.match(body, /FORBIDDEN/);
  });

  it("emits club.update audit action and defers whitelist to additive prerequisite", () => {
    assert.match(body, /phase42_write_audit\(\s*'club\.update'/);
    assert.match(sql, /PHASE_1B_AUDIT_WHITELIST_ADDITIVE\.sql/);
    assert.doesNotMatch(sql, /add constraint\s+audit_logs_action_check/i);
  });

  it("returns the canonical response envelope", () => {
    assert.match(body, /'ok', true/);
    assert.match(body, /public\.phase42_club_canonical\(v_club\.id\)/);
    assert.match(body, /'version', v_club\.version \+ 1/);
  });

  it("owns only canonical public.clubs fields and writes only public.clubs", () => {
    // The UPDATE sets exactly the five canonical columns.
    for (const col of [
      "name = v_name",
      "code = v_code",
      "description = coalesce(v_description, '')",
      "status = v_status",
      "registered_cluster_id = v_cluster",
    ]) {
      assert.ok(body.includes(col), `missing canonical column assignment: ${col}`);
    }
    // Writes only public.clubs — no governance/member/blob writes.
    assert.match(body, /update public\.clubs/);
    assert.doesNotMatch(body, /club_governance_assignments/i);
    assert.doesNotMatch(body, /\bclub_governance\b/i);
    assert.doesNotMatch(body, /insert into public\.club_members/i);
    // Blob-only metadata must NOT be touched.
    for (const forbidden of ["logo", "address", "phone", "note", "slug", "timezone", "registered_court", "registeredCourtIds"]) {
      assert.ok(!body.includes(`${forbidden} =`), `blob-only field leaked into UPDATE: ${forbidden}`);
    }
  });

  it("validates status against the schema domain and tenant uniqueness", () => {
    assert.match(body, /v_status not in \('pending_setup', 'pending_approval', 'active', 'inactive'\)/);
    assert.match(body, /INVALID_STATUS/);
    assert.match(body, /DUPLICATE_NAME/);
    assert.match(body, /DUPLICATE_CODE/);
    assert.match(body, /lower\(c\.name\) = lower\(v_name\)/);
    assert.match(body, /c\.id <> v_club\.id/);
    assert.match(body, /NAME_REQUIRED/);
  });

  it("adds no destructive DDL and no audit constraint swap", () => {
    assert.doesNotMatch(sql, /drop\s+function/i);
    assert.doesNotMatch(sql, /drop\s+table/i);
    assert.doesNotMatch(sql, /truncate/i);
    assert.doesNotMatch(sql, /delete\s+from/i);
    assert.doesNotMatch(sql, /alter table/i);
  });
});

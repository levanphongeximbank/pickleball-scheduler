/**
 * Phase 2C — cancel membership request audit SQL contract tests.
 *
 * Verifies the patch SQL (not live DB): allow-list, RPC body, ordering,
 * authz/failure paths before audit, idempotency early-return, metadata.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const sqlPath = join(
  root,
  "docs/v5/phase2c-cancel-audit/PHASE_2C_CANCEL_MEMBERSHIP_REQUEST_AUDIT.sql"
);
const sql = readFileSync(sqlPath, "utf8");
const report = readFileSync(
  join(root, "docs/v5/phase2c-cancel-audit/PHASE_2C_CANCEL_MEMBERSHIP_REQUEST_AUDIT_REPORT.md"),
  "utf8"
);
const aliases = readFileSync(
  join(root, "src/features/club/constants/membershipAuditEvents.js"),
  "utf8"
);
const legacyCancel = readFileSync(
  join(root, "docs/v5/phase45a4a/PHASE_45A4A_MEMBERSHIP_REQUEST_RPC_RECONCILIATION.sql"),
  "utf8"
);
const whitelist1b = readFileSync(
  join(root, "docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql"),
  "utf8"
);

function isolateCancelBody(source) {
  const m = source.match(
    /CREATE OR REPLACE FUNCTION public\.club_cancel_membership_request\([\s\S]*?\$function\$\s*;/i
  );
  assert.ok(m, "could not isolate club_cancel_membership_request");
  return m[0];
}

const cancelBody = isolateCancelBody(sql);
const legacyBody = isolateCancelBody(legacyCancel);

describe("Phase 2C cancel audit — allow-list", () => {
  it("adds club.membership_request.cancel additively and keeps submit/review", () => {
    assert.match(sql, /club\.membership_request\.cancel/);
    assert.match(sql, /club\.membership_request\.submit/);
    assert.match(sql, /club\.membership_request\.review/);
    assert.match(sql, /select\s+distinct\s+action/i);
    assert.match(sql, /\bunion\b/i);
    assert.match(sql, /drop constraint if exists audit_logs_action_check/i);
    assert.match(sql, /add constraint audit_logs_action_check/i);
  });

  it("keeps cancel in Phase 1B additive known-set for future re-applies", () => {
    assert.match(whitelist1b, /club\.membership_request\.submit/);
    assert.match(whitelist1b, /club\.membership_request\.review/);
    assert.match(whitelist1b, /club\.membership_request\.cancel/);
  });

  it("freeze alias already maps join_request.cancelled → server cancel action", () => {
    assert.match(
      aliases,
      /"join_request\.cancelled":\s*"club\.membership_request\.cancel"/
    );
  });
});

describe("Phase 2C cancel audit — RPC contract", () => {
  it("preserves signature, SECURITY DEFINER, search_path, grant", () => {
    assert.match(
      cancelBody,
      /club_cancel_membership_request\(\s*p_request_id uuid,\s*p_membership_request_id uuid,\s*p_expected_version integer\s*\)/i
    );
    assert.match(cancelBody, /RETURNS json/i);
    assert.match(cancelBody, /SECURITY DEFINER/i);
    assert.match(cancelBody, /SET search_path TO 'public'/i);
    assert.match(
      sql,
      /grant execute on function public\.club_cancel_membership_request\(uuid, uuid, integer\) to authenticated;/i
    );
  });

  it("successful path: pending→cancelled, version+1, audit once, then idempotency put", () => {
    assert.match(cancelBody, /status\s*=\s*'cancelled'/i);
    assert.match(cancelBody, /version\s*=\s*version\s*\+\s*1/i);
    assert.match(
      cancelBody,
      /phase42_write_audit\(\s*'club\.membership_request\.cancel'/i
    );

    const updateIdx = cancelBody.search(/update public\.club_membership_requests_v42/i);
    const auditIdx = cancelBody.search(/phase42_write_audit/i);
    const putIdx = cancelBody.search(/phase42_idempotency_put/i);
    assert.ok(updateIdx > 0 && auditIdx > updateIdx, "audit after update");
    assert.ok(putIdx > auditIdx, "idempotency put after audit");
  });

  it("audit metadata includes actor/club/tenant/request/version fields", () => {
    for (const key of [
      "request_id",
      "membership_request_id",
      "user_id",
      "actor_id",
      "club_id",
      "tenant_id",
      "from_status",
      "to_status",
      "from_version",
      "to_version",
    ]) {
      assert.match(cancelBody, new RegExp(`'${key}'`, "i"), `missing metadata ${key}`);
    }
  });

  it("idempotent replay returns cache before update/audit (no duplicate audit)", () => {
    const getIdx = cancelBody.search(/phase42_idempotency_get/i);
    const earlyReturn = cancelBody.indexOf("if v_cached is not null");
    const updateIdx = cancelBody.search(/update public\.club_membership_requests_v42/i);
    assert.ok(getIdx >= 0 && earlyReturn > getIdx && earlyReturn < updateIdx);
    assert.match(cancelBody, /if v_cached is not null then\s+return v_cached::json;/i);
  });

  it("failed paths return errors before update (no audit on deny)", () => {
    const markers = [
      ["NOT_AUTHENTICATED", /auth\.uid\(\) is null/i],
      ["FORBIDDEN", /v_row\.user_id <> auth\.uid\(\)/i],
      ["NOT_FOUND", /if not found/i],
      ["INVALID_STATUS", /status <> 'pending'/i],
      ["VERSION_CONFLICT", /VERSION_CONFLICT/i],
    ];
    const updateIdx = cancelBody.search(/update public\.club_membership_requests_v42/i);
    for (const [code, re] of markers) {
      assert.match(cancelBody, re, code);
      const idx = cancelBody.search(re);
      assert.ok(idx >= 0 && idx < updateIdx, `${code} must precede update`);
    }
    // Exactly one phase42_write_audit in success path
    const audits = cancelBody.match(/phase42_write_audit/gi) || [];
    assert.equal(audits.length, 1);
  });

  it("cross-tenant / unauthorized denied via own-request check (same as baseline)", () => {
    assert.match(legacyBody, /v_row\.user_id <> auth\.uid\(\)/i);
    assert.match(cancelBody, /v_row\.user_id <> auth\.uid\(\)/i);
    assert.match(cancelBody, /FORBIDDEN/);
  });

  it("authors only cancel RPC (no unrelated schema)", () => {
    const creates = sql.match(/create or replace function/gi) || [];
    assert.equal(creates.length, 1);
    assert.doesNotMatch(sql, /create table/i);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /truncate/i);
  });
});

describe("Phase 2C cancel audit — docs", () => {
  it("report forbids Production apply from this branch", () => {
    assert.match(report, /\*\*Production apply:\*\*\s*\*\*NOT\*\*/i);
    assert.match(report, /Staging first/i);
  });
});

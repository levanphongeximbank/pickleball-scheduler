import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("42I1 hotfix SQL blocks platform admin permission path", () => {
  const sql = readSrc("docs/v5/PHASE_42I1_MEMBERSHIP_REVIEW_HOTFIX.sql");
  assert.match(sql, /phase42_is_platform_admin/);
  assert.match(sql, /not public\.phase42_is_platform_admin\(\)/);
  assert.match(sql, /phase42_is_tenant_staff_member/);
  assert.doesNotMatch(sql, /exception when others then\s+null/s);
});

test("42I1 extends audit_logs action constraint for club review", () => {
  const sql = readSrc("docs/v5/PHASE_42I1_MEMBERSHIP_REVIEW_HOTFIX.sql");
  assert.match(sql, /club\.membership_request\.review/);
  assert.match(sql, /club\.membership_request\.correction/);
});

test("42I1 review RPC writes mandatory audit payload", () => {
  const sql = readSrc("docs/v5/PHASE_42I1_MEMBERSHIP_REVIEW_HOTFIX.sql");
  assert.match(sql, /review_action/);
  assert.match(sql, /before_data/);
  assert.match(sql, /after_data/);
  assert.match(sql, /raise exception 'AUDIT_WRITE_FAILED:/);
});

test("42I1 production cleanup targets erroneous SA request", () => {
  const sql = readSrc("docs/v5/PHASE_42I1_PRODUCTION_QA_CLEANUP.sql");
  assert.match(sql, /7a498187-b5ad-4301-9e92-051ca6c510d1/);
  assert.match(sql, /e3e07720-32dd-4dcf-91c2-d82fc5b8e8a4/);
  assert.match(sql, /club\.membership_request\.correction/);
  assert.match(sql, /status = 'removed'/);
  assert.match(sql, /club_members_status_check/);
  assert.doesNotMatch(sql, /set status = 'inactive'/);
});

test("42I1 staging smoke covers SA forbidden and idempotency", () => {
  const sql = readSrc("docs/v5/PHASE_42I1_STAGING_SMOKE.sql");
  assert.match(sql, /SMOKE_FAIL SA list/);
  assert.match(sql, /idempotent/);
  assert.match(sql, /approve audit missing/);
  assert.match(sql, /reject audit missing/);
  assert.match(sql, /AUDIT_WRITE_FAILED/);
  assert.match(sql, /audit rollback/);
});

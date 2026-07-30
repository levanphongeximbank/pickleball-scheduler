import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageDir = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/sql/court-admin-upsert-venue-owner-auth"
);
const evidencePath = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/18_A_COURT_FORBIDDEN_DIAGNOSIS_2026-07-30.json"
);
const sqlPath = path.join(packageDir, "10_COURT_ADMIN_UPSERT_VENUE_OWNER_AUTH.sql");

test("venue-owner auth package files exist", () => {
  const files = fs.readdirSync(packageDir);
  assert.ok(files.includes("10_COURT_ADMIN_UPSERT_VENUE_OWNER_AUTH.sql"));
  assert.ok(files.includes("99_VERIFY.sql"));
  assert.ok(files.includes("README.md"));
});

test("SQL keeps platform path and adds venue-scoped owner allow", () => {
  const sql = fs.readFileSync(sqlPath, "utf8");
  assert.match(sql, /create or replace function public\.court_admin_upsert_cluster\(p_cluster json\)/i);
  assert.match(sql, /can_review_court_claim\(\)/);
  assert.match(sql, /user_venue_id\(\)/);
  assert.match(sql, /TENANT_OWNER/);
  assert.match(sql, /VENUE_OWNER/);
  assert.match(sql, /COURT_OWNER/);
  assert.doesNotMatch(sql, /grant\s+execute[\s\S]*to\s+anon/i);
  assert.doesNotMatch(sql, /role_permissions[\s\S]*cluster\.manage/i);
  assert.doesNotMatch(sql, /TRUNCATE|DROP TABLE|DELETE FROM public\./i);
  assert.doesNotMatch(sql, /expuvcohlcjzvrrauvud/);
});

test("diagnosis evidence classifies narrow RPC auth root cause", () => {
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.rootCause, "rpc_authorization_too_narrow_vs_canonical_owner_policy");
  assert.equal(evidence.databaseMutations, 0);
  assert.equal(evidence.productionMutations, 0);
  assert.equal(
    evidence.remediation.chosen,
    "sql_function_fix_venue_scoped_owner_allow_on_upsert_only"
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageDir = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/sql/rating-v5-owner-assess-self-rbac"
);
const evidencePath = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/20_A_RATE_FORBIDDEN_DIAGNOSIS_2026-07-30.json"
);
const sqlPath = path.join(packageDir, "10_OWNER_ASSESS_SELF_RBAC.sql");
const runnerPath = path.join(
  root,
  "src/features/platform-hard-cutover/operatorAcceptanceRunner.js"
);

test("owner assess_self RBAC package files exist", () => {
  const files = fs.readdirSync(packageDir);
  assert.ok(files.includes("10_OWNER_ASSESS_SELF_RBAC.sql"));
  assert.ok(files.includes("99_VERIFY.sql"));
  assert.ok(files.includes("README.md"));
});

test("SQL grants assess_self only to COURT_OWNER and VENUE_OWNER", () => {
  const sql = fs.readFileSync(sqlPath, "utf8");
  assert.match(sql, /rating_v5\.assess_self/);
  assert.match(sql, /rating_v5\.view_own/);
  assert.match(sql, /COURT_OWNER/);
  assert.match(sql, /VENUE_OWNER/);
  assert.match(sql, /on conflict do nothing/i);
  assert.doesNotMatch(sql, /calibration_manage/);
  assert.doesNotMatch(sql, /grant\s+execute[\s\S]*to\s+anon/i);
  assert.doesNotMatch(sql, /TRUNCATE|DROP TABLE|DELETE FROM/i);
  assert.doesNotMatch(sql, /expuvcohlcjzvrrauvud/);
});

test("runner still targets canonical rating_v5_start_assessment", () => {
  const runner = fs.readFileSync(runnerPath, "utf8");
  assert.match(runner, /rpcRatingV5StartAssessment\("doubles"\)/);
});

test("diagnosis evidence records missing owner assess_self", () => {
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.rootCause, "permission_missing_for_owner_roles");
  assert.equal(evidence.writer.rpcName, "rating_v5_start_assessment");
  assert.equal(evidence.databaseMutations, 0);
  assert.equal(evidence.productionMutations, 0);
});

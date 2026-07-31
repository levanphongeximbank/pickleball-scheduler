/**
 * Phase 5D-A readiness package static tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PKG = path.join(
  ROOT,
  "docs/platform-hard-cutover-01/phase-05d-tt5d-controlled-reconciliation",
);

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(PKG, rel), "utf8"));
}

test("Phase 5D-A package files exist", () => {
  for (const f of [
    "README.md",
    "PHASE5D_A_READINESS_MANIFEST.json",
    "PHASE5D_CHECKSUM_MANIFEST.json",
    "evidence/01_STAGING_TARGET_AND_BASELINE_GATE.json",
    "evidence/02_TT5D_EXACT_CATALOG_BASELINE.json",
    "evidence/03_TT5D_SEMANTIC_DELTA.json",
    "evidence/04_TWO_WAY_DEPENDENCY_MAP.json",
    "evidence/05_PHASE5D_A_DECISION.json",
    "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
    "sql/20_TT5D_POST_APPLY_VERIFY.sql",
    "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
    "scripts/verify-phase5d-a.mjs",
  ]) {
    assert.ok(fs.existsSync(path.join(PKG, f)), f);
  }
});

test("baseline lists exactly 13 TT5D functions", () => {
  const b = readJson("evidence/02_TT5D_EXACT_CATALOG_BASELINE.json");
  assert.equal(b.functionCount, 13);
  assert.equal(b.functions.length, 13);
});

test("semantic findings 1-7 confirmed", () => {
  const d = readJson("evidence/03_TT5D_SEMANTIC_DELTA.json");
  for (let i = 1; i <= 7; i++) {
    const f = d.findings.find((x) => x.id === i);
    assert.ok(f, `finding ${i}`);
    assert.match(String(f.result), /^CONFIRMED/);
  }
});

test("decision READY_FOR_OWNER_STAGING_GO retains blockers and M9 20/4", () => {
  const d = readJson("evidence/05_PHASE5D_A_DECISION.json");
  assert.equal(d.decision, "READY_FOR_OWNER_STAGING_GO");
  assert.equal(d.StagingDatabaseMutations, 0);
  assert.equal(d.ProductionAccess, 0);
  assert.equal(d.m9.executableApplyCount, 20);
  assert.equal(d.m9.nonExecutableCandidateCount, 4);
  assert.equal(d.m9.tt5dDeclaredExecutable, false);
  assert.equal(d.continuingPhase5.executionRunbookAccepted, false);
  assert.equal(d.continuingPhase5.productionExecutionGo, false);
  assert.equal(d.continuingPhase5.PHASE_05_COMPLETE, "NOT_ISSUED");
  assert.equal(d.retainedBlockers.BLOCKED_PHASE5C_TT5D_CERTIFICATION, true);
  assert.equal(d.retainedBlockers.BLOCKED_PHASE5_READINESS, true);
});

test("reconciliation SQL is fail-closed and non-destructive", () => {
  const sql = fs.readFileSync(path.join(PKG, "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql"), "utf8");
  const body = sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /PHASE5D_BASELINE_MISMATCH/);
  assert.match(sql, /ALTER FUNCTION[\s\S]*STABLE/i);
  assert.match(sql, /REVOKE ALL[\s\S]*FROM PUBLIC,\s*anon/i);
  assert.doesNotMatch(body, /DROP\s+TABLE/i);
  assert.doesNotMatch(body, /TRUNCATE\s+/i);
  assert.match(sql, /Forbidden Production/);
});

test("verify SQL covers all 13 function names", () => {
  const sql = fs.readFileSync(path.join(PKG, "sql/20_TT5D_POST_APPLY_VERIFY.sql"), "utf8");
  const names = [
    "referee_v5_assignment_effective_status",
    "referee_v5_mark_assignment_expired_if_needed",
    "team_tournament_create_referee_assignment",
    "team_tournament_revoke_referee_assignment",
    "team_tournament_list_referee_assignments",
    "referee_v5_apply_admin_result_revision",
    "team_tournament_reopen_referee_match",
    "team_tournament_request_referee_correction",
    "team_tournament_review_referee_correction",
    "team_tournament_list_referee_corrections",
    "referee_v5_current_user_has_assignment",
    "referee_v5_assert_assignment_write",
    "team_tournament_referee_match_access_ops",
  ];
  for (const n of names) assert.match(sql, new RegExp(n));
  assert.match(sql, /anon must be denied/);
});

test("rollback restores IMMUTABLE and baseline ACLs", () => {
  const sql = fs.readFileSync(path.join(PKG, "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql"), "utf8");
  assert.match(sql, /ALTER FUNCTION[\s\S]*IMMUTABLE/i);
  assert.match(sql, /DELETE FROM supabase_migrations\.schema_migrations/);
  assert.match(sql, /GRANT ALL ON TABLE public\.team_tournament_referee_correction_requests TO authenticated/);
});

test("dependency map forbids rewriting Phase 5B/5C history", () => {
  const m = readJson("evidence/04_TWO_WAY_DEPENDENCY_MAP.json");
  assert.equal(m.phase5dAModifiesHistoricalPhase5B5C, false);
  assert.equal(m.dependencyClosureResult, "PASS");
  assert.ok(m.futureUpdateRequirementsWithoutRewritingHistory.length >= 10);
});

test("Phase 5D-A verifier script PASS", () => {
  const r = spawnSync(
    process.execPath,
    [path.join(PKG, "scripts/verify-phase5d-a.mjs")],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /PASS Phase 5D-A verifier/);
});

test("dependency-closure: protected Phase 5B checksum files unchanged vs origin/main", () => {
  const protectedFiles = [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5B_CHECKSUM_MANIFEST.json",
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/M9_MANIFEST.json",
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/00_SOURCE_PROVENANCE.json",
  ];
  for (const p of protectedFiles) {
    const r = spawnSync("git", ["diff", "--quiet", "origin/main", "--", p], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `changed: ${p}`);
  }
});

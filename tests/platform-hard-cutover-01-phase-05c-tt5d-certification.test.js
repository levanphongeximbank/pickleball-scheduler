import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

const ROOT = process.cwd();
const PKG5C = path.join(
  ROOT,
  "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification"
);

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function gitExactSha(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  for (const spec of [`:${norm}`, `HEAD:${norm}`]) {
    const oidR = spawnSync("git", ["rev-parse", "--verify", "--quiet", spec], {
      cwd: ROOT,
      encoding: "utf8",
    });
    if (oidR.status !== 0) continue;
    const oid = oidR.stdout.trim();
    const blob = spawnSync("git", ["cat-file", "blob", oid], {
      cwd: ROOT,
      encoding: "buffer",
    });
    if (blob.status === 0) {
      return crypto.createHash("sha256").update(blob.stdout).digest("hex").toUpperCase();
    }
  }
  // Working tree fallback for newly added uncommitted files
  const fp = path.join(ROOT, norm);
  if (fs.existsSync(fp)) {
    return crypto.createHash("sha256").update(fs.readFileSync(fp)).digest("hex").toUpperCase();
  }
  return null;
}

test("Phase 5C required evidence and SQL package exist", () => {
  const required = [
    "sql/00_TT5D_TOUCHED_OBJECT_MANIFEST.json",
    "sql/10_STAGING_PREAPPLY_CATALOG_SNAPSHOT.json",
    "sql/20_TT5D_STAGING_ROLLBACK.sql",
    "sql/30_M9_PRODUCTION_PREWIPE_ROLLBACK_CANDIDATE.sql",
    "sql/99_TT5D_VERIFY.sql",
    "evidence/01_OWNER_GO_TARGET_AND_BACKUP_GATE_2026-07-31.json",
    "evidence/02_TT5D_PREAPPLY_CATALOG_AND_DEPENDENCIES_2026-07-31.json",
    "evidence/03_TT5D_ATOMIC_STAGING_APPLY_RESULT_2026-07-31.json",
    "evidence/04_TT5D_POSTAPPLY_CATALOG_CERTIFICATION_2026-07-31.json",
    "evidence/05_TT5D_SECURITY_AND_RUNTIME_CERTIFICATION_2026-07-31.json",
    "evidence/06_M9_ROLLBACK_AND_PRODUCTION_APPLICABILITY_2026-07-31.json",
    "evidence/07_PHASE5C_M9_RECLASSIFICATION_DECISION_2026-07-31.json",
  ];
  for (const rel of required) {
    assert.ok(fs.existsSync(path.join(PKG5C, rel)), `missing ${rel}`);
  }
});

test("Phase 5C decision is BLOCKED and Phase 5 GO remains false", () => {
  const d = readJson(
    "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/evidence/07_PHASE5C_M9_RECLASSIFICATION_DECISION_2026-07-31.json"
  );
  assert.equal(d.decision, "BLOCKED_PHASE5C_TT5D_CERTIFICATION");
  assert.equal(d.executableApplyCount, 20);
  assert.equal(d.nonExecutableCandidateCount, 4);
  assert.equal(d.tt5dMovedToOrderedApply, false);
  assert.equal(d.continuingPhase5.productionExecutionGo, false);
  assert.equal(d.continuingPhase5.executionRunbookAccepted, false);
  assert.equal(d.continuingPhase5.PHASE_05_COMPLETE, "NOT_ISSUED");
  assert.equal(d.historicalPhase5BDecisionRetained, "BLOCKED_PHASE5B_EXECUTION_PACKAGE");
});

test("Phase 5C apply was not attempted and Staging mutations remain zero", () => {
  const a = readJson(
    "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/evidence/03_TT5D_ATOMIC_STAGING_APPLY_RESULT_2026-07-31.json"
  );
  assert.equal(a.applyAttempted, false);
  assert.equal(a.applyResult, "NOT_ATTEMPTED_STOP_PREAPPLY_CONFLICTING");
  assert.equal(a.productionMutations, 0);
  assert.match(a.stagingMutationClassification, /StagingDatabaseMutations=0/);
});

test("pre-apply classification is CONFLICTING and TT5D remain non-executable on M9", () => {
  const snap = readJson(
    "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/sql/10_STAGING_PREAPPLY_CATALOG_SNAPSHOT.json"
  );
  assert.equal(snap.preApplyClassification, "CONFLICTING");
  const m9 = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/M9_MANIFEST.json"
  );
  assert.equal(m9.executableApplyCount, 20);
  assert.equal(m9.nonExecutableCandidateCount, 4);
  assert.equal(
    m9.readiness,
    "BLOCKED_STAGING_TT5D_PREEXISTING_WITHOUT_CONTROLLED_MIGRATION_PROVENANCE"
  );
  for (const f of [
    "190_TT5D_ASSIGNMENT_SAFETY.sql",
    "200_TT5D_REOPEN_RESULT.sql",
    "210_TT5D_CORRECTION.sql",
    "220_TT5D_SECURITY_GUARDS.sql",
  ]) {
    assert.ok(!m9.orderedApply.some((x) => x.file === f));
    const c = m9.nonExecutionCandidates.find((x) => x.file === f);
    assert.equal(c.executionEligible, false);
  }
});

test("four TT5D exact-byte hashes still match Owner-authorized values", () => {
  const expected = {
    "190_TT5D_ASSIGNMENT_SAFETY.sql":
      "5ABEE354336E5A6D8744558D880F86803C33C283E95A43A4CD9877A2E3B69E70",
    "200_TT5D_REOPEN_RESULT.sql":
      "7DB37D8A39B35789DF6D3948F6899B8ED0D950A6963E97855F0F579FDF43A755",
    "210_TT5D_CORRECTION.sql":
      "F9941BF7316273247D317B2344E2404FC7177F6CD28BB650C0E6BB9CBB66D0B7",
    "220_TT5D_SECURITY_GUARDS.sql":
      "DC359FFAA81F4217491339AF879B509A0903AB98D176C3F7D5E98F3D1A94045F",
  };
  const base =
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament";
  for (const [file, hash] of Object.entries(expected)) {
    const sha = gitExactSha(`${base}/${file}`);
    assert.equal(sha, hash, file);
  }
});

test("verify SQL is SELECT/catalog only", () => {
  const sql = fs.readFileSync(path.join(PKG5C, "sql/99_TT5D_VERIFY.sql"), "utf8");
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|drop|alter)\b/i);
  assert.match(sql, /\bselect\b/i);
});

/**
 * COACHING-03 — Guarded Staging activation package certification (static).
 * No Production. No Staging SQL apply. No database writes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import * as Staging from "../src/features/coaching/staging/index.js";
import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
} from "../src/features/coaching/persistence/index.js";
import { PICK_VN_STAGING_EVIDENCE_DIR_ENV } from "../scripts/shared/resolve-staging-evidence-dir.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function withTempEvidenceDir(fn) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "coaching03-evidence-"));
  try {
    return fn(tempDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function spawnCoaching03Apply(tempEvidenceDir) {
  return spawnSync(
    process.execPath,
    ["scripts/coaching/coaching-03-staging-apply.mjs"],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        [PICK_VN_STAGING_EVIDENCE_DIR_ENV]: tempEvidenceDir,
      },
    }
  );
}

test("COACHING-03 staging constants guard Staging vs Production", () => {
  assert.equal(Staging.COACHING_03_STAGING_PROJECT_REF, "qyewbxjsiiyufanzcjcq");
  assert.ok(
    Staging.COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(
      "expuvcohlcjzvrrauvud"
    )
  );
  assert.equal(
    Staging.COACHING_03_OWNER_GO_TOKEN,
    "COACHING_03_OWNER_GO_APPLY_STAGING"
  );
  assert.equal(Staging.COACHING_03_TEST_PREFIX, "COACHING_03_CERT_FIXTURE_");
  assert.equal(Staging.COACHING_03_CANONICAL_TABLES.length, 13);
});

test("SQL manifest completeness, exact order, checksums, Phase 28 exclusion", () => {
  const verify = Staging.verifyCoaching03MigrationManifest({ repoRoot: root });
  assert.equal(verify.ok, true, (verify.errors || []).join(" | "));
  assert.equal(verify.checked, 10);
  const manifest = Staging.loadCoaching03MigrationManifest(root);
  assert.equal(manifest.environmentTarget, "staging");
  assert.equal(manifest.productionApplyApproved, false);
  assert.equal(manifest.executeSql, false);
  assert.equal(manifest.phase28Excluded, true);
  assert.equal(
    manifest.hashAlgorithm,
    Staging.COACHING_03_MANIFEST_HASH_ALGORITHM
  );
  const forward = manifest.migrations.filter((m) => m.classification === "forward");
  assert.equal(forward.length, 8);
  for (let i = 0; i < Staging.COACHING_03_FORWARD_SQL_ORDER.length; i += 1) {
    assert.equal(forward[i].order, i + 1);
    assert.equal(
      forward[i].path.replace(/\\/g, "/"),
      Staging.COACHING_03_FORWARD_SQL_ORDER[i]
    );
  }
  assert.ok(
    !JSON.stringify(manifest).includes("PHASE_28_COACHING.sql") ||
      manifest.phase28Excluded === true
  );
  for (const blocked of Staging.COACHING_03_PHASE_28_SQL_BLOCKLIST) {
    assert.equal(
      manifest.migrations.some((m) => String(m.path).includes("PHASE_28")),
      false,
      blocked
    );
  }
});

test("manifest rejects checksum drift and duplicate conceptually via verify", () => {
  const manifest = Staging.loadCoaching03MigrationManifest(root);
  const drifted = structuredClone(manifest);
  drifted.migrations[0].sha256 = "0".repeat(64);
  const bad = Staging.verifyCoaching03MigrationManifest({
    repoRoot: root,
    manifest: drifted,
  });
  assert.equal(bad.ok, false);
  assert.ok((bad.errors || []).some((e) => /SHA-256 mismatch/i.test(e)));

  const duped = structuredClone(manifest);
  duped.migrations.push({ ...duped.migrations[0], order: 99 });
  const dup = Staging.verifyCoaching03MigrationManifest({
    repoRoot: root,
    manifest: duped,
  });
  assert.equal(dup.ok, false);
  assert.ok((dup.errors || []).some((e) => /Duplicate/i.test(e)));
});

test("approval template defaults approved=false and productionAllowed=false", () => {
  const approval = Staging.loadCoaching03ApprovalTemplateDefaults(root);
  assert.equal(approval.ok, true, (approval.errors || []).join(" | "));
  assert.equal(approval.defaults.approved, false);
  assert.equal(approval.defaults.environment, "staging");
  assert.equal(approval.defaults.productionAllowed, false);
  assert.equal(
    approval.defaults.goToken,
    "COACHING_03_OWNER_GO_APPLY_STAGING"
  );
});

test("apply refuses without --execute and without GO token", () => {
  const refusedDefault = Staging.evaluateCoaching03ApplyGuards({
    execute: false,
    environment: "staging",
    projectRef: Staging.COACHING_03_STAGING_PROJECT_REF,
    expectedCommit: Staging.getCoaching03HeadSha(root),
    ownerGoToken: Staging.COACHING_03_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    env: {
      STAGING_SUPABASE_URL: `https://${Staging.COACHING_03_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(refusedDefault.applyMode, "REFUSED");
  assert.equal(refusedDefault.canWrite, false);

  const refusedToken = Staging.evaluateCoaching03ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Staging.COACHING_03_STAGING_PROJECT_REF,
    expectedCommit: Staging.getCoaching03HeadSha(root),
    ownerGoToken: "WRONG_TOKEN",
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    env: {
      STAGING_SUPABASE_URL: `https://${Staging.COACHING_03_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(refusedToken.applyMode, "REFUSED");
  assert.ok(
    refusedToken.blockers.some((b) => /approval token/i.test(b))
  );
});

test("apply refuses wrong project ref and Production", () => {
  const wrong = Staging.evaluateCoaching03ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: "aaaaaaaaaaaaaaaaaaaa",
    expectedCommit: Staging.getCoaching03HeadSha(root),
    ownerGoToken: Staging.COACHING_03_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    env: {},
  });
  assert.equal(wrong.canWrite, false);

  const prod = Staging.evaluateCoaching03ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: "expuvcohlcjzvrrauvud",
    expectedCommit: Staging.getCoaching03HeadSha(root),
    ownerGoToken: Staging.COACHING_03_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    env: {
      STAGING_SUPABASE_URL:
        "https://expuvcohlcjzvrrauvud.supabase.co",
    },
  });
  assert.equal(prod.canWrite, false);
  assert.ok(prod.blockers.some((b) => /Production/i.test(b) || /allowlist/i.test(b) || /blocked/i.test(b) || /required/i.test(b)));
});

test("apply refuses missing preflight PASS and checksum drift", () => {
  const noPreflight = Staging.evaluateCoaching03ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Staging.COACHING_03_STAGING_PROJECT_REF,
    expectedCommit: Staging.getCoaching03HeadSha(root),
    ownerGoToken: Staging.COACHING_03_OWNER_GO_TOKEN,
    preflightPass: false,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    env: {
      STAGING_SUPABASE_URL: `https://${Staging.COACHING_03_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(noPreflight.canWrite, false);
  assert.ok(noPreflight.blockers.some((b) => /preflight/i.test(b)));
});

test("apply script prints APPLY_MODE=REFUSED without --execute", () => {
  withTempEvidenceDir((tempDir) => {
    const tracked = path.join(
      root,
      Staging.COACHING_03_EVIDENCE_DIR,
      "APPLY_REFUSED.json"
    );
    const trackedBefore = existsSync(tracked) ? readFileSync(tracked) : null;

    const result = spawnCoaching03Apply(tempDir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /APPLY_MODE=REFUSED/);
    assert.match(result.stdout, /"sqlApplied": false/);

    const evidencePath = path.join(tempDir, "APPLY_REFUSED.json");
    assert.equal(existsSync(evidencePath), true);
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    assert.equal(evidence.APPLY_MODE, "REFUSED");
    assert.equal(evidence.sqlApplied, false);
    assert.equal(evidence.databaseWrites, 0);

    const trackedAfter = existsSync(tracked) ? readFileSync(tracked) : null;
    assert.deepEqual(trackedAfter, trackedBefore);
  });
});

test("no package.json apply shortcut and no CI auto-apply hooks", () => {
  const pkg = JSON.parse(read("package.json"));
  const scripts = pkg.scripts || {};
  for (const [name, cmd] of Object.entries(scripts)) {
    assert.doesNotMatch(
      String(cmd),
      /coaching-03-staging-apply/,
      `package script ${name} must not auto-apply`
    );
  }

  const scanFile = (filePath) => {
    if (!/\.(yml|yaml|json|mjs|js|sh|ps1)$/i.test(filePath)) return;
    const text = readFileSync(filePath, "utf8");
    assert.doesNotMatch(
      text,
      /coaching-03-staging-apply\.mjs[^\n]*--execute/,
      filePath
    );
  };

  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, name.name);
      if (name.isDirectory()) walk(p);
      else scanFile(p);
    }
  };

  for (const rel of [".github/workflows", "vercel.json", "scripts/ci"]) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isDirectory()) walk(abs);
    else scanFile(abs);
  }
});

test("preflight contains no write query and enforces read-only", () => {
  const sql = Staging.buildCoaching03ReadOnlyCatalogProbeSql();
  const check = Staging.assertCatalogQueryReadOnly(sql);
  assert.equal(check.ok, true, check.errors.join(" | "));
  assert.equal(check.writeVerbsFound.length, 0);
  assert.match(sql, /BEGIN TRANSACTION READ ONLY/i);
  assert.match(sql, /ROLLBACK/i);
  assert.doesNotMatch(Staging.stripSqlComments(sql), /\bINSERT\b/i);
  assert.doesNotMatch(Staging.stripSqlComments(sql), /\bUPDATE\b/i);
  assert.doesNotMatch(Staging.stripSqlComments(sql), /\bDELETE\b/i);
  assert.doesNotMatch(Staging.stripSqlComments(sql), /\bCREATE\b/i);

  const evil = Staging.assertCatalogQueryReadOnly(
    "BEGIN READ ONLY; INSERT INTO t VALUES (1); ROLLBACK;"
  );
  assert.equal(evil.ok, false);
});

test("secret redaction strips tokens and passwords", () => {
  const redacted = Staging.redactSecrets(
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb password=supersecret postgres://u:p@host/db SERVICE_ROLE=abc123"
  );
  assert.doesNotMatch(redacted, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
  assert.doesNotMatch(redacted, /supersecret/);
  assert.doesNotMatch(redacted, /postgres:\/\/u:p@/);
  assert.match(redacted, /REDACTED/);
});

test("certification matrix and fixture cleanup completeness", () => {
  const matrix = read(
    "docs/coaching-training/coaching-03/04_COACHING_03_CERTIFICATION_MATRIX.md"
  );
  for (const section of [
    "## A. Schema",
    "## B. Authorization",
    "## C. Atomic attendance correction",
    "## D. Atomic entitlement consumption",
    "## E. Append-only protection",
    "## F. Runtime adapter",
  ]) {
    assert.ok(matrix.includes(section), section);
  }
  const fixturePlan = read(
    "docs/coaching-training/coaching-03/06_COACHING_03_RUNTIME_CERTIFICATION_PLAN.md"
  );
  assert.ok(fixturePlan.includes("COACHING_03_CERT_FIXTURE_"));
  assert.ok(fixturePlan.includes("cleanup"));
  assert.ok(fixturePlan.includes("residual"));
});

test("rollback object coverage includes tables RPCs policies", () => {
  const rollback = read(
    "docs/coaching-training/coaching-02/90_COACHING_02_ROLLBACK.sql"
  );
  for (const table of Staging.COACHING_03_CANONICAL_TABLES) {
    assert.ok(
      rollback.includes(`DROP TABLE IF EXISTS public.${table}`),
      table
    );
  }
  assert.ok(rollback.includes("coaching_apply_attendance_correction"));
  assert.ok(rollback.includes("coaching_consume_entitlement"));
  assert.ok(rollback.includes("DROP POLICY IF EXISTS"));
  const roleRollback = read(
    Staging.COACHING_03_ROLE_GRANT_ROLLBACK_RELATIVE_PATH
  );
  assert.ok(roleRollback.includes("DELETE FROM public.role_permissions"));
  assert.ok(roleRollback.includes("coaching"));
});

test("role matrix covers all 14 actions and denies COACH/PLAYER all grants", () => {
  const matrix = Staging.verifyCoaching03RoleMatrixCompleteness();
  assert.equal(matrix.ok, true, matrix.errors.join(" | "));
  assert.equal(matrix.actionCount, 14);
  assert.equal(matrix.playerRecordsReadGranted, false);
  assert.equal(matrix.coachAnyGrant, false);
  assert.equal(matrix.playerAnyGrant, false);
  assert.equal(Staging.roleHasAnyCoaching03Grant("COACH"), false);
  assert.equal(Staging.roleHasAnyCoaching03Grant("PLAYER"), false);
  assert.equal(
    Staging.isCoaching03RoleGrantProposed("PLAYER", "coaching.records.read"),
    false
  );
  assert.equal(
    Staging.isCoaching03RoleGrantProposed("COACH", "coaching.records.read"),
    false
  );
  for (const action of Staging.COACHING_03_ACTIONS) {
    assert.equal(
      Staging.isCoaching03RoleGrantProposed("COACH", action),
      false,
      action
    );
    assert.equal(
      Staging.isCoaching03RoleGrantProposed("PLAYER", action),
      false,
      action
    );
    for (const admin of Staging.COACHING_03_ADMIN_GRANT_ROLES) {
      assert.equal(
        Staging.isCoaching03RoleGrantProposed(admin, action),
        true,
        `${admin}:${action}`
      );
    }
  }
});

test("SQL proposal and docs deny COACH grants; COACHING-04 handoff requires assignment RLS", () => {
  const sql = read(Staging.COACHING_03_ROLE_GRANT_FORWARD_RELATIVE_PATH);
  assert.doesNotMatch(
    sql,
    /INSERT[\s\S]*SELECT\s+'COACH'/i,
    "SQL must not INSERT role_permissions for COACH"
  );
  assert.ok(/No COACH grants/i.test(sql) || /zero Coaching permissions until COACHING-04/i.test(sql));
  assert.doesNotMatch(sql, /operational subset/i);

  const matrixDoc = read(
    "docs/coaching-training/coaching-03/02_COACHING_03_ROLE_PERMISSION_MATRIX.md"
  );
  assert.ok(matrixDoc.includes("COACH | **none**"));
  assert.ok(matrixDoc.includes("assignment-aware"));
  assert.ok(matrixDoc.includes("COACHING-04"));
  assert.ok(matrixDoc.includes("COACH authorization is incomplete"));
  assert.doesNotMatch(
    matrixDoc,
    /COACH.*operational subset|positive COACH access/i
  );

  for (const prereq of Staging.COACHING_04_COACH_GRANT_PREREQUISITES) {
    assert.ok(
      matrixDoc.toLowerCase().includes(
        prereq.split(" ")[0].toLowerCase()
      ) || matrixDoc.includes("Assignment-aware") || matrixDoc.includes("assignment-aware"),
      `handoff mentions concept from: ${prereq}`
    );
  }
  assert.ok(matrixDoc.includes("Assignment-aware RLS"));
  assert.ok(matrixDoc.includes("coach_principal_id") || matrixDoc.includes("coach-player"));
  assert.ok(matrixDoc.includes("cross-coach"));
  assert.ok(matrixDoc.includes("Removed assignment"));

  const cert = read(
    "docs/coaching-training/coaching-03/04_COACHING_03_CERTIFICATION_MATRIX.md"
  );
  assert.ok(cert.includes("COACH without Coaching permission"));
  assert.ok(cert.includes("PLAYER without Coaching permission"));
  assert.ok(cert.includes("No positive COACH flow"));
  assert.ok(cert.includes("SUPER_ADMIN"));
  assert.ok(cert.includes("VENUE_MANAGER"));
  assert.ok(cert.includes("CLUB_MANAGER"));

  assert.deepEqual(
    [...Staging.COACHING_03_CERT_POSITIVE_ROLES],
    [
      "SUPER_ADMIN",
      "TENANT_OWNER",
      "VENUE_OWNER",
      "VENUE_MANAGER",
      "CLUB_MANAGER",
    ]
  );
});

test("apply still refuses without Owner GO; SQL not applied and writes remain zero", () => {
  const refused = Staging.evaluateCoaching03ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Staging.COACHING_03_STAGING_PROJECT_REF,
    expectedCommit: Staging.getCoaching03HeadSha(root),
    ownerGoToken: "WRONG",
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    env: {
      STAGING_SUPABASE_URL: `https://${Staging.COACHING_03_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(refused.applyMode, "REFUSED");
  assert.equal(refused.canWrite, false);

  const approval = Staging.loadCoaching03ApprovalTemplateDefaults(root);
  assert.equal(approval.defaults.approved, false);
  assert.equal(approval.defaults.productionAllowed, false);
  assert.equal(approval.defaults.environment, "staging");

  const evidence = read(
    "docs/coaching-training/coaching-03/evidence/PREFLIGHT_LIVE_READONLY.json"
  );
  const live = JSON.parse(evidence);
  assert.equal(live.sqlApplied, false);
  assert.equal(live.databaseWrites, 0);
  assert.equal(live.ownerGoGranted, false);
});

test("runtime remains uncut and localStorage legacy path remains present", () => {
  assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
  const facade = read("src/features/coaching/index.js");
  assert.ok(facade.includes("services/coachingService.js"));
  assert.ok(facade.includes("NOT wired as the application runtime default"));
  const ls = read("src/features/coaching/services/coachingService.js");
  assert.ok(/localStorage/i.test(ls));
});

test("docs package and scripts exist", () => {
  const docs = [
    "docs/coaching-training/coaching-03/00_COACHING_03_SCOPE_AND_GATES.md",
    "docs/coaching-training/coaching-03/01_COACHING_03_STAGING_PREFLIGHT.md",
    "docs/coaching-training/coaching-03/02_COACHING_03_ROLE_PERMISSION_MATRIX.md",
    "docs/coaching-training/coaching-03/03_COACHING_03_APPLY_RUNBOOK.md",
    "docs/coaching-training/coaching-03/04_COACHING_03_CERTIFICATION_MATRIX.md",
    "docs/coaching-training/coaching-03/05_COACHING_03_ROLLBACK_AND_RECOVERY.md",
    "docs/coaching-training/coaching-03/06_COACHING_03_RUNTIME_CERTIFICATION_PLAN.md",
    "docs/coaching-training/coaching-03/OWNER_STAGING_APPLY_APPROVAL.template.json",
    "docs/coaching-training/coaching-03/sql-migration-manifest.json",
    Staging.COACHING_03_ROLE_GRANT_FORWARD_RELATIVE_PATH,
    Staging.COACHING_03_ROLE_GRANT_ROLLBACK_RELATIVE_PATH,
    "scripts/coaching/coaching-03-staging-preflight.mjs",
    "scripts/coaching/coaching-03-staging-apply.mjs",
    "scripts/coaching/coaching-03-staging-certify.mjs",
    "scripts/coaching/coaching-03-staging-cleanup.mjs",
  ];
  for (const rel of docs) {
    assert.equal(existsSync(path.join(root, rel)), true, rel);
  }
});

test("gates document forbids jumping Gate B to Gate D", () => {
  const scope = read(
    "docs/coaching-training/coaching-03/00_COACHING_03_SCOPE_AND_GATES.md"
  );
  assert.ok(scope.includes("Do not jump from Gate B to Gate D"));
  assert.ok(scope.includes("GATE_C_OWNER_GO") || scope.includes("Owner GO"));
});

const APPROVED_SHA = "c89bec293f4f52b90734a56f2ce813919643b929";
const TOOLING_SHA = "911daddf4bfff0a636c5d4f1e647379ea30698ab";
const EVIDENCE_SHA = "d5b622cf92c947e130a4f868c1947e68f786201a";
const SHORT_SHA = "911daddf";

function baseApproval(expectedGitCommit) {
  return {
    approved: true,
    environment: "staging",
    productionAllowed: false,
    stagingProjectRef: Staging.COACHING_03_STAGING_PROJECT_REF,
    ownerGoToken: Staging.COACHING_03_OWNER_GO_TOKEN,
    goToken: Staging.COACHING_03_OWNER_GO_TOKEN,
    expectedGitCommit,
    roleMatrixApproved: true,
    coachGrantsAllowed: false,
    playerGrantsAllowed: false,
    uiRuntimeCutoverApproved: false,
  };
}

function provenanceGuardInput(overrides = {}) {
  return {
    execute: true,
    environment: "staging",
    projectRef: Staging.COACHING_03_STAGING_PROJECT_REF,
    ownerGoToken: Staging.COACHING_03_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    requireApprovalEvidence: true,
    requireCleanWorktree: true,
    worktreeCleanOverride: true,
    repoRoot: root,
    env: {
      STAGING_SUPABASE_URL: `https://${Staging.COACHING_03_STAGING_PROJECT_REF}.supabase.co`,
    },
    ...overrides,
  };
}

test("exact-commit provenance: approved HEAD PASS", () => {
  const g = Staging.evaluateCoaching03ApplyGuards(
    provenanceGuardInput({
      actualGitHead: APPROVED_SHA,
      expectedCommit: APPROVED_SHA,
      approvalOverride: baseApproval(APPROVED_SHA),
    })
  );
  assert.equal(g.canWrite, true);
  assert.equal(g.applyMode, "EXECUTE_ALLOWED");
  assert.equal(g.actualGitHead, APPROVED_SHA);
});

test("exact-commit provenance: descendant HEAD refused", () => {
  const g = Staging.evaluateCoaching03ApplyGuards(
    provenanceGuardInput({
      actualGitHead: TOOLING_SHA,
      expectedCommit: TOOLING_SHA,
      approvalOverride: baseApproval(APPROVED_SHA),
    })
  );
  assert.equal(g.canWrite, false);
  assert.equal(
    g.verdict,
    Staging.COACHING_03_VERDICTS.EXECUTION_COMMIT_MISMATCH_REFUSED
  );
  assert.equal(g.sqlWouldApply, false);
});

test("exact-commit provenance: ancestor HEAD refused", () => {
  const g = Staging.evaluateCoaching03ApplyGuards(
    provenanceGuardInput({
      actualGitHead: APPROVED_SHA,
      expectedCommit: APPROVED_SHA,
      approvalOverride: baseApproval(TOOLING_SHA),
    })
  );
  assert.equal(g.canWrite, false);
  assert.equal(
    g.verdict,
    Staging.COACHING_03_VERDICTS.EXECUTION_COMMIT_MISMATCH_REFUSED
  );
});

test("exact-commit provenance: CLI expected differs from approval refused", () => {
  const g = Staging.evaluateCoaching03ApplyGuards(
    provenanceGuardInput({
      actualGitHead: TOOLING_SHA,
      expectedCommit: TOOLING_SHA,
      approvalOverride: baseApproval(APPROVED_SHA),
    })
  );
  assert.equal(g.canWrite, false);
  assert.ok(
    (g.commitMismatchReasons || []).some((r) =>
      /Approval expectedGitCommit must equal CLI/i.test(r)
    ) ||
      (g.commitMismatchReasons || []).some((r) =>
        /Approval expectedGitCommit must equal actual git HEAD/i.test(r)
      )
  );
});

test("exact-commit provenance: actual HEAD differs from approval refused", () => {
  const g = Staging.evaluateCoaching03ApplyGuards(
    provenanceGuardInput({
      actualGitHead: EVIDENCE_SHA,
      expectedCommit: APPROVED_SHA,
      approvalOverride: baseApproval(APPROVED_SHA),
    })
  );
  assert.equal(g.canWrite, false);
  assert.equal(
    g.verdict,
    Staging.COACHING_03_VERDICTS.EXECUTION_COMMIT_MISMATCH_REFUSED
  );
});

test("exact-commit provenance: short SHA refused", () => {
  const g = Staging.evaluateCoaching03ApplyGuards(
    provenanceGuardInput({
      actualGitHead: TOOLING_SHA,
      expectedCommit: SHORT_SHA,
      approvalOverride: baseApproval(TOOLING_SHA),
    })
  );
  assert.equal(g.canWrite, false);
  assert.equal(
    g.verdict,
    Staging.COACHING_03_VERDICTS.EXECUTION_COMMIT_MISMATCH_REFUSED
  );
  assert.ok(
    (g.commitMismatchReasons || []).some((r) => /full 40-char SHA/i.test(r))
  );
});

test("exact-commit provenance: dirty tree refused", () => {
  const g = Staging.evaluateCoaching03ApplyGuards(
    provenanceGuardInput({
      actualGitHead: APPROVED_SHA,
      expectedCommit: APPROVED_SHA,
      approvalOverride: baseApproval(APPROVED_SHA),
      worktreeCleanOverride: false,
    })
  );
  assert.equal(g.canWrite, false);
  assert.ok((g.blockers || []).some((b) => /clean/i.test(b)));
});

test("exact-commit provenance: tooling commit after approval invalidates GO", () => {
  // Historical deviation pattern: HEAD=911daddf tooling, approval pinned to c89bec.
  assert.equal(
    Staging.isCoaching03GitAncestor(APPROVED_SHA, TOOLING_SHA, root),
    true
  );
  const g = Staging.evaluateCoaching03ApplyGuards(
    provenanceGuardInput({
      actualGitHead: TOOLING_SHA,
      expectedCommit: TOOLING_SHA,
      approvalOverride: baseApproval(APPROVED_SHA),
    })
  );
  assert.equal(g.canWrite, false);
  assert.equal(g.sqlWouldApply, false);
  assert.equal(
    g.verdict,
    Staging.COACHING_03_VERDICTS.EXECUTION_COMMIT_MISMATCH_REFUSED
  );
});

test("exact-commit provenance: mismatch refuses before network write", () => {
  const g = Staging.evaluateCoaching03ApplyGuards(
    provenanceGuardInput({
      actualGitHead: TOOLING_SHA,
      expectedCommit: TOOLING_SHA,
      approvalOverride: baseApproval(APPROVED_SHA),
    })
  );
  assert.equal(g.sqlWouldApply, false);
  assert.equal(g.canWrite, false);
  // Apply script default without --execute also refuses.
  withTempEvidenceDir((tempDir) => {
    const dry = spawnCoaching03Apply(tempDir);
    assert.equal(dry.status, 0);
    assert.ok(String(dry.stdout || "").includes("APPLY_MODE=REFUSED"));
    assert.ok(!String(dry.stdout || "").includes("APPLY_MODE=EXECUTED"));
    assert.equal(existsSync(path.join(tempDir, "APPLY_REFUSED.json")), true);
  });
});

test("provenance remediation does not perform second Staging apply", () => {
  const applySrc = read("scripts/coaching/coaching-03-staging-apply.mjs");
  assert.ok(applySrc.includes("APPLY_MODE=REFUSED"));
  const deviationPath =
    "docs/coaching-training/coaching-03/evidence/EXECUTION_PROVENANCE_DEVIATION.json";
  if (existsSync(path.join(root, deviationPath))) {
    const d = JSON.parse(read(deviationPath));
    assert.equal(d.secondApplyPerformed, false);
    assert.equal(d.rollbackPerformed, false);
    assert.equal(d.retroactiveApproval, false);
  }
});

test("isCoaching03FullGitSha rejects short and non-hex", () => {
  assert.equal(Staging.isCoaching03FullGitSha(APPROVED_SHA), true);
  assert.equal(Staging.isCoaching03FullGitSha(SHORT_SHA), false);
  assert.equal(Staging.isCoaching03FullGitSha("g".repeat(40)), false);
  assert.equal(Staging.isCoaching03FullGitSha(""), false);
});

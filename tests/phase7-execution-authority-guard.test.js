import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

import {
  assertPhase7ExecutionAuthority,
  computeManifestGitBlobDigest,
  computeWorkingTreeManifestDigest,
  verifyManifestEntries,
  PHASE7_CERTIFIED_CONSTANTS,
} from "../scripts/phase7-execution-authority.mjs";

function runGit(args, cwd, encoding = "utf8") {
  const out = execFileSync("git", args, { cwd, encoding });
  return typeof out === "string" ? out.trim() : out;
}

function copyFile(srcRoot, dstRoot, rel) {
  const src = path.join(srcRoot, rel);
  const dst = path.join(dstRoot, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function write(relRoot, rel, content) {
  const file = path.join(relRoot, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function digestBytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

const MANIFEST_REL = "docs/v7/production-execution/MANIFEST.sha256";

function makeManifest(root) {
  const manifestItems = [
    "00_PRODUCTION_EXECUTION_AUTHORITY.md",
    "01_TARGET_AND_BASELINE_GUARD.md",
    "02_ORDERED_EXECUTION_LEDGER.json",
    "03_PREFLIGHT_CHECKLIST.md",
    "04_EXECUTION_RUNBOOK.md",
    "05_CANARY_AND_TRAFFIC_PLAN.md",
    "06_ROLLBACK_AND_RECOVERY_MATRIX.json",
    "07_POST_DEPLOY_VERIFICATION.md",
    "08_EXECUTION_EVIDENCE.template.json",
    "09_OWNER_GO_CHECKPOINT.md",
    "10_EXECUTION_AUTHORITY_INPUT.template.json",
    "PACKAGE_VALIDATION.json",
  ];
  const lines = manifestItems.map((name) => {
    const rel = `docs/v7/production-execution/${name}`;
    const blob = runGit(["cat-file", "blob", `HEAD:${rel}`], root, null);
    return `${digestBytes(blob)}  ${rel}`;
  });
  write(root, "docs/v7/production-execution/MANIFEST.sha256", `${lines.join("\n")}\n`);
}

function writeAuthority(root, authority) {
  write(root, "phase7.execution-authority.local.json", JSON.stringify(authority, null, 2));
}

function baseExpected(packageSourceCommit, manifestGitBlobDigest) {
  return {
    ...PHASE7_CERTIFIED_CONSTANTS,
    authoritySchemaVersion: 2,
    packageSourceCommit,
    manifestGitBlobDigest,
  };
}

function baseAuthority(packageSourceCommit, manifestGitBlobDigest) {
  return {
    authoritySchemaVersion: 2,
    approvedExecutionHead: packageSourceCommit,
    packageSourceCommit,
    packageVersion: PHASE7_CERTIFIED_CONSTANTS.packageVersion,
    manifestGitBlobDigest,
    targetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
    ledgerStepCount: PHASE7_CERTIFIED_CONSTANTS.ledgerStepCount,
    issuedAt: "2026-08-05T00:00:00.000Z",
    executionWindow: { start: "2026-08-05T00:00:00.000Z", end: "2026-08-05T02:00:00.000Z" },
    ownerAuthorizationMarker: "OWNER_GO_20260805_PHASE7",
    productionGo: "YES",
  };
}

function setupRepoFixture(t) {
  const srcRoot = path.resolve(".");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase7-guard-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  runGit(["init", "-b", "main"], root);
  runGit(["config", "user.email", "phase7@test.local"], root);
  runGit(["config", "user.name", "phase7-test"], root);
  runGit(["config", "core.autocrlf", "false"], root);

  const filesToCopy = [
    "docs/v7/production-execution/00_PRODUCTION_EXECUTION_AUTHORITY.md",
    "docs/v7/production-execution/01_TARGET_AND_BASELINE_GUARD.md",
    "docs/v7/production-execution/02_ORDERED_EXECUTION_LEDGER.json",
    "docs/v7/production-execution/03_PREFLIGHT_CHECKLIST.md",
    "docs/v7/production-execution/04_EXECUTION_RUNBOOK.md",
    "docs/v7/production-execution/05_CANARY_AND_TRAFFIC_PLAN.md",
    "docs/v7/production-execution/06_ROLLBACK_AND_RECOVERY_MATRIX.json",
    "docs/v7/production-execution/07_POST_DEPLOY_VERIFICATION.md",
    "docs/v7/production-execution/08_EXECUTION_EVIDENCE.template.json",
    "docs/v7/production-execution/09_OWNER_GO_CHECKPOINT.md",
    "docs/v7/production-execution/10_EXECUTION_AUTHORITY_INPUT.template.json",
    "docs/v7/production-execution/PACKAGE_VALIDATION.json",
    "docs/v7/warning-closure/W-P7-001_BASELINE_RECONCILIATION.json",
    "docs/v7/warning-closure/W-P7-002_ROLE_SCHEMA_RECONCILIATION.json",
    "docs/v7/warning-closure/W-P7-003_PHASE1B_PARTIAL_STATE_RECONCILIATION.json",
  ];
  for (const rel of filesToCopy) copyFile(srcRoot, root, rel);

  // Ensure warning closure counters are CLOSED for positive path.
  write(
    root,
    "docs/v7/warning-closure/W-P7-001_BASELINE_RECONCILIATION.json",
    JSON.stringify({ staleExecutionGuardCount: 0 }, null, 2)
  );
  write(
    root,
    "docs/v7/warning-closure/W-P7-002_ROLE_SCHEMA_RECONCILIATION.json",
    JSON.stringify({ payload: { dependency_inventory: { functions_with_club_members_role_code: [] } } }, null, 2)
  );
  write(
    root,
    "docs/v7/warning-closure/W-P7-003_PHASE1B_PARTIAL_STATE_RECONCILIATION.json",
    JSON.stringify({ conflictingObjects: 0, unknownObjects: 0, undefinedIdempotencyBehavior: 0 }, null, 2)
  );

  write(root, ".gitignore", ".env.phase7-production.local\nphase7.execution-authority.local.json\n");

  runGit(["add", "."], root);
  runGit(["commit", "-m", "fixture base"], root);

  makeManifest(root);
  runGit(["add", MANIFEST_REL], root);
  runGit(["commit", "-m", "fixture manifest"], root);

  write(root, ".env.phase7-production.local", "DUMMY_TOKEN=fake\n");
  const packageSourceCommit = runGit(["rev-parse", "HEAD"], root);

  // Set remote and origin/main to current commit for guard checks.
  runGit(["remote", "add", "origin", root], root);
  runGit(["update-ref", "refs/remotes/origin/main", "HEAD"], root);

  const manifestGitBlobDigest = computeManifestGitBlobDigest(root, packageSourceCommit);
  writeAuthority(root, baseAuthority(packageSourceCommit, manifestGitBlobDigest));

  return { root, manifestGitBlobDigest, packageSourceCommit };
}

test("accepts fresh post-merge execution head when explicitly approved", (t) => {
  const { root, packageSourceCommit, manifestGitBlobDigest } = setupRepoFixture(t);
  const result = assertPhase7ExecutionAuthority({
    rootDir: root,
    authorityFilePath: "phase7.execution-authority.local.json",
    runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
    credentialFilePath: ".env.phase7-production.local",
    expected: baseExpected(packageSourceCommit, manifestGitBlobDigest),
  });
  assert.equal(result.originMain, result.authority.approvedExecutionHead);
  assert.equal(result.headSha, result.authority.approvedExecutionHead);
  assert.equal(result.manifestGitBlobDigest, manifestGitBlobDigest);
});

test("LF/CRLF working-tree variants keep canonical git-blob digest stable", (t) => {
  const { root, packageSourceCommit } = setupRepoFixture(t);
  const before = computeManifestGitBlobDigest(root, packageSourceCommit);
  const text = fs.readFileSync(path.join(root, MANIFEST_REL), "utf8");
  fs.writeFileSync(path.join(root, MANIFEST_REL), text.replace(/\n/g, "\r\n"));
  const after = computeManifestGitBlobDigest(root, packageSourceCommit);
  const workingDigest = computeWorkingTreeManifestDigest(root);
  assert.equal(before, after);
  assert.notEqual(workingDigest, after);
});

test("core.autocrlf settings do not change canonical git-blob digest", (t) => {
  const { root, packageSourceCommit } = setupRepoFixture(t);
  const d0 = computeManifestGitBlobDigest(root, packageSourceCommit);
  runGit(["config", "core.autocrlf", "true"], root);
  const d1 = computeManifestGitBlobDigest(root, packageSourceCommit);
  runGit(["config", "core.autocrlf", "input"], root);
  const d2 = computeManifestGitBlobDigest(root, packageSourceCommit);
  assert.equal(d0, d1);
  assert.equal(d0, d2);
});

test("canonical digest equals SHA256 of manifest git blob bytes", (t) => {
  const { root, packageSourceCommit } = setupRepoFixture(t);
  const blob = runGit(["cat-file", "blob", `${packageSourceCommit}:${MANIFEST_REL}`], root, null);
  const expected = digestBytes(blob);
  assert.equal(computeManifestGitBlobDigest(root, packageSourceCommit), expected);
});

test("working-tree digest is not accepted as authority", (t) => {
  const { root, packageSourceCommit, manifestGitBlobDigest } = setupRepoFixture(t);
  const manifestText = fs.readFileSync(path.join(root, MANIFEST_REL), "utf8");
  runGit(["config", "core.autocrlf", "true"], root);
  runGit(["checkout", "--", MANIFEST_REL], root);
  fs.writeFileSync(path.join(root, MANIFEST_REL), manifestText.replace(/\n/g, "\r\n"));

  const authorityPath = path.join(root, "phase7.execution-authority.local.json");
  const a = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  a.manifestGitBlobDigest = computeWorkingTreeManifestDigest(root);
  writeAuthority(root, a);

  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: baseExpected(packageSourceCommit, manifestGitBlobDigest),
    });
  }, /worktree must be clean|manifest git-blob digest mismatch/i);
});

test("aborts on wrong git-blob digest", (t) => {
  const { root, packageSourceCommit } = setupRepoFixture(t);
  const authorityPath = path.join(root, "phase7.execution-authority.local.json");
  const a = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  a.manifestGitBlobDigest = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  writeAuthority(root, a);

  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: baseExpected(packageSourceCommit, a.manifestGitBlobDigest),
    });
  }, /manifest git-blob digest mismatch|certified manifestGitBlobDigest mismatch/i);
});

test("missing manifest blob aborts", (t) => {
  const { root, packageSourceCommit } = setupRepoFixture(t);
  assert.throws(() => computeManifestGitBlobDigest(root, packageSourceCommit, "docs/v7/production-execution/MISSING.sha256"), /cannot resolve git blob/i);
});

test("requires package source commit to be ancestor", (t) => {
  const { root, manifestGitBlobDigest } = setupRepoFixture(t);
  const authorityPath = path.join(root, "phase7.execution-authority.local.json");
  const a = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  a.packageSourceCommit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  writeAuthority(root, a);
  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: baseExpected(a.packageSourceCommit, manifestGitBlobDigest),
    });
  }, /not ancestor|merge-base|mismatch/i);
});

test("aborts on wrong execution head", (t) => {
  const { root, packageSourceCommit, manifestGitBlobDigest } = setupRepoFixture(t);
  const authorityPath = path.join(root, "phase7.execution-authority.local.json");
  const a = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  a.approvedExecutionHead = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  writeAuthority(root, a);

  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: baseExpected(packageSourceCommit, manifestGitBlobDigest),
    });
  }, /origin\/main mismatch|HEAD mismatch/i);
});

test("aborts on wrong target", (t) => {
  const { root, packageSourceCommit, manifestGitBlobDigest } = setupRepoFixture(t);
  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: "wrong-target-ref",
      credentialFilePath: ".env.phase7-production.local",
      expected: baseExpected(packageSourceCommit, manifestGitBlobDigest),
    });
  }, /target mismatch/i);
});

test("manifest entry mismatch aborts", (t) => {
  const { root, manifestGitBlobDigest } = setupRepoFixture(t);
  const tracked = path.join(root, "docs/v7/production-execution/00_PRODUCTION_EXECUTION_AUTHORITY.md");
  fs.appendFileSync(tracked, "\nmutation for mismatch commit\n");
  runGit(["add", tracked], root);
  runGit(["commit", "-m", "mismatch commit"], root);
  runGit(["update-ref", "refs/remotes/origin/main", "HEAD"], root);

  const head = runGit(["rev-parse", "HEAD"], root);
  const authority = baseAuthority(head, manifestGitBlobDigest);
  writeAuthority(root, authority);

  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: baseExpected(head, manifestGitBlobDigest),
    });
  }, /manifest entry mismatch/i);
});

test("aborts when Owner authorization is missing", (t) => {
  const { root, packageSourceCommit, manifestGitBlobDigest } = setupRepoFixture(t);
  const authorityPath = path.join(root, "phase7.execution-authority.local.json");
  const a = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  a.ownerAuthorizationMarker = "";
  a.productionGo = "NO";
  writeAuthority(root, a);

  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: baseExpected(packageSourceCommit, manifestGitBlobDigest),
    });
  }, /Production GO is not active|ownerAuthorizationMarker/i);
});

test("stale pre-merge SHA cannot act as approved execution head", (t) => {
  const { root, packageSourceCommit, manifestGitBlobDigest } = setupRepoFixture(t);
  const authorityPath = path.join(root, "phase7.execution-authority.local.json");
  const a = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  a.approvedExecutionHead = "bd08d448e3c207ac6d5871a734c346f6bb290c40";
  writeAuthority(root, a);

  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: baseExpected(packageSourceCommit, manifestGitBlobDigest),
    });
  }, /origin\/main mismatch|HEAD mismatch/i);
});

test("uncommitted working-tree changes abort independently", (t) => {
  const { root, packageSourceCommit, manifestGitBlobDigest } = setupRepoFixture(t);
  fs.appendFileSync(path.join(root, "docs/v7/production-execution/03_PREFLIGHT_CHECKLIST.md"), "\nlocal dirty mutation\n");
  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: baseExpected(packageSourceCommit, manifestGitBlobDigest),
    });
  }, /worktree must be clean/i);
});

test("old authority schema is rejected", (t) => {
  const { root, packageSourceCommit, manifestGitBlobDigest } = setupRepoFixture(t);
  writeAuthority(root, {
    approvedExecutionHead: packageSourceCommit,
    packageSourceCommit,
    packageVersion: PHASE7_CERTIFIED_CONSTANTS.packageVersion,
    packageManifestDigest: manifestGitBlobDigest,
    targetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
    ledgerStepCount: PHASE7_CERTIFIED_CONSTANTS.ledgerStepCount,
    issuedAt: "2026-08-05T00:00:00.000Z",
    executionWindow: { start: "2026-08-05T00:00:00.000Z", end: "2026-08-05T02:00:00.000Z" },
    ownerAuthorizationMarker: "OWNER_GO_20260805_PHASE7",
    productionGo: "YES",
  });

  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: baseExpected(packageSourceCommit, manifestGitBlobDigest),
    });
  }, /schema v1 is rejected|authoritySchemaVersion/i);
});

test("verifyManifestEntries reads canonical content from approvedExecutionHead", (t) => {
  const { root, packageSourceCommit } = setupRepoFixture(t);
  const ok = verifyManifestEntries(root, packageSourceCommit);
  assert.equal(ok.mismatches.length, 0);

  fs.appendFileSync(path.join(root, "docs/v7/production-execution/00_PRODUCTION_EXECUTION_AUTHORITY.md"), "\nlocal only\n");
  const stillOk = verifyManifestEntries(root, packageSourceCommit);
  assert.equal(stillOk.mismatches.length, 0);
});

test("execution scripts call local authority guard before token/fetch use", () => {
  const scripts = [
    "scripts/phase7-warning-closure-readonly.mjs",
    "scripts/preflight-phase1b-production-readonly.mjs",
    "scripts/apply-phase1b-production-sql.mjs",
    "scripts/verify-phase1b-production-smoke.mjs",
  ];
  for (const rel of scripts) {
    const text = fs.readFileSync(path.resolve(rel), "utf8");
    const mainStart = text.indexOf("async function main()");
    if (mainStart >= 0) {
      const mainText = text.slice(mainStart);
      const guardCall = mainText.indexOf("assertPhase7ExecutionAuthority(");
      assert.ok(guardCall >= 0, `${rel} has guard call inside main()`);
      const tokenRef = mainText.search(/SUPABASE_ACCESS_TOKEN|executeProductionSql\(|executeProductionSelect\(|managementSql\(/);
      assert.ok(tokenRef > guardCall, `${rel} performs token/network operations only after local guard`);
      continue;
    }

    const guardCall = text.indexOf("assertPhase7ExecutionAuthority(");
    assert.ok(guardCall >= 0, `${rel} has top-level guard call`);
    const tokenRef = text.search(/SUPABASE_ACCESS_TOKEN|fetch\(/);
    assert.ok(tokenRef > guardCall, `${rel} performs token/network operations only after top-level guard`);
  }
});

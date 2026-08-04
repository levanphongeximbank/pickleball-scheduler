import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

import {
  assertPhase7ExecutionAuthority,
  verifyManifestEntries,
  PHASE7_CERTIFIED_CONSTANTS,
} from "../scripts/phase7-execution-authority.mjs";

function run(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: "utf8" }).trim();
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

function digest(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

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
    const full = path.join(root, "docs/v7/production-execution", name);
    return `${digest(full)}  docs/v7/production-execution/${name}`;
  });
  write(root, "docs/v7/production-execution/MANIFEST.sha256", `${lines.join("\n")}\n`);
  return digest(path.join(root, "docs/v7/production-execution/MANIFEST.sha256"));
}

function setupRepoFixture(t) {
  const srcRoot = path.resolve(".");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase7-guard-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  run("git init", root);
  run('git config user.email "phase7@test.local"', root);
  run('git config user.name "phase7-test"', root);

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

  const manifestDigest = makeManifest(root);

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
  write(root, ".env.phase7-production.local", "DUMMY_TOKEN=fake\n");

  run("git add .", root);
  run('git commit -m "fixture"', root);
  const packageSourceCommit = run("git rev-parse HEAD", root);

  // Set remote and origin/main to current commit for guard checks.
  run(`git remote add origin ${root}`, root);
  run("git update-ref refs/remotes/origin/main HEAD", root);

  const authority = {
    approvedExecutionHead: packageSourceCommit,
    packageSourceCommit,
    packageVersion: PHASE7_CERTIFIED_CONSTANTS.packageVersion,
    packageManifestDigest: manifestDigest,
    targetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
    ledgerStepCount: PHASE7_CERTIFIED_CONSTANTS.ledgerStepCount,
    issuedAt: "2026-08-04T00:00:00.000Z",
    executionWindow: { start: "2026-08-05T00:00:00.000Z", end: "2026-08-05T02:00:00.000Z" },
    ownerAuthorizationMarker: "OWNER_GO_20260805_PHASE7",
    productionGo: "YES",
  };
  write(root, "phase7.execution-authority.local.json", JSON.stringify(authority, null, 2));

  return { root, manifestDigest, packageSourceCommit };
}

test("accepts fresh post-merge execution head when explicitly approved", (t) => {
  const { root, packageSourceCommit, manifestDigest } = setupRepoFixture(t);
  const result = assertPhase7ExecutionAuthority({
    rootDir: root,
    authorityFilePath: "phase7.execution-authority.local.json",
    runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
    credentialFilePath: ".env.phase7-production.local",
    expected: {
      ...PHASE7_CERTIFIED_CONSTANTS,
      packageSourceCommit,
      packageManifestDigest: manifestDigest,
    },
  });
  assert.equal(result.originMain, result.authority.approvedExecutionHead);
  assert.equal(result.headSha, result.authority.approvedExecutionHead);
});

test("requires package source commit to be ancestor", (t) => {
  const { root, manifestDigest } = setupRepoFixture(t);
  const authorityPath = path.join(root, "phase7.execution-authority.local.json");
  const a = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  a.packageSourceCommit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  fs.writeFileSync(authorityPath, JSON.stringify(a, null, 2));
  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: {
        ...PHASE7_CERTIFIED_CONSTANTS,
        packageSourceCommit: a.packageSourceCommit,
        packageManifestDigest: manifestDigest,
      },
    });
  }, /not ancestor|merge-base|mismatch/i);
});

test("aborts on wrong execution head", (t) => {
  const { root, packageSourceCommit, manifestDigest } = setupRepoFixture(t);
  const authorityPath = path.join(root, "phase7.execution-authority.local.json");
  const a = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  a.approvedExecutionHead = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  fs.writeFileSync(authorityPath, JSON.stringify(a, null, 2));

  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: {
        ...PHASE7_CERTIFIED_CONSTANTS,
        packageSourceCommit,
        packageManifestDigest: manifestDigest,
      },
    });
  }, /origin\/main mismatch|HEAD mismatch/i);
});

test("aborts on wrong target", (t) => {
  const { root, packageSourceCommit, manifestDigest } = setupRepoFixture(t);
  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: "wrong-target-ref",
      credentialFilePath: ".env.phase7-production.local",
      expected: {
        ...PHASE7_CERTIFIED_CONSTANTS,
        packageSourceCommit,
        packageManifestDigest: manifestDigest,
      },
    });
  }, /target mismatch/i);
});

test("aborts on wrong manifest digest", (t) => {
  const { root, packageSourceCommit } = setupRepoFixture(t);
  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: {
        ...PHASE7_CERTIFIED_CONSTANTS,
        packageSourceCommit,
        packageManifestDigest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    });
  }, /manifest digest mismatch/i);
});

test("aborts when Owner authorization is missing", (t) => {
  const { root } = setupRepoFixture(t);
  const authorityPath = path.join(root, "phase7.execution-authority.local.json");
  const a = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  a.ownerAuthorizationMarker = "";
  a.productionGo = "NO";
  fs.writeFileSync(authorityPath, JSON.stringify(a, null, 2));

  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: {
        ...PHASE7_CERTIFIED_CONSTANTS,
        packageSourceCommit: a.packageSourceCommit,
        packageManifestDigest: a.packageManifestDigest,
      },
    });
  }, /Production GO is not active|ownerAuthorizationMarker/i);
});

test("stale pre-merge SHA cannot act as approved execution head", (t) => {
  const { root } = setupRepoFixture(t);
  const authorityPath = path.join(root, "phase7.execution-authority.local.json");
  const a = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  a.approvedExecutionHead = "bd08d448e3c207ac6d5871a734c346f6bb290c40";
  fs.writeFileSync(authorityPath, JSON.stringify(a, null, 2));

  assert.throws(() => {
    assertPhase7ExecutionAuthority({
      rootDir: root,
      authorityFilePath: "phase7.execution-authority.local.json",
      runtimeTargetProjectRef: PHASE7_CERTIFIED_CONSTANTS.targetProjectRef,
      credentialFilePath: ".env.phase7-production.local",
      expected: {
        ...PHASE7_CERTIFIED_CONSTANTS,
        packageSourceCommit: a.packageSourceCommit,
        packageManifestDigest: a.packageManifestDigest,
      },
    });
  }, /origin\/main mismatch|HEAD mismatch/i);
});

test("manifest verifier reports mismatch count", (t) => {
  const { root } = setupRepoFixture(t);
  const authorityFile = path.join(root, "docs/v7/production-execution/00_PRODUCTION_EXECUTION_AUTHORITY.md");
  fs.appendFileSync(authorityFile, "\nmutation for test\n");
  const check = verifyManifestEntries(root);
  assert.ok(check.mismatches.length > 0);
});

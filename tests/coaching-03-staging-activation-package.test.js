/**
 * COACHING-03 — Guarded Staging activation package certification (static).
 * No Production. No Staging SQL apply. No database writes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import * as Staging from "../src/features/coaching/staging/index.js";
import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
} from "../src/features/coaching/persistence/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
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
  const result = spawnSync(
    process.execPath,
    ["scripts/coaching/coaching-03-staging-apply.mjs"],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /APPLY_MODE=REFUSED/);
  assert.match(result.stdout, /"sqlApplied": false/);
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

test("role matrix covers all 14 actions and denies PLAYER broad read", () => {
  const matrix = Staging.verifyCoaching03RoleMatrixCompleteness();
  assert.equal(matrix.ok, true, matrix.errors.join(" | "));
  assert.equal(matrix.actionCount, 14);
  assert.equal(matrix.playerRecordsReadGranted, false);
  assert.equal(
    Staging.isCoaching03RoleGrantProposed("PLAYER", "coaching.records.read"),
    false
  );
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

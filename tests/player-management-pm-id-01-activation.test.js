/**
 * PM-ID-01 — Guarded Staging activation package tests.
 * No Staging SQL apply. No database writes. No file deletion.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import * as Act from "../scripts/player-management/pm-id-01-activation-lib.mjs";
import { PICK_VN_STAGING_EVIDENCE_DIR_ENV } from "../scripts/shared/resolve-staging-evidence-dir.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function headSha() {
  return Act.getPmId01HeadSha(root);
}

function withTempEvidenceDir(fn) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "pm-id-01-evidence-"));
  try {
    return fn(tempDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("activation package docs and runners exist", () => {
  const required = [
    "docs/player-management/pm-id-01/activation/00_PM_ID_01_ACTIVATION_RUNBOOK.md",
    "docs/player-management/pm-id-01/activation/01_PM_ID_01_EXACT_COMMIT_GUARD.md",
    "docs/player-management/pm-id-01/activation/02_PM_ID_01_APPLY_AND_ROLLBACK_PLAN.md",
    "docs/player-management/pm-id-01/activation/03_PM_ID_01_FAILURE_CLASSIFICATION.md",
    "docs/player-management/pm-id-01/activation/sql-migration-manifest.json",
    "docs/player-management/pm-id-01/activation/OWNER_STAGING_APPLY_APPROVAL.template.json",
    "docs/player-management/pm-id-01/activation/evidence/schemas/APPLY_REFUSED.schema.json",
    "docs/player-management/pm-id-01/activation/evidence/schemas/PREFLIGHT_READONLY.schema.json",
    "docs/player-management/pm-id-01/activation/evidence/schemas/APPLY_SUCCESS.schema.json",
    "scripts/player-management/pm-id-01-activation-lib.mjs",
    "scripts/player-management/pm-id-01-staging-apply.mjs",
    "scripts/player-management/pm-id-01-activation-preflight.mjs",
  ];
  for (const rel of required) {
    assert.equal(existsSync(path.join(root, rel)), true, `missing ${rel}`);
  }
});

test("manifest contains exact forward SQL order; rollback excluded from forward", () => {
  const verify = Act.verifyPmId01MigrationManifest({ repoRoot: root });
  assert.equal(verify.ok, true, (verify.errors || []).join(" | "));
  assert.equal(verify.checked, 7);

  const manifest = Act.loadPmId01MigrationManifest(root);
  assert.equal(manifest.environmentTarget, "staging");
  assert.equal(manifest.stagingProjectRef, "qyewbxjsiiyufanzcjcq");
  assert.equal(manifest.productionApplyApproved, false);
  assert.equal(manifest.executeSql, false);
  assert.equal(manifest.automaticRollback, false);
  assert.equal(manifest.backfillIncluded, false);
  assert.equal(manifest.hashAlgorithm, Act.PM_ID_01_MANIFEST_HASH_ALGORITHM);

  const forward = manifest.migrations.filter((m) => m.classification === "forward");
  assert.equal(forward.length, 5);
  for (let i = 0; i < Act.PM_ID_01_FORWARD_SQL_ORDER.length; i += 1) {
    assert.equal(
      String(forward[i].path).replace(/\\/g, "/"),
      Act.PM_ID_01_FORWARD_SQL_ORDER[i]
    );
  }

  const rollback = manifest.migrations.find((m) => m.classification === "rollback");
  assert.ok(rollback);
  assert.equal(rollback.autoExecute, false);
  assert.equal(
    forward.some((f) => f.path === rollback.path),
    false
  );
  assert.ok(
    !Act.PM_ID_01_APPLY_EXECUTION_ORDER.includes(Act.PM_ID_01_ROLLBACK_SQL_PATH)
  );

  assert.equal(
    verify.combinedManifestHash,
    "d956334b2d04af2a08851ba253874b63bf7d9d27240e7df10456817f1e8852a1"
  );
  assert.equal(
    verify.aggregateSha256Forward,
    "a19c76fd748e537fd0b98b38f02c50f3421a23f6604eedfb2a8771d494cf32a1"
  );
});

test("hashes are deterministic and drift is refused", () => {
  const manifest = Act.loadPmId01MigrationManifest(root);
  const a = Act.verifyPmId01MigrationManifest({ repoRoot: root, manifest });
  const b = Act.verifyPmId01MigrationManifest({ repoRoot: root, manifest });
  assert.equal(a.ok, true);
  assert.equal(a.combinedManifestHash, b.combinedManifestHash);

  const drifted = structuredClone(manifest);
  drifted.migrations[0].sha256 = "0".repeat(64);
  const bad = Act.verifyPmId01MigrationManifest({
    repoRoot: root,
    manifest: drifted,
  });
  assert.equal(bad.ok, false);
  assert.ok((bad.errors || []).some((e) => /SHA-256 mismatch/i.test(e)));
});

test("canonical SQL audit: additive, no backfill apply, no auth.uid=player_id", () => {
  const audit = Act.auditPmId01CanonicalSqlPackage(root);
  assert.equal(audit.ok, true, (audit.defects || []).join(" | "));
  assert.equal(audit.rollbackExcludedFromForward, true);
  assert.equal(audit.productionTargetReferenced, false);

  const helpers = read(
    "docs/player-management/pm-id-01/30_PM_ID_01_RESOLUTION_HELPERS.sql"
  );
  assert.match(helpers, /v_uid uuid := auth\.uid\(\)/);
  assert.doesNotMatch(
    helpers,
    /auth\.uid\(\)\s*=\s*player_id|player_id\s*=\s*auth\.uid\(\)/i
  );

  const rls = read("docs/player-management/pm-id-01/50_PM_ID_01_RLS_AND_GRANTS.sql");
  assert.match(rls, /ENABLE ROW LEVEL SECURITY/);
  assert.match(rls, /FORCE ROW LEVEL SECURITY/);
  assert.match(rls, /REVOKE ALL[\s\S]*FROM PUBLIC/);
  assert.match(rls, /FROM anon/);
});

test("approval template defaults deny apply", () => {
  const approval = Act.loadPmId01ApprovalTemplateDefaults(root);
  assert.equal(approval.ok, true, (approval.errors || []).join(" | "));
  assert.equal(approval.defaults.approved, false);
  assert.equal(approval.defaults.productionAllowed, false);
  assert.equal(approval.defaults.goToken, Act.PM_ID_01_OWNER_GO_TOKEN);
  assert.equal(approval.defaults.backfillApproved, false);
  assert.equal(approval.defaults.mappingRowsCreationApproved, false);
});

test("dirty tree refused", () => {
  const gates = Act.evaluatePmId01ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Act.PM_ID_01_STAGING_PROJECT_REF,
    expectedCommit: headSha(),
    ownerApprovedCommit: headSha(),
    ownerGoToken: Act.PM_ID_01_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: true,
    worktreeCleanOverride: false,
    requireApprovalEvidence: false,
    env: {
      STAGING_SUPABASE_URL: `https://${Act.PM_ID_01_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(gates.canWrite, false);
  assert.ok(gates.blockers.some((b) => /clean/i.test(b)));
  assert.equal(gates.databaseConnectionOpened, false);
});

test("short SHA refused", () => {
  const short = headSha().slice(0, 7);
  const gates = Act.evaluatePmId01ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Act.PM_ID_01_STAGING_PROJECT_REF,
    expectedCommit: short,
    ownerApprovedCommit: headSha(),
    ownerGoToken: Act.PM_ID_01_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    requireApprovalEvidence: false,
    env: {
      STAGING_SUPABASE_URL: `https://${Act.PM_ID_01_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(gates.canWrite, false);
  assert.equal(
    gates.verdict,
    Act.PM_ID_01_VERDICTS.EXECUTION_COMMIT_MISMATCH_REFUSED
  );
});

test("branch name refused", () => {
  const gates = Act.evaluatePmId01ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Act.PM_ID_01_STAGING_PROJECT_REF,
    expectedCommit: "feature/pm-id-01-staging-activation",
    ownerApprovedCommit: headSha(),
    ownerGoToken: Act.PM_ID_01_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    requireApprovalEvidence: false,
    env: {
      STAGING_SUPABASE_URL: `https://${Act.PM_ID_01_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(gates.canWrite, false);
  assert.ok(gates.commitMismatchReasons.some((r) => /branch/i.test(r)));
});

test("current HEAD mismatch refused", () => {
  const other = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const gates = Act.evaluatePmId01ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Act.PM_ID_01_STAGING_PROJECT_REF,
    expectedCommit: other,
    ownerApprovedCommit: other,
    ownerGoToken: Act.PM_ID_01_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    requireApprovalEvidence: false,
    actualGitHead: headSha(),
    env: {
      STAGING_SUPABASE_URL: `https://${Act.PM_ID_01_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(gates.canWrite, false);
  assert.equal(
    gates.verdict,
    Act.PM_ID_01_VERDICTS.EXECUTION_COMMIT_MISMATCH_REFUSED
  );
});

test("ancestor-only approval refused", () => {
  const head = headSha();
  const parent = spawnSync("git", ["rev-parse", "HEAD^"], {
    cwd: root,
    encoding: "utf8",
  })
    .stdout.trim();
  assert.ok(Act.isPmId01FullGitSha(parent));
  assert.notEqual(parent.toLowerCase(), head.toLowerCase());
  assert.equal(Act.isPmId01GitAncestor(parent, head, root), true);

  const gates = Act.evaluatePmId01ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Act.PM_ID_01_STAGING_PROJECT_REF,
    expectedCommit: head,
    ownerApprovedCommit: parent,
    ownerGoToken: Act.PM_ID_01_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    requireApprovalEvidence: false,
    actualGitHead: head,
    env: {
      STAGING_SUPABASE_URL: `https://${Act.PM_ID_01_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(gates.canWrite, false);
  assert.ok(
    gates.commitMismatchReasons.some((r) => /ancestor-only/i.test(r))
  );
});

test("missing Owner GO refused with classification", () => {
  const gates = Act.evaluatePmId01ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Act.PM_ID_01_STAGING_PROJECT_REF,
    expectedCommit: headSha(),
    ownerApprovedCommit: headSha(),
    ownerGoToken: "",
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    requireApprovalEvidence: false,
    env: {
      STAGING_SUPABASE_URL: `https://${Act.PM_ID_01_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(gates.canWrite, false);
  assert.equal(gates.ownerGoGranted, false);
  assert.equal(
    gates.verdict,
    Act.PM_ID_01_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED
  );
  assert.equal(gates.databaseConnectionOpened, false);
});

test("wrong token refused", () => {
  const gates = Act.evaluatePmId01ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Act.PM_ID_01_STAGING_PROJECT_REF,
    expectedCommit: headSha(),
    ownerApprovedCommit: headSha(),
    ownerGoToken: "WRONG_TOKEN",
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    requireApprovalEvidence: false,
    env: {
      STAGING_SUPABASE_URL: `https://${Act.PM_ID_01_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(gates.canWrite, false);
  assert.equal(gates.ownerGoGranted, false);
  assert.equal(
    gates.verdict,
    Act.PM_ID_01_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED
  );
});

test("wrong Staging ref refused", () => {
  const gates = Act.evaluatePmId01ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: "aaaaaaaaaaaaaaaaaaaa",
    expectedCommit: headSha(),
    ownerApprovedCommit: headSha(),
    ownerGoToken: Act.PM_ID_01_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    requireApprovalEvidence: false,
    env: {},
  });
  assert.equal(gates.canWrite, false);
});

test("Production ref refused", () => {
  const prod = Act.PM_ID_01_PRODUCTION_PROJECT_REF_BLOCKLIST[0];
  const gates = Act.evaluatePmId01ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: prod,
    expectedCommit: headSha(),
    ownerApprovedCommit: headSha(),
    ownerGoToken: Act.PM_ID_01_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    requireApprovalEvidence: false,
    env: {
      STAGING_SUPABASE_URL: `https://${prod}.supabase.co`,
    },
  });
  assert.equal(gates.canWrite, false);
  assert.ok(
    gates.blockers.some(
      (b) => /Production/i.test(b) || /Exact Staging/i.test(b)
    )
  );
  assert.equal(gates.productionTouched, false);
});

test("SQL hash drift refused by guard", () => {
  const manifest = Act.loadPmId01MigrationManifest(root);
  const drifted = structuredClone(manifest);
  drifted.migrations[0].sha256 = "0".repeat(64);
  const gates = Act.evaluatePmId01ApplyGuards({
    execute: true,
    environment: "staging",
    projectRef: Act.PM_ID_01_STAGING_PROJECT_REF,
    expectedCommit: headSha(),
    ownerApprovedCommit: headSha(),
    ownerGoToken: Act.PM_ID_01_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    requireApprovalEvidence: false,
    manifest: drifted,
    env: {
      STAGING_SUPABASE_URL: `https://${Act.PM_ID_01_STAGING_PROJECT_REF}.supabase.co`,
    },
  });
  assert.equal(gates.canWrite, false);
  assert.ok(gates.blockers.some((b) => /checksum|manifest|SHA-256/i.test(b)));
});

test("no-GO refusal before database connection via apply runner", () => {
  withTempEvidenceDir((tempDir) => {
    const tracked = path.join(
      root,
      Act.PM_ID_01_EVIDENCE_DIR,
      "APPLY_REFUSED_NO_GO.json"
    );
    const trackedBefore = existsSync(tracked) ? readFileSync(tracked) : null;

    const result = spawnSync(
      process.execPath,
      ["scripts/player-management/pm-id-01-staging-apply.mjs"],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          [PICK_VN_STAGING_EVIDENCE_DIR_ENV]: tempDir,
        },
      }
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /APPLY_MODE=REFUSED/);
    assert.match(
      result.stdout,
      /PM_ID_01_APPLY_REFUSED_OWNER_GO_NOT_GRANTED/
    );

    const evidencePath = path.join(tempDir, "APPLY_REFUSED_NO_GO.json");
    assert.equal(existsSync(evidencePath), true);
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    assert.equal(evidence.ownerGoGranted, false);
    assert.equal(evidence.databaseConnectionOpened, false);
    assert.equal(evidence.databaseWrites, 0);
    assert.equal(evidence.sqlApplied, false);
    assert.equal(evidence.mappingRowsCreated, 0);
    assert.equal(evidence.backfillExecuted, false);
    assert.equal(evidence.roleGrantsApplied, false);
    assert.equal(evidence.productionTouched, false);
    assert.equal(evidence.filesDeleted, false);
    assert.equal(evidence.CODEX_DELETE_ALLOWED, "NO");
    assert.equal(evidence.automaticRollback, false);

    const trackedAfter = existsSync(tracked) ? readFileSync(tracked) : null;
    assert.deepEqual(trackedAfter, trackedBefore);

    // Must not touch Coaching-03 APPLY_REFUSED.json
    const coachingRefused = path.join(
      root,
      "docs/coaching-training/coaching-03/evidence/APPLY_REFUSED.json"
    );
    if (existsSync(coachingRefused)) {
      const before = readFileSync(coachingRefused, "utf8");
      assert.match(before, /COACHING_03/);
      assert.doesNotMatch(before, /PM_ID_01_APPLY_REFUSED_OWNER_GO_NOT_GRANTED/);
    }
  });
});

test("no backfill / no mapping creation / no auto rollback / no auto-apply in package scripts", () => {
  const applySrc = read("scripts/player-management/pm-id-01-staging-apply.mjs");
  const libSrc = read("scripts/player-management/pm-id-01-activation-lib.mjs");
  const pkg = read("package.json");
  const manifest = Act.loadPmId01MigrationManifest(root);

  assert.equal(manifest.backfillIncluded, false);
  assert.equal(manifest.automaticRollback, false);
  assert.equal(manifest.executeSql, false);
  assert.match(applySrc, /Never runs rollback automatically|automaticRollback: false/);
  assert.match(libSrc, /backfillIncluded/);
  assert.doesNotMatch(pkg, /pm-id-01-staging-apply\.mjs/);
  assert.doesNotMatch(
    applySrc,
    /player_identity_admin_upsert_link\(/
  );
  assert.equal(manifest.mappingRowsCreated, false);
});

test("no file deletion APIs in activation runners", () => {
  const applySrc = read("scripts/player-management/pm-id-01-staging-apply.mjs");
  const preflightSrc = read(
    "scripts/player-management/pm-id-01-activation-preflight.mjs"
  );
  for (const src of [applySrc, preflightSrc]) {
    assert.doesNotMatch(src, /\bunlinkSync\b|\brmSync\b|\brmdirSync\b/);
    assert.doesNotMatch(src, /Remove-Item|git clean|git rm/);
    assert.match(src, /CODEX_DELETE_ALLOWED/);
  }
});

test("apply plan docs stop before Coaching and forbid Production", () => {
  const plan = read(
    "docs/player-management/pm-id-01/activation/02_PM_ID_01_APPLY_AND_ROLLBACK_PLAN.md"
  );
  assert.match(plan, /Stop before any Coaching changes/i);
  assert.match(plan, /No automatic rollback/i);
  assert.match(plan, /Change Production/i);
  assert.match(plan, /Do \*\*not\*\* run backfill/i);
});

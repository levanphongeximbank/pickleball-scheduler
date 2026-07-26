/**
 * COACHING-04 — Guarded Staging activation package tests.
 * No Staging SQL apply. No database writes. No file deletion.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import * as Act from "../scripts/coaching/coaching-04-activation-lib.mjs";
import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
} from "../src/features/coaching/runtime/constants.js";
import { PICK_VN_STAGING_EVIDENCE_DIR_ENV } from "../scripts/shared/resolve-staging-evidence-dir.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function headSha() {
  return Act.getCoaching04HeadSha(root);
}

function withTempEvidenceDir(fn) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "coaching04-evidence-"));
  try {
    return fn(tempDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function stagingEnv() {
  return {
    STAGING_SUPABASE_URL: `https://${Act.COACHING_04_STAGING_PROJECT_REF}.supabase.co`,
  };
}

function baseGateInput(overrides = {}) {
  return {
    execute: true,
    environment: "staging",
    projectRef: Act.COACHING_04_STAGING_PROJECT_REF,
    expectedCommit: headSha(),
    ownerApprovedCommit: headSha(),
    expectedManifestHash: Act.COACHING_04_PINNED_COMBINED_MANIFEST_HASH,
    expectedAggregateSqlHash: Act.COACHING_04_PINNED_AGGREGATE_SHA256_FORWARD,
    ownerGoToken: Act.COACHING_04_OWNER_GO_TOKEN,
    preflightPass: true,
    productionAllowed: false,
    repoRoot: root,
    requireCleanWorktree: false,
    requireApprovalEvidence: false,
    env: stagingEnv(),
    ...overrides,
  };
}

test("activation package docs and runners exist", () => {
  const required = [
    "docs/coaching-training/coaching-04/activation/00_COACHING_04_ACTIVATION_RUNBOOK.md",
    "docs/coaching-training/coaching-04/activation/01_COACHING_04_EXACT_COMMIT_GUARD.md",
    "docs/coaching-training/coaching-04/activation/02_COACHING_04_APPLY_AND_ROLLBACK_PLAN.md",
    "docs/coaching-training/coaching-04/activation/03_COACHING_04_FAILURE_CLASSIFICATION.md",
    "docs/coaching-training/coaching-04/sql-migration-manifest.json",
    "docs/coaching-training/coaching-04/activation/OWNER_STAGING_APPLY_APPROVAL.template.json",
    "scripts/coaching/coaching-04-activation-lib.mjs",
    "scripts/coaching/coaching-04-staging-apply.mjs",
    "scripts/coaching/coaching-04-activation-preflight.mjs",
  ];
  for (const rel of required) {
    assert.equal(existsSync(path.join(root, rel)), true, `missing ${rel}`);
  }
});

test("manifest contains exact forward SQL order; rollback excluded from forward", () => {
  const verify = Act.verifyCoaching04MigrationManifest({ repoRoot: root });
  assert.equal(verify.ok, true, (verify.errors || []).join(" | "));
  assert.equal(verify.checked, 8);

  const manifest = Act.loadCoaching04MigrationManifest(root);
  assert.equal(manifest.environmentTarget, "staging");
  assert.equal(manifest.stagingProjectRef, "qyewbxjsiiyufanzcjcq");
  assert.equal(manifest.productionApplyApproved, false);
  assert.equal(manifest.executeSql, false);
  assert.equal(manifest.automaticRollback, false);
  assert.equal(manifest.backfillIncluded, false);
  assert.equal(manifest.mappingRowsCreated, false);
  assert.equal(manifest.durableRuntimeDefault, false);
  assert.equal(manifest.localStorageRetired, false);
  assert.equal(manifest.hashAlgorithm, Act.COACHING_04_MANIFEST_HASH_ALGORITHM);
  assert.equal(
    manifest.ownerGoTokenRequired,
    Act.COACHING_04_OWNER_GO_TOKEN
  );

  const forward = manifest.migrations.filter((m) => m.classification === "forward");
  assert.equal(forward.length, 6);
  const expectedOrders = [10, 11, 20, 21, 30, 40];
  for (let i = 0; i < Act.COACHING_04_FORWARD_SQL_ORDER.length; i += 1) {
    assert.equal(
      String(forward[i].path).replace(/\\/g, "/"),
      Act.COACHING_04_FORWARD_SQL_ORDER[i]
    );
    assert.equal(Number(forward[i].order), expectedOrders[i]);
  }

  const rollback = manifest.migrations.find((m) => m.classification === "rollback");
  assert.ok(rollback);
  assert.equal(rollback.autoExecute, false);
  assert.equal(
    forward.some((f) => f.path === rollback.path),
    false
  );
  assert.ok(
    !Act.COACHING_04_APPLY_EXECUTION_ORDER.includes(Act.COACHING_04_ROLLBACK_SQL_PATH)
  );
  assert.equal(
    Act.COACHING_04_APPLY_EXECUTION_ORDER.at(-1),
    Act.COACHING_04_VERIFICATION_SQL_PATH
  );

  assert.equal(
    verify.combinedManifestHash,
    Act.COACHING_04_PINNED_COMBINED_MANIFEST_HASH
  );
  assert.equal(
    verify.aggregateSha256Forward,
    Act.COACHING_04_PINNED_AGGREGATE_SHA256_FORWARD
  );
});

test("hashes are deterministic and drift is refused", () => {
  const manifest = Act.loadCoaching04MigrationManifest(root);
  const a = Act.verifyCoaching04MigrationManifest({ repoRoot: root, manifest });
  const b = Act.verifyCoaching04MigrationManifest({ repoRoot: root, manifest });
  assert.equal(a.ok, true);
  assert.equal(a.combinedManifestHash, b.combinedManifestHash);

  const drifted = structuredClone(manifest);
  drifted.migrations[0].sha256 = "0".repeat(64);
  const bad = Act.verifyCoaching04MigrationManifest({
    repoRoot: root,
    manifest: drifted,
  });
  assert.equal(bad.ok, false);
  assert.ok((bad.errors || []).some((e) => /SHA-256 mismatch/i.test(e)));
});

test("order mismatch refuses", () => {
  const manifest = Act.loadCoaching04MigrationManifest(root);
  const swapped = structuredClone(manifest);
  const forward = swapped.migrations.filter((m) => m.classification === "forward");
  const tmp = forward[0].path;
  forward[0].path = forward[1].path;
  forward[1].path = tmp;
  swapped.forwardExecutionOrder = [
    forward[0].path,
    forward[1].path,
    ...Act.COACHING_04_FORWARD_SQL_ORDER.slice(2),
  ];
  const gates = Act.evaluateCoaching04ApplyGuards(
    baseGateInput({
      manifest: swapped,
    })
  );
  assert.equal(gates.canWrite, false);
  assert.ok(
    gates.blockers.some((b) => /order|checksum|manifest/i.test(b))
  );
});

test("canonical SQL audit: additive, no backfill, no auth.uid=player_id", () => {
  const audit = Act.auditCoaching04CanonicalSqlPackage(root);
  assert.equal(audit.ok, true, (audit.defects || []).join(" | "));
  assert.equal(audit.rollbackExcludedFromForward, true);
  assert.equal(audit.verificationAfterForwardOnly, true);
  assert.equal(audit.productionTargetReferenced, false);
  assert.equal(audit.mappingRowsCreated, false);
  assert.equal(audit.backfillIncluded, false);

  const helpers = read(
    "docs/coaching-training/coaching-04/11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql"
  );
  assert.match(helpers, /player_identity_resolve_mapping/);
  assert.doesNotMatch(
    helpers,
    /auth\.uid\(\)\s*=\s*player_id|player_id\s*=\s*auth\.uid\(\)/i
  );
});

test("approval template defaults deny apply", () => {
  const approval = Act.loadCoaching04ApprovalTemplateDefaults(root);
  assert.equal(approval.ok, true, (approval.errors || []).join(" | "));
  assert.equal(approval.defaults.approved, false);
  assert.equal(approval.defaults.productionAllowed, false);
  assert.equal(approval.defaults.goToken, Act.COACHING_04_OWNER_GO_TOKEN);
  assert.equal(approval.defaults.backfillApproved, false);
  assert.equal(approval.defaults.mappingRowsCreationApproved, false);
  assert.equal(approval.defaults.durableRuntimeActivationApproved, false);
  assert.equal(approval.defaults.localStorageRetirementApproved, false);
  assert.equal(approval.defaults.automaticRollbackApproved, false);
  assert.equal(approval.defaults.automaticRetryApproved, false);
});

test("no GO refuses", () => {
  const gates = Act.evaluateCoaching04ApplyGuards(
    baseGateInput({ ownerGoToken: "" })
  );
  assert.equal(gates.canWrite, false);
  assert.equal(gates.ownerGoGranted, false);
  assert.equal(
    gates.verdict,
    Act.COACHING_04_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED
  );
  assert.equal(gates.databaseConnectionOpened, false);
  assert.equal(gates.databaseWrites, 0);
  assert.equal(gates.sqlApplied, false);
});

test("wrong token refuses", () => {
  const gates = Act.evaluateCoaching04ApplyGuards(
    baseGateInput({ ownerGoToken: "WRONG_TOKEN" })
  );
  assert.equal(gates.canWrite, false);
  assert.equal(
    gates.verdict,
    Act.COACHING_04_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED
  );
});

test("wrong project refuses", () => {
  const gates = Act.evaluateCoaching04ApplyGuards(
    baseGateInput({ projectRef: "aaaaaaaaaaaaaaaaaaaa", env: {} })
  );
  assert.equal(gates.canWrite, false);
  assert.ok(
    gates.verdict === Act.COACHING_04_VERDICTS.WRONG_TARGET_REFUSED ||
      gates.blockers.some((b) => /Exact Staging/i.test(b))
  );
});

test("Production refuses", () => {
  const prod = Act.COACHING_04_PRODUCTION_PROJECT_REF_BLOCKLIST[0];
  const gates = Act.evaluateCoaching04ApplyGuards(
    baseGateInput({
      projectRef: prod,
      env: { STAGING_SUPABASE_URL: `https://${prod}.supabase.co` },
    })
  );
  assert.equal(gates.canWrite, false);
  assert.equal(gates.productionTouched, false);
  assert.ok(
    gates.verdict === Act.COACHING_04_VERDICTS.PRODUCTION_TARGET_REFUSED ||
      gates.blockers.some((b) => /Production/i.test(b))
  );
});

test("wrong execution commit refuses", () => {
  const other = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const gates = Act.evaluateCoaching04ApplyGuards(
    baseGateInput({
      expectedCommit: other,
      ownerApprovedCommit: other,
      actualGitHead: headSha(),
    })
  );
  assert.equal(gates.canWrite, false);
  assert.equal(
    gates.verdict,
    Act.COACHING_04_VERDICTS.EXECUTION_COMMIT_MISMATCH_REFUSED
  );
});

test("dirty worktree refuses", () => {
  const gates = Act.evaluateCoaching04ApplyGuards(
    baseGateInput({
      requireCleanWorktree: true,
      worktreeCleanOverride: false,
    })
  );
  assert.equal(gates.canWrite, false);
  assert.equal(
    gates.verdict,
    Act.COACHING_04_VERDICTS.DIRTY_WORKTREE_REFUSED
  );
  assert.equal(gates.databaseConnectionOpened, false);
});

test("manifest hash mismatch refuses", () => {
  const gates = Act.evaluateCoaching04ApplyGuards(
    baseGateInput({
      expectedManifestHash: "0".repeat(64),
    })
  );
  assert.equal(gates.canWrite, false);
  assert.equal(
    gates.verdict,
    Act.COACHING_04_VERDICTS.MANIFEST_HASH_MISMATCH_REFUSED
  );
});

test("SQL hash mismatch refuses", () => {
  const gates = Act.evaluateCoaching04ApplyGuards(
    baseGateInput({
      expectedAggregateSqlHash: "0".repeat(64),
    })
  );
  assert.equal(gates.canWrite, false);
  assert.equal(
    gates.verdict,
    Act.COACHING_04_VERDICTS.SQL_HASH_MISMATCH_REFUSED
  );
});

test("rollback excluded; verification only after forward; no auto-retry/rollback", () => {
  assert.ok(
    !Act.COACHING_04_APPLY_EXECUTION_ORDER.includes(
      Act.COACHING_04_ROLLBACK_SQL_PATH
    )
  );
  assert.equal(
    Act.COACHING_04_APPLY_EXECUTION_ORDER.at(-1),
    Act.COACHING_04_VERIFICATION_SQL_PATH
  );
  const gates = Act.evaluateCoaching04ApplyGuards(baseGateInput());
  // Without approval evidence, execute path still blocked — but markers remain safe.
  assert.equal(gates.automaticRetry, false);
  assert.equal(gates.automaticRollback, false);
  assert.equal(gates.verificationRunsOnlyAfterForwardSuccess, true);
  assert.equal(gates.rollbackExcludedFromForward, true);
  assert.equal(gates.mappingRowsCreated, 0);
  assert.equal(gates.backfillExecuted, false);
  assert.equal(gates.runtimeActivated, false);
  assert.equal(gates.localStorageRetired, false);

  const applySrc = read("scripts/coaching/coaching-04-staging-apply.mjs");
  assert.match(applySrc, /Never runs rollback automatically|automaticRollback: false/);
  assert.match(applySrc, /Verification runs only after all forward/);
  assert.doesNotMatch(applySrc, /for\s*\(.*retry|automaticRetry\s*=\s*true/);
});

test("no mapping-row creation / no backfill / no durable runtime / no localStorage retirement", () => {
  const manifest = Act.loadCoaching04MigrationManifest(root);
  assert.equal(manifest.mappingRowsCreated, false);
  assert.equal(manifest.backfillIncluded, false);
  assert.equal(manifest.durableRuntimeDefault, false);
  assert.equal(manifest.localStorageRetired, false);
  assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
  assert.equal(LOCALSTORAGE_RETIRED, false);

  const applySrc = read("scripts/coaching/coaching-04-staging-apply.mjs");
  assert.match(applySrc, /Never creates mapping rows/);
  assert.match(applySrc, /Never runs backfill/);
  assert.match(applySrc, /Never activates durable runtime/);
  assert.match(applySrc, /Never retires localStorage/);
  assert.doesNotMatch(applySrc, /player_identity_admin_upsert_link\(/);
});

test("no-GO refusal before database connection via apply runner", () => {
  withTempEvidenceDir((tempDir) => {
    const tracked = path.join(
      root,
      Act.COACHING_04_EVIDENCE_DIR,
      "APPLY_REFUSED_NO_GO.json"
    );
    const trackedBefore = existsSync(tracked) ? readFileSync(tracked) : null;

    const result = spawnSync(
      process.execPath,
      ["scripts/coaching/coaching-04-staging-apply.mjs"],
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
      /COACHING_04_APPLY_REFUSED_OWNER_GO_NOT_GRANTED/
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
    assert.equal(evidence.runtimeActivated, false);
    assert.equal(evidence.localStorageRetired, false);
    assert.equal(evidence.productionTouched, false);
    assert.equal(evidence.filesDeleted, false);
    assert.equal(evidence.automaticRetry, false);
    assert.equal(evidence.automaticRollback, false);
    assert.equal(evidence.CODEX_DELETE_ALLOWED, "NO");
    assert.equal(
      evidence.manifestHash,
      Act.COACHING_04_PINNED_COMBINED_MANIFEST_HASH
    );
    assert.equal(
      evidence.aggregateSqlHash,
      Act.COACHING_04_PINNED_AGGREGATE_SHA256_FORWARD
    );

    const trackedAfter = existsSync(tracked) ? readFileSync(tracked) : null;
    assert.deepEqual(trackedAfter, trackedBefore);
  });
});

test("no secret persisted in tracked activation artifacts", () => {
  const files = [
    "scripts/coaching/coaching-04-activation-lib.mjs",
    "scripts/coaching/coaching-04-staging-apply.mjs",
    "scripts/coaching/coaching-04-activation-preflight.mjs",
    "docs/coaching-training/coaching-04/activation/OWNER_STAGING_APPLY_APPROVAL.template.json",
    "docs/coaching-training/coaching-04/sql-migration-manifest.json",
  ];
  for (const rel of files) {
    const text = read(rel);
    assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{20,}\./);
    assert.doesNotMatch(text, /service_role|SUPABASE_ACCESS_TOKEN\s*=\s*\S+/i);
    assert.doesNotMatch(text, /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i);
  }
});

test("preparation safety markers remain closed", () => {
  assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
  assert.equal(LOCALSTORAGE_RETIRED, false);
  const gates = Act.evaluateCoaching04ApplyGuards(
    baseGateInput({ execute: false, ownerGoToken: "" })
  );
  assert.equal(gates.applyMode, "REFUSED");
  assert.equal(gates.databaseWrites, 0);
  assert.equal(gates.sqlApplied, false);
  assert.equal(gates.filesDeleted, false);
  assert.equal(gates.CODEX_DELETE_ALLOWED, "NO");
});

test("no file deletion APIs in activation runners", () => {
  const applySrc = read("scripts/coaching/coaching-04-staging-apply.mjs");
  const preflightSrc = read(
    "scripts/coaching/coaching-04-activation-preflight.mjs"
  );
  for (const src of [applySrc, preflightSrc]) {
    assert.doesNotMatch(src, /\bunlinkSync\b|\brmSync\b|\brmdirSync\b/);
    assert.doesNotMatch(src, /Remove-Item|git clean|git rm/);
    assert.match(src, /CODEX_DELETE_ALLOWED/);
  }
});

test("activation preflight offline PASS", () => {
  withTempEvidenceDir((tempDir) => {
    const result = spawnSync(
      process.execPath,
      ["scripts/coaching/coaching-04-activation-preflight.mjs"],
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
    const evidence = JSON.parse(
      readFileSync(
        path.join(tempDir, "ACTIVATION_PREFLIGHT_OFFLINE.json"),
        "utf8"
      )
    );
    assert.equal(evidence.ok, true);
    assert.equal(evidence.databaseWrites, 0);
    assert.equal(evidence.sqlApplied, false);
    assert.equal(evidence.productionTouched, false);
    assert.equal(
      evidence.combinedManifestHash,
      Act.COACHING_04_PINNED_COMBINED_MANIFEST_HASH
    );
  });
});

test("apply plan docs forbid Production / mapping / backfill / auto rollback", () => {
  const plan = read(
    "docs/coaching-training/coaching-04/activation/02_COACHING_04_APPLY_AND_ROLLBACK_PLAN.md"
  );
  assert.match(plan, /No automatic rollback/i);
  assert.match(plan, /No automatic retry/i);
  assert.match(plan, /\*\*Do not\*\* create mapping rows/i);
  assert.match(plan, /\*\*Do not\*\* run backfill/i);
  assert.match(plan, /Change Production/i);
  assert.match(plan, /durable runtime/i);
  assert.match(plan, /localStorage/i);
});

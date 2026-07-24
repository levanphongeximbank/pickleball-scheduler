/**
 * COMMS-ACT-01 — Staging activation readiness (static tests only).
 * Does not connect to Supabase. Does not apply SQL. Does not deploy.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMMS_ACT_01_ENV_NAMES,
  COMMS_ACT_01_EXPECTED_TABLE_COUNT,
  COMMS_ACT_01_VERDICTS,
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
  evaluateCommsAct01BackupGate,
  evaluateCommsAct01Preflight,
  evaluateCommsStagingTargetIdentity,
  extractSupabaseProjectRef,
  getCommsAct01RlsReadinessMatrix,
  loadCommsAct01SqlPackageManifest,
} from "../src/features/communication/activation/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(
  root,
  "docs/communication-foundation/activation/comms-act-01"
);

const REQUIRED_DOCS = [
  "01_STAGING_ACTIVATION_READINESS.md",
  "01_STAGING_PREFLIGHT_CHECKLIST.md",
  "01_STAGING_EVIDENCE_TEMPLATE.md",
  "01_RLS_READINESS_MATRIX.md",
  "01_REALTIME_READINESS_MATRIX.md",
  "01_BACKUP_GATE.md",
  "01_SMOKE_DIRECT.md",
  "01_SMOKE_CLUB.md",
  "01_SMOKE_COMMUNITY.md",
  "01_NEGATIVE_RLS_PACKAGE.md",
];

test("COMMS-ACT-01 activation docs exist", () => {
  for (const name of REQUIRED_DOCS) {
    assert.ok(fs.existsSync(path.join(docsDir, name)), name);
  }
  assert.ok(fs.existsSync(path.join(docsDir, "evidence", "README.md")));
});

test("COMMS-ACT-01 staging/production refs are distinct and extractable", () => {
  assert.notEqual(COMMS_STAGING_PROJECT_REF, COMMS_PRODUCTION_PROJECT_REF);
  assert.equal(
    extractSupabaseProjectRef(
      `https://${COMMS_STAGING_PROJECT_REF}.supabase.co`
    ),
    COMMS_STAGING_PROJECT_REF
  );
  const prod = evaluateCommsStagingTargetIdentity({
    environment: "staging",
    url: `https://${COMMS_PRODUCTION_PROJECT_REF}.supabase.co`,
  });
  assert.equal(prod.status, "FAIL");
  assert.ok(prod.findings.some((f) => f.code === "PRODUCTION_REF_DETECTED"));
});

test("COMMS-ACT-01 target confirm must match staging allowlist", () => {
  const bad = evaluateCommsStagingTargetIdentity({
    environment: "staging",
    url: `https://${COMMS_STAGING_PROJECT_REF}.supabase.co`,
    targetConfirm: COMMS_PRODUCTION_PROJECT_REF,
  });
  assert.equal(bad.status, "FAIL");
  const good = evaluateCommsStagingTargetIdentity({
    environment: "staging",
    url: `https://${COMMS_STAGING_PROJECT_REF}.supabase.co`,
    targetConfirm: COMMS_STAGING_PROJECT_REF,
  });
  assert.equal(good.status, "PASS");
});

test("COMMS-ACT-01 SQL package static inventory PASS", () => {
  const manifest = loadCommsAct01SqlPackageManifest({ repoRoot: root });
  assert.equal(manifest.status, "PASS");
  assert.equal(manifest.tablesFound.length, COMMS_ACT_01_EXPECTED_TABLE_COUNT);
  assert.equal(manifest.expectedTableCount, 14);
  assert.equal(manifest.realtimeInPackage, false);
  assert.ok(manifest.forwardSha256);
  assert.match(manifest.forwardSha256, /^[a-f0-9]{64}$/);
});

test("COMMS-ACT-01 offline preflight READY_FOR_OWNER_GO and refuses apply", () => {
  const ok = evaluateCommsAct01Preflight({
    repoRoot: root,
    mode: "offline",
    env: {},
  });
  assert.equal(ok.verdict, COMMS_ACT_01_VERDICTS.READY_FOR_OWNER_GO);
  assert.equal(ok.remoteApplyAllowed, false);
  assert.equal(ok.pass, true);

  const apply = evaluateCommsAct01Preflight({
    repoRoot: root,
    mode: "offline",
    applyRequested: true,
    env: {},
  });
  assert.equal(apply.verdict, COMMS_ACT_01_VERDICTS.BLOCKED_APPLY_REFUSED);
  assert.equal(apply.pass, false);
});

test("COMMS-ACT-01 live-gates block without owner/backup/target", () => {
  const blocked = evaluateCommsAct01Preflight({
    repoRoot: root,
    mode: "live-gates",
    env: {},
  });
  assert.ok(
    [
      COMMS_ACT_01_VERDICTS.BLOCKED_TARGET_IDENTITY,
      COMMS_ACT_01_VERDICTS.BLOCKED_BACKUP,
      COMMS_ACT_01_VERDICTS.BLOCKED_OWNER_GO,
    ].includes(blocked.verdict)
  );
  assert.equal(blocked.pass, false);
});

test("COMMS-ACT-01 backup gate requires token + evidence fields", () => {
  const missing = evaluateCommsAct01BackupGate({}, { repoRoot: root });
  assert.equal(missing.status, "FAIL");

  const evidencePath = path.join(docsDir, "01_BACKUP_GATE.md");
  const withPathOnly = evaluateCommsAct01BackupGate(
    {
      [COMMS_ACT_01_ENV_NAMES.BACKUP_EVIDENCE_PATH]: path.relative(
        root,
        evidencePath
      ),
    },
    { repoRoot: root }
  );
  assert.equal(withPathOnly.status, "FAIL");
  assert.ok(withPathOnly.findings.some((f) => f.code === "BACKUP_TOKEN_MISSING"));
});

test("COMMS-ACT-01 RLS matrix keeps Club/Community client fail-closed", () => {
  const matrix = getCommsAct01RlsReadinessMatrix();
  assert.equal(matrix.club.client, "BLOCKED_FAIL_CLOSED");
  assert.equal(matrix.community.client, "BLOCKED_FAIL_CLOSED");
  assert.equal(matrix.overallClientRls, "BLOCKED_FAIL_CLOSED");
  assert.equal(
    matrix.overallTrustedBackendAfterApply,
    "READY_BACKEND_TRUSTED_ONLY"
  );
  assert.equal(matrix.attachments.client, "BLOCKED_FAIL_CLOSED");
  assert.equal(matrix.realtimeSubscription.client, "BLOCKED_FAIL_CLOSED");
});

test("COMMS-ACT-01 preflight and verify scripts run offline without remote", () => {
  const pre = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/communication/comms-act-01-staging-preflight.mjs"),
      "--offline",
      "--json",
    ],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(pre.status, 0, pre.stderr || pre.stdout);
  const preJson = JSON.parse(pre.stdout);
  assert.equal(preJson.remoteApplyAllowed, false);
  assert.equal(preJson.secretsPrinted, false);
  assert.equal(preJson.verdict, COMMS_ACT_01_VERDICTS.READY_FOR_OWNER_GO);

  const applyRefuse = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/communication/comms-act-01-staging-preflight.mjs"),
      "--apply",
    ],
    { cwd: root, encoding: "utf8" }
  );
  assert.notEqual(applyRefuse.status, 0);

  const verify = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/communication/comms-act-01-post-apply-verify.mjs"),
      "--offline",
      "--json",
    ],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(verify.status, 0, verify.stderr || verify.stdout);
  const verifyJson = JSON.parse(verify.stdout);
  assert.equal(verifyJson.remoteQueryExecuted, false);
  assert.equal(verifyJson.sqlApplyExecuted, false);
  assert.equal(verifyJson.realtimeEnabled, false);
});

test("COMMS-ACT-01 README Communication Foundation mentions readiness gate", () => {
  const readme = fs.readFileSync(
    path.join(root, "docs/communication-foundation/README.md"),
    "utf8"
  );
  assert.match(readme, /COMMS-ACT-01/);
  assert.match(readme, /COMMS-ACT-02/);
  assert.match(readme, /GO_STAGING_PERSISTENCE/);
  assert.match(readme, /FAIL-CLOSED/);
  assert.match(readme, /NOT ENABLED/);
  assert.match(readme, /\*\*Production\*\*\s*\|\s*BLOCKED/);
});

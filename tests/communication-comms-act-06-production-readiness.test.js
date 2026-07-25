/**
 * COMMS-ACT-06 — Production readiness release gate (static).
 * No remote mutation. No Production access. No secrets printed.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMMS_ACT_06_CAPABILITY_SCOPE,
  COMMS_ACT_06_PROD_SMOKE_MARKER,
  COMMS_ACT_06_PRODUCTION_ENABLE_TOKEN,
  COMMS_ACT_06_REQUIRED_DOCS,
  COMMS_ACT_06_RISK_CLASS,
  COMMS_ACT_06_VERDICTS,
  COMMUNICATION_ACT06_CAPABILITY_STATE,
  COMMUNICATION_PROD_SMOKE_MARKER,
  COMMUNICATION_RUNTIME_MODE,
  COMMUNICATION_TRUSTED_BACKEND_ENV,
  evaluateCommunicationProductionRefGate,
  evaluateCommsAct06DeploymentHost,
  evaluateCommsAct06Preflight,
  evaluateCommsProductionTargetIdentity,
  getCommsAct06RiskRegister,
  resolveCommunicationRuntimeMode,
} from "../src/features/communication/index.js";
import {
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
} from "../src/features/communication/activation/stagingTarget.js";
import {
  assertCommunicationRateLimit,
  assertCommunicationRequestSize,
  resetCommunicationRequestGuardState,
} from "../api/communication/requestGuards.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(
  root,
  "docs/communication-foundation/activation/comms-act-06"
);
const backupScriptPath =
  "C:\\Users\\Le Phong\\PICK_VN-Backups\\create-comms-act-07-production-logical-backup.ps1";

test("COMMS-ACT-06 docs exist", () => {
  for (const name of COMMS_ACT_06_REQUIRED_DOCS) {
    assert.ok(fs.existsSync(path.join(docsDir, name)), name);
  }
  assert.ok(
    fs.existsSync(path.join(docsDir, "evidence/OWNER_ENV_METADATA_TEMPLATE.md"))
  );
});

test("deployment host remains Vercel api/communication", () => {
  const host = evaluateCommsAct06DeploymentHost({ repoRoot: root });
  assert.equal(host.pass, true, JSON.stringify(host.findings, null, 2));
  assert.equal(host.hostFamily, "vercel_serverless_api");
  assert.equal(host.productionRef, COMMS_PRODUCTION_PROJECT_REF);
  assert.equal(host.stagingRef, COMMS_STAGING_PROJECT_REF);
});

test("Production ref gate is fail-closed without Owner GO", () => {
  const blocked = evaluateCommunicationProductionRefGate(
    `https://${COMMS_PRODUCTION_PROJECT_REF}.supabase.co`,
    { enableToken: "" }
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "PRODUCTION_REF_BLOCKED");

  const staging = evaluateCommunicationProductionRefGate(
    `https://${COMMS_STAGING_PROJECT_REF}.supabase.co`,
    { enableToken: "" }
  );
  assert.equal(staging.ok, true);
  assert.equal(staging.productionTarget, false);

  const enabled = evaluateCommunicationProductionRefGate(
    `https://${COMMS_PRODUCTION_PROJECT_REF}.supabase.co`,
    { enableToken: COMMS_ACT_06_PRODUCTION_ENABLE_TOKEN }
  );
  assert.equal(enabled.ok, true);
  assert.equal(enabled.enabled, true);
});

test("Production target identity rejects Staging leakage", () => {
  const leak = evaluateCommsProductionTargetIdentity({
    url: `https://${COMMS_STAGING_PROJECT_REF}.supabase.co`,
    environment: "production",
  });
  assert.equal(leak.status, "FAIL");
  assert.ok(leak.findings.some((f) => f.code === "STAGING_REF_LEAKAGE"));
});

test("capability scope locked — Community/Realtime blocked", () => {
  assert.equal(
    COMMS_ACT_06_CAPABILITY_SCOPE.COMMUNITY_BLOCKED_FAIL_CLOSED,
    "COMMUNITY_BLOCKED_FAIL_CLOSED"
  );
  assert.equal(
    COMMUNICATION_ACT06_CAPABILITY_STATE.REALTIME_BLOCKED_FAIL_CLOSED,
    "REALTIME_BLOCKED_FAIL_CLOSED"
  );
  assert.equal(COMMS_ACT_06_PROD_SMOKE_MARKER, COMMUNICATION_PROD_SMOKE_MARKER);
  assert.equal(
    COMMUNICATION_TRUSTED_BACKEND_ENV.PRODUCTION_RUNTIME_ENABLE_TOKEN,
    COMMS_ACT_06_PRODUCTION_ENABLE_TOKEN
  );
});

test("api hosts wire Production gate + request guards", () => {
  for (const rel of [
    "api/communication/command.js",
    "api/communication/system-produce.js",
    "api/communication/authorizeCommunicationActor.js",
    "api/communication/authorizeSystemProducer.js",
    "api/communication/productionTargetGate.js",
    "api/communication/requestGuards.js",
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
  }
  const actor = fs.readFileSync(
    path.join(root, "api/communication/authorizeCommunicationActor.js"),
    "utf8"
  );
  assert.match(actor, /assertCommunicationProductionTargetAllowed/);
  assert.doesNotMatch(actor, /VITE_.*SERVICE_ROLE/);
  const cmd = fs.readFileSync(
    path.join(root, "api/communication/command.js"),
    "utf8"
  );
  assert.match(cmd, /assertCommunicationRequestSize/);
  assert.match(cmd, /assertCommunicationRateLimit/);
});

test("request guards enforce size and rate limits", () => {
  resetCommunicationRequestGuardState();
  const ok = assertCommunicationRequestSize({ hello: "world" });
  assert.equal(ok.ok, true);
  const huge = assertCommunicationRequestSize("x".repeat(40 * 1024));
  assert.equal(huge.ok, false);
  assert.equal(huge.code, "REQUEST_BODY_TOO_LARGE");

  const req = { headers: { authorization: "Bearer test-token", "x-forwarded-for": "1.1.1.1" } };
  for (let i = 0; i < 60; i += 1) {
    assert.equal(assertCommunicationRateLimit(req, { maxRequests: 60 }).ok, true);
  }
  const limited = assertCommunicationRateLimit(req, { maxRequests: 60 });
  assert.equal(limited.ok, false);
  assert.equal(limited.code, "RATE_LIMITED");
  resetCommunicationRequestGuardState();
});

test("Production build stays UNAVAILABLE while PRODUCTION_READY false", () => {
  const mode = resolveCommunicationRuntimeMode({
    env: { MODE: "production", PROD: "true", NODE_ENV: "production" },
    productionDependenciesCertified: true,
  });
  assert.equal(mode.mode, COMMUNICATION_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(mode.reason, "ACTIVATION_GATES_BLOCKED");
});

test("evaluateCommsAct06Preflight returns READY_WITH_REMEDIATION_REQUIRED", () => {
  const result = evaluateCommsAct06Preflight({
    repoRoot: root,
    backupScriptPath,
    requireBackupScript: true,
  });
  assert.equal(result.pass, true, JSON.stringify(result.findings, null, 2));
  assert.equal(
    result.verdict,
    COMMS_ACT_06_VERDICTS.READY_WITH_REMEDIATION_REQUIRED
  );
  assert.equal(result.mutationCount, 0);
  assert.equal(result.productionUntouched, true);
  assert.equal(result.backupScriptOk, true);
  assert.equal(result.secretsPrinted, false);
  assert.ok(result.remediations.length > 0);
  assert.ok(
    result.remediations.every(
      (r) => r.class === COMMS_ACT_06_RISK_CLASS.RELEASE_BLOCKER
    )
  );
});

test("risk register includes expected classes", () => {
  const risks = getCommsAct06RiskRegister();
  assert.ok(
    risks.some(
      (r) =>
        r.id === "REQUEST_SIZE_AND_RATE_LIMIT" &&
        r.class === COMMS_ACT_06_RISK_CLASS.REQUIRED_BEFORE_SCALE
    )
  );
  assert.ok(
    risks.some(
      (r) =>
        r.id === "COMMUNITY_AND_REALTIME" &&
        r.class === COMMS_ACT_06_RISK_CLASS.DEFERRED_NON_BLOCKING
    )
  );
});

test("Production backup script static safety", () => {
  assert.ok(fs.existsSync(backupScriptPath), "backup script missing");
  const src = fs.readFileSync(backupScriptPath, "utf8");
  assert.match(src, /expuvcohlcjzvrrauvud/);
  assert.match(src, /qyewbxjsiiyufanzcjcq/);
  assert.match(src, /Allowlist Production|Production allowlist/i);
  assert.match(src, /Staging blocklist|Never targets Staging/i);
  assert.match(src, /roles\.sql/);
  assert.match(src, /schema\.sql/);
  assert.match(src, /data\.sql/);
  assert.match(src, /migration-history/);
  assert.match(src, /SHA256/);
  assert.match(src, /already exists \(no overwrite\)|already exists/);
  assert.doesNotMatch(src, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\./);
  assert.doesNotMatch(src, /postgres:\/\/[^:]+:[^@]+@/);
  assert.doesNotMatch(src, /service_role|sb_secret_/i);
});

test("package.json and package-lock.json unchanged by ACT-06 policy", () => {
  // Presence check only — git diff validation runs in CI/local validation.
  assert.ok(fs.existsSync(path.join(root, "package.json")));
  assert.ok(fs.existsSync(path.join(root, "package-lock.json")));
});

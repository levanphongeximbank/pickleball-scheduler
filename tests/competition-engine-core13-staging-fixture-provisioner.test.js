/**
 * CORE-13 disposable Staging fixture provisioner + receipt provenance — local only.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CASE_CATALOG,
  createMutationGate,
  evaluateFixtureNamespace,
} from "../scripts/core13/core13-staging-acceptance-proofs.mjs";
import {
  createValidFixtureReceipt,
  evaluateFixtureReceipt,
  evaluateManualFixtureOverride,
  evaluatePhysicalEnvironment,
  evaluateReceiptRemoteReconciliation,
  evaluateTeardownScope,
  hydrateHarnessFixtures,
  isCanonicalUuid,
  loadFixtureReceiptFromPath,
  PRODUCTION_PROJECT_REF,
  receiptContainsSecrets,
  STAGING_PROJECT_REF,
  stripReceiptSecrets,
} from "../scripts/core13/core13-staging-fixture-receipt.mjs";
import {
  evaluateWriterCoverage,
  REQUIRED_WRITER_PORTS,
} from "../scripts/core13/core13-staging-fixture-writers.mjs";
import {
  materializeReceiptFromWriters,
  parseProvisionerMode,
  planFixtureProvision,
  planTeardown,
  runFixtureProvisionerCli,
  teardownFromReceipt,
} from "../scripts/core13/core13-staging-fixture-provisioner.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function nextUuid(seq) {
  return `aaaaaaaa-bbbb-4ccc-8ddd-${String(seq).padStart(12, "0")}`;
}

function createStubWriters() {
  let seq = 1;
  const writers = {};
  for (const name of REQUIRED_WRITER_PORTS) {
    writers[name] = async () => ({ id: nextUuid(seq++) });
  }
  return writers;
}

test("A. canonical UUID does not need namespace text", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-uuid-a" });
  assert.equal(isCanonicalUuid(receipt.matches.preMatch.id), true);
  assert.equal(String(receipt.matches.preMatch.id).includes("CORE13_STAGING_ACCEPTANCE"), false);
  assert.equal(evaluateFixtureReceipt(receipt).ok, true);
  assert.equal(evaluateFixtureNamespace([{ id: receipt.matches.preMatch.id, required: true }]).ok, false);
});

test("B. valid receipt provenance passes", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-valid-b" });
  const proof = evaluateFixtureReceipt(receipt);
  assert.equal(proof.ok, true);
  assert.equal(receipt.namespace, "CORE13_STAGING_ACCEPTANCE");
  assert.equal(receipt.disposable, true);
});

test("C. wrong namespace fails", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-ns", namespace: "OTHER" });
  assert.equal(evaluateFixtureReceipt(receipt).ok, false);
});

test("D. disposable=false fails", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-disp", disposable: false });
  assert.equal(evaluateFixtureReceipt(receipt).ok, false);
});

test("E. Production project ref fails", () => {
  const receipt = createValidFixtureReceipt({
    runId: "run-prod",
    projectRef: PRODUCTION_PROJECT_REF,
  });
  assert.equal(evaluateFixtureReceipt(receipt).ok, false);
  assert.equal(
    evaluatePhysicalEnvironment(createValidFixtureReceipt({ runId: "run-phys" }), {
      STAGING_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
      PICK_VN_ENV: "staging",
    }).ok,
    false
  );
});

test("F. Tenant A == Tenant B fails", () => {
  const receipt = createValidFixtureReceipt({
    runId: "run-tenants",
    tenantB: { id: "core13-qa-tenant-a", name: "dup" },
  });
  assert.equal(evaluateFixtureReceipt(receipt).ok, false);
});

test("G. Referee A == replacement Referee fails", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-ref" });
  receipt.users.replacementReferee.id = receipt.users.refereeA.id;
  assert.equal(evaluateFixtureReceipt(receipt).ok, false);
});

test("H. missing required fixture fails", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-missing" });
  delete receipt.matches.locked;
  assert.equal(evaluateFixtureReceipt(receipt).ok, false);
});

test("I. manual arbitrary fixture ID cannot bypass receipt", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-manual" });
  const proof = evaluateManualFixtureOverride(receipt, {
    STAGING_MATCH_A: "owner-business-match-1",
  });
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /bypass/);
  assert.equal(evaluateManualFixtureOverride(receipt, {}).ok, true);
  assert.equal(
    evaluateManualFixtureOverride(receipt, { STAGING_MATCH_A: receipt.matches.preMatch.id }).ok,
    true
  );
});

test("J. receipt/remote mismatch blocks before mutation", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-remote" });
  const mismatch = evaluateReceiptRemoteReconciliation(receipt, {
    reconcile: true,
    projectRef: STAGING_PROJECT_REF,
    environment: "staging",
    primaryTournamentTenantId: "someone-else-tenant",
    preMatchTournamentId: receipt.tournaments.primary.id,
    preMatchLifecycle: "PRE_MATCH",
    requireRefereeEvidence: true,
    refereeARole: "REFEREE",
  });
  assert.equal(mismatch.ok, false);
  const gate = createMutationGate();
  assert.equal(gate.assertCanMutate().ok, false);
  const aligned = evaluateReceiptRemoteReconciliation(receipt, {
    reconcile: true,
    projectRef: STAGING_PROJECT_REF,
    environment: "staging",
    primaryTournamentTenantId: receipt.tenantA.id,
    preMatchTournamentId: receipt.tournaments.primary.id,
    preMatchLifecycle: "PRE_MATCH",
  });
  assert.equal(aligned.ok, true);
});

test("K. missing canonical writer yields BLOCKED writer-gap", () => {
  const plan = planFixtureProvision({ writers: {} });
  assert.equal(plan.ok, false);
  assert.equal(plan.verdict, "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP");
  assert.ok(plan.missing.includes("createTenant"));
  const coverage = evaluateWriterCoverage({ createTenant: async () => ({ id: "x" }) });
  assert.equal(coverage.ok, false);
  assert.equal(coverage.verdict, "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP");
});

test("L/M. provisioner contains no SQL execution or generic table DML", () => {
  const src = read("scripts/core13/core13-staging-fixture-provisioner.mjs");
  const writers = read("scripts/core13/core13-staging-fixture-writers.mjs");
  for (const text of [src, writers]) {
    assert.doesNotMatch(text, /\.from\([^)]+\)\s*\.\s*insert\s*\(/);
    assert.doesNotMatch(text, /\.from\([^)]+\)\s*\.\s*update\s*\(/);
    assert.doesNotMatch(text, /\.from\([^)]+\)\s*\.\s*delete\s*\(/);
    assert.doesNotMatch(text, /apply_migration/);
    assert.doesNotMatch(text, /CREATE TABLE/i);
    assert.doesNotMatch(text, /ALTER TABLE/i);
    assert.doesNotMatch(text, /CREATE FUNCTION/i);
    assert.doesNotMatch(text, /CREATE RPC/i);
  }
});

test("N. provisioner does not import product-private persistence", () => {
  const src = read("scripts/core13/core13-staging-fixture-provisioner.mjs");
  assert.doesNotMatch(src, /clubStorage/);
  assert.doesNotMatch(src, /inMemoryCanonicalTournamentRpc/);
  assert.doesNotMatch(src, /from ['"].*features\/tournament\/repositories/);
  assert.doesNotMatch(src, /from ['"].*features\/tenant\//);
});

test("O. product/browser cannot import provisioner", () => {
  const srcRoot = path.join(ROOT, "src");
  const hits = [];
  for (const file of walk(srcRoot)) {
    if (!/\.(js|jsx|ts|tsx)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    if (
      /core13-staging-fixture-provisioner|core13-staging-fixture-receipt|core13-staging-fixture-writers|scripts\/core13\//.test(
        text
      )
    ) {
      hits.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(hits, []);
});

test("P. teardown only targets receipt-owned objects", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-teardown" });
  assert.equal(evaluateTeardownScope(receipt, ["owner-business-row"]).ok, false);
  assert.equal(planTeardown(receipt, ["owner-business-row"]).ok, false);
  assert.equal(planTeardown(receipt, [receipt.matches.preMatch.id]).ok, true);
});

test("Q. unknown baseline never triggers auto-clean", async () => {
  const receipt = createValidFixtureReceipt({ runId: "run-autoclean" });
  const denied = await teardownFromReceipt({
    receipt,
    unknownBaselineAutoClean: true,
    allowExecute: false,
  });
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /UNKNOWN_BASELINE_AUTO_CLEAN/);
});

test("R. secrets are excluded from receipt serialization", () => {
  const dirty = {
    ...createValidFixtureReceipt({ runId: "run-secret" }),
    password: "redacted-secret-value",
    jwt: "should-be-stripped",
  };
  assert.equal(receiptContainsSecrets(dirty), true);
  const clean = stripReceiptSecrets(dirty);
  assert.equal(clean.password, undefined);
  assert.equal(clean.jwt, undefined);
  assert.equal(receiptContainsSecrets(clean), false);
  assert.equal(evaluateFixtureReceipt(dirty).ok, false);
});

test("S. existing 29-case proof semantics remain unchanged", () => {
  assert.equal(CASE_CATALOG.length, 29);
  assert.equal(new Set(CASE_CATALOG).size, 29);
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  for (const name of CASE_CATALOG) {
    assert.match(harness, new RegExp(name.replace(/\./g, "\\.")));
  }
});

test("T. harness mutation gate still requires authenticated Edge probe", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.match(harness, /getMatchAssignmentVersion/);
  assert.match(harness, /markProbePassed/);
  const gate = createMutationGate();
  assert.equal(gate.assertCanMutate().ok, false);
  gate.markProbePassed();
  assert.equal(gate.assertCanMutate().ok, true);
});

test("hydrate fixtures come from receipt, not namespace text IDs", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-hydrate" });
  const fixtures = hydrateHarnessFixtures(receipt);
  assert.equal(fixtures.matchA, receipt.matches.preMatch.id);
  assert.equal(fixtures.tenantA, receipt.tenantA.id);
});

test("stub writers can materialize a local receipt without remote I/O", async () => {
  const result = await materializeReceiptFromWriters({
    writers: createStubWriters(),
    allowExecute: true,
    runId: "run-materialize-local",
  });
  assert.equal(result.ok, true);
  assert.equal(evaluateFixtureReceipt(result.receipt).ok, true);
  assert.notEqual(result.receipt.tenantA.id, result.receipt.tenantB.id);
  assert.notEqual(result.receipt.users.refereeA.id, result.receipt.users.replacementReferee.id);
});

test("remote provision/teardown modes refuse without Owner GO", async () => {
  const denied = await runFixtureProvisionerCli(["--provision"], {});
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /CORE13_FIXTURE_PROVISION_GO/);
  const teardown = await runFixtureProvisionerCli(["--teardown"], {
    CORE13_FIXTURE_PROVISION_GO: "YES",
  });
  assert.equal(teardown.ok, false);
  assert.equal(parseProvisionerMode(["--plan"]), "plan");
});

test("local --plan with stubs is PLAN_READY", () => {
  const plan = planFixtureProvision({ writers: createStubWriters() });
  assert.equal(plan.ok, true);
  assert.equal(plan.verdict, "PLAN_READY");
  assert.equal(plan.qualificationRuntime, "NOT_CONFIGURED");
  assert.equal(plan.availabilityRuntime, "NOT_CONFIGURED");
  assert.equal(plan.fakeEvidenceCreated, false);
  assert.equal(plan.sqlExecution, false);
});

test("receipt file load verifies provenance locally", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "core13-receipt-"));
  const receipt = createValidFixtureReceipt({ runId: "run-file" });
  const filePath = path.join(dir, "receipt.json");
  writeFileSync(filePath, JSON.stringify(receipt), "utf8");
  const loaded = loadFixtureReceiptFromPath(filePath);
  assert.equal(loaded.ok, true);
  assert.equal(existsSync(path.join(ROOT, "scripts/core13/core13-staging-fixture-provisioner.mjs")), true);
});

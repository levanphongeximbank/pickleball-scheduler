/**
 * CORE-13 disposable Staging fixture provisioner hardening — local only.
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
} from "../scripts/core13/core13-staging-acceptance-proofs.mjs";
import {
  buildAlignedRemoteEvidenceForTests,
  buildTypedCleanupPlan,
  createValidFixtureReceipt,
  evaluateFixtureReceipt,
  evaluateManualFixtureOverride,
  evaluateReceiptRemoteReconciliation,
  evaluateTypedTeardownTargets,
  hydrateHarnessFixtures,
  isCanonicalUuid,
  loadFixtureReceiptFromPath,
  mapAuthoritativeLifecycle,
  STAGING_PROJECT_REF,
  stripReceiptSecrets,
  receiptContainsSecrets,
} from "../scripts/core13/core13-staging-fixture-receipt.mjs";
import {
  CANONICAL_WRITER_CATALOG,
  evaluateInternalMatchWriterArchitecture,
  evaluateTeamWriterDeniedForInternal,
  evaluateWriterCoverage,
  INTERNAL_MATCH_LIVE_SHELL_GAP,
  REQUIRED_WRITER_PORTS,
  buildNodeSafeWriterAudit,
} from "../scripts/core13/core13-staging-fixture-writers.mjs";
import {
  materializeReceiptFromWriters,
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

test("1. Team Tournament provisionRefereeMatch cannot satisfy INTERNAL match writer", () => {
  const denied = evaluateTeamWriterDeniedForInternal(
    CANONICAL_WRITER_CATALOG.teamTournamentProvisionRefereeMatch.authority
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY, "DENY");
  const architecture = evaluateInternalMatchWriterArchitecture();
  assert.equal(architecture.INTERNAL_MATCH_WRITER_GAP, INTERNAL_MATCH_LIVE_SHELL_GAP);
  assert.equal(architecture.INTERNAL_MATCH_CANONICAL_WRITER, "NOT_AVAILABLE");
  const coverage = evaluateWriterCoverage({
    ...createStubWriters(),
    __allowTeamAsInternal: true,
    provisionLiveMatchShell: async () => ({ id: nextUuid(99) }),
  });
  assert.equal(coverage.ok, false);
  assert.match(JSON.stringify(coverage.gaps), /DENIED|INTERNAL_MATCH_LIVE_SHELL/);
});

test("2/3. primary remains non-terminal; completed fixture is isolated", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-completed-isolated" });
  assert.notEqual(receipt.tournaments.primary.terminal, true);
  assert.equal(receipt.tournaments.completedLifecycle.terminal, true);
  assert.equal(
    receipt.matches.completed.tournamentId,
    receipt.tournaments.completedLifecycle.id
  );
  assert.notEqual(receipt.matches.completed.tournamentId, receipt.tournaments.primary.id);
  assert.equal(evaluateFixtureReceipt(receipt).ok, true);
  receipt.matches.completed.tournamentId = receipt.tournaments.primary.id;
  assert.equal(evaluateFixtureReceipt(receipt).ok, false);
});

test("4/5. teardown is typed and never unassigns tenant/user/tournament IDs", async () => {
  const receipt = createValidFixtureReceipt({
    runId: "run-typed-teardown",
    assignments: [{ id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000099" }],
  });
  const plan = planTeardown(receipt);
  assert.equal(plan.genericUnassignOverAllReceiptIds, false);
  assert.equal(plan.typedByResource, true);
  const resources = plan.steps.map((step) => step.resource);
  assert.ok(resources.includes("assignments"));
  assert.ok(resources.includes("authUsers"));
  assert.ok(resources.includes("tournaments"));
  assert.ok(resources.includes("retainedImmutableArtifacts"));
  const unassignStep = plan.steps.find((step) => step.resource === "assignments");
  assert.ok(!unassignStep.ids.includes(receipt.tenantA.id));
  assert.ok(!unassignStep.ids.includes(receipt.users.userA.id));
  assert.ok(!unassignStep.ids.includes(receipt.tournaments.primary.id));
  assert.equal(
    evaluateTypedTeardownTargets(receipt, [
      { resource: "unassignViaTrustedServer", id: receipt.tenantA.id },
    ]).ok,
    false
  );
  const calls = [];
  const result = await teardownFromReceipt({
    receipt,
    allowExecute: true,
    writers: {
      ...createStubWriters(),
      unassignViaTrustedServer: async (args) => {
        calls.push(args);
        return { ok: true };
      },
      deleteAuthUser: async () => ({ ok: true }),
      deleteTournament: async () => ({ ok: true }),
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.genericUnassignOverAllReceiptIds, false);
  for (const call of calls) {
    assert.ok(call.assignmentId);
    assert.notEqual(call.assignmentId, receipt.tenantA.id);
  }
});

test("6. immutable history is retained", () => {
  const plan = buildTypedCleanupPlan(createValidFixtureReceipt({ runId: "run-immutable" }));
  const immutable = plan.steps.find((step) => step.resource === "retainedImmutableArtifacts");
  assert.equal(immutable.command, "retain");
  assert.ok(immutable.ids.includes("competition_referee_assignment_audit"));
  assert.equal(plan.immutableHistoryDelete, false);
});

test("7. hardcoded PRE_MATCH does not satisfy remote reconciliation", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-hardcoded" });
  const proof = evaluateReceiptRemoteReconciliation(receipt, {
    reconcile: true,
    hardcodedLifecycleProof: true,
    projectRef: STAGING_PROJECT_REF,
    environment: "staging",
  });
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /HARDCODED_PREMATCH_LIFECYCLE_REMOTE_PROOF/);
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.doesNotMatch(harness, /preMatchLifecycle:\s*"PRE_MATCH"/);
});

test("8. missing remote match evidence fails before mutation", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-missing-match" });
  const remote = buildAlignedRemoteEvidenceForTests(receipt, {
    matches: { preMatch: { exists: false } },
  });
  const proof = evaluateReceiptRemoteReconciliation(receipt, remote);
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /remote match evidence missing/);
  assert.equal(createMutationGate().assertCanMutate().ok, false);
});

test("9. wrong remote lifecycle fails before mutation", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-wrong-life" });
  const remote = buildAlignedRemoteEvidenceForTests(receipt, {
    matches: { preMatch: { exists: true, lifecycle: "IN_PROGRESS" } },
  });
  assert.equal(evaluateReceiptRemoteReconciliation(receipt, remote).ok, false);
});

test("10. wrong referee role/status/tenant fails before mutation", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-wrong-ref" });
  assert.equal(
    evaluateReceiptRemoteReconciliation(
      receipt,
      buildAlignedRemoteEvidenceForTests(receipt, {
        identities: { refereeA: { role: "PLAYER", status: "ACTIVE", tenantId: receipt.tenantA.id } },
      })
    ).ok,
    false
  );
  assert.equal(
    evaluateReceiptRemoteReconciliation(
      receipt,
      buildAlignedRemoteEvidenceForTests(receipt, {
        identities: {
          inactiveReferee: { role: "REFEREE", status: "ACTIVE", tenantId: receipt.tenantA.id },
        },
      })
    ).ok,
    false
  );
  assert.equal(
    evaluateReceiptRemoteReconciliation(
      receipt,
      buildAlignedRemoteEvidenceForTests(receipt, {
        identities: {
          refereeA: { role: "REFEREE", status: "ACTIVE", tenantId: "foreign-tenant" },
        },
      })
    ).ok,
    false
  );
});

test("11. schedule evidence mismatch fails before mutation", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-sched" });
  assert.equal(
    evaluateReceiptRemoteReconciliation(
      receipt,
      buildAlignedRemoteEvidenceForTests(receipt, {
        schedule: { required: true, overlapConflict: false, nonOverlapConflict: false },
      })
    ).ok,
    false
  );
});

test("12. manual receipt claim cannot override remote truth", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-claim" });
  assert.equal(
    evaluateReceiptRemoteReconciliation(
      receipt,
      buildAlignedRemoteEvidenceForTests(receipt, { receiptClaimOverridesRemote: true })
    ).ok,
    false
  );
  assert.equal(
    evaluateManualFixtureOverride(receipt, { STAGING_MATCH_A: "owner-business-match" }).ok,
    false
  );
});

test("13. 29-case catalog remains exactly 29", () => {
  assert.equal(CASE_CATALOG.length, 29);
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  for (const name of CASE_CATALOG) {
    assert.match(harness, new RegExp(name.replace(/\./g, "\\.")));
  }
});

test("14. authenticated non-mutating Edge probe still precedes first CORE13 mutation", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.match(harness, /getMatchAssignmentVersion/);
  assert.match(harness, /markProbePassed/);
  const gate = createMutationGate();
  assert.equal(gate.assertCanMutate().ok, false);
  gate.markProbePassed();
  assert.equal(gate.assertCanMutate().ok, true);
});

test("15. no direct DML / SQL / new RPC / new schema in provisioner", () => {
  for (const rel of [
    "scripts/core13/core13-staging-fixture-provisioner.mjs",
    "scripts/core13/core13-staging-fixture-writers.mjs",
    "scripts/core13/core13-staging-fixture-receipt.mjs",
  ]) {
    const src = read(rel);
    assert.doesNotMatch(src, /\.from\([^)]+\)\s*\.\s*insert\s*\(/);
    assert.doesNotMatch(src, /\.from\([^)]+\)\s*\.\s*update\s*\(/);
    assert.doesNotMatch(src, /\.from\([^)]+\)\s*\.\s*delete\s*\(/);
    assert.doesNotMatch(src, /apply_migration/);
    assert.doesNotMatch(src, /CREATE TABLE/i);
    assert.doesNotMatch(src, /CREATE FUNCTION/i);
    assert.doesNotMatch(src, /CREATE RPC/i);
  }
});

test("plan reports INTERNAL_MATCH_LIVE_SHELL gap and denies Team authority", () => {
  const plan = planFixtureProvision({ writers: createStubWriters() });
  assert.equal(plan.ok, false);
  assert.equal(plan.verdict, "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP");
  assert.equal(plan.INTERNAL_MATCH_WRITER_GAP, INTERNAL_MATCH_LIVE_SHELL_GAP);
  assert.equal(plan.TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY, "DENY");
});

test("materialize refuses Team live-shell and refuses full live readiness without gap bypass", async () => {
  const blocked = await materializeReceiptFromWriters({
    writers: createStubWriters(),
    allowExecute: true,
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.detail, /INTERNAL_MATCH_LIVE_SHELL/);
  const teamBlocked = await materializeReceiptFromWriters({
    writers: {
      ...createStubWriters(),
      provisionLiveMatchShell: async () => ({ id: nextUuid(1) }),
    },
    allowExecute: true,
    requireInternalLiveShell: false,
  });
  assert.equal(teamBlocked.ok, false);
  assert.match(teamBlocked.detail, /TEAM_RPC/);
});

test("local receipt-shape materialize isolates completed tournament when live-shell requirement waived", async () => {
  const result = await materializeReceiptFromWriters({
    writers: createStubWriters(),
    allowExecute: true,
    requireInternalLiveShell: false,
    runId: "run-local-shape",
  });
  assert.equal(result.ok, true);
  assert.equal(result.PRIMARY_TOURNAMENT_REMAINS_NON_TERMINAL, true);
  assert.equal(result.COMPLETED_FIXTURE_ISOLATED, true);
  assert.notEqual(
    result.receipt.matches.completed.tournamentId,
    result.receipt.tournaments.primary.id
  );
  assert.equal(evaluateFixtureReceipt(result.receipt).ok, true);
});

test("aligned remote evidence can pass; mapAuthoritativeLifecycle is honest", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-aligned" });
  assert.equal(
    evaluateReceiptRemoteReconciliation(receipt, buildAlignedRemoteEvidenceForTests(receipt)).ok,
    true
  );
  assert.equal(mapAuthoritativeLifecycle({ liveRow: null }), "PRE_MATCH");
  assert.equal(
    mapAuthoritativeLifecycle({ liveRow: { status: "paused" } }),
    "LOCKED"
  );
  assert.equal(
    mapAuthoritativeLifecycle({ liveRow: { status: "in_progress", last_event_sequence: 2 } }),
    "SCORING_ACTIVE"
  );
});

test("node-safe writer audit is complete and marks live shell missing", () => {
  const audit = buildNodeSafeWriterAudit();
  assert.equal(audit.createTenant.nodeBinding, "NODE_SAFE_BINDABLE");
  assert.equal(audit.createAuthUser.nodeBinding, "REQUIRES_IDENTITY_ADMIN_SERVER_CLIENT");
  assert.equal(audit.provisionInternalMatchLiveShell.nodeBinding, "MISSING_CANONICAL_CAPABILITY");
  assert.equal(audit.teamTournamentProvisionRefereeMatch.forbiddenForInternal, true);
});

test("canonical UUID receipt still validates; product cannot import provisioner", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-uuid" });
  assert.equal(isCanonicalUuid(receipt.matches.preMatch.id), true);
  assert.equal(evaluateFixtureReceipt(receipt).ok, true);
  const hits = [];
  for (const file of walk(path.join(ROOT, "src"))) {
    if (!/\.(js|jsx|ts|tsx)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    if (/core13-staging-fixture-|scripts\/core13\//.test(text)) hits.push(file);
  }
  assert.deepEqual(hits, []);
});

test("remote provision CLI still refuses without GO / writer gap", async () => {
  const denied = await runFixtureProvisionerCli(["--provision"], {});
  assert.equal(denied.ok, false);
  const gated = await runFixtureProvisionerCli(["--provision"], {
    CORE13_FIXTURE_PROVISION_GO: "YES",
    STAGING_MUTATION_GO: "YES",
    PICK_VN_ENV: "staging",
    TARGET_PROJECT_REF: STAGING_PROJECT_REF,
  });
  assert.equal(gated.ok, false);
  assert.match(String(gated.detail || gated.verdict), /INTERNAL_MATCH_LIVE_SHELL|BLOCKED/);
});

test("secrets stay out of receipts; hydrate uses completedLifecycle", () => {
  const dirty = {
    ...createValidFixtureReceipt({ runId: "run-secret" }),
    password: "redacted-secret-value",
  };
  assert.equal(receiptContainsSecrets(dirty), true);
  assert.equal(stripReceiptSecrets(dirty).password, undefined);
  const fixtures = hydrateHarnessFixtures(createValidFixtureReceipt({ runId: "run-hydrate" }));
  assert.ok(fixtures.completedLifecycleTournament);
});

test("receipt file load still works", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "core13-receipt-"));
  const receipt = createValidFixtureReceipt({ runId: "run-file" });
  const filePath = path.join(dir, "receipt.json");
  writeFileSync(filePath, JSON.stringify(receipt), "utf8");
  assert.equal(loadFixtureReceiptFromPath(filePath).ok, true);
  assert.equal(existsSync(path.join(ROOT, "scripts/core13/core13-staging-fixture-provisioner.mjs")), true);
});

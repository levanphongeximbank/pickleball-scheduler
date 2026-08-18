/**
 * CORE-13 disposable Staging fixture provisioner — PR #448 initializer adoption.
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
  createInitializeMatchExecutionWriter,
  evaluateDailyWriterDeniedForInternal,
  evaluateForbiddenCallerAuthority,
  evaluateInitializerClientFields,
  evaluateInternalMatchWriterArchitecture,
  evaluateTeamWriterDeniedForInternal,
  evaluateWriterCoverage,
  FORBIDDEN_DIRECT_INITIALIZER_RPC,
  HISTORICAL_BLOCKER_CLOSED_BY,
  HISTORICAL_INTERNAL_MATCH_LIVE_SHELL_GAP,
  INITIALIZER_AUTHORITY,
  INITIALIZER_PORT_NAME,
  REQUIRED_WRITER_PORTS,
  buildInitializeMatchExecutionRequest,
  buildNodeSafeWriterAudit,
  REFEREE_V5_ACTIONS,
} from "../scripts/core13/core13-staging-fixture-writers.mjs";
import {
  evaluateRemoteProvisionGate,
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
    writers[name] = async () => ({ id: nextUuid(seq++), ok: true });
  }
  return writers;
}

const AUTHORIZED_ENV = Object.freeze({
  CORE13_FIXTURE_PROVISION_GO: "YES",
  STAGING_MUTATION_GO: "YES",
  PICK_VN_ENV: "staging",
  TARGET_PROJECT_REF: STAGING_PROJECT_REF,
  STAGING_ORGANIZER_ACCESS_TOKEN: "test-organizer-token",
  STAGING_SUPABASE_URL: `https://${STAGING_PROJECT_REF}.supabase.co`,
});

test("1. PR448 initializer is the canonical Internal match-execution initializer", () => {
  const architecture = evaluateInternalMatchWriterArchitecture();
  assert.equal(architecture.ok, true);
  assert.equal(architecture.SHARED_REFEREE_MATCH_EXECUTION_INITIALIZER, "AVAILABLE");
  assert.equal(architecture.CANONICAL_AUTHORITY, "refereeV5EdgeInitializeExecution");
  assert.equal(architecture.INTERNAL_MATCH_CANONICAL_WRITER, INITIALIZER_PORT_NAME);
  assert.equal(architecture.INTERNAL_MATCH_WRITER_CLASSIFICATION, "CANONICAL_PRODUCT_COMMAND");
  assert.equal(architecture.INTERNAL_MATCH_WRITER_GAP, null);
  assert.equal(architecture.HISTORICAL_BLOCKER, HISTORICAL_BLOCKER_CLOSED_BY);
  assert.equal(architecture.HISTORICAL_INTERNAL_MATCH_LIVE_SHELL_GAP, HISTORICAL_INTERNAL_MATCH_LIVE_SHELL_GAP);
  assert.equal(architecture.REFEREE_V5_INITIALIZE_ACTION, "initialize-execution");
  assert.equal(REFEREE_V5_ACTIONS.INITIALIZE_EXECUTION, "initialize-execution");
  assert.match(CANONICAL_WRITER_CATALOG.initializeMatchExecution.authority, /refereeV5EdgeInitializeExecution/);
  assert.equal(CANONICAL_WRITER_CATALOG.initializeMatchExecution.nodeBinding, "REQUIRES_AUTHENTICATED_USER_CLIENT");
  assert.equal(CANONICAL_WRITER_CATALOG.initializeMatchExecution.required, true);
  const coverage = evaluateWriterCoverage(createStubWriters());
  assert.equal(coverage.ok, true);
});

test("2. Team Tournament provisionRefereeMatch remains DENIED", () => {
  const denied = evaluateTeamWriterDeniedForInternal(
    CANONICAL_WRITER_CATALOG.teamTournamentProvisionRefereeMatch.authority
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY, "DENY");
  const coverage = evaluateWriterCoverage({
    ...createStubWriters(),
    __allowTeamAsInternal: true,
    provisionLiveMatchShell: async () => ({ id: nextUuid(99) }),
  });
  assert.equal(coverage.ok, false);
  assert.match(JSON.stringify(coverage.gaps), /DENIED|TEAM_RPC/);
});

test("3. Daily Play writer remains DENIED as Internal authority", () => {
  const denied = evaluateDailyWriterDeniedForInternal(
    CANONICAL_WRITER_CATALOG.createDailyPlayMatches.authority
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY, "DENY");
  const coverage = evaluateWriterCoverage({
    ...createStubWriters(),
    __allowDailyAsInternal: true,
  });
  assert.equal(coverage.ok, false);
  assert.match(JSON.stringify(coverage.gaps), /DAILY_WRITER/);
});

test("4. fixture code does not directly RPC referee_v5_initialize_match_execution_state", () => {
  for (const rel of [
    "scripts/core13/core13-staging-fixture-provisioner.mjs",
    "scripts/core13/core13-staging-fixture-writers.mjs",
    "scripts/core13/core13-staging-fixture-receipt.mjs",
  ]) {
    const src = read(rel);
    assert.doesNotMatch(src, /\.rpc\s*\(\s*["']referee_v5_initialize_match_execution_state["']/);
    assert.doesNotMatch(src, /supabase\.rpc\(\s*["']referee_v5_initialize_match_execution_state["']/);
    if (rel.endsWith("provisioner.mjs") || rel.endsWith("receipt.mjs")) {
      assert.doesNotMatch(src, new RegExp(FORBIDDEN_DIRECT_INITIALIZER_RPC));
    }
  }
  const writers = read("scripts/core13/core13-staging-fixture-writers.mjs");
  assert.match(writers, /refereeV5EdgeInitializeExecution/);
  assert.match(writers, /FORBIDDEN_DIRECT_INITIALIZER_RPC/);
});

test("5. no direct insert/update/delete against match_live_states", () => {
  for (const rel of [
    "scripts/core13/core13-staging-fixture-provisioner.mjs",
    "scripts/core13/core13-staging-fixture-writers.mjs",
    "scripts/core13/core13-staging-fixture-receipt.mjs",
  ]) {
    const src = read(rel);
    assert.doesNotMatch(src, /\.from\(\s*["']match_live_states["']\s*\)\s*\.\s*(insert|update|delete|upsert)\s*\(/);
    assert.doesNotMatch(src, /\.from\([^)]+\)\s*\.\s*insert\s*\(/);
    assert.doesNotMatch(src, /\.from\([^)]+\)\s*\.\s*update\s*\(/);
    assert.doesNotMatch(src, /\.from\([^)]+\)\s*\.\s*delete\s*\(/);
    assert.doesNotMatch(src, /apply_migration/);
    assert.doesNotMatch(src, /CREATE TABLE/i);
  }
});

test("6. remote provision gate still denies without Owner GO", async () => {
  const denied = await runFixtureProvisionerCli(["--provision"], {});
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /CORE13_FIXTURE_PROVISION_GO/);
  assert.equal(evaluateRemoteProvisionGate({}).ok, false);
});

test("7. remote provision gate still denies wrong environment/project", () => {
  assert.equal(
    evaluateRemoteProvisionGate({
      ...AUTHORIZED_ENV,
      PICK_VN_ENV: "production",
    }).ok,
    false
  );
  assert.equal(
    evaluateRemoteProvisionGate({
      ...AUTHORIZED_ENV,
      TARGET_PROJECT_REF: "expuvcohlcjzvrrauvud",
    }).ok,
    false
  );
  assert.equal(
    evaluateRemoteProvisionGate({
      ...AUTHORIZED_ENV,
      STAGING_SUPABASE_URL: "https://expuvcohlcjzvrrauvud.supabase.co",
    }).ok,
    false
  );
});

test("8. future authorized path requires authenticated organizer token", () => {
  const noToken = { ...AUTHORIZED_ENV };
  delete noToken.STAGING_ORGANIZER_ACCESS_TOKEN;
  const denied = evaluateRemoteProvisionGate(noToken, { writers: createStubWriters() });
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /organizer token/);
  const ready = evaluateRemoteProvisionGate(AUTHORIZED_ENV, { writers: createStubWriters() });
  assert.equal(ready.ok, true);
  assert.equal(ready.REMOTE_FIXTURE_PROVISION_READY, true);
});

test("9. initializer request carries only canonical client fields", () => {
  const request = buildInitializeMatchExecutionRequest({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    runId: "run-fields",
    accessToken: "token",
    edgeBaseUrl: "https://example.test",
  });
  assert.deepEqual(Object.keys(request).sort(), [
    "accessToken",
    "competitionMode",
    "edgeBaseUrl",
    "idempotencyKey",
    "matchId",
    "tournamentId",
  ]);
  assert.equal(request.competitionMode, "INTERNAL");
  assert.match(request.idempotencyKey, /INITIALIZE_MATCH_EXECUTION_STATE/);
  assert.equal(evaluateInitializerClientFields(request).ok, true);
});

test("10. actor/role/tenant/initialState cannot be caller authority", async () => {
  assert.equal(evaluateForbiddenCallerAuthority({ actor: "x" }).ok, false);
  assert.equal(evaluateForbiddenCallerAuthority({ actorRole: "OWNER" }).ok, false);
  assert.equal(evaluateForbiddenCallerAuthority({ tenantId: "t" }).ok, false);
  assert.equal(evaluateForbiddenCallerAuthority({ initialState: {} }).ok, false);
  const writer = createInitializeMatchExecutionWriter({
    accessToken: "token",
    edgeBaseUrl: "https://example.test",
    initializeExecution: async () => ({ ok: true }),
    getState: async () => ({ ok: false }),
  });
  const denied = await writer({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    actor: "spoof",
    runId: "run-authz",
  });
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /caller authority denied/);
});

test("11. in-progress lifecycle ordering requires identity → initialize → start", async () => {
  const order = [];
  const writers = createStubWriters();
  writers.createInternalMatch = async () => {
    order.push("createInternalMatch");
    return { id: nextUuid(11) };
  };
  writers.initializeMatchExecution = async () => {
    order.push("initializeMatchExecution");
    return { ok: true };
  };
  writers.startMatchLive = async () => {
    order.push("startMatchLive");
    return { ok: true };
  };
  const result = await materializeReceiptFromWriters({
    writers,
    allowExecute: true,
    runId: "run-in-progress-order",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.materializationPaths.inProgress, [
    "createInternalMatch",
    "initializeMatchExecution",
    "startMatchLive",
  ]);
});

test("12. scoring-active lifecycle ordering requires initialize → start → score", async () => {
  const result = await materializeReceiptFromWriters({
    writers: createStubWriters(),
    allowExecute: true,
    runId: "run-scoring-order",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.materializationPaths.scoringActive, [
    "createInternalMatch",
    "initializeMatchExecution",
    "startMatchLive",
    "recordScoreEvent",
  ]);
});

test("13. locked lifecycle ordering requires canonical mutation after init", async () => {
  const result = await materializeReceiptFromWriters({
    writers: createStubWriters(),
    allowExecute: true,
    runId: "run-locked-order",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.materializationPaths.locked, [
    "createInternalMatch",
    "initializeMatchExecution",
    "startMatchLive",
    "pauseMatchLive",
  ]);
});

test("14. completed fixture remains isolated from primary tournament", async () => {
  const result = await materializeReceiptFromWriters({
    writers: createStubWriters(),
    allowExecute: true,
    runId: "run-completed-isolated",
  });
  assert.equal(result.ok, true);
  assert.equal(result.COMPLETED_FIXTURE_ISOLATED, true);
  assert.notEqual(
    result.receipt.matches.completed.tournamentId,
    result.receipt.tournaments.primary.id
  );
  assert.equal(
    result.receipt.matches.completed.tournamentId,
    result.receipt.tournaments.completedLifecycle.id
  );
});

test("15. remote lifecycle proof remains authoritative; no hardcoded PRE_MATCH", () => {
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
  assert.equal(mapAuthoritativeLifecycle({ liveRow: null }), "PRE_MATCH");
});

test("16. typed teardown never force-deletes live execution or immutable history", async () => {
  const receipt = createValidFixtureReceipt({
    runId: "run-typed-teardown",
    assignments: [{ id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000099" }],
  });
  const plan = planTeardown(receipt);
  assert.equal(plan.genericUnassignOverAllReceiptIds, false);
  const resources = plan.steps.map((step) => step.resource);
  assert.ok(resources.includes("liveExecutionArtifacts"));
  assert.ok(resources.includes("retainedImmutableArtifacts"));
  const live = plan.steps.find((step) => step.resource === "liveExecutionArtifacts");
  assert.equal(live.command, "retain");
  assert.ok(live.ids.includes("match_live_states"));
  assert.ok(live.ids.includes("match_sync_mutations"));
  const tournaments = plan.steps.find((step) => step.resource === "tournaments");
  assert.equal(tournaments.command, "retain");
  const deleted = [];
  const result = await teardownFromReceipt({
    receipt,
    allowExecute: true,
    writers: {
      ...createStubWriters(),
      unassignViaTrustedServer: async (args) => args,
      deleteAuthUser: async () => ({ ok: true }),
      deleteTournament: async (args) => {
        deleted.push(args.id);
        return { ok: true };
      },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(deleted, []);
  assert.ok(result.retained.some((row) => row.resource === "liveExecutionArtifacts"));
  assert.ok(result.retained.some((row) => row.resource === "retainedImmutableArtifacts"));
});

test("17. primary tournament remains non-terminal", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-primary-non-terminal" });
  assert.notEqual(receipt.tournaments.primary.terminal, true);
  assert.equal(receipt.tournaments.completedLifecycle.terminal, true);
  receipt.matches.completed.tournamentId = receipt.tournaments.primary.id;
  assert.equal(evaluateFixtureReceipt(receipt).ok, false);
});

test("18. existing 29-case catalog remains exactly 29", () => {
  assert.equal(CASE_CATALOG.length, 29);
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  for (const name of CASE_CATALOG) {
    assert.match(harness, new RegExp(name.replace(/\./g, "\\.")));
  }
});

test("4/5. teardown is typed and never unassigns tenant/user/tournament IDs", async () => {
  const receipt = createValidFixtureReceipt({
    runId: "run-typed-unassign",
    assignments: [{ id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000099" }],
  });
  const unassignStep = planTeardown(receipt).steps.find((step) => step.resource === "assignments");
  assert.ok(!unassignStep.ids.includes(receipt.tenantA.id));
  assert.ok(!unassignStep.ids.includes(receipt.users.userA.id));
  assert.ok(!unassignStep.ids.includes(receipt.tournaments.primary.id));
  assert.equal(
    evaluateTypedTeardownTargets(receipt, [
      { resource: "unassignViaTrustedServer", id: receipt.tenantA.id },
    ]).ok,
    false
  );
});

test("6. immutable history is retained", () => {
  const plan = buildTypedCleanupPlan(createValidFixtureReceipt({ runId: "run-immutable" }));
  const immutable = plan.steps.find((step) => step.resource === "retainedImmutableArtifacts");
  assert.equal(immutable.command, "retain");
  assert.ok(immutable.ids.includes("competition_referee_assignment_audit"));
  assert.equal(plan.immutableHistoryDelete, false);
  assert.equal(plan.liveStateTeardownDirectDelete, false);
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

test("14. authenticated non-mutating Edge probe still precedes first CORE13 mutation", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.match(harness, /getMatchAssignmentVersion/);
  assert.match(harness, /markProbePassed/);
  const gate = createMutationGate();
  assert.equal(gate.assertCanMutate().ok, false);
  gate.markProbePassed();
  assert.equal(gate.assertCanMutate().ok, true);
});

test("plan reports initializer available and denies Team/Daily authority", () => {
  const plan = planFixtureProvision({ writers: createStubWriters() });
  assert.equal(plan.ok, true);
  assert.equal(plan.verdict, "WRITER_COVERAGE_READY");
  assert.equal(plan.SHARED_REFEREE_MATCH_EXECUTION_INITIALIZER, "AVAILABLE");
  assert.equal(plan.CANONICAL_AUTHORITY, "refereeV5EdgeInitializeExecution");
  assert.equal(plan.TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY, "DENY");
  assert.equal(plan.DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY, "DENY");
  assert.equal(plan.INTERNAL_MATCH_WRITER_GAP, null);
});

test("materialize refuses Team and Daily as INTERNAL initializer", async () => {
  const teamBlocked = await materializeReceiptFromWriters({
    writers: {
      ...createStubWriters(),
      provisionLiveMatchShell: async () => ({ id: nextUuid(1) }),
    },
    allowExecute: true,
  });
  assert.equal(teamBlocked.ok, false);
  assert.match(teamBlocked.detail, /TEAM_RPC/);
  const dailyBlocked = await materializeReceiptFromWriters({
    writers: {
      ...createStubWriters(),
      __allowDailyAsInternal: true,
    },
    allowExecute: true,
  });
  assert.equal(dailyBlocked.ok, false);
  assert.match(dailyBlocked.detail, /DAILY_WRITER/);
});

test("aligned remote evidence can pass; mapAuthoritativeLifecycle is honest", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-aligned" });
  assert.equal(
    evaluateReceiptRemoteReconciliation(receipt, buildAlignedRemoteEvidenceForTests(receipt)).ok,
    true
  );
  assert.equal(mapAuthoritativeLifecycle({ liveRow: { status: "paused" } }), "LOCKED");
  assert.equal(
    mapAuthoritativeLifecycle({ liveRow: { status: "in_progress", last_event_sequence: 2 } }),
    "SCORING_ACTIVE"
  );
});

test("node-safe writer audit marks initializer as authenticated Edge client", () => {
  const audit = buildNodeSafeWriterAudit();
  assert.equal(audit.createTenant.nodeBinding, "NODE_SAFE_BINDABLE");
  assert.equal(audit.createAuthUser.nodeBinding, "REQUIRES_IDENTITY_ADMIN_SERVER_CLIENT");
  assert.equal(audit.initializeMatchExecution.nodeBinding, "REQUIRES_AUTHENTICATED_USER_CLIENT");
  assert.equal(audit.initializeMatchExecution.classification, "CANONICAL_PRODUCT_COMMAND");
  assert.equal(audit.teamTournamentProvisionRefereeMatch.forbiddenForInternal, true);
  assert.equal(audit.createDailyPlayMatches.forbiddenAsInternalInitializer, true);
  assert.equal(audit.provisionInternalMatchLiveShell, undefined);
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

test("remote provision CLI still refuses without GO and does not execute when gated", async () => {
  const denied = await runFixtureProvisionerCli(["--provision"], {});
  assert.equal(denied.ok, false);
  const gated = await runFixtureProvisionerCli(["--provision"], AUTHORIZED_ENV, {
    writers: createStubWriters(),
  });
  assert.equal(gated.ok, false);
  assert.match(String(gated.detail || gated.verdict), /not run|allowExecute|NOT_EXECUTED/i);
  assert.notEqual(gated.executed, true);
});

test("CLI with GO still reports missing identity/tenant ports when only Edge writers bind", async () => {
  const gated = await runFixtureProvisionerCli(["--provision"], AUTHORIZED_ENV);
  assert.equal(gated.ok, false);
  assert.match(String(gated.detail || ""), /missing canonical writer ports|organizer token|createTenant/);
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

test("initializer authority path remains fetch-based Edge client", () => {
  assert.equal(INITIALIZER_AUTHORITY, CANONICAL_WRITER_CATALOG.initializeMatchExecution.authority);
  const client = read("src/features/referee-v5/services/refereeV5EdgeClient.js");
  assert.match(client, /export async function refereeV5EdgeInitializeExecution/);
  assert.match(client, /INITIALIZE_EXECUTION:\s*"initialize-execution"/);
});

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
  evaluateLifecycleAssignmentBaselines,
} from "../scripts/core13/core13-staging-fixture-receipt.mjs";
import {
  CANONICAL_WRITER_CATALOG,
  createBootstrapRefereeAssignmentWriter,
  createInitializeMatchExecutionWriter,
  createRefereeV5LifecycleWriters,
  bindSharedRefereeExecutionWriters,
  evaluateDailyWriterDeniedForInternal,
  evaluateForbiddenCallerAuthority,
  evaluateInitializerClientFields,
  evaluateInternalMatchWriterArchitecture,
  evaluateTeamWriterDeniedForInternal,
  evaluateWriterCoverage,
  FORBIDDEN_DIRECT_FINALIZATION_RPC,
  FORBIDDEN_DIRECT_INITIALIZER_RPC,
  HISTORICAL_BLOCKER_CLOSED_BY,
  HISTORICAL_INTERNAL_MATCH_LIVE_SHELL_GAP,
  INITIALIZER_AUTHORITY,
  INITIALIZER_PORT_NAME,
  REQUIRED_WRITER_PORTS,
  EXISTING_QA_MUTATION_PORTS_DENIED,
  buildInitializeMatchExecutionRequest,
  buildNodeSafeWriterAudit,
  REFEREE_V5_ACTIONS,
} from "../scripts/core13/core13-staging-fixture-writers.mjs";
import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../src/features/competition-engine/operations/referee/assignment/constants.js";
import { createReadyDailyPreflightSnapshot } from "../scripts/core13/core13-staging-fixture-preflight.mjs";
import {
  evaluateExistingQaEnvReadiness,
  evaluateExistingQaIdentitySet,
  evaluateOwnerToRefereeFallbackDenied,
  evaluateRefereeAuthContext,
  evaluateVenueAsTenantFallbackDenied,
  FIXTURE_BINDING_MODE,
  INACTIVE_REFEREE_ACCEPTANCE_RULE,
} from "../scripts/core13/core13-staging-qa-auth.mjs";
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
  let seq = 20;
  const writers = {};
  for (const name of REQUIRED_WRITER_PORTS) {
    writers[name] = async () => ({ id: nextUuid(seq++), ok: true, assignmentId: nextUuid(seq++) });
  }
  writers.resolveExistingTenantFixture = async ({ scope } = {}) => ({
    id: scope === "TENANT_B" ? "core13-qa-tenant-b" : "core13-qa-tenant-a",
    tenantId: scope === "TENANT_B" ? "core13-qa-tenant-b" : "core13-qa-tenant-a",
    ok: true,
  });
  writers.resolveQaIdentitySet = async () => ({
    ok: true,
    organizerA: {
      userId: "11111111-1111-4111-8111-111111111111",
      tenantId: "core13-qa-tenant-a",
      role: "VENUE_OWNER",
      credentialPresent: true,
    },
    organizerB: {
      userId: "22222222-2222-4222-8222-222222222222",
      tenantId: "core13-qa-tenant-b",
      role: "VENUE_OWNER",
      credentialPresent: true,
    },
    refereeA: {
      userId: "33333333-3333-4333-8333-333333333333",
      tenantId: "core13-qa-tenant-a",
      role: "REFEREE",
      status: "ACTIVE",
      credentialPresent: true,
    },
    replacementReferee: {
      userId: "44444444-4444-4444-8444-444444444444",
      tenantId: "core13-qa-tenant-a",
      role: "REFEREE",
      status: "ACTIVE",
    },
    inactiveReferee: {
      userId: "55555555-5555-4555-8555-555555555555",
      tenantId: "core13-qa-tenant-a",
      role: "REFEREE",
      status: "suspended",
      contract01Evidence: {
        subjectId: "55555555-5555-4555-8555-555555555555",
        canonicalSubjectId: "55555555-5555-4555-8555-555555555555",
        role: "REFEREE",
        status: "suspended",
        active: false,
        tenantId: "core13-qa-tenant-a",
        venueId: null,
        source: "identity",
      },
    },
    nonCanonicalSubject: {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      classification: "NON_CANONICAL_EXPECTED_ABSENT",
    },
  });
  writers.resolveDailyPlayPreflight = async ({ tenantId } = {}) =>
    createReadyDailyPreflightSnapshot({
      tenantId: tenantId || "core13-qa-tenant-a",
      clubTenantId: tenantId || "core13-qa-tenant-a",
    });
  return writers;
}

const ORGANIZER_CONTEXT = Object.freeze({
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "core13-qa-tenant-a",
  role: "VENUE_OWNER",
  accessToken: "org-tok",
});

const REFEREE_CONTEXT = Object.freeze({
  userId: "33333333-3333-4333-8333-333333333333",
  tenantId: "core13-qa-tenant-a",
  role: "REFEREE",
  accessToken: "ref-tok",
});

const AUTHORIZED_ENV = Object.freeze({
  CORE13_FIXTURE_PROVISION_GO: "YES",
  STAGING_MUTATION_GO: "YES",
  PICK_VN_ENV: "staging",
  TARGET_PROJECT_REF: STAGING_PROJECT_REF,
  STAGING_ORGANIZER_ACCESS_TOKEN: "org-tok",
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
      assert.doesNotMatch(src, new RegExp(FORBIDDEN_DIRECT_FINALIZATION_RPC));
    }
  }
  const writers = read("scripts/core13/core13-staging-fixture-writers.mjs");
  assert.match(writers, /refereeV5EdgeInitializeExecution/);
  assert.match(writers, /FORBIDDEN_DIRECT_INITIALIZER_RPC/);
  assert.match(writers, /FORBIDDEN_DIRECT_FINALIZATION_RPC/);
  assert.match(writers, /refereeV5EdgeFinalize/);
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

test("8. future authorized path requires organizer and referee auth contexts", () => {
  const denied = evaluateRemoteProvisionGate(AUTHORIZED_ENV, { writers: createStubWriters() });
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /organizer context|REFEREE/);
  const ready = evaluateRemoteProvisionGate(AUTHORIZED_ENV, {
    writers: createStubWriters(),
    organizerContext: ORGANIZER_CONTEXT,
    refereeContext: REFEREE_CONTEXT,
  });
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
    "bootstrapRefereeAssignment",
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
    "bootstrapRefereeAssignment",
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
    "bootstrapRefereeAssignment",
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
  assert.deepEqual(result.materializationPaths.completed, [
    "createInternalMatch",
    "initializeMatchExecution",
    "bootstrapRefereeAssignment",
    "startMatchLive",
    "declareForfeit",
    "finalizeMatchLive",
  ]);
  assert.equal(result.COMPLETED_MATCH_EXECUTION, "CANONICAL_REFEREE_V5_FINALIZE");
  assert.notEqual(result.COMPLETED_MATERIALIZATION_PATH, "completeIsolatedTournament");
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
    mapAuthoritativeLifecycle({
      liveRow: { status: "in_progress", last_event_sequence: 1 },
    }),
    "IN_PROGRESS"
  );
  assert.equal(
    mapAuthoritativeLifecycle({
      liveRow: { status: "in_progress", last_event_sequence: 2 },
      events: [{ command_type: "TEAM_A_WON_RALLY" }],
    }),
    "SCORING_ACTIVE"
  );
});

test("node-safe writer audit marks initializer as authenticated Edge client", () => {
  const audit = buildNodeSafeWriterAudit();
  assert.equal(audit.createTenant.nodeBinding, "BROWSER_SINGLETON_DEPENDENT");
  assert.equal(audit.createTenant.requiredInExistingQa, false);
  assert.equal(audit.createAuthUser.nodeBinding, "REQUIRES_IDENTITY_ADMIN_SERVER_CLIENT");
  assert.equal(audit.createAuthUser.requiredInExistingQa, false);
  assert.equal(audit.initializeMatchExecution.nodeBinding, "REQUIRES_AUTHENTICATED_USER_CLIENT");
  assert.equal(audit.initializeMatchExecution.classification, "CANONICAL_PRODUCT_COMMAND");
  assert.equal(audit.bootstrapRefereeAssignment.tokenClass, "ORGANIZER");
  assert.equal(audit.startMatchLive.tokenClass, "REFEREE");
  assert.equal(audit.finalizeMatchLive.tokenClass, "REFEREE");
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
  const missingReferee = await runFixtureProvisionerCli(["--provision"], AUTHORIZED_ENV, {
    writers: createStubWriters(),
  });
  assert.equal(missingReferee.ok, false);
  assert.match(String(missingReferee.detail || missingReferee.verdict), /REFEREE|organizer context/i);
  assert.notEqual(missingReferee.executed, true);
  const gated = await runFixtureProvisionerCli(["--provision"], AUTHORIZED_ENV, {
    writers: createStubWriters(),
    organizerContext: ORGANIZER_CONTEXT,
    refereeContext: REFEREE_CONTEXT,
  });
  assert.equal(gated.ok, false);
  assert.match(String(gated.detail || gated.verdict), /not run|allowExecute|NOT_EXECUTED/i);
  assert.notEqual(gated.executed, true);
});

test("CLI with GO still reports missing auth context or writer ports when unbound", async () => {
  const gated = await runFixtureProvisionerCli(["--provision"], AUTHORIZED_ENV);
  assert.equal(gated.ok, false);
  assert.match(String(gated.detail || ""), /organizer context|REFEREE|missing canonical writer ports/);
});

test("secrets stay out of receipts; hydrate uses completedLifecycle", () => {
  const dirty = {
    ...createValidFixtureReceipt({ runId: "run-secret" }),
    authorization: "redacted-secret-value",
  };
  assert.equal(receiptContainsSecrets(dirty), true);
  assert.equal(stripReceiptSecrets(dirty).authorization, undefined);
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

test("auth contexts stay separated; organizer cannot impersonate referee lifecycle", async () => {
  const orgTok = ORGANIZER_CONTEXT.accessToken;
  const impersonated = evaluateRefereeAuthContext(
    { ...ORGANIZER_CONTEXT, role: "REFEREE", accessToken: orgTok },
    ORGANIZER_CONTEXT
  );
  assert.equal(impersonated.ok, false);
  const lifecycle = createRefereeV5LifecycleWriters({
    organizerAccessToken: orgTok,
    edgeBaseUrl: "https://example.test",
  });
  const startDenied = await lifecycle.startMatchLive({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    bootstrapAssignmentProof: { assignmentId: nextUuid(3) },
  });
  assert.equal(startDenied.ok, false);
  assert.match(startDenied.detail, /ORGANIZER_AS_REFEREE_IMPERSONATION|referee token/);
  const bound = bindSharedRefereeExecutionWriters({
    organizerAccessToken: orgTok,
    edgeBaseUrl: "https://example.test",
  });
  assert.equal(bound.lifecycleBound, false);
  assert.equal(typeof bound.startMatchLive, "undefined");
  assert.equal(typeof bound.initializeMatchExecution, "function");
});

test("bootstrap assignment uses organizer token and refuses non-PRE_MATCH state", async () => {
  const orgTok = ORGANIZER_CONTEXT.accessToken;
  const calls = [];
  const writer = createBootstrapRefereeAssignmentWriter({
    organizerAccessToken: orgTok,
    edgeBaseUrl: "https://example.test",
    createClient: () => ({
      getMatchAssignmentVersion: async () => ({ ok: true, version: 0 }),
      assignReferee: async (command) => {
        calls.push(command);
        return { ok: true, assignmentId: nextUuid(8) };
      },
    }),
  });
  const denied = await writer({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    refereeId: REFEREE_CONTEXT.userId,
    lifecycleState: "IN_PROGRESS",
  });
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /PRE_MATCH/);
  const ok = await writer({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    refereeId: REFEREE_CONTEXT.userId,
    lifecycleState: "PRE_MATCH",
    runId: "run-bootstrap",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.tokenClass, "ORGANIZER");
  assert.equal(ok.assignmentId, nextUuid(8));
  assert.equal(ok.expectedVersion, 0);
  assert.equal(ok.BOOTSTRAP_EXPECTED_VERSION_SOURCE, "CANONICAL_AUTHORITATIVE_ASSIGNMENT_STATE");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].expectedVersion, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], "tenantId"), false);
});

test("referee lifecycle refuses to run before bootstrap assignment proof", async () => {
  const refTok = REFEREE_CONTEXT.accessToken;
  const lifecycle = createRefereeV5LifecycleWriters({
    refereeAccessToken: refTok,
    edgeBaseUrl: "https://example.test",
    applyCommand: async () => ({ ok: true }),
    finalize: async () => ({ ok: true }),
  });
  const denied = await lifecycle.startMatchLive({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
  });
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /bootstrap assignment proof/);
  const started = await lifecycle.startMatchLive({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    bootstrapAssignmentProof: { assignmentId: nextUuid(9), active: true },
    runId: "run-lifecycle-proof",
  });
  assert.equal(started.ok, true);
});

test("EXISTING_QA_IDENTITY_MODE does not call identity/tenant mutation ports", async () => {
  const writers = createStubWriters();
  const calls = [];
  for (const name of EXISTING_QA_MUTATION_PORTS_DENIED) {
    writers[name] = async () => {
      calls.push(name);
      return { id: nextUuid(70), ok: true };
    };
  }
  const result = await materializeReceiptFromWriters({
    writers,
    allowExecute: true,
    runId: "run-existing-qa",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, []);
  assert.equal(result.identityMode, FIXTURE_BINDING_MODE.EXISTING_QA_IDENTITY);
});

test("missing existing QA referee credential fails closed", () => {
  const env = evaluateExistingQaEnvReadiness({
    STAGING_OWNER_A_EMAIL: "a@example.test",
    STAGING_OWNER_A_PASSWORD: "x",
    STAGING_OWNER_B_EMAIL: "b@example.test",
    STAGING_OWNER_B_PASSWORD: "y",
  });
  assert.equal(env.ok, false);
  assert.match(env.detail, /MISSING_EXISTING_QA_REFEREE_CREDENTIAL/);
  assert.equal(evaluateOwnerToRefereeFallbackDenied({
    STAGING_REFEREE_EMAIL: "a@example.test",
    STAGING_OWNER_A_EMAIL: "a@example.test",
  }).ok, false);
});

test("missing inactive referee or second tenant fails closed", () => {
  assert.equal(INACTIVE_REFEREE_ACCEPTANCE_RULE.literalInactiveRequired, false);
  const missingInactive = evaluateExistingQaIdentitySet({
    organizerA: { userId: ORGANIZER_CONTEXT.userId, tenantId: "t-a" },
    organizerB: { userId: REFEREE_CONTEXT.userId, tenantId: "t-b" },
    refereeA: {
      userId: REFEREE_CONTEXT.userId,
      tenantId: "t-a",
      role: "REFEREE",
      status: "ACTIVE",
      credentialPresent: true,
      accessToken: "r",
    },
    replacementReferee: {
      userId: "44444444-4444-4444-8444-444444444444",
      role: "REFEREE",
      status: "ACTIVE",
    },
    inactiveReferee: { userId: "55555555-5555-4555-8555-555555555555", role: "REFEREE", status: "ACTIVE" },
  });
  assert.equal(missingInactive.ok, false);
  assert.match(missingInactive.detail, /INACTIVE/);
  const sameTenant = evaluateExistingQaIdentitySet({
    organizerA: { userId: ORGANIZER_CONTEXT.userId, tenantId: "t-a" },
    organizerB: { userId: "22222222-2222-4222-8222-222222222222", tenantId: "t-a" },
    refereeA: {
      userId: REFEREE_CONTEXT.userId,
      tenantId: "t-a",
      role: "REFEREE",
      status: "ACTIVE",
      credentialPresent: true,
    },
    replacementReferee: {
      userId: "44444444-4444-4444-8444-444444444444",
      role: "REFEREE",
      status: "ACTIVE",
    },
    inactiveReferee: {
      userId: "55555555-5555-4555-8555-555555555555",
      role: "REFEREE",
      status: "INACTIVE",
    },
  });
  assert.equal(sameTenant.ok, false);
  assert.equal(evaluateVenueAsTenantFallbackDenied({ venueId: "venue-1", tenantId: "" }).ok, false);
});

test("receipt assignment baselines keep primary clean and J cases bootstrapped", async () => {
  const result = await materializeReceiptFromWriters({
    writers: createStubWriters(),
    allowExecute: true,
    runId: "run-baselines",
  });
  assert.equal(result.ok, true);
  const baselines = evaluateLifecycleAssignmentBaselines(result.receipt);
  assert.equal(baselines.ok, true);
  assert.equal(baselines.primaryMatchActiveAssignments, 0);
  assert.equal(baselines.matchInProgressActiveAssignments, 1);
  assert.equal(baselines.matchScoringActiveAssignments, 1);
  assert.equal(baselines.PRIMARY_TOURNAMENT_REMAINS_NON_TERMINAL, true);
  assert.equal(baselines.COMPLETED_FIXTURE_ISOLATED, true);
});

test("remote CLI mock execution path materializes a sanitized receipt", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "core13-cli-"));
  const executed = await runFixtureProvisionerCli(["--provision"], AUTHORIZED_ENV, {
    allowExecute: true,
    writers: createStubWriters(),
    organizerContext: ORGANIZER_CONTEXT,
    refereeContext: REFEREE_CONTEXT,
    rootDir: dir,
    runId: "run-cli-executed",
  });
  assert.equal(executed.ok, true);
  assert.equal(executed.executed, true);
  assert.equal(executed.verdict, "REMOTE_FIXTURE_PROVISION_EXECUTED");
  assert.equal(existsSync(executed.receiptPath), true);
  assert.equal(receiptContainsSecrets(executed.receipt), false);
  const deniedGo = await runFixtureProvisionerCli(["--provision"], {}, {
    allowExecute: true,
    writers: createStubWriters(),
    organizerContext: ORGANIZER_CONTEXT,
    refereeContext: REFEREE_CONTEXT,
  });
  assert.equal(deniedGo.ok, false);
  const deniedProject = await runFixtureProvisionerCli(
    ["--provision"],
    { ...AUTHORIZED_ENV, TARGET_PROJECT_REF: "not-staging" },
    {
      allowExecute: true,
      writers: createStubWriters(),
      organizerContext: ORGANIZER_CONTEXT,
      refereeContext: REFEREE_CONTEXT,
    }
  );
  assert.equal(deniedProject.ok, false);
  const deniedProd = evaluateRemoteProvisionGate(
    { ...AUTHORIZED_ENV, STAGING_SUPABASE_URL: "https://expuvcohlcjzvrrauvud.supabase.co" },
    {
      writers: createStubWriters(),
      organizerContext: ORGANIZER_CONTEXT,
      refereeContext: REFEREE_CONTEXT,
    }
  );
  assert.equal(deniedProd.ok, false);
  const deniedMissingWriter = await runFixtureProvisionerCli(["--provision"], AUTHORIZED_ENV, {
    allowExecute: true,
    writers: { createCanonicalTournament: async () => ({ id: nextUuid(1) }) },
    organizerContext: ORGANIZER_CONTEXT,
    refereeContext: REFEREE_CONTEXT,
  });
  assert.equal(deniedMissingWriter.ok, false);
  const deniedNoExecute = await runFixtureProvisionerCli(["--provision"], AUTHORIZED_ENV, {
    writers: createStubWriters(),
    organizerContext: ORGANIZER_CONTEXT,
    refereeContext: REFEREE_CONTEXT,
  });
  assert.equal(deniedNoExecute.ok, false);
  assert.notEqual(deniedNoExecute.executed, true);
});

test("finalize remains referee-owned and does not use forceComplete", async () => {
  const refTok = REFEREE_CONTEXT.accessToken;
  const orgTok = ORGANIZER_CONTEXT.accessToken;
  const seen = [];
  const lifecycle = createRefereeV5LifecycleWriters({
    refereeAccessToken: refTok,
    edgeBaseUrl: "https://example.test",
    finalize: async (request) => {
      seen.push(request);
      return { ok: true, status: "completed" };
    },
  });
  const organizerFinalize = createRefereeV5LifecycleWriters({
    organizerAccessToken: orgTok,
    edgeBaseUrl: "https://example.test",
    finalize: async (request) => {
      seen.push(request);
      return { ok: true };
    },
  });
  const denied = await organizerFinalize.finalizeMatchLive({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    bootstrapAssignmentProof: { assignmentId: nextUuid(3) },
  });
  assert.equal(denied.ok, false);
  const ok = await lifecycle.finalizeMatchLive({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    expectedVersion: 4,
    bootstrapAssignmentProof: { assignmentId: nextUuid(3) },
    runId: "run-finalize",
  });
  assert.equal(ok.ok, true);
  assert.equal(seen[0].forceComplete, false);
  assert.equal(seen[0].accessToken, refTok);
  const src = read("scripts/core13/core13-staging-fixture-writers.mjs");
  assert.doesNotMatch(src, /\.rpc\s*\(\s*["']referee_v5_commit_match_finalization["']/);
});

test("bootstrap assignment reads authoritative version and does not hardcode expectedVersion", async () => {
  const assignCalls = [];
  const versionCalls = [];
  const writer = createBootstrapRefereeAssignmentWriter({
    organizerAccessToken: ORGANIZER_CONTEXT.accessToken,
    edgeBaseUrl: "https://example.test",
    createClient: () => ({
      getMatchAssignmentVersion: async (command) => {
        versionCalls.push(command);
        return { ok: true, version: 3 };
      },
      assignReferee: async (command) => {
        assignCalls.push(command);
        return { ok: true, assignmentId: nextUuid(9) };
      },
    }),
  });
  const ok = await writer({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    refereeId: REFEREE_CONTEXT.userId,
    lifecycleState: "PRE_MATCH",
    runId: "run-cas",
  });
  assert.equal(ok.ok, true);
  assert.equal(versionCalls.length, 1);
  assert.equal(assignCalls[0].expectedVersion, 3);
  assert.equal(ok.expectedVersion, 3);
  assert.notEqual(assignCalls[0].expectedVersion, undefined);

  const missingReader = createBootstrapRefereeAssignmentWriter({
    organizerAccessToken: ORGANIZER_CONTEXT.accessToken,
    edgeBaseUrl: "https://example.test",
    createClient: () => ({
      assignReferee: async () => ({ ok: true, assignmentId: nextUuid(9) }),
    }),
  });
  const deniedReader = await missingReader({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    refereeId: REFEREE_CONTEXT.userId,
    lifecycleState: "PRE_MATCH",
    runId: "run-cas",
  });
  assert.equal(deniedReader.ok, false);
  assert.equal(deniedReader.code, ASSIGNMENT_COMMAND_ERROR_CODE.EXPECTED_VERSION_REQUIRED);

  const missingVersion = createBootstrapRefereeAssignmentWriter({
    organizerAccessToken: ORGANIZER_CONTEXT.accessToken,
    edgeBaseUrl: "https://example.test",
    createClient: () => ({
      getMatchAssignmentVersion: async () => ({ ok: true }),
      assignReferee: async () => ({ ok: true, assignmentId: nextUuid(9) }),
    }),
  });
  const deniedVersion = await missingVersion({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    refereeId: REFEREE_CONTEXT.userId,
    lifecycleState: "PRE_MATCH",
    runId: "run-cas",
  });
  assert.equal(deniedVersion.ok, false);
  assert.equal(deniedVersion.code, ASSIGNMENT_COMMAND_ERROR_CODE.EXPECTED_VERSION_REQUIRED);
  assert.equal(CASE_CATALOG.length, 29);
});

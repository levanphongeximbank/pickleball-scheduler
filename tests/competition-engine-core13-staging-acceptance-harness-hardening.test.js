/**
 * CORE-13 Staging acceptance harness hardening — false-positive proofs cannot PASS.
 * Local only. Does not execute the live Staging harness.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
  CORE13_AUTHORITATIVE_EXECUTION_LOCATION,
} from "../src/features/competition-engine/operations/referee/assignment/constants.js";
import {
  CASE_CATALOG,
  CORE13_FIXTURE_NAMESPACE,
  DENIAL_CODES,
  createMutationGate,
  evaluateActiveLeftovers,
  evaluateAtomicReplacePass,
  evaluateAuditDeleteForbidden,
  evaluateAuthenticatedRuntimeProbe,
  evaluateBaselineKnownStart,
  evaluateBrowserAuditDenied,
  evaluateCasCorrectPass,
  evaluateCatalogExecution,
  evaluateDailyEnabledPass,
  evaluateDenial,
  evaluateDurableAssignment,
  evaluateDurableAuditActor,
  evaluateDurableIdempotency,
  evaluateExactlyOneActive,
  evaluateFixtureNamespace,
  evaluateServiceEvidenceTestOnly,
  evaluateCasePreconditionDrift,
  evaluateStopOnFirstFailure,
  evaluateTeardownDiscovery,
  createAcceptanceRunState,
  createAssignmentMutationLedger,
  mergeTeardownTargets,
  CASE_NOT_EXECUTED_AFTER_FIRST_FAILURE,
  runWithFinalization,
} from "../scripts/core13/core13-staging-acceptance-proofs.mjs";

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

test("catalog is exactly 29 cases", () => {
  assert.equal(CASE_CATALOG.length, 29);
  assert.equal(new Set(CASE_CATALOG).size, 29);
});

test("atomic replace error cannot PASS", () => {
  const failed = evaluateAtomicReplacePass({
    status: 400,
    payload: { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE },
  });
  assert.equal(failed.ok, false);
  function previousTautology(ok) {
    return ok === true || ok === false;
  }
  assert.equal(previousTautology(false), true);
  assert.notEqual(failed.ok, previousTautology(false));
});

test("correct CAS INVALID_INPUT cannot PASS", () => {
  const proof = evaluateCasCorrectPass(
    {
      status: 400,
      payload: { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT },
    },
    1
  );
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /INVALID_INPUT_NOT_SUCCESS/);
});

test("CAS STALE_WRITE cannot PASS the correct-version case", () => {
  const proof = evaluateCasCorrectPass(
    {
      status: 409,
      payload: { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE },
    },
    1
  );
  assert.equal(proof.ok, false);
});

test("CAS success requires version advance", () => {
  const proof = evaluateCasCorrectPass(
    {
      status: 200,
      payload: {
        ok: true,
        version: 2,
        core13Executed: true,
        authoritativeExecutionLocation: CORE13_AUTHORITATIVE_EXECUTION_LOCATION,
      },
    },
    1
  );
  assert.equal(proof.ok, true);
  const staleVersion = evaluateCasCorrectPass(
    {
      status: 200,
      payload: { ok: true, version: 1, core13Executed: true },
    },
    1
  );
  assert.equal(staleVersion.ok, false);
});

test("zero active assignments cannot satisfy exactly-one case", () => {
  const proof = evaluateExactlyOneActive([], {
    matchId: "CORE13_STAGING_ACCEPTANCE-match",
    refereeId: "ref-a",
    version: 2,
  });
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /active=0/);
});

test("exactly one active requires matching referee/version", () => {
  const rows = [
    {
      match_id: "CORE13_STAGING_ACCEPTANCE-match",
      referee_user_id: "ref-b",
      status: "active",
      version: 2,
      role: "REFEREE",
    },
  ];
  assert.equal(
    evaluateExactlyOneActive(rows, {
      matchId: "CORE13_STAGING_ACCEPTANCE-match",
      refereeId: "ref-b",
      version: 2,
      role: "PRIMARY",
    }).ok,
    true
  );
  assert.equal(
    evaluateExactlyOneActive(rows, {
      matchId: "CORE13_STAGING_ACCEPTANCE-match",
      refereeId: "ref-a",
      version: 2,
    }).ok,
    false
  );
});

test("Daily enabled generic failure cannot PASS", () => {
  const proof = evaluateDailyEnabledPass({
    status: 400,
    payload: { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT },
  });
  assert.equal(proof.ok, false);
  function previousDailyTautology(payload) {
    return payload.core13Executed === true || payload.ok === false;
  }
  assert.equal(previousDailyTautology({ core13Executed: true, ok: false }), true);
  assert.equal(proof.ok, false);
});

test("Daily enabled requires trusted-server proof fields", () => {
  assert.equal(
    evaluateDailyEnabledPass({
      status: 200,
      payload: {
        ok: true,
        core13Executed: true,
        authoritativeExecutionLocation: CORE13_AUTHORITATIVE_EXECUTION_LOCATION,
        endpoint: COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
      },
    }).ok,
    true
  );
  assert.equal(
    evaluateDailyEnabledPass({
      status: 200,
      payload: {
        ok: true,
        core13Executed: true,
        authoritativeExecutionLocation: "BROWSER",
        endpoint: COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
      },
    }).ok,
    false
  );
});

test("denial case with wrong error code cannot PASS", () => {
  const proof = evaluateDenial(
    {
      status: 400,
      payload: { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT },
    },
    DENIAL_CODES.CROSS_TENANT
  );
  assert.equal(proof.ok, false);
  assert.equal(
    evaluateDenial(
      {
        status: 403,
        payload: { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED },
      },
      DENIAL_CODES.CROSS_TENANT
    ).ok,
    true
  );
});

test("qualification/availability denials accept existing fail-closed codes only", () => {
  assert.equal(
    evaluateDenial(
      {
        status: 422,
        payload: { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED },
      },
      DENIAL_CODES.QUALIFICATION_MISSING
    ).ok,
    true
  );
  assert.equal(
    evaluateDenial(
      {
        status: 422,
        payload: { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED },
      },
      DENIAL_CODES.QUALIFICATION_MISSING
    ).ok,
    true
  );
  assert.equal(
    evaluateDenial(
      {
        status: 422,
        payload: { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE },
      },
      DENIAL_CODES.QUALIFICATION_MISSING
    ).ok,
    false
  );
});

test("ok=false without a code cannot PASS a denial", () => {
  assert.equal(
    evaluateDenial({ status: 400, payload: { ok: false } }, DENIAL_CODES.STALE_WRITE).ok,
    false
  );
});

test("missing fixture receipt ownership stops before mutation", () => {
  const proof = evaluateFixtureNamespace(
    [
      { label: "STAGING_MATCH_A", id: "owner-business-match-1", required: true },
      { label: "STAGING_TOURNAMENT_A", id: "owner-business-tournament", required: true },
    ],
    CORE13_FIXTURE_NAMESPACE
  );
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /UUID_ID_NAMESPACE_TEXT_REQUIREMENT_REMOVED/);
  const gate = createMutationGate();
  assert.equal(gate.assertCanMutate().ok, false);
});

test("canonical UUID IDs are not required to contain namespace text", () => {
  const proof = evaluateFixtureNamespace(
    [
      {
        label: "STAGING_MATCH_A",
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        required: true,
      },
    ],
    CORE13_FIXTURE_NAMESPACE
  );
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /fixture receipt/);
});

test("authenticated runtime probe required before first mutation", () => {
  const gate = createMutationGate();
  assert.equal(gate.assertCanMutate().ok, false);
  assert.match(gate.assertCanMutate().detail, /AUTHENTICATED_NON_MUTATING_EDGE_PROBE_REQUIRED/);
  gate.markProbePassed();
  assert.equal(gate.assertCanMutate().ok, true);
});

test("authenticated probe rejects EDGE_RUNTIME_ERROR and module resolution", () => {
  assert.equal(
    evaluateAuthenticatedRuntimeProbe({
      status: 500,
      payload: { ok: false, code: "EDGE_RUNTIME_ERROR" },
    }).ok,
    false
  );
  assert.equal(
    evaluateAuthenticatedRuntimeProbe({
      status: 500,
      payload: { ok: false, error: "Cannot find module 'auth/supabaseClient.js'" },
    }).ok,
    false
  );
  assert.equal(
    evaluateAuthenticatedRuntimeProbe({
      status: 200,
      payload: { ok: true, action: "getMatchAssignmentVersion", version: 0 },
    }).ok,
    true
  );
});

test("teardown/finalization runs on case failure", async () => {
  let torn = false;
  await assert.rejects(
    () =>
      runWithFinalization(
        async () => {
          throw new Error("case fail");
        },
        async () => {
          torn = true;
        }
      ),
    /case fail/
  );
  assert.equal(torn, true);
});

test("unknown baseline is refused rather than auto-cleaned", () => {
  const proof = evaluateBaselineKnownStart(3, 0, "matchA");
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /refuse auto-clean/);
});

test("service evidence inspection is test-only", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  const client = read(
    "src/features/competition-engine/operations/referee/assignment/client/competitionRefereeAssignmentEdgeClient.js"
  );
  const proof = evaluateServiceEvidenceTestOnly(client, harness);
  assert.equal(proof.ok, true);
  assert.match(harness, /test evidence only/);
  assert.doesNotMatch(client, /STAGING_SERVICE_ROLE_KEY/);
});

test("audit immutable history is not deleted", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  const proofs = read("scripts/core13/core13-staging-acceptance-proofs.mjs");
  assert.equal(evaluateAuditDeleteForbidden(harness).ok, true);
  assert.equal(evaluateAuditDeleteForbidden(proofs).ok, true);
  assert.equal(
    evaluateAuditDeleteForbidden("delete from public.competition_referee_assignment_audit").ok,
    false
  );
});

test("active assignment fixture leftovers are detected", () => {
  assert.equal(evaluateActiveLeftovers([]).ok, true);
  assert.equal(
    evaluateActiveLeftovers([{ id: "leftover", status: "active" }]).ok,
    false
  );
  assert.match(
    evaluateActiveLeftovers([{ id: "leftover" }]).detail,
    /ACTIVE_ASSIGNMENT_FIXTURE_LEFTOVERS=1/
  );
});

test("durable assignment and audit actor proofs", () => {
  assert.equal(evaluateDurableAssignment([], { matchId: "m1" }).ok, false);
  assert.equal(
    evaluateDurableAuditActor(
      [
        {
          actor_id: "user-a",
          tenant_id: "t",
          tournament_id: "tr",
          match_id: "m",
          operation: "ASSIGN",
        },
      ],
      { actorId: "user-a", tenantId: "t", tournamentId: "tr", matchId: "m", operation: "ASSIGN" }
    ).ok,
    true
  );
  assert.equal(
    evaluateDurableAuditActor(
      [
        {
          actor_id: "user-b",
          tenant_id: "t",
          tournament_id: "tr",
          match_id: "m",
          operation: "ASSIGN",
        },
      ],
      { actorId: "user-a", tenantId: "t", tournamentId: "tr", matchId: "m" }
    ).ok,
    false
  );
});

test("idempotency conflict must not create a second mutation", () => {
  assert.equal(evaluateDurableIdempotency(1, 1, 0).ok, true);
  assert.equal(evaluateDurableIdempotency(1, 1, 1).ok, false);
  assert.equal(evaluateDurableIdempotency(1, 2, 0).ok, false);
});

test("browser audit deny requires service evidence and no browser rows", () => {
  assert.equal(evaluateBrowserAuditDenied({ data: [] }, []).ok, false);
  assert.equal(
    evaluateBrowserAuditDenied({ data: [{ id: "x" }] }, [{ id: "x" }]).ok,
    false
  );
  assert.equal(
    evaluateBrowserAuditDenied({ data: [], error: { message: "permission" } }, [{ id: "x" }])
      .ok,
    true
  );
});

test("catalog execution rejects SKIP/NOT_RUN/INCONCLUSIVE", () => {
  const rows = CASE_CATALOG.map((name) => ({ name, ok: true }));
  rows[0] = { name: CASE_CATALOG[0], ok: true, status: "SKIP" };
  assert.equal(evaluateCatalogExecution(rows).ok, false);
});

test("harness source keeps 29-case names, probe-before-mutation, and finally teardown", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.equal(existsSync(path.join(ROOT, "scripts/core13/core13-staging-acceptance-proofs.mjs")), true);
  assert.match(harness, /CORE13_STAGING_ACCEPTANCE_GO/);
  assert.match(harness, /getMatchAssignmentVersion/);
  assert.match(harness, /runWithFinalization/);
  assert.match(harness, /evaluateCasCorrectPass/);
  assert.match(harness, /evaluateAtomicReplacePass/);
  assert.match(harness, /evaluateExactlyOneActive/);
  assert.match(harness, /evaluateDailyEnabledPass/);
  assert.match(harness, /STAGING_REPLACE_REFEREE_USER_ID/);
  assert.match(harness, /CORE13_FIXTURE_NAMESPACE/);
  assert.match(harness, /CORE13_FIXTURE_RECEIPT_PATH/);
  assert.match(harness, /evaluateReceiptRemoteReconciliation/);
  assert.match(harness, /evaluateManualFixtureOverride/);
  assert.doesNotMatch(harness, /evaluateFixtureNamespace/);
  assert.match(harness, /ACTIVE_ASSIGNMENT_FIXTURE_LEFTOVERS/);
  assert.doesNotMatch(harness, /ok === true \|\| .*ok === false/);
  assert.doesNotMatch(harness, /CORE13_ASSIGNMENT_INVALID_INPUT/);
  assert.doesNotMatch(harness, /activeForMatch\.length <= 1/);
  assert.doesNotMatch(harness, /eyJ[A-Za-z0-9_-]{20,}/);
  assert.match(harness, /STOP_AFTER_FIRST_FAILURE/);
  assert.match(harness, /createAssignmentMutationLedger/);
  assert.match(harness, /evaluateCasePreconditionDrift/);
  assert.match(harness, /NOT_EXECUTED_AFTER_FIRST_FAILURE/);
  for (const name of CASE_CATALOG) {
    assert.match(harness, new RegExp(name.replace(/\./g, "\\.")));
  }
});

test("product UI still does not hold service-role evidence inspection", () => {
  const roots = [
    path.join(ROOT, "src/features/competition-engine/operations/referee/assignment/client"),
  ];
  for (const root of roots) {
    for (const file of walk(root)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /STAGING_SERVICE_ROLE_KEY/);
      assert.doesNotMatch(src, /competition_referee_assignment_audit/);
    }
  }
});

test("case E unexpected mutation stops later cases", () => {
  const run = createAcceptanceRunState(CASE_CATALOG);
  let nextInvoked = false;
  run.record(
    "E.cross-tournament-denied",
    evaluateDenial(
      { status: 200, payload: { ok: true, code: "" } },
      DENIAL_CODES.CROSS_TOURNAMENT
    ),
    { expectedDenial: true, mutatingUnexpectedSuccess: true }
  );
  if (run.shouldContinue()) nextInvoked = true;
  assert.equal(nextInvoked, false);
  const sealed = run.seal();
  assert.equal(sealed.firstFailure.name, "E.cross-tournament-denied");
  assert.equal(sealed.stopReason, "FIRST_MUTATING_UNEXPECTED_SUCCESS");
  assert.equal(sealed.failCount, 1);
  assert.equal(sealed.unexecutedCount, 28);
  assert.equal(
    sealed.results.find((row) => row.name === "G.cas-correct-expected-version-pass").status,
    CASE_NOT_EXECUTED_AFTER_FIRST_FAILURE
  );
  assert.equal(
    evaluateStopOnFirstFailure({
      firstFailure: sealed.firstFailure,
      remainingInvoked: nextInvoked,
      stopReason: sealed.stopReason,
    }).ok,
    true
  );
  assert.equal(evaluateCatalogExecution(sealed.results).ok, true);
});

test("mutating cases refuse CASE_PRECONDITION_DRIFT", () => {
  const drift = evaluateCasePreconditionDrift(1, 0, "matchA");
  assert.equal(drift.ok, false);
  assert.match(drift.detail, /CASE_PRECONDITION_DRIFT/);
  assert.equal(evaluateCasePreconditionDrift(0, 0, "matchA").ok, true);
});

test("teardown discovery includes primary, cross-tournament, daily, replacement and never unrelated", () => {
  const ledger = createAssignmentMutationLedger();
  ledger.registerSuccessfulMutation({
    assignmentId: "primary-1",
    tenantId: "t-a",
    tournamentId: "tourn-a",
    matchId: "match-a",
    action: "assignReferee",
  });
  ledger.registerSuccessfulMutation({
    assignmentId: "cross-1",
    tenantId: "t-a",
    tournamentId: "tourn-b",
    matchId: "match-a",
    action: "assignReferee",
  });
  ledger.registerSuccessfulMutation({
    assignmentId: "daily-1",
    tenantId: "t-a",
    tournamentId: "daily-t",
    matchId: "daily-m",
    action: "assignReferee",
  });
  ledger.registerSuccessfulMutation({
    assignmentId: "replace-1",
    tenantId: "t-a",
    tournamentId: "tourn-a",
    matchId: "match-live",
    action: "replaceReferee",
  });
  const discovered = mergeTeardownTargets(
    [{ tenantId: "t-a", tournamentId: "tourn-a", matchId: "match-a" }],
    ledger.teardownTargets()
  );
  const proof = evaluateTeardownDiscovery(ledger.list(), discovered, ["unrelated-row"]);
  assert.equal(proof.ok, true);
  assert.equal(
    discovered.some((row) => row.tournamentId === "tourn-b" && row.matchId === "match-a"),
    true
  );
  assert.equal(
    discovered.some((row) => row.tournamentId === "daily-t"),
    true
  );
  assert.equal(
    evaluateTeardownDiscovery(ledger.list(), discovered.concat([{ id: "unrelated-row", tenantId: "x", tournamentId: "y", matchId: "z" }]), [
      "unrelated-row",
    ]).ok,
    false
  );
});

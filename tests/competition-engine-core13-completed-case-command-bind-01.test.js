/**
 * CORE-13 completed-case command bind + authoritative COMPLETED validator.
 * Local only. Does not mutate Staging.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../src/features/competition-engine/operations/referee/assignment/constants.js";
import {
  CASE_CATALOG,
  DENIAL_CODES,
  evaluateCompletedFalsePassGuard,
} from "../scripts/core13/core13-staging-acceptance-proofs.mjs";
import {
  buildReceiptCaseAssignmentCommand,
  createValidFixtureReceipt,
  evaluateCompletedAuthoritativeState,
  evaluateCompletedCaseCommandBind,
  hydrateHarnessFixtures,
} from "../scripts/core13/core13-staging-fixture-receipt.mjs";
import { evaluateCompletedSamePathSemanticPreflight } from "../scripts/core13/core13-staging-fixture-preflight.mjs";
import {
  COMPLETED_DIRECT_DML_USED,
  COMPLETED_LIFECYCLE_WRITER_STEPS,
  COMPLETED_MATCH_EXECUTION,
} from "../scripts/core13/core13-staging-fixture-writers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function commandBase(receipt) {
  const fixtures = hydrateHarnessFixtures(receipt);
  return {
    tenantId: fixtures.tenantA,
    tournamentId: fixtures.tournamentA,
    matchId: fixtures.matchA,
    refereeId: fixtures.refereeId,
    competitionMode: "INTERNAL",
  };
}

test("C1-C4 completed case command uses receipt tournament/match/tenant, not primary", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-completed-bind" });
  const fixtures = hydrateHarnessFixtures(receipt);
  const command = buildReceiptCaseAssignmentCommand(
    receipt,
    commandBase(receipt),
    fixtures.matchCompleted
  );
  const bind = evaluateCompletedCaseCommandBind(command, receipt);
  assert.equal(bind.ok, true);
  assert.equal(command.tournamentId, fixtures.completedLifecycleTournament);
  assert.notEqual(command.tournamentId, fixtures.tournamentA);
  assert.equal(command.matchId, fixtures.matchCompleted);
  assert.equal(command.tenantId, fixtures.tenantA);
});

test("C5 deliberate wrong tournament remains a cross-tournament bind, not completed proof", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-completed-xt" });
  const fixtures = hydrateHarnessFixtures(receipt);
  const wrong = buildReceiptCaseAssignmentCommand(
    receipt,
    commandBase(receipt),
    fixtures.matchCompleted,
    { tournamentId: fixtures.tournamentA }
  );
  assert.equal(evaluateCompletedCaseCommandBind(wrong, receipt).ok, false);
  assert.equal(DENIAL_CODES.CROSS_TOURNAMENT.includes(ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED), true);
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.match(harness, /CROSS_TOURNAMENT/);
  assert.doesNotMatch(harness, /CROSS_TOURNAMENT_BYPASS\s*=\s*YES/);
});

test("C6 LOCKED cannot satisfy completed fixture semantic validator", () => {
  const locked = evaluateCompletedAuthoritativeState({ status: "locked" });
  assert.equal(locked.ok, false);
  assert.match(locked.detail, /LOCKED_AS_COMPLETED_PROOF/);
});

test("C7 SCORING_ACTIVE cannot satisfy completed validator", () => {
  const scoring = evaluateCompletedAuthoritativeState({ status: "scoring_active" });
  assert.equal(scoring.ok, false);
});

test("C8 COMPLETED satisfies completed validator", () => {
  const completed = evaluateCompletedAuthoritativeState({ status: "completed" });
  assert.equal(completed.ok, true);
  assert.equal(completed.core13Lifecycle, "COMPLETED");
});

test("C9 completed fixture creation uses canonical DECLARE_FORFEIT, not direct DML", () => {
  assert.deepEqual([...COMPLETED_LIFECYCLE_WRITER_STEPS], ["startMatchLive", "declareForfeit"]);
  assert.equal(COMPLETED_LIFECYCLE_WRITER_STEPS.includes("finalizeMatchLive"), false);
  assert.equal(COMPLETED_MATCH_EXECUTION, "CANONICAL_REFEREE_V5_DECLARE_FORFEIT");
  assert.equal(COMPLETED_DIRECT_DML_USED, "NO");
  const provisioner = read("scripts/core13/core13-staging-fixture-provisioner.mjs");
  assert.match(provisioner, /COMPLETED_LIFECYCLE_WRITER_STEPS/);
  assert.doesNotMatch(
    provisioner,
    /from\("match_live_states"\)[\s\S]{0,80}\.update\(/
  );
});

test("C10 J.lifecycle-completed-deny expectation remains LIFECYCLE_DENIED", () => {
  assert.deepEqual(DENIAL_CODES.COMPLETED, [ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED]);
});

test("C11 catalog count remains 29", () => {
  assert.equal(CASE_CATALOG.length, 29);
  assert.equal(CASE_CATALOG.includes("J.lifecycle-completed-deny"), true);
});

test("C12 H/G/J primary-tournament cases still hydrate onto primary", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-primary-remain" });
  const fixtures = hydrateHarnessFixtures(receipt);
  const inProgress = buildReceiptCaseAssignmentCommand(
    receipt,
    commandBase(receipt),
    fixtures.matchInProgress
  );
  const scoring = buildReceiptCaseAssignmentCommand(
    receipt,
    commandBase(receipt),
    fixtures.matchScoring
  );
  const locked = buildReceiptCaseAssignmentCommand(
    receipt,
    commandBase(receipt),
    fixtures.matchLocked
  );
  assert.equal(inProgress.tournamentId, fixtures.tournamentA);
  assert.equal(scoring.tournamentId, fixtures.tournamentA);
  assert.equal(locked.tournamentId, fixtures.tournamentA);
  assert.equal(inProgress.matchId, fixtures.matchInProgress);
});

test("same-path completed preflight proves writer + command bind", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-same-path" });
  const proof = evaluateCompletedSamePathSemanticPreflight({
    receipt,
    writers: { declareForfeit: async () => ({ ok: true }) },
    commandBase: commandBase(receipt),
    completedLiveRow: { status: "completed" },
  });
  assert.equal(proof.ok, true);
  assert.equal(proof.COMPLETED_CASE_COMMAND_SCOPE_PARITY, "PASS");
  assert.equal(proof.COMPLETED_CASE_AUTHORITATIVE_COMPLETION_PATH, "PASS");
  assert.equal(proof.EXPECTED_RUNTIME_RESULT, "CORE13_LIFECYCLE_DENIED");
});

test("false-pass guard rejects LIFECYCLE_DENIED against LOCKED live state", () => {
  const guard = evaluateCompletedFalsePassGuard({
    denialCode: ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED,
    core13Lifecycle: "LOCKED",
    liveStatus: "locked",
  });
  assert.equal(guard.ok, false);
  assert.equal(guard.detail, "FALSE_PASS_COMPLETED_SEMANTICS");
  const pass = evaluateCompletedFalsePassGuard({
    denialCode: ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED,
    core13Lifecycle: "COMPLETED",
    liveStatus: "completed",
  });
  assert.equal(pass.ok, true);
});

test("harness lifecycle builder binds case-owning tournament", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.match(harness, /buildReceiptCaseAssignmentCommand/);
  assert.match(harness, /evaluateCompletedFalsePassGuard/);
  assert.match(harness, /evaluateCompletedSamePathSemanticPreflight/);
});

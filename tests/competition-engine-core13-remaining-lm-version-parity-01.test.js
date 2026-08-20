/**
 * CORE-13 remaining L/M acceptance tooling — version parity + Daily scope.
 * Local only. Does not mutate Staging. Does not change product validation order.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CASE_CATALOG,
  AUTO_CURRENT_VERSION_FOR_ALL_CASES,
  AUTHORITATIVE_VERSION_SOURCE,
  PRIMARY_BUSINESS_DENIAL_CASES_REQUIRING_CURRENT_VERSION,
  CASES_PRESERVING_EXPLICIT_VERSION_POLICY,
  DENIAL_CODES,
  evaluateAuthoritativeMatchAssignmentVersionResult,
  evaluatePrimaryVersionAfterMutations,
} from "../scripts/core13/core13-staging-acceptance-proofs.mjs";
import {
  buildReceiptCaseAssignmentCommand,
  createValidFixtureReceipt,
  evaluateDailyDisabledCaseCommandBind,
  evaluateDailyEnabledCaseCommandBind,
  hydrateHarnessFixtures,
} from "../scripts/core13/core13-staging-fixture-receipt.mjs";
import { evaluateRemainingLmSamePathPreflight } from "../scripts/core13/core13-staging-fixture-preflight.mjs";
import {
  INACTIVE_REFEREE_ACCEPTANCE_RULE,
  evaluateInactiveRefereeFixture,
} from "../scripts/core13/core13-staging-qa-auth.mjs";
import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../src/features/competition-engine/operations/referee/assignment/constants.js";

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

test("LM1 primary version after simulated F/G/I can be >0", () => {
  const proof = evaluatePrimaryVersionAfterMutations({
    afterF: 1,
    afterG: 2,
    afterI: 3,
  });
  assert.equal(proof.ok, true);
  assert.match(proof.detail, /PRIMARY_VERSION_AFTER_I=3/);
});

test("LM2-LM4 inactive/qualification/availability use current-version helper", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.match(harness, /getAuthoritativeMatchAssignmentVersion/);
  assert.match(harness, /resolveCurrentExpectedVersionForPrimaryBusinessDenial/);
  for (const caseName of PRIMARY_BUSINESS_DENIAL_CASES_REQUIRING_CURRENT_VERSION) {
    assert.match(
      harness,
      new RegExp(
        `resolveCurrentExpectedVersionForPrimaryBusinessDenial[\\s\\S]{0,240}${caseName.replace(/\./g, "\\.")}`
      )
    );
  }
  assert.doesNotMatch(
    harness,
    /L\.inactive-referee-deny[\s\S]{0,400}expectedVersion:\s*0/
  );
});

test("LM5 version reader failure fails closed", () => {
  const missing = evaluateAuthoritativeMatchAssignmentVersionResult({
    status: 200,
    payload: { ok: true },
  });
  assert.equal(missing.ok, false);
  assert.match(missing.detail, /refuse silent zero fallback/);

  const failed = evaluateAuthoritativeMatchAssignmentVersionResult({
    status: 500,
    payload: { ok: false, code: "CORE13_NOT_CONFIGURED" },
  });
  assert.equal(failed.ok, false);

  const ok = evaluateAuthoritativeMatchAssignmentVersionResult({
    status: 200,
    payload: { ok: true, version: 3 },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.version, 3);
  assert.equal(ok.source, AUTHORITATIVE_VERSION_SOURCE);
});

test("LM6 G stale-CAS retains stale version deliberately", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.equal(
    /expectedVersion:\s*0[\s\S]{0,400}G\.cas-stale-expected-version-deny/.test(harness) ||
      /G\.cas-stale-expected-version-deny[\s\S]{0,400}expectedVersion:\s*0/.test(harness),
    true
  );
  assert.equal(
    CASES_PRESERVING_EXPLICIT_VERSION_POLICY["G.cas-stale-expected-version-deny"],
    "STALE_ZERO"
  );
});

test("LM7 current-version helper is not globally injected into all cases", () => {
  assert.equal(AUTO_CURRENT_VERSION_FOR_ALL_CASES, "DENY");
  assert.deepEqual(
    [...PRIMARY_BUSINESS_DENIAL_CASES_REQUIRING_CURRENT_VERSION],
    [
      "L.inactive-referee-deny",
      "L.required-qualification-missing-deny",
      "L.unavailable-referee-deny-when-required",
    ]
  );
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.match(
    harness,
    /L\.non-canonical-referee-deny[\s\S]{0,500}expectedVersion:\s*0/
  );
  assert.doesNotMatch(
    harness,
    /for\s*\(.*CASE_CATALOG[\s\S]{0,200}getAuthoritativeMatchAssignmentVersion/
  );
});

test("LM8-LM10 Daily disabled uses dedicated receipt tournament/match and rejects primary match", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-lm-daily-off" });
  const fixtures = hydrateHarnessFixtures(receipt);
  const command = buildReceiptCaseAssignmentCommand(
    receipt,
    commandBase(receipt),
    fixtures.dailyDisabledMatch,
    { competitionMode: "DAILY_PLAY", refereeFeatureEnabled: false }
  );
  const bind = evaluateDailyDisabledCaseCommandBind(command, receipt);
  assert.equal(bind.ok, true);
  assert.equal(command.tournamentId, fixtures.dailyDisabled);
  assert.equal(command.matchId, fixtures.dailyDisabledMatch);
  assert.notEqual(command.matchId, fixtures.matchA);

  const wrong = evaluateDailyDisabledCaseCommandBind(
    {
      ...commandBase(receipt),
      tournamentId: fixtures.dailyDisabled,
      competitionMode: "DAILY_PLAY",
      refereeFeatureEnabled: false,
    },
    receipt
  );
  assert.equal(wrong.ok, false);
  assert.match(wrong.detail, /PRIMARY_COMMAND_BASE_USED_WRONG_MATCH/);
});

test("LM11 Daily enabled scope remains correct", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-lm-daily-on" });
  const fixtures = hydrateHarnessFixtures(receipt);
  const command = buildReceiptCaseAssignmentCommand(
    receipt,
    commandBase(receipt),
    fixtures.dailyEnabledMatch,
    { competitionMode: "DAILY_PLAY", refereeFeatureEnabled: true }
  );
  assert.equal(evaluateDailyEnabledCaseCommandBind(command, receipt).ok, true);
  assert.equal(command.tournamentId, fixtures.dailyEnabled);
  assert.equal(command.matchId, fixtures.dailyEnabledMatch);
});

test("LM12 overlap/non-overlap isolation remains correct", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-lm-overlap" });
  const fixtures = hydrateHarnessFixtures(receipt);
  assert.notEqual(fixtures.overlapA, fixtures.matchA);
  assert.notEqual(fixtures.overlapB, fixtures.matchA);
  assert.notEqual(fixtures.nonOverlap, fixtures.matchA);
  assert.notEqual(fixtures.overlapA, fixtures.overlapB);
});

test("LM13 completed semantics remain genuine COMPLETED", () => {
  assert.deepEqual(DENIAL_CODES.COMPLETED, [
    ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED,
  ]);
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.match(harness, /evaluateCompletedSamePathSemanticPreflight/);
  assert.match(harness, /evaluateCompletedFalsePassGuard/);
});

test("LM14 catalog exactly 29", () => {
  assert.equal(CASE_CATALOG.length, 29);
});

test("LM15 Contract #01 inactive fixture remains suspended / active=false", () => {
  assert.equal(INACTIVE_REFEREE_ACCEPTANCE_RULE.dedicatedFixtureStatus, "suspended");
  const proof = evaluateInactiveRefereeFixture(
    {
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
      },
    },
    { requiredTenantId: "core13-qa-tenant-a" }
  );
  assert.equal(proof.ok, true);
});

test("remaining L/M same-path preflight PASS against harness source", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-lm-same-path" });
  const harnessSource = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  const proof = evaluateRemainingLmSamePathPreflight({
    receipt,
    commandBase: commandBase(receipt),
    harnessSource,
  });
  assert.equal(proof.ok, true);
  assert.equal(proof.REMAINING_LM_SAME_PATH_PREFLIGHT, "PASS");
  assert.equal(proof.P8, "PASS");
  assert.equal(proof.P10, "PASS");
  assert.equal(proof.AUTO_CURRENT_VERSION_FOR_ALL_CASES, "DENY");
});

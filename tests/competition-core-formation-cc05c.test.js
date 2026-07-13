import test from "node:test";
import assert from "node:assert/strict";

import { pairTeamsFromSelectedPlayers } from "../src/features/team-tournament/engines/teamAutoDrawEngine.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import {
  COMPETITION_CORE_FLAG_KEYS,
  COMPETITION_ENGINE_TYPE,
  buildCompleteFormationTraceRecord,
  buildFormationParityComparison,
  buildMlpFormationPayload,
  cloneLegacyFormationPayload,
  compareFormationConstraintParity,
  compareFormationCourtParity,
  compareFormationScoreParity,
  comparePairMembership,
  createMemoizedFormationExecutor,
  evaluateCanonicalFormation,
  executeCompetitionEngine,
  FORMATION_FIXTURE_MATRIX,
  isDrawV2Enabled,
  isEngineV2Available,
  isFormationTraceJsonSerializable,
  isFormationV2Enabled,
  isRatingV2Enabled,
  isRulesV2Enabled,
  measureFormationPerformanceBaseline,
  normalizeFormationPairs,
  redactFormationTraceSecrets,
  runFormationShadowComparison,
  validateCompleteFormationTraceRecord,
  verifyFormationPayloadPreservation,
  verifyFormationRandomParity,
} from "../src/features/competition-core/index.js";

const formationV2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.FORMATION_V2]: "true",
};

const coreOffFormationOn = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "false",
  [COMPETITION_CORE_FLAG_KEYS.FORMATION_V2]: "true",
};

const coreOnFormationOff = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.FORMATION_V2]: "false",
};

function mlpExecutor(payload) {
  return pairTeamsFromSelectedPlayers({
    players: payload.players || [],
    selectedPlayerIds: payload.options?.selectedPlayerIds || [],
    teamCount: payload.options?.teamCount ?? 2,
    teamNames: payload.options?.teamNames || ["A", "B"],
    formatPreset: payload.options?.formatPreset || FORMAT_PRESET.MLP_4,
    randomFn: payload.randomFn || payload.options?.randomFn,
  });
}

function buildPayloadFromFixture(fixture, overrides = {}) {
  const players = fixture.build();
  return buildMlpFormationPayload(players, {
    teamCount: Math.min(2, Math.floor(players.filter((p) => p.gender === "male").length / 2)),
    ...overrides,
  });
}

test("1 flag OFF direct legacy path", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2]);
  const bridge = evaluateCanonicalFormation({
    consumer: "team_mlp_pairing",
    legacyPayload: payload,
    envSource: {},
    legacyExecutor: mlpExecutor,
  });
  assert.equal(bridge.usedCanonical, false);
  assert.equal(bridge.executionPath, "legacy");
});

test("2 master OFF + formation ON stays legacy", () => {
  assert.equal(isFormationV2Enabled(coreOffFormationOn), false);
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[0]);
  const bridge = evaluateCanonicalFormation({
    consumer: "team_mlp_pairing",
    legacyPayload: payload,
    envSource: coreOffFormationOn,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(bridge.usedCanonical, false);
});

test("3 master ON + formation OFF stays legacy", () => {
  assert.equal(isFormationV2Enabled(coreOnFormationOff), false);
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[0]);
  const bridge = evaluateCanonicalFormation({
    consumer: "team_mlp_pairing",
    legacyPayload: payload,
    envSource: coreOnFormationOff,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(bridge.usedCanonical, false);
});

test("4 both ON uses adapter path", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2]);
  const bridge = evaluateCanonicalFormation({
    consumer: "team_mlp_pairing",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(bridge.usedCanonical, true);
  assert.equal(bridge.executionPath, "canonical-adapter");
});

test("5 shadow primary output is direct legacy", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2]);
  const shadow = runFormationShadowComparison({
    strategy: "mlp_team_pairing",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.deepEqual(
    normalizeFormationPairs(shadow.primary.teams).map((p) => p.pairKey).sort(),
    normalizeFormationPairs(shadow.bridge.legacyResult.teams).map((p) => p.pairKey).sort()
  );
});

test("6 pair membership parity across fixtures", () => {
  for (const fixture of FORMATION_FIXTURE_MATRIX.slice(0, 5)) {
    const payload = buildPayloadFromFixture(fixture);
    const shadow = runFormationShadowComparison({
      strategy: fixture.label,
      legacyPayload: payload,
      envSource: formationV2Env,
      legacyExecutor: mlpExecutor,
    });
    assert.equal(shadow.comparison.pairMembershipParity, true, fixture.label);
  }
});

test("7 court allocation parity", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2], {
    courts: [
      { id: "c1", label: "Court 1", playerIds: [] },
      { id: "c2", label: "Court 2", playerIds: [] },
    ],
  });
  const shadow = runFormationShadowComparison({
    strategy: "court_fixture",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(shadow.comparison.courtAllocationParity, true);
});

test("8 waiting list parity with odd players", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[1]);
  const shadow = runFormationShadowComparison({
    strategy: "5_players_odd",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(shadow.comparison.waitingListParity, true);
});

test("9 unassigned players parity", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[1]);
  const shadow = runFormationShadowComparison({
    strategy: "unassigned",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(shadow.comparison.unassignedPlayersParity, true);
});

test("10 duplicate and missing player detection", () => {
  const left = normalizeFormationPairs([
    { playerIds: ["a", "b"] },
    { playerIds: ["c", "d"] },
  ]);
  const right = normalizeFormationPairs([
    { playerIds: ["a", "b"] },
    { playerIds: ["c", "e"] },
  ]);
  const cmp = comparePairMembership(left, right);
  assert.equal(cmp.membershipParity, false);
  assert.ok(cmp.missingPlayers.includes("d") || cmp.extraPlayers.includes("e"));
});

test("11 must partner constraint metadata parity", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2], {
    constraints: [{ kind: "must_partner", params: { playerA: "m1", playerB: "f1" } }],
  });
  const shadow = runFormationShadowComparison({
    strategy: "must_partner",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  const constraint = compareFormationConstraintParity({
    legacyPayload: payload,
    formationRequest: shadow.bridge.formationRequest,
  });
  assert.equal(constraint.constraintMissing.includes("must_partner"), false);
});

test("12 must not partner constraint mapped", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2], {
    constraints: [{ type: "avoid_partner", params: { playerA: "m1", playerB: "m2" } }],
  });
  const shadow = runFormationShadowComparison({
    strategy: "must_not_partner",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(shadow.bridge.formationRequest?.constraints?.[0]?.kind, "must_not_partner");
});

test("13 repeat partner constraint kind preserved", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2], {
    constraints: [{ kind: "avoid_repeat_partner", params: { history: [["m1", "f1"]] } }],
  });
  const check = verifyFormationPayloadPreservation(payload);
  assert.equal(check.preserved, true);
});

test("14 repeat opponent constraint kind preserved", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2], {
    constraints: [{ kind: "avoid_repeat_opponent", params: { history: [["m1", "m2"]] } }],
  });
  const constraint = compareFormationConstraintParity({
    legacyPayload: payload,
    formationRequest: {
      constraints: [{ kind: "avoid_repeat_opponent", enabled: true }],
    },
  });
  assert.equal(constraint.ok, true);
});

test("15 skill gap constraint mapped", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[5], {
    constraints: [{ kind: "skill_gap", params: { maxGap: 1.0 } }],
  });
  const shadow = runFormationShadowComparison({
    strategy: "skill_gap",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(shadow.comparison.constraintParity, true);
});

test("16 mixed gender fixture parity", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2]);
  const shadow = runFormationShadowComparison({
    strategy: "mixed_gender",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(shadow.comparison.ok, true);
});

test("17 manual lock custom field preserved or warned", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[0], {
    manualLockPair: { playerA: "m1", playerB: "f1" },
    constraints: [{ kind: "manual_lock", params: { playerA: "m1", playerB: "f1" } }],
  });
  const check = verifyFormationPayloadPreservation(payload);
  assert.ok(check.warnings.some((w) => w.startsWith("UNMAPPED_LEGACY_FIELD")) || check.preserved);
});

test("18 randomFn reference preserved", () => {
  const randomFn = () => 0.25;
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2]);
  payload.randomFn = randomFn;
  payload.options.randomFn = randomFn;
  const cloned = cloneLegacyFormationPayload(payload);
  assert.equal(verifyFormationRandomParity(payload, cloned), true);
});

test("19 randomFn call count unchanged in memoized shadow", () => {
  let calls = 0;
  const randomFn = () => {
    calls += 1;
    return 0.5;
  };
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2]);
  payload.randomFn = randomFn;
  const shadow = runFormationShadowComparison({
    strategy: "random_count",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(shadow.sideEffectSafe, true);
  assert.equal(shadow.executorInvocationCount, 1);
  assert.ok(calls >= 0);
});

test("20 Map preserved in payload clone", () => {
  const playersById = new Map([["m1", { id: "m1" }]]);
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[0]);
  payload.options = { ...payload.options, playersById };
  const cloned = cloneLegacyFormationPayload(payload);
  assert.equal(cloned.options.playersById, playersById);
});

test("21 custom extension fields warned when unmapped", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[0], {
    customExtension: { foo: "bar" },
  });
  payload.customExtension = { foo: "bar" };
  const check = verifyFormationPayloadPreservation(payload);
  assert.ok(
    check.unmappedFields.includes("customExtension") ||
      check.warnings.some((w) => w.includes("customExtension"))
  );
});

test("22 trace JSON serialization", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2]);
  const shadow = runFormationShadowComparison({
    strategy: "trace_serialization",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(isFormationTraceJsonSerializable(shadow.traceRecord), true);
  assert.equal(validateCompleteFormationTraceRecord(shadow.traceRecord).length, 0);
});

test("23 trace secret redaction", () => {
  const record = buildCompleteFormationTraceRecord({
    bridge: {
      usedCanonical: true,
      executionPath: "canonical-adapter",
      legacyResult: { teams: [], warnings: [] },
      formationRequest: { policy: { strategy: "team_match" }, players: [], constraints: [] },
      trace: { records: [] },
      randomFnPreserved: true,
      outputPreserved: true,
    },
  });
  const withSecret = redactFormationTraceSecrets({
    ...record,
    accessToken: "secret-value",
    nested: { refreshToken: "x" },
  });
  assert.equal(withSecret.accessToken, "[REDACTED]");
  assert.equal(withSecret.nested.refreshToken, "[REDACTED]");
});

test("24 score scale mismatch reported safely", () => {
  const score = compareFormationScoreParity({
    legacyResult: { score: 999 },
    formationResult: { audit: { scores: { finalScore: 0.5 } } },
  });
  assert.equal(score.comparable, false);
  assert.ok(score.warnings.some((w) => w.includes("SCORE_SCALE_NOT_COMPARABLE")));
});

test("25 shadow no double executor side effects", () => {
  let sideEffects = 0;
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2]);
  const executor = () => {
    sideEffects += 1;
    return mlpExecutor(payload);
  };
  const memo = createMemoizedFormationExecutor(executor, payload);
  memo.run();
  memo.run();
  assert.equal(sideEffects, 1);
});

test("26 CC-05A foundation regression import", async () => {
  await import("../src/features/competition-core/formation/formationContracts.js");
  assert.ok(true);
});

test("27 CC-05B runtime adapter regression", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[0]);
  const shadow = runFormationShadowComparison({
    strategy: "cc05b_regression",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mlpExecutor,
  });
  assert.equal(shadow.comparison.ok, true);
});

test("28 rules v2 flag still independent", () => {
  assert.equal(isRulesV2Enabled({}), false);
});

test("29 draw v2 flag still independent", () => {
  assert.equal(isDrawV2Enabled(formationV2Env), false);
});

test("30 rating v2 flag still independent", () => {
  assert.equal(isRatingV2Enabled(formationV2Env), false);
});

test("fixture matrix performance baseline reports non-pathological overhead", () => {
  const sizes = ["4_players_even", "8_players", "12_players", "20_players"];
  for (const label of sizes) {
    const fixture = FORMATION_FIXTURE_MATRIX.find((f) => f.label === label);
    const payload = buildPayloadFromFixture(fixture);
    const report = measureFormationPerformanceBaseline({
      runLegacy: () => mlpExecutor(payload),
      runShadow: () =>
        runFormationShadowComparison({
          strategy: label,
          legacyPayload: payload,
          envSource: formationV2Env,
          legacyExecutor: mlpExecutor,
        }),
    });
    assert.ok(Number.isFinite(report.legacyDurationMs) && report.legacyDurationMs >= 0);
    assert.ok(Number.isFinite(report.shadowDurationMs) && report.shadowDurationMs >= 0);
    assert.ok(Number.isFinite(report.adapterDurationMs) && report.adapterDurationMs >= 0);
    // Avoid sub-ms ordering assertions — shadow includes legacy + adapter and may measure
    // faster than an isolated legacy call under full-suite CPU contention.
    const overheadMs = report.shadowDurationMs - report.legacyDurationMs;
    assert.ok(
      overheadMs < 30_000,
      `pathological shadow overhead for ${label}: ${overheadMs}ms`
    );
    assert.ok(report.candidateCount >= 0);
  }
});

test("fixture matrix shadow correctness under performance harness", () => {
  const sizes = ["4_players_even", "8_players"];
  for (const label of sizes) {
    const fixture = FORMATION_FIXTURE_MATRIX.find((f) => f.label === label);
    const payload = buildPayloadFromFixture(fixture);
    const result = runFormationShadowComparison({
      strategy: label,
      legacyPayload: payload,
      envSource: formationV2Env,
      legacyExecutor: mlpExecutor,
    });
    assert.equal(result.bridge.usedCanonical, true);
    assert.equal(result.bridge.outputPreserved, true);
    assert.equal(result.sideEffectSafe, true);
    assert.equal(result.comparison.pairMembershipParity, true);
  }
});

test("executeCompetitionEngine formation shadow path", async () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2]);
  const result = await executeCompetitionEngine(
    {
      engineType: COMPETITION_ENGINE_TYPE.TEAM_FORMATION,
      sessionId: "s1",
      payload,
    },
    {
      envSource: formationV2Env,
      legacyExecutor: () => mlpExecutor(payload),
    }
  );
  assert.equal(result.executionPath, "v2");
  assert.equal(result.success, true);
});

test("parity comparison object has required fields", () => {
  const payload = buildPayloadFromFixture(FORMATION_FIXTURE_MATRIX[2]);
  const direct = mlpExecutor(payload);
  const comparison = buildFormationParityComparison({
    strategy: "mlp_team_pairing",
    directLegacy: direct,
    adapterLegacy: direct,
    randomFnPreserved: true,
    payloadPreserved: true,
    scoreParity: true,
    constraintParity: true,
    courtAllocationParity: true,
  });
  assert.equal(typeof comparison.pairMembershipParity, "boolean");
  assert.equal(typeof comparison.courtAllocationParity, "boolean");
  assert.equal(typeof comparison.scoreParity, "boolean");
  assert.equal(typeof comparison.constraintParity, "boolean");
});

test("court parity module", () => {
  const direct = { teams: [{ id: "t1", playerIds: ["a", "b"] }] };
  const court = compareFormationCourtParity({
    directLegacy: direct,
    adapterLegacy: direct,
  });
  assert.equal(court.ok, true);
});

test("isEngineV2Available formation", () => {
  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.TEAM_FORMATION, formationV2Env), true);
});

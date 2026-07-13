import test from "node:test";
import assert from "node:assert/strict";

import { COMPETITION_ENGINE_TYPE } from "../src/features/competition-core/constants/engineType.js";
import {
  COMPETITION_CORE_FLAG_KEYS,
  isSchedulingV2Enabled,
} from "../src/features/competition-core/config/featureFlags.js";
import {
  EXECUTION_MODE,
  mapAdapterExecutionMode,
  normalizeExecutionMode,
  resolveCompetitionCoreExecutionMode,
} from "../src/features/competition-core/config/executionMode.js";
import {
  createMemoizedSchedulingExecutor,
  evaluateCanonicalSchedulingRuntime,
  isSchedulingTraceJsonSerializable,
} from "../src/features/competition-core/index.js";
import { buildGroupStageSchedule } from "../src/tournament/engines/scheduleEngine.js";

const ALL_ON = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.SCHEDULING_V2]: "true",
  [COMPETITION_CORE_FLAG_KEYS.STANDINGS_V2]: "true",
  [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "true",
  [COMPETITION_CORE_FLAG_KEYS.FORMATION_V2]: "true",
  [COMPETITION_CORE_FLAG_KEYS.MATCHMAKING_V2]: "true",
  [COMPETITION_CORE_FLAG_KEYS.RULES_V2]: "true",
};

const sampleGroup = {
  id: "g1",
  label: "A",
  entryIds: ["a", "b", "c", "d"],
  entries: [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
    { id: "d", name: "D" },
  ],
};

test("CC10 execution mode defaults to LEGACY when core off", () => {
  const resolved = resolveCompetitionCoreExecutionMode({
    engineType: COMPETITION_ENGINE_TYPE.SCHEDULING,
    envSource: {},
  });
  assert.equal(resolved.mode, EXECUTION_MODE.LEGACY);
  assert.equal(resolved.businessOutputOwner, "legacy");
});

test("CC10 production always resolves LEGACY even when flags on", () => {
  const resolved = resolveCompetitionCoreExecutionMode({
    engineType: COMPETITION_ENGINE_TYPE.SCHEDULING,
    envSource: ALL_ON,
    isProduction: true,
  });
  assert.equal(resolved.mode, EXECUTION_MODE.LEGACY);
  assert.equal(resolved.reason, "production_legacy_only");
});

test("CC10 staging shadow resolves SHADOW with legacy business owner", () => {
  const resolved = resolveCompetitionCoreExecutionMode({
    engineType: COMPETITION_ENGINE_TYPE.STANDINGS,
    envSource: ALL_ON,
    isProduction: false,
  });
  assert.equal(resolved.mode, EXECUTION_MODE.SHADOW);
  assert.equal(resolved.businessOutputOwner, "legacy");
});

test("CC10 canonical-primary downgraded to shadow in CC-10", () => {
  const resolved = resolveCompetitionCoreExecutionMode({
    engineType: COMPETITION_ENGINE_TYPE.DRAW,
    envSource: ALL_ON,
    requestedMode: EXECUTION_MODE.CANONICAL_PRIMARY,
  });
  assert.equal(resolved.mode, EXECUTION_MODE.SHADOW);
  assert.ok(resolved.limitations.includes("canonical_primary_not_enabled_in_cc10"));
});

test("CC10 canonical-test allowed only for isolated fixtures", () => {
  const resolved = resolveCompetitionCoreExecutionMode({
    engineType: COMPETITION_ENGINE_TYPE.RATING,
    envSource: { ...ALL_ON, [COMPETITION_CORE_FLAG_KEYS.RATING_V2]: "true" },
    requestedMode: EXECUTION_MODE.CANONICAL_TEST,
  });
  assert.equal(resolved.mode, EXECUTION_MODE.CANONICAL_TEST);
  assert.equal(resolved.businessOutputOwner, "canonical_test");
});

test("CC10 unsupported module stays LEGACY", () => {
  const resolved = resolveCompetitionCoreExecutionMode({
    engineType: COMPETITION_ENGINE_TYPE.SCHEDULING,
    envSource: ALL_ON,
    moduleSupported: false,
  });
  assert.equal(resolved.mode, EXECUTION_MODE.LEGACY);
  assert.equal(resolved.reason, "module_unsupported");
});

test("CC10 mapAdapterExecutionMode normalizes adapter strings", () => {
  assert.equal(mapAdapterExecutionMode("shadow"), EXECUTION_MODE.SHADOW);
  assert.equal(mapAdapterExecutionMode("legacy"), EXECUTION_MODE.LEGACY);
  assert.equal(mapAdapterExecutionMode("canonical-primary", true), EXECUTION_MODE.SHADOW);
});

test("CC10 normalizeExecutionMode rejects invalid values", () => {
  assert.equal(normalizeExecutionMode("shadow"), EXECUTION_MODE.SHADOW);
  assert.equal(normalizeExecutionMode("invalid"), null);
});

test("CC10 shadow scheduling preserves legacy output and memoizes executor", () => {
  let calls = 0;
  const legacy = buildGroupStageSchedule([sampleGroup]);
  const bridge = evaluateCanonicalSchedulingRuntime({
    consumer: "group",
    envSource: ALL_ON,
    legacyPayload: { groups: [sampleGroup] },
    legacyExecutor: () => {
      calls += 1;
      return legacy;
    },
    executionMode: "shadow",
  });
  assert.equal(bridge.outputPreserved, true);
  assert.equal(bridge.legacyResult.matches.length, legacy.matches.length);
  assert.equal(calls, 1);
});

test("CC10 memoized scheduling executor flags duplicate invocation", () => {
  let calls = 0;
  const memo = createMemoizedSchedulingExecutor(() => {
    calls += 1;
    return { ok: true };
  });
  memo.run();
  const second = memo.run();
  assert.equal(calls, 1);
  assert.equal(second.duplicateDecision, true);
});

test("CC10 scheduling trace is JSON serializable without secrets", () => {
  const bridge = evaluateCanonicalSchedulingRuntime({
    consumer: "group",
    envSource: ALL_ON,
    legacyPayload: { groups: [sampleGroup] },
    legacyExecutor: () => buildGroupStageSchedule([sampleGroup]),
  });
  assert.equal(isSchedulingTraceJsonSerializable(bridge.traceRecord || {}), true);
});

test("CC10 master off blocks scheduling subflag", () => {
  assert.equal(
    isSchedulingV2Enabled({
      [COMPETITION_CORE_FLAG_KEYS.CORE]: "false",
      [COMPETITION_CORE_FLAG_KEYS.SCHEDULING_V2]: "true",
    }),
    false
  );
});

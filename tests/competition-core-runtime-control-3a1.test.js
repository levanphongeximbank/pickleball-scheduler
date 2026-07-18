import test from "node:test";
import assert from "node:assert/strict";

import {
  RUNTIME_MODE,
  RUNTIME_CAPABILITY,
  RUNTIME_FORMAT,
  RUNTIME_EXECUTOR,
  RUNTIME_SCOPE,
  RUNTIME_DECISION_CODE,
  RUNTIME_CONTROL_VERSION,
  isRuntimeModeTransitionAllowed,
  isRuntimeModeActivatableInPhase3A1,
  createExecutionContext,
  createFeatureFlagSnapshot,
  createRuntimeOverride,
  createRuntimeDecision,
  resolveRuntimeDecision,
  resolveKillSwitch,
  resolveFlagPrecedence,
  validateExecutionContext,
  cloneJsonSafe,
  isJsonSafe,
} from "../src/features/competition-core/index.js";

function baseContext(overrides = {}) {
  return createExecutionContext({
    requestId: "req-1",
    tenantId: "tenant-a",
    competitionId: "comp-1",
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
    format: RUNTIME_FORMAT.TEAM_TOURNAMENT,
    actor: { actorId: "actor-1", roles: ["OPERATOR"] },
    timezone: "Asia/Ho_Chi_Minh",
    now: "2026-07-18T04:00:00.000Z",
    randomSeed: "seed-1",
    runtimeMode: RUNTIME_MODE.LEGACY_ONLY,
    runtimeVersion: RUNTIME_CONTROL_VERSION,
    ...overrides,
  });
}

function assertLegacySafe(decision) {
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.fallbackAllowed, true);
  assert.ok(isJsonSafe(decision));
}

test("3A1 default: empty flags → LEGACY_ONLY / GLOBAL_DISABLED", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot(),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.GLOBAL_DISABLED);
});

test("3A1 default: missing flags argument → LEGACY_ONLY", () => {
  const decision = resolveRuntimeDecision({ context: baseContext() });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.GLOBAL_DISABLED);
});

test("3A1 global enabled false beats tenant and competition ON", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: false, killSwitch: false },
      tenants: { "tenant-a": { enabled: true } },
      competitions: { "comp-1": { enabled: true } },
      formats: { teamTournament: true },
      capabilities: { participant: true },
    }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.GLOBAL_DISABLED);
});

test("3A1 all flags ON still LEGACY_ONLY with CANONICAL_NOT_AVAILABLE", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true, killSwitch: false },
      formats: { teamTournament: true },
      capabilities: { participant: true },
      tenants: { "tenant-a": { enabled: true } },
      competitions: { "comp-1": { enabled: true } },
      shadow: { enabled: true, samplingRate: 0.1 },
    }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.CANONICAL_NOT_AVAILABLE);
});

test("3A1 global kill switch wins over all enable flags", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true, killSwitch: true },
      formats: { teamTournament: true },
      capabilities: { participant: true },
      tenants: { "tenant-a": { enabled: true } },
      competitions: { "comp-1": { enabled: true } },
      shadow: { enabled: true, samplingRate: 1 },
    }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.GLOBAL_KILL_SWITCH);
  assert.equal(decision.shadowAllowed, false);
});

test("3A1 competition kill switch blocks competition ON", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true, killSwitch: false },
      formats: { teamTournament: true },
      capabilities: { participant: true },
      competitions: { "comp-1": { enabled: true, killSwitch: true } },
    }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.COMPETITION_KILL_SWITCH);
});

test("3A1 tenant kill switch via override", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true, killSwitch: false },
      formats: { teamTournament: true },
      capabilities: { participant: true },
      tenants: { "tenant-a": { enabled: true } },
    }),
    overrides: [
      createRuntimeOverride({
        scope: RUNTIME_SCOPE.TENANT,
        scopeId: "tenant-a",
        killSwitch: true,
        reason: "ops",
      }),
    ],
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.TENANT_KILL_SWITCH);
});

test("3A1 kill switch resolver reports inactive by default", () => {
  const hit = resolveKillSwitch({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({ global: { enabled: true, killSwitch: false } }),
  });
  assert.equal(hit.active, false);
});

test("3A1 rollback marker forces legacy-safe decision", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true, killSwitch: false },
      formats: { teamTournament: true },
      capabilities: { participant: true },
      competitions: { "comp-1": { enabled: true, runtimeMode: RUNTIME_MODE.CANONICAL_PRIMARY } },
      rollback: { active: true, targetMode: RUNTIME_MODE.LEGACY_FALLBACK, reason: "slo" },
    }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.ROLLBACK_ACTIVE);
});

test("3A1 competition disabled after global enabled", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true },
      competitions: { "comp-1": { enabled: false } },
      formats: { teamTournament: true },
      capabilities: { participant: true },
    }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.COMPETITION_DISABLED);
});

test("3A1 tenant disabled after competition unset", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true },
      tenants: { "tenant-a": { enabled: false } },
      formats: { teamTournament: true },
      capabilities: { participant: true },
    }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.TENANT_DISABLED);
});

test("3A1 format OFF blocks capability ON", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true },
      formats: { teamTournament: false },
      capabilities: { participant: true },
    }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.FORMAT_DISABLED);
});

test("3A1 capability OFF blocks format ON", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true },
      formats: { teamTournament: true },
      capabilities: { participant: false },
    }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.CAPABILITY_DISABLED);
});

test("3A1 shadow disabled when capability path otherwise open", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true },
      formats: { teamTournament: true },
      capabilities: { participant: true },
      shadow: { enabled: false, samplingRate: 0 },
    }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.SHADOW_DISABLED);
});

test("3A1 missing requestId → diagnostics + INVALID_CONTEXT fail-safe", () => {
  const decision = resolveRuntimeDecision({
    context: baseContext({ requestId: "" }),
  });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.INVALID_CONTEXT);
  assert.ok(decision.diagnostics.length > 0);
});

test("3A1 missing capability → diagnostics + fail-safe", () => {
  const raw = {
    requestId: "req-2",
    capability: "",
    format: RUNTIME_FORMAT.DAILY_PLAY,
    now: "2026-07-18T00:00:00.000Z",
    timezone: "UTC",
  };
  const decision = resolveRuntimeDecision({ context: raw });
  assertLegacySafe(decision);
  assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.INVALID_CONTEXT);
});

test("3A1 invalid flag snapshot type → fail-safe without throw", () => {
  assert.doesNotThrow(() => {
    const decision = resolveRuntimeDecision({
      context: baseContext(),
      flags: "not-an-object",
    });
    assertLegacySafe(decision);
    assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.INVALID_FLAG_SNAPSHOT);
  });
});

test("3A1 invalid override array → fail-safe without throw", () => {
  assert.doesNotThrow(() => {
    const decision = resolveRuntimeDecision({
      context: baseContext(),
      flags: createFeatureFlagSnapshot({ global: { enabled: true } }),
      overrides: { bad: true },
    });
    assertLegacySafe(decision);
    assert.equal(decision.reasonCode, RUNTIME_DECISION_CODE.INVALID_OVERRIDE);
  });
});

test("3A1 validateExecutionContext reports missing now", () => {
  const result = validateExecutionContext(
    createExecutionContext({
      requestId: "x",
      capability: RUNTIME_CAPABILITY.DRAW,
      format: RUNTIME_FORMAT.OFFICIAL_TOURNAMENT,
      now: "",
      timezone: "UTC",
    })
  );
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((d) => /now/.test(d.message)));
});

test("3A1 purity: does not mutate input flags/context", () => {
  const context = baseContext();
  const flags = createFeatureFlagSnapshot({
    global: { enabled: true },
    formats: { teamTournament: true },
    capabilities: { participant: true },
  });
  const contextSnap = cloneJsonSafe(context);
  const flagsSnap = cloneJsonSafe(flags);
  resolveRuntimeDecision({ context, flags });
  assert.deepEqual(context, contextSnap);
  assert.deepEqual(flags, flagsSnap);
});

test("3A1 purity: same input → same output", () => {
  const input = {
    context: baseContext(),
    flags: createFeatureFlagSnapshot({
      global: { enabled: true },
      formats: { teamTournament: true },
      capabilities: { participant: true },
      shadow: { enabled: true, samplingRate: 0.2 },
    }),
  };
  const a = resolveRuntimeDecision(input);
  const b = resolveRuntimeDecision(input);
  assert.deepEqual(a, b);
});

test("3A1 transition LEGACY_ONLY → CANONICAL_ONLY forbidden", () => {
  assert.equal(
    isRuntimeModeTransitionAllowed(RUNTIME_MODE.LEGACY_ONLY, RUNTIME_MODE.CANONICAL_ONLY),
    false
  );
});

test("3A1 only LEGACY_ONLY is activatable", () => {
  assert.equal(isRuntimeModeActivatableInPhase3A1(RUNTIME_MODE.LEGACY_ONLY), true);
  assert.equal(isRuntimeModeActivatableInPhase3A1(RUNTIME_MODE.SHADOW), false);
  assert.equal(isRuntimeModeActivatableInPhase3A1(RUNTIME_MODE.CANONICAL_PRIMARY), false);
});

test("3A1 createRuntimeDecision defaults are legacy-safe", () => {
  const d = createRuntimeDecision();
  assertLegacySafe(d);
});

test("3A1 precedence helper exposes evaluated scopes", () => {
  const result = resolveFlagPrecedence({
    context: baseContext(),
    flags: createFeatureFlagSnapshot({ global: { enabled: false } }),
  });
  assert.equal(result.reasonCode, RUNTIME_DECISION_CODE.GLOBAL_DISABLED);
  assert.ok(Array.isArray(result.evaluatedScopes));
  assert.ok(result.evaluatedScopes.length > 0);
});

test("3A1 audit event is present and JSON-safe", () => {
  const decision = resolveRuntimeDecision({ context: baseContext() });
  assert.equal(typeof decision.auditEvent.requestId, "string");
  assert.equal(decision.auditEvent.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.ok(isJsonSafe(decision.auditEvent));
});

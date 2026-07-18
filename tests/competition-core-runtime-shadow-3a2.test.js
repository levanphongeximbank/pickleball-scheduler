import test from "node:test";
import assert from "node:assert/strict";

import {
  RUNTIME_MODE,
  RUNTIME_CAPABILITY,
  RUNTIME_FORMAT,
  RUNTIME_EXECUTOR,
  RUNTIME_CONTROL_VERSION,
  createExecutionContext,
  createFeatureFlagSnapshot,
  createRuntimeDecision,
  createShadowExecutionRequest,
  createShadowResultEnvelope,
  createShadowDifference,
  resolveShadowEligibility,
  resolveShadowExecutionPlan,
  compareShadowResults,
  normalizeShadowPayload,
  summarizeShadowReport,
  buildShadowDiagnostics,
  createShadowEligibilityEvaluatedEvent,
  createShadowPlanCreatedEvent,
  createShadowExecutionSkippedEvent,
  createShadowComparisonCompletedEvent,
  createShadowDivergenceDetectedEvent,
  SHADOW_REASON_CODE,
  SHADOW_COMPARISON_STATUS,
  SHADOW_DIFFERENCE_KIND,
  SHADOW_DIFFERENCE_SEVERITY,
  SHADOW_PRIMARY_EXECUTION,
  SHADOW_SECONDARY_EXECUTION,
  SHADOW_RETURN_SOURCE,
  SHADOW_AUDIT_EVENT_TYPE,
  SHADOW_INFRASTRUCTURE_VERSION,
  isJsonSafe,
  cloneJsonSafe,
} from "../src/features/competition-core/index.js";

function baseContext(overrides = {}) {
  return createExecutionContext({
    requestId: "req-shadow-1",
    tenantId: "tenant-a",
    competitionId: "comp-1",
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
    format: RUNTIME_FORMAT.TEAM_TOURNAMENT,
    actor: { actorId: "actor-1", roles: ["OPERATOR"] },
    timezone: "Asia/Ho_Chi_Minh",
    now: "2026-07-18T08:00:00.000Z",
    randomSeed: "seed-shadow-1",
    runtimeMode: RUNTIME_MODE.LEGACY_ONLY,
    runtimeVersion: RUNTIME_CONTROL_VERSION,
    ...overrides,
  });
}

function baseRequest(overrides = {}) {
  return createShadowExecutionRequest({
    competitionId: "comp-1",
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
    operation: "create",
    correlationId: "corr-1",
    executionContext: baseContext(),
    legacyInput: { id: "L1" },
    canonicalInput: { id: "C1" },
    runtimeDecision: createRuntimeDecision({
      selectedMode: RUNTIME_MODE.LEGACY_ONLY,
      selectedExecutor: RUNTIME_EXECUTOR.LEGACY,
      canonicalAllowed: false,
      shadowAllowed: false,
    }),
    metadata: { phase: "3A.2" },
    ...overrides,
  });
}

function eligibleDeps(requestOverrides = {}, optionOverrides = {}) {
  const request = baseRequest({
    runtimeDecision: createRuntimeDecision({
      selectedMode: RUNTIME_MODE.LEGACY_ONLY,
      selectedExecutor: RUNTIME_EXECUTOR.LEGACY,
      canonicalAllowed: true,
      shadowAllowed: true,
    }),
    ...requestOverrides,
  });
  const options = {
    flags: createFeatureFlagSnapshot({
      global: { enabled: true, killSwitch: false },
      shadow: { enabled: true, samplingRate: 1 },
    }),
    capabilityAllowlist: [RUNTIME_CAPABILITY.PARTICIPANT],
    operationAllowlist: ["create"],
    sampleIncluded: true,
    ...optionOverrides,
  };
  return { request, options };
}

test("3A2 default eligibility is false", () => {
  const eligibility = resolveShadowEligibility({});
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasonCodes.length >= 1);
});

test("3A2 shadow disabled via feature flag", () => {
  const { request, options } = eligibleDeps({}, {
    flags: createFeatureFlagSnapshot({
      global: { enabled: true, killSwitch: false },
      shadow: { enabled: false, samplingRate: 1 },
    }),
  });
  const eligibility = resolveShadowEligibility({ request, options });
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasonCodes.includes(SHADOW_REASON_CODE.SHADOW_DISABLED));
});

test("3A2 canonical disallowed", () => {
  const { request, options } = eligibleDeps({
    runtimeDecision: createRuntimeDecision({
      shadowAllowed: true,
      canonicalAllowed: false,
    }),
  });
  const eligibility = resolveShadowEligibility({ request, options });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reasonCode, SHADOW_REASON_CODE.CANONICAL_NOT_ALLOWED);
});

test("3A2 shadow not allowed by runtime decision", () => {
  const { request, options } = eligibleDeps({
    runtimeDecision: createRuntimeDecision({
      shadowAllowed: false,
      canonicalAllowed: true,
    }),
  });
  const eligibility = resolveShadowEligibility({ request, options });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reasonCode, SHADOW_REASON_CODE.SHADOW_NOT_ALLOWED);
});

test("3A2 kill switch active", () => {
  const { request, options } = eligibleDeps({}, {
    flags: createFeatureFlagSnapshot({
      global: { enabled: true, killSwitch: true },
      shadow: { enabled: true, samplingRate: 1 },
    }),
  });
  const eligibility = resolveShadowEligibility({ request, options });
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasonCodes.includes(SHADOW_REASON_CODE.KILL_SWITCH_ACTIVE));
});

test("3A2 capability not allowed", () => {
  const { request, options } = eligibleDeps({}, {
    capabilityAllowlist: [RUNTIME_CAPABILITY.DRAW],
  });
  const eligibility = resolveShadowEligibility({ request, options });
  assert.equal(eligibility.eligible, false);
  assert.ok(
    eligibility.reasonCodes.includes(SHADOW_REASON_CODE.CAPABILITY_NOT_ALLOWED)
  );
});

test("3A2 operation not allowed", () => {
  const { request, options } = eligibleDeps({}, {
    operationAllowlist: ["update"],
  });
  const eligibility = resolveShadowEligibility({ request, options });
  assert.equal(eligibility.eligible, false);
  assert.ok(
    eligibility.reasonCodes.includes(SHADOW_REASON_CODE.OPERATION_NOT_ALLOWED)
  );
});

test("3A2 invalid request", () => {
  const eligibility = resolveShadowEligibility({
    request: {
      capability: "",
      operation: "",
      correlationId: "",
    },
  });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reasonCode, SHADOW_REASON_CODE.INVALID_REQUEST);
});

test("3A2 sampling excluded when not injected or false", () => {
  const { request, options } = eligibleDeps({}, { sampleIncluded: false });
  const eligibility = resolveShadowEligibility({ request, options });
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasonCodes.includes(SHADOW_REASON_CODE.SAMPLE_EXCLUDED));

  const missing = resolveShadowEligibility({
    request,
    options: { ...options, sampleIncluded: undefined },
  });
  assert.equal(missing.eligible, false);
  assert.ok(missing.reasonCodes.includes(SHADOW_REASON_CODE.SAMPLE_EXCLUDED));
});

test("3A2 eligible when all dependencies injected", () => {
  const { request, options } = eligibleDeps();
  const eligibility = resolveShadowEligibility({ request, options });
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.reasonCode, SHADOW_REASON_CODE.ELIGIBLE);
});

test("3A2 default plan returns Legacy primary and return source", () => {
  const plan = resolveShadowExecutionPlan({});
  assert.equal(plan.primaryExecution, SHADOW_PRIMARY_EXECUTION.LEGACY);
  assert.equal(plan.resultReturnSource, SHADOW_RETURN_SOURCE.LEGACY);
  assert.equal(plan.shadowExecutionEnabled, false);
  assert.equal(plan.canonicalInvocationAllowed, false);
  assert.equal(plan.shadowExecution, SHADOW_SECONDARY_EXECUTION.NONE);
  assert.equal(plan.reasonCode, SHADOW_REASON_CODE.PLAN_SKIPPED);
});

test("3A2 eligible plan never makes Canonical the return source", () => {
  const { request, options } = eligibleDeps();
  const eligibility = resolveShadowEligibility({ request, options });
  const plan = resolveShadowExecutionPlan({ eligibility });
  assert.equal(plan.shadowExecutionEnabled, true);
  assert.equal(plan.shadowExecution, SHADOW_SECONDARY_EXECUTION.CANONICAL);
  assert.equal(plan.canonicalInvocationAllowed, false);
  assert.equal(plan.primaryExecution, SHADOW_PRIMARY_EXECUTION.LEGACY);
  assert.equal(plan.resultReturnSource, SHADOW_RETURN_SOURCE.LEGACY);
  assert.equal(plan.reasonCode, SHADOW_REASON_CODE.PLAN_CREATED);
});

test("3A2 comparison equivalent", () => {
  const comparison = compareShadowResults({
    envelope: createShadowResultEnvelope({
      legacyResult: { score: 11, winner: "A" },
      canonicalResult: { score: 11, winner: "A" },
    }),
  });
  assert.equal(comparison.status, SHADOW_COMPARISON_STATUS.EQUIVALENT);
  assert.equal(comparison.reasonCode, SHADOW_REASON_CODE.COMPARISON_EQUIVALENT);
  assert.equal(comparison.differences.length, 0);
});

test("3A2 comparison non-equivalent with structured differences", () => {
  const comparison = compareShadowResults({
    envelope: createShadowResultEnvelope({
      legacyResult: { score: 11 },
      canonicalResult: { score: 9 },
    }),
  });
  assert.equal(comparison.status, SHADOW_COMPARISON_STATUS.NON_EQUIVALENT);
  assert.equal(comparison.reasonCode, SHADOW_REASON_CODE.COMPARISON_DIVERGED);
  assert.ok(comparison.differences.length >= 1);
  const diff = comparison.differences[0];
  assert.equal(typeof diff.path, "string");
  assert.ok(Object.values(SHADOW_DIFFERENCE_KIND).includes(diff.kind));
  assert.equal(typeof diff.message, "string");
});

test("3A2 comparison not comparable", () => {
  const comparison = compareShadowResults({
    envelope: createShadowResultEnvelope({
      legacyResult: null,
      canonicalResult: { ok: true },
    }),
  });
  assert.equal(comparison.status, SHADOW_COMPARISON_STATUS.NOT_COMPARABLE);
  assert.equal(
    comparison.reasonCode,
    SHADOW_REASON_CODE.COMPARISON_NOT_COMPARABLE
  );
});

test("3A2 legacy error only", () => {
  const comparison = compareShadowResults({
    envelope: createShadowResultEnvelope({
      legacyError: { code: "LEGACY_FAIL", message: "boom" },
      canonicalResult: { ok: true },
    }),
  });
  assert.equal(comparison.status, SHADOW_COMPARISON_STATUS.ERROR);
  assert.equal(comparison.reasonCode, SHADOW_REASON_CODE.LEGACY_ERROR);
});

test("3A2 canonical error only", () => {
  const comparison = compareShadowResults({
    envelope: createShadowResultEnvelope({
      legacyResult: { ok: true },
      canonicalError: { code: "CANONICAL_FAIL", message: "boom" },
    }),
  });
  assert.equal(comparison.status, SHADOW_COMPARISON_STATUS.ERROR);
  assert.equal(comparison.reasonCode, SHADOW_REASON_CODE.CANONICAL_ERROR);
});

test("3A2 both error", () => {
  const comparison = compareShadowResults({
    envelope: createShadowResultEnvelope({
      legacyError: { code: "X", message: "a" },
      canonicalError: { code: "Y", message: "b" },
    }),
  });
  assert.equal(comparison.status, SHADOW_COMPARISON_STATUS.ERROR);
  assert.equal(comparison.reasonCode, SHADOW_REASON_CODE.BOTH_ERROR);
});

test("3A2 normalization strips transport-only keys", () => {
  const result = normalizeShadowPayload({
    legacy: { id: "1", debug: true, value: 1 },
    canonical: { id: "1", debug: false, value: 1 },
    policy: { stripKeys: ["debug"] },
  });
  assert.deepEqual(result.legacyNormalized, { id: "1", value: 1 });
  assert.deepEqual(result.canonicalNormalized, { id: "1", value: 1 });
  const comparison = compareShadowResults({
    envelope: createShadowResultEnvelope({
      legacyResult: { id: "1", debug: true, value: 1 },
      canonicalResult: { id: "1", debug: false, value: 1 },
    }),
    normalizationPolicy: { stripKeys: ["debug"] },
  });
  assert.equal(comparison.status, SHADOW_COMPARISON_STATUS.EQUIVALENT);
});

test("3A2 stable reason codes are namespaced constants", () => {
  assert.equal(SHADOW_REASON_CODE.SHADOW_DISABLED, "SHADOW_DISABLED");
  assert.equal(SHADOW_REASON_CODE.COMPARISON_DIVERGED, "COMPARISON_DIVERGED");
  assert.equal(SHADOW_REASON_CODE.ELIGIBLE, "ELIGIBLE");
});

test("3A2 diagnostics are pure data with no persistence markers", () => {
  const { request, options } = eligibleDeps();
  const eligibility = resolveShadowEligibility({ request, options });
  const plan = resolveShadowExecutionPlan({ eligibility });
  const comparison = compareShadowResults({
    envelope: createShadowResultEnvelope({
      legacyResult: { a: 1 },
      canonicalResult: { a: 1 },
      legacyDurationMs: 3,
      canonicalDurationMs: 4,
    }),
  });
  const diagnostics = buildShadowDiagnostics({
    request,
    eligibility,
    plan,
    comparison,
    envelope: createShadowResultEnvelope({
      legacyDurationMs: 3,
      canonicalDurationMs: 4,
    }),
  });
  assert.equal(diagnostics.correlationId, "corr-1");
  assert.equal(diagnostics.metadata.persistence, false);
  assert.equal(diagnostics.metadata.analytics, false);
  assert.equal(diagnostics.metadata.console, false);
  assert.ok(isJsonSafe(diagnostics));
});

test("3A2 audit event factories return pure data", () => {
  const events = [
    createShadowEligibilityEvaluatedEvent({
      correlationId: "c1",
      reasonCode: SHADOW_REASON_CODE.SHADOW_DISABLED,
      evaluatedAt: "2026-07-18T08:00:00.000Z",
    }),
    createShadowPlanCreatedEvent({
      correlationId: "c1",
      reasonCode: SHADOW_REASON_CODE.PLAN_CREATED,
      evaluatedAt: "2026-07-18T08:00:00.000Z",
    }),
    createShadowExecutionSkippedEvent({
      correlationId: "c1",
      reasonCode: SHADOW_REASON_CODE.PLAN_SKIPPED,
      evaluatedAt: "2026-07-18T08:00:00.000Z",
    }),
    createShadowComparisonCompletedEvent({
      correlationId: "c1",
      reasonCode: SHADOW_REASON_CODE.COMPARISON_EQUIVALENT,
      evaluatedAt: "2026-07-18T08:00:00.000Z",
    }),
    createShadowDivergenceDetectedEvent({
      correlationId: "c1",
      reasonCode: SHADOW_REASON_CODE.COMPARISON_DIVERGED,
      evaluatedAt: "2026-07-18T08:00:00.000Z",
    }),
  ];
  assert.equal(
    events[0].eventType,
    SHADOW_AUDIT_EVENT_TYPE.SHADOW_ELIGIBILITY_EVALUATED
  );
  assert.equal(
    events[4].eventType,
    SHADOW_AUDIT_EVENT_TYPE.SHADOW_DIVERGENCE_DETECTED
  );
  for (const event of events) {
    assert.ok(isJsonSafe(event));
    assert.equal(event.shadowVersion, SHADOW_INFRASTRUCTURE_VERSION);
  }
});

test("3A2 input objects are not mutated", () => {
  const decision = createRuntimeDecision({
    shadowAllowed: true,
    canonicalAllowed: true,
  });
  const original = {
    competitionId: "comp-1",
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
    operation: "create",
    correlationId: "corr-mut",
    executionContext: baseContext(),
    legacyInput: { nested: { n: 1 } },
    canonicalInput: { nested: { n: 1 } },
    runtimeDecision: decision,
    metadata: { keep: true },
  };
  const snapshot = cloneJsonSafe(original);
  resolveShadowEligibility({
    request: original,
    options: {
      flags: createFeatureFlagSnapshot({
        shadow: { enabled: true, samplingRate: 1 },
      }),
      capabilityAllowlist: [RUNTIME_CAPABILITY.PARTICIPANT],
      operationAllowlist: ["create"],
      sampleIncluded: true,
    },
  });
  assert.deepEqual(original, snapshot);
});

test("3A2 deterministic output for same input", () => {
  const { request, options } = eligibleDeps();
  const a = resolveShadowEligibility({ request, options });
  const b = resolveShadowEligibility({ request, options });
  assert.deepEqual(a, b);

  const envelope = createShadowResultEnvelope({
    legacyResult: { x: 1, y: [2, 3] },
    canonicalResult: { x: 1, y: [2, 3] },
  });
  const c1 = compareShadowResults({ envelope });
  const c2 = compareShadowResults({ envelope });
  assert.deepEqual(c1, c2);
});

test("3A2 report summarizer flags", () => {
  const summary = summarizeShadowReport({
    comparison: compareShadowResults({
      envelope: createShadowResultEnvelope({
        legacyResult: { a: 1 },
        canonicalResult: { a: 2 },
      }),
    }),
  });
  assert.equal(summary.equivalent, false);
  assert.equal(summary.diverged, true);
  assert.ok(summary.differenceCount >= 1);
  assert.ok(summary.highestSeverity);

  const skipped = summarizeShadowReport({
    comparison: compareShadowResults({ skip: true }),
  });
  assert.equal(skipped.skipped, true);
});

test("3A2 safety invariants: defaults prove Production unchanged", () => {
  const decision = createRuntimeDecision({});
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);

  const eligibility = resolveShadowEligibility({});
  assert.equal(eligibility.eligible, false);

  const plan = resolveShadowExecutionPlan({});
  assert.equal(plan.canonicalInvocationAllowed, false);
  assert.equal(plan.primaryExecution, SHADOW_PRIMARY_EXECUTION.LEGACY);
  assert.equal(plan.resultReturnSource, SHADOW_RETURN_SOURCE.LEGACY);
});

test("3A2 createShadowDifference shape", () => {
  const diff = createShadowDifference({
    path: "score",
    kind: SHADOW_DIFFERENCE_KIND.VALUE_MISMATCH,
    legacyValue: 11,
    canonicalValue: 9,
    severity: SHADOW_DIFFERENCE_SEVERITY.HIGH,
    message: "score mismatch",
  });
  assert.equal(diff.path, "score");
  assert.equal(diff.kind, SHADOW_DIFFERENCE_KIND.VALUE_MISMATCH);
});

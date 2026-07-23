/**
 * CORE-19 Workflow Engine — Phase 1D control + Phase 1E certification.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WORKFLOW_STATUS,
  WORKFLOW_EVENT_TYPE,
  WORKFLOW_ERROR_CODE,
  WORKFLOW_EFFECT_STATUS,
  WorkflowError,
  createWorkflowDefinition,
  createWorkflowState,
  createWorkflowTransitionRequest,
  createWorkflowTransitionContext,
  createTransitionAuthorizationDecision,
  createTransitionPrerequisiteResult,
  createWorkflowEffectDescriptor,
  createWorkflowEvent,
  createWorkflowPayloadFingerprint,
  evaluateTransitionEffects,
  applyTransitionEffects,
  orchestrateWorkflowTransition,
  pauseWorkflow,
  resumeWorkflow,
  restartWorkflow,
  failWorkflow,
  completeWorkflow,
  evaluateWorkflowTransition,
  applyWorkflowTransition,
  resolveDuplicateOperation,
} from "../src/features/competition-core/workflow/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_ROOT = path.join(ROOT, "src/features/competition-core/workflow");
const OCCURRED_AT = "2026-07-23T08:00:00.000Z";

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function baseDefinition(overrides = {}) {
  return createWorkflowDefinition({
    definitionId: "wf-def-1d",
    definitionVersion: "1.0.0",
    name: "Phase1D Demo",
    steps: [
      { stepId: "step-draft", status: WORKFLOW_STATUS.DRAFT },
      { stepId: "step-ready", status: WORKFLOW_STATUS.READY },
      { stepId: "step-running", status: WORKFLOW_STATUS.RUNNING },
      { stepId: "step-paused", status: WORKFLOW_STATUS.PAUSED },
      { stepId: "step-completed", status: WORKFLOW_STATUS.COMPLETED },
    ],
    transitions: [
      {
        transitionId: "t-draft-to-ready",
        fromStepId: "step-draft",
        toStepId: "step-ready",
        fromStatus: WORKFLOW_STATUS.DRAFT,
        toStatus: WORKFLOW_STATUS.READY,
        effects: [
          {
            effectId: "fx-b",
            effectType: "NOTIFY",
            required: true,
            order: 2,
            input: { channel: "b" },
          },
          {
            effectId: "fx-a",
            effectType: "NOTIFY",
            required: true,
            order: 1,
            input: { channel: "a" },
          },
        ],
      },
      {
        transitionId: "t-ready-to-running",
        fromStepId: "step-ready",
        toStepId: "step-running",
        fromStatus: WORKFLOW_STATUS.READY,
        toStatus: WORKFLOW_STATUS.RUNNING,
        effects: [
          {
            effectId: "fx-optional",
            effectType: "HINT",
            required: false,
            order: 1,
          },
        ],
        allowOptionalEffectFailure: true,
      },
    ],
    metadata: {
      allowCompletion: true,
      restartPolicy: {
        allowed: true,
        allowedTargetStepIds: ["step-draft", "step-ready"],
      },
    },
    ...overrides,
  });
}

function runningState(overrides = {}) {
  return createWorkflowState({
    workflowInstanceId: "wf-inst-1d",
    definitionId: "wf-def-1d",
    definitionVersion: "1.0.0",
    currentStepId: "step-running",
    status: WORKFLOW_STATUS.RUNNING,
    revision: 2,
    ...overrides,
  });
}

function draftState(overrides = {}) {
  return createWorkflowState({
    workflowInstanceId: "wf-inst-1d",
    definitionId: "wf-def-1d",
    definitionVersion: "1.0.0",
    currentStepId: "step-draft",
    status: WORKFLOW_STATUS.DRAFT,
    revision: 0,
    ...overrides,
  });
}

function auth() {
  return createTransitionAuthorizationDecision({
    allowed: true,
    actorId: "actor-1",
    actorType: "SYSTEM",
    decisionCode: "ALLOWED",
    reason: "ALLOWED",
  });
}

function ctx(overrides = {}) {
  return {
    occurredAt: OCCURRED_AT,
    eventId: "evt-1d",
    actorId: "actor-1",
    actorType: "SYSTEM",
    authorization: auth(),
    prerequisites: [],
    guards: [],
    seenIdempotencyKeys: [],
    payload: {},
    ...overrides,
  };
}

describe("CORE-19 Phase 1D — effects", () => {
  it("1. required effects all succeed", () => {
    const effects = [
      createWorkflowEffectDescriptor({
        effectId: "fx-b",
        effectType: "NOTIFY",
        required: true,
        order: 2,
      }),
      createWorkflowEffectDescriptor({
        effectId: "fx-a",
        effectType: "NOTIFY",
        required: true,
        order: 1,
      }),
    ];
    const evaluation = evaluateTransitionEffects({
      effects,
      outcomes: {
        "fx-a": { ok: true, status: WORKFLOW_EFFECT_STATUS.SUCCEEDED },
        "fx-b": { ok: true, status: WORKFLOW_EFFECT_STATUS.SUCCEEDED },
      },
    });
    assert.equal(evaluation.canComplete, true);
    assert.equal(evaluation.ok, true);
  });

  it("2. required effect failure blocks transition", () => {
    const result = orchestrateWorkflowTransition({
      definition: baseDefinition(),
      state: draftState(),
      request: createWorkflowTransitionRequest({
        transitionId: "t-draft-to-ready",
        idempotencyKey: "idem-fx-fail",
        correlationId: "corr-fx-fail",
      }),
      context: createWorkflowTransitionContext(ctx({ eventId: "evt-fx-fail" })),
      outcomes: {
        "fx-a": { ok: true, status: WORKFLOW_EFFECT_STATUS.SUCCEEDED },
        "fx-b": {
          ok: false,
          status: WORKFLOW_EFFECT_STATUS.FAILED,
          dependencyCode: "DEP_X",
          explanation: "effect b failed",
        },
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, WORKFLOW_ERROR_CODE.TRANSITION_EFFECT_FAILED);
    assert.equal(result.state, null);
    assert.ok(
      result.events.some((e) => e.eventType === WORKFLOW_EVENT_TYPE.TRANSITION_FAILED)
    );
    assert.ok(result.explanation.details.failedEffectIds.includes("fx-b"));
  });

  it("3. optional effect failure remains warning", () => {
    const evaluation = evaluateTransitionEffects({
      effects: [
        {
          effectId: "fx-optional",
          effectType: "HINT",
          required: false,
          order: 1,
        },
      ],
      outcomes: {
        "fx-optional": {
          ok: false,
          status: WORKFLOW_EFFECT_STATUS.FAILED,
          warning: "optional failed",
        },
      },
      allowOptionalEffectFailure: true,
    });
    assert.equal(evaluation.canComplete, true);
    assert.ok(evaluation.warnings.includes("optional failed"));
  });

  it("4. stable effect ordering", () => {
    const a = evaluateTransitionEffects({
      effects: [
        { effectId: "fx-b", effectType: "X", required: true, order: 2 },
        { effectId: "fx-a", effectType: "X", required: true, order: 1 },
      ],
      outcomes: {
        "fx-a": { ok: true, status: "SUCCEEDED" },
        "fx-b": { ok: true, status: "SUCCEEDED" },
      },
    });
    const b = evaluateTransitionEffects({
      effects: [
        { effectId: "fx-a", effectType: "X", required: true, order: 1 },
        { effectId: "fx-b", effectType: "X", required: true, order: 2 },
      ],
      outcomes: {
        "fx-b": { ok: true, status: "SUCCEEDED" },
        "fx-a": { ok: true, status: "SUCCEEDED" },
      },
    });
    assert.deepEqual(
      a.descriptors.map((d) => d.effectId),
      ["fx-a", "fx-b"]
    );
    assert.deepEqual(
      a.results.map((r) => r.effectId),
      b.results.map((r) => r.effectId)
    );
  });

  it("5. effect inputs are not mutated", () => {
    const effects = [
      {
        effectId: "fx-a",
        effectType: "X",
        required: true,
        order: 1,
        input: { nested: { v: 1 } },
      },
    ];
    const outcomes = {
      "fx-a": { ok: true, status: "SUCCEEDED", output: { done: true } },
    };
    const effectsSnap = JSON.stringify(effects);
    const outcomesSnap = JSON.stringify(outcomes);
    applyTransitionEffects({ effects, outcomes });
    assert.equal(JSON.stringify(effects), effectsSnap);
    assert.equal(JSON.stringify(outcomes), outcomesSnap);
  });
});

describe("CORE-19 Phase 1D — failure and completion", () => {
  it("6. workflow failure produces FAILED state", () => {
    const result = failWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-fail",
        correlationId: "corr-fail",
        reasonCode: "HARD_FAIL",
        reason: "operator fail",
        actorId: "actor-1",
      },
      context: ctx({ eventId: "evt-fail" }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.state.status, WORKFLOW_STATUS.FAILED);
    assert.equal(result.state.currentStepId, "step-running");
    assert.equal(result.state.previousStepId, "step-running");
  });

  it("7. workflow failure emits correct event", () => {
    const result = failWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-fail-evt",
        reason: "boom",
        reasonCode: "BOOM",
      },
      context: ctx({ eventId: "evt-fail-2" }),
    });
    assert.ok(
      result.events.some((e) => e.eventType === WORKFLOW_EVENT_TYPE.WORKFLOW_FAILED)
    );
    assert.equal(result.events[0].workflowInstanceId, "wf-inst-1d");
    assert.equal(result.events[0].idempotencyKey, "idem-fail-evt");
  });

  it("8. workflow completion produces COMPLETED state", () => {
    const result = completeWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-complete",
        reasonCode: "DONE",
        payload: { targetStepId: "step-completed" },
      },
      context: ctx({ eventId: "evt-complete" }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.state.status, WORKFLOW_STATUS.COMPLETED);
    assert.equal(result.state.currentStepId, "step-completed");
  });

  it("9. completion emits WORKFLOW_COMPLETED", () => {
    const result = completeWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-complete-evt",
        reasonCode: "DONE",
      },
      context: ctx({ eventId: "evt-complete-2" }),
    });
    assert.ok(
      result.events.some(
        (e) => e.eventType === WORKFLOW_EVENT_TYPE.WORKFLOW_COMPLETED
      )
    );
  });

  it("10. completion from invalid step blocks", () => {
    const definition = baseDefinition({
      metadata: {
        allowCompletion: false,
        restartPolicy: { allowed: true, allowedTargetStepIds: ["step-draft"] },
      },
    });
    const result = completeWorkflow({
      definition,
      state: draftState(),
      request: {
        idempotencyKey: "idem-complete-bad",
        reasonCode: "DONE",
      },
      context: ctx({ eventId: "evt-complete-bad" }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED);
  });
});

describe("CORE-19 Phase 1D — pause / resume / restart", () => {
  it("11. pause RUNNING workflow succeeds", () => {
    const result = pauseWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-pause",
        reason: "break",
        reasonCode: "BREAK",
      },
      context: ctx({ eventId: "evt-pause" }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.state.status, WORKFLOW_STATUS.PAUSED);
  });

  it("12. pause preserves current step", () => {
    const result = pauseWorkflow({
      definition: baseDefinition(),
      state: runningState({ currentStepId: "step-running" }),
      request: {
        idempotencyKey: "idem-pause-step",
        reasonCode: "BREAK",
      },
      context: ctx({ eventId: "evt-pause-step" }),
    });
    assert.equal(result.state.currentStepId, "step-running");
  });

  it("13. pause terminal workflow blocks", () => {
    const result = pauseWorkflow({
      definition: baseDefinition(),
      state: runningState({
        status: WORKFLOW_STATUS.COMPLETED,
        currentStepId: "step-completed",
      }),
      request: {
        idempotencyKey: "idem-pause-term",
        reasonCode: "BREAK",
      },
      context: ctx({ eventId: "evt-pause-term" }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST);
  });

  it("14. resume PAUSED workflow succeeds", () => {
    const result = resumeWorkflow({
      definition: baseDefinition(),
      state: runningState({ status: WORKFLOW_STATUS.PAUSED }),
      request: {
        idempotencyKey: "idem-resume",
        reason: "continue",
        reasonCode: "CONTINUE",
        authorization: auth(),
      },
      context: ctx({ eventId: "evt-resume" }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.state.status, WORKFLOW_STATUS.RUNNING);
    assert.ok(
      result.events.some((e) => e.eventType === WORKFLOW_EVENT_TYPE.WORKFLOW_RESUMED)
    );
  });

  it("15. resume non-paused workflow blocks", () => {
    const result = resumeWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-resume-bad",
        reasonCode: "CONTINUE",
      },
      context: ctx({ eventId: "evt-resume-bad" }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, WORKFLOW_ERROR_CODE.INVALID_RESUME_REQUEST);
  });

  it("16. restart to allowed target succeeds", () => {
    const result = restartWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-restart",
        reasonCode: "RESTART",
        targetStepId: "step-draft",
        restartMode: "TARGET_STEP",
      },
      context: ctx({ eventId: "evt-restart" }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.state.currentStepId, "step-draft");
    assert.equal(result.state.restartCount, 1);
    assert.equal(result.state.previousStepId, "step-running");
    assert.ok(
      result.events.some(
        (e) => e.eventType === WORKFLOW_EVENT_TYPE.WORKFLOW_RESTARTED
      )
    );
    assert.equal(result.details.recoveryInvoked, false);
  });

  it("17. restart to unknown target blocks", () => {
    const result = restartWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-restart-unknown",
        reasonCode: "RESTART",
        targetStepId: "missing-step",
      },
      context: ctx({ eventId: "evt-restart-unknown" }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, WORKFLOW_ERROR_CODE.UNKNOWN_STEP);
  });

  it("18. restart without policy blocks", () => {
    const definition = baseDefinition({
      metadata: { allowCompletion: true },
    });
    const result = restartWorkflow({
      definition,
      state: runningState(),
      request: {
        idempotencyKey: "idem-restart-nopolicy",
        reasonCode: "RESTART",
        targetStepId: "step-draft",
      },
      context: ctx({ eventId: "evt-restart-nopolicy" }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, WORKFLOW_ERROR_CODE.RESTART_NOT_ALLOWED);
  });

  it("19. restart does not invoke recovery behavior", () => {
    const files = listJsFiles(WORKFLOW_ROOT);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(
        /from\s+['"][^'"]*recovery[^'"]*['"]/.test(text),
        false,
        `${path.relative(ROOT, file)} must not import recovery modules`
      );
      assert.equal(/recoverCheckpoint\s*\(|executeRecovery\s*\(/.test(text), false);
    }
    const result = restartWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-restart-norecovery",
        reasonCode: "RESTART",
        targetStepId: "step-ready",
      },
      context: ctx({ eventId: "evt-restart-norecovery" }),
    });
    assert.equal(result.details.recoveryInvoked, false);
    assert.equal(result.events[0].payload.recoveryInvoked, false);
  });
});

describe("CORE-19 Phase 1D — duplicates, distinct failures, determinism", () => {
  it("20. same idempotency key + same payload produces deterministic no-op", () => {
    const request = {
      idempotencyKey: "idem-dup",
      reasonCode: "BREAK",
      reason: "break",
      payload: { note: 1 },
    };
    const fingerprint = createWorkflowPayloadFingerprint({
      operation: "PAUSE",
      payload: {
        ...request.payload,
        reason: request.reason,
        reasonCode: request.reasonCode,
        targetStepId: null,
        restartMode: null,
      },
    });
    const first = pauseWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request,
      context: ctx({ eventId: "evt-dup-1" }),
    });
    assert.equal(first.ok, true);
    const second = pauseWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request,
      context: ctx({
        eventId: "evt-dup-2",
        processedOperations: [
          {
            idempotencyKey: "idem-dup",
            payloadFingerprint: fingerprint,
          },
        ],
      }),
    });
    assert.equal(second.ok, true);
    assert.equal(second.noop, true);
    assert.equal(second.duplicate, true);
    assert.equal(second.events.length, 0);
    assert.equal(second.state.status, WORKFLOW_STATUS.RUNNING);
  });

  it("21. same idempotency key + different payload produces deterministic conflict", () => {
    const fingerprint = createWorkflowPayloadFingerprint({
      operation: "PAUSE",
      payload: {
        note: 1,
        reason: "break",
        reasonCode: "BREAK",
        targetStepId: null,
        restartMode: null,
      },
    });
    const result = pauseWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-dup",
        reasonCode: "BREAK",
        reason: "break",
        payload: { note: 2 },
      },
      context: ctx({
        eventId: "evt-dup-conflict",
        processedOperations: [
          { idempotencyKey: "idem-dup", payloadFingerprint: fingerprint },
        ],
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(
      result.code,
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION
    );
  });

  it("22. failure, denial and prerequisite failure remain distinct", () => {
    const denied = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: draftState(),
      request: createWorkflowTransitionRequest({
        transitionId: "t-draft-to-ready",
        idempotencyKey: "idem-deny",
      }),
      context: createWorkflowTransitionContext(
        ctx({
          eventId: "evt-deny",
          authorization: createTransitionAuthorizationDecision({
            allowed: false,
            reason: "NO",
          }),
        })
      ),
    });
    const prereq = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: draftState(),
      request: createWorkflowTransitionRequest({
        transitionId: "t-draft-to-ready",
        idempotencyKey: "idem-prereq",
      }),
      context: createWorkflowTransitionContext(
        ctx({
          eventId: "evt-prereq",
          prerequisites: [
            createTransitionPrerequisiteResult({
              satisfied: false,
              code: "P",
              message: "missing",
            }),
          ],
        })
      ),
    });
    const failed = failWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-fail-distinct",
        reason: "failed",
        reasonCode: "FAILED",
      },
      context: ctx({ eventId: "evt-fail-distinct" }),
    });
    assert.equal(denied.code, WORKFLOW_ERROR_CODE.TRANSITION_UNAUTHORIZED);
    assert.equal(prereq.code, WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED);
    assert.equal(failed.state.status, WORKFLOW_STATUS.FAILED);
    assert.equal(failed.details.failureKind, "WORKFLOW_FAILED");
    assert.notEqual(denied.code, failed.code);
    assert.notEqual(prereq.code, WORKFLOW_ERROR_CODE.WORKFLOW_FAILED);
  });

  it("23. event payload identity is stable", () => {
    const a = pauseWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-evt-stable",
        reasonCode: "BREAK",
        correlationId: "corr-stable",
      },
      context: ctx({ eventId: "evt-stable" }),
    });
    const b = pauseWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-evt-stable",
        reasonCode: "BREAK",
        correlationId: "corr-stable",
      },
      context: ctx({ eventId: "evt-stable" }),
    });
    assert.deepEqual(a.events, b.events);
    for (const event of a.events) {
      assert.ok(event.eventId);
      assert.ok(event.payloadFingerprint);
      assert.equal(event.occurredAt, OCCURRED_AT);
      assert.equal(event.definitionId, "wf-def-1d");
      assert.equal(event.definitionVersion, "1.0.0");
    }
  });

  it("24. identical logical input produces deeply equal output", () => {
    const input = {
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-eq",
        reasonCode: "BREAK",
      },
      context: ctx({ eventId: "evt-eq" }),
    };
    assert.deepEqual(pauseWorkflow(input), pauseWorkflow(input));
  });

  it("25. object key order does not change fingerprint", () => {
    const fp1 = createWorkflowPayloadFingerprint({ b: 2, a: 1 });
    const fp2 = createWorkflowPayloadFingerprint({ a: 1, b: 2 });
    assert.equal(fp1, fp2);
    const d1 = resolveDuplicateOperation({
      idempotencyKey: "k",
      operation: "PAUSE",
      payload: { z: 1, a: 2 },
    });
    const d2 = resolveDuplicateOperation({
      idempotencyKey: "k",
      operation: "PAUSE",
      payload: { a: 2, z: 1 },
    });
    assert.equal(d1.fingerprint, d2.fingerprint);
  });

  it("26. inputs are not mutated", () => {
    const definition = {
      definitionId: "wf-def-1d",
      definitionVersion: "1.0.0",
      steps: [
        { stepId: "step-running", status: WORKFLOW_STATUS.RUNNING },
        { stepId: "step-completed", status: WORKFLOW_STATUS.COMPLETED },
      ],
      transitions: [],
      metadata: { allowCompletion: true },
    };
    const state = {
      workflowInstanceId: "wf-inst-1d",
      definitionId: "wf-def-1d",
      definitionVersion: "1.0.0",
      currentStepId: "step-running",
      status: WORKFLOW_STATUS.RUNNING,
      revision: 1,
    };
    const request = {
      idempotencyKey: "idem-immut",
      reasonCode: "DONE",
      payload: { keep: true },
    };
    const context = {
      occurredAt: OCCURRED_AT,
      eventId: "evt-immut",
      prerequisites: [],
    };
    const snaps = [
      JSON.stringify(definition),
      JSON.stringify(state),
      JSON.stringify(request),
      JSON.stringify(context),
    ];
    completeWorkflow({ definition, state, request, context });
    assert.equal(JSON.stringify(definition), snaps[0]);
    assert.equal(JSON.stringify(state), snaps[1]);
    assert.equal(JSON.stringify(request), snaps[2]);
    assert.equal(JSON.stringify(context), snaps[3]);
  });

  it("27. no clock/random/persistence dependency", () => {
    const files = listJsFiles(WORKFLOW_ROOT);
    const forbidden = [
      /Date\.now\s*\(/,
      /new\s+Date\s*\(\s*\)/,
      /Math\.random\s*\(/,
      /randomUUID\s*\(/,
      /supabase/i,
      /localStorage/,
      /indexedDB/,
      /fetch\s*\(/,
      /audit_logs/,
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        assert.equal(
          pattern.test(text),
          false,
          `${path.relative(ROOT, file)} matched ${pattern}`
        );
      }
    }
  });

  it("29. no CORE-20 persistence import", () => {
    const files = listJsFiles(WORKFLOW_ROOT);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("audit-event-log"), false);
      assert.equal(/from\s+['"][^'"]*core-20/i.test(text), false);
      assert.equal(/persistAudit|writeAudit/i.test(text), false);
    }
  });

  it("30. no CORE-23 recovery import", () => {
    const files = listJsFiles(WORKFLOW_ROOT);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(/from\s+['"][^'"]*recovery/i.test(text), false);
      assert.equal(text.includes("last-known-safe"), false);
    }
  });

  it("31. no CORE-15 match resume invocation", () => {
    const files = listJsFiles(WORKFLOW_ROOT);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(/applyMatchTransition\s*\(/.test(text), false);
      assert.equal(/resumeMatch\s*\(/.test(text), false);
      assert.equal(/MATCH_ACTION\.RESUME/.test(text), false);
    }
  });

  it("32. public barrel exports all new contracts and services", async () => {
    const mod = await import(
      "../src/features/competition-core/workflow/index.js"
    );
    for (const name of [
      "evaluateTransitionEffects",
      "applyTransitionEffects",
      "orchestrateWorkflowTransition",
      "pauseWorkflow",
      "resumeWorkflow",
      "restartWorkflow",
      "failWorkflow",
      "completeWorkflow",
      "createWorkflowEffectDescriptor",
      "createWorkflowEffectResult",
      "createWorkflowControlRequest",
      "createWorkflowControlResult",
      "createWorkflowResumeRequest",
      "createWorkflowRestartRequest",
      "createSuppliedWorkflowEffectPort",
      "WORKFLOW_EFFECT_STATUS",
      "WORKFLOW_EVENT_TYPE",
      "resolveDuplicateOperation",
    ]) {
      assert.equal(typeof mod[name] !== "undefined", true, `missing export ${name}`);
    }
    assert.equal(mod.WORKFLOW_EVENT_TYPE.WORKFLOW_FAILED, "WORKFLOW_FAILED");
    assert.ok(mod.WORKFLOW_ERROR_CODE.INVALID_PAUSE_REQUEST);
    // Phase 1B apply remains available and does not require effects.
    const applied = applyWorkflowTransition({
      definition: baseDefinition(),
      state: draftState(),
      request: createWorkflowTransitionRequest({
        transitionId: "t-draft-to-ready",
        idempotencyKey: "idem-barrel",
      }),
      context: createWorkflowTransitionContext(ctx({ eventId: "evt-barrel" })),
    });
    assert.equal(applied.ok, true);
  });
});

describe("CORE-19 Phase 1E — consolidation certification", () => {
  const EVENT_IDENTITY_FIELDS = [
    "eventId",
    "eventType",
    "occurredAt",
    "workflowInstanceId",
    "definitionId",
    "definitionVersion",
    "transitionId",
    "fromStepId",
    "toStepId",
    "fromStatus",
    "toStatus",
    "actorId",
    "actorType",
    "idempotencyKey",
    "correlationId",
    "reasonCode",
    "payloadFingerprint",
  ];

  it("33. public barrel exports complete required Phase 1E surface", async () => {
    const mod = await import(
      "../src/features/competition-core/workflow/index.js"
    );
    for (const name of [
      "WORKFLOW_STATUS",
      "WORKFLOW_EVENT_TYPE",
      "WORKFLOW_ERROR_CODE",
      "WorkflowError",
      "createWorkflowDefinition",
      "createWorkflowState",
      "createWorkflowStep",
      "createWorkflowTransitionDefinition",
      "createWorkflowTransitionRequest",
      "createWorkflowTransitionContext",
      "createTransitionAuthorizationDecision",
      "createTransitionPrerequisiteResult",
      "createTransitionGuardDecision",
      "createTransitionExplanation",
      "createWorkflowTransitionResult",
      "createWorkflowEvent",
      "createWorkflowEffectDescriptor",
      "createWorkflowEffectResult",
      "createWorkflowControlRequest",
      "createWorkflowControlResult",
      "createWorkflowResumeRequest",
      "createWorkflowRestartRequest",
      "evaluateWorkflowTransition",
      "applyWorkflowTransition",
      "composeAuthorizationDecision",
      "composePrerequisiteResults",
      "composeGuardDecisions",
      "adaptCore01GuardDecision",
      "adaptCore15MatchPrerequisite",
      "adaptCore16ScoringSignal",
      "adaptCore17ResultValidationGate",
      "adaptCore18StandingsCompletion",
      "evaluateTransitionEffects",
      "applyTransitionEffects",
      "orchestrateWorkflowTransition",
      "pauseWorkflow",
      "resumeWorkflow",
      "restartWorkflow",
      "failWorkflow",
      "completeWorkflow",
    ]) {
      assert.equal(
        typeof mod[name] !== "undefined",
        true,
        `missing export ${name}`
      );
    }
    assert.equal(typeof mod.controlHelpers, "undefined");
  });

  it("34. createWorkflowEvent requires explicit eventId (no implicit invent)", () => {
    assert.throws(
      () =>
        createWorkflowEvent({
          eventType: WORKFLOW_EVENT_TYPE.WORKFLOW_PAUSED,
          occurredAt: OCCURRED_AT,
          workflowInstanceId: "wf-inst-1d",
          definitionId: "wf-def-1d",
          definitionVersion: "1.0.0",
          transitionId: "control:pause",
          fromStepId: "step-running",
          toStepId: "step-running",
          fromStatus: WORKFLOW_STATUS.RUNNING,
          toStatus: WORKFLOW_STATUS.PAUSED,
          idempotencyKey: "idem-no-id",
        }),
      (err) =>
        err instanceof WorkflowError &&
        err.code === WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION
    );
  });

  it("35. applyWorkflowTransition same-key same-payload is no-op with empty events", () => {
    const payload = { transitionId: "t-draft-to-ready", note: 1 };
    const fingerprint = createWorkflowPayloadFingerprint({
      operation: "TRANSITION",
      payload,
    });
    const result = applyWorkflowTransition({
      definition: baseDefinition(),
      state: draftState(),
      request: createWorkflowTransitionRequest({
        transitionId: "t-draft-to-ready",
        idempotencyKey: "idem-apply-dup",
        payload: { note: 1 },
      }),
      context: createWorkflowTransitionContext(ctx({ eventId: "evt-apply-dup" })),
      processedOperations: [
        { idempotencyKey: "idem-apply-dup", payloadFingerprint: fingerprint },
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.events.length, 0);
    assert.equal(result.state.status, WORKFLOW_STATUS.DRAFT);
    assert.equal(result.explanation.code, "DUPLICATE_OPERATION_NOOP");
  });

  it("36. applyWorkflowTransition same-key different-payload is typed conflict", () => {
    const fingerprint = createWorkflowPayloadFingerprint({
      operation: "TRANSITION",
      payload: { transitionId: "t-draft-to-ready", note: 1 },
    });
    const result = applyWorkflowTransition({
      definition: baseDefinition(),
      state: draftState(),
      request: createWorkflowTransitionRequest({
        transitionId: "t-draft-to-ready",
        idempotencyKey: "idem-apply-conflict",
        payload: { note: 2 },
      }),
      context: createWorkflowTransitionContext(
        ctx({ eventId: "evt-apply-conflict" })
      ),
      processedOperations: [
        {
          idempotencyKey: "idem-apply-conflict",
          payloadFingerprint: fingerprint,
        },
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.events.length, 0);
    assert.equal(
      result.code,
      WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION
    );
  });

  it("37. control operations preserve full event identity fields", () => {
    const paused = pauseWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-id-pause",
        reasonCode: "BREAK",
        correlationId: "corr-id",
        actorId: "actor-1",
        actorType: "DIRECTOR",
      },
      context: ctx({ eventId: "evt-id-pause", actorId: "actor-1", actorType: "DIRECTOR" }),
    });
    const failed = failWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-id-fail",
        reasonCode: "ABORT",
        correlationId: "corr-id",
        actorId: "actor-1",
        actorType: "DIRECTOR",
      },
      context: ctx({ eventId: "evt-id-fail", actorId: "actor-1", actorType: "DIRECTOR" }),
    });
    const completed = completeWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-id-complete",
        reasonCode: "DONE",
        correlationId: "corr-id",
        actorId: "actor-1",
        actorType: "DIRECTOR",
      },
      context: ctx({ eventId: "evt-id-complete", actorId: "actor-1", actorType: "DIRECTOR" }),
    });
    for (const result of [paused, failed, completed]) {
      assert.equal(result.ok, true);
      assert.ok(result.events.length > 0);
      for (const event of result.events) {
        for (const field of EVENT_IDENTITY_FIELDS) {
          assert.equal(
            Object.prototype.hasOwnProperty.call(event, field),
            true,
            `missing identity field ${field}`
          );
        }
      }
    }
  });

  it("38. completeWorkflow never calculates standings", () => {
    const files = listJsFiles(WORKFLOW_ROOT);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(/calculateStandings\s*\(/.test(text), false);
      assert.equal(/tieBreakCompare\s*\(/.test(text), false);
    }
    const result = completeWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: { idempotencyKey: "idem-no-standings", reasonCode: "DONE" },
      context: ctx({ eventId: "evt-no-standings" }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.state.status, WORKFLOW_STATUS.COMPLETED);
  });

  it("39. restartWorkflow never invokes recovery behavior", () => {
    const result = restartWorkflow({
      definition: baseDefinition(),
      state: runningState(),
      request: {
        idempotencyKey: "idem-no-recovery-1e",
        reasonCode: "RESTART",
        targetStepId: "step-draft",
        restartMode: "TARGET_STEP",
      },
      context: ctx({ eventId: "evt-no-recovery-1e" }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.details.recoveryInvoked, false);
    assert.equal(result.events[0].payload.recoveryInvoked, false);
    assert.equal(JSON.stringify(result).includes("last-known-safe"), false);
  });
  it("40. adapters import only public dependency barrels (no deep imports)", () => {
    const adapterDir = path.join(WORKFLOW_ROOT, "adapters");
    for (const file of listJsFiles(adapterDir)) {
      if (path.basename(file) === "index.js") continue;
      const text = readFileSync(file, "utf8");
      const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
        (m) => m[1]
      );
      for (const spec of imports) {
        if (spec.startsWith("../")) {
          // External competition-core dependency must be public barrel.
          if (
            spec.includes("/constraints/") ||
            spec.includes("/matches/") ||
            spec.includes("/scoring/") ||
            spec.includes("/result-validation/") ||
            spec.includes("/standings/")
          ) {
            assert.equal(
              /\/index\.js$/.test(spec),
              true,
              `${path.basename(file)} deep import ${spec}`
            );
          }
        }
        assert.equal(spec.includes("/src/"), false);
      }
    }
  });
});

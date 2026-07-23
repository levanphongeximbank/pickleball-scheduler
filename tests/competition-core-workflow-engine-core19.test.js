/**
 * CORE-19 Workflow Engine — Phase 1B focused certification tests.
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
  createWorkflowDefinition,
  createWorkflowState,
  createWorkflowTransitionRequest,
  createWorkflowTransitionContext,
  createTransitionAuthorizationDecision,
  createTransitionPrerequisiteResult,
  createTransitionGuardDecision,
  createWorkflowPayloadFingerprint,
  evaluateWorkflowTransition,
  applyWorkflowTransition,
} from "../src/features/competition-core/workflow/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_ROOT = path.join(ROOT, "src/features/competition-core/workflow");
const OCCURRED_AT = "2026-07-23T06:00:00.000Z";

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
    definitionId: "wf-def-1",
    definitionVersion: "1.0.0",
    name: "Phase1B Demo",
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
      },
      {
        transitionId: "t-ready-to-running",
        fromStepId: "step-ready",
        toStepId: "step-running",
        fromStatus: WORKFLOW_STATUS.READY,
        toStatus: WORKFLOW_STATUS.RUNNING,
      },
      {
        transitionId: "t-running-advance",
        fromStepId: "step-running",
        toStepId: "step-running",
        fromStatus: WORKFLOW_STATUS.RUNNING,
        toStatus: WORKFLOW_STATUS.RUNNING,
        requiresRunning: true,
      },
      {
        transitionId: "t-running-to-paused",
        fromStepId: "step-running",
        toStepId: "step-paused",
        fromStatus: WORKFLOW_STATUS.RUNNING,
        toStatus: WORKFLOW_STATUS.PAUSED,
      },
      {
        transitionId: "t-paused-to-running",
        fromStepId: "step-paused",
        toStepId: "step-running",
        fromStatus: WORKFLOW_STATUS.PAUSED,
        toStatus: WORKFLOW_STATUS.RUNNING,
      },
      {
        transitionId: "t-running-to-completed",
        fromStepId: "step-running",
        toStepId: "step-completed",
        fromStatus: WORKFLOW_STATUS.RUNNING,
        toStatus: WORKFLOW_STATUS.COMPLETED,
        requiresRunning: true,
      },
    ],
    ...overrides,
  });
}

function baseState(overrides = {}) {
  return createWorkflowState({
    workflowInstanceId: "wf-inst-1",
    definitionId: "wf-def-1",
    definitionVersion: "1.0.0",
    currentStepId: "step-draft",
    status: WORKFLOW_STATUS.DRAFT,
    revision: 0,
    ...overrides,
  });
}

function auth(overrides = {}) {
  return createTransitionAuthorizationDecision({
    allowed: true,
    actorId: "actor-1",
    actorType: "SYSTEM",
    decisionCode: "ALLOWED",
    reason: "ALLOWED",
    ...overrides,
  });
}

function context(overrides = {}) {
  return createWorkflowTransitionContext({
    occurredAt: OCCURRED_AT,
    eventId: "evt-base-1",
    actorId: "actor-1",
    actorType: "SYSTEM",
    authorization: auth(),
    prerequisites: [],
    guards: [],
    seenIdempotencyKeys: [],
    payload: { note: "canonical" },
    ...overrides,
  });
}

function request(overrides = {}) {
  return createWorkflowTransitionRequest({
    transitionId: "t-draft-to-ready",
    workflowInstanceId: "wf-inst-1",
    idempotencyKey: "idem-1",
    correlationId: "corr-1",
    reasonCode: "ADVANCE",
    payload: { lane: "A" },
    ...overrides,
  });
}

describe("CORE-19 Phase 1B — deterministic transition kernel", () => {
  it("1. valid deterministic transition", () => {
    const definition = baseDefinition();
    const state = baseState();
    const evaluation = evaluateWorkflowTransition({
      definition,
      state,
      request: request(),
      context: context(),
    });
    assert.equal(evaluation.ok, true);
    assert.equal(evaluation.approved, true);
    assert.equal(evaluation.toStatus, WORKFLOW_STATUS.READY);
  });

  it("2. unknown transition", () => {
    const evaluation = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: baseState(),
      request: request({ transitionId: "missing-transition" }),
      context: context(),
    });
    assert.equal(evaluation.ok, false);
    assert.equal(evaluation.code, WORKFLOW_ERROR_CODE.UNKNOWN_TRANSITION);
  });

  it("3. transition from incorrect step", () => {
    const evaluation = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: baseState({
        currentStepId: "step-ready",
        status: WORKFLOW_STATUS.READY,
      }),
      request: request({ transitionId: "t-draft-to-ready" }),
      context: context(),
    });
    assert.equal(evaluation.ok, false);
    assert.equal(evaluation.code, WORKFLOW_ERROR_CODE.TRANSITION_NOT_ALLOWED);
    assert.match(evaluation.explanation.message, /current step/i);
  });

  it("4. transition not allowed from terminal status", () => {
    for (const status of [
      WORKFLOW_STATUS.COMPLETED,
      WORKFLOW_STATUS.FAILED,
      WORKFLOW_STATUS.CANCELLED,
    ]) {
      const evaluation = evaluateWorkflowTransition({
        definition: baseDefinition(),
        state: baseState({
          currentStepId: "step-completed",
          status,
        }),
        request: request({ transitionId: "t-running-to-completed" }),
        context: context(),
      });
      assert.equal(evaluation.ok, false);
      assert.ok(
        [
          WORKFLOW_ERROR_CODE.WORKFLOW_COMPLETED,
          WORKFLOW_ERROR_CODE.WORKFLOW_FAILED,
          WORKFLOW_ERROR_CODE.WORKFLOW_CANCELLED,
        ].includes(evaluation.code)
      );
    }
  });

  it("5. unauthorized transition", () => {
    const evaluation = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: baseState(),
      request: request(),
      context: context({
        authorization: auth({ allowed: false, reason: "DENIED_ROLE" }),
      }),
    });
    assert.equal(evaluation.ok, false);
    assert.equal(evaluation.code, WORKFLOW_ERROR_CODE.TRANSITION_UNAUTHORIZED);
    assert.equal(evaluation.explanation.authorizationReason, "DENIED_ROLE");
  });

  it("6. failed prerequisite", () => {
    const evaluation = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: baseState(),
      request: request(),
      context: context({
        prerequisites: [
          createTransitionPrerequisiteResult({
            satisfied: false,
            code: "DEP_NOT_READY",
            message: "Standings incomplete",
            dependencyRef: "core-18:standings",
          }),
        ],
      }),
    });
    assert.equal(evaluation.ok, false);
    assert.equal(
      evaluation.code,
      WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED
    );
    assert.deepEqual(evaluation.explanation.prerequisiteReasons, [
      "Standings incomplete",
    ]);
    assert.deepEqual(evaluation.explanation.dependencyReferences, [
      "core-18:standings",
    ]);
  });

  it("7. failed guard", () => {
    const evaluation = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: baseState(),
      request: request(),
      context: context({
        guards: [
          createTransitionGuardDecision({
            allowed: false,
            code: "GUARD_BLOCK",
            message: "Unresolved tie blocks completion",
            dependencyRef: "STANDINGS_UNRESOLVED_TIE",
          }),
        ],
      }),
    });
    assert.equal(evaluation.ok, false);
    assert.equal(evaluation.code, WORKFLOW_ERROR_CODE.GUARD_REJECTED);
    assert.deepEqual(evaluation.explanation.guardReasons, [
      "Unresolved tie blocks completion",
    ]);
  });

  it("8. paused workflow restriction", () => {
    const evaluation = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: baseState({
        currentStepId: "step-running",
        status: WORKFLOW_STATUS.PAUSED,
      }),
      request: request({
        transitionId: "t-running-advance",
        idempotencyKey: "idem-pause",
      }),
      context: context({ eventId: "evt-pause" }),
    });
    assert.equal(evaluation.ok, false);
    assert.equal(evaluation.code, WORKFLOW_ERROR_CODE.WORKFLOW_PAUSED);
  });

  it("9. duplicate idempotency request", () => {
    const evaluation = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: baseState(),
      request: request({ idempotencyKey: "idem-dup" }),
      context: context({ seenIdempotencyKeys: ["idem-dup"] }),
    });
    assert.equal(evaluation.ok, false);
    assert.equal(
      evaluation.code,
      WORKFLOW_ERROR_CODE.DUPLICATE_TRANSITION_REQUEST
    );
  });

  it("10. stable transition explanation", () => {
    const a = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: baseState(),
      request: request(),
      context: context(),
    });
    const b = evaluateWorkflowTransition({
      definition: baseDefinition(),
      state: baseState(),
      request: request(),
      context: context(),
    });
    assert.deepEqual(a.explanation, b.explanation);
    assert.equal(a.explanation.code, "TRANSITION_APPROVED");
  });

  it("11. stable event identity payload", () => {
    const applied = applyWorkflowTransition({
      definition: baseDefinition(),
      state: baseState(),
      request: request(),
      context: context({ eventId: "evt-identity" }),
    });
    assert.equal(applied.ok, true);
    assert.ok(applied.events.length >= 3);
    for (const event of applied.events) {
      assert.ok(event.eventId);
      assert.equal(event.occurredAt, OCCURRED_AT);
      assert.equal(event.workflowInstanceId, "wf-inst-1");
      assert.equal(event.definitionId, "wf-def-1");
      assert.equal(event.definitionVersion, "1.0.0");
      assert.equal(event.transitionId, "t-draft-to-ready");
      assert.equal(event.idempotencyKey, "idem-1");
      assert.equal(event.correlationId, "corr-1");
      assert.ok(event.payloadFingerprint);
      assert.equal(event.actorId, "actor-1");
      assert.equal(event.actorType, "SYSTEM");
    }
    const again = applyWorkflowTransition({
      definition: baseDefinition(),
      state: baseState(),
      request: request(),
      context: context({ eventId: "evt-identity" }),
    });
    assert.deepEqual(applied.events, again.events);
  });

  it("12. identical canonical inputs produce deeply equal results", () => {
    const input = {
      definition: baseDefinition(),
      state: baseState(),
      request: request(),
      context: context(),
    };
    const a = applyWorkflowTransition(input);
    const b = applyWorkflowTransition(input);
    assert.deepEqual(a, b);
  });

  it("13. object key ordering does not change fingerprint", () => {
    const fp1 = createWorkflowPayloadFingerprint({ b: 2, a: 1, nested: { z: 1, y: 2 } });
    const fp2 = createWorkflowPayloadFingerprint({ nested: { y: 2, z: 1 }, a: 1, b: 2 });
    assert.equal(fp1, fp2);
  });

  it("14-16. input definition/state/request/context are not mutated", () => {
    const definition = {
      definitionId: "wf-def-1",
      definitionVersion: "1.0.0",
      steps: [
        { stepId: "step-draft", status: WORKFLOW_STATUS.DRAFT },
        { stepId: "step-ready", status: WORKFLOW_STATUS.READY },
      ],
      transitions: [
        {
          transitionId: "t-draft-to-ready",
          fromStepId: "step-draft",
          toStepId: "step-ready",
          fromStatus: WORKFLOW_STATUS.DRAFT,
          toStatus: WORKFLOW_STATUS.READY,
        },
      ],
    };
    const state = {
      workflowInstanceId: "wf-inst-1",
      definitionId: "wf-def-1",
      definitionVersion: "1.0.0",
      currentStepId: "step-draft",
      status: WORKFLOW_STATUS.DRAFT,
      revision: 0,
    };
    const req = {
      transitionId: "t-draft-to-ready",
      idempotencyKey: "idem-immut",
      correlationId: "corr-immut",
      payload: { keep: true },
    };
    const ctx = {
      occurredAt: OCCURRED_AT,
      eventId: "evt-immut",
      authorization: { allowed: true, actorId: "actor-1", actorType: "USER" },
      prerequisites: [],
      guards: [],
      seenIdempotencyKeys: [],
      payload: { keepCtx: true },
    };
    const definitionSnap = JSON.stringify(definition);
    const stateSnap = JSON.stringify(state);
    const reqSnap = JSON.stringify(req);
    const ctxSnap = JSON.stringify(ctx);

    applyWorkflowTransition({
      definition,
      state,
      request: req,
      context: ctx,
    });

    assert.equal(JSON.stringify(definition), definitionSnap);
    assert.equal(JSON.stringify(state), stateSnap);
    assert.equal(JSON.stringify(req), reqSnap);
    assert.equal(JSON.stringify(ctx), ctxSnap);
  });

  it("17. successful application produces expected next state", () => {
    const result = applyWorkflowTransition({
      definition: baseDefinition(),
      state: baseState(),
      request: request(),
      context: context(),
    });
    assert.equal(result.ok, true);
    assert.equal(result.state.currentStepId, "step-ready");
    assert.equal(result.state.status, WORKFLOW_STATUS.READY);
    assert.equal(result.state.workflowInstanceId, "wf-inst-1");
    assert.equal(result.state.definitionId, "wf-def-1");
    assert.equal(result.state.definitionVersion, "1.0.0");
    assert.equal(result.state.revision, 1);
    assert.equal(result.idempotencyKey, "idem-1");
    assert.equal(result.correlationId, "corr-1");
  });

  it("18. completion transition produces COMPLETED status and completion event", () => {
    const result = applyWorkflowTransition({
      definition: baseDefinition(),
      state: baseState({
        currentStepId: "step-running",
        status: WORKFLOW_STATUS.RUNNING,
        revision: 3,
      }),
      request: request({
        transitionId: "t-running-to-completed",
        idempotencyKey: "idem-complete",
      }),
      context: context({ eventId: "evt-complete" }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.state.status, WORKFLOW_STATUS.COMPLETED);
    assert.equal(result.state.currentStepId, "step-completed");
    assert.ok(
      result.events.some(
        (e) => e.eventType === WORKFLOW_EVENT_TYPE.WORKFLOW_COMPLETED
      )
    );
    assert.ok(
      result.events.some(
        (e) => e.eventType === WORKFLOW_EVENT_TYPE.TRANSITION_COMPLETED
      )
    );
  });

  it("19. no direct import of legacy tournament workflow as SSOT", () => {
    const files = listJsFiles(WORKFLOW_ROOT);
    assert.ok(files.length > 0);
    const forbidden = [
      "team-tournament",
      "tournament-engine",
      "WORKFLOW_STAGE",
      "TOURNAMENT_STATUS",
      "forfeitWorkflowEngine",
      "teamTournamentWorkflow",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const token of forbidden) {
        if (token === "WORKFLOW_STAGE" || token === "TOURNAMENT_STATUS") {
          // Mentions in ownership comments are allowed; imports/usages as SSOT are not.
          const importLike = new RegExp(
            `from\\s+['\"][^'\"]*${token}[^'\"]*['\"]|require\\([^)]*${token}`
          );
          assert.equal(
            importLike.test(text),
            false,
            `${path.relative(ROOT, file)} must not import ${token}`
          );
          continue;
        }
        assert.equal(
          text.includes(token),
          false,
          `${path.relative(ROOT, file)} must not reference ${token}`
        );
      }
    }
  });

  it("20. no persistence, clock or random dependency inside kernel", () => {
    const files = listJsFiles(WORKFLOW_ROOT);
    const forbiddenPatterns = [
      /Date\.now\s*\(/,
      /new\s+Date\s*\(\s*\)/,
      /Math\.random\s*\(/,
      /randomUUID\s*\(/,
      /crypto\.random/,
      /supabase/i,
      /localStorage/,
      /indexedDB/,
      /fetch\s*\(/,
      /audit_logs/,
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        assert.equal(
          pattern.test(text),
          false,
          `${path.relative(ROOT, file)} matched forbidden pattern ${pattern}`
        );
      }
    }
  });
});

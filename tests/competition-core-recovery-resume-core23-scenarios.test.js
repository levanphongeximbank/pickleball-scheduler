/**
 * CORE-23 — table-driven recovery scenarios + failure injection (no timing flakes).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RECOVERY_MODE,
  RECOVERY_ELIGIBILITY,
  PARTIAL_OPERATION_STATUS,
  RECOVERY_OUTCOME_KIND,
  RECOVERY_ERROR_CODE,
  createRecoveryCheckpoint,
  createResumeToken,
  createResumeContext,
  createRecoveryEvidence,
  createIdempotencyReference,
  createDuplicatePreventionReference,
  createRecoverySubjectReference,
  createRecoveryOperationReference,
  evaluateRecovery,
} from "../src/features/competition-core/recovery-resume/index.js";

function subject(overrides = {}) {
  return createRecoverySubjectReference({
    subjectId: "subj-1",
    subjectType: "COMPETITION_OPERATION",
    subjectVersion: 5,
    competitionId: "comp-1",
    ...overrides,
  });
}

function operation(overrides = {}) {
  return createRecoveryOperationReference({
    operationId: "op-1",
    operationType: "GENERIC",
    ...overrides,
  });
}

function checkpoint(overrides = {}) {
  return createRecoveryCheckpoint({
    checkpointId: "cp-1",
    checkpointVersion: 1,
    createdAtEvidence: "evidence:1",
    subject: subject(),
    operation: operation(),
    expectedSubjectVersion: 5,
    completedStepIds: [],
    pendingStepIds: ["step-1"],
    completedEffectIds: [],
    pendingEffectIds: ["effect-1"],
    partialOperationStatus: PARTIAL_OPERATION_STATUS.NOT_STARTED,
    lastKnownSafeState: { stateKind: "SAFE", stateFingerprint: "s1" },
    idempotency: { idempotencyKey: "idem-1", payloadFingerprint: "p1" },
    duplicatePrevention: { duplicatePreventionKey: "dup-1" },
    dependencyEvidence: { core19: { version: "1.0.0" } },
    ...overrides,
  });
}

function baseRequest(overrides = {}) {
  return {
    requestedMode: RECOVERY_MODE.RESUME,
    subject: subject(),
    operation: operation(),
    checkpoint: checkpoint(),
    idempotency: createIdempotencyReference({
      idempotencyKey: "idem-1",
      payloadFingerprint: "p1",
    }),
    duplicatePrevention: createDuplicatePreventionReference({
      duplicatePreventionKey: "dup-1",
    }),
    context: createResumeContext({ currentSubjectVersion: 5 }),
    evidence: createRecoveryEvidence({}),
    ...overrides,
  };
}

describe("CORE-23 — recovery scenarios", () => {
  const scenarios = [
    {
      id: 1,
      title: "Workflow stopped before transition validation",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RETRY,
          operation: operation({ operationType: "WORKFLOW_TRANSITION" }),
          checkpoint: checkpoint({
            operation: operation({ operationType: "WORKFLOW_TRANSITION" }),
            completedStepIds: [],
            pendingStepIds: ["validate"],
            completedEffectIds: [],
            pendingEffectIds: [],
            partialOperationStatus: PARTIAL_OPERATION_STATUS.NOT_STARTED,
          }),
        }),
      expect: { kind: RECOVERY_OUTCOME_KIND.ALLOWED, mode: RECOVERY_MODE.RETRY },
    },
    {
      id: 2,
      title: "Workflow stopped after validation but before effects",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RESUME,
          checkpoint: checkpoint({
            completedStepIds: ["validate"],
            pendingStepIds: ["apply-effects"],
            completedEffectIds: [],
            pendingEffectIds: ["effect-a"],
            partialOperationStatus: PARTIAL_OPERATION_STATUS.VALIDATED_NO_EFFECTS,
          }),
        }),
      expect: { kind: RECOVERY_OUTCOME_KIND.ALLOWED, mode: RECOVERY_MODE.RESUME },
    },
    {
      id: 3,
      title: "Workflow stopped after some effects applied",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RESUME,
          checkpoint: checkpoint({
            completedStepIds: ["validate", "apply-effects"],
            pendingStepIds: ["finalize"],
            completedEffectIds: ["effect-a"],
            pendingEffectIds: ["effect-b"],
            partialOperationStatus:
              PARTIAL_OPERATION_STATUS.PARTIAL_EFFECTS_APPLIED,
          }),
        }),
      expect: { kind: RECOVERY_OUTCOME_KIND.ALLOWED, mode: RECOVERY_MODE.RESUME },
      assertExtra: (outcome) => {
        assert.ok(outcome.plan.skipCompletedEffectIds.includes("effect-a"));
        assert.ok(outcome.plan.pendingEffectIds.includes("effect-b"));
        assert.equal(
          outcome.plan.pendingEffectIds.includes("effect-a"),
          false
        );
      },
    },
    {
      id: 4,
      title: "Match lifecycle command submitted twice (duplicate noop)",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RETRY,
          operation: operation({ operationType: "MATCH_LIFECYCLE" }),
          checkpoint: checkpoint({
            operation: operation({ operationType: "MATCH_LIFECYCLE" }),
            completedEffectIds: ["transition-applied"],
            pendingEffectIds: [],
            pendingStepIds: [],
            partialOperationStatus: PARTIAL_OPERATION_STATUS.COMPLETED,
          }),
          evidence: createRecoveryEvidence({ completionMarkerPresent: true }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
        code: RECOVERY_ERROR_CODE.OPERATION_ALREADY_COMPLETED,
      },
    },
    {
      id: 5,
      title: "Score submission outcome unknown",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RESUME,
          evidence: createRecoveryEvidence({ outcomeKnown: false }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.MANUAL_INTERVENTION,
        eligibility: RECOVERY_ELIGIBILITY.MANUAL_REQUIRED,
      },
    },
    {
      id: 6,
      title: "Schedule generation interrupted",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RESUME,
          operation: operation({ operationType: "SCHEDULE_GENERATION" }),
          checkpoint: checkpoint({
            operation: operation({ operationType: "SCHEDULE_GENERATION" }),
            completedStepIds: ["normalize-input"],
            pendingStepIds: ["place-matches"],
            completedEffectIds: [],
            pendingEffectIds: ["schedule-write"],
            partialOperationStatus: PARTIAL_OPERATION_STATUS.VALIDATED_NO_EFFECTS,
          }),
        }),
      expect: { kind: RECOVERY_OUTCOME_KIND.ALLOWED, mode: RECOVERY_MODE.RESUME },
    },
    {
      id: 7,
      title: "Court assignment interrupted",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RESUME,
          operation: operation({ operationType: "COURT_ASSIGNMENT" }),
          checkpoint: checkpoint({
            operation: operation({ operationType: "COURT_ASSIGNMENT" }),
            completedEffectIds: ["assign-court-1"],
            pendingEffectIds: ["assign-court-2"],
            partialOperationStatus:
              PARTIAL_OPERATION_STATUS.PARTIAL_EFFECTS_APPLIED,
          }),
        }),
      expect: { kind: RECOVERY_OUTCOME_KIND.ALLOWED, mode: RECOVERY_MODE.RESUME },
    },
    {
      id: 8,
      title: "Referee assignment interrupted",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RESUME,
          operation: operation({ operationType: "REFEREE_ASSIGNMENT" }),
          checkpoint: checkpoint({
            operation: operation({ operationType: "REFEREE_ASSIGNMENT" }),
            completedEffectIds: [],
            pendingEffectIds: ["assign-ref"],
            partialOperationStatus: PARTIAL_OPERATION_STATUS.NOT_STARTED,
          }),
        }),
      expect: { kind: RECOVERY_OUTCOME_KIND.ALLOWED, mode: RECOVERY_MODE.RESUME },
    },
    {
      id: 9,
      title: "Seed evidence without completion evidence",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RESUME,
          evidence: createRecoveryEvidence({
            seedEvidence: { seedIdentity: "seed-1" },
            completionMarkerPresent: false,
          }),
          checkpoint: checkpoint({
            partialOperationStatus: PARTIAL_OPERATION_STATUS.VALIDATED_NO_EFFECTS,
            completedStepIds: ["seed"],
            pendingStepIds: ["execute"],
            completedEffectIds: [],
            pendingEffectIds: ["run"],
          }),
        }),
      expect: { kind: RECOVERY_OUTCOME_KIND.ALLOWED, mode: RECOVERY_MODE.RESUME },
    },
    {
      id: 10,
      title: "Event history incomplete",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RESUME,
          evidence: createRecoveryEvidence({ eventHistoryComplete: false }),
        }),
      expect: { kind: RECOVERY_OUTCOME_KIND.MANUAL_INTERVENTION },
    },
    {
      id: 11,
      title: "Checkpoint outdated subject version",
      request: () =>
        baseRequest({
          context: createResumeContext({ currentSubjectVersion: 9 }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
        code: RECOVERY_ERROR_CODE.CHECKPOINT_STALE,
      },
    },
    {
      id: 12,
      title: "Checkpoint integrity cannot be verified",
      request: () =>
        baseRequest({
          checkpoint: checkpoint({
            integrityFingerprint:
              "CORE23_CHECKPOINT_FINGERPRINT_FNV1A32_V1:00000000",
          }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
        code: RECOVERY_ERROR_CODE.CHECKPOINT_INTEGRITY_FAILED,
      },
    },
    {
      id: 13,
      title: "Import restoration completed only partially",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RESUME,
          operation: operation({ operationType: "IMPORT_RESTORE" }),
          checkpoint: checkpoint({
            operation: operation({ operationType: "IMPORT_RESTORE" }),
            completedEffectIds: ["module-a"],
            pendingEffectIds: ["module-b"],
            partialOperationStatus:
              PARTIAL_OPERATION_STATUS.PARTIAL_EFFECTS_APPLIED,
          }),
          evidence: createRecoveryEvidence({ importRestorePartial: true }),
        }),
      expect: { kind: RECOVERY_OUTCOME_KIND.ALLOWED, mode: RECOVERY_MODE.RESUME },
    },
    {
      id: 14,
      title: "Resume token reused",
      request: () =>
        baseRequest({
          resumeToken: createResumeToken({
            tokenId: "tok-used",
            checkpointId: "cp-1",
            subject: subject(),
            operation: operation(),
          }),
          context: createResumeContext({
            currentSubjectVersion: 5,
            seenResumeTokenIds: ["tok-used"],
          }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
        code: RECOVERY_ERROR_CODE.RESUME_TOKEN_REUSED,
      },
    },
    {
      id: 15,
      title: "Recovery request repeated (idempotent noop)",
      request: () =>
        baseRequest({
          context: createResumeContext({
            currentSubjectVersion: 5,
            seenDuplicatePreventionKeys: ["dup-1"],
            priorRecoveryOutcomeFingerprints: {
              "dup-1": "prior-outcome-fp-1",
            },
          }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.DUPLICATE_NOOP,
        eligibility: RECOVERY_ELIGIBILITY.DUPLICATE_NOOP,
      },
    },
    {
      id: 16,
      title: "Dependency state changed after checkpoint",
      request: () =>
        baseRequest({
          context: createResumeContext({
            currentSubjectVersion: 5,
            currentDependencyEvidence: {
              core19: { version: "2.0.0" },
            },
          }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
        code: RECOVERY_ERROR_CODE.DEPENDENCY_STATE_CHANGED,
      },
    },
    {
      id: 17,
      title: "Rollback without compensation contract",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.ROLLBACK,
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.UNSUPPORTED,
        code: RECOVERY_ERROR_CODE.ROLLBACK_UNSUPPORTED,
      },
    },
    {
      id: 18,
      title: "Manual operator approval required",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.MANUAL_RECOVERY,
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.MANUAL_INTERVENTION,
        eligibility: RECOVERY_ELIGIBILITY.MANUAL_REQUIRED,
      },
    },
    {
      id: 19,
      title: "Recovery succeeds through valid checkpoint",
      request: () => baseRequest(),
      expect: { kind: RECOVERY_OUTCOME_KIND.ALLOWED, mode: RECOVERY_MODE.RESUME },
    },
    {
      id: 20,
      title: "Repeated successful recovery produces no duplicate effects",
      request: () =>
        baseRequest({
          context: createResumeContext({
            currentSubjectVersion: 5,
            seenDuplicatePreventionKeys: ["dup-1"],
            priorRecoveryOutcomeFingerprints: {
              "dup-1": "fp-success-1",
            },
          }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.DUPLICATE_NOOP,
      },
      assertExtra: (outcome) => {
        assert.equal(outcome.wouldApplyEffects, false);
        assert.equal(outcome.duplicateEffectsPrevented, true);
      },
    },
    {
      id: 21,
      title: "Recovery references different subject",
      request: () =>
        baseRequest({
          subject: subject({ subjectId: "subj-OTHER" }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
        code: RECOVERY_ERROR_CODE.SUBJECT_MISMATCH,
      },
    },
    {
      id: 22,
      title: "Recovery references different operation",
      request: () =>
        baseRequest({
          operation: operation({ operationId: "op-OTHER" }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
        code: RECOVERY_ERROR_CODE.OPERATION_MISMATCH,
      },
    },
    {
      id: 23,
      title: "Completed operation incorrectly requested for retry",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.RETRY,
          checkpoint: checkpoint({
            completedEffectIds: ["done"],
            pendingEffectIds: [],
            pendingStepIds: [],
            partialOperationStatus: PARTIAL_OPERATION_STATUS.COMPLETED,
          }),
          evidence: createRecoveryEvidence({ completionMarkerPresent: true }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
        code: RECOVERY_ERROR_CODE.OPERATION_ALREADY_COMPLETED,
      },
    },
    {
      id: 24,
      title: "Replay without canonical replay evidence",
      request: () =>
        baseRequest({
          requestedMode: RECOVERY_MODE.REPLAY,
          evidence: createRecoveryEvidence({}),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
        code: RECOVERY_ERROR_CODE.REPLAY_EVIDENCE_MISSING,
      },
    },
    {
      id: 25,
      title: "Concurrent recovery attempts share duplicate-prevention key",
      request: () =>
        baseRequest({
          context: createResumeContext({
            currentSubjectVersion: 5,
            seenDuplicatePreventionKeys: ["dup-1"],
            // no prior fingerprint → conflict
          }),
        }),
      expect: {
        kind: RECOVERY_OUTCOME_KIND.REJECTED,
        code: RECOVERY_ERROR_CODE.DUPLICATE_RECOVERY_CONFLICT,
      },
    },
  ];

  for (const scenario of scenarios) {
    it(`${String(scenario.id).padStart(2, "0")}. ${scenario.title}`, () => {
      const outcome = evaluateRecovery(scenario.request());
      assert.equal(outcome.kind, scenario.expect.kind, scenario.title);
      if (scenario.expect.mode) {
        assert.equal(outcome.mode, scenario.expect.mode, scenario.title);
      }
      if (scenario.expect.eligibility) {
        assert.equal(
          outcome.eligibility,
          scenario.expect.eligibility,
          scenario.title
        );
      }
      if (scenario.expect.code) {
        assert.equal(outcome.failure?.code, scenario.expect.code, scenario.title);
      }
      if (scenario.assertExtra) scenario.assertExtra(outcome);
      assert.ok(outcome.explanation?.message, "explanation required");
    });
  }

  it("26. retry is not resume — partial effects reject retry", () => {
    const outcome = evaluateRecovery(
      baseRequest({
        requestedMode: RECOVERY_MODE.RETRY,
        checkpoint: checkpoint({
          completedEffectIds: ["e1"],
          pendingEffectIds: ["e2"],
          partialOperationStatus:
            PARTIAL_OPERATION_STATUS.PARTIAL_EFFECTS_APPLIED,
        }),
      })
    );
    assert.equal(outcome.kind, RECOVERY_OUTCOME_KIND.REJECTED);
    assert.equal(outcome.failure.code, RECOVERY_ERROR_CODE.RETRY_UNSAFE);
  });

  it("27. resume is not replay — replay mode uses replay evidence path", () => {
    const resume = evaluateRecovery(baseRequest());
    const replay = evaluateRecovery(
      baseRequest({
        requestedMode: RECOVERY_MODE.REPLAY,
        evidence: createRecoveryEvidence({
          replayEvidence: { ok: true, seedIdentity: "s1" },
          eventHistoryComplete: true,
        }),
      })
    );
    assert.equal(resume.mode, RECOVERY_MODE.RESUME);
    assert.equal(replay.mode, RECOVERY_MODE.REPLAY);
    assert.notEqual(resume.mode, replay.mode);
  });

  it("28. replay is not rollback", () => {
    const replay = evaluateRecovery(
      baseRequest({
        requestedMode: RECOVERY_MODE.REPLAY,
        evidence: createRecoveryEvidence({
          seedEvidence: { seedIdentity: "s1" },
          eventHistoryComplete: true,
        }),
      })
    );
    const rollback = evaluateRecovery(
      baseRequest({ requestedMode: RECOVERY_MODE.ROLLBACK })
    );
    assert.equal(replay.kind, RECOVERY_OUTCOME_KIND.ALLOWED);
    assert.equal(rollback.kind, RECOVERY_OUTCOME_KIND.UNSUPPORTED);
  });

  it("29. idempotent resume-token re-evaluation allowed when flagged", () => {
    const outcome = evaluateRecovery(
      baseRequest({
        resumeToken: createResumeToken({
          tokenId: "tok-idem",
          checkpointId: "cp-1",
          subject: subject(),
          operation: operation(),
          idempotentRepeatEvaluation: true,
        }),
        context: createResumeContext({
          currentSubjectVersion: 5,
          seenResumeTokenIds: ["tok-idem"],
        }),
      })
    );
    assert.equal(outcome.kind, RECOVERY_OUTCOME_KIND.ALLOWED);
  });

  it("30. failure injection: missing idempotency rejects", () => {
    const cp = createRecoveryCheckpoint({
      checkpointId: "cp-no-idem",
      createdAtEvidence: "e1",
      subject: subject(),
      operation: operation(),
      expectedSubjectVersion: 5,
      completedStepIds: [],
      pendingStepIds: ["s1"],
      completedEffectIds: [],
      pendingEffectIds: ["e1"],
      partialOperationStatus: PARTIAL_OPERATION_STATUS.NOT_STARTED,
      lastKnownSafeState: { stateKind: "SAFE" },
      dependencyEvidence: {},
    });
    const outcome = evaluateRecovery({
      requestedMode: RECOVERY_MODE.RESUME,
      subject: subject(),
      operation: operation(),
      checkpoint: cp,
      context: createResumeContext({ currentSubjectVersion: 5 }),
      evidence: createRecoveryEvidence({}),
    });
    assert.equal(outcome.kind, RECOVERY_OUTCOME_KIND.REJECTED);
    assert.equal(outcome.failure.code, RECOVERY_ERROR_CODE.IDEMPOTENCY_INVALID);
  });
});

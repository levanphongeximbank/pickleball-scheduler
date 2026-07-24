/**
 * CORE-23 — cross-CORE public-contract integration (by reference, no dep edits).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RECOVERY_MODE,
  RECOVERY_OUTCOME_KIND,
  PARTIAL_OPERATION_STATUS,
  createRecoveryCheckpoint,
  createResumeContext,
  createRecoveryEvidence,
  createIdempotencyReference,
  createRecoverySubjectReference,
  createRecoveryOperationReference,
  evaluateRecovery,
  adaptCore15MatchEvidence,
  adaptCore19WorkflowEvidence,
  adaptCore20AuditEvidence,
  adaptCore21ReplayEvidence,
  adaptCore22ImportRestoreEvidence,
} from "../src/features/competition-core/recovery-resume/index.js";

import {
  WORKFLOW_STATUS,
  WORKFLOW_EFFECT_STATUS,
} from "../src/features/competition-core/workflow/index.js";

import {
  CORE20_ENGINE_ID,
  CORE20_ENGINE_VERSION,
} from "../src/features/competition-core/audit/index.js";

import {
  CORE21_ENGINE_ID,
  createReplayInput,
} from "../src/features/competition-core/deterministic-seed-replay/index.js";

import {
  CORE22_ENGINE_ID,
  createImportPlan,
  detectStaleImportPlan,
} from "../src/features/competition-core/import-export/index.js";

import {
  MATCH_ACTION,
  MATCH_TRANSITION_MATRIX,
} from "../src/features/competition-core/matches/index.js";

describe("CORE-23 — cross-CORE public contract integration", () => {
  it("01. CORE-15 public surface available for evidence adapter", () => {
    const evidence = adaptCore15MatchEvidence();
    assert.equal(evidence.hasTransitionMatrix, true);
    assert.ok(MATCH_TRANSITION_MATRIX.length > 0);
    assert.equal(evidence.sampleAction, MATCH_ACTION.START);
  });

  it("02. CORE-19 workflow statuses referenced without owning rules", () => {
    const evidence = adaptCore19WorkflowEvidence({
      workflowStatus: WORKFLOW_STATUS.PAUSED,
      effectStatus: WORKFLOW_EFFECT_STATUS.PENDING,
    });
    assert.equal(evidence.workflowStatus, WORKFLOW_STATUS.PAUSED);
    assert.ok(evidence.knownStatuses.includes(WORKFLOW_STATUS.RUNNING));
  });

  it("03. CORE-20 audit identifiers referenced", () => {
    const evidence = adaptCore20AuditEvidence({
      eventId: "aud-evt-1",
      streamComplete: true,
    });
    assert.equal(evidence.engineId, CORE20_ENGINE_ID);
    assert.equal(evidence.engineVersion, CORE20_ENGINE_VERSION);
  });

  it("04. CORE-21 replay evidence adapted from public contracts", () => {
    const replayInput = createReplayInput({
      seedIdentity: "seed-core23",
      normalizedInputFingerprint: "in-fp-1",
      algorithmVersion: "algo-v1",
      ruleSetId: "rules-1",
      ruleSetVersion: "1.0.0",
      expectedOutputFingerprint: "out-fp-1",
    });
    const adapted = adaptCore21ReplayEvidence({
      replayInput,
      createEvidence: true,
      ok: true,
    });
    assert.equal(adapted.engineId, CORE21_ENGINE_ID);
    assert.ok(adapted.replayEvidence);
    assert.equal(adapted.replayEvidence.ok, true);

    const outcome = evaluateRecovery({
      requestedMode: RECOVERY_MODE.REPLAY,
      subject: createRecoverySubjectReference({
        subjectId: "s1",
        subjectType: "DRAW",
        subjectVersion: 1,
      }),
      operation: createRecoveryOperationReference({
        operationId: "op-replay",
        operationType: "DETERMINISTIC_DRAW",
      }),
      evidence: createRecoveryEvidence({
        replayEvidence: adapted.replayEvidence,
        seedEvidence: adapted.seedEvidence,
        eventHistoryComplete: true,
      }),
      context: createResumeContext({}),
    });
    assert.equal(outcome.kind, RECOVERY_OUTCOME_KIND.ALLOWED);
    assert.equal(outcome.mode, RECOVERY_MODE.REPLAY);
  });

  it("05. CORE-22 import plan handoff + stale detection consumed", () => {
    const plan = createImportPlan({
      packageFingerprint: "pkg-fp-1",
      targetRevisionFingerprint: "tgt-fp-1",
      selectedModulesFingerprint: "sel-fp-1",
      mappingPlanFingerprint: "map-fp-1",
      conflictReportFingerprint: "cnf-fp-1",
      applyEligible: true,
      idempotencyReference: "import-idem-1",
    });
    assert.equal(plan.recoveryExecutable, false);
    assert.equal(plan.resumeToken, null);

    const adapted = adaptCore22ImportRestoreEvidence({
      importPlan: plan,
      current: {
        packageFingerprint: "pkg-fp-1",
        targetRevisionFingerprint: "tgt-fp-CHANGED",
        selectedModulesFingerprint: "sel-fp-1",
      },
      importRestorePartial: true,
    });
    assert.equal(adapted.engineId, CORE22_ENGINE_ID);
    assert.equal(adapted.stale.stale, true);

    const fresh = detectStaleImportPlan(plan, {
      packageFingerprint: "pkg-fp-1",
      targetRevisionFingerprint: "tgt-fp-1",
      selectedModulesFingerprint: "sel-fp-1",
    });
    assert.equal(fresh.stale, false);

    const outcome = evaluateRecovery({
      requestedMode: RECOVERY_MODE.RESUME,
      subject: createRecoverySubjectReference({
        subjectId: "import-subj",
        subjectType: "IMPORT_PLAN",
        subjectVersion: 1,
      }),
      operation: createRecoveryOperationReference({
        operationId: "import-op",
        operationType: "IMPORT_RESTORE",
      }),
      checkpoint: createRecoveryCheckpoint({
        checkpointId: "cp-import",
        createdAtEvidence: "import-plan",
        subject: {
          subjectId: "import-subj",
          subjectType: "IMPORT_PLAN",
          subjectVersion: 1,
        },
        operation: {
          operationId: "import-op",
          operationType: "IMPORT_RESTORE",
        },
        expectedSubjectVersion: 1,
        completedStepIds: ["dry-run"],
        pendingStepIds: ["apply"],
        completedEffectIds: ["module-a"],
        pendingEffectIds: ["module-b"],
        partialOperationStatus:
          PARTIAL_OPERATION_STATUS.PARTIAL_EFFECTS_APPLIED,
        lastKnownSafeState: { stateKind: "IMPORT", stateFingerprint: "i1" },
        idempotency: { idempotencyKey: "import-idem-1" },
        dependencyEvidence: {
          core22: { version: "1.0.0", importPlanFingerprint: plan.importPlanFingerprint },
        },
      }),
      idempotency: createIdempotencyReference({
        idempotencyKey: "import-idem-1",
      }),
      context: createResumeContext({
        currentSubjectVersion: 1,
        currentDependencyEvidence: {
          core22: { version: "1.0.0", importPlanFingerprint: plan.importPlanFingerprint },
        },
      }),
      evidence: createRecoveryEvidence({
        importRestorePartial: true,
        importPlanReference: plan,
      }),
    });
    assert.equal(outcome.kind, RECOVERY_OUTCOME_KIND.ALLOWED);
    assert.equal(outcome.mode, RECOVERY_MODE.RESUME);
  });

  it("06. dependency adapters fail closed on bad evidence", () => {
    assert.throws(() =>
      adaptCore19WorkflowEvidence({ workflowStatus: "NOT_A_STATUS" })
    );
    assert.throws(() => adaptCore21ReplayEvidence({}));
    assert.throws(() =>
      adaptCore20AuditEvidence({ requireEventId: true })
    );
  });
});

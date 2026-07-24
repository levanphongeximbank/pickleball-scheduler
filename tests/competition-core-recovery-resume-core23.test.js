/**
 * CORE-23 Competition Recovery & Resume — contract + invariant certification tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CORE23_ENGINE_ID,
  CORE23_ENGINE_VERSION,
  RECOVERY_CHECKPOINT_SCHEMA_VERSION,
  RECOVERY_MODE,
  RECOVERY_ELIGIBILITY,
  PARTIAL_OPERATION_STATUS,
  RECOVERY_OUTCOME_KIND,
  RECOVERY_ERROR_CODE,
  RECOVERY_ERROR_CODE_VALUES,
  RecoveryError,
  isRecoveryError,
  isRecoveryErrorCode,
  createRecoveryCheckpoint,
  computeCheckpointIntegrityFingerprint,
  createResumeToken,
  createResumeContext,
  createRecoveryRequest,
  createRecoveryEvidence,
  createIdempotencyReference,
  createDuplicatePreventionReference,
  createRecoverySubjectReference,
  createRecoveryOperationReference,
  evaluateRecovery,
  validateRecoveryCheckpoint,
  classifyPartialOperation,
  fingerprintValue,
} from "../src/features/competition-core/recovery-resume/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(
  ROOT,
  "src/features/competition-core/recovery-resume"
);

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

function sampleSubject(overrides = {}) {
  return createRecoverySubjectReference({
    subjectId: "subj-1",
    subjectType: "WORKFLOW",
    subjectVersion: 3,
    competitionId: "comp-1",
    ...overrides,
  });
}

function sampleOperation(overrides = {}) {
  return createRecoveryOperationReference({
    operationId: "op-1",
    operationType: "WORKFLOW_TRANSITION",
    attemptNumber: 1,
    correlationId: "corr-1",
    ...overrides,
  });
}

function sampleCheckpoint(overrides = {}) {
  return createRecoveryCheckpoint({
    checkpointId: "cp-1",
    checkpointVersion: 1,
    createdAtEvidence: "evt:created:1",
    subject: sampleSubject(),
    operation: sampleOperation(),
    expectedSubjectVersion: 3,
    completedStepIds: ["validate"],
    pendingStepIds: ["apply-effects"],
    completedEffectIds: [],
    pendingEffectIds: ["effect-a"],
    partialOperationStatus: PARTIAL_OPERATION_STATUS.VALIDATED_NO_EFFECTS,
    lastKnownSafeState: {
      stateKind: "WORKFLOW",
      stateVersion: 3,
      stateFingerprint: "safe-fp-1",
      marker: "AFTER_VALIDATION",
    },
    idempotency: { idempotencyKey: "idem-1", payloadFingerprint: "pay-1" },
    duplicatePrevention: { duplicatePreventionKey: "dup-1" },
    dependencyEvidence: {
      workflow: { version: "1.0.0" },
    },
    ...overrides,
  });
}

describe("CORE-23 — Recovery & Resume contracts", () => {
  it("01. public barrel exports canonical surface", async () => {
    const mod = await import(
      "../src/features/competition-core/recovery-resume/index.js"
    );
    assert.equal(mod.CORE23_ENGINE_ID, CORE23_ENGINE_ID);
    assert.equal(mod.CORE23_ENGINE_VERSION, CORE23_ENGINE_VERSION);
    assert.equal(typeof mod.evaluateRecovery, "function");
    assert.equal(typeof mod.createRecoveryCheckpoint, "function");
    assert.ok(mod.RECOVERY_MODE.RESUME);
    assert.ok(mod.RECOVERY_ERROR_CODE.CHECKPOINT_MISSING);
  });

  it("02. root competition-core re-exports CORE-23 surface", () => {
    const rootIndex = path.join(
      ROOT,
      "src/features/competition-core/index.js"
    );
    const src = readFileSync(rootIndex, "utf8");
    assert.match(src, /CORE-23 Competition Recovery & Resume/);
    assert.match(src, /from ["']\.\/recovery-resume\/index\.js["']/);
    assert.match(src, /CORE23_ENGINE_ID/);
    assert.match(src, /evaluateRecovery/);
  });

  it("03. recovery error codes are exhaustive and typed", () => {
    assert.ok(RECOVERY_ERROR_CODE_VALUES.size >= 20);
    for (const code of RECOVERY_ERROR_CODE_VALUES) {
      assert.equal(isRecoveryErrorCode(code), true);
    }
    const err = new RecoveryError(
      RECOVERY_ERROR_CODE.CHECKPOINT_MISSING,
      "missing"
    );
    assert.equal(isRecoveryError(err), true);
    assert.equal(err.code, RECOVERY_ERROR_CODE.CHECKPOINT_MISSING);
  });

  it("04. checkpoint construction + integrity fingerprint", () => {
    const cp = sampleCheckpoint();
    assert.equal(cp.schemaVersion, RECOVERY_CHECKPOINT_SCHEMA_VERSION);
    assert.equal(
      cp.integrityFingerprint,
      computeCheckpointIntegrityFingerprint(cp)
    );
    const a = sampleCheckpoint({ checkpointId: "cp-a" });
    const b = sampleCheckpoint({ checkpointId: "cp-a" });
    assert.equal(a.integrityFingerprint, b.integrityFingerprint);
  });

  it("05. reject in-memory / UI evidence at construction", () => {
    assert.throws(
      () =>
        sampleCheckpoint({ evidenceSource: "IN_MEMORY" }),
      (err) =>
        err instanceof RecoveryError &&
        err.code === RECOVERY_ERROR_CODE.IN_MEMORY_EVIDENCE_REJECTED
    );
    assert.throws(
      () => createRecoveryEvidence({ evidenceKind: "UI" }),
      (err) => err.code === RECOVERY_ERROR_CODE.IN_MEMORY_EVIDENCE_REJECTED
    );
  });

  it("06. corrupt integrity fails closed", () => {
    const cp = sampleCheckpoint({
      integrityFingerprint: "CORE23_CHECKPOINT_FINGERPRINT_FNV1A32_V1:deadbeef",
    });
    const result = validateRecoveryCheckpoint(cp, {
      expectedSubject: sampleSubject(),
      expectedOperation: sampleOperation(),
    });
    assert.equal(result.valid, false);
    assert.equal(result.code, RECOVERY_ERROR_CODE.CHECKPOINT_INTEGRITY_FAILED);
  });

  it("07. missing checkpoint fails closed", () => {
    const result = validateRecoveryCheckpoint(null);
    assert.equal(result.valid, false);
    assert.equal(result.code, RECOVERY_ERROR_CODE.CHECKPOINT_MISSING);
  });

  it("08. resume token single-use vs idempotent repeat", () => {
    const token = createResumeToken({
      tokenId: "tok-1",
      checkpointId: "cp-1",
      checkpointVersion: 1,
      subject: sampleSubject(),
      operation: sampleOperation(),
    });
    assert.equal(token.reusable, false);
    assert.equal(token.idempotentRepeatEvaluation, false);

    const reusable = createResumeToken({
      tokenId: "tok-2",
      checkpointId: "cp-1",
      subject: sampleSubject(),
      operation: sampleOperation(),
      idempotentRepeatEvaluation: true,
    });
    assert.equal(reusable.reusable, true);
  });

  it("09. deterministic fingerprint for same evidence", () => {
    assert.equal(fingerprintValue({ a: 1, b: 2 }), fingerprintValue({ b: 2, a: 1 }));
  });

  it("10. classify partial operation table", () => {
    const cases = [
      {
        name: "not started",
        checkpoint: sampleCheckpoint({
          completedStepIds: [],
          pendingStepIds: ["step-1"],
          completedEffectIds: [],
          pendingEffectIds: ["e1"],
          partialOperationStatus: PARTIAL_OPERATION_STATUS.NOT_STARTED,
        }),
        evidence: {},
        expected: PARTIAL_OPERATION_STATUS.NOT_STARTED,
      },
      {
        name: "validated no effects",
        checkpoint: sampleCheckpoint(),
        evidence: {},
        expected: PARTIAL_OPERATION_STATUS.VALIDATED_NO_EFFECTS,
      },
      {
        name: "partial effects",
        checkpoint: sampleCheckpoint({
          completedEffectIds: ["e1"],
          pendingEffectIds: ["e2"],
          partialOperationStatus: PARTIAL_OPERATION_STATUS.PARTIAL_EFFECTS_APPLIED,
        }),
        evidence: {},
        expected: PARTIAL_OPERATION_STATUS.PARTIAL_EFFECTS_APPLIED,
      },
      {
        name: "outcome unknown",
        checkpoint: sampleCheckpoint(),
        evidence: { outcomeKnown: false },
        expected: PARTIAL_OPERATION_STATUS.OUTCOME_UNKNOWN,
      },
      {
        name: "incomplete event history",
        checkpoint: sampleCheckpoint(),
        evidence: { eventHistoryComplete: false },
        expected: PARTIAL_OPERATION_STATUS.AMBIGUOUS,
      },
    ];

    for (const c of cases) {
      const assessment = classifyPartialOperation({
        checkpoint: c.checkpoint,
        evidence: c.evidence,
      });
      assert.equal(assessment.status, c.expected, c.name);
    }
  });

  it("11. successful safe resume", () => {
    const outcome = evaluateRecovery({
      requestedMode: RECOVERY_MODE.RESUME,
      subject: sampleSubject(),
      operation: sampleOperation(),
      checkpoint: sampleCheckpoint(),
      idempotency: createIdempotencyReference({
        idempotencyKey: "idem-1",
        payloadFingerprint: "pay-1",
      }),
      context: createResumeContext({ currentSubjectVersion: 3 }),
      evidence: createRecoveryEvidence({}),
    });
    assert.equal(outcome.kind, RECOVERY_OUTCOME_KIND.ALLOWED);
    assert.equal(outcome.mode, RECOVERY_MODE.RESUME);
    assert.equal(outcome.eligibility, RECOVERY_ELIGIBILITY.ELIGIBLE);
    assert.equal(outcome.duplicateEffectsPrevented, true);
    assert.ok(outcome.plan);
    assert.ok(
      outcome.plan.skipCompletedEffectIds.every(
        (id) => !outcome.plan.pendingEffectIds.includes(id)
      )
    );
  });

  it("12. module does not import dependency-private paths", () => {
    const files = listJsFiles(MODULE_ROOT);
    assert.ok(files.length > 0);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const importLines = src
        .split(/\r?\n/)
        .filter((line) => /^\s*import\s/.test(line) || /^\s*export\s+.+\sfrom\s/.test(line));
      const joined = importLines.join("\n");
      assert.equal(
        /workflow\/services\//.test(joined),
        false,
        file
      );
      assert.equal(
        /audit\/integrity\//.test(joined),
        false,
        file
      );
      assert.equal(/@supabase\//.test(joined), false, file);
      assert.equal(/createClient\(/.test(joined), false, file);
    }
  });

  it("13. request construction requires mode", () => {
    assert.throws(
      () =>
        createRecoveryRequest({
          subject: sampleSubject(),
          operation: sampleOperation(),
        }),
      (err) => err.code === RECOVERY_ERROR_CODE.MODE_NOT_PERMITTED
    );
  });

  it("14. duplicate prevention reference construction", () => {
    const dup = createDuplicatePreventionReference({
      duplicatePreventionKey: "dup-x",
      priorOutcomeFingerprint: "fp-prior",
    });
    assert.equal(dup.duplicatePreventionKey, "dup-x");
  });
});

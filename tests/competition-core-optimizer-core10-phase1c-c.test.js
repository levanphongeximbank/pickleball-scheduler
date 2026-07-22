/**
 * CORE-10 Phase 1C-C — CandidateEvaluationResult fingerprint certification.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import * as OptimizerPublic from "../src/features/competition-core/optimizer/index.js";

import {
  OPTIMIZATION_OPERATION,
  CONSTRAINT_KIND,
  OBJECTIVE_SENSE,
  CANDIDATE_EVALUATION_STATUS,
  CANDIDATE_EVALUATION_FAILURE_CODE,
  CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION,
  CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION,
  CORE10_ENGINE_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION,
  OptimizerContractError,
  createHardViolation,
  createCandidateEvaluationFailure,
  createCandidateEvaluationResult,
  composeCandidateOptimizationScore,
  createCandidateEvaluationResultFingerprint,
  fingerprintValue,
  serializeCanonical,
} from "../src/features/competition-core/optimizer/index.js";

import { CANDIDATE_EVALUATION_FAILURE_STAGE } from "../src/features/competition-core/optimizer/contracts/candidateEvaluationFailure.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const FP_FILE = path.join(
  OPT_ROOT,
  "evaluation",
  "candidateEvaluationResultFingerprint.js"
);
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");

const FP_INPUT =
  CANDIDATE_EVALUATION_FAILURE_CODE
    .INVALID_CANDIDATE_EVALUATION_RESULT_FINGERPRINT_INPUT;

/**
 * @param {() => unknown} fn
 * @param {string} code
 */
function assertThrowsCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof OptimizerContractError);
    assert.equal(err.code, code);
    return true;
  });
}

function portDesc(overrides = {}) {
  return {
    portId: "CORE10_NOOP_CONSTRAINT_PORT",
    portVersion: CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
    ...overrides,
  };
}

function baseViolation(overrides = {}) {
  return {
    violationCode: "HV_TEST",
    constraintId: "c-1",
    sourceModule: "CORE10_TEST",
    sourceVersion: "1",
    severity: CONSTRAINT_KIND.HARD,
    affectedIds: ["id-b", "id-a"],
    magnitude: 1,
    messageCode: "MSG_TEST",
    detailsCodes: ["D_B", "D_A"],
    ...overrides,
  };
}

function baseObjectiveRecord(overrides = {}) {
  return {
    objectiveId: "OBJ_A",
    objectiveVersion: "1",
    evaluatorRef: "eval-a",
    direction: OBJECTIVE_SENSE.MINIMIZE,
    executionIndex: 0,
    rawValue: 3,
    normalizedValue: 3,
    quantizedValue: 3,
    weightedValue: 3,
    orientedValue: 3,
    noteCodes: [],
    ...overrides,
  };
}

function inputFailure(overrides = {}) {
  return createCandidateEvaluationFailure({
    code: CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT,
    messageCode: "INVALID_CANDIDATE_INPUT",
    stage: CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
    candidateId: "cand-1",
    ...overrides,
  });
}

function evalFailure(overrides = {}) {
  return createCandidateEvaluationFailure({
    code: CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_EXCEPTION,
    messageCode: "CONSTRAINT_PORT_EXCEPTION",
    stage: CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
    candidateId: "cand-1",
    portDescriptor: portDesc(),
    ...overrides,
  });
}

function makeFeasible(overrides = {}) {
  const {
    objectiveRecordOverrides,
    authorityValues,
    objectiveEvaluations: objectiveEvaluationsOverride,
    optimizationScore: optimizationScoreOverride,
    ...resultOverrides
  } = overrides;
  const record = baseObjectiveRecord(objectiveRecordOverrides ?? {});
  const objectiveEvaluations = objectiveEvaluationsOverride ?? [record];
  const score =
    optimizationScoreOverride ??
    composeCandidateOptimizationScore({
      candidateId: resultOverrides.candidateId ?? "cand-1",
      feasible: true,
      hardViolationCount: 0,
      authorityValues: authorityValues ?? [0],
      objectiveEvaluations,
    });
  return createCandidateEvaluationResult({
    candidateId: "cand-1",
    operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
    feasible: true,
    structuralViolations: [],
    businessViolations: [],
    allHardViolations: [],
    objectiveEvaluations,
    optimizationScore: score,
    failure: null,
    portDescriptor: portDesc(),
    inputFingerprint: "abcd1234",
    ...resultOverrides,
  });
}

function makeInfeasible(overrides = {}) {
  const {
    violationOverrides,
    authorityValues,
    businessViolations: businessViolationsOverride,
    allHardViolations: allHardViolationsOverride,
    optimizationScore: optimizationScoreOverride,
    ...resultOverrides
  } = overrides;
  const hv = createHardViolation(baseViolation(violationOverrides ?? {}));
  const businessViolations = businessViolationsOverride ?? [hv];
  const allHardViolations =
    allHardViolationsOverride ?? [...businessViolations];
  const score =
    optimizationScoreOverride ??
    composeCandidateOptimizationScore({
      candidateId: resultOverrides.candidateId ?? "cand-1",
      feasible: false,
      hardViolationCount: allHardViolations.length,
      authorityValues: authorityValues ?? [4],
      objectiveEvaluations: [],
    });
  return createCandidateEvaluationResult({
    candidateId: "cand-1",
    operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    status: CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE,
    feasible: false,
    structuralViolations: [],
    businessViolations,
    allHardViolations,
    objectiveEvaluations: [],
    optimizationScore: score,
    failure: null,
    portDescriptor: portDesc(),
    inputFingerprint: "abcd1234",
    ...resultOverrides,
  });
}

function makeInvalidCandidate(overrides = {}) {
  return createCandidateEvaluationResult({
    candidateId: "cand-1",
    operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    status: CANDIDATE_EVALUATION_STATUS.INVALID_CANDIDATE,
    feasible: false,
    structuralViolations: [],
    businessViolations: [],
    allHardViolations: [],
    objectiveEvaluations: [],
    optimizationScore: null,
    failure: inputFailure(),
    portDescriptor: null,
    inputFingerprint: null,
    ...overrides,
  });
}

function makeEvaluationFailed(overrides = {}) {
  return createCandidateEvaluationResult({
    candidateId: "cand-1",
    operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
    feasible: false,
    structuralViolations: [],
    businessViolations: [],
    allHardViolations: [],
    objectiveEvaluations: [],
    optimizationScore: null,
    failure: evalFailure(),
    portDescriptor: portDesc(),
    inputFingerprint: "abcd1234",
    ...overrides,
  });
}

function deepClonePlain(value) {
  return JSON.parse(serializeCanonical(value));
}

// ---------------------------------------------------------------------------
// A. Deterministic fingerprints by status
// ---------------------------------------------------------------------------

test("A01: VALID_FEASIBLE deterministic fingerprint", () => {
  const result = makeFeasible();
  const fp1 = createCandidateEvaluationResultFingerprint(result);
  const fp2 = createCandidateEvaluationResultFingerprint(result);
  assert.match(fp1, /^[0-9a-f]{8}$/);
  assert.equal(fp1, fp2);
});

test("A02: VALID_INFEASIBLE deterministic fingerprint", () => {
  const result = makeInfeasible();
  assert.equal(
    createCandidateEvaluationResultFingerprint(result),
    createCandidateEvaluationResultFingerprint(result)
  );
});

test("A03: INVALID_CANDIDATE deterministic fingerprint", () => {
  const result = makeInvalidCandidate();
  assert.equal(
    createCandidateEvaluationResultFingerprint(result),
    createCandidateEvaluationResultFingerprint(result)
  );
});

test("A04: EVALUATION_FAILED deterministic fingerprint", () => {
  const result = makeEvaluationFailed();
  assert.equal(
    createCandidateEvaluationResultFingerprint(result),
    createCandidateEvaluationResultFingerprint(result)
  );
});

test("A05: repeated equivalent and deep-cloned results share fingerprint", () => {
  const result = makeFeasible();
  const clone = deepClonePlain(result);
  const fp = createCandidateEvaluationResultFingerprint(result);
  assert.equal(createCandidateEvaluationResultFingerprint(clone), fp);
  assert.equal(createCandidateEvaluationResultFingerprint(result), fp);
});

// ---------------------------------------------------------------------------
// B. Material field sensitivity
// ---------------------------------------------------------------------------

test("B01: different candidateId / operation / status / evaluationVersion", () => {
  const base = makeFeasible();
  const fp0 = createCandidateEvaluationResultFingerprint(base);

  const otherId = makeFeasible({ candidateId: "cand-2" });
  // score must align with candidateId
  const score2 = composeCandidateOptimizationScore({
    candidateId: "cand-2",
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveEvaluations: [baseObjectiveRecord()],
  });
  const otherIdAligned = makeFeasible({
    candidateId: "cand-2",
    optimizationScore: score2,
    objectiveEvaluations: [baseObjectiveRecord()],
  });
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(otherIdAligned),
    fp0
  );
  void otherId;

  const otherOp = makeFeasible({
    operation: OPTIMIZATION_OPERATION.GENERIC_ASSIGNMENT,
  });
  assert.notEqual(createCandidateEvaluationResultFingerprint(otherOp), fp0);

  const invalid = makeInvalidCandidate();
  assert.notEqual(createCandidateEvaluationResultFingerprint(invalid), fp0);

  assertThrowsCode(
    () =>
      createCandidateEvaluationResultFingerprint({
        ...deepClonePlain(base),
        evaluationVersion: "NOT_A_PIPELINE_VERSION",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );
});

test("B02: different inputFingerprint / port id / port version", () => {
  const base = makeFeasible();
  const fp0 = createCandidateEvaluationResultFingerprint(base);
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(
      makeFeasible({ inputFingerprint: "ffff0000" })
    ),
    fp0
  );
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(
      makeFeasible({ portDescriptor: portDesc({ portId: "OTHER_PORT" }) })
    ),
    fp0
  );
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(
      makeFeasible({
        portDescriptor: portDesc({ portVersion: "OTHER_PORT_V" }),
      })
    ),
    fp0
  );
});

test("B03: different HardViolation code / magnitude / evidence", () => {
  const base = makeInfeasible();
  const fp0 = createCandidateEvaluationResultFingerprint(base);
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(
      makeInfeasible({ violationOverrides: { violationCode: "HV_OTHER" } })
    ),
    fp0
  );
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(
      makeInfeasible({ violationOverrides: { magnitude: 9 } })
    ),
    fp0
  );
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(
      makeInfeasible({
        violationOverrides: { detailsCodes: ["D_X"], affectedIds: ["z"] },
      })
    ),
    fp0
  );
});

test("B04: different objective order / value; score authority / objective order", () => {
  const r0 = baseObjectiveRecord({
    objectiveId: "OBJ_A",
    executionIndex: 0,
    orientedValue: 1,
    quantizedValue: 1,
    weightedValue: 1,
    rawValue: 1,
    normalizedValue: 1,
  });
  const r1 = baseObjectiveRecord({
    objectiveId: "OBJ_B",
    evaluatorRef: "eval-b",
    executionIndex: 1,
    orientedValue: 2,
    quantizedValue: 2,
    weightedValue: 2,
    rawValue: 2,
    normalizedValue: 2,
  });
  const ordered = makeFeasible({
    objectiveEvaluations: [r0, r1],
    authorityValues: [3, 5],
  });
  const swapped = makeFeasible({
    objectiveEvaluations: [r1, r0],
    authorityValues: [3, 5],
  });
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(ordered),
    createCandidateEvaluationResultFingerprint(swapped)
  );

  const valueChanged = makeFeasible({
    objectiveEvaluations: [
      baseObjectiveRecord({
        orientedValue: 99,
        quantizedValue: 99,
        weightedValue: 99,
        rawValue: 99,
        normalizedValue: 99,
      }),
    ],
  });
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(valueChanged),
    createCandidateEvaluationResultFingerprint(makeFeasible())
  );

  const authA = makeFeasible({ authorityValues: [1, 2] });
  const authB = makeFeasible({ authorityValues: [2, 1] });
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(authA),
    createCandidateEvaluationResultFingerprint(authB)
  );
});

test("B05: different failure code / stage / messageCode / details / objectiveFailureCode", () => {
  const base = makeEvaluationFailed();
  const fp0 = createCandidateEvaluationResultFingerprint(base);

  const otherCode = makeEvaluationFailed({
    failure: createCandidateEvaluationFailure({
      code: CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED,
      messageCode: "SCORE_COMPOSITION_FAILED",
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,
      candidateId: "cand-1",
      portDescriptor: portDesc(),
    }),
  });
  assert.notEqual(createCandidateEvaluationResultFingerprint(otherCode), fp0);

  const otherMsg = makeEvaluationFailed({
    failure: evalFailure({ messageCode: "OTHER_MSG" }),
  });
  assert.notEqual(createCandidateEvaluationResultFingerprint(otherMsg), fp0);

  const otherDetails = makeEvaluationFailed({
    failure: evalFailure({ detailsCodes: ["DET_A", "DET_B"] }),
  });
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(otherDetails),
    fp0
  );

  const withObjFail = makeEvaluationFailed({
    failure: createCandidateEvaluationFailure({
      code: CANDIDATE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATION_FAILED,
      messageCode: "OBJECTIVE_EVALUATION_FAILED",
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.OBJECTIVE_EVALUATION,
      candidateId: "cand-1",
      portDescriptor: portDesc(),
      objectiveFailureCode: "NON_FINITE_OBJECTIVE_VALUE",
    }),
  });
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(withObjFail),
    fp0
  );
});

test("B06: null descriptor / inputFingerprint vs present differ", () => {
  const withBoth = makeEvaluationFailed({
    portDescriptor: portDesc(),
    inputFingerprint: "abcd1234",
  });
  const noPort = makeEvaluationFailed({
    failure: createCandidateEvaluationFailure({
      code: CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_DEPENDENCIES,
      messageCode: "INVALID_CANDIDATE_EVALUATION_DEPENDENCIES",
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.DEPENDENCY_VALIDATION,
      candidateId: "cand-1",
      portDescriptor: null,
    }),
    portDescriptor: null,
    inputFingerprint: null,
  });
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(withBoth),
    createCandidateEvaluationResultFingerprint(noPort)
  );

  const invalid = makeInvalidCandidate();
  assert.equal(invalid.portDescriptor, null);
  assert.equal(invalid.inputFingerprint, null);
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(invalid),
    createCandidateEvaluationResultFingerprint(withBoth)
  );
});

test("B07: feasible flag inconsistency rejected by revalidation", () => {
  const base = deepClonePlain(makeFeasible());
  base.feasible = false;
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint(base),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );
});

// ---------------------------------------------------------------------------
// C. Caller safety / rejection / canonicalization
// ---------------------------------------------------------------------------

test("C01: caller result not mutated or frozen in place", () => {
  const caller = deepClonePlain(makeFeasible());
  const before = serializeCanonical(caller);
  const fp = createCandidateEvaluationResultFingerprint(caller);
  assert.match(fp, /^[0-9a-f]{8}$/);
  assert.equal(Object.isFrozen(caller), false);
  assert.equal(serializeCanonical(caller), before);
  caller.candidateId = "mutated";
  assert.equal(caller.candidateId, "mutated");
});

test("C02: invalid lookalike / function / Error / Promise / undefined rejected", () => {
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint({ status: "NOPE" }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint(() => ({})),
    FP_INPUT
  );
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint(new Error("x")),
    FP_INPUT
  );
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint(Promise.resolve({})),
    FP_INPUT
  );
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint({ then: () => {} }),
    FP_INPUT
  );
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint(undefined),
    FP_INPUT
  );
});

test("C03: NaN / Infinity top-level rejected; nested non-finite rejected", () => {
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint(NaN),
    FP_INPUT
  );
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint(Infinity),
    FP_INPUT
  );
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint(-Infinity),
    FP_INPUT
  );
  const bad = deepClonePlain(makeFeasible());
  bad.objectiveEvaluations[0].rawValue = NaN;
  assertThrowsCode(
    () => createCandidateEvaluationResultFingerprint(bad),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );
});

test("C04: negative zero canonicalization yields same fingerprint", () => {
  const withNegZero = makeFeasible({
    objectiveRecordOverrides: {
      rawValue: -0,
      normalizedValue: -0,
    },
  });
  const withPosZero = makeFeasible({
    objectiveRecordOverrides: {
      rawValue: 0,
      normalizedValue: 0,
      quantizedValue: 0,
      weightedValue: 0,
      orientedValue: 0,
    },
  });
  // Align oriented pipeline to zero score for pos-zero case.
  const zeroRecord = baseObjectiveRecord({
    rawValue: 0,
    normalizedValue: 0,
    quantizedValue: 0,
    weightedValue: 0,
    orientedValue: 0,
  });
  const negRecord = baseObjectiveRecord({
    rawValue: -0,
    normalizedValue: -0,
    quantizedValue: 0,
    weightedValue: 0,
    orientedValue: 0,
  });
  const a = makeFeasible({ objectiveEvaluations: [negRecord] });
  const b = makeFeasible({ objectiveEvaluations: [zeroRecord] });
  assert.equal(
    createCandidateEvaluationResultFingerprint(a),
    createCandidateEvaluationResultFingerprint(b)
  );
  void withNegZero;
  void withPosZero;
});

test("C05: object key insertion order does not affect fingerprint", () => {
  const base = deepClonePlain(makeFeasible());
  const reordered = {
    inputFingerprint: base.inputFingerprint,
    portDescriptor: base.portDescriptor,
    failure: base.failure,
    optimizationScore: base.optimizationScore,
    objectiveEvaluations: base.objectiveEvaluations,
    allHardViolations: base.allHardViolations,
    businessViolations: base.businessViolations,
    structuralViolations: base.structuralViolations,
    feasible: base.feasible,
    status: base.status,
    operation: base.operation,
    candidateId: base.candidateId,
    evaluationVersion: base.evaluationVersion,
    schemaVersion: base.schemaVersion,
  };
  assert.equal(
    createCandidateEvaluationResultFingerprint(base),
    createCandidateEvaluationResultFingerprint(reordered)
  );
});

test("C06: reserved fingerprint input code cannot be stored in failure", () => {
  assertThrowsCode(
    () =>
      createCandidateEvaluationFailure({
        code: FP_INPUT,
        messageCode: FP_INPUT,
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION,
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
  );
});

// ---------------------------------------------------------------------------
// D. Public API / hygiene / no attachment
// ---------------------------------------------------------------------------

test("D01: public export exact; helpers private; root barrel unchanged", () => {
  assert.equal(
    typeof OptimizerPublic.createCandidateEvaluationResultFingerprint,
    "function"
  );
  assert.equal(
    OptimizerPublic.CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION,
    "CORE10_CANDIDATE_RESULT_FINGERPRINT_V1"
  );
  assert.equal(
    CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION,
    "CORE10_CANDIDATE_RESULT_FINGERPRINT_V1"
  );
  assert.equal(
    "createCandidateEvaluationInputFingerprint" in OptimizerPublic,
    false
  );
  assert.equal(
    "buildCandidateEvaluationResultFingerprintMaterial" in OptimizerPublic,
    false
  );
  assert.equal("buildOwnedRevalidationInput" in OptimizerPublic, false);
  assert.equal("CANDIDATE_EVALUATION_FAILURE_STAGE" in OptimizerPublic, false);

  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(root.includes("createCandidateEvaluationResultFingerprint"), false);
  assert.equal(root.includes("CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION"), false);
  assert.equal(root.includes("evaluateCandidateSolution"), false);
});

test("D02: no timestamp/random/localeCompare/external crypto; reuses fingerprintValue", () => {
  const src = readFileSync(FP_FILE, "utf8");
  for (const banned of [
    "Date.now",
    "new Date",
    "Math.random",
    "localeCompare",
    "process.env",
    "node:crypto",
    "createHash",
    "crypto.",
  ]) {
    assert.equal(src.includes(banned), false, banned);
  }
  assert.match(src, /fingerprintValue/);
  assert.match(src, /createCandidateEvaluationResult/);
  assert.equal(src.includes("evaluateCandidateSolution"), false);
  // Must not attach a resultFingerprint field onto the evaluation result.
  assert.equal(/\bresultFingerprint\s*:/.test(src), false);
  assert.equal(/\.resultFingerprint\b/.test(src), false);
});

test("D03: versioning isolation — engine/pipeline/input/score/comparator unchanged", () => {
  assert.equal(CORE10_ENGINE_VERSION, "1.0.0-phase1b");
  assert.equal(
    CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
    "CORE10_CANDIDATE_EVALUATION_PIPELINE_V1"
  );
  assert.equal(
    CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION,
    "CORE10_CANDIDATE_INPUT_FINGERPRINT_V1"
  );
  assert.equal(
    CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION,
    "CORE10_CANDIDATE_SCORE_COMPOSITION_V1"
  );
  assert.equal(CORE10_COMPARATOR_VERSION, "CORE10_COMPARATOR_V1");
  assert.equal(
    OptimizerPublic.CORE10_IDENTITY.candidateResultFingerprintVersion,
    CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION
  );
});

test("D04: result schema has no resultFingerprint field; FP uses fingerprintValue shape", () => {
  const result = makeFeasible();
  assert.equal("resultFingerprint" in result, false);
  const fp = createCandidateEvaluationResultFingerprint(result);
  // Same algorithm family as fingerprintValue over an empty object differs,
  // but length/format must match fingerprintValue outputs.
  assert.match(fingerprintValue({ x: 1 }), /^[0-9a-f]{8}$/);
  assert.match(fp, /^[0-9a-f]{8}$/);
});

test("D05: failure-path stage difference changes fingerprint when valid", () => {
  const portFail = makeEvaluationFailed();
  const hardFail = makeEvaluationFailed({
    failure: createCandidateEvaluationFailure({
      code: CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_HARD_VIOLATION,
      messageCode: "DUPLICATE_HARD_VIOLATION",
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.HARD_COMPOSITION,
      candidateId: "cand-1",
      portDescriptor: portDesc(),
    }),
  });
  assert.notEqual(
    createCandidateEvaluationResultFingerprint(portFail),
    createCandidateEvaluationResultFingerprint(hardFail)
  );
});

// ---------------------------------------------------------------------------
// E. Regression suites + diff check
// ---------------------------------------------------------------------------

test("E01: Phase 1B / 1C-A / B1 / B2-A / B2-B regression suites pass", () => {
  const suites = [
    "tests/competition-core-optimizer-core10-phase1b.test.js",
    "tests/competition-core-optimizer-core10-phase1c-a.test.js",
    "tests/competition-core-optimizer-core10-phase1c-b1.test.js",
    "tests/competition-core-optimizer-core10-phase1c-b2-a.test.js",
    "tests/competition-core-optimizer-core10-phase1c-b2-b.test.js",
  ];
  for (const suite of suites) {
    execFileSync(process.execPath, ["--test", suite], {
      cwd: ROOT,
      stdio: "pipe",
    });
  }
});

test("E02: git diff --check clean for tracked changes", () => {
  execFileSync("git", ["diff", "--check"], { cwd: ROOT, stdio: "pipe" });
  execFileSync("git", ["diff", "--cached", "--check"], {
    cwd: ROOT,
    stdio: "pipe",
  });
});

test("E03: static unused-symbol compatibility — FP module exports only public fn", () => {
  const src = readFileSync(FP_FILE, "utf8");
  assert.match(src, /export function createCandidateEvaluationResultFingerprint/);
  assert.equal(/\bexport function build/.test(src), false);
  assert.equal(src.includes("export {"), false);
  const evalBarrel = readFileSync(
    path.join(OPT_ROOT, "evaluation", "index.js"),
    "utf8"
  );
  assert.match(evalBarrel, /createCandidateEvaluationResultFingerprint/);
  const optBarrel = readFileSync(path.join(OPT_ROOT, "index.js"), "utf8");
  assert.match(optBarrel, /createCandidateEvaluationResultFingerprint/);
  assert.match(optBarrel, /CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION/);
});

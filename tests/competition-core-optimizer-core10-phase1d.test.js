/**
 * CORE-10 Phase 1D — candidate ranking / feasible-winner selection.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as OptimizerPublic from "../src/features/competition-core/optimizer/index.js";

import {
  OPTIMIZATION_OPERATION,
  CONSTRAINT_KIND,
  OBJECTIVE_SENSE,
  CANDIDATE_EVALUATION_STATUS,
  CANDIDATE_EVALUATION_FAILURE_CODE,
  CANDIDATE_RANKING_FAILURE_CODE,
  CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  CORE10_CANDIDATE_RANKING_VERSION,
  CORE10_COMPARATOR_VERSION,
  OptimizerContractError,
  createHardViolation,
  createCandidateEvaluationFailure,
  createCandidateEvaluationResult,
  createOptimizationScore,
  composeCandidateOptimizationScore,
  rankCandidateEvaluations,
  serializeCanonical,
} from "../src/features/competition-core/optimizer/index.js";

import { CANDIDATE_EVALUATION_FAILURE_STAGE } from "../src/features/competition-core/optimizer/contracts/candidateEvaluationFailure.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const RANK_FILE = path.join(OPT_ROOT, "ranking", "rankCandidateEvaluations.js");
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");

const FAIL = CANDIDATE_RANKING_FAILURE_CODE.INVALID_CANDIDATE_RANKING_INPUT;
const DUP = CANDIDATE_RANKING_FAILURE_CODE.DUPLICATE_CANDIDATE_ID;

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
    displayTotal,
    ...resultOverrides
  } = overrides;
  const {
    candidateId: candidateIdOverride,
    ...restResultOverrides
  } = resultOverrides;
  const candidateId = candidateIdOverride ?? "cand-1";
  const record = baseObjectiveRecord({
    orientedValue: 3,
    ...(objectiveRecordOverrides ?? {}),
  });
  const objectiveEvaluations = objectiveEvaluationsOverride ?? [record];
  let score =
    optimizationScoreOverride ??
    composeCandidateOptimizationScore({
      candidateId,
      feasible: true,
      hardViolationCount: 0,
      authorityValues: authorityValues ?? [0],
      objectiveEvaluations,
    });
  if (displayTotal != null && optimizationScoreOverride == null) {
    score = createOptimizationScore({
      ...score,
      authorityValues: [...score.authorityValues],
      objectiveValues: [...score.objectiveValues],
      displayTotal,
    });
  }
  return createCandidateEvaluationResult({
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
    ...restResultOverrides,
    candidateId,
  });
}

function makeInfeasible(overrides = {}) {
  const {
    violationOverrides,
    authorityValues,
    magnitude,
    businessViolations: businessViolationsOverride,
    allHardViolations: allHardViolationsOverride,
    optimizationScore: optimizationScoreOverride,
    displayTotal,
    ...resultOverrides
  } = overrides;
  const {
    candidateId: candidateIdOverride,
    ...restResultOverrides
  } = resultOverrides;
  const candidateId = candidateIdOverride ?? "cand-1";
  const hv = createHardViolation(
    baseViolation({
      magnitude: magnitude ?? 1,
      ...(violationOverrides ?? {}),
    })
  );
  const businessViolations = businessViolationsOverride ?? [hv];
  const allHardViolations =
    allHardViolationsOverride ?? [...businessViolations];
  let score =
    optimizationScoreOverride ??
    composeCandidateOptimizationScore({
      candidateId,
      feasible: false,
      hardViolationCount: allHardViolations.length,
      authorityValues: authorityValues ?? [4],
      objectiveEvaluations: [],
    });
  if (displayTotal != null && optimizationScoreOverride == null) {
    score = createOptimizationScore({
      ...score,
      authorityValues: [...score.authorityValues],
      objectiveValues: [...score.objectiveValues],
      displayTotal,
    });
  }
  return createCandidateEvaluationResult({
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
    ...restResultOverrides,
    candidateId,
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

function viewSnapshot(view) {
  return {
    rankedCandidateIds: [...view.rankedCandidateIds],
    selectedCandidateId: view.selectedCandidateId,
    rankedScores: view.rankedScores.map((s) => ({
      feasible: s.feasible,
      hardViolationCount: s.hardViolationCount,
      authorityValues: [...s.authorityValues],
      objectiveValues: [...s.objectiveValues],
      displayTotal: s.displayTotal,
      comparatorVersion: s.comparatorVersion,
      candidateId: s.candidateId,
    })),
    feasibleCount: view.feasibleCount,
    infeasibleCount: view.infeasibleCount,
    rankingVersion: view.rankingVersion,
  };
}

// ---------------------------------------------------------------------------
// T01–T07 ranking behavior
// ---------------------------------------------------------------------------

test("T01: empty frontier returns empty view and selectedCandidateId null", () => {
  const view = rankCandidateEvaluations([]);
  assert.deepEqual([...view.rankedCandidateIds], []);
  assert.equal(view.selectedCandidateId, null);
  assert.deepEqual([...view.rankedScores], []);
  assert.equal(view.feasibleCount, 0);
  assert.equal(view.infeasibleCount, 0);
  assert.equal(view.rankingVersion, CORE10_CANDIDATE_RANKING_VERSION);
});

test("T02: singleton feasible candidate is selected", () => {
  const frontier = [makeFeasible({ candidateId: "only" })];
  const view = rankCandidateEvaluations(frontier);
  assert.deepEqual([...view.rankedCandidateIds], ["only"]);
  assert.equal(view.selectedCandidateId, "only");
  assert.equal(view.feasibleCount, 1);
  assert.equal(view.infeasibleCount, 0);
});

test("T03: deterministic known-order ranking", () => {
  const a = makeFeasible({
    candidateId: "a",
    authorityValues: [1],
    objectiveRecordOverrides: { orientedValue: 5 },
  });
  const b = makeFeasible({
    candidateId: "b",
    authorityValues: [0],
    objectiveRecordOverrides: { orientedValue: 9 },
  });
  const c = makeInfeasible({
    candidateId: "c",
    authorityValues: [0],
  });
  const view = rankCandidateEvaluations([c, a, b]);
  // b (auth 0) before a (auth 1); both feasible before infeasible c
  assert.deepEqual([...view.rankedCandidateIds], ["b", "a", "c"]);
  assert.equal(view.selectedCandidateId, "b");
  assert.equal(view.feasibleCount, 2);
  assert.equal(view.infeasibleCount, 1);
});

test("T04: input permutation invariance", () => {
  const items = [
    makeFeasible({
      candidateId: "x",
      authorityValues: [2],
      objectiveRecordOverrides: { orientedValue: 1 },
    }),
    makeFeasible({
      candidateId: "y",
      authorityValues: [1],
      objectiveRecordOverrides: { orientedValue: 1 },
    }),
    makeInfeasible({ candidateId: "z", authorityValues: [0] }),
  ];
  const orders = [
    [0, 1, 2],
    [2, 1, 0],
    [1, 2, 0],
    [2, 0, 1],
  ];
  const expected = viewSnapshot(rankCandidateEvaluations(items));
  for (const order of orders) {
    const permuted = order.map((i) => items[i]);
    assert.deepEqual(viewSnapshot(rankCandidateEvaluations(permuted)), expected);
  }
});

test("T05: feasible candidate ranks ahead of infeasible candidate", () => {
  const feasible = makeFeasible({
    candidateId: "fe",
    authorityValues: [99],
    objectiveRecordOverrides: { orientedValue: 99 },
  });
  const infeasible = makeInfeasible({
    candidateId: "in",
    authorityValues: [0],
  });
  const view = rankCandidateEvaluations([infeasible, feasible]);
  assert.deepEqual([...view.rankedCandidateIds], ["fe", "in"]);
  assert.equal(view.selectedCandidateId, "fe");
});

test("T06: all-infeasible frontier returns full ranking and null selection", () => {
  const worse = makeInfeasible({
    candidateId: "w",
    businessViolations: [
      createHardViolation(baseViolation({ magnitude: 1, constraintId: "c-a" })),
      createHardViolation(baseViolation({ magnitude: 1, constraintId: "c-b" })),
    ],
  });
  const better = makeInfeasible({
    candidateId: "b",
    businessViolations: [
      createHardViolation(baseViolation({ magnitude: 1, constraintId: "c-a" })),
    ],
  });
  const view = rankCandidateEvaluations([worse, better]);
  assert.deepEqual([...view.rankedCandidateIds], ["b", "w"]);
  assert.equal(view.selectedCandidateId, null);
  assert.equal(view.feasibleCount, 0);
  assert.equal(view.infeasibleCount, 2);
});

test("T07: equal scores resolve by stable candidateId", () => {
  const mid = makeFeasible({
    candidateId: "mid",
    authorityValues: [0],
    objectiveRecordOverrides: { orientedValue: 1 },
  });
  const aaa = makeFeasible({
    candidateId: "aaa",
    authorityValues: [0],
    objectiveRecordOverrides: { orientedValue: 1 },
  });
  const zzz = makeFeasible({
    candidateId: "zzz",
    authorityValues: [0],
    objectiveRecordOverrides: { orientedValue: 1 },
  });
  const view = rankCandidateEvaluations([zzz, mid, aaa]);
  assert.deepEqual([...view.rankedCandidateIds], ["aaa", "mid", "zzz"]);
  assert.equal(view.selectedCandidateId, "aaa");
});

// ---------------------------------------------------------------------------
// T08–T11 validation failures
// ---------------------------------------------------------------------------

test("T08: duplicate candidateId throws", () => {
  assertThrowsCode(
    () =>
      rankCandidateEvaluations([
        makeFeasible({ candidateId: "dup" }),
        makeFeasible({
          candidateId: "dup",
          authorityValues: [1],
          objectiveRecordOverrides: { orientedValue: 2 },
        }),
      ]),
    DUP
  );
});

test("T09: malformed result throws", () => {
  assertThrowsCode(() => rankCandidateEvaluations(null), FAIL);
  assertThrowsCode(() => rankCandidateEvaluations({}), FAIL);
  assertThrowsCode(() => rankCandidateEvaluations("x"), FAIL);
  assertThrowsCode(() => rankCandidateEvaluations(Promise.resolve([])), FAIL);
  assertThrowsCode(() => rankCandidateEvaluations({ then: () => {} }), FAIL);
  assertThrowsCode(() => rankCandidateEvaluations([null]), FAIL);
  assertThrowsCode(() => rankCandidateEvaluations([42]), FAIL);
  assertThrowsCode(
    () => rankCandidateEvaluations([{ status: "NOPE" }]),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );
});

test("T10: INVALID_CANDIDATE and EVALUATION_FAILED results throw", () => {
  assertThrowsCode(
    () => rankCandidateEvaluations([makeInvalidCandidate()]),
    FAIL
  );
  assertThrowsCode(
    () => rankCandidateEvaluations([makeEvaluationFailed()]),
    FAIL
  );
  assertThrowsCode(
    () =>
      rankCandidateEvaluations([
        makeFeasible({ candidateId: "ok" }),
        makeInvalidCandidate({ candidateId: "bad" }),
      ]),
    FAIL
  );
});

test("T11: score/result candidateId mismatch throws", () => {
  const score = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveValues: [1],
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "score-id",
  });
  // Factory rejects mismatch — ranking must also reject lookalikes that bypass
  // factory by constructing a frontier item that revalidation would catch, or
  // by using a custom object that survives only if we skip factory (we don't).
  // Build via factory with matching IDs then attempt a lookalike bypass:
  assert.throws(
    () =>
      createCandidateEvaluationResult({
        candidateId: "result-id",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
        feasible: true,
        structuralViolations: [],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [
          baseObjectiveRecord({ orientedValue: 1, quantizedValue: 1, weightedValue: 1, rawValue: 1, normalizedValue: 1 }),
        ],
        optimizationScore: score,
        failure: null,
        portDescriptor: portDesc(),
        inputFingerprint: "abcd1234",
      }),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code ===
        CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );

  // Ranking rejects a handcrafted lookalike that is not factory-valid either.
  assertThrowsCode(
    () =>
      rankCandidateEvaluations([
        {
          candidateId: "result-id",
          operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
          status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
          feasible: true,
          structuralViolations: [],
          businessViolations: [],
          allHardViolations: [],
          objectiveEvaluations: [
            baseObjectiveRecord({
              orientedValue: 1,
              quantizedValue: 1,
              weightedValue: 1,
              rawValue: 1,
              normalizedValue: 1,
            }),
          ],
          optimizationScore: score,
          failure: null,
          portDescriptor: portDesc(),
          inputFingerprint: "abcd1234",
        },
      ]),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );
});

// ---------------------------------------------------------------------------
// T12–T16 ownership / alignment / freeze
// ---------------------------------------------------------------------------

test("T12: no caller input mutation", () => {
  const frontier = [
    makeFeasible({ candidateId: "m2", authorityValues: [1] }),
    makeFeasible({ candidateId: "m1", authorityValues: [0] }),
  ];
  const before = serializeCanonical(frontier);
  const beforeIds = frontier.map((r) => r.candidateId);
  rankCandidateEvaluations(frontier);
  assert.equal(serializeCanonical(frontier), before);
  assert.deepEqual(
    frontier.map((r) => r.candidateId),
    beforeIds
  );
  assert.equal(Object.isFrozen(frontier), false);
});

test("T13: displayTotal does not affect ranking", () => {
  const betterAuth = makeFeasible({
    candidateId: "better",
    authorityValues: [0],
    objectiveRecordOverrides: { orientedValue: 5 },
    displayTotal: 0,
  });
  const worseAuth = makeFeasible({
    candidateId: "worse",
    authorityValues: [1],
    objectiveRecordOverrides: { orientedValue: 0 },
    displayTotal: 999999,
  });
  const view = rankCandidateEvaluations([worseAuth, betterAuth]);
  assert.deepEqual([...view.rankedCandidateIds], ["better", "worse"]);
  assert.equal(view.selectedCandidateId, "better");
});

test("T14: repeated-run stability", () => {
  const frontier = [
    makeInfeasible({ candidateId: "i1" }),
    makeFeasible({
      candidateId: "f2",
      authorityValues: [1],
      objectiveRecordOverrides: { orientedValue: 2 },
    }),
    makeFeasible({
      candidateId: "f1",
      authorityValues: [0],
      objectiveRecordOverrides: { orientedValue: 2 },
    }),
  ];
  const a = viewSnapshot(rankCandidateEvaluations(frontier));
  const b = viewSnapshot(rankCandidateEvaluations(frontier));
  const c = viewSnapshot(rankCandidateEvaluations(deepClonePlain(frontier)));
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test("T15: rankedCandidateIds and rankedScores stay aligned", () => {
  const view = rankCandidateEvaluations([
    makeFeasible({ candidateId: "p", authorityValues: [2] }),
    makeInfeasible({ candidateId: "q" }),
    makeFeasible({ candidateId: "r", authorityValues: [0] }),
  ]);
  assert.equal(view.rankedCandidateIds.length, view.rankedScores.length);
  assert.equal(
    view.feasibleCount + view.infeasibleCount,
    view.rankedCandidateIds.length
  );
  for (let i = 0; i < view.rankedCandidateIds.length; i += 1) {
    assert.equal(
      view.rankedScores[i].candidateId,
      view.rankedCandidateIds[i]
    );
  }
});

test("T16: output object and output arrays are frozen", () => {
  const view = rankCandidateEvaluations([
    makeFeasible({ candidateId: "fr" }),
  ]);
  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.rankedCandidateIds), true);
  assert.equal(Object.isFrozen(view.rankedScores), true);
  assert.throws(() => {
    /** @type {any} */ (view).selectedCandidateId = "x";
  });
  assert.throws(() => {
    /** @type {any} */ (view.rankedCandidateIds).push("x");
  });
});

// ---------------------------------------------------------------------------
// T17–T20 exports / barrel / version / banned patterns
// ---------------------------------------------------------------------------

test("T17: capability-local exports are correct", () => {
  assert.equal(typeof OptimizerPublic.rankCandidateEvaluations, "function");
  assert.equal(
    OptimizerPublic.CORE10_CANDIDATE_RANKING_VERSION,
    "CORE10_CANDIDATE_RANKING_V1"
  );
  assert.equal(
    OptimizerPublic.CANDIDATE_RANKING_FAILURE_CODE.INVALID_CANDIDATE_RANKING_INPUT,
    "INVALID_CANDIDATE_RANKING_INPUT"
  );
  assert.equal(
    OptimizerPublic.CANDIDATE_RANKING_FAILURE_CODE.DUPLICATE_CANDIDATE_ID,
    "DUPLICATE_CANDIDATE_ID"
  );
  assert.equal("isCandidateRankingFailureCode" in OptimizerPublic, false);
  assert.equal("buildOwnedRevalidationInput" in OptimizerPublic, false);
  assert.equal("ownOptimizationScore" in OptimizerPublic, false);
});

test("T18: root competition-core barrel remains unchanged", () => {
  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(root.includes("rankCandidateEvaluations"), false);
  assert.equal(root.includes("CORE10_CANDIDATE_RANKING_VERSION"), false);
  assert.equal(root.includes("CANDIDATE_RANKING_FAILURE_CODE"), false);
  assert.equal(root.includes("evaluateCandidateSolution"), false);
});

test("T19: rankingVersion is exact", () => {
  assert.equal(CORE10_CANDIDATE_RANKING_VERSION, "CORE10_CANDIDATE_RANKING_V1");
  assert.equal(
    rankCandidateEvaluations([]).rankingVersion,
    "CORE10_CANDIDATE_RANKING_V1"
  );
  assert.equal(
    OptimizerPublic.CORE10_IDENTITY.candidateRankingVersion,
    "CORE10_CANDIDATE_RANKING_V1"
  );
});

test("T20: banned nondeterministic patterns absent from ranking source", () => {
  const src = readFileSync(RANK_FILE, "utf8");
  for (const banned of [
    "Date.now",
    "new Date",
    "Math.random",
    "localeCompare",
    "process.env",
    "node:crypto",
    "createHash",
  ]) {
    assert.equal(src.includes(banned), false, banned);
  }
  assert.match(src, /sortScoresDeterministic/);
  assert.equal(src.includes("compareOptimizationScores"), false);
  assert.equal(src.includes("evaluateCandidateSolution"), false);
  assert.equal(src.includes("resultFingerprint"), false);
  assert.equal(src.includes("DETERMINISTIC_GREEDY"), false);
  assert.equal(src.includes("EXHAUSTIVE"), false);
});

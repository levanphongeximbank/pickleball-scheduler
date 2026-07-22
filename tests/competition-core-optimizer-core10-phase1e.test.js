/**
 * CORE-10 Phase 1E — supplied-frontier OptimizationResult projection.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as OptimizerPublic from "../src/features/competition-core/optimizer/index.js";

import {
  OPTIMIZATION_STATUS,
  OPTIMIZATION_FAILURE_CODE,
  OPTIMIZATION_OPERATION,
  SOLVER_STRATEGY,
  CONSTRAINT_KIND,
  OBJECTIVE_SENSE,
  CANDIDATE_EVALUATION_STATUS,
  CANDIDATE_EVALUATION_FAILURE_CODE,
  CANDIDATE_RANKING_FAILURE_CODE,
  CORE10_SCHEMA_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  CORE10_CANDIDATE_RANKING_VERSION,
  CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_VERSION,
  OptimizerContractError,
  createHardViolation,
  createCandidateEvaluationResult,
  createOptimizationScore,
  composeCandidateOptimizationScore,
  createOptimizationRequest,
  projectOptimizationResultFromEvaluatedFrontier,
  serializeCanonical,
} from "../src/features/competition-core/optimizer/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const PROJ_FILE = path.join(
  OPT_ROOT,
  "projection",
  "projectOptimizationResultFromEvaluatedFrontier.js"
);
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");

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

function basePolicy(overrides = {}) {
  return {
    policyId: "pol-1",
    policyVersion: "1",
    objectiveKeys: ["OBJ_SOFT_A"],
    authorityKeys: ["AUTH_PRIORITY"],
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    quantizeScale: 1,
    ...overrides,
  };
}

function baseRequest(overrides = {}) {
  return {
    schemaVersion: CORE10_SCHEMA_VERSION,
    requestId: "req-1",
    tenantId: "tenant-1",
    competitionId: "comp-1",
    operation: { operationId: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING },
    policy: basePolicy(),
    context: {
      tenantId: "tenant-1",
      competitionId: "comp-1",
      snapshotRefs: [
        {
          snapshotId: "snap-1",
          snapshotVersion: "v1",
          fingerprint: "abcdef01",
          kind: "GENERIC",
        },
      ],
      metadata: {},
    },
    decisionVariables: [
      {
        variableId: "var-a",
        domain: ["x", "y"],
        required: true,
      },
    ],
    seed: "seed-alpha",
    deterministicBudget: { maxCandidates: 100, maxEvaluations: 1000 },
    strategy: SOLVER_STRATEGY.CONTRACT_ONLY,
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

function deepClonePlain(value) {
  return JSON.parse(serializeCanonical(value));
}

function resultSnapshot(result) {
  return {
    status: result.status,
    requestId: result.requestId,
    selectedCandidateId: result.selectedCandidateId,
    rankedCandidateIds: [...result.rankedCandidateIds],
    failure: result.failure
      ? {
          code: result.failure.code,
          message: result.failure.message,
          details: deepClonePlain(result.failure.details),
        }
      : null,
    diagnostics: {
      candidateCount: result.diagnostics.candidateCount,
      feasibleCount: result.diagnostics.feasibleCount,
      infeasibleCount: result.diagnostics.infeasibleCount,
      prunedCount: result.diagnostics.prunedCount,
      budgetUsage: deepClonePlain(result.diagnostics.budgetUsage),
      budgetExhausted: result.diagnostics.budgetExhausted,
      watchdogTimeout: result.diagnostics.watchdogTimeout,
      comparatorVersion: result.diagnostics.comparatorVersion,
      fingerprintAlgorithmVersion:
        result.diagnostics.fingerprintAlgorithmVersion,
    },
    replayMetadata: {
      engineVersion: result.replayMetadata.engineVersion,
      contractSchemaVersion: result.replayMetadata.contractSchemaVersion,
      policyId: result.replayMetadata.policyId,
      policyVersion: result.replayMetadata.policyVersion,
      comparatorVersion: result.replayMetadata.comparatorVersion,
      fingerprintAlgorithmVersion:
        result.replayMetadata.fingerprintAlgorithmVersion,
      inputSnapshotFingerprints: [
        ...result.replayMetadata.inputSnapshotFingerprints,
      ],
      seed: result.replayMetadata.seed,
      prngVersion: result.replayMetadata.prngVersion,
      operationId: result.replayMetadata.operationId,
      deterministicBudget: deepClonePlain(
        result.replayMetadata.deterministicBudget
      ),
      resultFingerprint: result.replayMetadata.resultFingerprint,
    },
    resultFingerprint: result.resultFingerprint,
  };
}

// ---------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------

test("T01: SUCCESS when feasible candidate exists", () => {
  const req = createOptimizationRequest(baseRequest());
  const frontier = [
    makeInfeasible({ candidateId: "bad" }),
    makeFeasible({
      candidateId: "good",
      authorityValues: [0],
      objectiveRecordOverrides: { orientedValue: 1 },
    }),
    makeFeasible({
      candidateId: "worse",
      authorityValues: [1],
      objectiveRecordOverrides: { orientedValue: 1 },
    }),
  ];
  const result = projectOptimizationResultFromEvaluatedFrontier(req, frontier);
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.selectedCandidateId, "good");
  assert.deepEqual([...result.rankedCandidateIds], ["good", "worse", "bad"]);
  assert.equal(result.failure, null);
  assert.equal(result.requestId, "req-1");
  assert.equal(result.diagnostics.feasibleCount, 2);
  assert.equal(result.diagnostics.infeasibleCount, 1);
  assert.equal(result.diagnostics.candidateCount, 3);
  assert.equal(result.resultFingerprint, result.replayMetadata.resultFingerprint);
});

test("T02: empty frontier projects INFEASIBLE with null selection", () => {
  const result = projectOptimizationResultFromEvaluatedFrontier(
    baseRequest(),
    []
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.INFEASIBLE);
  assert.equal(result.selectedCandidateId, null);
  assert.deepEqual([...result.rankedCandidateIds], []);
  assert.equal(result.failure.code, OPTIMIZATION_FAILURE_CODE.INFEASIBLE);
  assert.equal(result.diagnostics.candidateCount, 0);
  assert.equal(result.diagnostics.feasibleCount, 0);
  assert.equal(result.diagnostics.infeasibleCount, 0);
});

test("T03: all infeasible projects INFEASIBLE with null selection", () => {
  const frontier = [
    makeInfeasible({ candidateId: "i2", authorityValues: [2] }),
    makeInfeasible({ candidateId: "i1", authorityValues: [1] }),
  ];
  const result = projectOptimizationResultFromEvaluatedFrontier(
    baseRequest(),
    frontier
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.INFEASIBLE);
  assert.equal(result.selectedCandidateId, null);
  assert.deepEqual([...result.rankedCandidateIds], ["i1", "i2"]);
  assert.equal(result.failure.code, OPTIMIZATION_FAILURE_CODE.INFEASIBLE);
  assert.equal(result.diagnostics.feasibleCount, 0);
  assert.equal(result.diagnostics.infeasibleCount, 2);
});

test("T04: deterministic output across permutations and repeats", () => {
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
  const req = baseRequest();
  const orders = [
    [0, 1, 2],
    [2, 1, 0],
    [1, 2, 0],
  ];
  /** @type {ReturnType<typeof resultSnapshot> | null} */
  let baseline = null;
  for (const order of orders) {
    const frontier = order.map((i) => items[i]);
    const snap = resultSnapshot(
      projectOptimizationResultFromEvaluatedFrontier(req, frontier)
    );
    if (baseline == null) baseline = snap;
    else assert.deepEqual(snap, baseline);
  }
  const again = resultSnapshot(
    projectOptimizationResultFromEvaluatedFrontier(
      deepClonePlain(req),
      deepClonePlain(items)
    )
  );
  assert.deepEqual(again, baseline);
  assert.equal(baseline.selectedCandidateId, "y");
  assert.deepEqual(baseline.rankedCandidateIds, ["y", "x", "z"]);
});

test("T04b: resultFingerprint differs when ranking outcome differs", () => {
  const req = baseRequest();
  const frontierA = [
    makeFeasible({
      candidateId: "a",
      authorityValues: [0],
      objectiveRecordOverrides: { orientedValue: 1 },
    }),
    makeFeasible({
      candidateId: "b",
      authorityValues: [1],
      objectiveRecordOverrides: { orientedValue: 1 },
    }),
  ];
  const frontierB = [
    makeFeasible({
      candidateId: "a",
      authorityValues: [1],
      objectiveRecordOverrides: { orientedValue: 1 },
    }),
    makeFeasible({
      candidateId: "b",
      authorityValues: [0],
      objectiveRecordOverrides: { orientedValue: 1 },
    }),
  ];
  const resultA = projectOptimizationResultFromEvaluatedFrontier(req, frontierA);
  const resultB = projectOptimizationResultFromEvaluatedFrontier(req, frontierB);
  assert.equal(resultA.selectedCandidateId, "a");
  assert.equal(resultB.selectedCandidateId, "b");
  assert.notDeepEqual(
    [...resultA.rankedCandidateIds],
    [...resultB.rankedCandidateIds]
  );
  assert.notEqual(resultA.resultFingerprint, resultB.resultFingerprint);
});

test("T04c: resultFingerprint differs when requestId differs", () => {
  const frontier = [
    makeFeasible({
      candidateId: "only",
      authorityValues: [0],
      objectiveRecordOverrides: { orientedValue: 2 },
    }),
  ];
  const resultA = projectOptimizationResultFromEvaluatedFrontier(
    baseRequest({ requestId: "req-alpha" }),
    frontier
  );
  const resultB = projectOptimizationResultFromEvaluatedFrontier(
    baseRequest({ requestId: "req-beta" }),
    frontier
  );
  assert.equal(resultA.selectedCandidateId, resultB.selectedCandidateId);
  assert.deepEqual(
    [...resultA.rankedCandidateIds],
    [...resultB.rankedCandidateIds]
  );
  assert.notEqual(resultA.requestId, resultB.requestId);
  assert.notEqual(resultA.resultFingerprint, resultB.resultFingerprint);
});

test("T05: OptimizationResult correctness — diagnostics and replay", () => {
  const result = projectOptimizationResultFromEvaluatedFrontier(
    baseRequest(),
    [makeFeasible({ candidateId: "only" })]
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.equal(result.diagnostics.watchdogTimeout, false);
  assert.equal(result.diagnostics.budgetUsage.nodes, 0);
  assert.equal(result.diagnostics.budgetUsage.candidates, 0);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 0);
  assert.equal(result.diagnostics.candidateCount, 1);
  assert.equal(result.diagnostics.feasibleCount, 1);
  assert.equal(result.diagnostics.infeasibleCount, 0);
  assert.equal(result.diagnostics.comparatorVersion, CORE10_COMPARATOR_VERSION);
  assert.equal(result.replayMetadata.policyId, "pol-1");
  assert.equal(result.replayMetadata.policyVersion, "1");
  assert.equal(
    result.replayMetadata.operationId,
    OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING
  );
  assert.deepEqual(
    [...result.replayMetadata.inputSnapshotFingerprints],
    ["abcdef01"]
  );
  assert.equal(result.replayMetadata.seed, "seed-alpha");
  assert.ok(result.resultFingerprint);
  assert.match(result.resultFingerprint, /^[0-9a-f]{8}$/);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test("T06: request validation fails closed", () => {
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(
        baseRequest({ tenantId: undefined }),
        []
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(
        baseRequest({ competitionId: "" }),
        []
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () => projectOptimizationResultFromEvaluatedFrontier(null, []),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T07: wrong strategy fails closed", () => {
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(
        baseRequest({ strategy: SOLVER_STRATEGY.DETERMINISTIC_GREEDY }),
        [makeFeasible({ candidateId: "a" })]
      ),
    OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY
  );
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(
        baseRequest({ strategy: SOLVER_STRATEGY.EXHAUSTIVE }),
        []
      ),
    OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY
  );
});

test("T08: wrong operation fails closed", () => {
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(
        baseRequest({
          operation: { operationId: OPTIMIZATION_OPERATION.CONTRACT_VALIDATE },
        }),
        []
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_OPERATION
  );
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(
        baseRequest({
          operation: {
            operationId: OPTIMIZATION_OPERATION.GENERIC_ASSIGNMENT,
          },
        }),
        [makeFeasible({ candidateId: "a" })]
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_OPERATION
  );
});

test("T09: malformed frontier fails closed", () => {
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(
        baseRequest(),
        /** @type {any} */ ("not-an-array")
      ),
    CANDIDATE_RANKING_FAILURE_CODE.INVALID_CANDIDATE_RANKING_INPUT
  );
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(baseRequest(), [
        /** @type {any} */ ({ candidateId: "lookalike" }),
      ]),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(baseRequest(), [
        makeFeasible({ candidateId: "dup" }),
        makeFeasible({ candidateId: "dup" }),
      ]),
    CANDIDATE_RANKING_FAILURE_CODE.DUPLICATE_CANDIDATE_ID
  );
});

test("T10: Promise/thenable request or frontier rejected", () => {
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(
        /** @type {any} */ (Promise.resolve(baseRequest())),
        []
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(
        baseRequest(),
        /** @type {any} */ (Promise.resolve([]))
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      projectOptimizationResultFromEvaluatedFrontier(baseRequest(), [
        /** @type {any} */ ({ then: () => {} }),
      ]),
    CANDIDATE_RANKING_FAILURE_CODE.INVALID_CANDIDATE_RANKING_INPUT
  );
});

test("T11: no mutation of caller request or frontier", () => {
  const req = baseRequest();
  const frontier = [
    makeFeasible({ candidateId: "m1", authorityValues: [1] }),
    makeFeasible({ candidateId: "m0", authorityValues: [0] }),
  ];
  const beforeReq = serializeCanonical(req);
  const beforeFrontier = serializeCanonical(frontier);
  const beforeIds = frontier.map((r) => r.candidateId);
  projectOptimizationResultFromEvaluatedFrontier(req, frontier);
  assert.equal(serializeCanonical(req), beforeReq);
  assert.equal(serializeCanonical(frontier), beforeFrontier);
  assert.deepEqual(
    frontier.map((r) => r.candidateId),
    beforeIds
  );
  assert.equal(Object.isFrozen(req), false);
  assert.equal(Object.isFrozen(frontier), false);
});

test("T12: frozen OptimizationResult output", () => {
  const result = projectOptimizationResultFromEvaluatedFrontier(
    baseRequest(),
    [makeFeasible({ candidateId: "fr" })]
  );
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.rankedCandidateIds), true);
  assert.equal(Object.isFrozen(result.diagnostics), true);
  assert.equal(Object.isFrozen(result.replayMetadata), true);
  assert.throws(() => {
    /** @type {any} */ (result).selectedCandidateId = "x";
  });
  assert.throws(() => {
    /** @type {any} */ (result.rankedCandidateIds).push("x");
  });
});

// ---------------------------------------------------------------------------
// Exports / barrel / version / banned patterns
// ---------------------------------------------------------------------------

test("T13: capability-local exports are correct", () => {
  assert.equal(
    typeof OptimizerPublic.projectOptimizationResultFromEvaluatedFrontier,
    "function"
  );
  assert.equal(
    OptimizerPublic.CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_VERSION,
    "CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_V1"
  );
  assert.equal(
    CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_VERSION,
    "CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_V1"
  );
  assert.equal(
    OptimizerPublic.CORE10_IDENTITY.suppliedFrontierResultProjectionVersion,
    "CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_V1"
  );
  assert.equal(
    OptimizerPublic.CORE10_CANDIDATE_RANKING_VERSION,
    CORE10_CANDIDATE_RANKING_VERSION
  );
  assert.equal("buildResultFingerprint" in OptimizerPublic, false);
});

test("T14: root competition-core barrel remains unchanged", () => {
  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(
    root.includes("projectOptimizationResultFromEvaluatedFrontier"),
    false
  );
  assert.equal(
    root.includes("CORE10_SUPPLIED_FRONTIER_RESULT_PROJECTION_VERSION"),
    false
  );
  assert.equal(root.includes("rankCandidateEvaluations"), false);
  assert.equal(root.includes("evaluateCandidateSolution"), false);
});

test("T15: banned nondeterministic / search patterns absent from projection source", () => {
  const src = readFileSync(PROJ_FILE, "utf8");
  for (const banned of [
    "Date.now",
    "new Date",
    "Math.random",
    "localeCompare",
    "process.env",
    "node:crypto",
    "createHash",
    "DETERMINISTIC_GREEDY",
    "EXHAUSTIVE",
    "evaluateCandidateSolution",
  ]) {
    assert.equal(src.includes(banned), false, banned);
  }
  assert.match(src, /rankCandidateEvaluations/);
  assert.match(src, /createOptimizationResult/);
  assert.match(src, /createReplayMetadata/);
  assert.match(src, /createEmptySolverDiagnostics/);
});

/**
 * CORE-10 Phase 1F — supplied-candidate optimization orchestration.
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
  CORE10_ENGINE_VERSION,
  CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION,
  OptimizerContractError,
  createObjectiveDefinition,
  createObjectiveRegistry,
  createConstraintEvaluationPort,
  createCandidateEvaluationDependencies,
  createOptimizationRequest,
  optimizeSuppliedCandidates,
  serializeCanonical,
} from "../src/features/competition-core/optimizer/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const ORCH_FILE = path.join(
  OPT_ROOT,
  "orchestration",
  "optimizeSuppliedCandidates.js"
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

function basePolicy(overrides = {}) {
  return {
    policyId: "pol-1",
    policyVersion: "1",
    objectiveKeys: ["OBJ_A"],
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

function baseDecisionVariables() {
  return [
    {
      variableId: "var-a",
      domain: ["x", "y"],
      required: true,
    },
  ];
}

function baseObjectiveSpecs() {
  return [
    {
      objectiveId: "OBJ_A",
      objectiveVersion: "1",
      weight: 1,
      quantizeScale: 1,
    },
  ];
}

function baseBatch(overrides = {}) {
  return {
    candidates: [
      {
        candidateId: "cand-b",
        assignments: [{ variableId: "var-a", valueId: "y" }],
      },
      {
        candidateId: "cand-a",
        assignments: [{ variableId: "var-a", valueId: "x" }],
      },
    ],
    decisionVariables: baseDecisionVariables(),
    objectiveExecutionSpecs: baseObjectiveSpecs(),
    authorityValues: [0],
    ...overrides,
  };
}

function registryWith(
  entries = [
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
      }),
      evaluator: ({ evaluationInput }) => {
        const assignment = evaluationInput.candidate.assignments.find(
          (a) => a.variableId === "var-a"
        );
        // Prefer valueId "x" (oriented 1) over "y" (oriented 5).
        return { rawValue: assignment?.valueId === "x" ? 1 : 5 };
      },
    },
  ]
) {
  return createObjectiveRegistry(entries);
}

function makePort(evaluateConstraints, overrides = {}) {
  return createConstraintEvaluationPort({
    portId: "CORE10_TEST_PORT",
    portVersion: CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
    evaluateConstraints,
    ...overrides,
  });
}

function makeDeps({
  registry = registryWith(),
  port = makePort(() => ({ violations: [], noteCodes: [] })),
} = {}) {
  return {
    objectiveRegistry: registry,
    constraintEvaluationPort: port,
  };
}

function makeInfeasiblePort(candidateIds) {
  const blocked = new Set(candidateIds);
  return makePort((portInput) => {
    const candidateId = portInput.candidateId;
    if (!blocked.has(candidateId)) {
      return { violations: [], noteCodes: [] };
    }
    return {
      violations: [
        {
          violationCode: "HV_TEST",
          constraintId: "c-1",
          sourceModule: "CORE10_TEST",
          sourceVersion: "1",
          severity: CONSTRAINT_KIND.HARD,
          affectedIds: ["id-a"],
          magnitude: 1,
          messageCode: "MSG_TEST",
          detailsCodes: ["D_A"],
        },
      ],
      noteCodes: [],
    };
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
    },
    resultFingerprint: result.resultFingerprint,
  };
}

// ---------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------

test("T01: happy path — feasible candidates, deterministic winner, SUCCESS", () => {
  const req = createOptimizationRequest(baseRequest());
  const batch = baseBatch({
    candidates: [
      {
        candidateId: "worse",
        assignments: [{ variableId: "var-a", valueId: "y" }],
      },
      {
        candidateId: "good",
        assignments: [{ variableId: "var-a", valueId: "x" }],
      },
    ],
    authorityValues: [0],
  });
  const result = optimizeSuppliedCandidates(req, batch, makeDeps());
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.selectedCandidateId, "good");
  assert.deepEqual([...result.rankedCandidateIds], ["good", "worse"]);
  assert.equal(result.failure, null);
  assert.equal(result.diagnostics.feasibleCount, 2);
  assert.equal(result.diagnostics.infeasibleCount, 0);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 2);
});

test("T02: empty candidates → INFEASIBLE with zero counts / evaluations", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest(),
    baseBatch({ candidates: [] }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.INFEASIBLE);
  assert.equal(result.selectedCandidateId, null);
  assert.deepEqual([...result.rankedCandidateIds], []);
  assert.equal(result.failure.code, OPTIMIZATION_FAILURE_CODE.INFEASIBLE);
  assert.equal(result.diagnostics.candidateCount, 0);
  assert.equal(result.diagnostics.feasibleCount, 0);
  assert.equal(result.diagnostics.infeasibleCount, 0);
  assert.equal(result.diagnostics.budgetUsage.nodes, 0);
  assert.equal(result.diagnostics.budgetUsage.candidates, 0);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 0);
});

test("T03: all infeasible → INFEASIBLE, null selection, evaluations = N", () => {
  const batch = baseBatch({
    candidates: [
      {
        candidateId: "i2",
        assignments: [{ variableId: "var-a", valueId: "y" }],
      },
      {
        candidateId: "i1",
        assignments: [{ variableId: "var-a", valueId: "x" }],
      },
    ],
  });
  const result = optimizeSuppliedCandidates(
    baseRequest(),
    batch,
    makeDeps({ port: makeInfeasiblePort(["i1", "i2"]) })
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.INFEASIBLE);
  assert.equal(result.selectedCandidateId, null);
  assert.deepEqual([...result.rankedCandidateIds], ["i1", "i2"]);
  assert.equal(result.failure.code, OPTIMIZATION_FAILURE_CODE.INFEASIBLE);
  assert.equal(result.diagnostics.feasibleCount, 0);
  assert.equal(result.diagnostics.infeasibleCount, 2);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 2);
  assert.equal(result.diagnostics.budgetUsage.candidates, 2);
});

test("T04: deterministic repeat — same result and fingerprint", () => {
  const req = baseRequest();
  const batch = baseBatch();
  const deps = makeDeps();
  const a = resultSnapshot(optimizeSuppliedCandidates(req, batch, deps));
  const b = resultSnapshot(
    optimizeSuppliedCandidates(
      deepClonePlain(req),
      deepClonePlain(batch),
      makeDeps()
    )
  );
  assert.deepEqual(a, b);
  assert.equal(a.selectedCandidateId, "cand-a");
});

test("T05: caller permutation invariance — same ranking / winner / fingerprint", () => {
  const items = [
    {
      candidateId: "z",
      assignments: [{ variableId: "var-a", valueId: "y" }],
    },
    {
      candidateId: "y",
      assignments: [{ variableId: "var-a", valueId: "x" }],
    },
    {
      candidateId: "x",
      assignments: [{ variableId: "var-a", valueId: "y" }],
    },
  ];
  const orders = [
    [0, 1, 2],
    [2, 1, 0],
    [1, 2, 0],
  ];
  /** @type {ReturnType<typeof resultSnapshot> | null} */
  let baseline = null;
  for (const order of orders) {
    const batch = baseBatch({
      candidates: order.map((i) => items[i]),
    });
    const snap = resultSnapshot(
      optimizeSuppliedCandidates(baseRequest(), batch, makeDeps())
    );
    if (baseline == null) baseline = snap;
    else assert.deepEqual(snap, baseline);
  }
  assert.equal(baseline.selectedCandidateId, "y");
  assert.deepEqual(baseline.rankedCandidateIds, ["y", "x", "z"]);
});

test("T06: different winner changes fingerprint", () => {
  const batchA = baseBatch({
    candidates: [
      {
        candidateId: "a",
        assignments: [{ variableId: "var-a", valueId: "x" }],
      },
      {
        candidateId: "b",
        assignments: [{ variableId: "var-a", valueId: "y" }],
      },
    ],
  });
  const batchB = baseBatch({
    candidates: [
      {
        candidateId: "a",
        assignments: [{ variableId: "var-a", valueId: "y" }],
      },
      {
        candidateId: "b",
        assignments: [{ variableId: "var-a", valueId: "x" }],
      },
    ],
  });
  const resultA = optimizeSuppliedCandidates(
    baseRequest(),
    batchA,
    makeDeps()
  );
  const resultB = optimizeSuppliedCandidates(
    baseRequest(),
    batchB,
    makeDeps()
  );
  assert.equal(resultA.selectedCandidateId, "a");
  assert.equal(resultB.selectedCandidateId, "b");
  assert.notEqual(resultA.resultFingerprint, resultB.resultFingerprint);
});

test("T07: different requestId changes fingerprint", () => {
  const batch = baseBatch({
    candidates: [
      {
        candidateId: "only",
        assignments: [{ variableId: "var-a", valueId: "x" }],
      },
    ],
  });
  const resultA = optimizeSuppliedCandidates(
    baseRequest({ requestId: "req-alpha" }),
    batch,
    makeDeps()
  );
  const resultB = optimizeSuppliedCandidates(
    baseRequest({ requestId: "req-beta" }),
    batch,
    makeDeps()
  );
  assert.equal(resultA.selectedCandidateId, resultB.selectedCandidateId);
  assert.notEqual(resultA.requestId, resultB.requestId);
  assert.notEqual(resultA.resultFingerprint, resultB.resultFingerprint);
});

// ---------------------------------------------------------------------------
// Validation / fail-closed
// ---------------------------------------------------------------------------

test("T08: malformed optimizationRequest throws", () => {
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest({ tenantId: undefined }),
        baseBatch({ candidates: [] }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(null, baseBatch({ candidates: [] }), makeDeps()),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T09: unsupported operation throws", () => {
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest({
          operation: { operationId: OPTIMIZATION_OPERATION.CONTRACT_VALIDATE },
        }),
        baseBatch({ candidates: [] }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_OPERATION
  );
});

test("T10: unsupported strategy throws", () => {
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest({ strategy: SOLVER_STRATEGY.DETERMINISTIC_GREEDY }),
        baseBatch({ candidates: [] }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY
  );
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest({ strategy: SOLVER_STRATEGY.EXHAUSTIVE }),
        baseBatch({ candidates: [] }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY
  );
});

test("T11: malformed batch throws", () => {
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        /** @type {any} */ ("not-an-object"),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        baseBatch({ candidates: "nope" }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        baseBatch({ unexpectedField: true }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        baseBatch({
          candidates: [
            {
              candidateId: "c1",
              assignments: [{ variableId: "var-a", valueId: "x" }],
              extra: 1,
            },
          ],
        }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T12: duplicate candidate IDs throw", () => {
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        baseBatch({
          candidates: [
            {
              candidateId: "dup",
              assignments: [{ variableId: "var-a", valueId: "x" }],
            },
            {
              candidateId: "dup",
              assignments: [{ variableId: "var-a", valueId: "y" }],
            },
          ],
        }),
        makeDeps()
      ),
    CANDIDATE_RANKING_FAILURE_CODE.DUPLICATE_CANDIDATE_ID
  );
});

test("T13: malformed evaluationDependencies throw", () => {
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        baseBatch({ candidates: [] }),
        /** @type {any} */ ({})
      ),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_DEPENDENCIES
  );
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        baseBatch({ candidates: [] }),
        /** @type {any} */ (null)
      ),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_DEPENDENCIES
  );
});

test("T14: Promise/thenable request rejected", () => {
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        /** @type {any} */ (Promise.resolve(baseRequest())),
        baseBatch({ candidates: [] }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T15: Promise/thenable batch rejected", () => {
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        /** @type {any} */ (Promise.resolve(baseBatch({ candidates: [] }))),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T16: Promise/thenable dependencies rejected", () => {
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        baseBatch({ candidates: [] }),
        /** @type {any} */ (Promise.resolve(makeDeps()))
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        baseBatch({ candidates: [] }),
        /** @type {any} */ ({ then: () => {} })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T17: non-rankable evaluation result fails closed", () => {
  const brokenRegistry = createObjectiveRegistry([
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
      }),
      evaluator: () => {
        throw new Error("boom");
      },
    },
  ]);
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest(),
        baseBatch({
          candidates: [
            {
              candidateId: "bad-eval",
              assignments: [{ variableId: "var-a", valueId: "x" }],
            },
          ],
        }),
        makeDeps({ registry: brokenRegistry })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );
});

test("T18: no mutation of caller-owned inputs", () => {
  const req = baseRequest();
  const batch = baseBatch();
  const deps = makeDeps();
  const beforeReq = serializeCanonical(req);
  const beforeBatch = serializeCanonical(batch);
  const beforeCandidateIds = batch.candidates.map((c) => c.candidateId);
  optimizeSuppliedCandidates(req, batch, deps);
  assert.equal(serializeCanonical(req), beforeReq);
  assert.equal(serializeCanonical(batch), beforeBatch);
  assert.deepEqual(
    batch.candidates.map((c) => c.candidateId),
    beforeCandidateIds
  );
  assert.equal(Object.isFrozen(req), false);
  assert.equal(Object.isFrozen(batch), false);
});

test("T19: returned result is frozen according to existing factory contract", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest(),
    baseBatch({
      candidates: [
        {
          candidateId: "fr",
          assignments: [{ variableId: "var-a", valueId: "x" }],
        },
      ],
    }),
    makeDeps()
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

test("T20: diagnostics — nodes=0, candidates=N, evaluations=N, flags false", () => {
  const batch = baseBatch({
    candidates: [
      {
        candidateId: "c1",
        assignments: [{ variableId: "var-a", valueId: "x" }],
      },
      {
        candidateId: "c2",
        assignments: [{ variableId: "var-a", valueId: "y" }],
      },
      {
        candidateId: "c3",
        assignments: [{ variableId: "var-a", valueId: "x" }],
      },
    ],
  });
  const result = optimizeSuppliedCandidates(
    baseRequest(),
    batch,
    makeDeps()
  );
  assert.equal(result.diagnostics.budgetUsage.nodes, 0);
  assert.equal(result.diagnostics.budgetUsage.candidates, 3);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 3);
  assert.equal(result.diagnostics.candidateCount, 3);
  assert.equal(result.diagnostics.prunedCount, 0);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.equal(result.diagnostics.watchdogTimeout, false);
});

test("T21: replay metadata accuracy", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest(),
    baseBatch({
      candidates: [
        {
          candidateId: "only",
          assignments: [{ variableId: "var-a", valueId: "x" }],
        },
      ],
    }),
    makeDeps()
  );
  assert.equal(result.replayMetadata.engineVersion, CORE10_ENGINE_VERSION);
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
  assert.ok(result.replayMetadata.prngVersion);
  assert.equal(
    result.resultFingerprint,
    result.replayMetadata.resultFingerprint
  );
  assert.match(result.resultFingerprint, /^[0-9a-f]{8}$/);
});

test("T22: capability-local export exists", () => {
  assert.equal(typeof OptimizerPublic.optimizeSuppliedCandidates, "function");
  assert.equal(
    OptimizerPublic.CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION,
    "CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V1"
  );
  assert.equal(
    CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION,
    "CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V1"
  );
  assert.equal(
    OptimizerPublic.CORE10_IDENTITY.suppliedCandidateOptimizationVersion,
    "CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V1"
  );
  assert.equal("buildResultFingerprint" in OptimizerPublic, false);
});

test("T23: root competition-core barrel unchanged", () => {
  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(root.includes("optimizeSuppliedCandidates"), false);
  assert.equal(
    root.includes("CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION"),
    false
  );
  assert.equal(root.includes("projectOptimizationResultFromEvaluatedFrontier"), false);
  assert.equal(root.includes("rankCandidateEvaluations"), false);
  assert.equal(root.includes("evaluateCandidateSolution"), false);
});

test("T24: source bans — no random/timestamps/async/search/sibling CORE", () => {
  const src = readFileSync(ORCH_FILE, "utf8");
  for (const banned of [
    "Date.now",
    "new Date",
    "Math.random",
    "localeCompare",
    "process.env",
    "node:crypto",
    "createHash",
    "async function",
    " await ",
    "setTimeout",
    "DETERMINISTIC_GREEDY",
    "EXHAUSTIVE",
    "competition-core/constraints",
    "competition-core/match-generation",
    "competition-core/scheduling",
    "features/competition-core/index",
  ]) {
    assert.equal(src.includes(banned), false, banned);
  }
  assert.match(src, /evaluateCandidateSolution/);
  assert.match(src, /rankCandidateEvaluations/);
  assert.match(src, /createOptimizationResult/);
  assert.match(src, /createReplayMetadata/);
  assert.match(src, /createEmptySolverDiagnostics/);
  assert.match(src, /compareStableString/);
  assert.equal(src.includes("projectOptimizationResultFromEvaluatedFrontier"), false);
});

test("T25: certified dependencies factory still accepted", () => {
  const deps = createCandidateEvaluationDependencies(makeDeps());
  const result = optimizeSuppliedCandidates(
    baseRequest(),
    baseBatch({
      candidates: [
        {
          candidateId: "ok",
          assignments: [{ variableId: "var-a", valueId: "x" }],
        },
      ],
    }),
    deps
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.selectedCandidateId, "ok");
});

test("T26: explicit context override is used; omitted context defaults to request", () => {
  const req = baseRequest();
  const withDefault = optimizeSuppliedCandidates(
    req,
    baseBatch({
      candidates: [
        {
          candidateId: "d1",
          assignments: [{ variableId: "var-a", valueId: "x" }],
        },
      ],
    }),
    makeDeps()
  );
  assert.equal(withDefault.status, OPTIMIZATION_STATUS.SUCCESS);

  const badContextBatch = baseBatch({
    candidates: [
      {
        candidateId: "d2",
        assignments: [{ variableId: "var-a", valueId: "x" }],
      },
    ],
    context: {
      tenantId: "other-tenant",
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
  });
  assertThrowsCode(
    () => optimizeSuppliedCandidates(req, badContextBatch, makeDeps()),
    CANDIDATE_EVALUATION_FAILURE_CODE.TENANT_SCOPE_MISMATCH
  );
});

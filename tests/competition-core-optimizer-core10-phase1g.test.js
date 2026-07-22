/**
 * CORE-10 Phase 1G — deterministic evaluation-budget termination
 * for supplied-candidate optimization.
 *
 * Run: node --test tests/competition-core-optimizer-core10-phase1g.test.js
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
  CORE10_SCHEMA_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION,
  CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
  OptimizerContractError,
  createObjectiveDefinition,
  createObjectiveRegistry,
  createConstraintEvaluationPort,
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
const VERSIONS_FILE = path.join(OPT_ROOT, "constants", "versions.js");

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

function cand(id, valueId = "x") {
  return {
    candidateId: id,
    assignments: [{ variableId: "var-a", valueId }],
  };
}

function baseBatch(overrides = {}) {
  return {
    candidates: [cand("cand-b", "y"), cand("cand-a", "x")],
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

const FOUR_CANDIDATES = [
  cand("d", "y"),
  cand("c", "x"),
  cand("b", "y"),
  cand("a", "x"),
];

// ---------------------------------------------------------------------------
// Within-budget / limit selection
// ---------------------------------------------------------------------------

test("T01: within-budget feasible batch preserves Phase 1F SUCCESS semantics", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxCandidates: 10, maxEvaluations: 10 },
    }),
    baseBatch({
      candidates: [cand("worse", "y"), cand("good", "x")],
    }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.selectedCandidateId, "good");
  assert.deepEqual([...result.rankedCandidateIds], ["good", "worse"]);
  assert.equal(result.failure, null);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 2);
});

test("T02: exact maxEvaluations fit does not exhaust", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 4 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 4);
  assert.equal(result.diagnostics.candidateCount, 4);
});

test("T03: exact maxCandidates fit does not exhaust", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxCandidates: 4 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 4);
});

test("T04: lower maxEvaluations wins over maxCandidates", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxCandidates: 10, maxEvaluations: 2 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 2);
  assert.deepEqual([...result.rankedCandidateIds].sort(), ["a", "b"].sort());
  assert.ok([...result.rankedCandidateIds].every((id) => id === "a" || id === "b"));
});

test("T05: lower maxCandidates wins over maxEvaluations", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxCandidates: 2, maxEvaluations: 10 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 2);
});

test("T06: only maxEvaluations limits execution", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 1 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 1);
  assert.deepEqual([...result.rankedCandidateIds], ["a"]);
});

test("T07: only maxCandidates limits execution", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxCandidates: 1 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 1);
  assert.deepEqual([...result.rankedCandidateIds], ["a"]);
});

test("T08: only maxNodes does not cap supplied candidate evaluations", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxNodes: 1 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 4);
  assert.equal(result.diagnostics.budgetUsage.nodes, 0);
});

test("T09: zero maxEvaluations with non-empty batch evaluates zero", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 0 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(result.selectedCandidateId, null);
  assert.deepEqual([...result.rankedCandidateIds], []);
  assert.equal(result.diagnostics.candidateCount, 4);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 0);
  assert.equal(result.diagnostics.feasibleCount, 0);
  assert.equal(result.diagnostics.infeasibleCount, 0);
  assert.equal(result.diagnostics.budgetExhausted, true);
  assert.equal(result.diagnostics.watchdogTimeout, false);
  assert.equal(result.diagnostics.budgetUsage.nodes, 0);
});

test("T10: zero maxCandidates with non-empty batch evaluates zero", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxCandidates: 0 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(result.selectedCandidateId, null);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 0);
  assert.equal(result.diagnostics.candidateCount, 4);
  assert.equal(result.diagnostics.budgetExhausted, true);
});

test("T11: empty batch remains INFEASIBLE and not budget exhausted", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 0 },
    }),
    baseBatch({ candidates: [] }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.INFEASIBLE);
  assert.equal(result.failure.code, OPTIMIZATION_FAILURE_CODE.INFEASIBLE);
  assert.equal(result.diagnostics.candidateCount, 0);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 0);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.equal(result.diagnostics.watchdogTimeout, false);
});

// ---------------------------------------------------------------------------
// Truncation / exhaustion
// ---------------------------------------------------------------------------

test("T12: over-limit batch returns BUDGET_EXHAUSTED", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 2 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
});

test("T13: budget exhaustion uses existing failure code", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 1 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.failure.code, OPTIMIZATION_FAILURE_CODE.BUDGET_EXHAUSTED);
  assert.equal(result.failure.code, "BUDGET_EXHAUSTED");
});

test("T14: truncated batch never returns SUCCESS", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxCandidates: 3 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.notEqual(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
});

test("T15: canonical candidateId order determines evaluated subset", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 2 },
    }),
    baseBatch({
      candidates: [cand("z", "y"), cand("m", "y"), cand("a", "x"), cand("b", "y")],
    }),
    makeDeps()
  );
  assert.deepEqual([...result.rankedCandidateIds].slice().sort(), ["a", "b"]);
  assert.ok(result.rankedCandidateIds.includes("a"));
  assert.ok(result.rankedCandidateIds.includes("b"));
  assert.equal(result.rankedCandidateIds.includes("m"), false);
  assert.equal(result.rankedCandidateIds.includes("z"), false);
});

test("T16: caller permutation produces same evaluated subset", () => {
  const items = [cand("z", "y"), cand("y", "x"), cand("x", "y"), cand("w", "y")];
  const orders = [
    [0, 1, 2, 3],
    [3, 2, 1, 0],
    [1, 3, 0, 2],
  ];
  /** @type {string[] | null} */
  let baseline = null;
  for (const order of orders) {
    const result = optimizeSuppliedCandidates(
      baseRequest({
        deterministicBudget: { maxEvaluations: 2 },
      }),
      baseBatch({ candidates: order.map((i) => items[i]) }),
      makeDeps()
    );
    const ids = [...result.rankedCandidateIds].slice().sort();
    if (baseline == null) baseline = ids;
    else assert.deepEqual(ids, baseline);
  }
});

test("T17: caller permutation produces same final result/fingerprint", () => {
  const items = [cand("z", "y"), cand("y", "x"), cand("x", "y")];
  const orders = [
    [0, 1, 2],
    [2, 1, 0],
    [1, 2, 0],
  ];
  /** @type {ReturnType<typeof resultSnapshot> | null} */
  let baseline = null;
  for (const order of orders) {
    const snap = resultSnapshot(
      optimizeSuppliedCandidates(
        baseRequest({
          deterministicBudget: { maxEvaluations: 2 },
        }),
        baseBatch({ candidates: order.map((i) => items[i]) }),
        makeDeps()
      )
    );
    if (baseline == null) baseline = snap;
    else assert.deepEqual(snap, baseline);
  }
});

test("T18: best feasible evaluated candidate is selected under exhaustion", () => {
  // Canonical order: a (infeasible), b (worse feasible), c (best feasible), d (unevaluated)
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 3 },
    }),
    baseBatch({
      candidates: [
        cand("d", "x"),
        cand("c", "x"),
        cand("b", "y"),
        cand("a", "y"),
      ],
    }),
    makeDeps({ port: makeInfeasiblePort(["a"]) })
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(result.selectedCandidateId, "c");
  assert.equal(result.diagnostics.budgetUsage.evaluations, 3);
  assert.equal(result.rankedCandidateIds.includes("d"), false);
});

test("T19: exhaustion before any feasible candidate returns null selection", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 2 },
    }),
    baseBatch({
      candidates: [
        cand("a", "x"),
        cand("b", "x"),
        cand("c", "x"),
      ],
    }),
    makeDeps({ port: makeInfeasiblePort(["a", "b"]) })
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(result.selectedCandidateId, null);
  assert.equal(result.diagnostics.feasibleCount, 0);
  assert.equal(result.diagnostics.infeasibleCount, 2);
});

test("T20: truncated all-infeasible evaluated subset returns BUDGET_EXHAUSTED, not INFEASIBLE", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 2 },
    }),
    baseBatch({
      candidates: [cand("a", "x"), cand("b", "x"), cand("c", "x")],
    }),
    makeDeps({ port: makeInfeasiblePort(["a", "b", "c"]) })
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.notEqual(result.status, OPTIMIZATION_STATUS.INFEASIBLE);
  assert.equal(result.failure.code, OPTIMIZATION_FAILURE_CODE.BUDGET_EXHAUSTED);
});

test("T21: rankedCandidateIds include only evaluated candidates", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 2 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.rankedCandidateIds.length, 2);
  assert.equal(result.rankedCandidateIds.includes("c"), false);
  assert.equal(result.rankedCandidateIds.includes("d"), false);
});

test("T22: candidateCount reports full admitted count", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 1 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.diagnostics.candidateCount, 4);
});

test("T23: evaluationCount reports actual evaluated count", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 2 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.diagnostics.budgetUsage.evaluations, 2);
});

test("T24: diagnostics budgetUsage.candidates reports admitted count", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 1 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.diagnostics.budgetUsage.candidates, 4);
});

test("T25: diagnostics budgetUsage.evaluations reports actual evaluations", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxCandidates: 3 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.diagnostics.budgetUsage.evaluations, 3);
});

test("T26: diagnostics nodes remains zero", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxNodes: 50, maxEvaluations: 2 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(result.diagnostics.budgetUsage.nodes, 0);
});

test("T27: watchdogTimeout remains false", () => {
  const within = optimizeSuppliedCandidates(
    baseRequest(),
    baseBatch({ candidates: [cand("only", "x")] }),
    makeDeps()
  );
  const exhausted = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 1 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(within.diagnostics.watchdogTimeout, false);
  assert.equal(exhausted.diagnostics.watchdogTimeout, false);
});

test("T28: budgetExhausted true iff truncated", () => {
  const complete = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 4 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  const truncated = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 2 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  const empty = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 0 },
    }),
    baseBatch({ candidates: [] }),
    makeDeps()
  );
  assert.equal(complete.diagnostics.budgetExhausted, false);
  assert.equal(truncated.diagnostics.budgetExhausted, true);
  assert.equal(empty.diagnostics.budgetExhausted, false);
});

test("T29: full all-infeasible batch remains INFEASIBLE", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 10 },
    }),
    baseBatch({
      candidates: [cand("i2", "y"), cand("i1", "x")],
    }),
    makeDeps({ port: makeInfeasiblePort(["i1", "i2"]) })
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.INFEASIBLE);
  assert.equal(result.failure.code, OPTIMIZATION_FAILURE_CODE.INFEASIBLE);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 2);
});

test("T30: malformed budget remains rejected by existing request validation", () => {
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest({
          deterministicBudget: { maxEvaluations: -1 },
        }),
        baseBatch({ candidates: [] }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      optimizeSuppliedCandidates(
        baseRequest({
          deterministicBudget: {},
        }),
        baseBatch({ candidates: [] }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T31: thenable evaluation dependency rejection remains unchanged", () => {
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

test("T32: input batch is not mutated", () => {
  const batch = baseBatch({ candidates: FOUR_CANDIDATES });
  const before = serializeCanonical(batch);
  const beforeIds = batch.candidates.map((c) => c.candidateId);
  optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 2 },
    }),
    batch,
    makeDeps()
  );
  assert.equal(serializeCanonical(batch), before);
  assert.deepEqual(
    batch.candidates.map((c) => c.candidateId),
    beforeIds
  );
});

test("T33: request is not mutated", () => {
  const req = baseRequest({
    deterministicBudget: { maxEvaluations: 2 },
  });
  const before = serializeCanonical(req);
  optimizeSuppliedCandidates(req, baseBatch({ candidates: FOUR_CANDIDATES }), makeDeps());
  assert.equal(serializeCanonical(req), before);
  assert.equal(Object.isFrozen(req), false);
});

test("T34: returned result is frozen", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 1 },
    }),
    baseBatch({ candidates: FOUR_CANDIDATES }),
    makeDeps()
  );
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.rankedCandidateIds), true);
  assert.equal(Object.isFrozen(result.diagnostics), true);
  assert.equal(Object.isFrozen(result.replayMetadata), true);
  assert.throws(() => {
    /** @type {any} */ (result).selectedCandidateId = "x";
  });
});

test("T35: V2 capability version is exported through optimizer barrel", () => {
  assert.equal(
    CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
    "CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2"
  );
  assert.equal(
    OptimizerPublic.CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
    "CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2"
  );
  assert.equal(
    CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION,
    "CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V1"
  );
  assert.equal(
    OptimizerPublic.CORE10_IDENTITY.suppliedCandidateOptimizationV2,
    "CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2"
  );
});

test("T36: root competition-core barrel remains unchanged", () => {
  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(root.includes("optimizeSuppliedCandidates"), false);
  assert.equal(
    root.includes("CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2"),
    false
  );
  assert.equal(
    root.includes("CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_VERSION"),
    false
  );
});

test("T37: no Date.now/timers/watchdog implementation", () => {
  const src = readFileSync(ORCH_FILE, "utf8");
  for (const banned of [
    "Date.now",
    "new Date",
    "setTimeout",
    "setInterval",
    "WATCHDOG_TIMEOUT",
    "performance.now",
    "process.hrtime",
  ]) {
    assert.equal(src.includes(banned), false, banned);
  }
});

test("T38: no candidate generation/greedy/exhaustive/sibling CORE imports", () => {
  const src = readFileSync(ORCH_FILE, "utf8");
  for (const banned of [
    "Math.random",
    "localeCompare",
    "async function",
    " await ",
    "DETERMINISTIC_GREEDY",
    "EXHAUSTIVE",
    "competition-core/constraints",
    "competition-core/match-generation",
    "competition-core/scheduling",
    "features/competition-core/index",
    "generateCandidate",
    "greedySearch",
    "exhaustiveSearch",
  ]) {
    assert.equal(src.includes(banned), false, banned);
  }
  assert.match(src, /resolveEffectiveEvaluationLimit/);
  assert.match(src, /CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2/);
});

test("T39: Phase 1F within-budget compatibility", () => {
  const result = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxCandidates: 100, maxEvaluations: 1000 },
    }),
    baseBatch({
      candidates: [cand("worse", "y"), cand("good", "x")],
    }),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.selectedCandidateId, "good");
  assert.deepEqual([...result.rankedCandidateIds], ["good", "worse"]);
  assert.equal(result.failure, null);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.equal(result.diagnostics.watchdogTimeout, false);
  assert.equal(result.diagnostics.budgetUsage.nodes, 0);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 2);
});

test("T40: result fingerprint differs between complete and exhausted execution", () => {
  const batch = baseBatch({ candidates: FOUR_CANDIDATES });
  const complete = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 4 },
    }),
    batch,
    makeDeps()
  );
  const exhausted = optimizeSuppliedCandidates(
    baseRequest({
      deterministicBudget: { maxEvaluations: 2 },
    }),
    batch,
    makeDeps()
  );
  assert.equal(complete.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(exhausted.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.notEqual(complete.resultFingerprint, exhausted.resultFingerprint);
  assert.match(complete.resultFingerprint, /^[0-9a-f]{8}$/);
  assert.match(exhausted.resultFingerprint, /^[0-9a-f]{8}$/);
  const versions = readFileSync(VERSIONS_FILE, "utf8");
  assert.match(versions, /CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2/);
});

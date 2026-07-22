/**
 * CORE-10 Phase 1I — Candidate Source Port wiring into existing orchestration.
 *
 * Run: node --test tests/competition-core-optimizer-core10-phase1i.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as OptimizerPublic from "../src/features/competition-core/optimizer/index.js";
import * as OrchestrationPublic from "../src/features/competition-core/optimizer/orchestration/index.js";

import {
  OPTIMIZATION_STATUS,
  OPTIMIZATION_FAILURE_CODE,
  OPTIMIZATION_OPERATION,
  SOLVER_STRATEGY,
  CONSTRAINT_KIND,
  OBJECTIVE_SENSE,
  CANDIDATE_RANKING_FAILURE_CODE,
  CANDIDATE_EVALUATION_FAILURE_CODE,
  CORE10_SCHEMA_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
  OptimizerContractError,
  createObjectiveDefinition,
  createObjectiveRegistry,
  createConstraintEvaluationPort,
  createCandidateSourcePort,
  createFixedCandidateSourcePort,
  optimizeSuppliedCandidates,
  optimizeCandidateSource,
  serializeCanonical,
} from "../src/features/competition-core/optimizer/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const ORCH_DIR = path.join(OPT_ROOT, "orchestration");
const SOURCE_ORCH_FILE = path.join(ORCH_DIR, "optimizeCandidateSource.js");
const SUPPLIED_ORCH_FILE = path.join(ORCH_DIR, "optimizeSuppliedCandidates.js");
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

function fixedSource(batch, portId = "fixed-source-1") {
  return createFixedCandidateSourcePort({
    portId,
    batch,
  });
}

const FOUR_CANDIDATES = [
  cand("d", "y"),
  cand("c", "x"),
  cand("b", "y"),
  cand("a", "x"),
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

test("T01: exports optimizeCandidateSource from orchestration barrel", () => {
  assert.equal(typeof OrchestrationPublic.optimizeCandidateSource, "function");
  assert.equal(
    OrchestrationPublic.optimizeCandidateSource,
    optimizeCandidateSource
  );
});

test("T02: exports optimizeCandidateSource from optimizer barrel", () => {
  assert.equal(typeof OptimizerPublic.optimizeCandidateSource, "function");
  assert.equal(OptimizerPublic.optimizeCandidateSource, optimizeCandidateSource);
});

test("T03: root competition-core barrel remains unchanged", () => {
  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(root.includes("optimizeCandidateSource"), false);
  assert.equal(root.includes("CORE10_CANDIDATE_SOURCE"), false);
});

// ---------------------------------------------------------------------------
// Happy path / fingerprint parity
// ---------------------------------------------------------------------------

test("T04: valid fixed source successfully delegates", () => {
  const req = baseRequest();
  const batch = baseBatch();
  const result = optimizeCandidateSource(req, fixedSource(batch), makeDeps());
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.selectedCandidateId, "cand-a");
  assert.equal(Object.isFrozen(result), true);
});

test("T05: return shape matches direct optimizeSuppliedCandidates result", () => {
  const req = baseRequest();
  const batch = baseBatch();
  const direct = optimizeSuppliedCandidates(req, batch, makeDeps());
  const viaSource = optimizeCandidateSource(req, fixedSource(batch), makeDeps());
  assert.deepEqual(resultSnapshot(viaSource), resultSnapshot(direct));
});

test("T06: equivalent direct and source-backed runs have equal result fingerprint", () => {
  const req = baseRequest();
  const batch = baseBatch({ candidates: FOUR_CANDIDATES });
  const direct = optimizeSuppliedCandidates(req, batch, makeDeps());
  const viaSource = optimizeCandidateSource(req, fixedSource(batch), makeDeps());
  assert.equal(viaSource.resultFingerprint, direct.resultFingerprint);
  assert.equal(
    viaSource.replayMetadata.resultFingerprint,
    direct.replayMetadata.resultFingerprint
  );
  assert.equal(
    viaSource.failure?.details?.optimizationVersion ??
      CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
    CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2
  );
});

test("T07: source invoked exactly once", () => {
  let produceCount = 0;
  const template = baseBatch();
  const port = createCandidateSourcePort({
    portId: "count-once",
    produce() {
      produceCount += 1;
      return deepClonePlain(template);
    },
  });
  optimizeCandidateSource(baseRequest(), port, makeDeps());
  assert.equal(produceCount, 1);
});

test("T08: source receives optimizationRequest", () => {
  const req = baseRequest();
  let seenRequest;
  const port = createCandidateSourcePort({
    portId: "see-request",
    produce(request) {
      seenRequest = request;
      return deepClonePlain(baseBatch());
    },
  });
  optimizeCandidateSource(req, port, makeDeps());
  assert.equal(seenRequest, req);
});

test("T09: source receives sourceContext separately", () => {
  const sourceContext = Object.freeze({ hint: "ctx-a", nested: { n: 1 } });
  let seenRequest;
  let seenContext;
  const port = createCandidateSourcePort({
    portId: "see-context",
    produce(request, ctx) {
      seenRequest = request;
      seenContext = ctx;
      return deepClonePlain(baseBatch());
    },
  });
  const req = baseRequest();
  optimizeCandidateSource(req, port, makeDeps(), sourceContext);
  assert.equal(seenRequest, req);
  assert.equal(seenContext, sourceContext);
});

// ---------------------------------------------------------------------------
// Non-mutation
// ---------------------------------------------------------------------------

test("T10: optimizationRequest is not mutated", () => {
  const req = baseRequest();
  const before = serializeCanonical(req);
  optimizeCandidateSource(req, fixedSource(baseBatch()), makeDeps(), {
    tag: 1,
  });
  assert.equal(serializeCanonical(req), before);
});

test("T11: sourceContext is not mutated", () => {
  const sourceContext = { tag: "sc", nested: { a: 1 } };
  const before = serializeCanonical(sourceContext);
  optimizeCandidateSource(
    baseRequest(),
    fixedSource(baseBatch()),
    makeDeps(),
    sourceContext
  );
  assert.equal(serializeCanonical(sourceContext), before);
});

test("T12: evaluationDependencies are not mutated", () => {
  const deps = makeDeps();
  const beforeKeys = Object.keys(deps).sort();
  const beforeRegistry = deps.objectiveRegistry;
  const beforePort = deps.constraintEvaluationPort;
  optimizeCandidateSource(baseRequest(), fixedSource(baseBatch()), deps);
  assert.deepEqual(Object.keys(deps).sort(), beforeKeys);
  assert.equal(deps.objectiveRegistry, beforeRegistry);
  assert.equal(deps.constraintEvaluationPort, beforePort);
});

// ---------------------------------------------------------------------------
// Context precedence
// ---------------------------------------------------------------------------

test("T13: source batch context overrides request.context", () => {
  const req = baseRequest();
  const batch = baseBatch({
    candidates: [cand("d1", "x")],
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
    () => optimizeCandidateSource(req, fixedSource(batch), makeDeps()),
    CANDIDATE_EVALUATION_FAILURE_CODE.TENANT_SCOPE_MISMATCH
  );
});

test("T14: omitted source batch context falls back to request.context", () => {
  const req = baseRequest();
  const batch = baseBatch({ candidates: [cand("d1", "x")] });
  assert.equal(Object.prototype.hasOwnProperty.call(batch, "context"), false);
  const result = optimizeCandidateSource(req, fixedSource(batch), makeDeps());
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
});

test("T15: neither path performs context merging", () => {
  const req = baseRequest({
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
      metadata: { fromRequest: true },
    },
  });
  const batch = baseBatch({
    candidates: [cand("d1", "x")],
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
      metadata: { fromBatch: true },
    },
  });
  const direct = optimizeSuppliedCandidates(req, batch, makeDeps());
  const viaSource = optimizeCandidateSource(req, fixedSource(batch), makeDeps());
  assert.equal(viaSource.resultFingerprint, direct.resultFingerprint);
  assert.equal(viaSource.status, OPTIMIZATION_STATUS.SUCCESS);
});

test("T16: explicit invalid/null batch context fails closed", () => {
  const req = baseRequest();
  assertThrowsCode(
    () =>
      optimizeCandidateSource(
        req,
        createCandidateSourcePort({
          portId: "null-context",
          produce() {
            return {
              ...baseBatch({ candidates: [cand("c1", "x")] }),
              context: null,
            };
          },
        }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

// ---------------------------------------------------------------------------
// Ordering / duplicates / budgets
// ---------------------------------------------------------------------------

test("T17: source candidate emission order does not affect selected subset", () => {
  const req = baseRequest({
    deterministicBudget: { maxCandidates: 2, maxEvaluations: null },
  });
  const orderA = [cand("d", "y"), cand("c", "x"), cand("b", "y"), cand("a", "x")];
  const orderB = [cand("a", "x"), cand("b", "y"), cand("c", "x"), cand("d", "y")];
  const resultA = optimizeCandidateSource(
    req,
    fixedSource(baseBatch({ candidates: orderA })),
    makeDeps()
  );
  const resultB = optimizeCandidateSource(
    req,
    fixedSource(baseBatch({ candidates: orderB })),
    makeDeps()
  );
  assert.equal(resultA.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(resultB.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.deepEqual([...resultA.rankedCandidateIds], [...resultB.rankedCandidateIds]);
  assert.equal(resultA.resultFingerprint, resultB.resultFingerprint);
  assert.equal(resultA.diagnostics.budgetUsage.evaluations, 2);
});

test("T18: duplicate candidate IDs fail before budget truncation", () => {
  const req = baseRequest({
    deterministicBudget: { maxCandidates: 1, maxEvaluations: null },
  });
  assertThrowsCode(
    () =>
      optimizeCandidateSource(
        req,
        createCandidateSourcePort({
          portId: "dup-ids",
          produce() {
            return {
              candidates: [cand("same", "x"), cand("same", "y"), cand("other", "x")],
              decisionVariables: baseDecisionVariables(),
              objectiveExecutionSpecs: baseObjectiveSpecs(),
              authorityValues: [0],
            };
          },
        }),
        makeDeps()
      ),
    CANDIDATE_RANKING_FAILURE_CODE.DUPLICATE_CANDIDATE_ID
  );
});

test("T19: semantic duplicates with different IDs remain separate", () => {
  const assignments = [{ variableId: "var-a", valueId: "x" }];
  const batch = baseBatch({
    candidates: [
      { candidateId: "c1", assignments },
      { candidateId: "c2", assignments },
    ],
  });
  const result = optimizeCandidateSource(
    baseRequest(),
    fixedSource(batch),
    makeDeps()
  );
  assert.equal(result.diagnostics.budgetUsage.candidates, 2);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 2);
  assert.equal(result.rankedCandidateIds.length, 2);
});

test("T20: empty batch returns existing INFEASIBLE result", () => {
  const req = baseRequest();
  const batch = baseBatch({ candidates: [] });
  const direct = optimizeSuppliedCandidates(req, batch, makeDeps());
  const viaSource = optimizeCandidateSource(req, fixedSource(batch), makeDeps());
  assert.equal(viaSource.status, OPTIMIZATION_STATUS.INFEASIBLE);
  assert.equal(viaSource.failure?.code, OPTIMIZATION_FAILURE_CODE.INFEASIBLE);
  assert.equal(viaSource.resultFingerprint, direct.resultFingerprint);
});

test("T21: zero maxCandidates with non-empty batch preserves BUDGET_EXHAUSTED", () => {
  const req = baseRequest({
    deterministicBudget: { maxCandidates: 0, maxEvaluations: null },
  });
  const batch = baseBatch({ candidates: FOUR_CANDIDATES });
  const direct = optimizeSuppliedCandidates(req, batch, makeDeps());
  const viaSource = optimizeCandidateSource(req, fixedSource(batch), makeDeps());
  assert.equal(viaSource.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(viaSource.diagnostics.budgetUsage.evaluations, 0);
  assert.equal(viaSource.resultFingerprint, direct.resultFingerprint);
});

test("T22: zero maxEvaluations with non-empty batch preserves BUDGET_EXHAUSTED", () => {
  const req = baseRequest({
    deterministicBudget: { maxCandidates: null, maxEvaluations: 0 },
  });
  const batch = baseBatch({ candidates: FOUR_CANDIDATES });
  const direct = optimizeSuppliedCandidates(req, batch, makeDeps());
  const viaSource = optimizeCandidateSource(req, fixedSource(batch), makeDeps());
  assert.equal(viaSource.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(viaSource.diagnostics.budgetUsage.evaluations, 0);
  assert.equal(viaSource.resultFingerprint, direct.resultFingerprint);
});

test("T23: maxNodes remains ignored", () => {
  const req = baseRequest({
    deterministicBudget: {
      maxNodes: 0,
      maxCandidates: null,
      maxEvaluations: null,
    },
  });
  const batch = baseBatch({ candidates: FOUR_CANDIDATES });
  const result = optimizeCandidateSource(req, fixedSource(batch), makeDeps());
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.equal(result.diagnostics.budgetUsage.evaluations, 4);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.equal(result.diagnostics.budgetUsage.nodes, 0);
});

test("T24: evaluation count matches existing supplied orchestration", () => {
  const req = baseRequest({
    deterministicBudget: { maxCandidates: 3, maxEvaluations: 2 },
  });
  const batch = baseBatch({ candidates: FOUR_CANDIDATES });
  const direct = optimizeSuppliedCandidates(req, batch, makeDeps());
  const viaSource = optimizeCandidateSource(req, fixedSource(batch), makeDeps());
  assert.equal(viaSource.diagnostics.budgetUsage.evaluations, 2);
  assert.equal(
    viaSource.diagnostics.budgetUsage.evaluations,
    direct.diagnostics.budgetUsage.evaluations
  );
  assert.equal(viaSource.resultFingerprint, direct.resultFingerprint);
});

// ---------------------------------------------------------------------------
// Invalid inputs / thenables
// ---------------------------------------------------------------------------

test("T25: invalid source port rejects", () => {
  assertThrowsCode(
    () => optimizeCandidateSource(baseRequest(), null, makeDeps()),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      optimizeCandidateSource(
        baseRequest(),
        () => baseBatch(),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      optimizeCandidateSource(baseRequest(), baseBatch(), makeDeps()),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      optimizeCandidateSource(
        baseRequest(),
        Object.freeze({
          portId: "duck",
          portVersion: "v1",
          produce: () => baseBatch(),
          extra: true,
        }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      optimizeCandidateSource(
        baseRequest(),
        Object.freeze({
          portId: "partial",
          produce: () => baseBatch(),
        }),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T26: Promise optimizationRequest rejects", () => {
  assertThrowsCode(
    () =>
      optimizeCandidateSource(
        Promise.resolve(baseRequest()),
        fixedSource(baseBatch()),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T27: Promise source port rejects", () => {
  assertThrowsCode(
    () =>
      optimizeCandidateSource(
        baseRequest(),
        Promise.resolve(fixedSource(baseBatch())),
        makeDeps()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T28: Promise evaluationDependencies rejects", () => {
  assertThrowsCode(
    () =>
      optimizeCandidateSource(
        baseRequest(),
        fixedSource(baseBatch()),
        Promise.resolve(makeDeps())
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T29: Promise sourceContext rejects", () => {
  assertThrowsCode(
    () =>
      optimizeCandidateSource(
        baseRequest(),
        fixedSource(baseBatch()),
        makeDeps(),
        Promise.resolve({ x: 1 })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T30: generic thenable sourceContext rejects", () => {
  assertThrowsCode(
    () =>
      optimizeCandidateSource(
        baseRequest(),
        fixedSource(baseBatch()),
        makeDeps(),
        { then: () => {} }
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

// ---------------------------------------------------------------------------
// Source / port error preservation
// ---------------------------------------------------------------------------

test("T31: source OptimizerContractError is preserved", () => {
  const original = new OptimizerContractError(
    OPTIMIZATION_FAILURE_CODE.INVALID_OPERATION,
    "source contract boom",
    { marker: "preserve-me" }
  );
  const port = createCandidateSourcePort({
    portId: "throw-contract",
    produce() {
      throw original;
    },
  });
  assert.throws(
    () => optimizeCandidateSource(baseRequest(), port, makeDeps()),
    (err) => {
      assert.equal(err, original);
      assert.equal(err.code, OPTIMIZATION_FAILURE_CODE.INVALID_OPERATION);
      assert.equal(err.details.marker, "preserve-me");
      return true;
    }
  );
});

test("T32: ordinary source Error uses port wrapping", () => {
  const port = createCandidateSourcePort({
    portId: "throw-ordinary",
    produce() {
      throw new Error("boom");
    },
  });
  assert.throws(
    () => optimizeCandidateSource(baseRequest(), port, makeDeps()),
    (err) => {
      assert.ok(err instanceof OptimizerContractError);
      assert.equal(err.code, OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST);
      assert.match(err.message, /threw an exception/i);
      assert.notEqual(err.message, "boom");
      return true;
    }
  );
});

test("T33: Promise source output rejects", () => {
  const port = createCandidateSourcePort({
    portId: "async-out",
    produce() {
      return Promise.resolve(baseBatch());
    },
  });
  assertThrowsCode(
    () => optimizeCandidateSource(baseRequest(), port, makeDeps()),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T34: generic thenable source output rejects", () => {
  const port = createCandidateSourcePort({
    portId: "thenable-out",
    produce() {
      return { then: () => {} };
    },
  });
  assertThrowsCode(
    () => optimizeCandidateSource(baseRequest(), port, makeDeps()),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T35: invalid source batch rejects", () => {
  const port = createCandidateSourcePort({
    portId: "bad-batch",
    produce() {
      return { candidates: [] };
    },
  });
  assertThrowsCode(
    () => optimizeCandidateSource(baseRequest(), port, makeDeps()),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

// ---------------------------------------------------------------------------
// Hygiene / scope guards
// ---------------------------------------------------------------------------

test("T36: no Math.random / Date / timers in Phase 1I source", () => {
  assert.equal(existsSync(SOURCE_ORCH_FILE), true);
  const src = readFileSync(SOURCE_ORCH_FILE, "utf8");
  assert.equal(src.includes("Math.random"), false);
  for (const banned of [
    "Date.now",
    "new Date",
    "setTimeout",
    "setInterval",
    "performance.now",
    "process.hrtime",
  ]) {
    assert.equal(src.includes(banned), false, banned);
  }
});

test("T37: no sibling CORE imports", () => {
  const src = readFileSync(SOURCE_ORCH_FILE, "utf8");
  for (const banned of [
    "competition-core/constraints",
    "competition-core/match-generation",
    "competition-core/scheduling",
    "competition-core/court-assignment",
    "competition-core/referee-assignment",
    "competition-core/registration-eligibility",
    "competition-core/lineups",
  ]) {
    assert.equal(src.includes(banned), false, banned);
  }
});

test("T38: optimizeSuppliedCandidates.js unchanged from Phase 1G/1H baseline", () => {
  const src = readFileSync(SUPPLIED_ORCH_FILE, "utf8");
  assert.equal(src.includes("optimizeCandidateSource"), false);
  assert.equal(src.includes("isCandidateSourcePort"), false);
  assert.equal(src.includes("createCandidateSourcePort"), false);
  assert.match(src, /CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2/);
});

test("T39: no generic optimizer aliases exported", () => {
  for (const banned of [
    "optimizeFromCandidateSource",
    "runCandidateSourceOptimization",
    "optimizeGeneratedCandidates",
    "runOptimization",
    "optimizeCandidates",
  ]) {
    assert.equal(banned in OptimizerPublic, false, banned);
    assert.equal(banned in OrchestrationPublic, false, banned);
  }
});

test("T40: infeasible-only batch preserves INFEASIBLE via source path", () => {
  const blocked = new Set(["cand-a", "cand-b"]);
  const deps = makeDeps({
    port: makePort((portInput) => {
      if (!blocked.has(portInput.candidateId)) {
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
    }),
  });
  const req = baseRequest();
  const batch = baseBatch();
  const direct = optimizeSuppliedCandidates(req, batch, deps);
  const viaSource = optimizeCandidateSource(req, fixedSource(batch), deps);
  assert.equal(viaSource.status, OPTIMIZATION_STATUS.INFEASIBLE);
  assert.equal(viaSource.resultFingerprint, direct.resultFingerprint);
});

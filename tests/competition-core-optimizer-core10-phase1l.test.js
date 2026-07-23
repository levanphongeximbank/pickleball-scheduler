/**
 * CORE-10 Phase 1L — Candidate Evaluation Envelope + Deterministic Bounded Search.
 *
 * Run: node --test tests/competition-core-optimizer-core10-phase1l.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as OptimizerPublic from "../src/features/competition-core/optimizer/index.js";
import * as EnrichmentPublic from "../src/features/competition-core/optimizer/enrichment/index.js";
import * as SearchPublic from "../src/features/competition-core/optimizer/search/index.js";

import {
  OPTIMIZATION_FAILURE_CODE,
  OPTIMIZATION_OPERATION,
  OPTIMIZATION_STATUS,
  SOLVER_STRATEGY,
  OBJECTIVE_SENSE,
  OBJECTIVE_EVALUATION_FAILURE_CODE,
  CORE10_SCHEMA_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1,
  CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
  CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1,
  CORE10_IDENTITY,
  OptimizerContractError,
  createCandidateEvaluationEnvelope,
  applyCandidateEvaluationEnvelope,
  assertCandidateEvaluationEnvelopeCompatible,
  createDeterministicBoundedSearchSpec,
  searchDeterministicCandidates,
  createDeterministicBoundedCandidateSource,
  optimizeDeterministicBoundedSearch,
  createDeterministicCandidateGenerationSpec,
  generateCandidateBatch,
  createCandidateBatch,
  createObjectiveDefinition,
  createObjectiveRegistry,
  createConstraintEvaluationPort,
  isCandidateSourcePort,
  optimizeSuppliedCandidates,
  fingerprintValue,
} from "../src/features/competition-core/optimizer/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const ENRICH_DIR = path.join(OPT_ROOT, "enrichment");
const SEARCH_DIR = path.join(OPT_ROOT, "search");
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");

/**
 * @param {() => unknown} fn
 * @param {string} code
 * @param {(err: OptimizerContractError) => void} [inspect]
 */
function assertThrowsCode(fn, code, inspect) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof OptimizerContractError);
    assert.equal(err.code, code);
    if (inspect) inspect(err);
    return true;
  });
}

function basePolicy(overrides = {}) {
  return {
    policyId: "pol-1",
    policyVersion: "1",
    objectiveKeys: ["OBJ_A"],
    authorityKeys: [],
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
    deterministicBudget: { maxNodes: 100, maxCandidates: 100, maxEvaluations: 1000 },
    strategy: SOLVER_STRATEGY.CONTRACT_ONLY,
    ...overrides,
  };
}

function baseEnvelope(overrides = {}) {
  return {
    envelopeVersion: CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1,
    objectiveExecutionSpecs: [
      {
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
    ],
    authorityValues: [],
    ...overrides,
  };
}

function baseSearchSpec(overrides = {}) {
  return {
    searchSpecVersion: CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
    decisionVariables: [
      {
        variableId: "var-a",
        valueIds: ["x", "y"],
      },
    ],
    maxEmittedCandidates: 100,
    strategy: CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1,
    ...overrides,
  };
}

function multiVarRequest(budgetOverrides = {}) {
  return baseRequest({
    decisionVariables: [
      { variableId: "var-b", domain: ["2", "1"], required: true },
      { variableId: "var-a", domain: ["y", "x"], required: true },
    ],
    deterministicBudget: {
      maxNodes: 100,
      maxCandidates: 100,
      maxEvaluations: 1000,
      ...budgetOverrides,
    },
  });
}

function multiVarSearchSpec(overrides = {}) {
  return {
    searchSpecVersion: CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1,
    decisionVariables: [
      { variableId: "var-b", valueIds: ["2", "1"] },
      { variableId: "var-a", valueIds: ["y", "x"] },
    ],
    maxEmittedCandidates: 100,
    strategy: CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1,
    ...overrides,
  };
}

function registryWith() {
  return createObjectiveRegistry([
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
      }),
      evaluator: () => ({ rawValue: 1 }),
    },
  ]);
}

function makeDeps() {
  return {
    objectiveRegistry: registryWith(),
    constraintEvaluationPort: createConstraintEvaluationPort({
      portId: "CORE10_TEST_PORT",
      portVersion: CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
      evaluateConstraints: () => ({ violations: [], noteCodes: [] }),
    }),
  };
}

function readDirSources(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
  return files.map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");
}

function assignmentId(assignments) {
  return `cand-${fingerprintValue({ assignments })}`;
}

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

test("E01: required fields and exact public version", () => {
  const envelope = createCandidateEvaluationEnvelope(baseEnvelope());
  assert.equal(envelope.envelopeVersion, CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1);
  assert.equal(envelope.objectiveExecutionSpecs.length, 1);
  assert.deepEqual([...envelope.authorityValues], []);
  assert.equal(
    CORE10_IDENTITY.candidateEvaluationEnvelopeV1,
    CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1
  );
});

test("E02: unknown-field rejection", () => {
  assertThrowsCode(
    () =>
      createCandidateEvaluationEnvelope({
        ...baseEnvelope(),
        metadata: {},
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("E03: non-plain and thenable rejection", () => {
  assertThrowsCode(
    () => createCandidateEvaluationEnvelope(null),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () => createCandidateEvaluationEnvelope([]),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      createCandidateEvaluationEnvelope({
        then() {},
        ...baseEnvelope(),
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("E04: getter/accessor rejection", () => {
  const partial = {};
  Object.defineProperty(partial, "envelopeVersion", {
    enumerable: true,
    get() {
      return CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1;
    },
  });
  Object.defineProperty(partial, "objectiveExecutionSpecs", {
    enumerable: true,
    value: baseEnvelope().objectiveExecutionSpecs,
    writable: true,
  });
  Object.defineProperty(partial, "authorityValues", {
    enumerable: true,
    value: [],
    writable: true,
  });
  assertThrowsCode(
    () => createCandidateEvaluationEnvelope(partial),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("E05: objective spec admission and duplicate identity rejection", () => {
  const envelope = createCandidateEvaluationEnvelope(baseEnvelope());
  assert.equal(envelope.objectiveExecutionSpecs[0].objectiveId, "OBJ_A");
  assertThrowsCode(
    () =>
      createCandidateEvaluationEnvelope(
        baseEnvelope({
          objectiveExecutionSpecs: [
            {
              objectiveId: "OBJ_A",
              objectiveVersion: "1",
              weight: 1,
              quantizeScale: 1,
            },
            {
              objectiveId: "OBJ_A",
              objectiveVersion: "1",
              weight: 2,
              quantizeScale: 1,
            },
          ],
        })
      ),
    OBJECTIVE_EVALUATION_FAILURE_CODE.DUPLICATE_OBJECTIVE_EXECUTION
  );
});

test("E06: authority safe-integer validation and empty arrays legal", () => {
  const empty = createCandidateEvaluationEnvelope(
    baseEnvelope({ objectiveExecutionSpecs: [], authorityValues: [] })
  );
  assert.equal(empty.objectiveExecutionSpecs.length, 0);
  assert.equal(empty.authorityValues.length, 0);

  assertThrowsCode(
    () =>
      createCandidateEvaluationEnvelope(
        baseEnvelope({ authorityValues: [1.5] })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      createCandidateEvaluationEnvelope(
        baseEnvelope({ authorityValues: [Number.MAX_SAFE_INTEGER + 1] })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("E07: deep freeze and caller mutation isolation", () => {
  const raw = baseEnvelope({
    authorityValues: [],
    objectiveExecutionSpecs: [
      {
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
    ],
  });
  const envelope = createCandidateEvaluationEnvelope(raw);
  assert.ok(Object.isFrozen(envelope));
  assert.ok(Object.isFrozen(envelope.objectiveExecutionSpecs));
  raw.objectiveExecutionSpecs.push({
    objectiveId: "OBJ_B",
    objectiveVersion: "1",
    weight: 1,
    quantizeScale: 1,
  });
  raw.authorityValues.push(9);
  assert.equal(envelope.objectiveExecutionSpecs.length, 1);
  assert.equal(envelope.authorityValues.length, 0);
});

test("E08: request/envelope authority compatibility", () => {
  assertCandidateEvaluationEnvelopeCompatible(
    baseRequest(),
    baseEnvelope()
  );
  assertThrowsCode(
    () =>
      assertCandidateEvaluationEnvelopeCompatible(
        baseRequest({
          policy: basePolicy({ authorityKeys: ["AUTH_A"] }),
        }),
        baseEnvelope({ authorityValues: [] })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertCandidateEvaluationEnvelopeCompatible(
    baseRequest({
      policy: basePolicy({ authorityKeys: ["AUTH_A"] }),
    }),
    baseEnvelope({ authorityValues: [3] })
  );
});

test("E09: apply preserves candidates/IDs/decisionVariables/context; replaces only specs/authority", () => {
  const batch = createCandidateBatch({
    candidates: [
      {
        candidateId: "cand-keep",
        assignments: [{ variableId: "var-a", valueId: "x" }],
      },
    ],
    decisionVariables: [
      { variableId: "var-a", domain: ["x", "y"], required: true },
    ],
    objectiveExecutionSpecs: [],
    authorityValues: [],
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
      metadata: { note: "keep" },
    },
  });
  const envelope = createCandidateEvaluationEnvelope(baseEnvelope());
  const applied = applyCandidateEvaluationEnvelope(batch, envelope);
  assert.equal(applied.candidates[0].candidateId, "cand-keep");
  assert.deepEqual(
    [...applied.candidates[0].assignments],
    [{ variableId: "var-a", valueId: "x" }]
  );
  assert.equal(applied.decisionVariables[0].variableId, "var-a");
  assert.equal(applied.context.metadata.note, "keep");
  assert.equal(applied.objectiveExecutionSpecs[0].objectiveId, "OBJ_A");
  assert.equal(batch.objectiveExecutionSpecs.length, 0);
  assert.equal(applied.authorityValues.length, 0);
});

test("E10: apply does not evaluate/rank/read budgets", () => {
  const src = readDirSources(ENRICH_DIR);
  assert.equal(src.includes("evaluateCandidateSolution"), false);
  assert.equal(src.includes("rankCandidateEvaluations"), false);
  assert.equal(src.includes("maxNodes"), false);
  assert.equal(src.includes("maxCandidates"), false);
  assert.equal(src.includes("maxEvaluations"), false);
});

// ---------------------------------------------------------------------------
// Search Spec
// ---------------------------------------------------------------------------

test("S01: field validation, strategy, exact public version", () => {
  const spec = createDeterministicBoundedSearchSpec(baseSearchSpec());
  assert.equal(spec.searchSpecVersion, CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1);
  assert.equal(
    spec.strategy,
    CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1
  );
  assert.equal(spec.maxEmittedCandidates, 100);
  assert.equal(
    CORE10_IDENTITY.deterministicBoundedSearchV1,
    CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1
  );
  assertThrowsCode(
    () =>
      createDeterministicBoundedSearchSpec(
        baseSearchSpec({ strategy: "BFS_V1" })
      ),
    OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY
  );
});

test("S02: unique variables/values, empty domains rejected, maxEmittedCandidates", () => {
  assertThrowsCode(
    () =>
      createDeterministicBoundedSearchSpec(
        baseSearchSpec({
          decisionVariables: [
            { variableId: "var-a", valueIds: ["x"] },
            { variableId: "var-a", valueIds: ["y"] },
          ],
        })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      createDeterministicBoundedSearchSpec(
        baseSearchSpec({
          decisionVariables: [{ variableId: "var-a", valueIds: ["x", "x"] }],
        })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      createDeterministicBoundedSearchSpec(
        baseSearchSpec({
          decisionVariables: [{ variableId: "var-a", valueIds: [] }],
        })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertThrowsCode(
    () =>
      createDeterministicBoundedSearchSpec(
        baseSearchSpec({ maxEmittedCandidates: 0 })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("S03: canonical ordering, deep freeze, mutation isolation", () => {
  const raw = multiVarSearchSpec();
  const spec = createDeterministicBoundedSearchSpec(raw);
  assert.deepEqual(
    spec.decisionVariables.map((v) => v.variableId),
    ["var-a", "var-b"]
  );
  assert.deepEqual([...spec.decisionVariables[0].valueIds], ["x", "y"]);
  assert.deepEqual([...spec.decisionVariables[1].valueIds], ["1", "2"]);
  assert.ok(Object.isFrozen(spec));
  raw.decisionVariables.push({ variableId: "var-z", valueIds: ["q"] });
  raw.maxEmittedCandidates = 1;
  assert.equal(spec.decisionVariables.length, 2);
  assert.equal(spec.maxEmittedCandidates, 100);
});

// ---------------------------------------------------------------------------
// Bounded Search
// ---------------------------------------------------------------------------

test("B01: root counts as node 1; exact cutoff; no expansion after cutoff", () => {
  const result = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 1 }),
    multiVarSearchSpec()
  );
  assert.equal(result.nodesVisited, 1);
  assert.equal(result.emittedCount, 0);
  assert.equal(result.nodeBudgetExhausted, true);
  assert.equal(result.searchComplete, false);
  assert.equal(result.candidateBatch.candidates.length, 0);
});

test("B02: exact DFS order of complete candidates", () => {
  const result = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 100 }),
    multiVarSearchSpec()
  );
  const ids = result.candidateBatch.candidates.map((c) => c.candidateId);
  const expected = [
    [
      { variableId: "var-a", valueId: "x" },
      { variableId: "var-b", valueId: "1" },
    ],
    [
      { variableId: "var-a", valueId: "x" },
      { variableId: "var-b", valueId: "2" },
    ],
    [
      { variableId: "var-a", valueId: "y" },
      { variableId: "var-b", valueId: "1" },
    ],
    [
      { variableId: "var-a", valueId: "y" },
      { variableId: "var-b", valueId: "2" },
    ],
  ].map(assignmentId);
  assert.deepEqual(ids, expected);
  assert.equal(result.searchComplete, true);
  assert.equal(result.nodeBudgetExhausted, false);
  // tree: root + 2 partial(A) + 4 complete = 7
  assert.equal(result.nodesVisited, 7);
});

test("B03: cutoff at maxNodes=3 emits first complete only", () => {
  const result = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 3 }),
    multiVarSearchSpec()
  );
  assert.equal(result.nodesVisited, 3);
  assert.equal(result.emittedCount, 1);
  assert.equal(result.nodeBudgetExhausted, true);
  assert.equal(result.searchComplete, false);
  assert.equal(
    result.candidateBatch.candidates[0].candidateId,
    assignmentId([
      { variableId: "var-a", valueId: "x" },
      { variableId: "var-b", valueId: "1" },
    ])
  );
});

test("B04: complete candidates only; candidate ID parity with Phase 1J", () => {
  const request = multiVarRequest({ maxNodes: 100 });
  const search = searchDeterministicCandidates(request, multiVarSearchSpec());
  const generated = generateCandidateBatch(
    request,
    createDeterministicCandidateGenerationSpec({
      variables: [
        { variableId: "var-b", valueIds: ["2", "1"] },
        { variableId: "var-a", valueIds: ["y", "x"] },
      ],
      maxGeneratedCandidates: 100,
    })
  );
  assert.deepEqual(
    search.candidateBatch.candidates.map((c) => c.candidateId).sort(),
    generated.candidates.map((c) => c.candidateId).sort()
  );
  for (const c of search.candidateBatch.candidates) {
    assert.equal(c.assignments.length, 2);
  }
});

test("B05: zero complete candidates inside small bound; full completion; emit exhaustion", () => {
  const zero = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 2 }),
    multiVarSearchSpec()
  );
  assert.equal(zero.emittedCount, 0);
  assert.equal(zero.nodeBudgetExhausted, true);
  assert.notEqual(zero.candidateBatch.candidates.length, undefined);

  const full = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 7 }),
    multiVarSearchSpec()
  );
  assert.equal(full.searchComplete, true);
  assert.equal(full.emittedCount, 4);

  const emitStop = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 100 }),
    multiVarSearchSpec({ maxEmittedCandidates: 1 })
  );
  assert.equal(emitStop.emittedCount, 1);
  assert.equal(emitStop.emittedCandidateBudgetExhausted, true);
  assert.equal(emitStop.searchComplete, false);
  assert.equal(emitStop.nodeBudgetExhausted, false);
});

test("B05b: 2×2 exact-final emit, one-less emit, over-budget emit, and maxNodes boundaries", () => {
  // Canonical 2×2 tree: root + 2 partial + 4 complete = 7 nodes; 4 complete candidates.
  const expectedIds = [
    [
      { variableId: "var-a", valueId: "x" },
      { variableId: "var-b", valueId: "1" },
    ],
    [
      { variableId: "var-a", valueId: "x" },
      { variableId: "var-b", valueId: "2" },
    ],
    [
      { variableId: "var-a", valueId: "y" },
      { variableId: "var-b", valueId: "1" },
    ],
    [
      { variableId: "var-a", valueId: "y" },
      { variableId: "var-b", valueId: "2" },
    ],
  ].map(assignmentId);

  // A. maxEmittedCandidates = 4 (exact total) — not exhaustion
  const exactEmit = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 100 }),
    multiVarSearchSpec({ maxEmittedCandidates: 4 })
  );
  assert.equal(exactEmit.emittedCount, 4);
  assert.equal(exactEmit.candidateBatch.candidates.length, 4);
  assert.equal(exactEmit.emittedCandidateBudgetExhausted, false);
  assert.equal(exactEmit.nodeBudgetExhausted, false);
  assert.equal(exactEmit.searchComplete, true);
  assert.deepEqual(
    exactEmit.candidateBatch.candidates.map((c) => c.candidateId),
    expectedIds
  );
  const exactCertified = optimizeDeterministicBoundedSearch(
    multiVarRequest({ maxNodes: 100 }),
    multiVarSearchSpec({ maxEmittedCandidates: 4 }),
    baseEnvelope(),
    makeDeps()
  );
  assert.equal(exactCertified.status, OPTIMIZATION_STATUS.SUCCESS);

  // B. maxEmittedCandidates = 3 (one less) — exhaustion
  const oneLess = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 100 }),
    multiVarSearchSpec({ maxEmittedCandidates: 3 })
  );
  assert.equal(oneLess.emittedCount, 3);
  assert.equal(oneLess.candidateBatch.candidates.length, 3);
  assert.equal(oneLess.emittedCandidateBudgetExhausted, true);
  assert.equal(oneLess.searchComplete, false);
  assert.deepEqual(
    oneLess.candidateBatch.candidates.map((c) => c.candidateId),
    expectedIds.slice(0, 3)
  );
  const oneLessCertified = optimizeDeterministicBoundedSearch(
    multiVarRequest({ maxNodes: 100 }),
    multiVarSearchSpec({ maxEmittedCandidates: 3 }),
    baseEnvelope(),
    makeDeps()
  );
  assert.equal(oneLessCertified.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);

  // C. maxEmittedCandidates > 4
  const overEmit = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 100 }),
    multiVarSearchSpec({ maxEmittedCandidates: 5 })
  );
  assert.equal(overEmit.emittedCandidateBudgetExhausted, false);
  assert.equal(overEmit.searchComplete, true);
  assert.deepEqual(
    overEmit.candidateBatch.candidates.map((c) => c.candidateId),
    expectedIds
  );

  // D. maxNodes = 6 (fullTree−1) — node exhaustion; 3 complete emitted
  const nodesShort = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 6 }),
    multiVarSearchSpec()
  );
  assert.equal(nodesShort.nodesVisited, 6);
  assert.equal(nodesShort.nodeBudgetExhausted, true);
  assert.equal(nodesShort.searchComplete, false);
  assert.equal(nodesShort.emittedCount, 3);

  // E. maxNodes = 7 (exact full tree) — not node exhaustion
  const nodesExact = searchDeterministicCandidates(
    multiVarRequest({ maxNodes: 7 }),
    multiVarSearchSpec()
  );
  assert.equal(nodesExact.nodesVisited, 7);
  assert.equal(nodesExact.nodeBudgetExhausted, false);
  assert.equal(nodesExact.searchComplete, true);
  assert.equal(nodesExact.emittedCount, 4);
  assert.deepEqual(
    nodesExact.candidateBatch.candidates.map((c) => c.candidateId),
    expectedIds
  );
});

test("B06: maxNodes independence from maxCandidates/maxEvaluations/maxGeneratedCandidates", () => {
  const result = searchDeterministicCandidates(
    multiVarRequest({
      maxNodes: 3,
      maxCandidates: 1,
      maxEvaluations: 1,
    }),
    multiVarSearchSpec({ maxEmittedCandidates: 100 })
  );
  assert.equal(result.emittedCount, 1);
  assert.equal(result.nodesVisited, 3);
  const src = readDirSources(SEARCH_DIR);
  assert.match(src, /maxNodes/);
  assert.equal(src.includes("maxGeneratedCandidates"), false);
});

test("B07: null maxNodes fails closed; no evaluation/ranking/pruning/random/Date/localeCompare/env", () => {
  assertThrowsCode(
    () =>
      searchDeterministicCandidates(
        baseRequest({
          deterministicBudget: { maxCandidates: 10, maxNodes: null },
        }),
        baseSearchSpec()
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  const src = readDirSources(SEARCH_DIR);
  for (const forbidden of [
    "evaluateCandidateSolution",
    "rankCandidateEvaluations",
    "Math.random",
    "Date.now",
    "new Date",
    "localeCompare",
    "process.env",
    "setTimeout",
    "async function",
    "ReadableStream",
    "Worker",
  ]) {
    assert.equal(src.includes(forbidden), false, forbidden);
  }
});

test("B08: sourceContext exclusion on bounded candidate source", () => {
  const source = createDeterministicBoundedCandidateSource(baseSearchSpec());
  assert.ok(isCandidateSourcePort(source));
  assert.equal(source.portVersion, CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1);
  const batch = source.produce(baseRequest({ deterministicBudget: { maxNodes: 100 } }), {
    poisoned: true,
  });
  assert.equal(batch.candidates.length, 2);
  assert.equal(batch.objectiveExecutionSpecs.length, 0);
});

// ---------------------------------------------------------------------------
// Certified optimization
// ---------------------------------------------------------------------------

test("C01: envelope applied; supplied optimizer reused; SUCCESS on full search", () => {
  const result = optimizeDeterministicBoundedSearch(
    baseRequest({ deterministicBudget: { maxNodes: 100 } }),
    baseSearchSpec(),
    baseEnvelope(),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.ok(result.selectedCandidateId);
  assert.equal(result.diagnostics.budgetExhausted, false);
  assert.ok(result.diagnostics.budgetUsage.nodes >= 1);
});

test("C02: BUDGET_EXHAUSTED on node exhaustion; no new status; zero emit not INFEASIBLE", () => {
  const result = optimizeDeterministicBoundedSearch(
    multiVarRequest({ maxNodes: 2 }),
    multiVarSearchSpec(),
    baseEnvelope(),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(result.failure.code, OPTIMIZATION_FAILURE_CODE.BUDGET_EXHAUSTED);
  assert.equal(result.failure.details.nodeBudgetExhausted, true);
  assert.equal(result.failure.details.emittedCount, 0);
  assert.notEqual(result.status, OPTIMIZATION_STATUS.INFEASIBLE);
});

test("C03: BUDGET_EXHAUSTED on emitted limit exhaustion; diagnostics include search data", () => {
  const result = optimizeDeterministicBoundedSearch(
    multiVarRequest({ maxNodes: 100 }),
    multiVarSearchSpec({ maxEmittedCandidates: 1 }),
    baseEnvelope(),
    makeDeps()
  );
  assert.equal(result.status, OPTIMIZATION_STATUS.BUDGET_EXHAUSTED);
  assert.equal(result.failure.details.emittedCandidateBudgetExhausted, true);
  assert.equal(result.diagnostics.budgetExhausted, true);
  assert.equal(result.diagnostics.budgetUsage.nodes, result.failure.details.nodesVisited);
  assert.ok(result.selectedCandidateId);
  assert.equal(result.rankedCandidateIds.length, 1);
});

test("C04: candidate/result determinism and replay identity distinction", () => {
  const args = [
    multiVarRequest({ maxNodes: 100 }),
    multiVarSearchSpec(),
    baseEnvelope(),
    makeDeps(),
  ];
  const a = optimizeDeterministicBoundedSearch(...args);
  const b = optimizeDeterministicBoundedSearch(...args);
  assert.equal(a.resultFingerprint, b.resultFingerprint);
  assert.deepEqual([...a.rankedCandidateIds], [...b.rankedCandidateIds]);

  const truncated = optimizeDeterministicBoundedSearch(
    multiVarRequest({ maxNodes: 3 }),
    multiVarSearchSpec(),
    baseEnvelope(),
    makeDeps()
  );
  assert.notEqual(a.resultFingerprint, truncated.resultFingerprint);

  const suppliedOnly = optimizeSuppliedCandidates(
    multiVarRequest({ maxNodes: 100 }),
    applyCandidateEvaluationEnvelope(
      searchDeterministicCandidates(
        multiVarRequest({ maxNodes: 100 }),
        multiVarSearchSpec()
      ).candidateBatch,
      baseEnvelope()
    ),
    makeDeps()
  );
  assert.notEqual(a.resultFingerprint, suppliedOnly.resultFingerprint);
});

test("C05: direct/source/search structural parity where applicable", () => {
  const request = baseRequest({ deterministicBudget: { maxNodes: 100 } });
  const spec = baseSearchSpec();
  const direct = searchDeterministicCandidates(request, spec);
  const source = createDeterministicBoundedCandidateSource(spec);
  const viaSource = source.produce(request);
  assert.deepEqual(
    direct.candidateBatch.candidates.map((c) => c.candidateId),
    viaSource.candidates.map((c) => c.candidateId)
  );
});

// ---------------------------------------------------------------------------
// Exports and scope
// ---------------------------------------------------------------------------

test("X01: optimizer/index.js exports exact intended public APIs", () => {
  for (const key of [
    "createCandidateEvaluationEnvelope",
    "applyCandidateEvaluationEnvelope",
    "assertCandidateEvaluationEnvelopeCompatible",
    "createDeterministicBoundedSearchSpec",
    "searchDeterministicCandidates",
    "createDeterministicBoundedCandidateSource",
    "optimizeDeterministicBoundedSearch",
    "CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1",
    "CORE10_DETERMINISTIC_BOUNDED_SEARCH_V1",
    "CORE10_DETERMINISTIC_BOUNDED_SEARCH_STRATEGY_DFS_V1",
  ]) {
    assert.equal(key in OptimizerPublic, true, key);
  }
  assert.equal("walkDeterministicDfs" in OptimizerPublic, false);
  assert.equal(
    EnrichmentPublic.createCandidateEvaluationEnvelope,
    OptimizerPublic.createCandidateEvaluationEnvelope
  );
  assert.equal(
    SearchPublic.optimizeDeterministicBoundedSearch,
    OptimizerPublic.optimizeDeterministicBoundedSearch
  );
});

test("X02: root competition-core barrel unchanged; no forbidden imports", () => {
  assert.ok(existsSync(ROOT_BARREL));
  const rootSrc = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(rootSrc.includes("enrichment"), false);
  assert.equal(rootSrc.includes("bounded"), false);
  assert.equal(rootSrc.includes("CORE10_DETERMINISTIC_BOUNDED_SEARCH"), false);

  const combined = `${readDirSources(ENRICH_DIR)}\n${readDirSources(SEARCH_DIR)}`;
  for (const forbidden of [
    "features/competition-core/constraints/",
    "features/scheduling",
    "features/match-generation",
    "supabase",
    "package.json",
  ]) {
    assert.equal(combined.includes(forbidden), false, forbidden);
  }
});

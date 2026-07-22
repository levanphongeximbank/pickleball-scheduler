/**
 * CORE-10 Phase 1J — Deterministic Candidate Generator.
 *
 * Run: node --test tests/competition-core-optimizer-core10-phase1j.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as OptimizerPublic from "../src/features/competition-core/optimizer/index.js";
import * as GenerationPublic from "../src/features/competition-core/optimizer/generation/index.js";

import {
  OPTIMIZATION_FAILURE_CODE,
  OPTIMIZATION_OPERATION,
  OPTIMIZATION_STATUS,
  SOLVER_STRATEGY,
  OBJECTIVE_SENSE,
  CORE10_SCHEMA_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1,
  CORE10_IDENTITY,
  CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
  OptimizerContractError,
  createDeterministicCandidateGenerationSpec,
  generateCandidateBatch,
  createDeterministicCandidateSource,
  createObjectiveDefinition,
  createObjectiveRegistry,
  createConstraintEvaluationPort,
  isCandidateSourcePort,
  optimizeSuppliedCandidates,
  optimizeCandidateSource,
  fingerprintValue,
  serializeCanonical,
} from "../src/features/competition-core/optimizer/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const GEN_DIR = path.join(OPT_ROOT, "generation");
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
    deterministicBudget: { maxCandidates: 100, maxEvaluations: 1000 },
    strategy: SOLVER_STRATEGY.CONTRACT_ONLY,
    ...overrides,
  };
}

function baseSpec(overrides = {}) {
  return {
    variables: [
      {
        variableId: "var-a",
        valueIds: ["x", "y"],
      },
    ],
    maxGeneratedCandidates: 100,
    ...overrides,
  };
}

function multiVarRequest() {
  return baseRequest({
    decisionVariables: [
      { variableId: "var-b", domain: ["2", "1"], required: true },
      { variableId: "var-a", domain: ["y", "x"], required: true },
    ],
  });
}

function multiVarSpec() {
  return {
    variables: [
      { variableId: "var-b", valueIds: ["2", "1"] },
      { variableId: "var-a", valueIds: ["y", "x"] },
    ],
    maxGeneratedCandidates: 100,
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

function readGenerationSources() {
  const files = readdirSync(GEN_DIR).filter((f) => f.endsWith(".js"));
  return files
    .map((f) => readFileSync(path.join(GEN_DIR, f), "utf8"))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Spec creation / canonicalization / isolation
// ---------------------------------------------------------------------------

test("T01: valid Generation Spec creation", () => {
  const spec = createDeterministicCandidateGenerationSpec(baseSpec());
  assert.equal(spec.variables.length, 1);
  assert.equal(spec.variables[0].variableId, "var-a");
  assert.deepEqual([...spec.variables[0].valueIds], ["x", "y"]);
  assert.equal(spec.maxGeneratedCandidates, 100);
});

test("T02: Spec deep freeze", () => {
  const spec = createDeterministicCandidateGenerationSpec(baseSpec());
  assert.ok(Object.isFrozen(spec));
  assert.ok(Object.isFrozen(spec.variables));
  assert.ok(Object.isFrozen(spec.variables[0]));
  assert.ok(Object.isFrozen(spec.variables[0].valueIds));
  assert.throws(() => {
    /** @type {{ maxGeneratedCandidates: number }} */ (spec).maxGeneratedCandidates = 1;
  });
});

test("T03: caller Spec mutation isolation", () => {
  const raw = baseSpec();
  const spec = createDeterministicCandidateGenerationSpec(raw);
  raw.variables[0].valueIds.push("z");
  raw.variables.push({ variableId: "var-extra", valueIds: ["q"] });
  raw.maxGeneratedCandidates = 1;
  assert.equal(spec.variables.length, 1);
  assert.deepEqual([...spec.variables[0].valueIds], ["x", "y"]);
  assert.equal(spec.maxGeneratedCandidates, 100);
});

test("T04: variable canonicalization by variableId", () => {
  const spec = createDeterministicCandidateGenerationSpec({
    variables: [
      { variableId: "var-b", valueIds: ["1"] },
      { variableId: "var-a", valueIds: ["x"] },
    ],
    maxGeneratedCandidates: 10,
  });
  assert.deepEqual(
    spec.variables.map((v) => v.variableId),
    ["var-a", "var-b"]
  );
});

test("T05: valueId canonicalization within each variable", () => {
  const spec = createDeterministicCandidateGenerationSpec({
    variables: [{ variableId: "var-a", valueIds: ["y", "x"] }],
    maxGeneratedCandidates: 10,
  });
  assert.deepEqual([...spec.variables[0].valueIds], ["x", "y"]);
});

test("T06: thenable Spec rejection", () => {
  const thenable = {
    then() {},
    variables: baseSpec().variables,
    maxGeneratedCandidates: 10,
  };
  assertThrowsCode(
    () => createDeterministicCandidateGenerationSpec(thenable),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T07: zero variables rejection", () => {
  assertThrowsCode(
    () =>
      createDeterministicCandidateGenerationSpec({
        variables: [],
        maxGeneratedCandidates: 10,
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T08: duplicate variableId rejection", () => {
  assertThrowsCode(
    () =>
      createDeterministicCandidateGenerationSpec({
        variables: [
          { variableId: "var-a", valueIds: ["x"] },
          { variableId: "var-a", valueIds: ["y"] },
        ],
        maxGeneratedCandidates: 10,
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T09: empty valueIds rejection", () => {
  assertThrowsCode(
    () =>
      createDeterministicCandidateGenerationSpec({
        variables: [{ variableId: "var-a", valueIds: [] }],
        maxGeneratedCandidates: 10,
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T10: duplicate valueId rejection", () => {
  assertThrowsCode(
    () =>
      createDeterministicCandidateGenerationSpec({
        variables: [{ variableId: "var-a", valueIds: ["x", "x"] }],
        maxGeneratedCandidates: 10,
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T11: non-string valueId rejection", () => {
  assertThrowsCode(
    () =>
      createDeterministicCandidateGenerationSpec({
        variables: [{ variableId: "var-a", valueIds: ["x", 1] }],
        maxGeneratedCandidates: 10,
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T12: invalid maxGeneratedCandidates rejection", () => {
  for (const bad of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assertThrowsCode(
      () =>
        createDeterministicCandidateGenerationSpec({
          variables: [{ variableId: "var-a", valueIds: ["x"] }],
          maxGeneratedCandidates: bad,
        }),
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    );
  }
});

// ---------------------------------------------------------------------------
// Generation behavior
// ---------------------------------------------------------------------------

test("T13: single-variable generation", () => {
  const batch = generateCandidateBatch(baseRequest(), baseSpec());
  assert.equal(batch.candidates.length, 2);
  const valueIds = batch.candidates.map((c) => c.assignments[0].valueId).sort();
  assert.deepEqual(valueIds, ["x", "y"]);
});

test("T14: multi-variable Cartesian cardinality", () => {
  const batch = generateCandidateBatch(multiVarRequest(), multiVarSpec());
  assert.equal(batch.candidates.length, 4);
});

test("T15: full assignment completeness", () => {
  const batch = generateCandidateBatch(multiVarRequest(), multiVarSpec());
  for (const candidate of batch.candidates) {
    assert.equal(candidate.assignments.length, 2);
    const ids = candidate.assignments.map((a) => a.variableId);
    assert.deepEqual(ids, ["var-a", "var-b"]);
  }
  const keys = new Set(
    batch.candidates.map((c) =>
      c.assignments.map((a) => `${a.variableId}=${a.valueId}`).join("|")
    )
  );
  assert.deepEqual(
    [...keys].sort(),
    [
      "var-a=x|var-b=1",
      "var-a=x|var-b=2",
      "var-a=y|var-b=1",
      "var-a=y|var-b=2",
    ]
  );
});

test("T16: deterministic repeated output", () => {
  const a = generateCandidateBatch(multiVarRequest(), multiVarSpec());
  const b = generateCandidateBatch(multiVarRequest(), multiVarSpec());
  assert.equal(serializeCanonical(a.candidates), serializeCanonical(b.candidates));
});

test("T17: variable-order independence", () => {
  const requestA = baseRequest({
    decisionVariables: [
      { variableId: "var-a", domain: ["x", "y"], required: true },
      { variableId: "var-b", domain: ["1", "2"], required: true },
    ],
  });
  const requestB = baseRequest({
    decisionVariables: [
      { variableId: "var-b", domain: ["1", "2"], required: true },
      { variableId: "var-a", domain: ["x", "y"], required: true },
    ],
  });
  const specA = {
    variables: [
      { variableId: "var-a", valueIds: ["x", "y"] },
      { variableId: "var-b", valueIds: ["1", "2"] },
    ],
    maxGeneratedCandidates: 10,
  };
  const specB = {
    variables: [
      { variableId: "var-b", valueIds: ["1", "2"] },
      { variableId: "var-a", valueIds: ["x", "y"] },
    ],
    maxGeneratedCandidates: 10,
  };
  const batchA = generateCandidateBatch(requestA, specA);
  const batchB = generateCandidateBatch(requestB, specB);
  assert.equal(
    serializeCanonical(batchA.candidates),
    serializeCanonical(batchB.candidates)
  );
});

test("T18: value-order independence", () => {
  const batchA = generateCandidateBatch(baseRequest(), {
    variables: [{ variableId: "var-a", valueIds: ["x", "y"] }],
    maxGeneratedCandidates: 10,
  });
  const batchB = generateCandidateBatch(baseRequest(), {
    variables: [{ variableId: "var-a", valueIds: ["y", "x"] }],
    maxGeneratedCandidates: 10,
  });
  assert.equal(
    serializeCanonical(batchA.candidates),
    serializeCanonical(batchB.candidates)
  );
});

test("T19: stable candidate IDs from assignment fingerprint", () => {
  const batch = generateCandidateBatch(baseRequest(), baseSpec());
  for (const candidate of batch.candidates) {
    const expected = `cand-${fingerprintValue({
      assignments: candidate.assignments.map((a) => ({
        variableId: a.variableId,
        valueId: a.valueId,
      })),
    })}`;
    assert.equal(candidate.candidateId, expected);
    assert.equal(candidate.candidateId.startsWith("cand-"), true);
  }
});

test("T20: assignment-order stability within each candidate", () => {
  const batch = generateCandidateBatch(multiVarRequest(), multiVarSpec());
  for (const candidate of batch.candidates) {
    const ids = candidate.assignments.map((a) => a.variableId);
    assert.deepEqual(ids, ["var-a", "var-b"]);
  }
});

test("T21: no duplicate candidate IDs", () => {
  const batch = generateCandidateBatch(multiVarRequest(), multiVarSpec());
  const ids = batch.candidates.map((c) => c.candidateId);
  assert.equal(new Set(ids).size, ids.length);
});

// ---------------------------------------------------------------------------
// Request / Spec compatibility
// ---------------------------------------------------------------------------

test("T22: request/spec missing-variable rejection", () => {
  assertThrowsCode(
    () =>
      generateCandidateBatch(
        baseRequest({
          decisionVariables: [
            { variableId: "var-a", domain: ["x"], required: true },
            { variableId: "var-b", domain: ["1"], required: true },
          ],
        }),
        {
          variables: [{ variableId: "var-a", valueIds: ["x"] }],
          maxGeneratedCandidates: 10,
        }
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T23: request/spec extra-variable rejection", () => {
  assertThrowsCode(
    () =>
      generateCandidateBatch(baseRequest(), {
        variables: [
          { variableId: "var-a", valueIds: ["x"] },
          { variableId: "var-extra", valueIds: ["z"] },
        ],
        maxGeneratedCandidates: 10,
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T24: request/spec illegal-value rejection", () => {
  assertThrowsCode(
    () =>
      generateCandidateBatch(baseRequest(), {
        variables: [{ variableId: "var-a", valueIds: ["x", "z"] }],
        maxGeneratedCandidates: 10,
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T25: non-string request-domain incompatibility", () => {
  assertThrowsCode(
    () =>
      generateCandidateBatch(
        baseRequest({
          decisionVariables: [
            { variableId: "var-a", domain: [1, 2, true, null], required: true },
          ],
        }),
        {
          variables: [{ variableId: "var-a", valueIds: ["1"] }],
          maxGeneratedCandidates: 10,
        }
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

// ---------------------------------------------------------------------------
// Cardinality / budget non-ownership
// ---------------------------------------------------------------------------

test("T26: cardinality exactly at cap succeeds", () => {
  const batch = generateCandidateBatch(multiVarRequest(), {
    ...multiVarSpec(),
    maxGeneratedCandidates: 4,
  });
  assert.equal(batch.candidates.length, 4);
});

test("T27: cardinality above cap throws", () => {
  assertThrowsCode(
    () =>
      generateCandidateBatch(multiVarRequest(), {
        ...multiVarSpec(),
        maxGeneratedCandidates: 3,
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
    (err) => {
      assert.equal(err.details?.reason, "GENERATION_LIMIT_EXCEEDED");
    }
  );
});

test("T28: unsafe cardinality throws before materialization", () => {
  const domain = Array.from({ length: 100 }, (_, i) => `v${String(i).padStart(3, "0")}`);
  const decisionVariables = Array.from({ length: 10 }, (_, i) => ({
    variableId: `var-${String(i).padStart(2, "0")}`,
    domain,
    required: true,
  }));
  const variables = decisionVariables.map((dv) => ({
    variableId: dv.variableId,
    valueIds: domain,
  }));
  assertThrowsCode(
    () =>
      generateCandidateBatch(
        baseRequest({ decisionVariables }),
        {
          variables,
          maxGeneratedCandidates: Number.MAX_SAFE_INTEGER,
        }
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
    (err) => {
      assert.equal(err.details?.reason, "GENERATION_LIMIT_EXCEEDED");
    }
  );
});

test("T29: maxCandidates not used by generator", () => {
  const batch = generateCandidateBatch(
    baseRequest({
      deterministicBudget: { maxCandidates: 1, maxEvaluations: 1000 },
    }),
    baseSpec({ maxGeneratedCandidates: 10 })
  );
  assert.equal(batch.candidates.length, 2);
});

test("T30: maxEvaluations not used by generator", () => {
  const batch = generateCandidateBatch(
    baseRequest({
      deterministicBudget: { maxCandidates: 100, maxEvaluations: 1 },
    }),
    baseSpec({ maxGeneratedCandidates: 10 })
  );
  assert.equal(batch.candidates.length, 2);
});

test("T31: maxNodes not used by generator", () => {
  const batch = generateCandidateBatch(
    baseRequest({
      deterministicBudget: {
        maxCandidates: 100,
        maxEvaluations: 1000,
        maxNodes: 1,
      },
    }),
    baseSpec({ maxGeneratedCandidates: 10 })
  );
  assert.equal(batch.candidates.length, 2);
});

// ---------------------------------------------------------------------------
// Hygiene / mutability
// ---------------------------------------------------------------------------

test("T32: no Math.random in generation sources", () => {
  const src = readGenerationSources();
  assert.equal(src.includes("Math.random"), false);
});

test("T33: no Date/timers in generation sources", () => {
  const src = readGenerationSources();
  assert.equal(src.includes("Date.now"), false);
  assert.equal(src.includes("Date("), false);
  assert.equal(src.includes("setTimeout"), false);
  assert.equal(src.includes("setInterval"), false);
  assert.equal(src.includes("localeCompare"), false);
});

test("T34: generateCandidateBatch output frozen", () => {
  const batch = generateCandidateBatch(baseRequest(), baseSpec());
  assert.ok(Object.isFrozen(batch));
  assert.ok(Object.isFrozen(batch.candidates));
  assert.ok(Object.isFrozen(batch.candidates[0]));
  assert.ok(Object.isFrozen(batch.candidates[0].assignments));
});

test("T35: request not mutated", () => {
  const request = baseRequest();
  const snapshot = serializeCanonical(request);
  generateCandidateBatch(request, baseSpec());
  assert.equal(serializeCanonical(request), snapshot);
});

test("T36: sourceContext not read or mutated", () => {
  const source = createDeterministicCandidateSource({
    portId: "det-source-1",
    spec: baseSpec(),
  });
  let mutated = false;
  const sourceContext = new Proxy(
    { marker: "context" },
    {
      get(target, prop) {
        if (prop === "then") return undefined;
        throw new Error(`sourceContext must not be read: ${String(prop)}`);
      },
      set() {
        mutated = true;
        return false;
      },
    }
  );
  const batch = source.produce(baseRequest(), sourceContext);
  assert.equal(batch.candidates.length, 2);
  assert.equal(mutated, false);
});

// ---------------------------------------------------------------------------
// Source factory / orchestration integration
// ---------------------------------------------------------------------------

test("T37: source factory returns valid CandidateSourcePort", () => {
  const source = createDeterministicCandidateSource({
    portId: "det-source-1",
    spec: baseSpec(),
  });
  assert.equal(isCandidateSourcePort(source), true);
  assert.equal(source.portId, "det-source-1");
  assert.equal(source.portVersion, CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1);
});

test("T38: source produce is synchronous", () => {
  const source = createDeterministicCandidateSource({
    portId: "det-source-1",
    spec: baseSpec(),
  });
  const result = source.produce(baseRequest());
  assert.equal(typeof result.then, "undefined");
  assert.equal(result.candidates.length, 2);
});

test("T39: optimizeCandidateSource integration", () => {
  const request = baseRequest();
  const source = createDeterministicCandidateSource({
    portId: "det-source-1",
    spec: baseSpec(),
  });
  const result = optimizeCandidateSource(request, source, makeDeps());
  assert.equal(result.status, OPTIMIZATION_STATUS.SUCCESS);
  assert.ok(result.selectedCandidateId);
  assert.equal(result.rankedCandidateIds.length, 2);
});

test("T40: direct/source-backed fingerprint parity", () => {
  const request = baseRequest();
  const spec = baseSpec();
  const batch = generateCandidateBatch(request, spec);
  const direct = optimizeSuppliedCandidates(request, batch, makeDeps());
  const source = createDeterministicCandidateSource({
    portId: "det-source-parity",
    spec,
  });
  const viaSource = optimizeCandidateSource(request, source, makeDeps());
  assert.equal(direct.resultFingerprint, viaSource.resultFingerprint);
  assert.equal(direct.status, viaSource.status);
  assert.equal(direct.selectedCandidateId, viaSource.selectedCandidateId);
  assert.ok(
    String(direct.diagnostics?.budgetUsage?.orchestrationVersion || "").includes(
      "V2"
    ) ||
      direct.resultFingerprint.length > 0
  );
  assert.equal(
    CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2,
    "CORE10_SUPPLIED_CANDIDATE_OPTIMIZATION_V2"
  );
});

test("T41: generator version not bound into candidateId", () => {
  const batch = generateCandidateBatch(baseRequest(), baseSpec());
  for (const candidate of batch.candidates) {
    assert.equal(
      candidate.candidateId.includes(CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1),
      false
    );
  }
});

test("T42: source version not bound into result fingerprint", () => {
  const request = baseRequest();
  const spec = baseSpec();
  const a = createDeterministicCandidateSource({
    portId: "det-a",
    portVersion: CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1,
    spec,
  });
  const b = createDeterministicCandidateSource({
    portId: "det-b",
    portVersion: "CUSTOM_PORT_VERSION_V1",
    spec,
  });
  const resultA = optimizeCandidateSource(request, a, makeDeps());
  const resultB = optimizeCandidateSource(request, b, makeDeps());
  assert.equal(resultA.resultFingerprint, resultB.resultFingerprint);
});

// ---------------------------------------------------------------------------
// Exports / barrels / sibling isolation
// ---------------------------------------------------------------------------

test("T43: exports exact from generation and optimizer barrels", () => {
  assert.equal(
    GenerationPublic.createDeterministicCandidateGenerationSpec,
    createDeterministicCandidateGenerationSpec
  );
  assert.equal(GenerationPublic.generateCandidateBatch, generateCandidateBatch);
  assert.equal(
    GenerationPublic.createDeterministicCandidateSource,
    createDeterministicCandidateSource
  );
  assert.equal(
    OptimizerPublic.createDeterministicCandidateGenerationSpec,
    createDeterministicCandidateGenerationSpec
  );
  assert.equal(OptimizerPublic.generateCandidateBatch, generateCandidateBatch);
  assert.equal(
    OptimizerPublic.createDeterministicCandidateSource,
    createDeterministicCandidateSource
  );
  assert.equal(
    OptimizerPublic.CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1,
    CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1
  );
  assert.equal(
    CORE10_IDENTITY.deterministicCandidateGeneratorV1,
    CORE10_DETERMINISTIC_CANDIDATE_GENERATOR_V1
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      GenerationPublic,
      "optimizeCandidateSource"
    ),
    false
  );
});

test("T44: root competition-core barrel unchanged", () => {
  assert.equal(existsSync(ROOT_BARREL), true);
  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(root.includes("generateCandidateBatch"), false);
  assert.equal(root.includes("createDeterministicCandidateSource"), false);
  assert.equal(root.includes("CORE10_DETERMINISTIC_CANDIDATE_GENERATOR"), false);
});

test("T45: no sibling CORE imports in generation sources", () => {
  const src = readGenerationSources();
  assert.equal(src.includes("competition-core/constraints/"), false);
  assert.equal(src.includes("competition-core/scheduling/"), false);
  assert.equal(src.includes("competition-core/match-generation/"), false);
  assert.equal(src.includes("competition-core/seeding/"), false);
  assert.equal(/from ["'][^"']*\/core-0[1-9]/.test(src), false);
  assert.equal(/from ["'][^"']*\/core-1[1-4]/.test(src), false);
  assert.equal(/features\/competition-core\/(?!optimizer)/.test(src), false);
});

test("T46: post-construction Spec mutation cannot alter closed source output", () => {
  const rawSpec = baseSpec();
  const source = createDeterministicCandidateSource({
    portId: "det-closed",
    spec: rawSpec,
  });
  rawSpec.variables[0].valueIds.push("z");
  rawSpec.maxGeneratedCandidates = 1;
  const batch = source.produce(baseRequest());
  assert.equal(batch.candidates.length, 2);
});

test("T47: generated batch omits context (request fallback preserved)", () => {
  const batch = generateCandidateBatch(baseRequest(), baseSpec());
  assert.equal(Object.prototype.hasOwnProperty.call(batch, "context"), false);
  assert.deepEqual([...batch.objectiveExecutionSpecs], []);
  assert.deepEqual([...batch.authorityValues], []);
});

test("T48: thenable request rejected by generateCandidateBatch", () => {
  const thenable = { then() {}, ...baseRequest() };
  assertThrowsCode(
    () => generateCandidateBatch(thenable, baseSpec()),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

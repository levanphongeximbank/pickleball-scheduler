/**
 * CORE-10 Phase 1C-B2-B — evaluateCandidateSolution orchestration.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as OptimizerPublic from "../src/features/competition-core/optimizer/index.js";

import {
  OPTIMIZATION_OPERATION,
  SOLVER_STRATEGY,
  CONSTRAINT_KIND,
  OBJECTIVE_SENSE,
  OBJECTIVE_EVALUATION_FAILURE_CODE,
  CANDIDATE_EVALUATION_STATUS,
  CANDIDATE_EVALUATION_FAILURE_CODE,
  CORE10_SCHEMA_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION,
  CORE10_HARD_VIOLATION_COMPOSITION_VERSION,
  CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  OptimizerContractError,
  createObjectiveRegistry,
  createObjectiveDefinition,
  createConstraintEvaluationPort,
  createCandidateEvaluationDependencies,
  createCandidateEvaluationFailure,
  createCandidateEvaluationResult,
  evaluateCandidateSolution,
  serializeCanonical,
} from "../src/features/competition-core/optimizer/index.js";

import { CANDIDATE_EVALUATION_FAILURE_STAGE } from "../src/features/competition-core/optimizer/contracts/candidateEvaluationFailure.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");
const ORCH_FILE = path.join(
  OPT_ROOT,
  "evaluation",
  "evaluateCandidateSolution.js"
);

function baseRequest(overrides = {}) {
  return {
    schemaVersion: CORE10_SCHEMA_VERSION,
    requestId: "req-1",
    tenantId: "tenant-1",
    competitionId: "comp-1",
    operation: { operationId: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING },
    policy: {
      policyId: "pol-1",
      policyVersion: "1",
      objectiveKeys: ["OBJ_A"],
      authorityKeys: ["AUTH_A"],
      comparatorVersion: CORE10_COMPARATOR_VERSION,
      quantizeScale: 1,
    },
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
        {
          snapshotId: "snap-2",
          snapshotVersion: "v1",
          fingerprint: "abcdef02",
          kind: "GENERIC",
        },
      ],
      metadata: {},
    },
    decisionVariables: [
      { variableId: "var-b", domain: ["b2", "b1"], required: false },
      { variableId: "var-a", domain: ["a1", "a2"], required: true },
    ],
    seed: "seed-alpha",
    deterministicBudget: { maxCandidates: 100, maxEvaluations: 1000 },
    strategy: SOLVER_STRATEGY.CONTRACT_ONLY,
    ...overrides,
  };
}

function baseCandidate(overrides = {}) {
  return {
    candidateId: "cand-1",
    operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    assignments: [
      { variableId: "var-a", valueId: "a1" },
      { variableId: "var-b", valueId: "b1" },
    ],
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  const request = baseRequest();
  return {
    schemaVersion: CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION,
    evaluationVersion: CORE10_HARD_VIOLATION_COMPOSITION_VERSION,
    request,
    context: {
      ...request.context,
      snapshotRefs: request.context.snapshotRefs.map((r) => ({ ...r })),
    },
    candidate: baseCandidate(),
    decisionVariables: request.decisionVariables.map((dv) => ({
      ...dv,
      domain: [...dv.domain],
    })),
    objectiveExecutionSpecs: [
      {
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
    ],
    authorityValues: [7],
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

function registryWith(
  entries = [
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
      }),
      evaluator: () => ({ rawValue: 3 }),
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

function deepFreezeProbe(value) {
  return Object.isFrozen(value);
}

function assertFailurePurity(result) {
  assert.equal(result.structuralViolations.length, 0);
  assert.equal(result.businessViolations.length, 0);
  assert.equal(result.allHardViolations.length, 0);
  assert.equal(result.objectiveEvaluations.length, 0);
  assert.equal(result.optimizationScore, null);
  assert.ok(result.failure);
}

function assertNoLeakage(result) {
  const json = serializeCanonical(result);
  assert.equal(json.includes("stack"), false);
  assert.equal(json.includes("Error:"), false);
  assert.equal(json.includes("at evaluate"), false);
  if (result.failure) {
    assert.equal("message" in result.failure, false);
    assert.equal(result.failure instanceof Error, false);
  }
}

// ---------------------------------------------------------------------------
// A. Happy / infeasible / invalid paths
// ---------------------------------------------------------------------------

test("A01: valid feasible candidate", () => {
  const result = evaluateCandidateSolution(baseInput(), makeDeps());
  assert.equal(result.status, CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE);
  assert.equal(result.feasible, true);
  assert.equal(result.failure, null);
  assert.equal(result.businessViolations.length, 0);
  assert.equal(result.objectiveEvaluations.length, 1);
  assert.equal(result.objectiveEvaluations[0].orientedValue, 3);
  assert.equal(result.optimizationScore.feasible, true);
  assert.equal(result.optimizationScore.candidateId, "cand-1");
  assert.equal(result.optimizationScore.authorityValues[0], 7);
  assert.equal(result.evaluationVersion, CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION);
  assert.ok(result.portDescriptor);
  assert.ok(result.inputFingerprint);
});

test("A02: valid infeasible candidate; objectives skipped; noteCodes ignored", () => {
  let objectiveCalls = 0;
  const registry = registryWith([
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
      }),
      evaluator: () => {
        objectiveCalls += 1;
        return { rawValue: 1 };
      },
    },
  ]);
  let seenFacts = null;
  let seenSnaps = null;
  const port = makePort((input) => {
    seenFacts = input.facts;
    seenSnaps = [...input.snapshotFingerprints];
    return {
      violations: [baseViolation()],
      noteCodes: ["NOTE_SHOULD_NOT_AFFECT_FEASIBILITY"],
    };
  });
  const result = evaluateCandidateSolution(
    baseInput(),
    makeDeps({ registry, port })
  );
  assert.equal(result.status, CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE);
  assert.equal(result.feasible, false);
  assert.equal(result.failure, null);
  assert.equal(result.objectiveEvaluations.length, 0);
  assert.equal(objectiveCalls, 0);
  assert.equal(result.businessViolations.length, 1);
  assert.equal(result.allHardViolations.length, 1);
  assert.equal(result.optimizationScore.feasible, false);
  assert.equal(result.optimizationScore.hardViolationCount, 1);
  assert.equal(result.optimizationScore.objectiveValues.length, 0);
  assert.equal(result.optimizationScore.authorityValues[0], 7);
  assert.deepEqual(seenSnaps, ["abcdef01", "abcdef02"]);
  assert.ok(seenFacts && typeof seenFacts === "object");
  assert.deepEqual(Object.keys(seenFacts), []);
});

test("A03: invalid candidate input; port not invoked; fingerprint null", () => {
  let portCalls = 0;
  const port = makePort(() => {
    portCalls += 1;
    return { violations: [] };
  });
  const raw = baseInput({ candidate: baseCandidate({ candidateId: "" }) });
  const frozenBefore = deepFreezeProbe(raw);
  const result = evaluateCandidateSolution(raw, makeDeps({ port }));
  assert.equal(result.status, CANDIDATE_EVALUATION_STATUS.INVALID_CANDIDATE);
  assert.equal(result.feasible, false);
  assert.equal(result.failure.stage, CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION);
  assert.equal(result.portDescriptor, null);
  assert.equal(result.inputFingerprint, null);
  assert.equal(portCalls, 0);
  assertFailurePurity(result);
  assert.equal(deepFreezeProbe(raw), frozenBefore);
  assert.equal(Object.isFrozen(raw), false);
});

test("A04: invalid dependency registry/wrapper", () => {
  let portCalls = 0;
  const port = makePort(() => {
    portCalls += 1;
    return { violations: [] };
  });
  const result = evaluateCandidateSolution(baseInput(), {
    objectiveRegistry: { resolve: () => null },
    constraintEvaluationPort: port,
  });
  assert.equal(result.status, CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED);
  assert.equal(
    result.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_DEPENDENCIES
  );
  assert.equal(
    result.failure.stage,
    CANDIDATE_EVALUATION_FAILURE_STAGE.DEPENDENCY_VALIDATION
  );
  assert.equal(result.portDescriptor, null);
  assert.equal(result.inputFingerprint, null);
  assert.equal(portCalls, 0);
  assertFailurePurity(result);
});

test("A05: missing constraint port", () => {
  const result = evaluateCandidateSolution(baseInput(), {
    objectiveRegistry: registryWith(),
  });
  assert.equal(result.status, CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED);
  assert.equal(
    result.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_UNAVAILABLE
  );
  assert.equal(
    result.failure.stage,
    CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT
  );
  assert.equal(result.portDescriptor, null);
  assert.equal(result.inputFingerprint, null);
});

test("A06: invalid constraint port", () => {
  const result = evaluateCandidateSolution(baseInput(), {
    objectiveRegistry: registryWith(),
    constraintEvaluationPort: {
      portId: "x",
      portVersion: "y",
      evaluateConstraints: () => ({ violations: [] }),
    },
  });
  assert.equal(result.status, CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED);
  assert.equal(
    result.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID
  );
  assert.equal(
    result.failure.stage,
    CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT
  );
  assert.equal(result.portDescriptor, null);
  assert.equal(result.inputFingerprint, null);
});

// ---------------------------------------------------------------------------
// B. Port invocation rules
// ---------------------------------------------------------------------------

test("B01: port invoked exactly once for valid path", () => {
  let portCalls = 0;
  const port = makePort(() => {
    portCalls += 1;
    return { violations: [] };
  });
  evaluateCandidateSolution(baseInput(), makeDeps({ port }));
  assert.equal(portCalls, 1);
});

test("B02: port not invoked for invalid dependencies", () => {
  let portCalls = 0;
  const realPort = makePort(() => {
    portCalls += 1;
    return { violations: [] };
  });
  evaluateCandidateSolution(baseInput(), {
    objectiveRegistry: null,
    constraintEvaluationPort: realPort,
  });
  assert.equal(portCalls, 0);
});

test("B03: port exception maps to EVALUATION_FAILED; descriptor+fingerprint retained", () => {
  const port = makePort(() => {
    throw new Error("boom-secret-message");
  });
  const result = evaluateCandidateSolution(baseInput(), makeDeps({ port }));
  assert.equal(result.status, CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED);
  assert.equal(
    result.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_EXCEPTION
  );
  assert.equal(
    result.failure.stage,
    CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT
  );
  assert.ok(result.portDescriptor);
  assert.ok(result.inputFingerprint);
  assertFailurePurity(result);
  assertNoLeakage(result);
  const json = serializeCanonical(result);
  assert.equal(json.includes("boom-secret-message"), false);
});

test("B04: port Promise/thenable unsupported", () => {
  const port = makePort(() => Promise.resolve({ violations: [] }));
  const result = evaluateCandidateSolution(baseInput(), makeDeps({ port }));
  assert.equal(
    result.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.ASYNC_CONSTRAINT_PORT_UNSUPPORTED
  );
  assert.equal(
    result.failure.stage,
    CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT
  );
  assert.ok(result.portDescriptor);
  assert.ok(result.inputFingerprint);
});

test("B05: invalid port-result shape", () => {
  const port = makePort(() => ({ noteCodes: [] }));
  const result = evaluateCandidateSolution(baseInput(), makeDeps({ port }));
  assert.equal(
    result.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
  );
  assert.equal(
    result.failure.stage,
    CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT
  );
});

test("B06: invalid HardViolation from port", () => {
  const port = makePort(() => ({
    violations: [{ violationCode: "X" }],
  }));
  const result = evaluateCandidateSolution(baseInput(), makeDeps({ port }));
  assert.equal(
    result.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
  );
  assertFailurePurity(result);
});

test("B07: HardViolation magnitude conflict", () => {
  const port = makePort(() => ({
    violations: [
      baseViolation({ magnitude: 1 }),
      baseViolation({ magnitude: 2 }),
    ],
  }));
  const result = evaluateCandidateSolution(baseInput(), makeDeps({ port }));
  assert.equal(
    result.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.HARD_VIOLATION_MAGNITUDE_CONFLICT
  );
  assert.equal(
    result.failure.stage,
    CANDIDATE_EVALUATION_FAILURE_STAGE.HARD_COMPOSITION
  );
  assert.ok(result.portDescriptor);
  assert.ok(result.inputFingerprint);
  assertFailurePurity(result);
});

// ---------------------------------------------------------------------------
// C. Objectives
// ---------------------------------------------------------------------------

test("C01: objectives invoked only for feasible; order preserved; empty specs feasible", () => {
  const order = [];
  const registry = createObjectiveRegistry([
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_B",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-b",
      }),
      evaluator: () => {
        order.push("OBJ_B");
        return { rawValue: 2 };
      },
    },
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
      }),
      evaluator: () => {
        order.push("OBJ_A");
        return { rawValue: 1 };
      },
    },
  ]);
  const request = baseRequest();
  request.policy = {
    ...request.policy,
    objectiveKeys: ["OBJ_A", "OBJ_B"],
  };
  const input = baseInput({
    request,
    context: {
      ...request.context,
      snapshotRefs: request.context.snapshotRefs.map((r) => ({ ...r })),
    },
    decisionVariables: request.decisionVariables.map((dv) => ({
      ...dv,
      domain: [...dv.domain],
    })),
    objectiveExecutionSpecs: [
      {
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
      {
        objectiveId: "OBJ_B",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
    ],
  });

  const result = evaluateCandidateSolution(input, makeDeps({ registry }));
  assert.equal(result.status, CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE);
  assert.deepEqual(order, ["OBJ_A", "OBJ_B"]);
  assert.deepEqual(
    result.objectiveEvaluations.map((r) => r.objectiveId),
    ["OBJ_A", "OBJ_B"]
  );
  assert.deepEqual(result.optimizationScore.objectiveValues, [1, 2]);

  const empty = evaluateCandidateSolution(
    baseInput({ objectiveExecutionSpecs: [] }),
    makeDeps({ registry: registryWith() })
  );
  assert.equal(empty.status, CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE);
  assert.equal(empty.objectiveEvaluations.length, 0);
  assert.deepEqual(empty.optimizationScore.objectiveValues, []);
});

test("C02: objective evaluator failure; missing context; no partials", () => {
  const failing = registryWith([
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
      }),
      evaluator: () => {
        throw new Error("obj-secret");
      },
    },
  ]);
  const failResult = evaluateCandidateSolution(
    baseInput(),
    makeDeps({ registry: failing })
  );
  assert.equal(failResult.status, CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED);
  assert.equal(
    failResult.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATION_FAILED
  );
  assert.equal(
    failResult.failure.stage,
    CANDIDATE_EVALUATION_FAILURE_STAGE.OBJECTIVE_EVALUATION
  );
  assert.equal(
    failResult.failure.objectiveFailureCode,
    OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATOR_EXCEPTION
  );
  assertFailurePurity(failResult);
  assertNoLeakage(failResult);
  assert.ok(failResult.portDescriptor);
  assert.ok(failResult.inputFingerprint);

  const needsCtx = createObjectiveRegistry([
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
        requiredContextRefs: ["snap.rules"],
      }),
      evaluator: () => ({ rawValue: 1 }),
    },
  ]);
  const ctxResult = evaluateCandidateSolution(
    baseInput(),
    makeDeps({ registry: needsCtx })
  );
  assert.equal(
    ctxResult.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATION_FAILED
  );
  assert.equal(
    ctxResult.failure.objectiveFailureCode,
    OBJECTIVE_EVALUATION_FAILURE_CODE.MISSING_OBJECTIVE_CONTEXT
  );
  assert.equal(ctxResult.status, CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED);
  assert.notEqual(
    ctxResult.status,
    CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE
  );
  assertFailurePurity(ctxResult);
});

// ---------------------------------------------------------------------------
// D. Fingerprint / descriptor / determinism / purity
// ---------------------------------------------------------------------------

test("D01: fingerprint failure maps to RESULT_CONSTRUCTION; port not invoked", () => {
  let portCalls = 0;
  const port = makePort(() => {
    portCalls += 1;
    return { violations: [] };
  });
  const badRegistry = Object.freeze({
    descriptorFingerprint: () => "",
    has: () => false,
    listDefinitions: () => Object.freeze([]),
    resolve: () => {
      throw new Error("unused");
    },
  });
  const result = evaluateCandidateSolution(baseInput(), {
    objectiveRegistry: badRegistry,
    constraintEvaluationPort: port,
  });
  assert.equal(result.status, CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED);
  assert.equal(
    result.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT_FINGERPRINT
  );
  assert.equal(
    result.failure.stage,
    CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION
  );
  assert.ok(result.portDescriptor);
  assert.equal(result.inputFingerprint, null);
  assert.equal(portCalls, 0);
  assertFailurePurity(result);
});

test("D02: caller input/deps not mutated or frozen; assignment-order invariance; determinism", () => {
  const rawInput = baseInput({
    candidate: baseCandidate({
      assignments: [
        { variableId: "var-b", valueId: "b1" },
        { variableId: "var-a", valueId: "a1" },
      ],
    }),
  });
  const rawInputAlt = baseInput({
    candidate: baseCandidate({
      assignments: [
        { variableId: "var-a", valueId: "a1" },
        { variableId: "var-b", valueId: "b1" },
      ],
    }),
  });
  const evalA1 = () => ({ rawValue: 5 });
  const evalA2 = () => ({ rawValue: 5 });
  const portFn1 = () => ({ violations: [], noteCodes: [] });
  const portFn2 = () => ({ violations: [], noteCodes: [] });
  const deps1 = makeDeps({
    registry: registryWith([
      {
        definition: createObjectiveDefinition({
          objectiveId: "OBJ_A",
          objectiveVersion: "1",
          direction: OBJECTIVE_SENSE.MINIMIZE,
          evaluatorRef: "eval-a",
        }),
        evaluator: evalA1,
      },
    ]),
    port: makePort(portFn1, { portId: "CORE10_TEST_PORT" }),
  });
  const deps2 = makeDeps({
    registry: registryWith([
      {
        definition: createObjectiveDefinition({
          objectiveId: "OBJ_A",
          objectiveVersion: "1",
          direction: OBJECTIVE_SENSE.MINIMIZE,
          evaluatorRef: "eval-a",
        }),
        evaluator: evalA2,
      },
    ]),
    port: makePort(portFn2, { portId: "CORE10_TEST_PORT" }),
  });

  const assignSnap = JSON.stringify(rawInput.candidate.assignments);
  const r1 = evaluateCandidateSolution(rawInput, deps1);
  const r2 = evaluateCandidateSolution(rawInput, deps1);
  const r3 = evaluateCandidateSolution(rawInputAlt, deps2);
  assert.equal(JSON.stringify(rawInput.candidate.assignments), assignSnap);
  assert.equal(Object.isFrozen(rawInput), false);
  assert.equal(Object.isFrozen(deps1), false);
  assert.equal(serializeCanonical(r1), serializeCanonical(r2));
  assert.equal(r1.inputFingerprint, r2.inputFingerprint);
  assert.equal(r1.inputFingerprint, r3.inputFingerprint);
  assert.equal(serializeCanonical(r1), serializeCanonical(r3));
});

test("D03: INVALID_CANDIDATE_EVALUATION_FAILURE never stored; result-construction throws", () => {
  assert.throws(
    () =>
      createCandidateEvaluationFailure({
        code: CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE,
        messageCode:
          CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE,
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION,
      }),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code ===
        CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
  );

  assert.throws(
    () =>
      createCandidateEvaluationResult({
        status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
        feasible: true,
        candidateId: "cand-1",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        structuralViolations: [],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [],
        optimizationScore: null,
        failure: null,
        portDescriptor: { portId: "p", portVersion: "v" },
        inputFingerprint: "fp1",
      }),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code ===
        CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );

  const src = readFileSync(ORCH_FILE, "utf8");
  assert.match(src, /ENVELOPE_THROW_CODES/);
  assert.match(src, /throw err/);
  assert.equal(
    src.includes(
      "INVALID_CANDIDATE_EVALUATION_RESULT as a pipeline failure code"
    ),
    false
  );
});

// ---------------------------------------------------------------------------
// E. Public API / ownership / regressions
// ---------------------------------------------------------------------------

test("E01: public export surface; internals absent; root barrel unchanged", () => {
  assert.equal(typeof OptimizerPublic.evaluateCandidateSolution, "function");
  assert.equal(
    typeof OptimizerPublic.createCandidateEvaluationResultFingerprint,
    "function"
  );
  assert.equal(
    "CORE10_CANDIDATE_RESULT_FINGERPRINT_VERSION" in OptimizerPublic,
    true
  );
  assert.equal(
    "createCandidateEvaluationInputFingerprint" in OptimizerPublic,
    false
  );
  assert.equal("CANDIDATE_EVALUATION_FAILURE_STAGE" in OptimizerPublic, false);
  assert.equal("createConstraintPortInput" in OptimizerPublic, false);
  assert.equal("mapCandidateEvaluationFailure" in OptimizerPublic, false);
  assert.equal("createInvalidCandidateResult" in OptimizerPublic, false);
  assert.equal("extractStableErrorDetails" in OptimizerPublic, false);
  assert.equal("evaluateCandidate" in OptimizerPublic, false);

  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(root.includes("evaluateCandidateSolution"), false);
  assert.equal(root.includes("composeCandidateOptimizationScore"), false);
  assert.equal(
    root.includes("createCandidateEvaluationResultFingerprint"),
    false
  );
});

test("E02: no prohibited imports or forbidden runtime patterns in B2-B sources", () => {
  const orch = readFileSync(ORCH_FILE, "utf8");
  const banned = [
    "constraints/evaluateCandidate",
    "constraints/evaluateHardRules",
    "registration-eligibility",
    "team-tournament",
    "private-pairing",
    "match-generation",
    "scheduling/",
    "court-assignment",
    "referee-assignment",
    "@supabase",
    "Math.random",
    "Date.now",
    "new Date",
    "localeCompare",
    "buildOptimizationScore",
    "async function",
    "createSolver",
    "generateCandidate",
    "Promise",
    "async ",
    "await ",
    "process.env",
  ];
  for (const b of banned) {
    assert.equal(
      orch.includes(b),
      false,
      `evaluateCandidateSolution.js must not reference ${b}`
    );
  }
  // Capability-local barrel must not re-export helpers or CORE-01 name.
  const barrel = readFileSync(path.join(OPT_ROOT, "index.js"), "utf8");
  assert.match(barrel, /evaluateCandidateSolution/);
  assert.equal(barrel.includes("export { evaluateCandidate }"), false);
  assert.equal(
    barrel.includes("createCandidateEvaluationInputFingerprint"),
    false
  );
});

test("E03: createCandidateEvaluationDependencies still required shape", () => {
  const deps = createCandidateEvaluationDependencies(makeDeps());
  assert.ok(deps.constraintEvaluationPort);
  assert.ok(deps.objectiveRegistry);
});

test("E04: evaluationVersion reuse; score/candidate alignment", () => {
  const result = evaluateCandidateSolution(baseInput(), makeDeps());
  assert.equal(
    result.evaluationVersion,
    CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION
  );
  assert.equal(result.optimizationScore.candidateId, result.candidateId);
  assert.deepEqual(result.optimizationScore.authorityValues, [7]);
});

// ---------------------------------------------------------------------------
// F. Hardening — direct proofs for review gaps
// ---------------------------------------------------------------------------

test("F01: port call counters across success and failure branches", () => {
  function countingPort(fn) {
    let calls = 0;
    const port = makePort((input) => {
      calls += 1;
      return fn(input);
    });
    return { port, getCalls: () => calls };
  }

  const feasible = countingPort(() => ({ violations: [] }));
  evaluateCandidateSolution(baseInput(), makeDeps({ port: feasible.port }));
  assert.equal(feasible.getCalls(), 1);

  const infeasible = countingPort(() => ({
    violations: [baseViolation()],
    noteCodes: ["IGNORED"],
  }));
  evaluateCandidateSolution(baseInput(), makeDeps({ port: infeasible.port }));
  assert.equal(infeasible.getCalls(), 1);

  const ex = countingPort(() => {
    throw new Error("once-only-secret");
  });
  const exResult = evaluateCandidateSolution(
    baseInput(),
    makeDeps({ port: ex.port })
  );
  assert.equal(ex.getCalls(), 1);
  assert.equal(
    exResult.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_EXCEPTION
  );
  assert.equal(serializeCanonical(exResult).includes("once-only-secret"), false);

  const badShape = countingPort(() => ({ noteCodes: [] }));
  evaluateCandidateSolution(baseInput(), makeDeps({ port: badShape.port }));
  assert.equal(badShape.getCalls(), 1);

  const invalidInput = countingPort(() => ({ violations: [] }));
  evaluateCandidateSolution(
    baseInput({ candidate: baseCandidate({ candidateId: "" }) }),
    makeDeps({ port: invalidInput.port })
  );
  assert.equal(invalidInput.getCalls(), 0);

  const invalidDeps = countingPort(() => ({ violations: [] }));
  evaluateCandidateSolution(baseInput(), {
    objectiveRegistry: null,
    constraintEvaluationPort: invalidDeps.port,
  });
  assert.equal(invalidDeps.getCalls(), 0);

  const fpFail = countingPort(() => ({ violations: [] }));
  evaluateCandidateSolution(baseInput(), {
    objectiveRegistry: Object.freeze({
      descriptorFingerprint: () => "",
      has: () => false,
      listDefinitions: () => Object.freeze([]),
      resolve: () => {
        throw new Error("unused");
      },
    }),
    constraintEvaluationPort: fpFail.port,
  });
  assert.equal(fpFail.getCalls(), 0);
});

test("F02: objective registry resolve untouched for infeasible candidate", () => {
  const base = registryWith();
  let resolveCalls = 0;
  let hasCalls = 0;
  const wrapped = Object.freeze({
    descriptorFingerprint: () => base.descriptorFingerprint(),
    has: (...args) => {
      hasCalls += 1;
      return base.has(...args);
    },
    listDefinitions: () => base.listDefinitions(),
    resolve: (...args) => {
      resolveCalls += 1;
      return base.resolve(...args);
    },
  });
  const port = makePort(() => ({ violations: [baseViolation()] }));
  const result = evaluateCandidateSolution(
    baseInput(),
    makeDeps({ registry: wrapped, port })
  );
  assert.equal(result.status, CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE);
  assert.equal(resolveCalls, 0);
  assert.equal(hasCalls, 0);
});

test("F03: post-evaluation caller mutation cannot affect captured port input or result", () => {
  /** @type {object | null} */
  let capturedPortInput = null;
  const port = makePort((input) => {
    capturedPortInput = {
      candidateId: input.candidateId,
      operation: input.operation,
      assignments: input.assignments.map((a) => ({
        variableId: a.variableId,
        valueId: a.valueId,
      })),
      tenantId: input.tenantId,
      competitionId: input.competitionId,
      snapshotFingerprints: [...input.snapshotFingerprints],
      factsKeys: Object.keys(input.facts),
    };
    return { violations: [] };
  });
  const raw = baseInput();
  const deps = makeDeps({ port });
  const result = evaluateCandidateSolution(raw, deps);
  const before = serializeCanonical(result);
  const fp = result.inputFingerprint;

  raw.candidate.assignments[0].valueId = "a2";
  raw.candidate.assignments.push({ variableId: "var-x", valueId: "x1" });
  raw.context.snapshotRefs[0].fingerprint = "deadbeef";
  raw.context.snapshotRefs.reverse();
  raw.authorityValues[0] = 99;
  deps.objectiveRegistry = null;

  assert.ok(capturedPortInput);
  assert.deepEqual(capturedPortInput.snapshotFingerprints, [
    "abcdef01",
    "abcdef02",
  ]);
  assert.deepEqual(capturedPortInput.assignments, [
    { variableId: "var-a", valueId: "a1" },
    { variableId: "var-b", valueId: "b1" },
  ]);
  assert.deepEqual(capturedPortInput.factsKeys, []);
  assert.equal(serializeCanonical(result), before);
  assert.equal(result.inputFingerprint, fp);
  assert.equal(Object.isFrozen(raw), false);
  assert.equal(Object.isFrozen(deps), false);
});

test("F04: failure-path purity and descriptor/fingerprint retention by stage", () => {
  const cases = [
    {
      name: "INPUT_VALIDATION",
      run: () =>
        evaluateCandidateSolution(
          baseInput({ candidate: baseCandidate({ candidateId: "" }) }),
          makeDeps()
        ),
      status: CANDIDATE_EVALUATION_STATUS.INVALID_CANDIDATE,
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
      expectDescriptor: false,
      expectFingerprint: false,
    },
    {
      name: "DEPENDENCY_VALIDATION",
      run: () =>
        evaluateCandidateSolution(baseInput(), {
          objectiveRegistry: { resolve: () => null },
          constraintEvaluationPort: makePort(() => ({ violations: [] })),
        }),
      status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.DEPENDENCY_VALIDATION,
      expectDescriptor: false,
      expectFingerprint: false,
    },
    {
      name: "CONSTRAINT_PORT_deps",
      run: () =>
        evaluateCandidateSolution(baseInput(), {
          objectiveRegistry: registryWith(),
        }),
      status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
      code: CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_UNAVAILABLE,
      expectDescriptor: false,
      expectFingerprint: false,
    },
    {
      name: "CONSTRAINT_PORT_invoke",
      run: () =>
        evaluateCandidateSolution(
          baseInput(),
          makeDeps({
            port: makePort(() => {
              throw new Error("port-secret");
            }),
          })
        ),
      status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
      expectDescriptor: true,
      expectFingerprint: true,
      secret: "port-secret",
    },
    {
      name: "HARD_COMPOSITION",
      run: () =>
        evaluateCandidateSolution(
          baseInput(),
          makeDeps({
            port: makePort(() => ({
              violations: [
                baseViolation({ magnitude: 1 }),
                baseViolation({ magnitude: 2 }),
              ],
            })),
          })
        ),
      status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.HARD_COMPOSITION,
      expectDescriptor: true,
      expectFingerprint: true,
    },
    {
      name: "OBJECTIVE_EVALUATION",
      run: () =>
        evaluateCandidateSolution(
          baseInput(),
          makeDeps({
            registry: registryWith([
              {
                definition: createObjectiveDefinition({
                  objectiveId: "OBJ_A",
                  objectiveVersion: "1",
                  direction: OBJECTIVE_SENSE.MINIMIZE,
                  evaluatorRef: "eval-a",
                }),
                evaluator: () => {
                  throw new Error("obj-secret");
                },
              },
            ]),
          })
        ),
      status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.OBJECTIVE_EVALUATION,
      expectDescriptor: true,
      expectFingerprint: true,
      secret: "obj-secret",
    },
    {
      name: "RESULT_CONSTRUCTION_fingerprint",
      run: () =>
        evaluateCandidateSolution(baseInput(), {
          objectiveRegistry: Object.freeze({
            descriptorFingerprint: () => "",
            has: () => false,
            listDefinitions: () => Object.freeze([]),
            resolve: () => {
              throw new Error("unused");
            },
          }),
          constraintEvaluationPort: makePort(() => ({ violations: [] })),
        }),
      status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
      stage: CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION,
      code: CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT_FINGERPRINT,
      expectDescriptor: true,
      expectFingerprint: false,
    },
  ];

  for (const c of cases) {
    const result = c.run();
    assert.equal(result.status, c.status, c.name);
    assert.equal(result.failure.stage, c.stage, c.name);
    if (c.code) assert.equal(result.failure.code, c.code, c.name);
    assertFailurePurity(result);
    assertNoLeakage(result);
    assert.equal(result.portDescriptor != null, c.expectDescriptor, c.name);
    assert.equal(result.inputFingerprint != null, c.expectFingerprint, c.name);
    if (c.secret) {
      assert.equal(serializeCanonical(result).includes(c.secret), false, c.name);
    }
  }
});

test("F05: source hygiene — single port site; no UNKNOWN_CANDIDATE; no buildOptimizationScore", () => {
  const src = readFileSync(ORCH_FILE, "utf8");
  const invokeMatches = src.match(
    /constraintEvaluationPort\.evaluateConstraints/g
  );
  assert.equal(invokeMatches && invokeMatches.length, 1);
  assert.equal(src.includes("UNKNOWN_CANDIDATE"), false);
  assert.equal(src.includes("buildOptimizationScore"), false);
  assert.equal(src.includes("evaluateCandidate("), false);
  assert.equal(src.includes("async "), false);
  assert.equal(src.includes("Promise"), false);
  assert.equal(/evaluateConstraints\(/g.test(src), true);
});

test("F06: duplicate hard-violation composition failure retains descriptor/fingerprint", () => {
  const port = makePort(() => ({
    violations: [
      baseViolation({ messageCode: "MSG_A", detailsCodes: ["D1"] }),
      baseViolation({ messageCode: "MSG_B", detailsCodes: ["D1"] }),
    ],
  }));
  const result = evaluateCandidateSolution(baseInput(), makeDeps({ port }));
  assert.equal(
    result.failure.code,
    CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_HARD_VIOLATION
  );
  assert.equal(
    result.failure.stage,
    CANDIDATE_EVALUATION_FAILURE_STAGE.HARD_COMPOSITION
  );
  assert.ok(result.portDescriptor);
  assert.ok(result.inputFingerprint);
  assertFailurePurity(result);
});

test("F07: material order sensitivity — specs and authority change fingerprint", () => {
  const request = baseRequest();
  request.policy = {
    ...request.policy,
    objectiveKeys: ["OBJ_A", "OBJ_B"],
    authorityKeys: ["AUTH_A", "AUTH_B"],
  };
  const registry = createObjectiveRegistry([
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
      }),
      evaluator: () => ({ rawValue: 1 }),
    },
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_B",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-b",
      }),
      evaluator: () => ({ rawValue: 2 }),
    },
  ]);
  const base = {
    request,
    context: {
      ...request.context,
      snapshotRefs: request.context.snapshotRefs.map((r) => ({ ...r })),
    },
    decisionVariables: request.decisionVariables.map((dv) => ({
      ...dv,
      domain: [...dv.domain],
    })),
    authorityValues: [1, 2],
    objectiveExecutionSpecs: [
      {
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
      {
        objectiveId: "OBJ_B",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
    ],
  };
  const r1 = evaluateCandidateSolution(baseInput(base), makeDeps({ registry }));
  const r2 = evaluateCandidateSolution(
    baseInput({
      ...base,
      objectiveExecutionSpecs: [
        base.objectiveExecutionSpecs[1],
        base.objectiveExecutionSpecs[0],
      ],
    }),
    makeDeps({ registry })
  );
  const r3 = evaluateCandidateSolution(
    baseInput({
      ...base,
      authorityValues: [2, 1],
    }),
    makeDeps({ registry })
  );
  assert.notEqual(r1.inputFingerprint, r2.inputFingerprint);
  assert.notEqual(r1.inputFingerprint, r3.inputFingerprint);
});

/**
 * CORE-10 Phase 1C-B2-A — failure/result/score/input-fingerprint contracts.
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
  CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION,
  CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION,
  CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION,
  CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION,
  OptimizerContractError,
  createObjectiveRegistry,
  createObjectiveDefinition,
  createCandidateEvaluationInput,
  createHardViolation,
  createConstraintEvaluationPort,
  createCandidateEvaluationFailure,
  createCandidateEvaluationResult,
  composeCandidateOptimizationScore,
  compareOptimizationScores,
  serializeCanonical,
} from "../src/features/competition-core/optimizer/index.js";

import { CANDIDATE_EVALUATION_FAILURE_STAGE } from "../src/features/competition-core/optimizer/contracts/candidateEvaluationFailure.js";
import { createCandidateEvaluationInputFingerprint } from "../src/features/competition-core/optimizer/evaluation/candidateEvaluationInputFingerprint.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");

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
    context: { ...request.context },
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
    authorityValues: [0],
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

function noopPort(overrides = {}) {
  return createConstraintEvaluationPort({
    portId: "CORE10_NOOP_CONSTRAINT_PORT",
    portVersion: CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
    evaluateConstraints: () => ({ violations: [], noteCodes: [] }),
    ...overrides,
  });
}

function registryWithObj(evaluator = () => ({ rawValue: 1 })) {
  return createObjectiveRegistry([
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
      }),
      evaluator,
    },
  ]);
}

function assertThrowsCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.equal(err instanceof OptimizerContractError, true);
    assert.equal(err.code, code);
    return true;
  });
}

// ---------------------------------------------------------------------------
// A. Failure contract
// ---------------------------------------------------------------------------

test("A01: valid failure for every approved stage family", () => {
  const cases = [
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT,
      CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_DEPENDENCIES,
      CANDIDATE_EVALUATION_FAILURE_STAGE.DEPENDENCY_VALIDATION,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_EXCEPTION,
      CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.HARD_VIOLATION_MAGNITUDE_CONFLICT,
      CANDIDATE_EVALUATION_FAILURE_STAGE.HARD_COMPOSITION,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATION_FAILED,
      CANDIDATE_EVALUATION_FAILURE_STAGE.OBJECTIVE_EVALUATION,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED,
      CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT,
      CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.CANDIDATE_EVALUATION_UNEXPECTED_FAILURE,
      CANDIDATE_EVALUATION_FAILURE_STAGE.UNEXPECTED_FAILURE,
    ],
  ];
  for (const [code, stage] of cases) {
    const failure = createCandidateEvaluationFailure({
      code,
      messageCode: code,
      stage,
      detailsCodes: ["Z", "A"],
      objectiveFailureCode:
        code === CANDIDATE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATION_FAILED
          ? OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATOR_EXCEPTION
          : null,
      candidateId: "cand-1",
      portDescriptor:
        stage === CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT
          ? { portId: "p1", portVersion: "v1" }
          : null,
    });
    assert.equal(failure.code, code);
    assert.equal(failure.stage, stage);
    assert.equal(failure.messageCode, code);
    assert.deepEqual(failure.detailsCodes, ["A", "Z"]);
    assert.equal(Object.isFrozen(failure), true);
  }
});

test("A02: incompatible code/stage rejected; stable messageCode; duplicates", () => {
  assertThrowsCode(
    () =>
      createCandidateEvaluationFailure({
        code: CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT,
        messageCode: "INVALID_CANDIDATE_INPUT",
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
  );

  const codes = ["C", "A", "B"];
  const failure = createCandidateEvaluationFailure({
    code: CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED,
    messageCode: "SCORE_COMPOSITION_FAILED",
    stage: CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,
    detailsCodes: codes,
  });
  assert.deepEqual(failure.detailsCodes, ["A", "B", "C"]);
  assert.deepEqual(codes, ["C", "A", "B"]);

  assertThrowsCode(
    () =>
      createCandidateEvaluationFailure({
        code: CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED,
        messageCode: "SCORE_COMPOSITION_FAILED",
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,
        detailsCodes: ["A", "A"],
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
  );
});

test("A03: objectiveFailureCode / candidateId / portDescriptor / unknown / inherited", () => {
  const ok = createCandidateEvaluationFailure({
    code: CANDIDATE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATION_FAILED,
    messageCode: "OBJECTIVE_EVALUATION_FAILED",
    stage: CANDIDATE_EVALUATION_FAILURE_STAGE.OBJECTIVE_EVALUATION,
    objectiveFailureCode:
      OBJECTIVE_EVALUATION_FAILURE_CODE.UNKNOWN_OBJECTIVE,
    candidateId: null,
    portDescriptor: null,
  });
  assert.equal(ok.objectiveFailureCode, "UNKNOWN_OBJECTIVE");
  assert.equal(ok.candidateId, null);

  assertThrowsCode(
    () =>
      createCandidateEvaluationFailure({
        code: CANDIDATE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATION_FAILED,
        messageCode: "OBJECTIVE_EVALUATION_FAILED",
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.OBJECTIVE_EVALUATION,
        objectiveFailureCode: "NOT_AN_OBJECTIVE_CODE",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
  );

  assertThrowsCode(
    () =>
      createCandidateEvaluationFailure({
        code: CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED,
        messageCode: "SCORE_COMPOSITION_FAILED",
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,
        message: "free text",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
  );

  const proto = { code: CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED };
  const inherited = Object.create(proto);
  inherited.messageCode = "SCORE_COMPOSITION_FAILED";
  inherited.stage = CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION;
  assertThrowsCode(
    () => createCandidateEvaluationFailure(inherited),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
  );

  const caller = {
    code: CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED,
    messageCode: "SCORE_COMPOSITION_FAILED",
    stage: CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,
    detailsCodes: ["B", "A"],
  };
  const frozen = createCandidateEvaluationFailure(caller);
  assert.equal(Object.isFrozen(caller), false);
  assert.equal(Object.isFrozen(frozen), true);
  assert.equal("stack" in frozen, false);
  assert.equal("message" in frozen, false);
});

// ---------------------------------------------------------------------------
// B. Score composition
// ---------------------------------------------------------------------------

test("B01: feasible and infeasible scores; authority; order; tie-break", () => {
  const records = [
    baseObjectiveRecord({ orientedValue: 5, executionIndex: 0 }),
    baseObjectiveRecord({
      objectiveId: "OBJ_B",
      orientedValue: 2,
      executionIndex: 1,
    }),
  ];
  const feasible = composeCandidateOptimizationScore({
    candidateId: "cand-1",
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [7],
    objectiveEvaluations: records,
  });
  assert.equal(feasible.feasible, true);
  assert.equal(feasible.hardViolationCount, 0);
  assert.deepEqual(feasible.objectiveValues, [5, 2]);
  assert.deepEqual(feasible.authorityValues, [7]);

  const zeroObj = composeCandidateOptimizationScore({
    candidateId: "cand-1",
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [1],
    objectiveEvaluations: [],
  });
  assert.deepEqual(zeroObj.objectiveValues, []);

  const auth = [9, 3];
  const infeasible = composeCandidateOptimizationScore({
    candidateId: "cand-2",
    feasible: false,
    hardViolationCount: 2,
    authorityValues: auth,
    objectiveEvaluations: [],
  });
  assert.equal(infeasible.feasible, false);
  assert.equal(infeasible.hardViolationCount, 2);
  assert.deepEqual(infeasible.objectiveValues, []);
  assert.deepEqual(infeasible.authorityValues, [9, 3]);
  assert.deepEqual(auth, [9, 3]);

  const a = composeCandidateOptimizationScore({
    candidateId: "cand-a",
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveEvaluations: [],
  });
  const b = composeCandidateOptimizationScore({
    candidateId: "cand-b",
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveEvaluations: [],
  });
  assert.equal(compareOptimizationScores(a, b) < 0, true);
});

test("B02: score composition rejects invalid combinations and unsafe values", () => {
  assertThrowsCode(
    () =>
      composeCandidateOptimizationScore({
        candidateId: "cand-1",
        feasible: true,
        hardViolationCount: 1,
        authorityValues: [0],
        objectiveEvaluations: [],
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED
  );
  assertThrowsCode(
    () =>
      composeCandidateOptimizationScore({
        candidateId: "cand-1",
        feasible: false,
        hardViolationCount: 0,
        authorityValues: [0],
        objectiveEvaluations: [],
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED
  );
  assertThrowsCode(
    () =>
      composeCandidateOptimizationScore({
        candidateId: "cand-1",
        feasible: false,
        hardViolationCount: 1,
        authorityValues: [0],
        objectiveEvaluations: [baseObjectiveRecord()],
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED
  );
  assertThrowsCode(
    () =>
      composeCandidateOptimizationScore({
        candidateId: "cand-1",
        feasible: true,
        hardViolationCount: 0,
        authorityValues: [1.5],
        objectiveEvaluations: [],
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED
  );
  assertThrowsCode(
    () =>
      composeCandidateOptimizationScore({
        candidateId: "cand-1",
        feasible: true,
        hardViolationCount: 0,
        authorityValues: [0],
        objectiveEvaluations: [
          baseObjectiveRecord({ orientedValue: Number.MAX_SAFE_INTEGER + 1 }),
        ],
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED
  );

  const src = readFileSync(
    path.join(OPT_ROOT, "scoring", "composeCandidateOptimizationScore.js"),
    "utf8"
  );
  assert.equal(src.includes("from \"./compareScores.js\""), false);
  assert.match(src, /createOptimizationScore/);
});

// ---------------------------------------------------------------------------
// C. Input fingerprint
// ---------------------------------------------------------------------------

test("C01: deterministic fingerprint; assignment/registry/function identity invariance", () => {
  const inputA = createCandidateEvaluationInput(
    baseInput({
      candidate: baseCandidate({
        assignments: [
          { variableId: "var-b", valueId: "b1" },
          { variableId: "var-a", valueId: "a1" },
        ],
      }),
    })
  );
  const inputB = createCandidateEvaluationInput(
    baseInput({
      candidate: baseCandidate({
        assignments: [
          { variableId: "var-a", valueId: "a1" },
          { variableId: "var-b", valueId: "b1" },
        ],
      }),
    })
  );

  const reg1 = registryWithObj(() => ({ rawValue: 1 }));
  const reg2 = createObjectiveRegistry([
    {
      definition: createObjectiveDefinition({
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        evaluatorRef: "eval-a",
      }),
      evaluator: () => ({ rawValue: 99 }),
    },
  ]);
  // Same definition inserted in different construction order with one objective only.
  const port1 = noopPort();
  const port2 = createConstraintEvaluationPort({
    portId: "CORE10_NOOP_CONSTRAINT_PORT",
    portVersion: CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
    evaluateConstraints: () => ({ violations: [{ x: 1 }], noteCodes: [] }),
  });

  const fp1 = createCandidateEvaluationInputFingerprint({
    input: inputA,
    objectiveRegistry: reg1,
    constraintEvaluationPort: port1,
  });
  const fp2 = createCandidateEvaluationInputFingerprint({
    input: inputB,
    objectiveRegistry: reg2,
    constraintEvaluationPort: port2,
  });
  assert.equal(fp1, fp2);
  assert.equal(
    createCandidateEvaluationInputFingerprint({
      input: inputA,
      objectiveRegistry: reg1,
      constraintEvaluationPort: port1,
    }),
    fp1
  );
});

test("C02: material changes alter fingerprint; specs/authority/domain/port id", () => {
  const base = createCandidateEvaluationInput(baseInput());
  const reg = registryWithObj();
  const port = noopPort();
  const fp0 = createCandidateEvaluationInputFingerprint({
    input: base,
    objectiveRegistry: reg,
    constraintEvaluationPort: port,
  });

  const fpAssign = createCandidateEvaluationInputFingerprint({
    input: createCandidateEvaluationInput(
      baseInput({
        candidate: baseCandidate({
          assignments: [
            { variableId: "var-a", valueId: "a2" },
            { variableId: "var-b", valueId: "b1" },
          ],
        }),
      })
    ),
    objectiveRegistry: reg,
    constraintEvaluationPort: port,
  });
  assert.notEqual(fpAssign, fp0);

  const fpDomain = createCandidateEvaluationInputFingerprint({
    input: createCandidateEvaluationInput(
      baseInput({
        request: baseRequest({
          decisionVariables: [
            { variableId: "var-b", domain: ["b2", "b1", "b3"], required: false },
            { variableId: "var-a", domain: ["a1", "a2"], required: true },
          ],
        }),
        decisionVariables: [
          { variableId: "var-b", domain: ["b2", "b1", "b3"], required: false },
          { variableId: "var-a", domain: ["a1", "a2"], required: true },
        ],
      })
    ),
    objectiveRegistry: reg,
    constraintEvaluationPort: port,
  });
  assert.notEqual(fpDomain, fp0);

  const fpSpecs = createCandidateEvaluationInputFingerprint({
    input: createCandidateEvaluationInput(
      baseInput({
        request: baseRequest({
          policy: {
            policyId: "pol-1",
            policyVersion: "1",
            objectiveKeys: ["OBJ_A", "OBJ_B"],
            authorityKeys: ["AUTH_A"],
            comparatorVersion: CORE10_COMPARATOR_VERSION,
            quantizeScale: 1,
          },
        }),
        objectiveExecutionSpecs: [
          {
            objectiveId: "OBJ_B",
            objectiveVersion: "1",
            weight: 1,
            quantizeScale: 1,
          },
          {
            objectiveId: "OBJ_A",
            objectiveVersion: "1",
            weight: 1,
            quantizeScale: 1,
          },
        ],
      })
    ),
    objectiveRegistry: createObjectiveRegistry([
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
        evaluator: () => ({ rawValue: 1 }),
      },
    ]),
    constraintEvaluationPort: port,
  });
  assert.notEqual(fpSpecs, fp0);

  const fpAuth = createCandidateEvaluationInputFingerprint({
    input: createCandidateEvaluationInput(
      baseInput({
        request: baseRequest({
          policy: {
            policyId: "pol-1",
            policyVersion: "1",
            objectiveKeys: ["OBJ_A"],
            authorityKeys: ["AUTH_A", "AUTH_B"],
            comparatorVersion: CORE10_COMPARATOR_VERSION,
            quantizeScale: 1,
          },
        }),
        authorityValues: [0, 1],
      })
    ),
    objectiveRegistry: reg,
    constraintEvaluationPort: port,
  });
  assert.notEqual(fpAuth, fp0);

  const fpPort = createCandidateEvaluationInputFingerprint({
    input: base,
    objectiveRegistry: reg,
    constraintEvaluationPort: createConstraintEvaluationPort({
      portId: "OTHER_PORT",
      portVersion: CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
      evaluateConstraints: () => ({ violations: [], noteCodes: [] }),
    }),
  });
  assert.notEqual(fpPort, fp0);

  const fpDesc = createCandidateEvaluationInputFingerprint({
    input: base,
    objectiveRegistry: createObjectiveRegistry([
      {
        definition: createObjectiveDefinition({
          objectiveId: "OBJ_A",
          objectiveVersion: "1",
          direction: OBJECTIVE_SENSE.MAXIMIZE,
          evaluatorRef: "eval-a-changed",
        }),
        evaluator: () => ({ rawValue: 1 }),
      },
    ]),
    constraintEvaluationPort: port,
  });
  assert.notEqual(fpDesc, fp0);

  const fpSnap = createCandidateEvaluationInputFingerprint({
    input: createCandidateEvaluationInput(
      baseInput({
        request: baseRequest({
          context: {
            tenantId: "tenant-1",
            competitionId: "comp-1",
            snapshotRefs: [
              {
                snapshotId: "snap-1",
                snapshotVersion: "v1",
                fingerprint: "ffffff01",
                kind: "GENERIC",
              },
            ],
            metadata: {},
          },
        }),
        context: {
          tenantId: "tenant-1",
          competitionId: "comp-1",
          snapshotRefs: [
            {
              snapshotId: "snap-1",
              snapshotVersion: "v1",
              fingerprint: "ffffff01",
              kind: "GENERIC",
            },
          ],
          metadata: {},
        },
      })
    ),
    objectiveRegistry: reg,
    constraintEvaluationPort: port,
  });
  assert.notEqual(fpSnap, fp0);

  const fpSrc = readFileSync(
    path.join(OPT_ROOT, "evaluation", "candidateEvaluationInputFingerprint.js"),
    "utf8"
  );
  assert.equal(fpSrc.includes("Date.now"), false);
  assert.equal(fpSrc.includes("Math.random"), false);
  assert.equal(fpSrc.includes("localeCompare"), false);
});

// ---------------------------------------------------------------------------
// D. Result contract
// ---------------------------------------------------------------------------

function portDesc() {
  return {
    portId: "CORE10_NOOP_CONSTRAINT_PORT",
    portVersion: CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
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

test("D01: valid feasible / zero objectives / infeasible results", () => {
  const record = baseObjectiveRecord();
  const score = composeCandidateOptimizationScore({
    candidateId: "cand-1",
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveEvaluations: [record],
  });
  const feasible = createCandidateEvaluationResult({
    candidateId: "cand-1",
    operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
    feasible: true,
    structuralViolations: [],
    businessViolations: [],
    allHardViolations: [],
    objectiveEvaluations: [record],
    optimizationScore: score,
    failure: null,
    portDescriptor: portDesc(),
    inputFingerprint: "abcd1234",
  });
  assert.equal(feasible.status, CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE);
  assert.equal(Object.isFrozen(feasible), true);
  assert.deepEqual(feasible.structuralViolations, []);

  const zeroScore = composeCandidateOptimizationScore({
    candidateId: "cand-1",
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveEvaluations: [],
  });
  const zero = createCandidateEvaluationResult({
    candidateId: "cand-1",
    operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
    feasible: true,
    structuralViolations: [],
    businessViolations: [],
    allHardViolations: [],
    objectiveEvaluations: [],
    optimizationScore: zeroScore,
    failure: null,
    portDescriptor: portDesc(),
    inputFingerprint: "abcd1234",
  });
  assert.deepEqual(zero.objectiveEvaluations, []);

  const hv = createHardViolation(baseViolation());
  const inScore = composeCandidateOptimizationScore({
    candidateId: "cand-1",
    feasible: false,
    hardViolationCount: 1,
    authorityValues: [4],
    objectiveEvaluations: [],
  });
  const infeasible = createCandidateEvaluationResult({
    candidateId: "cand-1",
    operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    status: CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE,
    feasible: false,
    structuralViolations: [],
    businessViolations: [hv],
    allHardViolations: [hv],
    objectiveEvaluations: [],
    optimizationScore: inScore,
    failure: null,
    portDescriptor: portDesc(),
    inputFingerprint: "abcd1234",
  });
  assert.equal(infeasible.optimizationScore.hardViolationCount, 1);
  assert.deepEqual(infeasible.optimizationScore.objectiveValues, []);
  assert.equal(
    serializeCanonical(infeasible.businessViolations),
    serializeCanonical(infeasible.allHardViolations)
  );
});

test("D02: invalid-candidate and evaluation-failed; purity; null IDs", () => {
  const invalidKnown = createCandidateEvaluationResult({
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
  });
  assert.equal(invalidKnown.candidateId, "cand-1");
  assert.equal(invalidKnown.portDescriptor, null);
  assert.equal(invalidKnown.inputFingerprint, null);

  const invalidNull = createCandidateEvaluationResult({
    candidateId: null,
    operation: null,
    status: CANDIDATE_EVALUATION_STATUS.INVALID_CANDIDATE,
    feasible: false,
    structuralViolations: [],
    businessViolations: [],
    allHardViolations: [],
    objectiveEvaluations: [],
    optimizationScore: null,
    failure: inputFailure({ candidateId: null }),
    portDescriptor: null,
    inputFingerprint: null,
  });
  assert.equal(invalidNull.candidateId, null);
  assert.equal(invalidNull.operation, null);

  const failed = createCandidateEvaluationResult({
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
  });
  assert.equal(failed.status, CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED);
  assert.equal(failed.optimizationScore, null);
});

test("D03: invalid status combinations and failure-path purity rejected", () => {
  const record = baseObjectiveRecord();
  const score = composeCandidateOptimizationScore({
    candidateId: "cand-1",
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveEvaluations: [record],
  });

  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: "cand-1",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
        feasible: false,
        structuralViolations: [],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [record],
        optimizationScore: score,
        failure: null,
        portDescriptor: portDesc(),
        inputFingerprint: "abcd1234",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );

  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: "cand-1",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        status: CANDIDATE_EVALUATION_STATUS.INVALID_CANDIDATE,
        feasible: false,
        structuralViolations: [],
        businessViolations: [createHardViolation(baseViolation())],
        allHardViolations: [],
        objectiveEvaluations: [],
        optimizationScore: null,
        failure: inputFailure(),
        portDescriptor: null,
        inputFingerprint: null,
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );

  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: "cand-1",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
        feasible: false,
        structuralViolations: [],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [record],
        optimizationScore: null,
        failure: evalFailure(),
        portDescriptor: portDesc(),
        inputFingerprint: "abcd1234",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );

  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: "cand-1",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
        feasible: false,
        structuralViolations: [],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [],
        optimizationScore: null,
        failure: inputFailure(),
        portDescriptor: null,
        inputFingerprint: null,
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );

  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: "cand-1",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
        feasible: true,
        structuralViolations: [createHardViolation(baseViolation())],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [record],
        optimizationScore: score,
        failure: null,
        portDescriptor: portDesc(),
        inputFingerprint: "abcd1234",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );

  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: "cand-1",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
        feasible: true,
        structuralViolations: [],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [record],
        optimizationScore: score,
        failure: null,
        portDescriptor: portDesc(),
        inputFingerprint: "abcd1234",
        message: "nope",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );

  const caller = {
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
  };
  const result = createCandidateEvaluationResult(caller);
  assert.equal(Object.isFrozen(caller), false);
  assert.equal(Object.isFrozen(result), true);
  JSON.stringify(result);
});

// ---------------------------------------------------------------------------
// E. Public API and ownership
// ---------------------------------------------------------------------------

test("E01: approved B2-A public exports; fingerprint not public; B2-B orchestration public", () => {
  for (const key of [
    "createCandidateEvaluationFailure",
    "createCandidateEvaluationResult",
    "composeCandidateOptimizationScore",
    "evaluateCandidateSolution",
    "CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION",
    "CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION",
    "CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION",
    "CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION",
    "CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION",
    "CANDIDATE_EVALUATION_FAILURE_CODE",
  ]) {
    assert.equal(key in OptimizerPublic, true, key);
  }

  assert.equal(
    OptimizerPublic.CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION,
    CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION
  );
  assert.equal(
    OptimizerPublic.CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION,
    CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION
  );
  assert.equal(
    OptimizerPublic.CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
    CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION
  );
  assert.equal(
    OptimizerPublic.CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION,
    CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION
  );
  assert.equal(
    OptimizerPublic.CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION,
    CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION
  );

  assert.equal("evaluateCandidateSolution" in OptimizerPublic, true);
  assert.equal(
    "createCandidateEvaluationInputFingerprint" in OptimizerPublic,
    false
  );
  assert.equal("CANDIDATE_EVALUATION_FAILURE_STAGE" in OptimizerPublic, false);

  for (const code of [
    "OBJECTIVE_EVALUATION_FAILED",
    "SCORE_COMPOSITION_FAILED",
    "CANDIDATE_EVALUATION_UNEXPECTED_FAILURE",
    "INVALID_CANDIDATE_EVALUATION_FAILURE",
    "INVALID_CANDIDATE_EVALUATION_RESULT",
    "INVALID_CANDIDATE_INPUT_FINGERPRINT",
  ]) {
    assert.equal(CANDIDATE_EVALUATION_FAILURE_CODE[code], code);
  }

  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(root.includes("createCandidateEvaluationResult"), false);
  assert.equal(root.includes("evaluateCandidateSolution"), false);
  assert.equal(root.includes("composeCandidateOptimizationScore"), false);
});

test("E02: no prohibited imports in Phase 1C-B2-A sources", () => {
  const files = [
    path.join(OPT_ROOT, "contracts", "candidateEvaluationFailure.js"),
    path.join(OPT_ROOT, "contracts", "candidateEvaluationResult.js"),
    path.join(OPT_ROOT, "scoring", "composeCandidateOptimizationScore.js"),
    path.join(OPT_ROOT, "evaluation", "candidateEvaluationInputFingerprint.js"),
  ];
  const banned = [
    "constraints/evaluateCandidate",
    "constraints/evaluateHardRules",
    "registration-eligibility",
    "team-tournament",
    "private-pairing",
    "match-generation",
    "scheduling",
    "court-assignment",
    "referee",
    "@supabase",
    "Math.random",
    "Date.now",
    "localeCompare",
    "evaluateCandidateSolution",
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const b of banned) {
      assert.equal(
        text.includes(b),
        false,
        `${path.relative(ROOT, file)} must not reference ${b}`
      );
    }
  }
  const scoreSrc = readFileSync(
    path.join(OPT_ROOT, "scoring", "composeCandidateOptimizationScore.js"),
    "utf8"
  );
  assert.equal(scoreSrc.includes("from \"./compareScores.js\""), false);
  assert.equal(scoreSrc.includes("from '../scoring/compareScores.js'"), false);
  assert.equal(/\bbuildOptimizationScore\b/.test(scoreSrc), false);
  assert.match(scoreSrc, /createOptimizationScore/);
});

// ---------------------------------------------------------------------------
// F. Hardening — reserved codes, stage purity, lookalikes, ownership
// ---------------------------------------------------------------------------

test("F01: reserved INVALID_CANDIDATE_EVALUATION_FAILURE cannot be stored", () => {
  assertThrowsCode(
    () =>
      createCandidateEvaluationFailure({
        code: CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE,
        messageCode: "INVALID_CANDIDATE_EVALUATION_FAILURE",
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION,
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
  );
});

test("F02: failure rejects function/Error; portDescriptor alias removed", () => {
  assertThrowsCode(
    () =>
      createCandidateEvaluationFailure({
        code: CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED,
        messageCode: "SCORE_COMPOSITION_FAILED",
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,
        candidateId: () => "x",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
  );

  const desc = { portId: "p1", portVersion: "v1" };
  const failure = createCandidateEvaluationFailure({
    code: CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_EXCEPTION,
    messageCode: "CONSTRAINT_PORT_EXCEPTION",
    stage: CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
    portDescriptor: desc,
  });
  desc.portId = "MUTATED";
  assert.equal(failure.portDescriptor.portId, "p1");
  assert.notEqual(failure.portDescriptor, desc);
});

test("F03: EVALUATION_FAILED DEPENDENCY_VALIDATION forbids fingerprint/port", () => {
  const depFailure = createCandidateEvaluationFailure({
    code: CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_DEPENDENCIES,
    messageCode: "INVALID_CANDIDATE_EVALUATION_DEPENDENCIES",
    stage: CANDIDATE_EVALUATION_FAILURE_STAGE.DEPENDENCY_VALIDATION,
  });
  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: null,
        operation: null,
        status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
        feasible: false,
        structuralViolations: [],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [],
        optimizationScore: null,
        failure: depFailure,
        portDescriptor: portDesc(),
        inputFingerprint: null,
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );
  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: null,
        operation: null,
        status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
        feasible: false,
        structuralViolations: [],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [],
        optimizationScore: null,
        failure: depFailure,
        portDescriptor: null,
        inputFingerprint: "abcd1234",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );
  const ok = createCandidateEvaluationResult({
    candidateId: null,
    operation: null,
    status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
    feasible: false,
    structuralViolations: [],
    businessViolations: [],
    allHardViolations: [],
    objectiveEvaluations: [],
    optimizationScore: null,
    failure: depFailure,
    portDescriptor: null,
    inputFingerprint: null,
  });
  assert.equal(ok.portDescriptor, null);
  assert.equal(ok.inputFingerprint, null);
});

test("F04: result rejects loose HardViolation / Objective / Score lookalikes", () => {
  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: "cand-1",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        status: CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE,
        feasible: false,
        structuralViolations: [],
        businessViolations: [
          {
            violationCode: "HV",
            constraintId: "c",
            sourceModule: "M",
            sourceVersion: "1",
            severity: "SOFT",
            affectedIds: [],
            magnitude: 1,
            messageCode: "M",
            detailsCodes: [],
          },
        ],
        allHardViolations: [
          {
            violationCode: "HV",
            constraintId: "c",
            sourceModule: "M",
            sourceVersion: "1",
            severity: "SOFT",
            affectedIds: [],
            magnitude: 1,
            messageCode: "M",
            detailsCodes: [],
          },
        ],
        objectiveEvaluations: [],
        optimizationScore: composeCandidateOptimizationScore({
          candidateId: "cand-1",
          feasible: false,
          hardViolationCount: 1,
          authorityValues: [0],
          objectiveEvaluations: [],
        }),
        failure: null,
        portDescriptor: portDesc(),
        inputFingerprint: "abcd1234",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );

  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: "cand-1",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
        feasible: true,
        structuralViolations: [],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [
          {
            objectiveId: "OBJ_A",
            objectiveVersion: "1",
            evaluatorRef: "e",
            direction: OBJECTIVE_SENSE.MINIMIZE,
            executionIndex: 0,
            rawValue: 1,
            normalizedValue: 1,
            quantizedValue: 1,
            weightedValue: 1,
            orientedValue: 1.5,
            noteCodes: [],
          },
        ],
        optimizationScore: {
          feasible: true,
          hardViolationCount: 0,
          authorityValues: [0],
          objectiveValues: [1],
          comparatorVersion: CORE10_COMPARATOR_VERSION,
          candidateId: "cand-1",
        },
        failure: null,
        portDescriptor: portDesc(),
        inputFingerprint: "abcd1234",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );

  assertThrowsCode(
    () =>
      createCandidateEvaluationResult({
        candidateId: "cand-1",
        operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
        status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
        feasible: true,
        structuralViolations: [],
        businessViolations: [],
        allHardViolations: [],
        objectiveEvaluations: [],
        optimizationScore: {
          feasible: true,
          hardViolationCount: 0,
          authorityValues: [0],
          objectiveValues: [],
          comparatorVersion: "WRONG_COMPARATOR",
          candidateId: "cand-1",
        },
        failure: null,
        portDescriptor: portDesc(),
        inputFingerprint: "abcd1234",
      }),
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT
  );
});

test("F05: business/all HardViolation arrays independently owned", () => {
  const hv = createHardViolation(baseViolation());
  const score = composeCandidateOptimizationScore({
    candidateId: "cand-1",
    feasible: false,
    hardViolationCount: 1,
    authorityValues: [0],
    objectiveEvaluations: [],
  });
  const business = [hv];
  const all = [hv];
  const result = createCandidateEvaluationResult({
    candidateId: "cand-1",
    operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    status: CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE,
    feasible: false,
    structuralViolations: [],
    businessViolations: business,
    allHardViolations: all,
    objectiveEvaluations: [],
    optimizationScore: score,
    failure: null,
    portDescriptor: portDesc(),
    inputFingerprint: "abcd1234",
  });
  assert.notEqual(result.businessViolations, business);
  assert.notEqual(result.allHardViolations, all);
  assert.notEqual(result.businessViolations, result.allHardViolations);
  business.push(createHardViolation(baseViolation({ constraintId: "c-2" })));
  assert.equal(result.businessViolations.length, 1);
  assert.equal(result.allHardViolations.length, 1);
});

test("F06: snapshot order preserved; assignment order canonicalized in fingerprint", () => {
  const req = baseRequest({
    context: {
      tenantId: "tenant-1",
      competitionId: "comp-1",
      snapshotRefs: [
        {
          snapshotId: "snap-a",
          snapshotVersion: "v1",
          fingerprint: "aaaa1111",
          kind: "GENERIC",
        },
        {
          snapshotId: "snap-b",
          snapshotVersion: "v1",
          fingerprint: "bbbb2222",
          kind: "GENERIC",
        },
      ],
      metadata: {},
    },
  });
  const inputOrder = createCandidateEvaluationInput(
    baseInput({
      request: req,
      context: { ...req.context },
    })
  );
  const reqSwapped = baseRequest({
    context: {
      tenantId: "tenant-1",
      competitionId: "comp-1",
      snapshotRefs: [
        {
          snapshotId: "snap-b",
          snapshotVersion: "v1",
          fingerprint: "bbbb2222",
          kind: "GENERIC",
        },
        {
          snapshotId: "snap-a",
          snapshotVersion: "v1",
          fingerprint: "aaaa1111",
          kind: "GENERIC",
        },
      ],
      metadata: {},
    },
  });
  const inputSwapped = createCandidateEvaluationInput(
    baseInput({
      request: reqSwapped,
      context: { ...reqSwapped.context },
    })
  );
  const reg = registryWithObj();
  const port = noopPort();
  const fpOrder = createCandidateEvaluationInputFingerprint({
    input: inputOrder,
    objectiveRegistry: reg,
    constraintEvaluationPort: port,
  });
  const fpSwapped = createCandidateEvaluationInputFingerprint({
    input: inputSwapped,
    objectiveRegistry: reg,
    constraintEvaluationPort: port,
  });
  assert.notEqual(fpOrder, fpSwapped);

  // Loose assignment permutation on already-canonical input material still matches.
  const loose = {
    ...inputOrder,
    candidate: {
      ...inputOrder.candidate,
      assignments: [
        { variableId: "var-b", valueId: "b1" },
        { variableId: "var-a", valueId: "a1" },
      ],
    },
  };
  const fpLoose = createCandidateEvaluationInputFingerprint({
    input: loose,
    objectiveRegistry: reg,
    constraintEvaluationPort: port,
  });
  assert.equal(fpLoose, fpOrder);
});

test("F07: complete code/stage matrix reject cross-family pairs", () => {
  const pairs = [
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.MISSING_ASSIGNMENT,
      CANDIDATE_EVALUATION_FAILURE_STAGE.OBJECTIVE_EVALUATION,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_UNAVAILABLE,
      CANDIDATE_EVALUATION_FAILURE_STAGE.DEPENDENCY_VALIDATION,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_HARD_VIOLATION,
      CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATION_FAILED,
      CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED,
      CANDIDATE_EVALUATION_FAILURE_STAGE.HARD_COMPOSITION,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT_FINGERPRINT,
      CANDIDATE_EVALUATION_FAILURE_STAGE.UNEXPECTED_FAILURE,
    ],
    [
      CANDIDATE_EVALUATION_FAILURE_CODE.CANDIDATE_EVALUATION_UNEXPECTED_FAILURE,
      CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION,
    ],
  ];
  for (const [code, stage] of pairs) {
    assertThrowsCode(
      () =>
        createCandidateEvaluationFailure({
          code,
          messageCode: code,
          stage,
        }),
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
    );
  }
});

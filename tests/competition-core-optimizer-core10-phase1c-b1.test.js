/**
 * CORE-10 Phase 1C-B1 — candidate evaluation contracts, port, HardViolation (hardened).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as OptimizerPublic from "../src/features/competition-core/optimizer/index.js";

import {
  OPTIMIZATION_STATUS,
  OPTIMIZATION_OPERATION,
  SOLVER_STRATEGY,
  CONSTRAINT_KIND,
  OBJECTIVE_EVALUATION_FAILURE_CODE,
  CANDIDATE_EVALUATION_STATUS,
  CANDIDATE_EVALUATION_FAILURE_CODE,
  CORE10_SCHEMA_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION,
  CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION,
  CORE10_HARD_VIOLATION_SCHEMA_VERSION,
  CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
  CORE10_HARD_VIOLATION_COMPOSITION_VERSION,
  OptimizerContractError,
  createObjectiveRegistry,
  createCandidateEvaluationInput,
  createCandidateEvaluationDependencies,
  createHardViolation,
  createConstraintEvaluationPort,
  validateCandidateEvaluationInput,
  composeHardViolations,
  serializeCanonical,
  fingerprintValue,
} from "../src/features/competition-core/optimizer/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

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

function noopPort() {
  return createConstraintEvaluationPort({
    portId: "CORE10_NOOP_CONSTRAINT_PORT",
    portVersion: CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
    evaluateConstraints: () => ({ violations: [], noteCodes: [] }),
  });
}

function emptyRegistry() {
  return createObjectiveRegistry([]);
}

function portInput(overrides = {}) {
  return {
    candidateId: "cand-1",
    operation: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    assignments: [
      { variableId: "var-b", valueId: "b1" },
      { variableId: "var-a", valueId: "a1" },
    ],
    tenantId: "tenant-1",
    competitionId: "comp-1",
    snapshotFingerprints: ["abcdef01"],
    facts: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A. Status / failure codes
// ---------------------------------------------------------------------------

test("A01: candidate status enum exact values; no run-level collision", () => {
  assert.deepEqual(
    { ...CANDIDATE_EVALUATION_STATUS },
    {
      VALID_FEASIBLE: "VALID_FEASIBLE",
      VALID_INFEASIBLE: "VALID_INFEASIBLE",
      INVALID_CANDIDATE: "INVALID_CANDIDATE",
      EVALUATION_FAILED: "EVALUATION_FAILED",
    }
  );
  assert.ok(Object.isFrozen(CANDIDATE_EVALUATION_STATUS));
  for (const v of Object.values(CANDIDATE_EVALUATION_STATUS)) {
    assert.equal(Object.values(OPTIMIZATION_STATUS).includes(v), false);
  }
});

test("A02: failure codes stable and distinct from objective failures", () => {
  const codes = Object.values(CANDIDATE_EVALUATION_FAILURE_CODE);
  assert.ok(codes.includes("INVALID_CANDIDATE_INPUT"));
  assert.ok(codes.includes("HARD_VIOLATION_MAGNITUDE_CONFLICT"));
  for (const c of codes) {
    assert.equal(
      Object.values(OBJECTIVE_EVALUATION_FAILURE_CODE).includes(c),
      false
    );
    assert.notEqual(c, "INFEASIBLE");
  }
});

// ---------------------------------------------------------------------------
// B. CandidateEvaluationInput
// ---------------------------------------------------------------------------

test("B01: valid input; frozen; assignments canonically ordered", () => {
  const input = createCandidateEvaluationInput(baseInput());
  assert.deepEqual(
    input.candidate.assignments.map((a) => a.variableId),
    ["var-a", "var-b"]
  );
  assert.ok(Object.isFrozen(input));
  assert.equal(
    input.schemaVersion,
    CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION
  );
});

test("B02: caller not frozen; nested aliases removed; arrays copied", () => {
  const raw = baseInput();
  const assignments = raw.candidate.assignments;
  const before = assignments.map((a) => ({ ...a }));
  const input = createCandidateEvaluationInput(raw);
  assert.equal(Object.isFrozen(raw), false);
  assert.equal(Object.isFrozen(raw.candidate), false);
  assert.equal(Object.isFrozen(assignments), false);
  assert.deepEqual(assignments, before);
  assignments[0].valueId = "MUTATED";
  assert.equal(input.candidate.assignments[0].valueId, "a1");
});

test("B03: every DecisionVariable must be assigned exactly once", () => {
  // required:false var-b still requires an assignment
  assert.equal(
    validateCandidateEvaluationInput(
      baseInput({
        candidate: baseCandidate({
          assignments: [{ variableId: "var-a", valueId: "a1" }],
        }),
      })
    ).code,
    CANDIDATE_EVALUATION_FAILURE_CODE.MISSING_ASSIGNMENT
  );
  assert.equal(
    validateCandidateEvaluationInput(
      baseInput({
        candidate: baseCandidate({
          assignments: [
            { variableId: "var-a", valueId: "a1" },
            { variableId: "var-a", valueId: "a2" },
          ],
        }),
      })
    ).code,
    CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_ASSIGNMENT
  );
  assert.equal(
    validateCandidateEvaluationInput(
      baseInput({
        candidate: baseCandidate({
          assignments: [
            { variableId: "var-a", valueId: "a1" },
            { variableId: "var-b", valueId: "b1" },
            { variableId: "var-z", valueId: "z1" },
          ],
        }),
      })
    ).code,
    CANDIDATE_EVALUATION_FAILURE_CODE.UNKNOWN_DECISION_VARIABLE
  );
});

test("B04: outside domain / whitespace / inherited props / unknown fields", () => {
  assert.equal(
    validateCandidateEvaluationInput(
      baseInput({
        candidate: baseCandidate({
          assignments: [
            { variableId: "var-a", valueId: "nope" },
            { variableId: "var-b", valueId: "b1" },
          ],
        }),
      })
    ).code,
    CANDIDATE_EVALUATION_FAILURE_CODE.ASSIGNMENT_OUTSIDE_DOMAIN
  );
  assert.throws(() =>
    createCandidateEvaluationInput(
      baseInput({
        candidate: baseCandidate({
          assignments: [
            { variableId: "  ", valueId: "a1" },
            { variableId: "var-b", valueId: "b1" },
          ],
        }),
      })
    )
  );
  const proto = {
    variableId: "var-a",
    valueId: "a1",
  };
  const inherited = Object.create(proto);
  assert.throws(() =>
    createCandidateEvaluationInput(
      baseInput({
        candidate: baseCandidate({
          assignments: [inherited, { variableId: "var-b", valueId: "b1" }],
        }),
      })
    )
  );
  assert.throws(() =>
    createCandidateEvaluationInput({ ...baseInput(), extra: true })
  );
});

test("B05: operation / tenant / competition / snapshot; stable failure shape", () => {
  const op = validateCandidateEvaluationInput(
    baseInput({
      candidate: baseCandidate({
        operation: OPTIMIZATION_OPERATION.GENERIC_ASSIGNMENT,
      }),
    })
  );
  assert.equal(op.ok, false);
  assert.equal(op.code, CANDIDATE_EVALUATION_FAILURE_CODE.OPERATION_MISMATCH);
  assert.equal(op.messageCode, op.code);
  assert.equal("message" in op, false);
  assert.ok(Object.isFrozen(op.details));

  const tenantBad = baseInput();
  tenantBad.context = { ...tenantBad.context, tenantId: "other" };
  assert.equal(
    validateCandidateEvaluationInput(tenantBad).code,
    CANDIDATE_EVALUATION_FAILURE_CODE.TENANT_SCOPE_MISMATCH
  );

  const compBad = baseInput();
  compBad.context = { ...compBad.context, competitionId: "other" };
  assert.equal(
    validateCandidateEvaluationInput(compBad).code,
    CANDIDATE_EVALUATION_FAILURE_CODE.COMPETITION_SCOPE_MISMATCH
  );

  const snapBad = baseInput();
  snapBad.context = {
    ...snapBad.context,
    snapshotRefs: [
      { snapshotId: "snap-1", snapshotVersion: "v1", fingerprint: "" },
    ],
  };
  assert.equal(
    validateCandidateEvaluationInput(snapBad).code,
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_SNAPSHOT_BINDING
  );
});

test("B06: assignment permutation determinism; delimiter/Unicode/null IDs", () => {
  const specialDomain = ["a|b", "a", "日本語", "x\u0000y", "a/b", "punc!@#"];
  const dvs = [
    { variableId: "v|1", domain: specialDomain, required: true },
    { variableId: "v/2", domain: ["ok"], required: true },
  ];
  const req = baseRequest({
    decisionVariables: dvs,
    policy: {
      policyId: "pol-1",
      policyVersion: "1",
      objectiveKeys: [],
      authorityKeys: [],
      comparatorVersion: CORE10_COMPARATOR_VERSION,
      quantizeScale: 1,
    },
  });
  const mk = (assignments) =>
    createCandidateEvaluationInput({
      ...baseInput({
        request: req,
        context: { ...req.context },
        decisionVariables: dvs.map((d) => ({ ...d, domain: [...d.domain] })),
        authorityValues: [],
        objectiveExecutionSpecs: [],
        candidate: baseCandidate({ assignments }),
      }),
    });

  const a = mk([
    { variableId: "v/2", valueId: "ok" },
    { variableId: "v|1", valueId: "a|b" },
  ]);
  const b = mk([
    { variableId: "v|1", valueId: "a|b" },
    { variableId: "v/2", valueId: "ok" },
  ]);
  assert.equal(serializeCanonical(a.candidate.assignments), serializeCanonical(b.candidate.assignments));
  assert.equal(a.candidate.assignments[0].variableId, "v/2");
  assert.equal(a.candidate.assignments[1].variableId, "v|1");

  const u = mk([
    { variableId: "v|1", valueId: "日本語" },
    { variableId: "v/2", valueId: "ok" },
  ]);
  assert.equal(u.candidate.assignments[1].valueId, "日本語");
  const n = mk([
    { variableId: "v|1", valueId: "x\u0000y" },
    { variableId: "v/2", valueId: "ok" },
  ]);
  assert.equal(n.candidate.assignments[1].valueId, "x\u0000y");
});

test("B07: objectiveExecutionSpecs order preserved; cyclic/unsupported fail", () => {
  const specs = [
    { objectiveId: "OBJ_Z", objectiveVersion: "1", weight: 1, quantizeScale: 1 },
    { objectiveId: "OBJ_A", objectiveVersion: "1", weight: 2, quantizeScale: 1 },
  ];
  const input = createCandidateEvaluationInput(
    baseInput({ objectiveExecutionSpecs: specs })
  );
  assert.deepEqual(
    input.objectiveExecutionSpecs.map((s) => s.objectiveId),
    ["OBJ_Z", "OBJ_A"]
  );
  assert.deepEqual(
    specs.map((s) => s.objectiveId),
    ["OBJ_Z", "OBJ_A"]
  );

  const cyclic = baseInput();
  const node = { variableId: "var-a", valueId: "a1" };
  /** @type {any} */ (node).self = node;
  cyclic.candidate.assignments = [node, { variableId: "var-b", valueId: "b1" }];
  assert.throws(() => createCandidateEvaluationInput(cyclic));
  assert.throws(() =>
    createCandidateEvaluationInput(baseInput({ authorityValues: [Number.NaN] }))
  );
});

// ---------------------------------------------------------------------------
// C. Dependencies
// ---------------------------------------------------------------------------

test("C01: valid deps; missing rejected; immutable; no fingerprint", () => {
  const registry = emptyRegistry();
  const port = noopPort();
  const deps = createCandidateEvaluationDependencies({
    objectiveRegistry: registry,
    constraintEvaluationPort: port,
  });
  assert.equal(
    deps.dependenciesVersion,
    CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION
  );
  assert.ok(Object.isFrozen(deps));
  assert.throws(() => fingerprintValue(deps));
  assert.throws(() => serializeCanonical(deps));
  assert.throws(() =>
    createCandidateEvaluationDependencies({
      objectiveRegistry: registry,
      constraintEvaluationPort: port,
      allowMissingPort: true,
    })
  );
});

test("C02: loose registry and loose port rejected", () => {
  const looseRegistry = {
    resolve() {},
    has() {},
    listDefinitions() {},
    descriptorFingerprint() {},
  };
  assert.throws(
    () =>
      createCandidateEvaluationDependencies({
        objectiveRegistry: looseRegistry,
        constraintEvaluationPort: noopPort(),
      }),
    (err) =>
      err.code ===
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_DEPENDENCIES
  );

  const loosePort = {
    portId: "x",
    portVersion: "1",
    evaluateConstraints: () => ({ violations: [] }),
  };
  assert.throws(
    () =>
      createCandidateEvaluationDependencies({
        objectiveRegistry: emptyRegistry(),
        constraintEvaluationPort: loosePort,
      }),
    (err) =>
      err.code === CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID
  );
});

// ---------------------------------------------------------------------------
// D. HardViolation
// ---------------------------------------------------------------------------

test("D01: HardViolation sorting/immutability; own props; schema", () => {
  const affected = ["z", "a", "m"];
  const details = ["c", "a"];
  const beforeA = [...affected];
  const beforeD = [...details];
  const v = createHardViolation(
    baseViolation({ affectedIds: affected, detailsCodes: details })
  );
  assert.deepEqual([...v.affectedIds], ["a", "m", "z"]);
  assert.deepEqual([...v.detailsCodes], ["a", "c"]);
  assert.deepEqual(affected, beforeA);
  assert.deepEqual(details, beforeD);
  assert.ok(Object.isFrozen(v));
  assert.ok(CORE10_HARD_VIOLATION_SCHEMA_VERSION.includes("HARD_VIOLATION"));

  const proto = baseViolation();
  const inherited = Object.create(proto);
  assert.throws(
    () => createHardViolation(inherited),
    (err) => err.code === CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_HARD_VIOLATION
  );
});

test("D02: HardViolation rejects soft/dupes/unsafe/free-text", () => {
  assert.throws(() => createHardViolation(baseViolation({ severity: "SOFT" })));
  assert.throws(() =>
    createHardViolation(baseViolation({ affectedIds: ["a", "a"] }))
  );
  assert.throws(() =>
    createHardViolation(baseViolation({ detailsCodes: ["x", "x"] }))
  );
  assert.throws(() => createHardViolation(baseViolation({ magnitude: -1 })));
  assert.throws(() => createHardViolation(baseViolation({ magnitude: 1.5 })));
  assert.throws(() =>
    createHardViolation(baseViolation({ magnitude: Number.NaN }))
  );
  assert.throws(() =>
    createHardViolation(baseViolation({ magnitude: Number.POSITIVE_INFINITY }))
  );
  assert.throws(() =>
    createHardViolation(baseViolation({ magnitude: Number.MAX_SAFE_INTEGER + 1 }))
  );
  assert.throws(() =>
    createHardViolation(baseViolation({ message: "free text" }))
  );
  assert.throws(() =>
    createHardViolation(baseViolation({ description: "x" }))
  );
  assert.throws(() =>
    createHardViolation(baseViolation({ displayText: "x" }))
  );
  assert.throws(() =>
    createHardViolation(baseViolation({ localizedText: "x" }))
  );
  assert.throws(() => createHardViolation(baseViolation({ stack: "trace" })));
  assert.throws(() =>
    createHardViolation(baseViolation({ violationCode: "  " }))
  );
});

// ---------------------------------------------------------------------------
// E. Constraint port
// ---------------------------------------------------------------------------

test("E01: owned frozen input; caller not frozen; encapsulation", () => {
  let calls = 0;
  const rawEvaluator = (input) => {
    calls += 1;
    try {
      input.candidateId = "HACK";
    } catch {
      // frozen
    }
    try {
      input.assignments[0].valueId = "HACK";
    } catch {
      // frozen
    }
    try {
      input.facts.injected = true;
    } catch {
      // frozen
    }
    return { violations: [baseViolation()], noteCodes: ["N_B", "N_A"] };
  };
  const port = createConstraintEvaluationPort({
    portId: "FAKE_PORT",
    portVersion: CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
    evaluateConstraints: rawEvaluator,
  });
  assert.notEqual(port.evaluateConstraints, rawEvaluator);
  assert.deepEqual(Object.keys(port).sort(), [
    "evaluateConstraints",
    "portId",
    "portVersion",
  ]);
  assert.equal("evaluator" in port, false);
  assert.ok(Object.isFrozen(port));

  const raw = portInput({ facts: { keep: 1 } });
  const result = port.evaluateConstraints(raw);
  assert.equal(calls, 1);
  assert.equal(Object.isFrozen(raw), false);
  assert.equal(raw.candidateId, "cand-1");
  assert.equal(raw.facts.injected, undefined);
  assert.deepEqual([...result.noteCodes], ["N_A", "N_B"]);

  // Cannot replace evaluateConstraints on frozen port
  assert.throws(() => {
    /** @type {any} */ (port).evaluateConstraints = () => ({ violations: [] });
  });
});

test("E02: Promise / thenable / exception / missing violations / unknown fields", () => {
  const asyncPort = createConstraintEvaluationPort({
    portId: "ASYNC",
    portVersion: "1",
    evaluateConstraints: async () => ({ violations: [] }),
  });
  assert.throws(
    () => asyncPort.evaluateConstraints(portInput()),
    (err) =>
      err.code ===
      CANDIDATE_EVALUATION_FAILURE_CODE.ASYNC_CONSTRAINT_PORT_UNSUPPORTED
  );

  const thenablePort = createConstraintEvaluationPort({
    portId: "THENABLE",
    portVersion: "1",
    evaluateConstraints: () => ({ then: () => {} }),
  });
  assert.throws(
    () => thenablePort.evaluateConstraints(portInput()),
    (err) =>
      err.code ===
      CANDIDATE_EVALUATION_FAILURE_CODE.ASYNC_CONSTRAINT_PORT_UNSUPPORTED
  );

  const boom = createConstraintEvaluationPort({
    portId: "BOOM",
    portVersion: "1",
    evaluateConstraints: () => {
      throw new Error("secret stack should not leak");
    },
  });
  try {
    boom.evaluateConstraints(portInput());
    assert.fail("expected throw");
  } catch (err) {
    assert.ok(err instanceof OptimizerContractError);
    assert.equal(
      err.code,
      CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_EXCEPTION
    );
    assert.equal(err.message.includes("secret"), false);
    assert.equal(JSON.stringify(err.details).includes("secret"), false);
  }

  const missingViolations = createConstraintEvaluationPort({
    portId: "MISS",
    portVersion: "1",
    evaluateConstraints: () => ({ noteCodes: [] }),
  });
  assert.throws(
    () => missingViolations.evaluateConstraints(portInput()),
    (err) =>
      err.code ===
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
  );

  const badShape = createConstraintEvaluationPort({
    portId: "BAD",
    portVersion: "1",
    evaluateConstraints: () => ({ violations: [], message: "nope" }),
  });
  assert.throws(() => badShape.evaluateConstraints(portInput()));

  const dupNotes = createConstraintEvaluationPort({
    portId: "DUPN",
    portVersion: "1",
    evaluateConstraints: () => ({ violations: [], noteCodes: ["A", "A"] }),
  });
  assert.throws(() => dupNotes.evaluateConstraints(portInput()));

  // Evaluator result aliases must not leak into returned owned result
  const shared = baseViolation();
  const aliasPort = createConstraintEvaluationPort({
    portId: "ALIAS",
    portVersion: "1",
    evaluateConstraints: () => ({ violations: [shared] }),
  });
  const out = aliasPort.evaluateConstraints(portInput());
  shared.magnitude = 99;
  assert.equal(out.violations[0].magnitude, 1);
});

// ---------------------------------------------------------------------------
// F. Hard-violation composition
// ---------------------------------------------------------------------------

test("F01: empty / ordering / dedupe / permutations", () => {
  const empty = composeHardViolations([], []);
  assert.deepEqual([...empty], []);
  assert.ok(Object.isFrozen(empty));

  const mk = (sourceModule, magnitude = 1) =>
    baseViolation({
      sourceModule,
      sourceVersion: "1",
      violationCode: "V",
      constraintId: "C",
      affectedIds: ["x"],
      magnitude,
      messageCode: "M",
      detailsCodes: [],
    });

  const group = [mk("M2", 2), mk("M1", 1)];
  const before = group.map((v) => ({ ...v, affectedIds: [...v.affectedIds] }));
  const out = composeHardViolations(group, [mk("M2", 2)]);
  assert.deepEqual(group, before);
  assert.equal(out.length, 2);
  assert.equal(out[0].sourceModule, "M1");

  const p1 = composeHardViolations([mk("Z"), mk("A")]);
  const p2 = composeHardViolations([mk("A"), mk("Z")]);
  assert.deepEqual(
    p1.map((v) => v.sourceModule),
    p2.map((v) => v.sourceModule)
  );
});

test("F02: delimiter/affected-ID collision safety; conflicts", () => {
  const left = createHardViolation(
    baseViolation({
      sourceModule: "A|B",
      sourceVersion: "1",
      violationCode: "V",
      constraintId: "C",
      affectedIds: ["x"],
      magnitude: 1,
      messageCode: "M",
      detailsCodes: [],
    })
  );
  const right = createHardViolation(
    baseViolation({
      sourceModule: "A",
      sourceVersion: "B|1",
      violationCode: "V",
      constraintId: "C",
      affectedIds: ["x"],
      magnitude: 1,
      messageCode: "M",
      detailsCodes: [],
    })
  );
  assert.equal(composeHardViolations([left, right]).length, 2);

  const t1 = createHardViolation(
    baseViolation({
      affectedIds: ["a|b", "c"],
      magnitude: 1,
      messageCode: "M",
      detailsCodes: [],
    })
  );
  const t2 = createHardViolation(
    baseViolation({
      affectedIds: ["a", "b|c"],
      magnitude: 1,
      messageCode: "M",
      detailsCodes: [],
    })
  );
  assert.equal(composeHardViolations([t1, t2]).length, 2);

  const base = {
    sourceModule: "M",
    sourceVersion: "1",
    violationCode: "V",
    constraintId: "C",
    severity: CONSTRAINT_KIND.HARD,
    affectedIds: ["x"],
    messageCode: "MSG",
    detailsCodes: ["D"],
  };
  assert.throws(
    () =>
      composeHardViolations([
        baseViolation({ ...base, magnitude: 1 }),
        baseViolation({ ...base, magnitude: 2 }),
      ]),
    (err) =>
      err.code ===
      CANDIDATE_EVALUATION_FAILURE_CODE.HARD_VIOLATION_MAGNITUDE_CONFLICT
  );
  assert.throws(
    () =>
      composeHardViolations([
        baseViolation({ ...base, magnitude: 1, messageCode: "A" }),
        baseViolation({ ...base, magnitude: 1, messageCode: "B" }),
      ]),
    (err) =>
      err.code === CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_HARD_VIOLATION
  );
  assert.throws(
    () =>
      composeHardViolations([
        baseViolation({ ...base, magnitude: 1, detailsCodes: ["A"] }),
        baseViolation({ ...base, magnitude: 1, detailsCodes: ["B"] }),
      ]),
    (err) =>
      err.code === CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_HARD_VIOLATION
  );
});

// ---------------------------------------------------------------------------
// G. Structural validation / ownership
// ---------------------------------------------------------------------------

test("G01: structural validation; no HardViolation/port/result", () => {
  const result = validateCandidateEvaluationInput(
    baseInput({
      candidate: baseCandidate({
        assignments: [{ variableId: "var-a", valueId: "a1" }],
      }),
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, CANDIDATE_EVALUATION_FAILURE_CODE.MISSING_ASSIGNMENT);
  assert.equal(result.messageCode, result.code);
  assert.equal("violations" in result, false);
  assert.equal("optimizationScore" in result, false);
  assert.equal("status" in result, false);
});

test("H01: public API allowlist; no B2 symbols; root barrel untouched", () => {
  for (const key of [
    "CANDIDATE_EVALUATION_STATUS",
    "CANDIDATE_EVALUATION_FAILURE_CODE",
    "createCandidateEvaluationInput",
    "createCandidateEvaluationDependencies",
    "createHardViolation",
    "createConstraintEvaluationPort",
    "validateCandidateEvaluationInput",
    "composeHardViolations",
    "CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION",
    "CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION",
    "CORE10_HARD_VIOLATION_SCHEMA_VERSION",
    "CORE10_CONSTRAINT_EVALUATION_PORT_VERSION",
    "CORE10_HARD_VIOLATION_COMPOSITION_VERSION",
  ]) {
    assert.equal(key in OptimizerPublic, true, key);
  }

  assert.equal("evaluateCandidateSolution" in OptimizerPublic, false);
  assert.equal("createCandidateEvaluationResult" in OptimizerPublic, false);
  assert.equal("composeCandidateOptimizationScore" in OptimizerPublic, false);
  assert.equal("isConstraintEvaluationPort" in OptimizerPublic, false);
  assert.equal("CORE10_NOOP_CONSTRAINT_PORT_ID" in OptimizerPublic, false);
  assert.equal("identityKey" in OptimizerPublic, false);

  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(root.includes("createCandidateEvaluationInput"), false);
  assert.equal(root.includes("evaluateCandidateSolution"), false);

  const portsBarrel = readFileSync(
    path.join(OPT_ROOT, "ports", "index.js"),
    "utf8"
  );
  assert.equal(portsBarrel.includes("isConstraintEvaluationPort"), false);
  assert.equal(portsBarrel.includes("CORE10_NOOP_CONSTRAINT_PORT_ID"), false);
});

test("H02: no prohibited imports in Phase 1C-B1 sources", () => {
  const files = [
    ...listJsFiles(path.join(OPT_ROOT, "evaluation")),
    ...listJsFiles(path.join(OPT_ROOT, "ports")),
    path.join(OPT_ROOT, "contracts", "candidateEvaluationInput.js"),
    path.join(OPT_ROOT, "contracts", "candidateEvaluationDependencies.js"),
    path.join(OPT_ROOT, "contracts", "hardViolation.js"),
    path.join(OPT_ROOT, "enums", "candidateEvaluationStatus.js"),
    path.join(OPT_ROOT, "enums", "candidateEvaluationFailureCodes.js"),
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
    assert.equal(text.includes("evaluateCandidateSolution"), false);
    assert.equal(text.includes("createCandidateEvaluationResult"), false);
    assert.equal(text.includes("composeCandidateOptimizationScore"), false);
  }
});

/**
 * CORE-10 Phase 1C-A — objective definitions, registry, deterministic evaluation.
 * Hardened coverage: ownership, nested Map keys, context own-properties, numerics.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as OptimizerPublic from "../src/features/competition-core/optimizer/index.js";

import {
  OBJECTIVE_SENSE,
  OBJECTIVE_EVALUATION_FAILURE_CODE,
  CORE10_OBJECTIVE_DEFINITION_SCHEMA_VERSION,
  CORE10_OBJECTIVE_REGISTRY_VERSION,
  CORE10_OBJECTIVE_EVALUATION_VERSION,
  OptimizerContractError,
  createObjectiveDefinition,
  OBJECTIVE_NORMALIZATION_POLICY,
  createObjectiveExecutionSpec,
  createObjectiveEvaluationRecord,
  createObjectiveRegistry,
  evaluateObjective,
  evaluateObjectives,
} from "../src/features/competition-core/optimizer/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");
const OBJ_ROOT = path.join(OPT_ROOT, "objectives");

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

function baseDefinition(overrides = {}) {
  return {
    objectiveId: "OBJ_TEST",
    objectiveVersion: "1",
    direction: OBJECTIVE_SENSE.MINIMIZE,
    evaluatorRef: "eval.test.v1",
    ...overrides,
  };
}

function constantEvaluator(rawValue, noteCodes) {
  return () => {
    const out = { rawValue };
    if (noteCodes != null) out.noteCodes = noteCodes;
    return out;
  };
}

function trackingEvaluator(state, rawValue) {
  return () => {
    state.calls += 1;
    return { rawValue };
  };
}

// ---------------------------------------------------------------------------
// A. ObjectiveDefinition
// ---------------------------------------------------------------------------

test("A01: valid ObjectiveDefinition is accepted and frozen", () => {
  const def = createObjectiveDefinition(
    baseDefinition({
      requiredContextRefs: ["ctx.b", "ctx.a"],
      metadataCodes: ["META_B", "META_A"],
    })
  );
  assert.equal(def.objectiveId, "OBJ_TEST");
  assert.equal(def.normalizationPolicy, OBJECTIVE_NORMALIZATION_POLICY.NONE);
  assert.deepEqual([...def.requiredContextRefs], ["ctx.a", "ctx.b"]);
  assert.deepEqual([...def.metadataCodes], ["META_A", "META_B"]);
  assert.ok(Object.isFrozen(def));
  assert.ok(CORE10_OBJECTIVE_DEFINITION_SCHEMA_VERSION.includes("OBJECTIVE"));
});

test("A02: unknown fields and invalid direction rejected", () => {
  assert.throws(
    () => createObjectiveDefinition(baseDefinition({ weight: 1 })),
    (err) =>
      err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_DEFINITION
  );
  assert.throws(() =>
    createObjectiveDefinition(baseDefinition({ direction: "BEST" }))
  );
});

test("A03: empty / whitespace IDs rejected; caller arrays not sorted in place", () => {
  for (const field of ["objectiveId", "objectiveVersion", "evaluatorRef"]) {
    assert.throws(() =>
      createObjectiveDefinition(baseDefinition({ [field]: "  " }))
    );
  }
  const refs = ["z", "m", "a"];
  const before = [...refs];
  createObjectiveDefinition(baseDefinition({ requiredContextRefs: refs }));
  assert.deepEqual(refs, before);
});

test("A04: duplicate context/metadata codes rejected; inherited props ignored", () => {
  assert.throws(() =>
    createObjectiveDefinition(baseDefinition({ requiredContextRefs: ["a", "a"] }))
  );
  const proto = { objectiveId: "FROM_PROTO", objectiveVersion: "9", evaluatorRef: "x", direction: OBJECTIVE_SENSE.MINIMIZE };
  const obj = Object.create(proto);
  obj.direction = OBJECTIVE_SENSE.MINIMIZE;
  assert.throws(
    () => createObjectiveDefinition(obj),
    (err) =>
      err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_DEFINITION
  );
});

test("A05: caller input not frozen; functions/Date/Map rejected", () => {
  const input = baseDefinition({ requiredContextRefs: ["b", "a"] });
  assert.equal(Object.isFrozen(input), false);
  createObjectiveDefinition(input);
  assert.equal(Object.isFrozen(input), false);
  assert.deepEqual(input.requiredContextRefs, ["b", "a"]);
  assert.throws(() =>
    createObjectiveDefinition(baseDefinition({ metadataCodes: [() => 1] }))
  );
  assert.throws(() =>
    createObjectiveDefinition(baseDefinition({ requiredContextRefs: [new Date()] }))
  );
  assert.throws(() =>
    createObjectiveDefinition(baseDefinition({ requiredContextRefs: [new Map()] }))
  );
});

test("A06: Unicode IDs accepted; NaN metadata rejected", () => {
  const def = createObjectiveDefinition(
    baseDefinition({ objectiveId: "OBJ_日本語", evaluatorRef: "eval.ü.v1" })
  );
  assert.equal(def.objectiveId, "OBJ_日本語");
  assert.throws(() =>
    createObjectiveDefinition(baseDefinition({ metadataCodes: [NaN] }))
  );
});

// ---------------------------------------------------------------------------
// B. ObjectiveExecutionSpec
// ---------------------------------------------------------------------------

test("B01: valid spec; order field rejected; bad weights rejected", () => {
  const spec = createObjectiveExecutionSpec({
    objectiveId: "OBJ_TEST",
    objectiveVersion: "1",
    weight: 2,
    quantizeScale: 10,
  });
  assert.equal(spec.weight, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(spec, "order"), false);
  const base = {
    objectiveId: "OBJ_TEST",
    objectiveVersion: "1",
    quantizeScale: 1,
  };
  for (const weight of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    assert.throws(() => createObjectiveExecutionSpec({ ...base, weight }));
  }
  assert.throws(() =>
    createObjectiveExecutionSpec({ ...base, weight: 1, order: 3 })
  );
});

// ---------------------------------------------------------------------------
// C. Registry
// ---------------------------------------------------------------------------

test("C01: nested Map collision-safe for @ in id/version", () => {
  const registry = createObjectiveRegistry([
    {
      definition: baseDefinition({
        objectiveId: "a@b",
        objectiveVersion: "c",
        evaluatorRef: "e1",
      }),
      evaluator: constantEvaluator(1),
    },
    {
      definition: baseDefinition({
        objectiveId: "a",
        objectiveVersion: "b@c",
        evaluatorRef: "e2",
      }),
      evaluator: constantEvaluator(2),
    },
  ]);
  assert.equal(registry.has("a@b", "c"), true);
  assert.equal(registry.has("a", "b@c"), true);
  assert.equal(registry.resolve("a@b", "c").definition.objectiveId, "a@b");
  assert.equal(registry.resolve("a", "b@c").definition.objectiveVersion, "b@c");
});

test("C02: duplicate registration rejected; independent registries", () => {
  assert.throws(
    () =>
      createObjectiveRegistry([
        { definition: baseDefinition(), evaluator: constantEvaluator(1) },
        { definition: baseDefinition(), evaluator: constantEvaluator(2) },
      ]),
    (err) =>
      err.code ===
      OBJECTIVE_EVALUATION_FAILURE_CODE.DUPLICATE_OBJECTIVE_REGISTRATION
  );
  const a = createObjectiveRegistry([
    { definition: baseDefinition(), evaluator: constantEvaluator(1) },
  ]);
  const b = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_OTHER" }),
      evaluator: constantEvaluator(9),
    },
  ]);
  assert.equal(a.has("OBJ_OTHER", "1"), false);
  assert.notEqual(a.descriptorFingerprint(), b.descriptorFingerprint());
});

test("C03: resolve encapsulation; listDefinitions owned; no evaluators in list", () => {
  const registry = createObjectiveRegistry([
    { definition: baseDefinition(), evaluator: constantEvaluator(1) },
  ]);
  const r1 = registry.resolve("OBJ_TEST", "1");
  const r2 = registry.resolve("OBJ_TEST", "1");
  assert.notEqual(r1, r2);
  assert.notEqual(r1.definition, r2.definition);
  assert.ok(Object.isFrozen(r1));
  assert.ok(Object.isFrozen(r1.definition));
  assert.throws(() => {
    /** @type {any} */ (r1).definition = null;
  });

  const list = registry.listDefinitions();
  assert.equal(list.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(list[0], "evaluator"), false);
  assert.notEqual(list[0], registry.resolve("OBJ_TEST", "1").definition);
  assert.throws(() => {
    /** @type {any} */ (list).push({});
  });
  assert.throws(() => {
    /** @type {any} */ (registry).resolve = () => {};
  });
});

test("C04: fingerprint insertion-order independent; evaluator change ignored; material change differs", () => {
  const defA = baseDefinition({ objectiveId: "OBJ_A" });
  const defB = baseDefinition({ objectiveId: "OBJ_B" });
  const r1 = createObjectiveRegistry([
    { definition: defA, evaluator: constantEvaluator(1) },
    { definition: defB, evaluator: constantEvaluator(2) },
  ]);
  const r2 = createObjectiveRegistry([
    { definition: defB, evaluator: () => ({ rawValue: 999 }) },
    { definition: defA, evaluator: () => ({ rawValue: -999 }) },
  ]);
  assert.equal(r1.descriptorFingerprint(), r2.descriptorFingerprint());

  const r3 = createObjectiveRegistry([
    {
      definition: baseDefinition({
        objectiveId: "OBJ_A",
        evaluatorRef: "eval.changed.v1",
      }),
      evaluator: constantEvaluator(1),
    },
    { definition: defB, evaluator: constantEvaluator(2) },
  ]);
  assert.notEqual(r1.descriptorFingerprint(), r3.descriptorFingerprint());
  assert.ok(CORE10_OBJECTIVE_REGISTRY_VERSION.includes("REGISTRY"));
});

test("C05: caller definition mutation after registry construction does not alter stored state", () => {
  const mutableDef = baseDefinition({
    requiredContextRefs: ["ctx.a"],
    metadataCodes: ["M1"],
  });
  const registry = createObjectiveRegistry([
    { definition: mutableDef, evaluator: constantEvaluator(1) },
  ]);
  const fpBefore = registry.descriptorFingerprint();
  mutableDef.objectiveId = "HIJACKED";
  mutableDef.requiredContextRefs.push("ctx.evil");
  mutableDef.metadataCodes.push("EVIL");
  assert.equal(registry.resolve("OBJ_TEST", "1").definition.objectiveId, "OBJ_TEST");
  assert.deepEqual(
    [...registry.resolve("OBJ_TEST", "1").definition.requiredContextRefs],
    ["ctx.a"]
  );
  assert.equal(registry.descriptorFingerprint(), fpBefore);
  assert.throws(() => registry.resolve("HIJACKED", "1"));
});

test("C06: version mismatch vs unknown", () => {
  const registry = createObjectiveRegistry([
    { definition: baseDefinition(), evaluator: constantEvaluator(1) },
  ]);
  assert.throws(
    () => registry.resolve("OBJ_TEST", "99"),
    (err) =>
      err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_VERSION_MISMATCH
  );
  assert.throws(
    () => registry.resolve("OBJ_MISSING", "1"),
    (err) => err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.UNKNOWN_OBJECTIVE
  );
});

// ---------------------------------------------------------------------------
// D. Single evaluation + context + ownership
// ---------------------------------------------------------------------------

test("D01: MINIMIZE / MAXIMIZE / quantization / negative zero", () => {
  const registry = createObjectiveRegistry([
    {
      definition: baseDefinition({ direction: OBJECTIVE_SENSE.MINIMIZE }),
      evaluator: constantEvaluator(5),
    },
    {
      definition: baseDefinition({
        objectiveId: "OBJ_MAX",
        direction: OBJECTIVE_SENSE.MAXIMIZE,
        evaluatorRef: "eval.max.v1",
      }),
      evaluator: constantEvaluator(5),
    },
    {
      definition: baseDefinition({ objectiveId: "OBJ_NEG0" }),
      evaluator: () => ({ rawValue: -0 }),
    },
  ]);
  const minRec = evaluateObjective({
    registry,
    executionSpec: {
      objectiveId: "OBJ_TEST",
      objectiveVersion: "1",
      weight: 2,
      quantizeScale: 10,
    },
    executionIndex: 0,
  });
  assert.equal(minRec.quantizedValue, 50);
  assert.equal(minRec.weightedValue, 100);
  assert.equal(minRec.orientedValue, 100);

  const maxRec = evaluateObjective({
    registry,
    executionSpec: {
      objectiveId: "OBJ_MAX",
      objectiveVersion: "1",
      weight: 2,
      quantizeScale: 10,
    },
    executionIndex: 1,
  });
  assert.equal(maxRec.orientedValue, -100);

  const negRec = evaluateObjective({
    registry,
    executionSpec: {
      objectiveId: "OBJ_NEG0",
      objectiveVersion: "1",
      weight: 1,
      quantizeScale: 1,
    },
    executionIndex: 0,
  });
  assert.equal(Object.is(negRec.rawValue, -0), false);
  assert.equal(negRec.rawValue, 0);
  assert.ok(CORE10_OBJECTIVE_EVALUATION_VERSION.includes("EVALUATION"));
});

test("D02: Math.round half-boundary policy", () => {
  const cases = [
    { raw: 0.5, scale: 1, expected: 1 },
    { raw: -0.5, scale: 1, expected: 0 }, // JS Math.round(-0.5) === -0 → +0
    { raw: 1.5, scale: 1, expected: 2 },
    { raw: -1.5, scale: 1, expected: -1 },
    { raw: 0.49, scale: 1, expected: 0 },
    { raw: 0.51, scale: 1, expected: 1 },
    { raw: -0.49, scale: 1, expected: 0 },
    { raw: -0.51, scale: 1, expected: -1 },
  ];
  for (const c of cases) {
    const registry = createObjectiveRegistry([
      {
        definition: baseDefinition({
          objectiveId: `OBJ_R_${c.raw}_${c.expected}`,
        }),
        evaluator: constantEvaluator(c.raw),
      },
    ]);
    const rec = evaluateObjective({
      registry,
      executionSpec: {
        objectiveId: `OBJ_R_${c.raw}_${c.expected}`,
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: c.scale,
      },
      executionIndex: 0,
    });
    assert.equal(
      rec.quantizedValue,
      c.expected,
      `raw=${c.raw} expected ${c.expected}`
    );
    assert.equal(Object.is(rec.quantizedValue, -0), false);
  }
});

test("D03: own-property context; prototype and undefined rejected", () => {
  const registry = createObjectiveRegistry([
    {
      definition: baseDefinition({ requiredContextRefs: ["snap.rules"] }),
      evaluator: constantEvaluator(1),
    },
  ]);

  assert.throws(
    () =>
      evaluateObjective({
        registry,
        executionSpec: {
          objectiveId: "OBJ_TEST",
          objectiveVersion: "1",
          weight: 1,
          quantizeScale: 1,
        },
        evaluationInput: {},
        executionIndex: 0,
      }),
    (err) =>
      err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.MISSING_OBJECTIVE_CONTEXT
  );

  const protoContexts = Object.create({ "snap.rules": { ok: true } });
  assert.throws(
    () =>
      evaluateObjective({
        registry,
        executionSpec: {
          objectiveId: "OBJ_TEST",
          objectiveVersion: "1",
          weight: 1,
          quantizeScale: 1,
        },
        evaluationInput: { contexts: protoContexts },
        executionIndex: 0,
      }),
    (err) =>
      err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.MISSING_OBJECTIVE_CONTEXT
  );

  assert.throws(
    () =>
      evaluateObjective({
        registry,
        executionSpec: {
          objectiveId: "OBJ_TEST",
          objectiveVersion: "1",
          weight: 1,
          quantizeScale: 1,
        },
        evaluationInput: { contexts: { "snap.rules": undefined } },
        executionIndex: 0,
      }),
    (err) =>
      err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.MISSING_OBJECTIVE_CONTEXT
  );

  const ok = evaluateObjective({
    registry,
    executionSpec: {
      objectiveId: "OBJ_TEST",
      objectiveVersion: "1",
      weight: 1,
      quantizeScale: 1,
    },
    evaluationInput: { contexts: { "snap.rules": { version: 1 } } },
    executionIndex: 0,
  });
  assert.equal(ok.rawValue, 1);
});

test("D04: caller not frozen; nested caller data not aliased; post-eval mutation safe", () => {
  const nested = { n: 1 };
  const input = {
    contexts: { "snap.rules": { version: 1 } },
    payload: { nested },
  };
  const state = { calls: 0 };
  const registry = createObjectiveRegistry([
    {
      definition: baseDefinition({
        objectiveId: "OBJ_OWN",
        requiredContextRefs: ["snap.rules"],
      }),
      evaluator: (args) => {
        state.calls += 1;
        assert.ok(Object.isFrozen(args.evaluationInput));
        assert.notEqual(args.evaluationInput.payload.nested, nested);
        return { rawValue: 3 };
      },
    },
  ]);
  assert.equal(Object.isFrozen(input), false);
  const rec = evaluateObjective({
    registry,
    executionSpec: {
      objectiveId: "OBJ_OWN",
      objectiveVersion: "1",
      weight: 1,
      quantizeScale: 1,
    },
    evaluationInput: input,
    executionIndex: 0,
  });
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(nested), false);
  nested.n = 99;
  input.payload.extra = true;
  assert.equal(rec.rawValue, 3);
  assert.equal(state.calls, 1);
});

test("D05: cyclic input / Promise / thenable / invalid result / missing rawValue", () => {
  const registry = createObjectiveRegistry([
    { definition: baseDefinition(), evaluator: constantEvaluator(1) },
  ]);
  const cyclic = { a: 1 };
  cyclic.self = cyclic;
  assert.throws(() =>
    evaluateObjective({
      registry,
      executionSpec: {
        objectiveId: "OBJ_TEST",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
      evaluationInput: cyclic,
      executionIndex: 0,
    })
  );

  const asyncReg = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_ASYNC" }),
      evaluator: () => Promise.resolve({ rawValue: 1 }),
    },
  ]);
  assert.throws(
    () =>
      evaluateObjective({
        registry: asyncReg,
        executionSpec: {
          objectiveId: "OBJ_ASYNC",
          objectiveVersion: "1",
          weight: 1,
          quantizeScale: 1,
        },
        executionIndex: 0,
      }),
    (err) =>
      err.code ===
      OBJECTIVE_EVALUATION_FAILURE_CODE.ASYNC_OBJECTIVE_EVALUATOR_UNSUPPORTED
  );

  const thenableReg = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_THEN" }),
      evaluator: () => ({ then: () => {}, rawValue: 1 }),
    },
  ]);
  assert.throws(
    () =>
      evaluateObjective({
        registry: thenableReg,
        executionSpec: {
          objectiveId: "OBJ_THEN",
          objectiveVersion: "1",
          weight: 1,
          quantizeScale: 1,
        },
        executionIndex: 0,
      }),
    (err) =>
      err.code ===
      OBJECTIVE_EVALUATION_FAILURE_CODE.ASYNC_OBJECTIVE_EVALUATOR_UNSUPPORTED
  );

  const badReg = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_BAD" }),
      evaluator: () => ({ rawValue: 1, extra: true }),
    },
  ]);
  assert.throws(
    () =>
      evaluateObjective({
        registry: badReg,
        executionSpec: {
          objectiveId: "OBJ_BAD",
          objectiveVersion: "1",
          weight: 1,
          quantizeScale: 1,
        },
        executionIndex: 0,
      }),
    (err) =>
      err.code ===
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT
  );

  const missingRaw = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_NORAW" }),
      evaluator: () => ({ noteCodes: ["X"] }),
    },
  ]);
  assert.throws(
    () =>
      evaluateObjective({
        registry: missingRaw,
        executionSpec: {
          objectiveId: "OBJ_NORAW",
          objectiveVersion: "1",
          weight: 1,
          quantizeScale: 1,
        },
        executionIndex: 0,
      }),
    (err) =>
      err.code ===
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT
  );
});

test("D06: evaluator exception excludes message/stack; NaN/Infinity fail", () => {
  const throwReg = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_THROW" }),
      evaluator: () => {
        throw new Error("secret stack must not leak");
      },
    },
  ]);
  try {
    evaluateObjective({
      registry: throwReg,
      executionSpec: {
        objectiveId: "OBJ_THROW",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
      executionIndex: 0,
    });
    assert.fail("expected throw");
  } catch (err) {
    assert.equal(
      err.code,
      OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATOR_EXCEPTION
    );
    assert.equal(err.message.includes("secret"), false);
    assert.equal(JSON.stringify(err.details).includes("secret"), false);
  }

  for (const rawValue of [NaN, Infinity, -Infinity]) {
    const reg = createObjectiveRegistry([
      {
        definition: baseDefinition({ objectiveId: `OBJ_${String(rawValue)}` }),
        evaluator: () => ({ rawValue }),
      },
    ]);
    assert.throws(
      () =>
        evaluateObjective({
          registry: reg,
          executionSpec: {
            objectiveId: `OBJ_${String(rawValue)}`,
            objectiveVersion: "1",
            weight: 1,
            quantizeScale: 1,
          },
          executionIndex: 0,
        }),
      (err) =>
        err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.NON_FINITE_OBJECTIVE_VALUE
    );
  }
});

test("D07: weight overflow / quantize overflow near safe-integer boundaries", () => {
  const registry = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_OVF" }),
      evaluator: constantEvaluator(Number.MAX_SAFE_INTEGER),
    },
  ]);
  assert.throws(
    () =>
      evaluateObjective({
        registry,
        executionSpec: {
          objectiveId: "OBJ_OVF",
          objectiveVersion: "1",
          weight: 2,
          quantizeScale: 1,
        },
        executionIndex: 0,
      }),
    (err) =>
      err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_SCORE_OVERFLOW
  );

  const scaleOvf = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_SCALE" }),
      evaluator: constantEvaluator(Number.MAX_SAFE_INTEGER),
    },
  ]);
  assert.throws(
    () =>
      evaluateObjective({
        registry: scaleOvf,
        executionSpec: {
          objectiveId: "OBJ_SCALE",
          objectiveVersion: "1",
          weight: 1,
          quantizeScale: 2,
        },
        executionIndex: 0,
      }),
    (err) =>
      err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_SCORE_OVERFLOW
  );

  // MAX_SAFE_INTEGER with weight 1 / scale 1 succeeds.
  const okReg = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_MAXSAFE" }),
      evaluator: constantEvaluator(Number.MAX_SAFE_INTEGER),
    },
  ]);
  const ok = evaluateObjective({
    registry: okReg,
    executionSpec: {
      objectiveId: "OBJ_MAXSAFE",
      objectiveVersion: "1",
      weight: 1,
      quantizeScale: 1,
    },
    executionIndex: 0,
  });
  assert.equal(ok.orientedValue, Number.MAX_SAFE_INTEGER);

  const minReg = createObjectiveRegistry([
    {
      definition: baseDefinition({
        objectiveId: "OBJ_MINSAFE",
        direction: OBJECTIVE_SENSE.MAXIMIZE,
      }),
      evaluator: constantEvaluator(Number.MIN_SAFE_INTEGER),
    },
  ]);
  const minRec = evaluateObjective({
    registry: minReg,
    executionSpec: {
      objectiveId: "OBJ_MINSAFE",
      objectiveVersion: "1",
      weight: 1,
      quantizeScale: 1,
    },
    executionIndex: 0,
  });
  // MAXIMIZE orients MIN_SAFE_INTEGER → MAX_SAFE_INTEGER
  assert.equal(minRec.orientedValue, Number.MAX_SAFE_INTEGER);
});

test("D08: free-text message field rejected on evaluation record", () => {
  assert.throws(
    () =>
      createObjectiveEvaluationRecord({
        objectiveId: "OBJ_TEST",
        objectiveVersion: "1",
        evaluatorRef: "eval.test.v1",
        direction: OBJECTIVE_SENSE.MINIMIZE,
        executionIndex: 0,
        rawValue: 1,
        normalizedValue: 1,
        quantizedValue: 1,
        weightedValue: 1,
        orientedValue: 1,
        noteCodes: [],
        message: "display",
      }),
    (err) =>
      err.code ===
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EVALUATOR_RESULT
  );
});

// ---------------------------------------------------------------------------
// E. Ordered evaluation
// ---------------------------------------------------------------------------

test("E01: executionSpecs order preserved; registry insertion ignored; caller specs not mutated", () => {
  const registry = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_B" }),
      evaluator: constantEvaluator(2),
    },
    {
      definition: baseDefinition({ objectiveId: "OBJ_A" }),
      evaluator: constantEvaluator(1),
    },
  ]);
  const specs = [
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
  ];
  const snapshot = JSON.stringify(specs);
  const records = evaluateObjectives({ registry, executionSpecs: specs });
  assert.equal(JSON.stringify(specs), snapshot);
  assert.deepEqual(
    records.map((r) => r.objectiveId),
    ["OBJ_A", "OBJ_B"]
  );
});

test("E02: duplicate execution rejected; empty specs return [] with zero calls", () => {
  const state = { calls: 0 };
  const registry = createObjectiveRegistry([
    {
      definition: baseDefinition(),
      evaluator: trackingEvaluator(state, 1),
    },
  ]);
  assert.throws(
    () =>
      evaluateObjectives({
        registry,
        executionSpecs: [
          {
            objectiveId: "OBJ_TEST",
            objectiveVersion: "1",
            weight: 1,
            quantizeScale: 1,
          },
          {
            objectiveId: "OBJ_TEST",
            objectiveVersion: "1",
            weight: 2,
            quantizeScale: 1,
          },
        ],
      }),
    (err) =>
      err.code === OBJECTIVE_EVALUATION_FAILURE_CODE.DUPLICATE_OBJECTIVE_EXECUTION
  );

  const empty = evaluateObjectives({ registry, executionSpecs: [] });
  assert.deepEqual(empty, []);
  assert.equal(state.calls, 0);
  assert.throws(() => {
    /** @type {any} */ (empty).push({});
  });
});

test("E03: stop on first failure — no partial return; deterministic repeats", () => {
  const registry = createObjectiveRegistry([
    {
      definition: baseDefinition({ objectiveId: "OBJ_OK" }),
      evaluator: constantEvaluator(1),
    },
    {
      definition: baseDefinition({ objectiveId: "OBJ_FAIL" }),
      evaluator: () => ({ rawValue: NaN }),
    },
  ]);
  const a = evaluateObjectives({
    registry,
    executionSpecs: [
      {
        objectiveId: "OBJ_OK",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
    ],
  });
  const b = evaluateObjectives({
    registry,
    executionSpecs: [
      {
        objectiveId: "OBJ_OK",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
    ],
  });
  assert.deepEqual(a, b);

  let caught = null;
  try {
    evaluateObjectives({
      registry,
      executionSpecs: [
        {
          objectiveId: "OBJ_OK",
          objectiveVersion: "1",
          weight: 1,
          quantizeScale: 1,
        },
        {
          objectiveId: "OBJ_FAIL",
          objectiveVersion: "1",
          weight: 1,
          quantizeScale: 1,
        },
      ],
    });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof OptimizerContractError);
  assert.equal(
    caught.code,
    OBJECTIVE_EVALUATION_FAILURE_CODE.NON_FINITE_OBJECTIVE_VALUE
  );
});

// ---------------------------------------------------------------------------
// F. Ownership / public API / imports
// ---------------------------------------------------------------------------

test("F01: public export allowlist for Phase 1C-A symbols", () => {
  const required = [
    "createObjectiveDefinition",
    "OBJECTIVE_NORMALIZATION_POLICY",
    "createObjectiveExecutionSpec",
    "createObjectiveEvaluationRecord",
    "createObjectiveRegistry",
    "evaluateObjective",
    "evaluateObjectives",
    "OBJECTIVE_EVALUATION_FAILURE_CODE",
    "CORE10_OBJECTIVE_DEFINITION_SCHEMA_VERSION",
    "CORE10_OBJECTIVE_REGISTRY_VERSION",
    "CORE10_OBJECTIVE_EVALUATION_VERSION",
  ];
  for (const name of required) {
    assert.ok(name in OptimizerPublic, `missing export ${name}`);
  }
  assert.equal("isObjectiveEvaluationFailureCode" in OptimizerPublic, false);
  assert.equal("resolveObjectiveEvaluationFailureCode" in OptimizerPublic, false);
  assert.equal("OBJECTIVE_EVALUATION_FAILURE_CODE_VALUES" in OptimizerPublic, false);
  assert.equal("evaluateCandidateSolution" in OptimizerPublic, false);
  assert.equal("createCandidateEvaluationResult" in OptimizerPublic, false);
});

test("F02: no prohibited imports or domain objectives in Phase 1C-A sources", () => {
  const files = [
    ...listJsFiles(OBJ_ROOT),
    path.join(OPT_ROOT, "contracts/objectiveDefinition.js"),
    path.join(OPT_ROOT, "contracts/objectiveExecutionSpec.js"),
    path.join(OPT_ROOT, "contracts/objectiveEvaluationRecord.js"),
    path.join(OPT_ROOT, "enums/objectiveEvaluationFailureCodes.js"),
  ];
  const banned = [
    "registration-eligibility",
    "lineups/",
    "constraints/",
    "scheduling",
    "court-assignment",
    "referee",
    "supabase",
    "Math.random",
    "Date.now",
    "localeCompare",
    "skillBalance",
    "fairnessHistory",
    "evaluateCandidate",
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const token of banned) {
      assert.equal(
        src.includes(token),
        false,
        `${path.relative(ROOT, file)} must not contain ${token}`
      );
    }
  }
  const barrel = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(barrel.includes("optimizer"), false);
  assert.equal(barrel.includes("createObjectiveRegistry"), false);
});

test("F03: Phase 1B ObjectiveEvaluation factory still present", async () => {
  const mod = await import(
    "../src/features/competition-core/optimizer/contracts/evaluations.js"
  );
  assert.equal(typeof mod.createObjectiveEvaluation, "function");
});

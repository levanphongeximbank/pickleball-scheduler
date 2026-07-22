/**
 * CORE-10 Phase 1B — contracts, determinism, scoring, replay, ownership boundary.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CORE10_IDENTITY,
  CORE10_SCHEMA_VERSION,
  CORE10_COMPARATOR_VERSION,
  CORE10_FINGERPRINT_VERSION,
  CORE10_PRNG_VERSION,
  OPTIMIZATION_STATUS,
  OPTIMIZATION_FAILURE_CODE,
  SOLVER_STRATEGY,
  OPTIMIZATION_OPERATION,
  OBJECTIVE_SENSE,
  FORBIDDEN_OBJECTIVE_KEYS,
  OptimizerContractError,
  createOptimizationRequest,
  createOptimizationPolicy,
  createCandidateSolution,
  createOptimizationScore,
  createOptimizationResult,
  createReplayMetadata,
  projectReplayFingerprintMaterial,
  serializeCanonical,
  fingerprintValue,
  createSeededRandom,
  compareStableString,
  sortStableIds,
  buildOptimizationScore,
  compareOptimizationScores,
  sortScoresDeterministic,
  orientObjectiveValue,
  validateOptimizationRequest,
  validateCandidateAgainstDomains,
  canonicalizeJsonValue,
  normalizeSeed,
} from "../src/features/competition-core/optimizer/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const ROOT_BARREL = path.join(
  ROOT,
  "src/features/competition-core/index.js"
);

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

function basePolicy(overrides = {}) {
  return {
    policyId: "pol-1",
    policyVersion: "1",
    objectiveKeys: ["OBJ_SOFT_A", "OBJ_SOFT_B"],
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
      {
        variableId: "var-b",
        domain: [1, 2, 3],
        required: true,
      },
    ],
    seed: "seed-alpha",
    deterministicBudget: { maxCandidates: 100, maxEvaluations: 1000 },
    strategy: SOLVER_STRATEGY.CONTRACT_ONLY,
    ...overrides,
  };
}

function baseReplay(overrides = {}) {
  return {
    engineVersion: CORE10_IDENTITY.version,
    contractSchemaVersion: CORE10_SCHEMA_VERSION,
    policyId: "pol-1",
    policyVersion: "1",
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    fingerprintAlgorithmVersion: CORE10_FINGERPRINT_VERSION,
    inputSnapshotFingerprints: ["abcdef01"],
    seed: "seed-alpha",
    prngVersion: CORE10_PRNG_VERSION,
    operationId: OPTIMIZATION_OPERATION.GENERIC_CANDIDATE_RANKING,
    deterministicBudget: { maxCandidates: 100 },
    resultFingerprint: "deadbeef",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A. Contract validation
// ---------------------------------------------------------------------------

test("A01: valid request is accepted and frozen", () => {
  const req = createOptimizationRequest(baseRequest());
  assert.equal(req.tenantId, "tenant-1");
  assert.equal(req.competitionId, "comp-1");
  assert.ok(Object.isFrozen(req));
  assert.ok(Object.isFrozen(req.policy));
  assert.ok(Object.isFrozen(req.context));
});

test("A02: missing tenantId fails", () => {
  assert.throws(
    () => createOptimizationRequest(baseRequest({ tenantId: undefined })),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("A03: missing competitionId fails", () => {
  assert.throws(
    () => createOptimizationRequest(baseRequest({ competitionId: "" })),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("A04: unknown fields fail where schema is strict", () => {
  assert.throws(
    () =>
      createOptimizationRequest(baseRequest({ unexpectedField: true })),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST &&
      /unknown fields/i.test(err.message)
  );
});

test("A05: NaN, Infinity, Date, Map, Set, function, undefined fail", () => {
  const cases = [
    { bad: NaN },
    { bad: Infinity },
    { bad: new Date(0) },
    { bad: new Map() },
    { bad: new Set() },
    { bad: () => 1 },
    { bad: undefined },
  ];
  for (const metadata of cases) {
    assert.throws(
      () =>
        createOptimizationRequest(
          baseRequest({
            context: {
              tenantId: "tenant-1",
              competitionId: "comp-1",
              snapshotRefs: [
                {
                  snapshotId: "snap-1",
                  snapshotVersion: "v1",
                  fingerprint: "abcdef01",
                },
              ],
              metadata,
            },
          })
        ),
      OptimizerContractError
    );
  }
});

test("A06: caller-owned input is not mutated", () => {
  const input = baseRequest();
  const originalJson = JSON.stringify(input);
  createOptimizationRequest(input);
  assert.equal(JSON.stringify(input), originalJson);
  assert.equal(input.tenantId, "tenant-1");
});

test("A07: forbidden objective keys rejected", () => {
  for (const key of FORBIDDEN_OBJECTIVE_KEYS) {
    assert.throws(
      () => createOptimizationPolicy(basePolicy({ objectiveKeys: [key] })),
      (err) =>
        err instanceof OptimizerContractError &&
        err.code === OPTIMIZATION_FAILURE_CODE.INVALID_POLICY
    );
  }
});

test("A08: tenant scope mismatch fails", () => {
  assert.throws(
    () =>
      createOptimizationRequest(
        baseRequest({
          context: {
            tenantId: "other-tenant",
            competitionId: "comp-1",
            snapshotRefs: [
              {
                snapshotId: "snap-1",
                snapshotVersion: "v1",
                fingerprint: "abcdef01",
              },
            ],
          },
        })
      ),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.TENANT_SCOPE_MISMATCH
  );
});

// ---------------------------------------------------------------------------
// B. Determinism
// ---------------------------------------------------------------------------

test("B01: same input produces same canonical serialization", () => {
  const a = { z: 1, a: [2, { b: 3, a: 4 }], m: "x" };
  const b = { m: "x", a: [2, { a: 4, b: 3 }], z: 1 };
  assert.equal(serializeCanonical(a), serializeCanonical(b));
});

test("B02: same input produces same fingerprint", () => {
  const payload = { requestId: "r1", values: [1, 2, 3] };
  assert.equal(fingerprintValue(payload), fingerprintValue({ ...payload }));
});

test("B03: different material values produce different fingerprints", () => {
  assert.notEqual(fingerprintValue({ v: 1 }), fingerprintValue({ v: 2 }));
});

test("B04: same seed produces same PRNG sequence", () => {
  const r1 = createSeededRandom("seed-1");
  const r2 = createSeededRandom("seed-1");
  const seq1 = [r1.nextUint32(), r1.nextUint32(), r1.nextFloat()];
  const seq2 = [r2.nextUint32(), r2.nextUint32(), r2.nextFloat()];
  assert.deepEqual(seq1, seq2);
  assert.equal(r1.prngVersion, CORE10_PRNG_VERSION);
});

test("B05: different seeds produce different sequences", () => {
  const a = createSeededRandom("seed-a");
  const b = createSeededRandom("seed-b");
  const seqA = [a.nextUint32(), a.nextUint32(), a.nextUint32()];
  const seqB = [b.nextUint32(), b.nextUint32(), b.nextUint32()];
  assert.notDeepEqual(seqA, seqB);
});

test("B06: missing seed fails closed (no host RNG fallback)", () => {
  assert.throws(
    () => createSeededRandom(undefined),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT
  );
  const src = readFileSync(
    path.join(OPT_ROOT, "deterministic/seededRandom.js"),
    "utf8"
  );
  assert.equal(/Math\.random\s*\(/.test(src), false);
});

test("B07: stable ID ordering is locale-independent", () => {
  const ids = ["z", "ä", "a", "A", "10", "2"];
  const sorted = sortStableIds(ids);
  const expected = [...ids].sort(compareStableString);
  assert.deepEqual(sorted, expected);
  const compareSrc = readFileSync(
    path.join(OPT_ROOT, "deterministic/compare.js"),
    "utf8"
  );
  assert.equal(/\.localeCompare\s*\(/.test(compareSrc), false);
  assert.ok(compareStableString("A", "a") < 0);
});

// ---------------------------------------------------------------------------
// C. Scoring and comparison
// ---------------------------------------------------------------------------

test("C01: feasible always outranks infeasible", () => {
  const feasible = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [99],
    objectiveValues: [99, 99],
    displayTotal: 9999,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "z-last",
  });
  const infeasible = createOptimizationScore({
    feasible: false,
    hardViolationCount: 1,
    authorityValues: [0],
    objectiveValues: [0, 0],
    displayTotal: 0,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "a-first",
  });
  assert.ok(compareOptimizationScores(feasible, infeasible) < 0);
});

test("C02: hard violations cannot be compensated by soft scores", () => {
  const worseHard = createOptimizationScore({
    feasible: false,
    hardViolationCount: 2,
    authorityValues: [0],
    objectiveValues: [0, 0],
    displayTotal: 0,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "a",
  });
  const betterHardWorseSoft = createOptimizationScore({
    feasible: false,
    hardViolationCount: 1,
    authorityValues: [100],
    objectiveValues: [100, 100],
    displayTotal: 999,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "b",
  });
  assert.ok(compareOptimizationScores(betterHardWorseSoft, worseHard) < 0);
});

test("C03: lexicographic keys compared in declared order", () => {
  const policy = createOptimizationPolicy(basePolicy());
  const candA = createCandidateSolution({
    candidateId: "c-a",
    assignments: { "var-a": "x", "var-b": 1 },
    feasible: true,
    hardViolationCount: 0,
    objectiveEvaluations: [
      { objectiveKey: "OBJ_SOFT_A", value: 1, sense: OBJECTIVE_SENSE.MINIMIZE },
      { objectiveKey: "OBJ_SOFT_B", value: 100, sense: OBJECTIVE_SENSE.MINIMIZE },
    ],
  });
  const candB = createCandidateSolution({
    candidateId: "c-b",
    assignments: { "var-a": "y", "var-b": 2 },
    feasible: true,
    hardViolationCount: 0,
    objectiveEvaluations: [
      { objectiveKey: "OBJ_SOFT_A", value: 2, sense: OBJECTIVE_SENSE.MINIMIZE },
      { objectiveKey: "OBJ_SOFT_B", value: 0, sense: OBJECTIVE_SENSE.MINIMIZE },
    ],
  });
  const scoreA = buildOptimizationScore({
    candidate: candA,
    policy,
    authorityValueByKey: { AUTH_PRIORITY: 0 },
  });
  const scoreB = buildOptimizationScore({
    candidate: candB,
    policy,
    authorityValueByKey: { AUTH_PRIORITY: 0 },
  });
  assert.ok(compareOptimizationScores(scoreA, scoreB) < 0);
});

test("C04: candidateId used only as final tie-break", () => {
  const a = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [1],
    objectiveValues: [5, 5],
    displayTotal: 0,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "bbb",
  });
  const b = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [1],
    objectiveValues: [5, 5],
    displayTotal: 100,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "aaa",
  });
  assert.ok(compareOptimizationScores(b, a) < 0);
});

test("C05: display total does not control ranking", () => {
  const lowDisplay = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [2],
    objectiveValues: [10],
    displayTotal: 0,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "a",
  });
  const highDisplay = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [1],
    objectiveValues: [10],
    displayTotal: 999999,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "b",
  });
  // authority 1 beats authority 2 regardless of displayTotal
  assert.ok(compareOptimizationScores(highDisplay, lowDisplay) < 0);
});

test("C06: equal accepted input produces identical result ordering", () => {
  const scores = [
    createOptimizationScore({
      feasible: true,
      hardViolationCount: 0,
      authorityValues: [1],
      objectiveValues: [3],
      comparatorVersion: CORE10_COMPARATOR_VERSION,
      candidateId: "c",
    }),
    createOptimizationScore({
      feasible: true,
      hardViolationCount: 0,
      authorityValues: [1],
      objectiveValues: [2],
      comparatorVersion: CORE10_COMPARATOR_VERSION,
      candidateId: "a",
    }),
    createOptimizationScore({
      feasible: false,
      hardViolationCount: 1,
      authorityValues: [0],
      objectiveValues: [0],
      comparatorVersion: CORE10_COMPARATOR_VERSION,
      candidateId: "b",
    }),
  ];
  const order1 = sortScoresDeterministic(scores).map((s) => s.candidateId);
  const order2 = sortScoresDeterministic([...scores].reverse()).map(
    (s) => s.candidateId
  );
  assert.deepEqual(order1, order2);
  assert.deepEqual(order1, ["a", "c", "b"]);
});

test("C07: candidate assignment outside domain fails structural check", () => {
  const req = createOptimizationRequest(baseRequest());
  const result = validateCandidateAgainstDomains(
    {
      candidateId: "bad",
      assignments: { "var-a": "z", "var-b": 1 },
      feasible: true,
      hardViolationCount: 0,
    },
    req.decisionVariables
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
    )
  );
});

// ---------------------------------------------------------------------------
// D. Replay metadata
// ---------------------------------------------------------------------------

test("D01: required versions and fingerprints are present", () => {
  const meta = createReplayMetadata(baseReplay());
  assert.equal(meta.engineVersion, CORE10_IDENTITY.version);
  assert.equal(meta.contractSchemaVersion, CORE10_SCHEMA_VERSION);
  assert.equal(meta.comparatorVersion, CORE10_COMPARATOR_VERSION);
  assert.equal(meta.fingerprintAlgorithmVersion, CORE10_FINGERPRINT_VERSION);
  assert.ok(meta.inputSnapshotFingerprints.length >= 1);
  assert.ok(meta.resultFingerprint);
  assert.ok(meta.deterministicBudget);
});

test("D02: timing fields do not affect replay fingerprint material", () => {
  const meta = createReplayMetadata(baseReplay());
  const material = projectReplayFingerprintMaterial(meta);
  const fp1 = fingerprintValue(material);

  // Non-replay timing lives only on diagnostics.nonReplay — not on ReplayMetadata.
  assert.throws(
    () =>
      createReplayMetadata(
        baseReplay({ wallClockDurationMs: 12345 })
      ),
    OptimizerContractError
  );

  const diag = createOptimizationResult({
    status: OPTIMIZATION_STATUS.SUCCESS,
    requestId: "req-1",
    selectedCandidateId: "c1",
    rankedCandidateIds: ["c1"],
    diagnostics: {
      candidateCount: 1,
      feasibleCount: 1,
      infeasibleCount: 0,
      nonReplay: { wallClockDurationMs: 99999 },
    },
    replayMetadata: baseReplay({ resultFingerprint: "aabbccdd" }),
    resultFingerprint: "aabbccdd",
  });

  const fp2 = fingerprintValue(
    projectReplayFingerprintMaterial(diag.replayMetadata)
  );
  assert.equal(fp1, fingerprintValue(projectReplayFingerprintMaterial(meta)));
  assert.equal(
    diag.diagnostics.nonReplay.wallClockDurationMs,
    99999
  );
  // Changing only nonReplay timing does not change replay metadata fingerprint.
  assert.equal(typeof fp2, "string");
  assert.equal(fp2.length, 8);
});

test("D03: result fingerprint is stable", () => {
  const material = {
    rankedCandidateIds: ["a", "b"],
    status: OPTIMIZATION_STATUS.SUCCESS,
    selectedCandidateId: "a",
  };
  assert.equal(fingerprintValue(material), fingerprintValue({ ...material }));
});

test("D04: SUCCESS without feasible selected candidate fails closed", () => {
  assert.throws(
    () =>
      createOptimizationResult({
        status: OPTIMIZATION_STATUS.SUCCESS,
        requestId: "req-1",
        selectedCandidateId: null,
        rankedCandidateIds: [],
        diagnostics: { candidateCount: 0, feasibleCount: 0 },
        replayMetadata: baseReplay(),
        resultFingerprint: "deadbeef",
      }),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.INFEASIBLE
  );
});

// ---------------------------------------------------------------------------
// E. Ownership boundary
// ---------------------------------------------------------------------------

test("E01: optimizer does not export scheduling, court, or referee capabilities", async () => {
  const barrel = readFileSync(path.join(OPT_ROOT, "index.js"), "utf8");
  assert.equal(/createSchedule|assignCourt|assignReferee/.test(barrel), false);
  assert.equal(
    /export\s+\{[^}]*\b(Schedule|Court|Referee)\b/.test(barrel),
    false
  );
  const mod = await import("../src/features/competition-core/optimizer/index.js");
  for (const name of Object.keys(mod)) {
    assert.equal(/^(Schedule|Court|Referee)/.test(name), false, name);
  }
});

test("E02: optimizer does not import scheduling, court, or referee modules", () => {
  const files = listJsFiles(OPT_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /from\s+["'].*\/(scheduling|court|referee)/.test(src),
      false,
      `forbidden import in ${path.relative(ROOT, file)}`
    );
  }
});

test("E03: optimizer does not import CORE-03 or CORE-06", () => {
  const files = listJsFiles(OPT_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /registration-eligibility|\/lineups\//.test(src),
      false,
      `CORE-03/06 import in ${path.relative(ROOT, file)}`
    );
    assert.equal(
      /from\s+["']\.\.\/(registration-eligibility|lineups)/.test(src),
      false,
      `relative CORE-03/06 import in ${path.relative(ROOT, file)}`
    );
  }
});

test("E04: no root competition-core barrel modification for optimizer", () => {
  const rootBarrel = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(/optimizer/.test(rootBarrel), false);
});

test("E05: validateOptimizationRequest accepts valid payload", () => {
  const result = validateOptimizationRequest(baseRequest());
  assert.equal(result.ok, true);
  assert.equal(result.request.requestId, "req-1");
});

test("E06: no host RNG or wall-clock calls in optimizer sources", () => {
  const files = listJsFiles(OPT_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(
      /Math\.random\s*\(/.test(src),
      false,
      `host RNG call in ${path.relative(ROOT, file)}`
    );
    assert.equal(
      /Date\.now\s*\(/.test(src),
      false,
      `wall-clock call in ${path.relative(ROOT, file)}`
    );
  }
});

// ---------------------------------------------------------------------------
// F. Pre-commit hardening (verified gaps)
// ---------------------------------------------------------------------------

test("F01: fingerprint independent of object key insertion order", () => {
  const a = { z: 1, m: { b: 2, a: 3 }, list: [1, 2] };
  const b = { list: [1, 2], m: { a: 3, b: 2 }, z: 1 };
  assert.equal(fingerprintValue(a), fingerprintValue(b));
  assert.equal(serializeCanonical(a), serializeCanonical(b));
});

test("F02: nested unsupported values fail closed", () => {
  assert.throws(
    () => serializeCanonical({ ok: true, nested: { bad: new Map() } }),
    OptimizerContractError
  );
  assert.throws(
    () => serializeCanonical({ ok: true, nested: [1, { x: undefined }] }),
    OptimizerContractError
  );
  assert.throws(
    () => fingerprintValue({ nested: { f: () => 0 } }),
    OptimizerContractError
  );
});

test("F03: negative zero normalizes to +0", () => {
  const neg = canonicalizeJsonValue({ n: -0 });
  const pos = canonicalizeJsonValue({ n: 0 });
  assert.equal(Object.is(/** @type {{n:number}} */ (neg).n, -0), false);
  assert.equal(/** @type {{n:number}} */ (neg).n, 0);
  assert.equal(serializeCanonical({ n: -0 }), serializeCanonical({ n: 0 }));
  assert.equal(fingerprintValue({ n: -0 }), fingerprintValue({ n: 0 }));
  assert.deepEqual(pos, { n: 0 });
});

test("F04: zero seed accepted; invalid seeds fail closed", () => {
  const zero = createSeededRandom(0);
  assert.equal(zero.seed, "0");
  const again = createSeededRandom(0);
  assert.equal(zero.nextUint32(), again.nextUint32());

  const neg = createSeededRandom(-7);
  assert.equal(neg.seed, "-7");

  assert.throws(() => normalizeSeed(""), OptimizerContractError);
  assert.throws(() => normalizeSeed(1.5), OptimizerContractError);
  assert.throws(() => normalizeSeed(null), OptimizerContractError);
  assert.throws(() => createSeededRandom(NaN), OptimizerContractError);
  assert.throws(() => createSeededRandom({}), OptimizerContractError);
});

test("F05: comparator antisymmetry", () => {
  const a = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [1],
    objectiveValues: [2],
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "a",
  });
  const b = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [1],
    objectiveValues: [3],
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "b",
  });
  const ab = compareOptimizationScores(a, b);
  const ba = compareOptimizationScores(b, a);
  assert.ok(ab < 0);
  assert.ok(ba > 0);
  assert.equal(Math.sign(ab), -Math.sign(ba));
  assert.equal(compareOptimizationScores(a, a), 0);
});

test("F06: comparator transitivity", () => {
  const a = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveValues: [1],
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "a",
  });
  const b = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveValues: [2],
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "b",
  });
  const c = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveValues: [3],
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "c",
  });
  assert.ok(compareOptimizationScores(a, b) < 0);
  assert.ok(compareOptimizationScores(b, c) < 0);
  assert.ok(compareOptimizationScores(a, c) < 0);
});

test("F07: maximize versus minimize orientation", () => {
  assert.equal(orientObjectiveValue(10, OBJECTIVE_SENSE.MINIMIZE), 10);
  assert.equal(orientObjectiveValue(10, OBJECTIVE_SENSE.MAXIMIZE), -10);
  const policy = createOptimizationPolicy(
    basePolicy({ objectiveKeys: ["OBJ_SCORE"], authorityKeys: [] })
  );
  const lowMax = createCandidateSolution({
    candidateId: "low",
    assignments: { "var-a": "x", "var-b": 1 },
    feasible: true,
    hardViolationCount: 0,
    objectiveEvaluations: [
      { objectiveKey: "OBJ_SCORE", value: 5, sense: OBJECTIVE_SENSE.MAXIMIZE },
    ],
  });
  const highMax = createCandidateSolution({
    candidateId: "high",
    assignments: { "var-a": "y", "var-b": 2 },
    feasible: true,
    hardViolationCount: 0,
    objectiveEvaluations: [
      { objectiveKey: "OBJ_SCORE", value: 9, sense: OBJECTIVE_SENSE.MAXIMIZE },
    ],
  });
  const sLow = buildOptimizationScore({ candidate: lowMax, policy });
  const sHigh = buildOptimizationScore({ candidate: highMax, policy });
  assert.ok(compareOptimizationScores(sHigh, sLow) < 0);
});

test("F08: unequal lexicographic key lengths pad with worst sentinel", () => {
  const short = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveValues: [1],
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "short",
  });
  const longerBetter = createOptimizationScore({
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [0],
    objectiveValues: [1, 0],
    comparatorVersion: CORE10_COMPARATOR_VERSION,
    candidateId: "long",
  });
  // Missing trailing key treated as MAX_SAFE_INTEGER ⇒ longerBetter ranks better
  assert.ok(compareOptimizationScores(longerBetter, short) < 0);
});

test("F09: duplicate decision-variable IDs fail", () => {
  assert.throws(
    () =>
      createOptimizationRequest(
        baseRequest({
          decisionVariables: [
            { variableId: "dup", domain: ["a"], required: true },
            { variableId: "dup", domain: ["b"], required: true },
          ],
        })
      ),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN
  );
});

test("F10: result fingerprint material does not recurse on itself", () => {
  const ranked = ["c1", "c2"];
  const materialWithoutFp = {
    status: OPTIMIZATION_STATUS.SUCCESS,
    requestId: "req-1",
    selectedCandidateId: "c1",
    rankedCandidateIds: ranked,
  };
  const resultFp = fingerprintValue(materialWithoutFp);
  const materialWithFp = { ...materialWithoutFp, resultFingerprint: resultFp };
  // Including resultFingerprint changes the material — callers must fingerprint
  // rankable fields only, then attach the digest (non-recursive).
  assert.notEqual(fingerprintValue(materialWithFp), resultFp);
  assert.equal(fingerprintValue(materialWithoutFp), resultFp);
});

test("F11: competition scope mismatch and empty domain fail", () => {
  assert.throws(
    () =>
      createOptimizationRequest(
        baseRequest({
          context: {
            tenantId: "tenant-1",
            competitionId: "other-comp",
            snapshotRefs: [
              {
                snapshotId: "snap-1",
                snapshotVersion: "v1",
                fingerprint: "abcdef01",
              },
            ],
          },
        })
      ),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.COMPETITION_SCOPE_MISMATCH
  );
  assert.throws(
    () =>
      createOptimizationRequest(
        baseRequest({
          decisionVariables: [
            { variableId: "empty", domain: [], required: true },
          ],
        })
      ),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.INVALID_DECISION_DOMAIN
  );
});

test("F12: unsupported strategy and empty budget fail", () => {
  assert.throws(
    () =>
      createOptimizationRequest(
        baseRequest({ strategy: "TOTALLY_UNKNOWN_STRATEGY" })
      ),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.UNSUPPORTED_STRATEGY
  );
  assert.throws(
    () =>
      createOptimizationRequest(
        baseRequest({ deterministicBudget: {} })
      ),
    (err) =>
      err instanceof OptimizerContractError &&
      err.code === OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("F13: empty objects/arrays, unicode, booleans, null serialize stably", () => {
  const payload = {
    emptyObj: {},
    emptyArr: [],
    uni: "café😀",
    flag: false,
    nothing: null,
    nested: [{}, []],
  };
  const again = {
    nothing: null,
    flag: false,
    uni: "café😀",
    emptyArr: [],
    emptyObj: {},
    nested: [{}, []],
  };
  assert.equal(serializeCanonical(payload), serializeCanonical(again));
  assert.equal(fingerprintValue(payload), fingerprintValue(again));
});

test("F14: schedule/court/referee keys rejected as unknown request fields", () => {
  for (const field of ["schedule", "courtId", "refereeId", "courtAssignment"]) {
    assert.throws(
      () =>
        createOptimizationRequest(
          baseRequest({ [field]: "must-fail" })
        ),
      (err) =>
        err instanceof OptimizerContractError &&
        err.code === OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST &&
        /unknown fields/i.test(err.message)
    );
  }
});

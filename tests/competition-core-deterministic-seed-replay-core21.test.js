/**
 * CORE-21 Deterministic Seed & Replay — Phase 1B–1D certification tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CORE21_ENGINE_ID,
  CORE21_ENGINE_VERSION,
  CORE21_PRNG_VERSION,
  CORE21_SERIALIZATION_VERSION,
  CORE21_FINGERPRINT_VERSION,
  CORE21_COMPARATOR_VERSION,
  CORE21_SEED_ALGORITHM_VERSION,
  CORE21_REPLAY_CONTRACT_VERSION,
  CANONICAL_SEED_FIELDS,
  NULLS_POLICY,
  EXECUTION_MODE,
  REPLAY_MISMATCH_CATEGORY,
  DETERMINISTIC_SEED_REPLAY_ERROR_CODE,
  DeterministicSeedReplayError,
  normalizeSeed,
  composeCanonicalSeed,
  createSeedIdentity,
  createSeededRandom,
  compareStableString,
  compareStableNumber,
  compareNullable,
  compareKeyTuple,
  sortStableIds,
  canonicalizeJsonValue,
  serializeCanonical,
  deepFreezeCanonical,
  fingerprintValue,
  hashStringToUint32,
  createReplayInput,
  createReplayContext,
  verifyReplay,
} from "../src/features/competition-core/deterministic-seed-replay/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(
  ROOT,
  "src/features/competition-core/deterministic-seed-replay"
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

function sampleReplayInput(overrides = {}) {
  return createReplayInput({
    seedIdentity: "seed-core21-1",
    normalizedInputFingerprint: "abcd1234",
    algorithmVersion: "consumer-algo-v1",
    ruleSetId: "rules-pickleball",
    ruleSetVersion: "1.0.0",
    expectedOutputFingerprint: "out00001",
    ...overrides,
  });
}

describe("CORE-21 Phase 1B–1D — Deterministic Seed & Replay", () => {
  it("01. public barrel exports canonical surface", async () => {
    const mod = await import(
      "../src/features/competition-core/deterministic-seed-replay/index.js"
    );
    assert.equal(mod.CORE21_ENGINE_ID, CORE21_ENGINE_ID);
    assert.equal(mod.CORE21_ENGINE_VERSION, CORE21_ENGINE_VERSION);
    assert.equal(typeof mod.normalizeSeed, "function");
    assert.equal(typeof mod.createSeededRandom, "function");
    assert.equal(typeof mod.verifyReplay, "function");
    assert.equal(typeof mod.fingerprintValue, "function");
    assert.ok(mod.DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_MISSING);
    assert.ok(mod.REPLAY_MISMATCH_CATEGORY.OUTPUT);
  });

  it("02. seed normalize: NFC, trim, integer; reject missing/object/NUL/empty", () => {
    assert.equal(normalizeSeed("  café  "), "café".normalize("NFC"));
    assert.equal(normalizeSeed(42), "42");
    assert.throws(
      () => normalizeSeed(null),
      (err) =>
        err instanceof DeterministicSeedReplayError &&
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_MISSING
    );
    assert.throws(
      () => normalizeSeed({ a: 1 }),
      (err) =>
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_INVALID
    );
    assert.throws(
      () => normalizeSeed("a\0b"),
      (err) =>
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_INVALID
    );
    assert.throws(
      () => normalizeSeed("   "),
      (err) =>
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_MISSING
    );
    assert.throws(() => normalizeSeed(1.5), (err) => err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_INVALID);
  });

  it("03. composeCanonicalSeed: field order + required ownerSeed", () => {
    assert.deepEqual(CANONICAL_SEED_FIELDS.slice(), [
      "seedNamespace",
      "purpose",
      "tenantId",
      "competitionId",
      "contextId",
      "derivationFingerprint",
      "ownerSeed",
    ]);
    const a = composeCanonicalSeed({
      seedNamespace: "core21",
      purpose: "draw",
      tenantId: "t1",
      competitionId: "c1",
      contextId: "x1",
      derivationFingerprint: "fp1",
      ownerSeed: "owner",
    });
    const b = composeCanonicalSeed({
      ownerSeed: "owner",
      contextId: "x1",
      competitionId: "c1",
      tenantId: "t1",
      purpose: "draw",
      seedNamespace: "core21",
      derivationFingerprint: "fp1",
    });
    assert.equal(a, b);
    assert.throws(
      () => composeCanonicalSeed({ competitionId: "c1" }),
      (err) => err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_MISSING
    );
    const id = createSeedIdentity({
      seedNamespace: "ns",
      purpose: "opt",
      ownerSeed: "s1",
      derivationInputs: "deadbeef",
    });
    assert.equal(id.seedAlgorithmVersion, CORE21_SEED_ALGORITHM_VERSION);
    assert.equal(id.derivationFingerprint, "deadbeef");
    assert.ok(id.seedIdentity.includes("s1"));
  });

  it("04. PRNG: same seed ⇒ same sequence; version prefix changes stream; fork isolates", () => {
    const a = createSeededRandom("seed-A");
    const b = createSeededRandom("seed-A");
    const seqA = [a.nextFloat(), a.nextFloat(), a.nextUint32()];
    const seqB = [b.nextFloat(), b.nextFloat(), b.nextUint32()];
    assert.deepEqual(seqA, seqB);
    assert.equal(a.prngVersion, CORE21_PRNG_VERSION);

    const material = `${CORE21_PRNG_VERSION}:seed-A`;
    assert.equal(
      hashStringToUint32(material),
      hashStringToUint32(`${a.prngVersion}:${a.seed}`)
    );

    const parent = createSeededRandom("seed-A");
    const fork1 = parent.fork("left");
    const fork2 = parent.fork("left");
    const forkOther = parent.fork("right");
    const leftSeq = [fork1.nextFloat(), fork1.nextUint32()];
    const leftSeq2 = [fork2.nextFloat(), fork2.nextUint32()];
    const rightSeq = [forkOther.nextFloat(), forkOther.nextUint32()];
    assert.deepEqual(leftSeq, leftSeq2);
    assert.notDeepEqual(leftSeq, rightSeq);
    assert.throws(
      () => parent.fork(""),
      (err) =>
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.PRNG_INVALID_OPERATION
    );
  });

  it("05. ordering: UTF-16, nulls last, numeric -0, identity tie-break", () => {
    assert.ok(compareStableString("A", "B") < 0);
    assert.equal(compareStableString("é", "é"), 0);
    assert.equal(compareNullable(null, "a"), 1);
    assert.equal(
      compareNullable(null, "a", { nullsPolicy: NULLS_POLICY.NULLS_FIRST }),
      -1
    );
    assert.equal(compareStableNumber(-0, 0), 0);
    assert.throws(
      () => compareStableNumber(Number.NaN, 1),
      (err) =>
        err.code ===
        DETERMINISTIC_SEED_REPLAY_ERROR_CODE.ORDERING_CONTRACT_VIOLATION
    );
    assert.ok(
      compareKeyTuple(["10", "id-b"], ["10", "id-a"]) > 0,
      "identity final key breaks business-key ties"
    );
    assert.deepEqual(sortStableIds(["b", "a", "c"]), ["a", "b", "c"]);
  });

  it("06. serialization: key order, -0, reject non-finite/Date/cycle", () => {
    const left = serializeCanonical({ b: 1, a: 2 });
    const right = serializeCanonical({ a: 2, b: 1 });
    assert.equal(left, right);
    assert.equal(serializeCanonical({ n: -0 }), '{"n":0}');
    assert.throws(
      () => canonicalizeJsonValue({ x: Number.POSITIVE_INFINITY }),
      (err) =>
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED
    );
    assert.throws(
      () => canonicalizeJsonValue({ d: new Date("2026-01-01") }),
      (err) =>
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED
    );
    const cyclic = { a: 1 };
    cyclic.self = cyclic;
    assert.throws(
      () => canonicalizeJsonValue(cyclic),
      (err) =>
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SERIALIZATION_REJECTED
    );
    const frozen = deepFreezeCanonical({ z: 1, a: [1, 2] });
    assert.ok(Object.isFrozen(frozen));
    assert.ok(Object.isFrozen(frozen.a));
  });

  it("07. fingerprint includes algorithm version; Unicode handled as code units", () => {
    const fp1 = fingerprintValue({ name: "café" });
    const fp2 = fingerprintValue({ name: "café" });
    assert.equal(fp1, fp2);
    assert.match(fp1, /^[0-9a-f]{8}$/);
    const withVersion = hashStringToUint32(
      JSON.stringify({
        fingerprintAlgorithmVersion: CORE21_FINGERPRINT_VERSION,
        payload: canonicalizeJsonValue({ name: "café" }),
      })
    )
      .toString(16)
      .padStart(8, "0");
    assert.equal(fp1, withVersion);
  });

  it("08. replay verify success path", () => {
    const input = sampleReplayInput();
    const context = createReplayContext({
      executionMode: EXECUTION_MODE.REPLAY_VERIFY,
      dependencyVersions: { "competition-core.rules": "1.0.0" },
      pinnedDomainTime: "2026-07-23T10:00:00.000Z",
    });
    const result = verifyReplay(input, context, {
      actualOutputFingerprint: "out00001",
      actualNormalizedInputFingerprint: "abcd1234",
      actualSeedIdentity: "seed-core21-1",
      actualAlgorithmVersion: "consumer-algo-v1",
      actualRuleSetId: "rules-pickleball",
      actualRuleSetVersion: "1.0.0",
      actualSerializationVersion: CORE21_SERIALIZATION_VERSION,
      actualFingerprintAlgorithmVersion: CORE21_FINGERPRINT_VERSION,
      actualComparatorVersion: CORE21_COMPARATOR_VERSION,
      actualPrngVersion: CORE21_PRNG_VERSION,
    });
    assert.equal(result.ok, true);
    assert.equal(result.mismatches.length, 0);
    assert.equal(result.evidence.ok, true);
    assert.equal(
      result.evidence.versions.replayContractVersion,
      CORE21_REPLAY_CONTRACT_VERSION
    );
  });

  it("09. replay mismatch categories + throwOnMismatch", () => {
    const input = sampleReplayInput({
      eventHistoryReference: { streamKey: "s1", from: 1, to: 3 },
    });
    const context = createReplayContext({
      executionMode: EXECUTION_MODE.REPLAY_VERIFY,
    });
    const result = verifyReplay(input, context, {
      actualOutputFingerprint: "wrong",
      actualSeedIdentity: "other-seed",
      actualNormalizedInputFingerprint: "zzzz",
      actualAlgorithmVersion: "other-algo",
      actualRuleSetId: "other-rules",
      actualRuleSetVersion: "9.9.9",
      actualSerializationVersion: "OTHER_SER",
      actualComparatorVersion: "OTHER_CMP",
      actualPrngVersion: "OTHER_PRNG",
      actualEventHistoryReference: { streamKey: "s2", from: 1, to: 3 },
      expectedPrngConsumptionFingerprint: "c1",
      actualPrngConsumptionFingerprint: "c2",
    });
    assert.equal(result.ok, false);
    const cats = new Set(result.mismatches.map((m) => m.category));
    assert.ok(cats.has(REPLAY_MISMATCH_CATEGORY.OUTPUT));
    assert.ok(cats.has(REPLAY_MISMATCH_CATEGORY.SEED));
    assert.ok(cats.has(REPLAY_MISMATCH_CATEGORY.INPUT));
    assert.ok(cats.has(REPLAY_MISMATCH_CATEGORY.ALGORITHM_VERSION));
    assert.ok(cats.has(REPLAY_MISMATCH_CATEGORY.RULE_SET));
    assert.ok(cats.has(REPLAY_MISMATCH_CATEGORY.SERIALIZATION));
    assert.ok(cats.has(REPLAY_MISMATCH_CATEGORY.ORDERING));
    assert.ok(cats.has(REPLAY_MISMATCH_CATEGORY.EVENT_HISTORY));
    assert.ok(cats.has(REPLAY_MISMATCH_CATEGORY.PRNG_CONSUMPTION));

    assert.throws(
      () =>
        verifyReplay(input, context, {
          actualOutputFingerprint: "wrong",
          throwOnMismatch: true,
        }),
      (err) =>
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_OUTPUT_MISMATCH
    );
  });

  it("10. replay context rejects ambient clock / forbidden fields", () => {
    assert.throws(
      () =>
        createReplayContext({
          executionMode: EXECUTION_MODE.DETERMINISTIC_EXECUTE,
          useAmbientClock: true,
        }),
      (err) =>
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.NON_DETERMINISTIC_INPUT
    );
    assert.throws(
      () =>
        createReplayInput({
          seedIdentity: "s",
          normalizedInputFingerprint: "fp",
          algorithmVersion: "a",
          ruleSetId: "r",
          ruleSetVersion: "1",
          timestamp: "nope",
        }),
      (err) =>
        err.code === DETERMINISTIC_SEED_REPLAY_ERROR_CODE.NON_DETERMINISTIC_INPUT
    );
  });

  it("11. module surface forbids Math.random / Date.now / localeCompare", () => {
    const files = listJsFiles(MODULE_ROOT);
    assert.ok(files.length > 0);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      assert.equal(
        /Math\.random\s*\(/.test(src),
        false,
        `Math.random forbidden in ${file}`
      );
      assert.equal(
        /Date\.now\s*\(/.test(src),
        false,
        `Date.now forbidden in ${file}`
      );
      assert.equal(
        /\.localeCompare\s*\(/.test(src),
        false,
        `localeCompare forbidden in ${file}`
      );
    }
  });

  it("12. does not deep-import CORE-07–11 private solvers", () => {
    const files = listJsFiles(MODULE_ROOT);
    const banned = [
      "/seeding/",
      "/draw-runtime/",
      "/match-generation/",
      "/optimizer/",
      "/schedule-engine/",
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const pattern of banned) {
        assert.equal(
          src.includes(`competition-core${pattern}`) ||
            src.includes(`../..${pattern}`) ||
            src.includes(`features/competition-core${pattern}`),
          false,
          `${file} must not import ${pattern}`
        );
      }
    }
  });
});

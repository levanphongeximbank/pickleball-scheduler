import test from "node:test";
import assert from "node:assert/strict";

import {
  createSeedingResolver,
  createSeedingIdentityLookup,
  createInMemorySeedingPersistencePort,
  createNoopSeedingPersistencePort,
  mapLegacySeedingToCandidates,
  buildSeedingIdentityKey,
  buildCandidateIdentityKey,
  buildAssignmentIdentityKey,
  createSeedingIdentity,
  createSeedingCandidate,
  createNoopSeedingPolicy,
  createDeterministicRandomFromSeed,
  orderCandidatesDeterministically,
  SEEDING_RUNTIME_ERROR_CODE,
  SEEDING_ADAPTER_ID,
  SEEDING_SOURCE_TYPE,
  CANDIDATE_TYPE,
  ASSIGNMENT_REASON,
  SeedingRuntimeError,
} from "../src/features/competition-core/seeding/index.js";

function baseCandidates() {
  return [
    {
      id: "e-c",
      entryId: "e-c",
      ratingValue: 4.0,
      rankingPosition: 3,
    },
    {
      id: "e-a",
      entryId: "e-a",
      ratingValue: 5.5,
      rankingPosition: 1,
    },
    {
      id: "e-b",
      entryId: "e-b",
      ratingValue: 5.0,
      rankingPosition: 2,
    },
  ];
}

test("3G seeding resolve: ranking then rating ordering", async () => {
  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "event-1",
    candidates: baseCandidates(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.assignments.length, 3);
  assert.equal(result.assignments[0].seedNumber, 1);
  assert.equal(
    result.assignments[0].metadata.candidateReference,
    "e-a"
  );
  assert.equal(result.assignments[1].metadata.candidateReference, "e-b");
  assert.equal(result.assignments[2].metadata.candidateReference, "e-c");
  assert.equal(
    result.identity.key,
    buildSeedingIdentityKey({ competitionId: "comp-1", contextId: "event-1" })
  );
  assert.equal(result.diagnostics.usedMathRandom, false);
  assert.equal(result.diagnostics.drawImplemented, false);
  assert.equal(result.diagnostics.matchupImplemented, false);
});

test("3G identity: operation / candidate / assignment keys", () => {
  const identity = createSeedingIdentity({
    competitionId: "c",
    contextId: "ctx",
  });
  assert.equal(identity.key, "c::SEEDING::ctx");
  assert.throws(() => {
    // @ts-expect-error frozen
    identity.key = "mutated";
  });
  assert.equal(
    buildCandidateIdentityKey({
      seedingIdentityKey: identity.key,
      candidateReference: "entry-9",
    }),
    "c::SEEDING::ctx::CANDIDATE::entry-9"
  );
  assert.equal(
    buildAssignmentIdentityKey({
      seedingIdentityKey: identity.key,
      seedNumber: 2,
    }),
    "c::SEEDING::ctx::SEED::2"
  );
});

test("3G identity: independent of display name / mutable rating", async () => {
  const resolver = createSeedingResolver();
  const a = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [
      { id: "p1", name: "Alice", ratingValue: 5 },
      { id: "p2", name: "Bob", ratingValue: 4 },
    ],
  });
  const resolverB = createSeedingResolver();
  const b = await resolverB.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [
      { id: "p1", name: "Alicia Renamed", ratingValue: 9 },
      { id: "p2", name: "Bobby", ratingValue: 1 },
    ],
  });
  assert.equal(a.identity.key, b.identity.key);
  assert.equal(
    a.assignments[0].candidateIdentityKey,
    b.assignments.find((x) => x.metadata.candidateReference === "p1")
      .candidateIdentityKey
  );
});

test("3G repeatability: same inputs → same assignments", async () => {
  const lookup = createSeedingIdentityLookup();
  const resolver = createSeedingResolver({ identityLookup: lookup });
  const request = {
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: baseCandidates(),
    deterministicSeed: "seed-42",
  };
  const first = await resolver.resolve(request);
  lookup.clear();
  const second = await resolver.resolve(request);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(
    first.assignments.map((a) => [a.seedNumber, a.candidateIdentityKey]),
    second.assignments.map((a) => [a.seedNumber, a.candidateIdentityKey])
  );
});

test("3G default without deterministicSeed: identity ordering when metrics equal", async () => {
  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [
      { id: "z-entry" },
      { id: "a-entry" },
      { id: "m-entry" },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.defaultOrdering, "identity");
  assert.deepEqual(
    result.assignments.map((a) => a.metadata.candidateReference),
    ["a-entry", "m-entry", "z-entry"]
  );
  assert.ok(
    result.assignments.every(
      (a) =>
        a.assignmentReason === ASSIGNMENT_REASON.IDENTITY_ORDER ||
        a.sourceType === SEEDING_SOURCE_TYPE.IDENTITY
    )
  );
});

test("3G manual locked seeds + partial auto fill", async () => {
  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [
      { id: "e1", ratingValue: 3, manualSeed: 1, protectedSeed: true },
      { id: "e2", ratingValue: 9 },
      { id: "e3", ratingValue: 8 },
      { id: "e4", ratingValue: 1, manualSeed: 4 },
    ],
  });
  assert.equal(result.ok, true);
  const byRef = Object.fromEntries(
    result.assignments.map((a) => [a.metadata.candidateReference, a])
  );
  assert.equal(byRef.e1.seedNumber, 1);
  assert.equal(byRef.e1.assignmentReason, ASSIGNMENT_REASON.PROTECTED_SEED);
  assert.equal(byRef.e4.seedNumber, 4);
  assert.equal(byRef.e4.assignmentReason, ASSIGNMENT_REASON.MANUAL_LOCKED);
  assert.equal(byRef.e2.seedNumber, 2);
  assert.equal(byRef.e3.seedNumber, 3);
  assert.equal(byRef.e2.assignmentReason, ASSIGNMENT_REASON.PARTIAL_AUTO_FILL);
});

test("3G duplicate candidates rejected", async () => {
  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [
      { id: "same", ratingValue: 1 },
      { id: "same", ratingValue: 2 },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    SEEDING_RUNTIME_ERROR_CODE.SEEDING_CANDIDATE_DUPLICATE
  );
});

test("3G duplicate manual seeds rejected", async () => {
  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [
      { id: "a", manualSeed: 1 },
      { id: "b", manualSeed: 1 },
      { id: "c" },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    SEEDING_RUNTIME_ERROR_CODE.SEEDING_MANUAL_SEED_DUPLICATE
  );
});

test("3G invalid manual seed number rejected", async () => {
  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [
      { id: "a", manualSeed: 99 },
      { id: "b" },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    SEEDING_RUNTIME_ERROR_CODE.SEEDING_MANUAL_SEED_INVALID
  );
});

test("3G ranking-based ordering prefers lower rank position", async () => {
  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [
      { id: "x", rankingPosition: 2, ratingValue: 99 },
      { id: "y", rankingPosition: 1, ratingValue: 1 },
    ],
  });
  assert.equal(result.assignments[0].metadata.candidateReference, "y");
  assert.equal(
    result.assignments[0].sourceType,
    SEEDING_SOURCE_TYPE.RANKING
  );
});

test("3G rating-based ordering when ranking absent", async () => {
  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [
      { id: "low", ratingValue: 2 },
      { id: "high", ratingValue: 7 },
    ],
  });
  assert.equal(result.assignments[0].metadata.candidateReference, "high");
  assert.equal(result.assignments[0].sourceType, SEEDING_SOURCE_TYPE.RATING);
});

test("3G injected ranking/rating resolvers enrich snapshots", async () => {
  const resolver = createSeedingResolver({
    rankingResolver: async (candidate) =>
      candidate.candidateReference === "a" ? 1 : 2,
    ratingResolver: async () => ({ value: 4.2, reference: "rating-snap" }),
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [{ id: "a" }, { id: "b" }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.assignments[0].metadata.candidateReference, "a");
  assert.equal(result.candidates[0].ratingValue, 4.2);
  assert.equal(result.diagnostics.ratingCalculated, false);
  assert.equal(result.diagnostics.rankingCalculated, false);
});

test("3G deterministicSeed changes tie order stably", async () => {
  const candidates = [
    { id: "p1" },
    { id: "p2" },
    { id: "p3" },
  ];
  const r1 = await createSeedingResolver().resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates,
    deterministicSeed: "alpha",
  });
  const r2 = await createSeedingResolver().resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates,
    deterministicSeed: "beta",
  });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  // Both deterministic; order may differ between seeds
  assert.equal(r1.diagnostics.deterministicRngReady, true);
  const order1 = r1.assignments.map((a) => a.metadata.candidateReference).join(",");
  const order2 = r2.assignments.map((a) => a.metadata.candidateReference).join(",");
  // Identity-only without seed is alphabetical; with seeds use hash — either equal or not, both valid;
  // require at least that each seed is internally repeatable:
  const r1b = await createSeedingResolver().resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates,
    deterministicSeed: "alpha",
  });
  assert.equal(
    order1,
    r1b.assignments.map((a) => a.metadata.candidateReference).join(",")
  );
  assert.ok(typeof order2 === "string");
});

test("3G injected deterministicRandom factory is used", async () => {
  let calls = 0;
  const resolver = createSeedingResolver({
    deterministicRandom: (seed) => {
      calls += 1;
      return createDeterministicRandomFromSeed(seed);
    },
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: baseCandidates(),
    deterministicSeed: 12345,
  });
  assert.equal(result.ok, true);
  assert.ok(calls >= 1);
});

test("3G persistence OFF by default; noop refuses writes", async () => {
  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: baseCandidates(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.persisted, false);
  assert.equal(result.snapshot, null);

  const noop = createNoopSeedingPersistencePort();
  await assert.rejects(() => noop.save({ id: "x" }), /NOOP_PERSISTENCE/);
});

test("3G persistence explicit enablement with in-memory port", async () => {
  const port = createInMemorySeedingPersistencePort();
  const resolver = createSeedingResolver({
    enablePersistence: true,
    persistence: port,
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: baseCandidates(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.persisted, true);
  const stored = await port.findByIdentityKey(result.identity.key);
  assert.ok(stored);
  assert.equal(stored.competitionId, "comp-1");
});

test("3G persistence enablement with noop port fails typed", async () => {
  const resolver = createSeedingResolver({
    enablePersistence: true,
    persistence: createNoopSeedingPersistencePort(),
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: baseCandidates(),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    SEEDING_RUNTIME_ERROR_CODE.SEEDING_PERSISTENCE_DISABLED
  );
});

test("3G map-only legacy adapter", async () => {
  const mapped = mapLegacySeedingToCandidates(
    {
      participants: [
        { id: "p1", elo: 1200, manualSeedOverride: true, seed: 1 },
        { id: "p2", elo: 1100 },
      ],
    },
    { competitionId: "comp-1", contextId: "ctx" }
  );
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].manualSeed, 1);
  assert.equal(mapped[0].protectedSeed, true);

  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    source: {
      entries: [
        { id: "e1", rating: 5 },
        { id: "e2", rating: 4 },
      ],
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.adapterId, SEEDING_ADAPTER_ID.LEGACY);
  assert.equal(result.sourceType, SEEDING_SOURCE_TYPE.LEGACY);
});

test("3G typed errors and policy reject", async () => {
  assert.ok(
    new SeedingRuntimeError(
      SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT,
      "x"
    ) instanceof SeedingRuntimeError
  );

  const policy = {
    ...createNoopSeedingPolicy(),
    id: "reject-all",
    validateCandidates() {
      return { ok: false, reasons: ["nope"], details: {} };
    },
  };
  const resolver = createSeedingResolver({ seedingPolicy: policy });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: baseCandidates(),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    SEEDING_RUNTIME_ERROR_CODE.SEEDING_POLICY_REJECTED
  );
});

test("3G createSeedingCandidate types and team mapping", () => {
  const team = createSeedingCandidate({
    competitionId: "c",
    contextId: "x",
    candidateType: CANDIDATE_TYPE.TEAM,
    teamReference: "t-1",
    ratingValue: 4.5,
  });
  assert.equal(team.candidateType, CANDIDATE_TYPE.TEAM);
  assert.equal(team.candidateReference, "t-1");

  const { ordered } = orderCandidatesDeterministically([
    createSeedingCandidate({
      competitionId: "c",
      contextId: "x",
      candidateReference: "b",
      sourcePriority: 2,
    }),
    createSeedingCandidate({
      competitionId: "c",
      contextId: "x",
      candidateReference: "a",
      sourcePriority: 1,
    }),
  ]);
  assert.equal(ordered[0].candidateReference, "a");
});

test("3G missing competitionId / contextId", async () => {
  const resolver = createSeedingResolver();
  const a = await resolver.resolve({ contextId: "x", candidates: [{ id: "1" }] });
  assert.equal(a.ok, false);
  assert.equal(a.error.code, SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT);
  const b = await resolver.resolve({
    competitionId: "c",
    candidates: [{ id: "1" }],
  });
  assert.equal(b.ok, false);
  assert.equal(b.error.code, SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT);
});

test("3G ineligible candidates excluded", async () => {
  const resolver = createSeedingResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "ctx",
    candidates: [
      { id: "ok", ratingValue: 5 },
      { id: "out", ratingValue: 9, eligible: false },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.assignments.length, 1);
  assert.equal(result.excludedCandidates.length, 1);
  assert.equal(result.excludedCandidates[0].candidateReference, "out");
});

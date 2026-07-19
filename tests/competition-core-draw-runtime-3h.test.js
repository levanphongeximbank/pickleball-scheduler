import test from "node:test";
import assert from "node:assert/strict";

import {
  createDrawResolver,
  createDrawIdentityLookup,
  createInMemoryDrawPersistencePort,
  createNoopDrawPersistencePort,
  mapLegacyDrawToCandidates,
  buildDrawIdentityKey,
  buildCandidateIdentityKey,
  buildGroupIdentityKey,
  buildBracketIdentityKey,
  buildSlotIdentityKey,
  buildPlacementIdentityKey,
  buildByeIdentityKey,
  createDrawIdentity,
  createNoopDrawPolicy,
  createDeterministicRandomFromSeed,
  getSnakeGroupIndex,
  getSerpentineGroupIndex,
  calculateByeCount,
  DRAW_RUNTIME_ERROR_CODE,
  DRAW_ADAPTER_ID,
  DRAW_MODE,
  PLACEMENT_REASON,
  PLACEMENT_TYPE,
  DrawRuntimeError,
} from "../src/features/competition-core/draw-runtime/index.js";

function seedCandidates(n = 8) {
  return Array.from({ length: n }, (_, i) => ({
    id: `e-${i + 1}`,
    entryId: `e-${i + 1}`,
    seedNumber: i + 1,
  }));
}

test("3H identity: operation / candidate / group / bracket / slot / placement / bye", () => {
  const identity = createDrawIdentity({
    competitionId: "c",
    contextId: "ctx",
  });
  assert.equal(identity.key, "c::DRAW::ctx");
  assert.throws(() => {
    // @ts-expect-error frozen
    identity.key = "mutated";
  });
  assert.equal(
    buildCandidateIdentityKey({
      drawIdentityKey: identity.key,
      candidateReference: "entry-9",
    }),
    "c::DRAW::ctx::CANDIDATE::entry-9"
  );
  assert.equal(
    buildGroupIdentityKey({ drawIdentityKey: identity.key, groupNumber: 2 }),
    "c::DRAW::ctx::GROUP::2"
  );
  assert.equal(
    buildBracketIdentityKey({ drawIdentityKey: identity.key, bracketId: "main" }),
    "c::DRAW::ctx::BRACKET::main"
  );
  assert.equal(
    buildSlotIdentityKey({ drawIdentityKey: identity.key, slotNumber: 4 }),
    "c::DRAW::ctx::SLOT::4"
  );
  assert.equal(
    buildPlacementIdentityKey({
      drawIdentityKey: identity.key,
      candidateIdentityKey: "c::DRAW::ctx::CANDIDATE::entry-9",
    }),
    "c::DRAW::ctx::PLACEMENT::c::DRAW::ctx::CANDIDATE::entry-9"
  );
  assert.equal(
    buildByeIdentityKey({ drawIdentityKey: identity.key, slotNumber: 8 }),
    "c::DRAW::ctx::BYE::8"
  );
});

test("3H snake groups: seeded order placement", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "event-1",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(8),
  });
  assert.equal(result.ok, true);
  assert.equal(result.placements.length, 8);
  assert.equal(result.groups.length, 4);
  assert.equal(result.diagnostics.usedMathRandom, false);
  assert.equal(result.diagnostics.matchCreated, false);
  assert.equal(result.diagnostics.scheduleCreated, false);
  // seed 1 → G1, seed 2 → G2, seed 5 → G4 (snake reverse)
  const byRef = Object.fromEntries(
    result.placements.map((p) => [
      p.metadata.candidateReference,
      p.metadata.groupNumber,
    ])
  );
  assert.equal(byRef["e-1"], 1);
  assert.equal(byRef["e-2"], 2);
  assert.equal(byRef["e-4"], 4);
  assert.equal(byRef["e-5"], 4);
  assert.equal(
    result.identity.key,
    buildDrawIdentityKey({ competitionId: "comp-1", contextId: "event-1" })
  );
  assert.ok(result.placements.every((p) => p.positionNumber != null));
});

test("3H serpentine distinct from snake", async () => {
  assert.notEqual(getSnakeGroupIndex(0, 4), getSerpentineGroupIndex(0, 4));
  const resolver = createDrawResolver();
  const snake = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "snake",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(8),
  });
  const serp = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "serp",
    drawMode: DRAW_MODE.SERPENTINE_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(8),
  });
  assert.equal(snake.ok, true);
  assert.equal(serp.ok, true);
  const snakeMap = snake.placements.map((p) => p.metadata.groupNumber).join(",");
  const serpMap = serp.placements.map((p) => p.metadata.groupNumber).join(",");
  assert.notEqual(snakeMap, serpMap);
  assert.equal(serp.placements[0].placementReason, PLACEMENT_REASON.SERPENTINE);
});

test("3H seeded groups: round-robin", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "seeded",
    drawMode: DRAW_MODE.SEEDED_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(8),
  });
  assert.equal(result.ok, true);
  const byRef = Object.fromEntries(
    result.placements.map((p) => [
      p.metadata.candidateReference,
      p.metadata.groupNumber,
    ])
  );
  assert.equal(byRef["e-1"], 1);
  assert.equal(byRef["e-5"], 1);
  assert.equal(byRef["e-2"], 2);
});

test("3H pot groups: equal pots preserve one-per-tier per group", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "pot-eq",
    drawMode: DRAW_MODE.POT_GROUPS,
    groupCount: 4,
    candidates: [
      ...[1, 2, 3, 4].map((i) => ({
        id: `t1-${i}`,
        seedNumber: i,
        seedTier: "1",
      })),
      ...[5, 6, 7, 8].map((i) => ({
        id: `t2-${i - 4}`,
        seedNumber: i,
        seedTier: "2",
      })),
      ...[9, 10, 11, 12].map((i) => ({
        id: `t3-${i - 8}`,
        seedNumber: i,
        seedTier: "3",
      })),
    ],
  });
  assert.equal(result.ok, true);
  const byTier = { 1: {}, 2: {}, 3: {} };
  for (const p of result.placements) {
    const ref = p.metadata.candidateReference;
    const tier = ref.startsWith("t1") ? 1 : ref.startsWith("t2") ? 2 : 3;
    const g = p.metadata.groupNumber;
    byTier[tier][g] = (byTier[tier][g] || 0) + 1;
  }
  for (const g of [1, 2, 3, 4]) {
    assert.equal(byTier[1][g], 1);
    assert.equal(byTier[2][g], 1);
    assert.equal(byTier[3][g], 1);
  }
});

test("3H pot groups: uneven pots reset snake per pot", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "pot-un",
    drawMode: DRAW_MODE.POT_GROUPS,
    groupCount: 4,
    candidates: [
      { id: "a", seedNumber: 1, seedTier: "1" },
      { id: "b", seedNumber: 2, seedTier: "1" },
      ...[3, 4, 5, 6, 7, 8].map((i) => ({
        id: `c${i}`,
        seedNumber: i,
        seedTier: "2",
      })),
    ],
  });
  assert.equal(result.ok, true);
  const map = Object.fromEntries(
    result.placements.map((p) => [
      p.metadata.candidateReference,
      p.metadata.groupNumber,
    ])
  );
  // Pot 1 (reset): a→G1, b→G2
  assert.equal(map.a, 1);
  assert.equal(map.b, 2);
  // Pot 2 (reset again): c3→G1, c4→G2, c5→G3, c6→G4, c7→G4, c8→G3
  assert.equal(map.c3, 1);
  assert.equal(map.c4, 2);
  assert.equal(map.c5, 3);
  assert.equal(map.c6, 4);
  assert.equal(map.c7, 4);
  assert.equal(map.c8, 3);
});

test("3H pot groups: missing tiers + duplicate seed numbers across tiers", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "pot-miss",
    drawMode: DRAW_MODE.POT_GROUPS,
    groupCount: 2,
    candidates: [
      { id: "u1", seedNumber: 1 }, // untiered
      { id: "a", seedNumber: 1, seedTier: "A" }, // same seedNumber, different tier
      { id: "b", seedNumber: 2, seedTier: "A" },
      { id: "c", seedNumber: 1, seedTier: "B" },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.placements.length, 4);
  const a = result.placements.find((p) => p.metadata.candidateReference === "a");
  const c = result.placements.find((p) => p.metadata.candidateReference === "c");
  // Separate pots: both seedNumber 1 allowed across tiers
  assert.equal(a.seedNumber, 1);
  assert.equal(c.seedNumber, 1);
  // Untiered pot last; pot A then pot B then untiered
  assert.ok(result.decisionTrace.some((t) => t.includes("pot=untiered")));
});

test("3H pot groups: capacity exhaustion rejects", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "pot-cap",
    drawMode: DRAW_MODE.POT_GROUPS,
    groupCount: 2,
    groupCapacity: 1,
    candidates: [
      { id: "a", seedNumber: 1, seedTier: "1" },
      { id: "b", seedNumber: 2, seedTier: "1" },
      { id: "c", seedNumber: 3, seedTier: "2" },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_OVERFLOW);
});

test("3H protected/manual conflict rejects", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "prot-conflict",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    candidates: [
      { id: "a", seedNumber: 1 },
      { id: "b", seedNumber: 2 },
    ],
    manualPlacements: [
      { candidateReference: "a", groupNumber: 1, positionNumber: 1 },
    ],
    protectedPlacements: [
      { candidateReference: "a", groupNumber: 2, positionNumber: 1 },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_PROTECTED_PLACEMENT_CONFLICT
  );
});

test("3H duplicate manual for same candidate rejects", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "dup-cand-manual",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    candidates: seedCandidates(4),
    manualPlacements: [
      { candidateReference: "e-1", groupNumber: 1, positionNumber: 1 },
      { candidateReference: "e-1", groupNumber: 2, positionNumber: 1 },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_DUPLICATE
  );
});

test("3H HYBRID is Integrator-owned and not executable", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "hybrid",
    drawMode: DRAW_MODE.HYBRID,
    groupCount: 2,
    candidates: seedCandidates(4),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_UNSUPPORTED_MODE
  );
});

test("3H seeded bracket bye slots protect top seeds", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "bye-top",
    drawMode: DRAW_MODE.SEEDED_BRACKET,
    bracketSize: 8,
    candidates: seedCandidates(5),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.byes.map((b) => b.slotNumber).sort((a, b) => a - b),
    [2, 6, 8]
  );
  // Slots 2/6/8 are classic opponents of seeds 1/2/3 (seeds 8/7/6)
  const seedToSlot = Object.fromEntries(
    result.placements.map((p) => [p.seedNumber, p.slotNumber])
  );
  assert.equal(seedToSlot[1], 1);
  assert.equal(seedToSlot[2], 5);
  assert.equal(seedToSlot[3], 7);
});

test("3H open groups: deterministic with seed; identity without", async () => {
  const resolver = createDrawResolver();
  const withSeed = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "open-a",
    drawMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    groupCount: 2,
    deterministicSeed: "draw-42",
    candidates: [
      { id: "z" },
      { id: "a" },
      { id: "m" },
      { id: "b" },
    ],
  });
  const withSeed2 = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "open-b",
    drawMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    groupCount: 2,
    deterministicSeed: "draw-42",
    candidates: [
      { id: "z" },
      { id: "a" },
      { id: "m" },
      { id: "b" },
    ],
  });
  assert.equal(withSeed.ok, true);
  assert.deepEqual(
    withSeed.placements.map((p) => [
      p.metadata.candidateReference,
      p.metadata.groupNumber,
    ]),
    withSeed2.placements.map((p) => [
      p.metadata.candidateReference,
      p.metadata.groupNumber,
    ])
  );

  const noSeed = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "open-id",
    drawMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    groupCount: 2,
    candidates: [{ id: "z" }, { id: "a" }, { id: "m" }, { id: "b" }],
  });
  assert.equal(noSeed.ok, true);
  assert.equal(noSeed.diagnostics.defaultOrdering, "identity");
  // identity order of keys → a, b, m, z
  assert.equal(noSeed.placements[0].metadata.candidateReference, "a");
});

test("3H repeatability: same inputs → same placements", async () => {
  const lookup = createDrawIdentityLookup();
  const resolver = createDrawResolver({ identityLookup: lookup });
  const request = {
    competitionId: "comp-1",
    contextId: "ctx",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(8),
    deterministicSeed: "seed-42",
  };
  const first = await resolver.resolve(request);
  lookup.clear();
  const second = await resolver.resolve(request);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(
    first.placements.map((p) => [p.candidateIdentityKey, p.metadata.groupNumber]),
    second.placements.map((p) => [p.candidateIdentityKey, p.metadata.groupNumber])
  );
});

test("3H seedAssignments only", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "seeds-only",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    seedAssignments: [
      {
        identityKey: "x::SEED::1",
        candidateIdentityKey: "foreign::CANDIDATE::t1",
        seedNumber: 1,
        metadata: { candidateReference: "t1" },
      },
      {
        identityKey: "x::SEED::2",
        candidateIdentityKey: "foreign::CANDIDATE::t2",
        seedNumber: 2,
        metadata: { candidateReference: "t2" },
      },
      {
        identityKey: "x::SEED::3",
        candidateIdentityKey: "foreign::CANDIDATE::t3",
        seedNumber: 3,
        metadata: { candidateReference: "t3" },
      },
      {
        identityKey: "x::SEED::4",
        candidateIdentityKey: "foreign::CANDIDATE::t4",
        seedNumber: 4,
        metadata: { candidateReference: "t4" },
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.placements.length, 4);
});

test("3H candidates + seedAssignments join", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "join",
    drawMode: DRAW_MODE.SEEDED_GROUPS,
    groupCount: 2,
    candidates: [{ id: "p1" }, { id: "p2" }],
    seedAssignments: [
      {
        candidateIdentityKey: "comp-1::DRAW::join::CANDIDATE::p1",
        seedNumber: 1,
      },
      {
        candidateIdentityKey: "comp-1::DRAW::join::CANDIDATE::p2",
        seedNumber: 2,
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.placements[0].seedNumber, 1);
});

test("3H join mismatch fails", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "bad-join",
    drawMode: DRAW_MODE.SEEDED_GROUPS,
    groupCount: 2,
    candidates: [{ id: "p1" }, { id: "p2" }],
    seedAssignments: [
      { candidateIdentityKey: "other::CANDIDATE::x", seedNumber: 1 },
      { candidateIdentityKey: "other::CANDIDATE::y", seedNumber: 2 },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, DRAW_RUNTIME_ERROR_CODE.DRAW_IDENTITY_MISMATCH);
});

test("3H manual + protected placement", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "manual",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    candidates: seedCandidates(4),
    manualPlacements: [
      { candidateReference: "e-4", groupNumber: 1, positionNumber: 1 },
    ],
    protectedPlacements: [
      { candidateReference: "e-1", groupNumber: 2, positionNumber: 1 },
    ],
  });
  assert.equal(result.ok, true);
  const e4 = result.placements.find((p) => p.metadata.candidateReference === "e-4");
  const e1 = result.placements.find((p) => p.metadata.candidateReference === "e-1");
  assert.equal(e4.metadata.groupNumber, 1);
  assert.equal(e4.placementReason, PLACEMENT_REASON.MANUAL);
  assert.equal(e1.metadata.groupNumber, 2);
  assert.equal(e1.placementType, PLACEMENT_TYPE.PROTECTED);
});

test("3H duplicate manual positions rejected", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "dup-manual",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    candidates: seedCandidates(4),
    manualPlacements: [
      { candidateReference: "e-1", groupNumber: 1, positionNumber: 1 },
      { candidateReference: "e-2", groupNumber: 1, positionNumber: 1 },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_DUPLICATE
  );
});

test("3H partial manual placement leaves auto-fill", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "partial",
    drawMode: DRAW_MODE.MANUAL_PLACEMENT,
    groupCount: 2,
    candidates: seedCandidates(4),
    manualPlacements: [
      { candidateReference: "e-1", groupNumber: 1, positionNumber: 1 },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.placements.length, 1);
  assert.equal(result.unresolvedCandidates.length, 3);
});

test("3H bracket + bye first-class", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "bracket",
    drawMode: DRAW_MODE.SEEDED_BRACKET,
    bracketSize: 8,
    candidates: seedCandidates(5),
  });
  assert.equal(result.ok, true);
  assert.equal(result.placements.length, 5);
  assert.equal(result.byes.length, 3);
  assert.equal(result.brackets.length, 1);
  assert.equal(result.brackets[0].bracketSize, 8);
  assert.equal(calculateByeCount(8, 5), 3);
  assert.ok(result.byes.every((b) => b.identityKey.includes("::BYE::")));
  assert.ok(result.placements.every((p) => p.positionNumber === p.slotNumber));
});

test("3H non-power-of-two bracket rejected by default", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "bad-bracket",
    drawMode: DRAW_MODE.SEEDED_BRACKET,
    bracketSize: 6,
    candidates: seedCandidates(4),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_BRACKET_SIZE_INVALID
  );
});

test("3H non-power-of-two allowed with explicit flag", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "np2",
    drawMode: DRAW_MODE.SEEDED_BRACKET,
    bracketSize: 6,
    allowNonPowerOfTwo: true,
    candidates: seedCandidates(4),
  });
  assert.equal(result.ok, true);
  assert.equal(result.byes.length, 2);
});

test("3H invalid group count", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "bad-g",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 0,
    candidates: seedCandidates(4),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_COUNT_INVALID
  );
});

test("3H duplicate candidates rejected", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "dup",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    candidates: [{ id: "a" }, { id: "a" }],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_DUPLICATE
  );
});

test("3H duplicate seed assignments rejected", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "dup-seed",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    seedAssignments: [
      { candidateIdentityKey: "k1", seedNumber: 1, candidateReference: "a" },
      { candidateIdentityKey: "k2", seedNumber: 1, candidateReference: "b" },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_SEED_ASSIGNMENT_DUPLICATE
  );
});

test("3H persistence OFF by default; ON with in-memory port", async () => {
  const resolverOff = createDrawResolver();
  const off = await resolverOff.resolve({
    competitionId: "comp-1",
    contextId: "persist-off",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    candidates: seedCandidates(4),
  });
  assert.equal(off.ok, true);
  assert.equal(off.diagnostics.persisted, false);
  assert.equal(off.snapshot, null);

  const port = createInMemoryDrawPersistencePort();
  const resolverOn = createDrawResolver({
    enablePersistence: true,
    persistence: port,
  });
  const on = await resolverOn.resolve({
    competitionId: "comp-1",
    contextId: "persist-on",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    candidates: seedCandidates(4),
  });
  assert.equal(on.ok, true);
  assert.equal(on.diagnostics.persisted, true);
  assert.ok(on.snapshot);
  const found = await port.findByIdentityKey(on.identity.key);
  assert.ok(found);

  const noop = createNoopDrawPersistencePort();
  await assert.rejects(() => noop.save({ id: "x" }));
});

test("3H map-only legacy adapter", async () => {
  const mapped = mapLegacyDrawToCandidates(
    { entries: [{ id: "e1", seed: 1 }, { id: "e2", seed: 2 }] },
    { competitionId: "c", contextId: "x" }
  );
  assert.equal(mapped.length, 2);
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "c",
    contextId: "legacy-src",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    source: { entries: [{ id: "e1" }, { id: "e2" }, { id: "e3" }, { id: "e4" }] },
  });
  assert.equal(result.ok, true);
  assert.equal(result.adapterId, DRAW_ADAPTER_ID.LEGACY);
});

test("3H injected deterministic RNG", () => {
  const a = createDeterministicRandomFromSeed("same");
  const b = createDeterministicRandomFromSeed("same");
  assert.equal(a(), b());
  assert.ok(a() >= 0 && a() < 1);
});

test("3H typed errors", () => {
  const err = new DrawRuntimeError(
    DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
    "bad",
    { x: 1 }
  );
  assert.equal(err.code, DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT);
  assert.equal(err.details.x, 1);
});

test("3H noop policy + excluded candidates", async () => {
  const resolver = createDrawResolver({
    drawPolicy: {
      ...createNoopDrawPolicy(),
      isEligible(c) {
        return c.candidateReference !== "e-2";
      },
    },
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "excl",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    candidates: seedCandidates(4),
  });
  assert.equal(result.ok, true);
  assert.equal(result.excludedCandidates.length, 1);
  assert.equal(result.placements.length, 3);
});

test("3H open bracket deterministic", async () => {
  const resolver = createDrawResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "obracket",
    drawMode: DRAW_MODE.OPEN_RANDOM_BRACKET,
    bracketSize: 4,
    deterministicSeed: "b-1",
    candidates: seedCandidates(3),
  });
  assert.equal(result.ok, true);
  assert.equal(result.byes.length, 1);
  assert.equal(result.placements.length, 3);
});

test("3H seedingResolver not called by default", async () => {
  let called = false;
  const resolver = createDrawResolver({
    seedingResolver: async () => {
      called = true;
      return {};
    },
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    contextId: "no-seed-call",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    candidates: seedCandidates(4),
  });
  assert.equal(result.ok, true);
  assert.equal(called, false);
  assert.equal(result.diagnostics.seedingResolverCalled, false);
});

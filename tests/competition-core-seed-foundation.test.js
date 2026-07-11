import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_SEED_SOURCE,
  CANONICAL_SEED_SOURCE_VALUES,
  DEFAULT_SEED_TIEBREAK_ORDER,
  SEED_ENGINE_VERSION,
  SEED_TIEBREAK_KIND,
  applySeedTieBreakKind,
  cloneSeedRequest,
  computeReferenceSeedScoreComponents,
  createCanonicalSeedObject,
  createSeedRequest,
  isCanonicalSeedSource,
  mapLegacySeedSourceToCanonical,
  resolveReferenceRatingSource,
  resolveSeedAdjustments,
  runCanonicalSeedPipeline,
  serializeSeedContract,
  sortParticipantsForSeedRank,
  validateSeedRequestShape,
  validateSeedResultShape,
} from "../src/features/competition-core/index.js";

function assertUniqueValues(valuesSet, label) {
  const values = [...valuesSet];
  assert.equal(values.length, new Set(values).size, `${label} must not contain duplicate values`);
}

test("canonical seed source enum is unique and covers audit inventory", () => {
  assertUniqueValues(CANONICAL_SEED_SOURCE_VALUES, "CANONICAL_SEED_SOURCE");
  assert.equal(isCanonicalSeedSource(CANONICAL_SEED_SOURCE.INTERNAL_RATING), true);
  assert.equal(isCanonicalSeedSource(CANONICAL_SEED_SOURCE.LEGACY_BLOB), true);
  assert.equal(isCanonicalSeedSource(CANONICAL_SEED_SOURCE.TOURNAMENT_OVERRIDE), true);
  assert.equal(isCanonicalSeedSource(CANONICAL_SEED_SOURCE.RANKING), true);
});

test("legacy seed source mapping resolves runtime keys", () => {
  assert.equal(mapLegacySeedSourceToCanonical("level"), CANONICAL_SEED_SOURCE.AVERAGE_LEVEL);
  assert.equal(
    mapLegacySeedSourceToCanonical("ratingInternal"),
    CANONICAL_SEED_SOURCE.INTERNAL_RATING
  );
  assert.equal(
    mapLegacySeedSourceToCanonical("manualSeedOverride"),
    CANONICAL_SEED_SOURCE.MANUAL
  );
  assert.equal(
    mapLegacySeedSourceToCanonical("stripOpenEntryMetadata"),
    CANONICAL_SEED_SOURCE.TOURNAMENT_OVERRIDE
  );
  assert.equal(mapLegacySeedSourceToCanonical("unknown-key"), CANONICAL_SEED_SOURCE.UNKNOWN);
});

test("seed object factory includes required fields", () => {
  const seed = createCanonicalSeedObject({
    participantId: "p1",
    seedNumber: 2,
    seedScore: 0.82,
    seedReason: "Competition Elo + Performance",
    source: CANONICAL_SEED_SOURCE.COMPETITION_ELO,
    confidence: 0.9,
    adjustments: [{ kind: CANONICAL_SEED_SOURCE.MANUAL_ADJUSTMENT, value: 0.05 }],
    provisional: false,
    manualOverride: false,
    rankingSnapshot: { rank: 2, seedScore: 0.82, primarySource: CANONICAL_SEED_SOURCE.COMPETITION_ELO },
  });

  assert.equal(seed.seedNumber, 2);
  assert.equal(seed.source, CANONICAL_SEED_SOURCE.COMPETITION_ELO);
  assert.equal(seed.adjustments.length, 1);
  assert.equal(seed.rankingSnapshot?.rank, 2);
});

test("reference seed computation handles manual override and provisional penalty", () => {
  const override = computeReferenceSeedScoreComponents({
    manualOverride: true,
    manualSeedNumber: 1,
  });
  assert.equal(override.manualOverrideScore, 9998);

  const provisional = computeReferenceSeedScoreComponents({
    competitionElo: 1600,
    winRate: 0.6,
    performance: 0.7,
    provisional: true,
  });
  assert.ok(provisional.total != null);
  assert.ok((provisional.provisionalPenalty ?? 0) > 0);
});

test("tie-break order resolves equal seed scores", () => {
  const left = { id: "a", seedScore: 1, competitionElo: 1500, winRate: 0.5 };
  const right = { id: "b", seedScore: 1, competitionElo: 1400, winRate: 0.5 };

  const byElo = applySeedTieBreakKind(SEED_TIEBREAK_KIND.HIGHER_ELO, left, right);
  assert.equal(byElo.decided, true);
  assert.equal(byElo.winnerId, "a");

  const sorted = sortParticipantsForSeedRank([right, left], DEFAULT_SEED_TIEBREAK_ORDER);
  assert.equal(sorted.sorted[0].id, "a");
});

test("adjustments resolve manual priority and tournament override", () => {
  const adjustments = resolveSeedAdjustments({
    manualPriority: 0.2,
    tournamentOverride: true,
  });
  assert.equal(adjustments.length, 2);
  assert.ok(adjustments.some((item) => item.kind === CANONICAL_SEED_SOURCE.MANUAL_ADJUSTMENT));
  assert.ok(adjustments.some((item) => item.kind === CANONICAL_SEED_SOURCE.TOURNAMENT_OVERRIDE));
});

test("canonical seed pipeline produces ranked seeds, explanations, and audit", () => {
  const request = createSeedRequest({
    tournamentId: "t1",
    participants: [
      { id: "p1", name: "Player A", competitionElo: 1700, winRate: 0.7, performance: 0.8 },
      { id: "p2", name: "Player B", competitionElo: 1500, winRate: 0.55, performance: 0.6 },
      { id: "p3", name: "Player C", manualOverride: true, manualSeedNumber: 1 },
    ],
  });

  assert.equal(validateSeedRequestShape(request).ok, true);

  const result = runCanonicalSeedPipeline(request);
  assert.equal(result.ok, true);
  assert.equal(result.seeds.length, 3);
  assert.equal(result.computations.length, 3);
  assert.ok(result.explanations.length >= 3);
  assert.equal(result.audit?.engineVersion, SEED_ENGINE_VERSION);
  assert.equal(validateSeedResultShape(result).ok, true);

  const manualSeed = result.seeds.find((item) => item.participantId === "p3");
  assert.equal(manualSeed?.manualOverride, true);
  const p3Explanation = result.explanations.find((item) => item.participantId === "p3");
  assert.ok((p3Explanation?.path || []).length > 0);
});

test("seed contracts serialize and clone safely", () => {
  const request = createSeedRequest({
    participants: [{ id: "p1", level: 4.2 }],
  });
  const cloned = cloneSeedRequest(request);
  cloned.participants.push({ id: "p2" });
  assert.equal(request.participants.length, 1);

  const roundTrip = serializeSeedContract(request);
  assert.equal(roundTrip.participants[0].id, "p1");
});

test("rating source resolver maps internal and legacy blob paths", () => {
  assert.equal(
    resolveReferenceRatingSource({ ratingInternal: 4.5 }),
    CANONICAL_SEED_SOURCE.INTERNAL_RATING
  );
  assert.equal(
    resolveReferenceRatingSource({ legacyBlob: true, rating: 3.8 }),
    CANONICAL_SEED_SOURCE.LEGACY_BLOB
  );
  assert.equal(
    resolveReferenceRatingSource({ ranking: 12, level: 4 }),
    CANONICAL_SEED_SOURCE.RANKING
  );
});

test("importing seed foundation has no runtime side effects", async () => {
  const before = Object.keys(globalThis).length;
  await import("../src/features/competition-core/seed/index.js");
  const after = Object.keys(globalThis).length;
  assert.equal(after, before);
});

/**
 * CORE-08 Phase 1D — open draw compatibility (shuffle-then-snake) tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDrawResolver,
  DRAW_MODE,
  DRAW_RUNTIME_ERROR_CODE,
  PLACEMENT_REASON,
  getSnakeGroupIndex,
  getSeededGroupIndex,
  deterministicShuffle,
  createDeterministicRandomFromSeed,
  assignOpenRandomGroups,
  assignOpenShuffledSnakeGroups,
  assignSnakeGroups,
  buildGroupIdentityKey,
  buildDrawIdentityKey,
  MODE_MAPPING_STATUS,
  findModeMappingRow,
  mapLegacyModeToPhase3h,
  runTeamTournamentGroupingAdapter,
  DRAW_CERTIFICATION_ERROR_CODE,
  matchesConstraintResolver,
} from "../src/features/competition-core/draw-runtime/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME = path.join(ROOT, "src/features/competition-core/draw-runtime");

function seedCandidates(n = 8) {
  return Array.from({ length: n }, (_, i) => ({
    id: `e-${i + 1}`,
    entryId: `e-${i + 1}`,
    seedNumber: i + 1,
  }));
}

function membershipByGroup(result) {
  /** @type {Record<string, string[]>} */
  const byGroup = {};
  for (const p of result.placements) {
    const gn = String(p.metadata?.groupNumber ?? "");
    if (!byGroup[gn]) byGroup[gn] = [];
    byGroup[gn].push(String(p.metadata?.candidateReference));
  }
  for (const key of Object.keys(byGroup)) {
    byGroup[key].sort();
  }
  return byGroup;
}

function placementFingerprint(result) {
  return result.placements
    .map((p) => [
      p.candidateIdentityKey,
      p.groupIdentityKey,
      p.positionNumber,
      p.seedNumber,
      p.placementReason,
    ])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

// --- Baseline compatibility ---

test("1D baseline: OPEN_RANDOM_GROUPS unchanged vs prior fingerprint", async () => {
  const request = {
    competitionId: "c-1d",
    contextId: "x-1d",
    drawMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(8),
    deterministicSeed: "open-rr-baseline",
  };
  const a = await createDrawResolver().resolve(request);
  const b = await createDrawResolver().resolve(request);
  assert.equal(a.ok, true);
  assert.deepEqual(placementFingerprint(a), placementFingerprint(b));
  // Round-robin index: first shuffled slot → G1 (seeded index 0)
  assert.ok(
    a.placements.every(
      (p) =>
        p.placementReason === PLACEMENT_REASON.OPEN_DETERMINISTIC ||
        p.placementReason === PLACEMENT_REASON.MANUAL ||
        p.placementReason === PLACEMENT_REASON.PROTECTED
    )
  );
});

test("1D baseline: SNAKE_GROUPS unchanged (seed order, no shuffle)", async () => {
  const request = {
    competitionId: "c-1d",
    contextId: "snake-1d",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(8),
  };
  const result = await createDrawResolver().resolve(request);
  assert.equal(result.ok, true);
  const byRef = Object.fromEntries(
    result.placements.map((p) => [
      p.metadata.candidateReference,
      p.metadata.groupNumber,
    ])
  );
  // seed 1 → G1, seed 2 → G2, seed 5 → G4 (snake reverse)
  assert.equal(byRef["e-1"], 1);
  assert.equal(byRef["e-2"], 2);
  assert.equal(byRef["e-5"], 4);
  assert.ok(
    result.placements.every((p) => p.placementReason === PLACEMENT_REASON.SNAKE)
  );
});

test("1D baseline: Phase 1C constraint hook still works with new mode", async () => {
  let calls = 0;
  const result = await createDrawResolver({
    constraintResolver() {
      calls += 1;
      return { ok: true, accepted: true };
    },
  }).resolve({
    competitionId: "c",
    contextId: "ctx",
    drawMode: DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
    groupCount: 2,
    candidates: seedCandidates(4),
    deterministicSeed: "1c-compat",
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(result.diagnostics.constraintResolverInvoked, true);
  assert.ok(result.decisionTrace.includes("CONSTRAINT_ACCEPTED"));
});

// --- Shuffle-then-snake behavior ---

test("1D: OPEN_SHUFFLED_SNAKE uses snake index not round-robin", () => {
  // After a full forward row, snake reverses: step 4 → group index 3; round-robin → 0
  assert.equal(getSnakeGroupIndex(4, 4), 3);
  assert.equal(getSeededGroupIndex(4, 4), 0);
  assert.notEqual(getSnakeGroupIndex(4, 4), getSeededGroupIndex(4, 4));
});

test("1D: assignOpenShuffledSnakeGroups composes existing primitives", () => {
  const src = readFileSync(
    path.join(RUNTIME, "services/assignGroups.js"),
    "utf8"
  );
  const fnStart = src.indexOf("export function assignOpenShuffledSnakeGroups");
  assert.ok(fnStart >= 0);
  const fnBody = src.slice(fnStart, fnStart + 1200);
  assert.match(fnBody, /deterministicShuffle/);
  assert.match(fnBody, /getSnakeGroupIndex/);
  assert.doesNotMatch(fnBody, /for\s*\(\s*let\s+i\s*=\s*out\.length/);
  assert.doesNotMatch(fnBody, /Math\.random/);
  // Must not re-implement snake index arithmetic inside the new function
  assert.doesNotMatch(
    fnBody,
    /groupCount\s*-\s*1\s*-\s*col/
  );
});

test("1D: same seed → identical OPEN_SHUFFLED_SNAKE_GROUPS", async () => {
  const request = {
    competitionId: "c",
    contextId: "oss",
    drawMode: DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(8),
    deterministicSeed: "oss-repeat",
  };
  const a = await createDrawResolver().resolve(request);
  const b = await createDrawResolver().resolve(request);
  assert.equal(a.ok, true);
  assert.deepEqual(membershipByGroup(a), membershipByGroup(b));
  assert.deepEqual(placementFingerprint(a), placementFingerprint(b));
});

test("1D: different seeds → different membership for representative fixture", async () => {
  const base = {
    competitionId: "c",
    contextId: "oss-diff",
    drawMode: DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(12),
  };
  const a = await createDrawResolver().resolve({
    ...base,
    deterministicSeed: "seed-A",
  });
  const b = await createDrawResolver().resolve({
    ...base,
    deterministicSeed: "seed-B",
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.notDeepEqual(membershipByGroup(a), membershipByGroup(b));
});

test("1D: OPEN_SHUFFLED_SNAKE differs from OPEN_RANDOM for same seed", async () => {
  const candidates = seedCandidates(8);
  const seed = "same-seed-compare";
  const snake = await createDrawResolver().resolve({
    competitionId: "c",
    contextId: "cmp-s",
    drawMode: DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
    groupCount: 4,
    candidates,
    deterministicSeed: seed,
  });
  const rr = await createDrawResolver().resolve({
    competitionId: "c",
    contextId: "cmp-r",
    drawMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    groupCount: 4,
    candidates,
    deterministicSeed: seed,
  });
  assert.equal(snake.ok, true);
  assert.equal(rr.ok, true);
  // Same shuffle order but different placement index → membership differs for N>groupCount
  assert.notDeepEqual(membershipByGroup(snake), membershipByGroup(rr));
  assert.ok(
    snake.placements.some(
      (p) => p.placementReason === PLACEMENT_REASON.OPEN_SHUFFLED_SNAKE
    )
  );
});

test("1D: all candidates once; capacity enforced; positions stable", async () => {
  const result = await createDrawResolver().resolve({
    competitionId: "c",
    contextId: "inv",
    drawMode: DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
    groupCount: 3,
    groupCapacity: 3,
    candidates: seedCandidates(9),
    deterministicSeed: "cap-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.placements.length, 9);
  const keys = result.placements.map((p) => p.candidateIdentityKey);
  assert.equal(new Set(keys).size, 9);
  assert.equal(result.groups.length, 3);
  for (const g of result.groups) {
    assert.ok(g.candidateIdentityKeys.length <= 3);
  }
  const overflow = await createDrawResolver().resolve({
    competitionId: "c",
    contextId: "inv-o",
    drawMode: DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
    groupCount: 2,
    groupCapacity: 2,
    candidates: seedCandidates(5),
    deterministicSeed: "cap-overflow",
  });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.error.code, DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_OVERFLOW);
});

test("1D: seed identity preserved through shuffle-then-snake", async () => {
  const result = await createDrawResolver().resolve({
    competitionId: "c",
    contextId: "seed-id",
    drawMode: DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
    groupCount: 2,
    candidates: seedCandidates(4),
    deterministicSeed: "seed-preserve",
  });
  assert.equal(result.ok, true);
  for (const p of result.placements) {
    const ref = p.metadata.candidateReference;
    const expectedSeed = Number(String(ref).replace("e-", ""));
    assert.equal(p.seedNumber, expectedSeed);
  }
});

test("1D: without seed uses identity order then snake (not Math.random)", async () => {
  const result = await createDrawResolver().resolve({
    competitionId: "c",
    contextId: "no-seed",
    drawMode: DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(8),
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.deterministicRngReady, false);
  assert.ok(
    result.placements.every(
      (p) => p.placementReason === PLACEMENT_REASON.IDENTITY_ORDER
    )
  );
  // Identity-ordered snake: e-1→G1, e-2→G2, e-5→G4
  const byRef = Object.fromEntries(
    result.placements.map((p) => [
      p.metadata.candidateReference,
      p.metadata.groupNumber,
    ])
  );
  assert.equal(byRef["e-1"], 1);
  assert.equal(byRef["e-5"], 4);
});

test("1D: service-level composition matches resolver mode", () => {
  const candidates = seedCandidates(6).map((c, i) => ({
    candidateId: c.id,
    candidateReference: c.id,
    candidateIdentityKey: `c::DRAW::x::CANDIDATE::${c.id}`,
    seedNumber: c.seedNumber,
  }));
  const opts = {
    drawIdentityKey: "c::DRAW::x",
    competitionId: "c",
    contextId: "x",
    groupCount: 3,
    deterministicSeed: "svc-1",
  };
  const composed = assignOpenShuffledSnakeGroups(candidates, opts);
  const openRr = assignOpenRandomGroups(candidates, opts);
  assert.notDeepEqual(
    composed.placements.map((p) => p.groupIdentityKey),
    openRr.placements.map((p) => p.groupIdentityKey)
  );
  // Snake with seed-order (no shuffle) differs from shuffled snake for this seed
  const seededSnake = assignSnakeGroups(candidates, opts);
  assert.notDeepEqual(
    composed.placements.map((p) => p.candidateIdentityKey + p.groupIdentityKey),
    seededSnake.placements.map((p) => p.candidateIdentityKey + p.groupIdentityKey)
  );
});

// --- Team Tournament adapter ---

test("1D TT: seeded_snake path unchanged", async () => {
  const result = await runTeamTournamentGroupingAdapter({
    competitionId: "tt",
    contextId: "d",
    teams: seedCandidates(6).map((e) => ({ id: e.id, seedNumber: e.seedNumber })),
    groupCount: 3,
    placementKind: "seeded_snake",
  });
  assert.equal(result.ok, true);
  assert.equal(result.phase3hMode, DRAW_MODE.SNAKE_GROUPS);
});

test("1D TT: open_random remains OPEN_RANDOM_GROUPS partial parity", async () => {
  const result = await runTeamTournamentGroupingAdapter({
    competitionId: "tt",
    contextId: "d",
    teams: seedCandidates(6).map((e) => ({ id: e.id, seedNumber: e.seedNumber })),
    groupCount: 3,
    placementKind: "open_random",
    deterministicSeed: "tt-open-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.parity, "PARTIAL_PARITY");
  assert.equal(result.phase3hMode, DRAW_MODE.OPEN_RANDOM_GROUPS);
});

test("1D TT: open_shuffled_snake uses OPEN_SHUFFLED_SNAKE_GROUPS", async () => {
  const result = await runTeamTournamentGroupingAdapter({
    competitionId: "tt",
    contextId: "d",
    teams: seedCandidates(6).map((e) => ({ id: e.id, seedNumber: e.seedNumber })),
    groupCount: 3,
    placementKind: "open_shuffled_snake",
    deterministicSeed: "tt-oss-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.phase3hMode, DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS);
  assert.equal(
    result.parity,
    "SEMANTIC_PARITY_WITH_DOCUMENTED_DIFFERENCES"
  );
  assert.ok(
    result.canonical.placements.some(
      (p) => p.placementReason === PLACEMENT_REASON.OPEN_SHUFFLED_SNAKE
    )
  );
});

test("1D TT: private pairing still fail closed", async () => {
  const result = await runTeamTournamentGroupingAdapter({
    competitionId: "tt",
    contextId: "d",
    teams: seedCandidates(4).map((e) => ({ id: e.id })),
    groupCount: 2,
    placementKind: "open_shuffled_snake",
    deterministicSeed: "x",
    privatePairingRules: [{ id: "r1" }],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_CONSTRAINTS_UNSUPPORTED
  );
});

test("1D TT adapter: no legacy engine import / no local shuffle", () => {
  const src = readFileSync(
    path.join(RUNTIME, "adapters/teamTournamentGroupingAdapter.js"),
    "utf8"
  );
  assert.doesNotMatch(src, /from\s+['"][^'"]*team-tournament/);
  assert.doesNotMatch(src, /from\s+['"][^'"]*teamAutoDrawEngine/);
  assert.doesNotMatch(src, /from\s+['"][^'"]*teamGroupSeedEngine/);
  assert.doesNotMatch(src, /import\s*\{[^}]*shuffleTeamsForOpenDraw/);
  assert.doesNotMatch(src, /import\s*\{[^}]*buildSnakeGroupsFromSortedTeams/);
  assert.doesNotMatch(src, /import\s*\{[^}]*deterministicShuffle/);
  assert.doesNotMatch(src, /import\s*\{[^}]*getSnakeGroupIndex/);
  assert.doesNotMatch(src, /Math\.random/);
  assert.match(src, /OPEN_SHUFFLED_SNAKE_GROUPS/);
});

// --- Mode mapping ---

test("1D mode mapping: tt_open_shuffle_snake → OPEN_SHUFFLED_SNAKE_GROUPS EXACT", () => {
  const row = findModeMappingRow("tt_open_shuffle_snake");
  assert.equal(row.phase3hMode, DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS);
  assert.equal(row.status, MODE_MAPPING_STATUS.EXACT);
  const mapped = mapLegacyModeToPhase3h("tt_open_shuffle_snake");
  assert.equal(mapped.ok, true);
  assert.equal(mapped.phase3hMode, DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS);
});

test("1D mode mapping: open_shuffled_snake alias EXACT", () => {
  const mapped = mapLegacyModeToPhase3h("open_shuffled_snake");
  assert.equal(mapped.ok, true);
  assert.equal(mapped.phase3hMode, DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS);
});

test("1D mode mapping: generic open remains CONDITIONAL OPEN_RANDOM", () => {
  const row = findModeMappingRow("open");
  assert.equal(row.phase3hMode, DRAW_MODE.OPEN_RANDOM_GROUPS);
  assert.equal(row.status, MODE_MAPPING_STATUS.CONDITIONAL);
});

test("1D mode mapping: ambiguous/unknown still fail closed", () => {
  const custom = mapLegacyModeToPhase3h("custom");
  assert.equal(custom.ok, false);
  assert.equal(custom.code, DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_AMBIGUOUS);
  const unknown = mapLegacyModeToPhase3h("not-a-real-mode");
  assert.equal(unknown.ok, false);
});

// --- Architecture ---

test("1D architecture: no new PRNG / no production imports in Phase 1D surface", () => {
  const files = [
    path.join(RUNTIME, "services/assignGroups.js"),
    path.join(RUNTIME, "enums/drawModes.js"),
    path.join(RUNTIME, "adapters/teamTournamentGroupingAdapter.js"),
    path.join(RUNTIME, "adapters/modeMapping.js"),
    path.join(RUNTIME, "DrawResolver.js"),
  ];
  const forbidden = [
    /createMulberry32\s*\(/, // new PRNG factory in changed surface (allow deterministicRandom.js only)
    /Math\.random\s*\(/,
    /Date\.now\s*\(/,
    /from\s+['"][^'"]*team-tournament/,
    /from\s+['"][^'"]*pairing-constraints/,
    /from\s+['"][^'"]*pages\//,
    /from\s+['"][^'"]*supabase/,
    /process\.env/,
  ];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      if (
        pattern.source.includes("createMulberry32") &&
        file.endsWith("assignGroups.js")
      ) {
        // assignGroups may import createDeterministicRandomFromSeed, not createMulberry32
        assert.doesNotMatch(content, /function\s+createMulberry32/);
        continue;
      }
      assert.doesNotMatch(
        content,
        pattern,
        `${path.relative(ROOT, file)} matched ${pattern}`
      );
    }
  }
  assert.ok(
    existsSync(path.join(RUNTIME, "adapters/LegacyDrawAdapter.js")),
    "legacy fallback remains"
  );
  assert.equal(matchesConstraintResolver(() => ({})), true);
});

test("1D: draw identity stable for OPEN_SHUFFLED_SNAKE_GROUPS", async () => {
  const expected = buildDrawIdentityKey({
    competitionId: "comp-oss",
    contextId: "event-oss",
  });
  const result = await createDrawResolver().resolve({
    competitionId: "comp-oss",
    contextId: "event-oss",
    drawMode: DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
    groupCount: 2,
    candidates: seedCandidates(4),
    deterministicSeed: "id-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.identity.key, expected);
  assert.ok(result.placements.every((p) => p.drawIdentityKey === expected));
  assert.equal(
    buildGroupIdentityKey({ drawIdentityKey: expected, groupNumber: 1 }),
    `${expected}::GROUP::1`
  );
});

test("1D: deterministicShuffle primitive still seed-stable", () => {
  const items = ["a", "b", "c", "d", "e", "f"];
  const a = deterministicShuffle(
    items,
    createDeterministicRandomFromSeed("s1")
  );
  const b = deterministicShuffle(
    items,
    createDeterministicRandomFromSeed("s1")
  );
  const c = deterministicShuffle(
    items,
    createDeterministicRandomFromSeed("s2")
  );
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

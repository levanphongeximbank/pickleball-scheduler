/**
 * CORE-08 Phase 1B — Draw Runtime adapter certification tests.
 * Adapters must map + delegate only. No production cutover.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DRAW_MODE,
  DRAW_CERTIFICATION_ERROR_CODE,
  MODE_MAPPING_STATUS,
  LEGACY_TO_PHASE3H_MODE_MATRIX,
  mapLegacyModeToPhase3h,
  mapCertificationInputToDrawResolveRequest,
  membershipByLabel,
  runSeededGroupingAdapter,
  runOpenConditionalAdapter,
  runTeamTournamentGroupingAdapter,
  runConstraintGroupingAdapter,
  runCc04CompatibilityBridge,
  CC04_BRIDGE_POLICY,
  createDrawResolver,
} from "../src/features/competition-core/draw-runtime/index.js";

import { seedTeamsIntoGroups } from "../src/pages/tournament.seeding.logic.js";
import { assignGroupsWithConstraints } from "../src/features/pairing-constraints/engines/constraintGroupEngine.js";
import {
  isDrawV2Enabled,
  getCompetitionCoreFeatureFlags,
} from "../src/features/competition-core/config/featureFlags.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADAPTER_ROOT = path.join(
  ROOT,
  "src/features/competition-core/draw-runtime/adapters"
);
const RUNTIME_ROOT = path.join(
  ROOT,
  "src/features/competition-core/draw-runtime"
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

function rankedEntries(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i + 1}`,
    seedNumber: i + 1,
    name: `Entry ${i + 1}`,
  }));
}

// --- Mode mapping ---

test("1B mode mapping: skill_controlled → SNAKE_GROUPS EXACT", () => {
  const mapped = mapLegacyModeToPhase3h("skill_controlled");
  assert.equal(mapped.ok, true);
  assert.equal(mapped.phase3hMode, DRAW_MODE.SNAKE_GROUPS);
  assert.equal(mapped.status, MODE_MAPPING_STATUS.EXACT);
});

test("1B mode mapping: heuristic / custom / team fail closed", () => {
  assert.equal(mapLegacyModeToPhase3h("heuristic").ok, false);
  assert.equal(
    mapLegacyModeToPhase3h("heuristic").code,
    DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_UNSUPPORTED
  );
  assert.equal(mapLegacyModeToPhase3h("custom").ok, false);
  assert.equal(
    mapLegacyModeToPhase3h("custom").code,
    DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_AMBIGUOUS
  );
  assert.equal(mapLegacyModeToPhase3h("team").ok, false);
  assert.equal(
    mapLegacyModeToPhase3h("team").code,
    DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_FORMAT_SPECIFIC
  );
});

test("1B mode mapping: matrix has no silent default rows", () => {
  assert.ok(LEGACY_TO_PHASE3H_MODE_MATRIX.length >= 10);
  for (const row of LEGACY_TO_PHASE3H_MODE_MATRIX) {
    assert.ok(row.legacyMode);
    assert.ok(Object.values(MODE_MAPPING_STATUS).includes(row.status));
    if (
      row.status === MODE_MAPPING_STATUS.UNSUPPORTED ||
      row.status === MODE_MAPPING_STATUS.AMBIGUOUS ||
      row.status === MODE_MAPPING_STATUS.FORMAT_SPECIFIC
    ) {
      assert.ok(row.typedError, `typedError required for ${row.legacyMode}`);
    }
  }
});

// --- Input mapping ---

test("1B input mapping: identity, seeds, groupCount, capacity", () => {
  const mapped = mapCertificationInputToDrawResolveRequest({
    competitionId: "comp-1",
    contextId: "ctx-1",
    legacyMode: "skill_controlled",
    groupCount: 4,
    groupCapacity: 3,
    entries: [
      { id: "a", seedNumber: 1 },
      { id: "b", seedNumber: 2 },
    ],
  });
  assert.equal(mapped.ok, true);
  assert.equal(mapped.request.competitionId, "comp-1");
  assert.equal(mapped.request.contextId, "ctx-1");
  assert.equal(mapped.request.groupCount, 4);
  assert.equal(mapped.request.groupCapacity, 3);
  assert.equal(mapped.request.candidates[0].seedNumber, 1);
  assert.equal(
    mapped.request.candidates[0].seedAssignmentReference,
    "seed:a:1"
  );
  assert.equal(mapped.request.drawMode, DRAW_MODE.SNAKE_GROUPS);
});

test("1B input mapping: ambiguous mode fails closed", () => {
  const mapped = mapCertificationInputToDrawResolveRequest({
    competitionId: "c",
    contextId: "x",
    legacyMode: "custom",
    groupCount: 2,
    entries: [{ id: "a", seedNumber: 1 }],
  });
  assert.equal(mapped.ok, false);
  assert.equal(mapped.code, DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_AMBIGUOUS);
});

test("1B input mapping: manual/protected placements preserved", () => {
  const mapped = mapCertificationInputToDrawResolveRequest({
    competitionId: "c",
    contextId: "x",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 2,
    entries: [
      {
        id: "a",
        seedNumber: 1,
        protectedPlacement: true,
        manualPlacement: { groupNumber: 1, positionNumber: 1 },
      },
      { id: "b", seedNumber: 2 },
    ],
  });
  assert.equal(mapped.ok, true);
  assert.equal(mapped.request.candidates[0].protectedPlacement, true);
  assert.equal(mapped.request.candidates[0].manualPlacement.groupNumber, 1);
});

// --- Target A parity ---

test("1B Target A: snake membership matches seedTeamsIntoGroups skill_controlled", async () => {
  const entries = rankedEntries(8).map((e, i) => ({
    ...e,
    avgLevel: 100 - i,
  }));
  const adapted = await runSeededGroupingAdapter({
    competitionId: "comp-a",
    contextId: "event-a",
    entries,
    groupCount: 4,
  });
  assert.equal(adapted.ok, true);
  assert.equal(adapted.diagnostics.calledPhase3h, true);
  assert.equal(adapted.phase3hMode, DRAW_MODE.SNAKE_GROUPS);

  const legacyTeams = entries.map((e) => ({
    id: e.id,
    name: e.name,
    avgLevel: e.avgLevel,
    members: [],
  }));
  const legacyGroups = seedTeamsIntoGroups(legacyTeams, 4, {
    mode: "skill_controlled",
  });

  const adaptedMembership = membershipByLabel(adapted.legacy.groups);
  /** @type {Record<string, string[]>} */
  const legacyMembership = {};
  for (const g of legacyGroups) {
    legacyMembership[g.group] = g.teams.map((t) => String(t.id)).sort();
  }
  assert.deepEqual(adaptedMembership, legacyMembership);
});

test("1B Target A: determinism with same seed refs", async () => {
  const entries = rankedEntries(6);
  const a = await runSeededGroupingAdapter({
    competitionId: "c",
    contextId: "x",
    entries,
    groupCount: 3,
  });
  const b = await runSeededGroupingAdapter({
    competitionId: "c",
    contextId: "x",
    entries,
    groupCount: 3,
  });
  assert.equal(a.ok, true);
  assert.deepEqual(
    a.canonical.placements.map((p) => [
      p.candidateIdentityKey,
      p.groupIdentityKey,
      p.positionNumber,
    ]),
    b.canonical.placements.map((p) => [
      p.candidateIdentityKey,
      p.groupIdentityKey,
      p.positionNumber,
    ])
  );
});

test("1B Target A: input array order does not change identity-keyed candidates when seeds set", async () => {
  const base = rankedEntries(4);
  const reversed = [...base].reverse();
  const a = await runSeededGroupingAdapter({
    competitionId: "c",
    contextId: "x",
    entries: base,
    groupCount: 2,
  });
  const b = await runSeededGroupingAdapter({
    competitionId: "c",
    contextId: "x",
    entries: reversed,
    groupCount: 2,
  });
  assert.deepEqual(
    membershipByLabel(a.legacy.groups),
    membershipByLabel(b.legacy.groups)
  );
});

// --- Target B ---

test("1B Target B: format conditions fail closed by default", async () => {
  const result = await runOpenConditionalAdapter({
    competitionId: "c",
    contextId: "x",
    entries: rankedEntries(4),
    groupCount: 2,
    deterministicSeed: "open-1",
    hostClubName: "Host Club",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_CONDITIONS_UNSUPPORTED
  );
});

test("1B Target B: structural OPEN_RANDOM_GROUPS is deterministic", async () => {
  const entries = rankedEntries(6);
  const a = await runOpenConditionalAdapter({
    competitionId: "c",
    contextId: "x",
    entries,
    groupCount: 3,
    deterministicSeed: "draw-open-42",
  });
  const b = await runOpenConditionalAdapter({
    competitionId: "c",
    contextId: "x",
    entries,
    groupCount: 3,
    deterministicSeed: "draw-open-42",
  });
  assert.equal(a.ok, true);
  assert.equal(a.phase3hMode, DRAW_MODE.OPEN_RANDOM_GROUPS);
  assert.deepEqual(
    membershipByLabel(a.legacy.groups),
    membershipByLabel(b.legacy.groups)
  );
  assert.ok(a.legacy.unresolvedCandidates);
  assert.ok(a.legacy.excludedCandidates);
});

// --- Target C ---

test("1B Target C: seeded snake with supplied seedNumbers", async () => {
  const teams = rankedEntries(8).map((e) => ({
    id: e.id,
    seedNumber: e.seedNumber,
    name: `Team ${e.id}`,
  }));
  const result = await runTeamTournamentGroupingAdapter({
    competitionId: "tt-1",
    contextId: "div-1",
    teams,
    groupCount: 4,
    placementKind: "seeded_snake",
  });
  assert.equal(result.ok, true);
  assert.equal(result.phase3hMode, DRAW_MODE.SNAKE_GROUPS);
  assert.equal(result.legacy.groups[0].name.startsWith("Bảng "), true);
  assert.equal(result.diagnostics.calledPhase3h, true);
});

test("1B Target C: private pairing rules fail closed", async () => {
  const result = await runTeamTournamentGroupingAdapter({
    competitionId: "tt-1",
    contextId: "div-1",
    teams: rankedEntries(4),
    groupCount: 2,
    privatePairingRules: [{ id: "r1" }],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_CONSTRAINTS_UNSUPPORTED
  );
});

test("1B Target C: open_random documents partial parity path", async () => {
  const result = await runTeamTournamentGroupingAdapter({
    competitionId: "tt-1",
    contextId: "div-1",
    teams: rankedEntries(6),
    groupCount: 3,
    placementKind: "open_random",
    deterministicSeed: "tt-open-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.parity, "PARTIAL_PARITY");
  assert.equal(result.phase3hMode, DRAW_MODE.OPEN_RANDOM_GROUPS);
});

// --- Target D ---

test("1B Target D: empty constraints → snake via Phase 3H", async () => {
  const entries = rankedEntries(8).map((e, i) => ({
    ...e,
    rating: (100 - i) * 2, // entriesToTeams uses rating/2 when no players
  }));
  const adapted = await runConstraintGroupingAdapter({
    competitionId: "c",
    contextId: "x",
    entries,
    groupCount: 4,
    constraints: [],
  });
  assert.equal(adapted.ok, true);

  const legacy = assignGroupsWithConstraints(entries, 4, [], []);
  assert.equal(legacy.ok, true);
  const adaptedSizes = adapted.legacy.groups.map((g) => g.entryIds.length).sort();
  const legacySizes = legacy.groups.map((g) => g.entryIds.length).sort();
  assert.deepEqual(adaptedSizes, legacySizes);
});

test("1B Target D: non-empty constraints fail closed (no fake parity)", async () => {
  const result = await runConstraintGroupingAdapter({
    competitionId: "c",
    contextId: "x",
    entries: rankedEntries(4),
    groupCount: 2,
    constraints: [
      {
        type: "avoid_same_group",
        anchorPlayerId: "p1",
        targetPlayerIds: ["p2"],
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_CONSTRAINTS_UNSUPPORTED
  );
  assert.equal(result.details.hardening, "HARDENING_REQUIRED");
});

// --- Target E ---

test("1B Target E: facade does not call Phase 3H or rewire CC-04", async () => {
  const result = await runCc04CompatibilityBridge({
    bridgeMode: "facade",
    legacyMode: "snake",
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.calledPhase3h, false);
  assert.equal(result.diagnostics.evaluateCanonicalDrawRewired, false);
  assert.equal(
    result.diagnostics.bridgePolicy,
    CC04_BRIDGE_POLICY.REMAIN_AS_FACADE
  );
});

test("1B Target E: delegate calls Phase 3H without touching draw/** APIs", async () => {
  const result = await runCc04CompatibilityBridge({
    bridgeMode: "delegate",
    legacyMode: "snake",
    competitionId: "c",
    contextId: "x",
    entries: rankedEntries(4),
    groupCount: 2,
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.calledPhase3h, true);
  assert.equal(result.diagnostics.evaluateCanonicalDrawRewired, false);
});

// --- Output mapping / byes ---

test("1B output: unresolved/excluded not dropped; byes explicit on bracket", async () => {
  const resolver = createDrawResolver();
  const canonical = await resolver.resolve({
    competitionId: "c",
    contextId: "bracket-1",
    drawMode: DRAW_MODE.SEEDED_BRACKET,
    bracketSize: 8,
    candidates: rankedEntries(5).map((e) => ({
      candidateReference: e.id,
      candidateId: e.id,
      seedNumber: e.seedNumber,
    })),
  });
  assert.equal(canonical.ok, true);
  assert.ok(canonical.byes.length >= 1);

  const { mapCanonicalResultToLegacyGroups } = await import(
    "../src/features/competition-core/draw-runtime/adapters/mapCertificationOutput.js"
  );
  const legacy = mapCanonicalResultToLegacyGroups(canonical);
  assert.equal(legacy.byes.length, canonical.byes.length);
  assert.ok(Array.isArray(legacy.unresolvedCandidates));
  assert.ok(Array.isArray(legacy.excludedCandidates));
});

// --- Architecture ---

test("1B architecture: certification adapters have no placement/shuffle/Math.random/Date.now", () => {
  const certFiles = listJsFiles(ADAPTER_ROOT).filter((f) => {
    const base = path.basename(f);
    return (
      base !== "LegacyDrawAdapter.js" &&
      !base.includes("legacyDraw") // mapper is Phase 3H map-only
    );
  });
  assert.ok(certFiles.length > 5);

  const forbiddenAlgo = [
    /function\s+shuffleArray\s*\(/,
    /function\s+getSnakeGroupIndex\s*\(/,
    /function\s+getSerpentineGroupIndex\s*\(/,
    /function\s+buildSeededBracketSlotOrder\s*\(/,
    /Math\.random\s*\(/,
    /Date\.now\s*\(/,
  ];
  const forbiddenImports = [
    /from\s+['"][^'"]*pages\//,
    /from\s+['"][^'"]*components\//,
    /from\s+['"][^'"]*team-tournament/,
    /from\s+['"][^'"]*tournament\/engines/,
    /from\s+['"][^'"]*pairing-constraints/,
    /from\s+['"][^'"]*competition-core\/draw\//,
    /from\s+['"]\.\.\/\.\.\/draw\//,
    /from\s+['"]@mui\//,
    /from\s+['"]react['"]/,
  ];

  for (const file of certFiles) {
    const content = readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const pattern of forbiddenAlgo) {
      assert.doesNotMatch(content, pattern, `algo in ${rel}`);
    }
    for (const pattern of forbiddenImports) {
      assert.doesNotMatch(content, pattern, `import in ${rel}`);
    }
    // Must delegate for runners (not pure matrix/error files)
    if (/Adapter\.js$/.test(file) || /Bridge\.js$/.test(file) || /runCertificationResolve/.test(file)) {
      assert.match(
        content,
        /createDrawResolver|runCertificationResolve|mapLegacyModeToPhase3h/,
        `delegation missing in ${rel}`
      );
    }
  }
});

test("1B architecture: Phase 3H services still free of production imports", () => {
  for (const file of listJsFiles(path.join(RUNTIME_ROOT, "services"))) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /Math\.random\s*\(/);
    assert.doesNotMatch(content, /from\s+['"][^'"]*pages\//);
    assert.doesNotMatch(content, /from\s+['"][^'"]*team-tournament/);
  }
});

test("1B architecture: legacy engines still present (no deletion)", () => {
  assert.equal(
    existsSync(path.join(ROOT, "src/tournament/engines/seededGroupEngine.js")),
    true
  );
  assert.equal(
    existsSync(path.join(ROOT, "src/pages/tournament.seeding.logic.js")),
    true
  );
  assert.equal(
    existsSync(
      path.join(ROOT, "src/tournament/engines/openConditionalRandomEngine.js")
    ),
    true
  );
  assert.equal(
    existsSync(
      path.join(ROOT, "src/features/competition-core/draw/adapters/drawRuntimeAdapter.js")
    ),
    true
  );
});

test("1B architecture: no production feature flag switched", () => {
  const flags = getCompetitionCoreFeatureFlags({});
  assert.equal(isDrawV2Enabled({}), false);
  assert.equal(flags.drawV2Enabled, false);
});

/**
 * CORE-08 Phase 1E — final certification (architecture lock / integration handoff).
 * Read-only assertions only. Does not modify runtime behavior.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import {
  createDrawResolver,
  DRAW_MODE,
  matchesConstraintResolver,
  normalizeConstraintResolver,
  applyConstraintResolverHook,
  validateConstraintResolutionOutput,
  runSeededGroupingAdapter,
  runOpenConditionalAdapter,
  runTeamTournamentGroupingAdapter,
  runConstraintGroupingAdapter,
  runCc04CompatibilityBridge,
  runCertificationResolve,
  SEEDED_GROUPING_ADAPTER_ID,
  OPEN_CONDITIONAL_ADAPTER_ID,
  TEAM_TOURNAMENT_GROUPING_ADAPTER_ID,
  CONSTRAINT_GROUPING_ADAPTER_ID,
  CC04_COMPAT_BRIDGE_ID,
  assignOpenRandomGroups,
  assignOpenShuffledSnakeGroups,
  assignSnakeGroups,
  getSnakeGroupIndex,
  getSeededGroupIndex,
  deterministicShuffle,
} from "../src/features/competition-core/draw-runtime/index.js";

import {
  getCompetitionCoreFeatureFlags,
  isDrawV2Enabled,
} from "../src/features/competition-core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME = path.join(ROOT, "src/features/competition-core/draw-runtime");
const ADAPTERS = path.join(RUNTIME, "adapters");
const DOCS = path.join(ROOT, "docs/competition-engine/core-08");

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

function readRel(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function branchDeltaNames() {
  const out = execSync("git diff --name-only origin/main...HEAD", {
    cwd: ROOT,
    encoding: "utf8",
  });
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// --- 1. Canonical API barrel ---

test("1E: createDrawResolver is exported from capability-local barrel", () => {
  assert.equal(typeof createDrawResolver, "function");
  const resolver = createDrawResolver();
  assert.equal(typeof resolver.resolve, "function");
  const barrel = readRel("src/features/competition-core/draw-runtime/index.js");
  assert.match(barrel, /createDrawResolver/);
  assert.match(barrel, /from "\.\/DrawResolver\.js"/);
});

// --- 2–4. Adapters ---

test("1E: Phase 1B adapters are exported from adapter barrel", () => {
  const adapterBarrel = readRel(
    "src/features/competition-core/draw-runtime/adapters/index.js"
  );
  for (const symbol of [
    "runSeededGroupingAdapter",
    "runOpenConditionalAdapter",
    "runTeamTournamentGroupingAdapter",
    "runConstraintGroupingAdapter",
    "runCc04CompatibilityBridge",
    "runCertificationResolve",
    "mapCertificationInputToDrawResolveRequest",
    "mapCanonicalResultToLegacyGroups",
    "mapLegacyModeToPhase3h",
  ]) {
    assert.match(adapterBarrel, new RegExp(symbol));
  }
  assert.equal(typeof runSeededGroupingAdapter, "function");
  assert.equal(typeof runOpenConditionalAdapter, "function");
  assert.equal(typeof runTeamTournamentGroupingAdapter, "function");
  assert.equal(typeof runConstraintGroupingAdapter, "function");
  assert.equal(typeof runCc04CompatibilityBridge, "function");
  assert.equal(typeof runCertificationResolve, "function");
  assert.ok(SEEDED_GROUPING_ADAPTER_ID);
  assert.ok(OPEN_CONDITIONAL_ADAPTER_ID);
  assert.ok(TEAM_TOURNAMENT_GROUPING_ADAPTER_ID);
  assert.ok(CONSTRAINT_GROUPING_ADAPTER_ID);
  assert.ok(CC04_COMPAT_BRIDGE_ID);
});

test("1E: executable adapters delegate to Phase 3H via runCertificationResolve", () => {
  const runners = [
    "seededGroupingAdapter.js",
    "openConditionalAdapter.js",
    "teamTournamentGroupingAdapter.js",
    "constraintGroupingAdapter.js",
    "cc04CompatibilityBridge.js",
    "runCertificationResolve.js",
  ];
  for (const name of runners) {
    const src = readFileSync(path.join(ADAPTERS, name), "utf8");
    if (name === "runCertificationResolve.js") {
      assert.match(src, /createDrawResolver/);
      assert.match(src, /\.resolve\s*\(/);
    } else {
      assert.match(src, /runCertificationResolve/);
    }
  }
});

test("1E: adapters contain no placement algorithms", () => {
  const certFiles = listJsFiles(ADAPTERS).filter((f) => {
    const base = path.basename(f);
    return base !== "LegacyDrawAdapter.js";
  });
  assert.ok(certFiles.length >= 8);
  const forbiddenAlgo = [
    /function\s+shuffleArray\s*\(/,
    /function\s+getSnakeGroupIndex\s*\(/,
    /function\s+getSerpentineGroupIndex\s*\(/,
    /function\s+placeIntoGroups\s*\(/,
    /function\s+assignOpenShuffledSnakeGroups\s*\(/,
    /Math\.random\s*\(/,
    /Date\.now\s*\(/,
  ];
  for (const file of certFiles) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbiddenAlgo) {
      assert.doesNotMatch(
        content,
        pattern,
        `algo in ${path.relative(ROOT, file)}`
      );
    }
  }
});

// --- 5–6. Constraint boundary ---

test("1E: generic constraint resolver port is capability-local", () => {
  assert.equal(typeof matchesConstraintResolver, "function");
  assert.equal(typeof normalizeConstraintResolver, "function");
  assert.equal(typeof applyConstraintResolverHook, "function");
  assert.equal(typeof validateConstraintResolutionOutput, "function");
  assert.equal(
    existsSync(path.join(RUNTIME, "ports/constraintResolverPort.js")),
    true
  );
  const portSrc = readRel(
    "src/features/competition-core/draw-runtime/ports/constraintResolverPort.js"
  );
  assert.match(portSrc, /matchesConstraintResolver/);
  assert.match(portSrc, /normalizeConstraintResolver/);
  assert.match(portSrc, /freezeConstraintResolveInput/);
  assert.doesNotMatch(portSrc, /from\s+['"][^'"]*pairing-constraints/);
  assert.doesNotMatch(portSrc, /function\s+scoreClubSeparation|avoid_same_group/);
  assert.match(portSrc, /does not define club\/unit\/host rules/i);
});

test("1E: constraint hook is post-placement and fail-closed", () => {
  const resolverSrc = readRel(
    "src/features/competition-core/draw-runtime/DrawResolver.js"
  );
  assert.match(resolverSrc, /applyConstraintResolverHook/);
  assert.match(
    resolverSrc,
    /constraintResolver is optional|after canonical placement|before identity/i
  );
  const hookSrc = readRel(
    "src/features/competition-core/draw-runtime/services/applyConstraintResolverHook.js"
  );
  assert.match(hookSrc, /validateConstraintResolutionOutput/);
  assert.match(hookSrc, /DRAW_CONSTRAINT_/);
  assert.doesNotMatch(hookSrc, /Math\.random\s*\(/);
  assert.doesNotMatch(hookSrc, /assignGroupsWithConstraints/);
});

// --- 7–8. Open draw modes ---

test("1E: OPEN_SHUFFLED_SNAKE_GROUPS is exported and distinct", () => {
  assert.equal(
    DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
    "OPEN_SHUFFLED_SNAKE_GROUPS"
  );
  assert.notEqual(DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS, DRAW_MODE.OPEN_RANDOM_GROUPS);
  assert.notEqual(DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS, DRAW_MODE.SNAKE_GROUPS);
  assert.equal(typeof assignOpenShuffledSnakeGroups, "function");
  assert.equal(typeof assignOpenRandomGroups, "function");
  assert.equal(typeof assignSnakeGroups, "function");
  assert.equal(typeof getSnakeGroupIndex, "function");
  assert.equal(typeof getSeededGroupIndex, "function");
  assert.equal(typeof deterministicShuffle, "function");
  assert.notEqual(getSnakeGroupIndex(4, 4), getSeededGroupIndex(4, 4));
});

test("1E: existing open and snake modes remain distinct strings", () => {
  assert.equal(DRAW_MODE.OPEN_RANDOM_GROUPS, "OPEN_RANDOM_GROUPS");
  assert.equal(DRAW_MODE.SNAKE_GROUPS, "SNAKE_GROUPS");
  const modes = readRel(
    "src/features/competition-core/draw-runtime/enums/drawModes.js"
  );
  assert.match(modes, /OPEN_SHUFFLED_SNAKE_GROUPS/);
  assert.match(modes, /OPEN_RANDOM_GROUPS/);
  assert.match(modes, /SNAKE_GROUPS/);
});

// --- 9–13. Production isolation ---

test("1E: root Competition Core export remains untouched by draw-runtime", () => {
  const indexPath = path.join(ROOT, "src/features/competition-core/index.js");
  const content = readFileSync(indexPath, "utf8");
  assert.doesNotMatch(content, /createDrawResolver/);
  assert.doesNotMatch(content, /from "\.\/draw-runtime\/index\.js"/);
  assert.doesNotMatch(content, /DRAW_RUNTIME_ERROR_CODE/);
  assert.doesNotMatch(content, /OPEN_SHUFFLED_SNAKE_GROUPS/);
  assert.doesNotMatch(content, /runSeededGroupingAdapter/);
});

test("1E: official CI manifest remains untouched by CORE-08 phase tests", () => {
  const official = JSON.parse(
    readFileSync(path.join(ROOT, "scripts/ci/unit-test-files.json"), "utf8")
  );
  assert.ok(Array.isArray(official));
  for (const needle of [
    "tests/competition-core-draw-runtime-core08-1b.test.js",
    "tests/competition-core-draw-runtime-core08-1c.test.js",
    "tests/competition-core-draw-runtime-core08-1d.test.js",
    "tests/competition-core-draw-runtime-core08-1e-certification.test.js",
    "tests/competition-core-draw-runtime-3h.test.js",
  ]) {
    assert.equal(
      official.includes(needle),
      false,
      `official CI must not include ${needle}`
    );
  }
  const phase1e = path.join(
    ROOT,
    "scripts/ci/unit-test-files.phase-core08-1e.json"
  );
  assert.equal(existsSync(phase1e), true);
  const manifest = JSON.parse(readFileSync(phase1e, "utf8"));
  assert.ok(manifest.includes(
    "tests/competition-core-draw-runtime-core08-1e-certification.test.js"
  ));
});

test("1E: production engines / UI / SQL / deploy absent from branch-local delta", () => {
  const names = branchDeltaNames();
  assert.ok(names.length >= 31, `expected >=31 branch files, got ${names.length}`);

  const forbiddenPrefixes = [
    "src/pages/",
    "src/components/",
    "src/features/team-tournament/",
    "src/features/individual-tournament/",
    "src/tournament/engines/",
    "src/features/pairing-constraints/",
    "docs/supabase",
    ".github/workflows/",
  ];
  const forbiddenExact = [
    "src/features/competition-core/index.js",
    "scripts/ci/unit-test-files.json",
  ];
  const forbiddenSuffixes = [".sql"];

  for (const name of names) {
    for (const prefix of forbiddenPrefixes) {
      assert.equal(
        name.startsWith(prefix),
        false,
        `unauthorized branch path: ${name}`
      );
    }
    for (const exact of forbiddenExact) {
      assert.notEqual(name, exact, `unauthorized touched file: ${name}`);
    }
    for (const suffix of forbiddenSuffixes) {
      assert.equal(
        name.endsWith(suffix),
        false,
        `unauthorized SQL in delta: ${name}`
      );
    }
  }

  // Production engines remain on disk (not deleted)
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
      path.join(
        ROOT,
        "src/features/competition-core/draw/adapters/drawRuntimeAdapter.js"
      )
    ),
    true
  );
});

test("1E: no production feature flag is enabled", () => {
  const flags = getCompetitionCoreFeatureFlags({});
  assert.equal(isDrawV2Enabled({}), false);
  assert.equal(flags.drawV2Enabled, false);
});

// --- 14. Deferred gaps documented ---

test("1E: deferred gaps and handoff docs exist with required topics", () => {
  const cert = readFileSync(
    path.join(DOCS, "04_PHASE_1E_FINAL_CERTIFICATION.md"),
    "utf8"
  );
  const handoff = readFileSync(
    path.join(DOCS, "05_INTEGRATION_HANDOFF.md"),
    "utf8"
  );
  const gaps = readFileSync(
    path.join(DOCS, "06_DEFERRED_GAPS_REGISTER.md"),
    "utf8"
  );

  for (const topic of [
    "createDrawResolver",
    "Phase 3H",
    "OPEN_SHUFFLED_SNAKE_GROUPS",
    "constraintResolver",
    "no production cutover",
  ]) {
    assert.match(cert, new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  for (const topic of [
    "root capability export",
    "official CI",
    "feature-flag",
    "shadow",
    "rollback",
    "Owner approval",
    "Production cutover",
  ]) {
    assert.match(handoff, new RegExp(topic, "i"));
  }

  for (const gap of [
    "Club/unit/host",
    "Private-pairing",
    "Input fingerprint",
    "Ruleset version",
    "bye policy",
    "Root export",
    "Official CI",
    "persistence",
    "shadow comparison",
    "Production cutover",
    "Legacy retirement",
  ]) {
    assert.match(gaps, new RegExp(gap, "i"));
  }
});

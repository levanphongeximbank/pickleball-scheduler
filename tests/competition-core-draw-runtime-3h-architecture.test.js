import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveRuntimeDecision,
  resolveShadowEligibility,
  RUNTIME_MODE,
  RUNTIME_EXECUTOR,
} from "../src/features/competition-core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_ROOT = path.join(ROOT, "src/features/competition-core/draw-runtime");

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

const FORBIDDEN_PATTERNS = [
  /from\s+['"][^'"]*pages\//,
  /from\s+['"][^'"]*components\//,
  /from\s+['"][^'"]*supabase/,
  /from\s+['"]@supabase/,
  /from\s+['"][^'"]*team-tournament/,
  /from\s+['"][^'"]*daily-play/,
  /from\s+['"][^'"]*tournaments\//,
  /from\s+['"][^'"]*individual-tournament/,
  /from\s+['"][^'"]*tournament-engine/,
  /from\s+['"][^'"]*clubStorage/,
  /from\s+['"]react['"]/,
  /from\s+['"]@mui\//,
  /from\s+['"][^'"]*main\.jsx/,
  /from\s+['"][^'"]*runtime-control\/registries/,
  /from\s+['"][^'"]*registrations\//,
  /from\s+['"][^'"]*participants\/runtime/,
  /from\s+['"][^'"]*competition-core\/teams\//,
  /from\s+['"][^'"]*competition-core\/lineups\//,
  /from\s+['"][^'"]*competition-core\/matches\//,
  /from\s+['"][^'"]*competition-core\/draw\//,
  /from\s+['"][^'"]*competition-core\/seeding\//,
  /from\s+['"][^'"]*competition-core\/seed\//,
  /from\s+['"][^'"]*\/lineups\//,
  /from\s+['"][^'"]*\/matches\//,
  /from\s+['"]\.\.\/draw\//,
  /from\s+['"]\.\.\/seeding\//,
  /from\s+['"]\.\.\/seed\//,
];

const FORBIDDEN_RUNTIME_WIRING = [
  /registerCapabilityExecutor\s*\(/,
  /registerShadowComparator\s*\(/,
  /registerShadowNormalizer\s*\(/,
  /registerEligibilityAllowlist\s*\(/,
  /registerParticipantCapability/,
  /createClient\s*\(/,
  /supabase\.from/,
  /localStorage|sessionStorage/,
  /\bfetch\s*\(/,
];

test("3H architecture: draw-runtime modules have no forbidden Production imports", () => {
  const files = listJsFiles(RUNTIME_ROOT);
  assert.ok(files.length > 0, "draw-runtime tree must exist");
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      assert.doesNotMatch(
        content,
        pattern,
        `forbidden import in ${path.relative(ROOT, file)}`
      );
    }
  }
});

test("3H architecture: no import-time registry / auto-registration", () => {
  for (const file of listJsFiles(RUNTIME_ROOT)) {
    const content = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN_RUNTIME_WIRING) {
      assert.doesNotMatch(
        content,
        pattern,
        `forbidden wiring in ${path.relative(ROOT, file)}`
      );
    }
  }
});

test("3H architecture: no Production engines / Math.random / env / match creation", () => {
  for (const file of listJsFiles(RUNTIME_ROOT)) {
    const content = readFileSync(file, "utf8");
    // DI may accept seedingResolver option name, but must never import or invoke Seeding Runtime.
    assert.doesNotMatch(content, /from\s+['"][^'"]*\/seeding\//);
    assert.doesNotMatch(content, /createSeedingResolver\s*\(/);
    assert.doesNotMatch(content, /createMatchResolver|createLineupResolver/);
    assert.doesNotMatch(content, /seedEngine|teamGroupSeedEngine|teamAutoDrawEngine/);
    assert.doesNotMatch(content, /seedTeamsIntoGroups|assignEntriesToGroupsSnake/);
    assert.doesNotMatch(content, /buildGroupStageSchedule|generateKnockoutBracket/);
    assert.doesNotMatch(content, /Math\.random\s*\(/);
    assert.doesNotMatch(content, /Date\.now\s*\(/);
    assert.doesNotMatch(content, /process\.env/);
    assert.doesNotMatch(content, /calculateElo|updateRating|computeStandings/);
  }
});

test("3H architecture: Production safety defaults unchanged", () => {
  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(resolveShadowEligibility({}).eligible, false);
});

test("3H architecture: root index does NOT re-export Draw Runtime yet", () => {
  const indexPath = path.join(ROOT, "src/features/competition-core/index.js");
  const content = readFileSync(indexPath, "utf8");
  assert.doesNotMatch(content, /createDrawResolver/);
  assert.doesNotMatch(content, /from "\.\/draw-runtime\/index\.js"/);
  assert.doesNotMatch(content, /DRAW_RUNTIME_ERROR_CODE/);
  assert.doesNotMatch(content, /registerDrawCapability/);
});

test("3H architecture: phase sub-manifest exists; official does NOT include 3H yet", () => {
  const phaseManifest = path.join(
    ROOT,
    "scripts/ci/unit-test-files.phase-3h.json"
  );
  assert.equal(existsSync(phaseManifest), true);
  const phase = JSON.parse(readFileSync(phaseManifest, "utf8"));
  assert.ok(Array.isArray(phase));
  assert.ok(phase.length >= 2);
  for (const entry of phase) {
    assert.equal(typeof entry, "string");
    assert.equal(existsSync(path.join(ROOT, entry)), true, `missing ${entry}`);
  }
  const official = JSON.parse(
    readFileSync(path.join(ROOT, "scripts/ci/unit-test-files.json"), "utf8")
  );
  for (const entry of phase) {
    assert.equal(
      official.filter((f) => f === entry).length,
      0,
      `official must NOT include yet: ${entry}`
    );
  }
});

test("3H architecture: no Production page/API callers of Draw Runtime", () => {
  const callerRoots = [
    path.join(ROOT, "src/pages"),
    path.join(ROOT, "src/components"),
    path.join(ROOT, "src/features/individual-tournament"),
    path.join(ROOT, "src/features/team-tournament"),
    path.join(ROOT, "src/tournament"),
  ];
  const importPattern = /competition-core\/draw-runtime/;
  for (const dir of callerRoots) {
    if (!existsSync(dir)) continue;
    for (const file of listJsFiles(dir)) {
      const content = readFileSync(file, "utf8");
      assert.doesNotMatch(
        content,
        importPattern,
        `Production caller found: ${path.relative(ROOT, file)}`
      );
    }
  }
});

test("3H architecture: no Matchup / Match / Schedule / Seeding implementation", () => {
  for (const file of listJsFiles(RUNTIME_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /function\s+generateMatchup/);
    assert.doesNotMatch(content, /function\s+createMatch\b/);
    assert.doesNotMatch(content, /function\s+buildSchedule/);
    assert.doesNotMatch(content, /function\s+assignSeeds\b/);
  }
});

test("3H architecture: legacy draw/** not modified by capability presence", () => {
  assert.equal(
    existsSync(path.join(ROOT, "src/features/competition-core/draw/index.js")),
    true
  );
  assert.equal(existsSync(RUNTIME_ROOT), true);
});

test("3H architecture: shared-file ownership for sample 3h paths is clean", async () => {
  const { validateSharedFileOwnership } = await import(
    "../scripts/ci/competition-shared-file-ownership.mjs"
  );
  const sample = [
    "src/features/competition-core/draw-runtime/DrawResolver.js",
    "src/features/competition-core/draw-runtime/index.js",
    "tests/competition-core-draw-runtime-3h.test.js",
    "scripts/ci/unit-test-files.phase-3h.json",
    "docs/competition-engine/phase-3h/README.md",
  ];
  const result = validateSharedFileOwnership(sample, "3h");
  assert.equal(result.ok, true, `violations: ${result.violations.join(", ")}`);
});

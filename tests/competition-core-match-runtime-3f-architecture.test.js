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
const RUNTIME_ROOT = path.join(ROOT, "src/features/competition-core/matches");

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
  /from\s+['"][^'"]*\/lineups\//,
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

test("3F architecture: match modules have no forbidden Production imports", () => {
  const files = listJsFiles(RUNTIME_ROOT);
  assert.ok(files.length > 0, "matches tree must exist");
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

test("3F architecture: no import-time registry / auto-registration", () => {
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

test("3F architecture: no deep runtime imports / no scoring / no random / no env", () => {
  for (const file of listJsFiles(RUNTIME_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /from\s+['"][^'"]*participants\/runtime/);
    assert.doesNotMatch(content, /competition-core\/registrations/);
    assert.doesNotMatch(content, /from\s+['"][^'"]*\/teams\//);
    assert.doesNotMatch(content, /createTeamResolver|createRosterResolver|createLineupResolver/);
    assert.doesNotMatch(content, /matchEngine|scheduleEngine|submitMatchScore/);
    assert.doesNotMatch(content, /Math\.random\s*\(/);
    assert.doesNotMatch(content, /Date\.now\s*\(/);
    assert.doesNotMatch(content, /process\.env/);
    assert.doesNotMatch(content, /calculateWinner|computeWinner|deriveWinner/);
  }
});

test("3F architecture: Production safety defaults unchanged", () => {
  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(resolveShadowEligibility({}).eligible, false);
});

test("3F architecture: root index does NOT re-export Match Runtime yet", () => {
  const indexPath = path.join(ROOT, "src/features/competition-core/index.js");
  const content = readFileSync(indexPath, "utf8");
  assert.doesNotMatch(content, /createMatchResolver/);
  assert.doesNotMatch(content, /from "\.\/matches\/index\.js"/);
  assert.doesNotMatch(content, /MATCH_RUNTIME_ERROR_CODE/);
  assert.doesNotMatch(content, /registerMatchCapability/);
});

test("3F architecture: phase sub-manifest exists; official does NOT include 3F yet", () => {
  const phaseManifest = path.join(
    ROOT,
    "scripts/ci/unit-test-files.phase-3f.json"
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

test("3F architecture: no Production page/API callers of Match Runtime", () => {
  const callerRoots = [
    path.join(ROOT, "src/pages"),
    path.join(ROOT, "src/components"),
    path.join(ROOT, "src/features/individual-tournament"),
    path.join(ROOT, "src/features/team-tournament"),
    path.join(ROOT, "src/tournament"),
  ];
  const importPattern = /competition-core\/matches/;
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

test("3F architecture: MatchResultReference opaque; no score ownership in factories", () => {
  const contractPath = path.join(
    ROOT,
    "src/features/competition-core/matches/contracts/competitionMatch.js"
  );
  const content = readFileSync(contractPath, "utf8");
  assert.match(content, /createMatchResultReference/);
  assert.match(content, /createCompetitionMatch/);
  assert.doesNotMatch(content, /scoreA\s*[:=]/);
  assert.doesNotMatch(content, /function\s+calculateWinner/);
});

test("3F architecture: shared-file ownership for sample 3f paths is clean", async () => {
  const { validateSharedFileOwnership } = await import(
    "../scripts/ci/competition-shared-file-ownership.mjs"
  );
  const sample = [
    "src/features/competition-core/matches/MatchResolver.js",
    "src/features/competition-core/matches/index.js",
    "tests/competition-core-match-runtime-3f.test.js",
    "scripts/ci/unit-test-files.phase-3f.json",
    "docs/competition-engine/phase-3f/README.md",
  ];
  const result = validateSharedFileOwnership(sample, "3f");
  assert.equal(result.ok, true, `violations: ${result.violations.join(", ")}`);
});

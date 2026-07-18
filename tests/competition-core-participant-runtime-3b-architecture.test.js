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
const RUNTIME_ROOT = path.join(
  ROOT,
  "src/features/competition-core/participants/runtime"
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
];

const FORBIDDEN_RUNTIME_WIRING = [
  /registerCapabilityExecutor\s*\(/,
  /registerShadowComparator\s*\(/,
  /registerShadowNormalizer\s*\(/,
  /registerEligibilityAllowlist\s*\(/,
  /createClient\s*\(/,
  /supabase\.from/,
  /localStorage|sessionStorage/,
  /\bfetch\s*\(/,
];

test("3B architecture: runtime modules have no forbidden Production imports", () => {
  const files = listJsFiles(RUNTIME_ROOT);
  assert.ok(files.length > 0, "runtime tree must exist");
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

test("3B architecture: no import-time registry registration", () => {
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

test("3B architecture: no Canonical adapter module", () => {
  for (const file of listJsFiles(RUNTIME_ROOT)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    assert.equal(
      /CanonicalParticipantAdapter/.test(rel),
      false,
      `unexpected Canonical adapter path: ${rel}`
    );
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /createCanonicalParticipantAdapter|CanonicalParticipantAdapter/
    );
  }
});

test("3B architecture: no process.env / Math.random in runtime", () => {
  for (const file of listJsFiles(RUNTIME_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /process\.env/);
    assert.doesNotMatch(content, /Math\.random\s*\(/);
  }
});

test("3B architecture: Production safety defaults unchanged", () => {
  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(resolveShadowEligibility({}).eligible, false);
});

test("3B architecture: root index re-exports Participant Runtime public surface (Integrator Wave 1)", () => {
  const indexPath = path.join(ROOT, "src/features/competition-core/index.js");
  const content = readFileSync(indexPath, "utf8");
  assert.match(content, /createParticipantResolver/);
  assert.match(content, /registerParticipantCapabilityWave1/);
  // Still no Production wiring / flag flips in root index
  assert.doesNotMatch(content, /VITE_ENABLE.*PARTICIPANT.*=.*true/);
  assert.doesNotMatch(content, /registerParticipantCapabilityWave1\s*\(\s*\)/);
});

test("3B architecture: official unit-test-files.json includes Phase 3B tests (Integrator Wave 1)", () => {
  const phaseManifest = path.join(
    ROOT,
    "scripts/ci/unit-test-files.phase-3b.json"
  );
  assert.equal(existsSync(phaseManifest), true);
  const official = JSON.parse(
    readFileSync(path.join(ROOT, "scripts/ci/unit-test-files.json"), "utf8")
  );
  const phase = JSON.parse(readFileSync(phaseManifest, "utf8"));
  for (const entry of phase) {
    assert.equal(typeof entry, "string");
    assert.equal(existsSync(path.join(ROOT, entry)), true, `missing ${entry}`);
    assert.equal(
      official.filter((f) => f === entry).length,
      1,
      `official must include exactly once: ${entry}`
    );
  }
});

test("3B architecture: shared-file ownership for sample 3b paths is clean", async () => {
  const { validateSharedFileOwnership } = await import(
    "../scripts/ci/competition-shared-file-ownership.mjs"
  );
  const sample = [
    "src/features/competition-core/participants/runtime/ParticipantResolver.js",
    "src/features/competition-core/participants/contracts/identity.js",
    "tests/competition-core-participant-runtime-3b.test.js",
    "scripts/ci/unit-test-files.phase-3b.json",
    "docs/competition-engine/phase-3b/README.md",
  ];
  const result = validateSharedFileOwnership(sample, "3b");
  assert.equal(result.ok, true, `violations: ${result.violations.join(", ")}`);
});

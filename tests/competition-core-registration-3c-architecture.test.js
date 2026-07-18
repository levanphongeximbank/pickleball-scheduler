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
const RUNTIME_ROOT = path.join(ROOT, "src/features/competition-core/registrations");

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

test("3C architecture: registration modules have no forbidden Production imports", () => {
  const files = listJsFiles(RUNTIME_ROOT);
  assert.ok(files.length > 0, "registrations tree must exist");
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

test("3C architecture: no import-time registry / Participant auto-registration", () => {
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

test("3C architecture: does not import Participant Runtime (DI only)", () => {
  for (const file of listJsFiles(RUNTIME_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /from\s+['"][^'"]*participants\/runtime/
    );
  }
});

test("3C architecture: no Canonical adapter / no Math.random / no process.env", () => {
  for (const file of listJsFiles(RUNTIME_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /createCanonicalRegistrationAdapter|CanonicalRegistrationAdapter/);
    assert.doesNotMatch(content, /process\.env/);
    assert.doesNotMatch(content, /Math\.random\s*\(/);
    assert.doesNotMatch(content, /Date\.now\s*\(/);
  }
});

test("3C architecture: Production safety defaults unchanged", () => {
  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(resolveShadowEligibility({}).eligible, false);
});

test("3C architecture: root index NOT modified with Registration Runtime exports (capability PR)", () => {
  const indexPath = path.join(ROOT, "src/features/competition-core/index.js");
  const content = readFileSync(indexPath, "utf8");
  assert.doesNotMatch(content, /createRegistrationResolver/);
  assert.doesNotMatch(content, /registrations\/index/);
});

test("3C architecture: phase-3c manifest exists; official manifest NOT edited", () => {
  const phaseManifest = path.join(
    ROOT,
    "scripts/ci/unit-test-files.phase-3c.json"
  );
  assert.equal(existsSync(phaseManifest), true);
  const phase = JSON.parse(readFileSync(phaseManifest, "utf8"));
  for (const entry of phase) {
    assert.equal(typeof entry, "string");
    assert.equal(existsSync(path.join(ROOT, entry)), true, `missing ${entry}`);
  }
  const official = JSON.parse(
    readFileSync(path.join(ROOT, "scripts/ci/unit-test-files.json"), "utf8")
  );
  for (const entry of phase) {
    assert.equal(
      official.includes(entry),
      false,
      `official must not include ${entry} until Integrator Wave`
    );
  }
});

test("3C architecture: no Production page/API callers of Registration Runtime", () => {
  const callerRoots = [
    path.join(ROOT, "src/pages"),
    path.join(ROOT, "src/components"),
    path.join(ROOT, "src/features/individual-tournament"),
    path.join(ROOT, "src/features/team-tournament"),
  ];
  const importPattern = /competition-core\/registrations/;
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

test("3C architecture: shared-file ownership for sample 3c paths is clean", async () => {
  const { validateSharedFileOwnership } = await import(
    "../scripts/ci/competition-shared-file-ownership.mjs"
  );
  const sample = [
    "src/features/competition-core/registrations/RegistrationResolver.js",
    "src/features/competition-core/participants/contracts/entryRegistration.js",
    "tests/competition-core-registration-3c.test.js",
    "scripts/ci/unit-test-files.phase-3c.json",
    "docs/competition-engine/phase-3c/README.md",
  ];
  const result = validateSharedFileOwnership(sample, "3c");
  assert.equal(result.ok, true, `violations: ${result.violations.join(", ")}`);
});

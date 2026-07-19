import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveRuntimeDecision,
  resolveShadowEligibility,
  registerEligibilityAllowlist,
  resetCapabilityExecutorRegistryForTests,
  resetShadowComparatorRegistryForTests,
  resetShadowNormalizerRegistryForTests,
  resetEligibilityAllowlistRegistryForTests,
  isCapabilityExecutorRegistryEmpty,
  isShadowComparatorRegistryEmpty,
  isShadowNormalizerRegistryEmpty,
  isEligibilityAllowlistRegistryEmpty,
  RUNTIME_CAPABILITY,
  RUNTIME_MODE,
  RUNTIME_EXECUTOR,
} from "../src/features/competition-core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RC_ROOT = path.join(ROOT, "src/features/competition-core/runtime-control");
const REGISTRY_ROOTS = [
  path.join(RC_ROOT, "registries"),
  path.join(RC_ROOT, "shadow", "registries"),
];

function listJsFiles(dir) {
  const out = [];
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

test("3A3 architecture: registry modules have no forbidden imports", () => {
  for (const root of REGISTRY_ROOTS) {
    for (const file of listJsFiles(root)) {
      const content = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        assert.doesNotMatch(
          content,
          pattern,
          `forbidden import in ${path.relative(ROOT, file)}`
        );
      }
    }
  }
});

test("3A3 architecture: registries have no process.env / Date.now / Math.random", () => {
  for (const root of REGISTRY_ROOTS) {
    for (const file of listJsFiles(root)) {
      const content = readFileSync(file, "utf8");
      assert.doesNotMatch(content, /process\.env/);
      assert.doesNotMatch(content, /Date\.now\s*\(/);
      assert.doesNotMatch(content, /Math\.random\s*\(/);
    }
  }
});

test("3A3 architecture: registries do not dispatch executors or persist", () => {
  for (const root of REGISTRY_ROOTS) {
    for (const file of listJsFiles(root)) {
      const content = readFileSync(file, "utf8");
      assert.doesNotMatch(content, /saveClubData|supabase\.from|createClient/);
      assert.doesNotMatch(
        content,
        /runLegacy|evaluateCanonicalDraw|buildInternalTournamentPlan|processCompletedMatch|executeCompetitionEngine/
      );
      assert.doesNotMatch(content, /\bfetch\s*\(/);
      assert.doesNotMatch(content, /localStorage|sessionStorage/);
    }
  }
});

test("3A3 architecture: empty registries preserve Production safety defaults", () => {
  resetCapabilityExecutorRegistryForTests();
  resetShadowComparatorRegistryForTests();
  resetShadowNormalizerRegistryForTests();
  resetEligibilityAllowlistRegistryForTests();

  assert.equal(isCapabilityExecutorRegistryEmpty(), true);
  assert.equal(isShadowComparatorRegistryEmpty(), true);
  assert.equal(isShadowNormalizerRegistryEmpty(), true);
  assert.equal(isEligibilityAllowlistRegistryEmpty(), true);

  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(resolveShadowEligibility({}).eligible, false);
});

test("3A3 architecture: resolveShadowEligibility is not wired to registry", () => {
  resetEligibilityAllowlistRegistryForTests();
  assert.equal(
    registerEligibilityAllowlist({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      operations: ["create"],
    }).ok,
    true
  );
  assert.equal(resolveShadowEligibility({}).eligible, false);
  resetEligibilityAllowlistRegistryForTests();
});

test("3A3 architecture: no circular import among registry barrels", async () => {
  // Dynamic re-import of barrels must succeed (Node resolves ESM cycles as TDZ risk).
  const registries = await import(
    "../src/features/competition-core/runtime-control/registries/index.js"
  );
  const shadowRegs = await import(
    "../src/features/competition-core/runtime-control/shadow/registries/index.js"
  );
  const rc = await import(
    "../src/features/competition-core/runtime-control/index.js"
  );
  assert.equal(typeof registries.createCapabilityExecutorRegistry, "function");
  assert.equal(typeof shadowRegs.createShadowComparatorRegistry, "function");
  assert.equal(typeof rc.resolveRuntimeDecision, "function");
  assert.equal(typeof rc.createCapabilityExecutorRegistry, "function");
});

test("3A3 architecture: root index import has no registration side effects", async () => {
  resetCapabilityExecutorRegistryForTests();
  resetShadowComparatorRegistryForTests();
  resetShadowNormalizerRegistryForTests();
  resetEligibilityAllowlistRegistryForTests();
  const mod = await import("../src/features/competition-core/index.js");
  assert.equal(mod.isCapabilityExecutorRegistryEmpty(), true);
  assert.equal(mod.isShadowComparatorRegistryEmpty(), true);
  assert.equal(mod.isShadowNormalizerRegistryEmpty(), true);
  assert.equal(mod.isEligibilityAllowlistRegistryEmpty(), true);
});

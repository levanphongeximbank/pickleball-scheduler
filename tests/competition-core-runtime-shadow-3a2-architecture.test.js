import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveShadowEligibility,
  resolveShadowExecutionPlan,
  compareShadowResults,
  SHADOW_PRIMARY_EXECUTION,
  SHADOW_RETURN_SOURCE,
  RUNTIME_MODE,
  RUNTIME_EXECUTOR,
  resolveRuntimeDecision,
} from "../src/features/competition-core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RC_ROOT = path.join(ROOT, "src/features/competition-core/runtime-control");
const SHADOW_ROOT = path.join(RC_ROOT, "shadow");

function listJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (name.endsWith(".js")) {
      out.push(full);
    }
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

test("3A2 architecture: shadow module has no forbidden imports", () => {
  const files = listJsFiles(SHADOW_ROOT);
  assert.ok(files.length > 10, "expected shadow source files");
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      assert.doesNotMatch(
        content,
        pattern,
        `forbidden import ${pattern} in ${path.relative(ROOT, file)}`
      );
    }
  }
});

test("3A2 architecture: shadow has no process.env / Date.now / Math.random", () => {
  for (const file of listJsFiles(SHADOW_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /process\.env/,
      `process.env in ${path.relative(ROOT, file)}`
    );
    assert.doesNotMatch(
      content,
      /Date\.now\s*\(/,
      `Date.now in ${path.relative(ROOT, file)}`
    );
    assert.doesNotMatch(
      content,
      /Math\.random\s*\(/,
      `Math.random in ${path.relative(ROOT, file)}`
    );
  }
});

test("3A2 architecture: shadow has no browser / storage / fetch side effects", () => {
  for (const file of listJsFiles(SHADOW_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /\bfetch\s*\(/);
    assert.doesNotMatch(content, /localStorage/);
    assert.doesNotMatch(content, /sessionStorage/);
    assert.doesNotMatch(content, /\bwindow\b/);
    assert.doesNotMatch(content, /\bdocument\b/);
    assert.doesNotMatch(content, /console\.log/);
  }
});

test("3A2 architecture: no executor invocation or persistence", () => {
  for (const file of listJsFiles(SHADOW_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /saveClubData|supabase\.from|createClient/);
    assert.doesNotMatch(
      content,
      /runLegacy|evaluateCanonicalDraw|buildInternalTournamentPlan|processCompletedMatch|executeCompetitionEngine/
    );
    assert.doesNotMatch(content, /runShadowMapping|attemptPersist|attemptExecutor/);
  }
});

test("3A2 architecture: no format runtime imports from shadow", () => {
  for (const file of listJsFiles(SHADOW_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /from\s+['"][^'"]*\/(draw|formation|matchmaking|standings|scheduling)\//
    );
    assert.doesNotMatch(
      content,
      /from\s+['"]\.\.\/\.\.\/\.\.\/(draw|formation|constraints)\//
    );
  }
});

test("3A2 architecture: defaults keep Production behavior unchanged", () => {
  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);

  const eligibility = resolveShadowEligibility({});
  assert.equal(eligibility.eligible, false);

  const plan = resolveShadowExecutionPlan({});
  assert.equal(plan.primaryExecution, SHADOW_PRIMARY_EXECUTION.LEGACY);
  assert.equal(plan.resultReturnSource, SHADOW_RETURN_SOURCE.LEGACY);
  assert.equal(plan.canonicalInvocationAllowed, false);
  assert.equal(plan.shadowExecutionEnabled, false);
});

test("3A2 architecture: compareShadowResults does not dispatch executors", () => {
  const comparison = compareShadowResults({
    envelope: {
      legacyResult: { ok: true },
      canonicalResult: { ok: true },
    },
  });
  assert.equal(comparison.status, "EQUIVALENT");
});

test("3A2 architecture: public exports wired through competition-core index", () => {
  const indexContent = readFileSync(
    path.join(ROOT, "src/features/competition-core/index.js"),
    "utf8"
  );
  assert.match(indexContent, /resolveShadowEligibility/);
  assert.match(indexContent, /compareShadowResults/);
  assert.match(indexContent, /SHADOW_INFRASTRUCTURE_VERSION/);

  const rcIndex = readFileSync(
    path.join(ROOT, "src/features/competition-core/runtime-control/index.js"),
    "utf8"
  );
  assert.match(rcIndex, /shadow\/index\.js/);
});

test("3A2 architecture: no Production route or UI wiring in shadow tree", () => {
  for (const file of listJsFiles(SHADOW_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /createBrowserRouter|Route\s|useNavigate/);
    assert.doesNotMatch(content, /VITE_/);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveRuntimeDecision,
  RUNTIME_MODE,
  RUNTIME_EXECUTOR,
} from "../src/features/competition-core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RC_ROOT = path.join(ROOT, "src/features/competition-core/runtime-control");

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
  /from\s+['"][^'"]*individual-tournament/,
  /from\s+['"][^'"]*tournament-engine/,
  /from\s+['"][^'"]*clubStorage/,
];

test("3A1 architecture: runtime-control has no forbidden imports", () => {
  const files = listJsFiles(RC_ROOT);
  assert.ok(files.length > 5, "expected runtime-control source files");
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

test("3A1 architecture: runtime-control does not read process.env", () => {
  for (const file of listJsFiles(RC_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /process\.env/,
      `process.env reference in ${path.relative(ROOT, file)}`
    );
  }
});

test("3A1 architecture: runtime-control does not call Date.now or Math.random", () => {
  for (const file of listJsFiles(RC_ROOT)) {
    const content = readFileSync(file, "utf8");
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

test("3A1 architecture: runtime-control does not persist or dispatch executors", () => {
  for (const file of listJsFiles(RC_ROOT)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /saveClubData|supabase\.from|createClient/);
    assert.doesNotMatch(
      content,
      /runLegacy|evaluateCanonicalDraw|buildInternalTournamentPlan|processCompletedMatch/
    );
  }
});

test("3A1 architecture: public resolveRuntimeDecision never selects non-legacy executor", () => {
  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
});

test("3A1 architecture: competition-core index exports resolveRuntimeDecision", () => {
  const indexContent = readFileSync(
    path.join(ROOT, "src/features/competition-core/index.js"),
    "utf8"
  );
  assert.match(indexContent, /resolveRuntimeDecision/);
  assert.match(indexContent, /runtime-control\/index\.js/);
});

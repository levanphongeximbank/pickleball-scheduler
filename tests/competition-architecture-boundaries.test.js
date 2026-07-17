import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RULES,
  collectViolations,
  extractImports,
} from "../scripts/ci/competition-architecture-lock.mjs";
import {
  COMPETITION_CORE_FLAG_KEYS,
  getCompetitionCoreFeatureFlags,
  evaluateCanonicalStandingsRuntime,
  evaluateLegacyTeamLineupValidation,
  evaluateLegacyAiPairScore,
  isRulesV2Enabled,
  isStandingsV2Enabled,
} from "../src/features/competition-core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("architecture lock rules are defined for Phase 2A boundaries", () => {
  const ids = RULES.map((r) => r.id);
  assert.ok(ids.includes("cc-no-format-module"));
  assert.ok(ids.includes("cc-no-page-logic"));
  assert.ok(ids.includes("cc-no-supabase-gateway"));
  assert.ok(ids.includes("engine-no-page-logic"));
});

test("competition-core public API exports contracts usable by format modules", () => {
  assert.equal(typeof evaluateCanonicalStandingsRuntime, "function");
  assert.equal(typeof evaluateLegacyTeamLineupValidation, "function");
  assert.equal(typeof evaluateLegacyAiPairScore, "function");
  assert.equal(typeof isRulesV2Enabled, "function");
  assert.equal(typeof isStandingsV2Enabled, "function");
});

test("competition core feature flags remain default OFF", () => {
  const flags = getCompetitionCoreFeatureFlags({});
  assert.equal(flags.coreEnabled, false);
  assert.equal(flags.ratingV2Enabled, false);
  assert.equal(flags.rulesV2Enabled, false);
  assert.equal(flags.drawV2Enabled, false);
  assert.equal(flags.formationV2Enabled, false);
  assert.equal(flags.matchmakingV2Enabled, false);
  assert.equal(flags.standingsV2Enabled, false);
  assert.equal(flags.schedulingV2Enabled, false);
  assert.equal(isRulesV2Enabled({}), false);
  assert.equal(isStandingsV2Enabled({}), false);
  assert.ok(COMPETITION_CORE_FLAG_KEYS.CORE.startsWith("VITE_"));
});

test("format modules may import competition-core public API (allowed direction)", () => {
  const relFiles = [
    "src/features/team-tournament/engines/lineupValidationEngine.js",
    "src/features/individual-tournament/adapters/individualStandingsAdapter.js",
    "src/ai/scoring.js",
  ];
  for (const relFile of relFiles) {
    const content = readFileSync(path.join(ROOT, relFile), "utf8");
    const imports = extractImports(content);
    const usesPublicApi = imports.some((spec) => /competition-core\/index\.js/.test(spec));
    assert.ok(usesPublicApi, `${relFile} should import competition-core/index.js public API`);
  }
});

test("competition-core does not import React or MUI (zero-tolerance rule)", () => {
  const violations = collectViolations();
  for (const [key, v] of violations) {
    if (v.rule === "cc-no-react-ui" || v.rule === "engine-no-react-ui") {
      assert.fail(`Unexpected React/UI import violation: ${key} → ${v.symbol}`);
    }
  }
});

test("competition-core does not import pages/ (zero-tolerance rule)", () => {
  const violations = collectViolations();
  for (const [key, v] of violations) {
    if (v.rule === "cc-no-page-logic") {
      assert.fail(`Unexpected page-logic import in competition-core: ${key} → ${v.symbol}`);
    }
  }
});

test("grandfathered violations are inventoried in baseline", () => {
  const baseline = JSON.parse(
    readFileSync(
      path.join(ROOT, "scripts/ci/competition-architecture-lock-baseline.json"),
      "utf8"
    )
  );
  assert.ok(Array.isArray(baseline.exceptions));
  assert.ok(baseline.exceptions.length >= 10, "expected full Phase 2A debt inventory");
  const rules = new Set(baseline.exceptions.map((e) => e.rule));
  assert.ok(rules.has("cc-no-format-module"));
  assert.ok(rules.has("engine-no-page-logic"));
  assert.ok(rules.has("cc-no-supabase-gateway"));
});

test("competition-core index.js is the documented public entry (no deep re-export requirement)", () => {
  const indexContent = readFileSync(
    path.join(ROOT, "src/features/competition-core/index.js"),
    "utf8"
  );
  assert.match(indexContent, /Competition Core public API/);
  assert.doesNotMatch(indexContent, /from ['"]react/);
  assert.doesNotMatch(indexContent, /team-tournament/);
});

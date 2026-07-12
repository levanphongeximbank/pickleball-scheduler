import test from "node:test";
import assert from "node:assert/strict";

import { validatePlaceholders } from "../src/features/pick-vn-rating-v5/audit/placeholderValidator.js";
import { DERIVED_METRICS } from "../src/features/pick-vn-rating-v5/constants/derivedMetrics.js";
import { DOUBLES_DOMAIN_WEIGHTS } from "../src/features/pick-vn-rating-v5/constants/domainWeights.js";
import { GATE_AUXILIARY_DOMAIN_CODES } from "../src/features/pick-vn-rating-v5/constants/domainCodes.js";
import {
  computeGlossaryChecksum,
  computeQuestionBankChecksum,
  computeScoringConfigChecksum,
  getFrozenVersionContract,
} from "../src/features/pick-vn-rating-v5/constants/versionFreeze.js";
import { resolvePromptText } from "../src/features/pick-vn-rating-v5/constants/terminology.js";
import { normalizeLegacySkillSubcode } from "../src/features/pick-vn-rating-v5/constants/domainCodes.js";
import { RATING_GLOSSARY } from "../src/features/pick-vn-rating-v5/constants/ratingGlossary.js";

test("placeholder validation passes for question bank", () => {
  const result = validatePlaceholders();
  if (!result.ok) {
    assert.fail(result.issues.join("\n"));
  }
  assert.equal(result.unresolvedCount, 0);
  assert.equal(result.englishOnlyCount, 0);
  assert.ok(result.totalPlaceholders > 0);
});

test("derived metrics are not in doubles domain weights (no double counting)", () => {
  for (const code of Object.keys(DERIVED_METRICS)) {
    assert.equal(DERIVED_METRICS[code].type, "derived_metric");
    assert.equal(DOUBLES_DOMAIN_WEIGHTS[code], undefined, `${code} must not be weighted`);
    assert.ok(GATE_AUXILIARY_DOMAIN_CODES.includes(code));
  }
});

test("version freeze checksums are stable and non-empty", () => {
  const contract = getFrozenVersionContract();
  assert.match(contract.assessmentVersion, /v5\.0f/);
  assert.match(contract.questionBankChecksum, /^[a-f0-9]{64}$/);
  assert.match(contract.glossaryChecksum, /^[a-f0-9]{64}$/);
  assert.match(contract.scoringConfigChecksum, /^[a-f0-9]{64}$/);
  assert.equal(contract.questionBankChecksum, computeQuestionBankChecksum());
  assert.equal(contract.glossaryChecksum, computeGlossaryChecksum());
  assert.equal(contract.scoringConfigChecksum, computeScoringConfigChecksum());
});

test("resolvePromptText preserves punctuation and newlines", () => {
  const text = "Dòng 1.\n{{serve}} và {{kitchen}}!";
  const resolved = resolvePromptText(text);
  assert.ok(resolved.includes("\n"));
  assert.ok(resolved.endsWith("!"));
});

test("legacy third_shot_drop is not equivalent to third_shot domain", () => {
  const legacy = normalizeLegacySkillSubcode("third_shot_drop");
  assert.ok(legacy);
  assert.equal(legacy.glossary_code, "third_shot_drop");
  assert.equal(legacy.legacy_compatibility_only, true);
  assert.equal(legacy.semantic_normalization_required, true);
  assert.notEqual(legacy.glossary_code, "third_shot");
});

test("required glossary codes exist", () => {
  const required = [
    "drive", "rally", "forehand", "backhand", "baseline", "crosscourt",
    "down_the_line", "pop_up", "counterattack", "unforced_error",
    "shot_selection", "recovery_position", "third_shot_drop", "third_shot_drive",
    "third_shot", "put_away", "foot_fault",
  ];
  for (const code of required) {
    assert.ok(RATING_GLOSSARY[code], `missing glossary: ${code}`);
  }
});

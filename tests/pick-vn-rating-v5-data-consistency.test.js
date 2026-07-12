import test from "node:test";
import assert from "node:assert/strict";

import { runDataConsistencyAudit } from "../src/features/pick-vn-rating-v5/audit/dataConsistencyValidator.js";
import { formatRatingTerm, resolvePromptText } from "../src/features/pick-vn-rating-v5/constants/terminology.js";
import { getAssessmentVersionContract } from "../src/features/pick-vn-rating-v5/constants/versions.js";
import { normalizeDomainCode } from "../src/features/pick-vn-rating-v5/constants/domainCodes.js";
import { CORE_QUESTIONS } from "../src/features/pick-vn-rating-v5/assessment/coreQuestions.js";
import { ADAPTIVE_QUESTIONS } from "../src/features/pick-vn-rating-v5/assessment/adaptiveQuestionBank.js";
import { scoreAssessment } from "../src/features/pick-vn-rating-v5/assessment/assessmentScoringEngine.js";
import { getCoreQuestionIds } from "../src/features/pick-vn-rating-v5/assessment/coreQuestions.js";

test("data consistency audit passes", () => {
  const result = runDataConsistencyAudit();
  if (!result.ok) {
    assert.fail(result.issues.join("\n"));
  }
});

test("no duplicate question IDs across 52 questions", () => {
  const ids = [...CORE_QUESTIONS.map((q) => q.id), ...ADAPTIVE_QUESTIONS.map((q) => q.id)];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 52);
});

test("domain alias normalizes to canonical code", () => {
  assert.equal(normalizeDomainCode("thirdShot"), "third_shot");
  assert.equal(normalizeDomainCode("dinkSoftGame"), "dink_soft_game");
});

test("legacy third_shot_drop subcode is not domain alias", () => {
  assert.equal(normalizeDomainCode("third_shot_drop"), null);
});

test("formatRatingTerm uses English (Vietnamese) format", () => {
  assert.equal(
    formatRatingTerm("serve"),
    "Serve (giao bóng)",
  );
  assert.equal(
    formatRatingTerm("dink_soft_game"),
    "Dink (cú đánh mềm gần vùng cấm vô-lê)",
  );
});

test("resolvePromptText replaces glossary placeholders", () => {
  const text = "{{serve}} vào {{kitchen}}";
  const resolved = resolvePromptText(text);
  assert.match(resolved, /Serve \(giao bóng\)/);
  assert.match(resolved, /Kitchen \(vùng cấm vô-lê\)/);
});

test("assessment response includes full version contract", () => {
  const answers = {};
  for (const id of getCoreQuestionIds()) answers[id] = 3;
  const result = scoreAssessment(answers);
  const contract = getAssessmentVersionContract();
  assert.ok(result.versions);
  assert.equal(result.versions.assessmentVersion, contract.assessmentVersion);
  assert.equal(result.versions.scoringEngineVersion, contract.scoringEngineVersion);
  assert.equal(result.versions.gateVersion, contract.gateVersion);
  assert.equal(result.versions.glossaryVersion, contract.glossaryVersion);
});

test("explanationDisplay uses glossary not raw English codes", () => {
  const answers = {};
  for (const id of getCoreQuestionIds()) answers[id] = 3;
  const result = scoreAssessment(answers);
  assert.ok(result.explanationDisplay.strengths.includes("("));
  assert.ok(!result.explanationDisplay.strengths.includes("dink_soft_game"));
});

test("doubles domain weights sum to 100%", () => {
  const audit = runDataConsistencyAudit();
  assert.ok(Math.abs(audit.report.domainWeightTotal - 1) < 0.001);
});

test("glossary covers all weighted and gate domains", () => {
  const audit = runDataConsistencyAudit();
  assert.equal(audit.report.glossaryCoverage.missing.length, 0);
});

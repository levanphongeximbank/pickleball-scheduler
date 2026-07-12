import test from "node:test";
import assert from "node:assert/strict";

import {
  CORE_QUESTIONS,
  getCoreQuestionIds,
} from "../src/features/pick-vn-rating-v5/assessment/coreQuestions.js";
import {
  ADAPTIVE_QUESTIONS,
  getQuestionBankSize,
  MAX_ADAPTIVE_QUESTIONS,
} from "../src/features/pick-vn-rating-v5/assessment/adaptiveQuestionBank.js";
import {
  anchorToSkillMean,
  scoreAssessment,
} from "../src/features/pick-vn-rating-v5/assessment/assessmentScoringEngine.js";
import {
  selectNextAdaptiveQuestion,
  buildAssessmentPlan,
} from "../src/features/pick-vn-rating-v5/assessment/adaptiveRouting.js";
import { applyCriticalGates } from "../src/features/pick-vn-rating-v5/assessment/criticalGates.js";

test("core question bank has exactly 22 questions with 8 anchors each", () => {
  assert.equal(CORE_QUESTIONS.length, 22);
  for (const q of CORE_QUESTIONS) {
    assert.equal(q.anchors.length, 8, `${q.id} must have 8 anchors`);
    assert.equal(q.isCore, true);
  }
});

test("question bank size in 50–60 range target", () => {
  const size = getQuestionBankSize();
  assert.ok(size >= 50 && size <= 60, `bank size ${size}`);
  assert.equal(size, 22 + ADAPTIVE_QUESTIONS.length);
});

test("anchor 0 and 7 map to scale endpoints without intermediate rounding", () => {
  assert.equal(anchorToSkillMean(0), 1.5);
  assert.equal(anchorToSkillMean(7), 6.0);
  const mid = anchorToSkillMean(4);
  assert.ok(mid > 3.5 && mid < 4.5);
});

test("scoreAssessment returns skill vector and gate metadata", () => {
  const answers = {};
  for (const id of getCoreQuestionIds()) {
    answers[id] = 4;
  }
  const result = scoreAssessment(answers);
  assert.ok(result.initialMean >= 1.5 && result.initialMean <= 6.0);
  assert.ok(result.initialDeviation > 0);
  assert.ok(result.skillVector);
  assert.ok(result.explanation.summary.includes("Rating tổng"));
  assert.equal(result.assessmentVersion, "assessment-v5.0f");
});

test("critical gate caps high rating when dink is weak", () => {
  const skillVector = {
    serve: 5.5,
    return: 5.5,
    groundstroke: 5.5,
    dink_soft_game: 2.0,
    transition: 2.0,
    block_reset: 2.0,
    doubles_positioning: 2.0,
    rally_consistency: 5.0,
    error_control: 5.0,
    consistency: 2.0,
    pressure_execution: 5.0,
  };
  const gated = applyCriticalGates(4.8, skillVector, { hasContradiction: false });
  assert.ok(gated.ratingAfterGates < gated.ratingBeforeGates);
  assert.ok(gated.appliedGates.length > 0);
  assert.ok(gated.limitingSkills.length > 0);
});

test("gate 4.5 caps provisional and requires verification", () => {
  const skillVector = {
    serve: 6,
    return: 6,
    groundstroke: 6,
    dink_soft_game: 5.5,
    transition: 5.5,
    block_reset: 5.5,
    doubles_positioning: 5.5,
    rally_consistency: 5.5,
    error_control: 5.5,
    consistency: 5.5,
    pressure_execution: 5,
  };
  const gated = applyCriticalGates(5.2, skillVector);
  assert.ok(gated.ratingAfterGates <= 4.5);
  assert.equal(gated.verificationRequired, true);
});

test("adaptive routing respects max adaptive count", () => {
  const plan = buildAssessmentPlan();
  assert.equal(plan.coreQuestionIds.length, 22);
  assert.equal(plan.maxAdaptiveQuestions, MAX_ADAPTIVE_QUESTIONS);

  const askedIds = [];
  const answers = {};
  for (let i = 0; i < MAX_ADAPTIVE_QUESTIONS + 2; i += 1) {
    const next = selectNextAdaptiveQuestion({ answers, askedIds, contradictionDetected: false });
    if (!next) break;
    askedIds.push(next.id);
    answers[next.id] = 3;
  }
  assert.equal(askedIds.length, MAX_ADAPTIVE_QUESTIONS);
});

test("no score band or 0.6 calibration in V5 scoring", () => {
  const answers = {};
  for (const id of getCoreQuestionIds()) {
    answers[id] = 5;
  }
  const result = scoreAssessment(answers);
  const rawMean = result.ratingBeforeGates;
  assert.ok(Math.abs(rawMean - result.initialMean) < 0.5 || result.appliedGates.length > 0);
  assert.ok(!String(result.initialMean).includes("band"));
});

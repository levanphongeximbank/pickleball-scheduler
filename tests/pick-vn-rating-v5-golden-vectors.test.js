import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { scoreAssessmentForPersistence } from "../src/features/pick-vn-rating-v5/server/scoreAssessmentCompletion.js";

const root = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(root, "..", "docs/v5/rating-v5/golden-vectors/V5_GOLDEN_VECTORS.json");

const TOL = 0.001;

function closeEnough(a, b) {
  if (a == null && b == null) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= TOL;
  }
  return false;
}

function assertNumericMap(actual, expected, path = "") {
  for (const [key, expVal] of Object.entries(expected ?? {})) {
    const actVal = actual?.[key];
    if (typeof expVal === "number") {
      assert.ok(closeEnough(actVal, expVal), `${path}${key}: ${actVal} vs ${expVal}`);
    }
  }
}

function assertExactJson(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
}

function scoreFromGoldenVector(vector) {
  const assessment = {
    id: `golden-test-${vector.id}`,
    tenant_id: "golden-tenant",
    player_id: "00000000-0000-4000-8000-000000000001",
    rating_mode: "doubles",
    assessment_status: "draft",
    is_shadow: true,
    rollout_cohort: "v5-shadow-pilot",
  };
  return scoreAssessmentForPersistence(
    {
      assessment_id: assessment.id,
      answers: vector.answers,
      rating_mode: "doubles",
      userId: assessment.player_id,
      tenantId: assessment.tenant_id,
    },
    assessment,
  );
}

test("golden vectors file exists and has 34+ vectors", () => {
  const raw = readFileSync(goldenPath, "utf8");
  const data = JSON.parse(raw);
  assert.ok(data.count >= 34, `expected >=34 vectors, got ${data.count}`);
  assert.equal(data.versionFreeze, "v5.0f");
});

test("golden vector parity — all personas", () => {
  const data = JSON.parse(readFileSync(goldenPath, "utf8"));
  for (const vector of data.vectors) {
    const scored = scoreFromGoldenVector(vector);
    assert.equal(scored.ok, true, `${vector.id} scoring failed`);
    assert.equal(scored.code, "SCORED", vector.id);
    const r = scored.response;
    const e = vector.expected;

    assertNumericMap(r.domain_scores, e.domain_scores, `${vector.id}.domain.`);
    assertNumericMap(r.derived_metrics, e.derived_metrics, `${vector.id}.derived.`);
    assert.ok(closeEnough(r.overall_skill, e.overall_skill), vector.id);
    assert.ok(closeEnough(r.rating_before_gates, e.rating_before_gates), vector.id);
    assert.ok(closeEnough(r.rating_after_gates, e.rating_after_gates), vector.id);
    assert.ok(closeEnough(r.estimated_rating, e.estimated_rating), vector.id);
    assert.equal(r.provisional_display_rating, e.provisional_display_rating, vector.id);
    assert.ok(closeEnough(r.confidence_score, e.confidence_score), vector.id);
    assert.ok(closeEnough(r.estimated_error, e.estimated_error), vector.id);
    assertExactJson(r.applied_gates, e.applied_gates, `${vector.id} gates`);
    assertExactJson(r.limiting_skills, e.limiting_skills, `${vector.id} limiting`);
    assertExactJson(r.warning_flags, e.warning_flags, `${vector.id} warnings`);
    assertExactJson(r.versions, e.versions, `${vector.id} versions`);
  }
});

test("golden vector required personas present", () => {
  const data = JSON.parse(readFileSync(goldenPath, "utf8"));
  const ids = new Set(data.vectors.map((v) => v.id));
  for (const required of [
    "p01_brand_new",
    "p09_balanced_30",
    "p10_balanced_35",
    "p11_balanced_40",
    "p13_expected_above_45",
    "p05_drive_strong_dink_weak",
    "p06_dink_good_transition_weak",
    "p30_contradiction_check",
    "gv_boundary_anchor_min",
    "gv_boundary_anchor_max",
  ]) {
    assert.ok(ids.has(required), `missing ${required}`);
  }
});

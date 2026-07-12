import test from "node:test";
import assert from "node:assert/strict";

import {
  BENCHMARK_PERSONAS,
  runAllPersonaBenchmarks,
  runPersonaBenchmark,
  validateBenchmarkResults,
} from "../src/features/pick-vn-rating-v5/benchmark/personas.js";
import { toDisplayRating } from "../src/features/pick-vn-rating-v5/constants/ratingScale.js";

test("benchmark has at least 30 personas", () => {
  assert.ok(BENCHMARK_PERSONAS.length >= 30);
});

test("30 persona benchmark validation passes", () => {
  const results = runAllPersonaBenchmarks();
  assert.equal(results.length, 30);
  const validation = validateBenchmarkResults(results);
  if (!validation.ok) {
    assert.fail(validation.issues.join("\n"));
  }
});

test("drive strong dink weak cannot reach high gated rating", () => {
  const r = runPersonaBenchmark(BENCHMARK_PERSONAS.find((p) => p.id === "p05_drive_strong_dink_weak"));
  assert.ok(r.rating_after_gates < 4.0);
  assert.ok(r.limiting_skills.length > 0);
});

test("all high triggers verification but no verified rating", () => {
  const r = runPersonaBenchmark(BENCHMARK_PERSONAS.find((p) => p.id === "p12_all_high"));
  assert.equal(r.verified_rating_created, false);
  assert.ok(r.verification_required);
  assert.ok(r.provisional_display_rating <= 4.5);
});

test("above 4.5 persona capped and under review", () => {
  const r = runPersonaBenchmark(BENCHMARK_PERSONAS.find((p) => p.id === "p13_expected_above_45"));
  assert.ok(r.estimated_rating >= 4.3);
  assert.ok(r.provisional_display_rating <= 4.5);
  assert.equal(r.verification_required, true);
});

test("balanced personas increase monotonically", () => {
  const p09 = runPersonaBenchmark(BENCHMARK_PERSONAS.find((p) => p.id === "p09_balanced_30"));
  const p10 = runPersonaBenchmark(BENCHMARK_PERSONAS.find((p) => p.id === "p10_balanced_35"));
  const p11 = runPersonaBenchmark(BENCHMARK_PERSONAS.find((p) => p.id === "p11_balanced_40"));
  assert.ok(p09.rating_after_gates < p10.rating_after_gates);
  assert.ok(p10.rating_after_gates < p11.rating_after_gates);
});

test("no persona below minimum 1.5", () => {
  const results = runAllPersonaBenchmarks();
  for (const r of results) {
    assert.ok(r.rating_after_gates >= 1.5, `${r.id} below 1.5`);
  }
});

test("beginner does not exceed 24 questions without contradiction", () => {
  const r = runPersonaBenchmark(BENCHMARK_PERSONAS.find((p) => p.id === "p01_brand_new"));
  assert.ok(r.total_questions_answered <= 24);
  assert.ok(r.total_questions_answered >= 22);
});

test("provisional display uses 0.1 step not 0.5 band", () => {
  const r = runPersonaBenchmark(BENCHMARK_PERSONAS.find((p) => p.id === "p10_balanced_35"));
  const display = toDisplayRating(r.rating_after_gates);
  assert.equal(r.provisional_display_rating, Math.min(display, 4.5));
  const frac = Math.round((r.provisional_display_rating * 10) % 10);
  assert.ok(frac <= 9);
});

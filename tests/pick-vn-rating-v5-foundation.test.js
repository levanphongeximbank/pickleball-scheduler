import test from "node:test";
import assert from "node:assert/strict";

import {
  V5_MIN_RATING,
  V5_MAX_RATING,
  toDisplayRating,
  toEstimatedRange,
  clampRatingMean,
} from "../src/features/pick-vn-rating-v5/constants/ratingScale.js";
import {
  SYSTEM_VERSION,
  ASSESSMENT_VERSION,
  V5_VERSION_BUNDLE,
} from "../src/features/pick-vn-rating-v5/constants/versions.js";
import { resolveDisplayRating } from "../src/features/pick-vn-rating-v5/engines/displayRatingResolver.js";
import { computeReliabilityScore } from "../src/features/pick-vn-rating-v5/engines/reliabilityEngine.js";
import { DOUBLES_DOMAIN_WEIGHTS } from "../src/features/pick-vn-rating-v5/constants/domainWeights.js";

test("V5 version bundle", () => {
  assert.equal(SYSTEM_VERSION, "pick-vn-rating-v5");
  assert.equal(ASSESSMENT_VERSION, "assessment-v5.0f");
  assert.equal(V5_VERSION_BUNDLE.calibrationVersion, "calibration-v5.0f");
});

test("continuous scale — clamp and display round only at display", () => {
  assert.equal(V5_MIN_RATING, 1.5);
  assert.equal(V5_MAX_RATING, 6.0);
  assert.equal(clampRatingMean(3.746), 3.746);
  assert.equal(toDisplayRating(3.746), 3.7);
  assert.equal(toDisplayRating(3.74), 3.7);
});

test("estimated range does not shrink rating mean", () => {
  const range = toEstimatedRange(3.746, 0.3);
  assert.equal(range.low, 3.4);
  assert.equal(range.high, 4.0);
});

test("display resolver — verified when reliability sufficient", () => {
  const result = resolveDisplayRating({
    verifiedRatingMean: 3.7,
    openRatingMean: 3.2,
    reliabilityScore: 75,
    ratingStatus: "verified",
  });
  assert.equal(result.displaySource, "verified_match_rating");
  assert.equal(result.ratingMean, 3.7);
});

test("display resolver — open when verified reliability too low", () => {
  const result = resolveDisplayRating({
    verifiedRatingMean: 3.7,
    openRatingMean: 3.4,
    reliabilityScore: 42,
  });
  assert.equal(result.displaySource, "open_match_rating");
  assert.equal(result.ratingMean, 3.4);
});

test("reliability is independent from rating mean", () => {
  const { reliabilityScore } = computeReliabilityScore({
    domainCoverage: 0.8,
    verifiedMatchCount: 10,
    daysSinceLastVerifiedMatch: 30,
    consistency: 0.7,
    assessmentCount: 1,
    maxEvidenceLevel: 4,
  });
  assert.ok(reliabilityScore >= 50 && reliabilityScore <= 100);
  assert.notEqual(reliabilityScore, Math.round(3.7 * 42));
});

test("domain weights sum to 100%", () => {
  const sum = Object.values(DOUBLES_DOMAIN_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 0.001);
});

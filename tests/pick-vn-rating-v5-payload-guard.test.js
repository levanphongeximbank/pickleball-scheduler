import test from "node:test";
import assert from "node:assert/strict";

import { validateCompleteAssessmentPayload } from "../src/features/pick-vn-rating-v5/security/completeAssessmentPayloadGuard.js";
import { buildCoreAnswers } from "../src/features/pick-vn-rating-v5/benchmark/personas.js";

const VALID_ANSWERS = buildCoreAnswers({}, 3);

function rejectPayload(extraFields) {
  const result = validateCompleteAssessmentPayload({
    assessment_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    answers: VALID_ANSWERS,
    rating_mode: "doubles",
    ...extraFields,
  });
  assert.equal(result.ok, false, `expected reject for ${JSON.stringify(Object.keys(extraFields))}`);
  assert.equal(result.code, "FORBIDDEN_PAYLOAD_FIELD");
  return result;
}

test("strict allowlist accepts canonical payload", () => {
  const result = validateCompleteAssessmentPayload({
    assessment_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    answers: VALID_ANSWERS,
    rating_mode: "doubles",
    assessment_version: "assessment-v5.0f",
  });
  assert.equal(result.ok, true);
});

test("rejects camelCase top-level fields", () => {
  const result = validateCompleteAssessmentPayload({
    assessmentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    answers: VALID_ANSWERS,
    ratingMode: "doubles",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "FORBIDDEN_PAYLOAD_FIELD");
});

const FORBIDDEN_FIELD_CASES = [
  ["verified_rating", { verified_rating: 4 }],
  ["domain_scores", { domain_scores: { serve: 4 } }],
  ["reliability_score", { reliability_score: 90 }],
  ["estimated_rating", { estimated_rating: 4 }],
  ["rating_status", { rating_status: "verified" }],
  ["evidence_level", { evidence_level: 5 }],
  ["tenant_id", { tenant_id: "venue-a" }],
  ["player_id", { player_id: "00000000-0000-4000-8000-000000000001" }],
  ["overall_skill", { overall_skill: 4 }],
  ["provisional_rating", { provisional_rating: 4 }],
  ["unexpected_future_field", { unexpected_future_field: true }],
];

for (const [name, fields] of FORBIDDEN_FIELD_CASES) {
  test(`forbidden field rejected: ${name}`, () => {
    const result = rejectPayload(fields);
    assert.ok(result.forbiddenFields.includes(Object.keys(fields)[0]));
  });
}

test("rejects multiple forbidden fields at once", () => {
  const result = rejectPayload({
    verified_rating: 4,
    domain_scores: { serve: 4 },
    reliability_score: 90,
  });
  assert.equal(result.forbiddenFields.length, 3);
});

test("forbidden response exposes field names only", () => {
  const result = rejectPayload({ verified_rating: 4.5 });
  assert.ok(result.forbiddenFields.includes("verified_rating"));
  assert.equal(result.verified_rating, undefined);
});

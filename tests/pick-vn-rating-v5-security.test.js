import test from "node:test";
import assert from "node:assert/strict";

import {
  validateClientRatingPayload,
  validateAssessmentInputPayload,
  validateMatchInputPayload,
  stripForbiddenRatingFields,
} from "../src/features/pick-vn-rating-v5/security/ratingPayloadGuard.js";
import { FORBIDDEN_CLIENT_RATING_FIELDS } from "../src/features/pick-vn-rating-v5/security/forbiddenClientFields.js";

test("rejects client authoritative rating fields", () => {
  const result = validateClientRatingPayload({
    questionId: "core_srv_01",
    answerIndex: 4,
    ratingMean: 4.5,
    verifiedRating: 4.5,
    ratingStatus: "verified",
    reliabilityScore: 99,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "FORBIDDEN_RATING_FIELDS");
  assert.ok(result.forbiddenFields.includes("ratingMean"));
  assert.ok(result.forbiddenFields.includes("verifiedRating"));
});

test("allows clean assessment input", () => {
  const result = validateAssessmentInputPayload({
    questionId: "core_srv_01",
    answerIndex: 4,
    assessmentSessionId: "sess-1",
    ratingMode: "doubles",
  });
  assert.equal(result.ok, true);
});

test("rejects assessment with computed fields", () => {
  const result = validateAssessmentInputPayload({
    questionId: "core_srv_01",
    answerIndex: 4,
    skillVector: { serve: 3.5 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "FORBIDDEN_RATING_FIELDS");
});

test("allows match input without rating fields", () => {
  const result = validateMatchInputPayload({
    matchId: "m-1",
    ratingMode: "doubles",
    teamA: ["p1", "p2"],
    teamB: ["p3", "p4"],
    setScores: [[11, 9]],
    totalPoints: 20,
    matchSource: "open_play",
    playedAt: "2026-07-12T10:00:00Z",
  });
  assert.equal(result.ok, true);
});

test("stripForbiddenRatingFields removes all forbidden keys", () => {
  const payload = {
    questionId: "q1",
    answerIndex: 3,
    ratingMean: 4.0,
    displayRating: 4.0,
    provisionalRating: 3.5,
  };
  const stripped = stripForbiddenRatingFields(payload);
  assert.deepEqual(stripped, { questionId: "q1", answerIndex: 3 });
});

test("forbidden field list covers spec requirements", () => {
  const required = [
    "ratingMean",
    "verifiedRating",
    "ratingStatus",
    "reliabilityScore",
    "skillVector",
    "adminOverride",
  ];
  for (const field of required) {
    assert.ok(FORBIDDEN_CLIENT_RATING_FIELDS.includes(field), `missing ${field}`);
  }
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  assertCompetitionEloSeparatedFromPublicRating,
  assertRatingIdempotencyKey,
  assertClubBlobRatingWriteForbidden,
  demoteLocalAssessmentToDraft,
  isPublicPlayerRatingActivationEnabled,
  RATING_CUTOVER_FLAG,
} from "../src/features/platform-hard-cutover/ratingCutoverPolicy.js";

test("rating cutover: competition Elo is not public rating", () => {
  const result = assertCompetitionEloSeparatedFromPublicRating();
  assert.equal(result.ok, true);
  assert.equal(result.competitionEloIsPublicRating, false);
  assert.equal(result.matchResultRatingPortImplemented, false);
});

test("rating cutover: idempotency key enforced", () => {
  assert.equal(assertRatingIdempotencyKey("short").ok, false);
  assert.equal(assertRatingIdempotencyKey("idem-key-01").ok, true);
});

test("rating cutover: club blob verified write forbidden", () => {
  const result = assertClubBlobRatingWriteForbidden();
  assert.equal(result.ok, false);
  assert.equal(result.code, "CLUB_BLOB_RATING_WRITE_FORBIDDEN");
});

test("rating cutover: local assessment demoted to draft", () => {
  const draft = demoteLocalAssessmentToDraft({ rating: 4.5, status: "verified" });
  assert.equal(draft.draftOnly, true);
  assert.equal(draft.canonicalAuthority, false);
  assert.equal(draft.status, "draft");
});

test("rating cutover: activation flag reader", () => {
  assert.equal(
    isPublicPlayerRatingActivationEnabled({ [RATING_CUTOVER_FLAG]: "true" }),
    true
  );
  assert.equal(
    isPublicPlayerRatingActivationEnabled({ [RATING_CUTOVER_FLAG]: "false" }),
    false
  );
});

test("rating cutover: club blob push writer remains frozen", async () => {
  const { frozenWriterResult } = await import(
    "../src/features/pick-vn-rating/services/playerRatingCanonicalBridge.js"
  );
  const result = frozenWriterResult("pushClubPlayersPickVnRatings", {
    note: "club blob is not canonical rating writer",
  });
  assert.equal(result.ok, false);
  assert.ok(String(result.code || "").length > 0);
});

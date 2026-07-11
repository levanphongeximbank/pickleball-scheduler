import test from "node:test";
import assert from "node:assert/strict";

import { isMatchRatingEligible } from "../src/features/competition-core/rating/index.js";

const baseRecord = {
  id: "m1",
  teamAPlayerIds: ["1"],
  teamBPlayerIds: ["2"],
  scoreA: 11,
  scoreB: 7,
  status: "completed",
};

test("isMatchRatingEligible accepts normal completed match", () => {
  const result = isMatchRatingEligible(baseRecord);
  assert.equal(result.eligible, true);
  assert.equal(result.status, "eligible");
});

test("isMatchRatingEligible rejects BYE", () => {
  const result = isMatchRatingEligible({ ...baseRecord, isBye: true });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "bye");
});

test("isMatchRatingEligible rejects cancelled and void", () => {
  assert.equal(isMatchRatingEligible({ ...baseRecord, status: "cancelled" }).eligible, false);
  assert.equal(isMatchRatingEligible({ ...baseRecord, status: "void" }).eligible, false);
});

test("isMatchRatingEligible rejects walkover_before_start result type", () => {
  const result = isMatchRatingEligible({
    ...baseRecord,
    resultType: "walkover_before_start",
  });
  assert.equal(result.eligible, false);
});

test("isMatchRatingEligible rejects daily play source", () => {
  const result = isMatchRatingEligible({ ...baseRecord, source: "daily_play" });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "daily_play");
});

test("isMatchRatingEligible rejects missing teams", () => {
  const result = isMatchRatingEligible({
    ...baseRecord,
    teamAPlayerIds: [],
    teamBPlayerIds: [],
  });
  assert.equal(result.eligible, false);
});

test("isMatchRatingEligible returns REQUIRES_REVIEW for unclear forfeit", () => {
  const result = isMatchRatingEligible({ ...baseRecord, status: "forfeit" });
  assert.equal(result.eligible, false);
  assert.equal(result.status, "requires_review");
  assert.equal(result.reason, "forfeit");
});

test("isMatchRatingEligible allows forfeit when explicitly confirmed", () => {
  const result = isMatchRatingEligible(
    { ...baseRecord, status: "forfeit", forfeitConfirmed: true }
  );
  assert.equal(result.eligible, true);
});

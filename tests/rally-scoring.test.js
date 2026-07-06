import test from "node:test";
import assert from "node:assert/strict";

import { validateRallyScore, getRallyWinner } from "../src/features/team-tournament/engines/rallyScoringEngine.js";

test("rally score 21-19 is valid", () => {
  const result = validateRallyScore({ scoreA: 21, scoreB: 19 });
  assert.equal(result.ok, true);
  assert.equal(result.winnerSide, "teamA");
});

test("rally score 20-20 is invalid on confirm", () => {
  const result = validateRallyScore({ scoreA: 20, scoreB: 20 });
  assert.equal(result.ok, false);
});

test("rally score 22-20 is valid deuce win", () => {
  const result = validateRallyScore({ scoreA: 22, scoreB: 20 });
  assert.equal(result.ok, true);
});

test("rally winner requires target and win-by margin", () => {
  assert.equal(getRallyWinner(20, 19), "");
  assert.equal(getRallyWinner(21, 19), "teamA");
});

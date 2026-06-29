import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSelectionMetrics,
  buildStartValidationErrors,
  recomputeCourt,
  swapTeamsInResult,
  movePlayerInResult,
} from "../src/pages/selectPlayers.logic.js";

test("buildSelectionMetrics computes capacity and start conditions", () => {
  const result = buildSelectionMetrics({
    selectedPlayersCount: 9,
    selectedCourtCount: 2,
    activeCourtsCount: 3,
  });

  assert.equal(result.maxPlayers, 12);
  assert.equal(result.requiredCourts, 3);
  assert.equal(result.waitingPotential, 0);
  assert.equal(result.hasEnoughSelectedCourts, false);
  assert.equal(result.canStart, false);
  assert.equal(result.selectEnoughCourtsLabel, "Chọn đủ 3 sân");
});

test("buildSelectionMetrics handles over-capacity selection", () => {
  const result = buildSelectionMetrics({
    selectedPlayersCount: 18,
    selectedCourtCount: 3,
    activeCourtsCount: 4,
  });

  assert.equal(result.maxPlayers, 16);
  assert.equal(result.waitingPotential, 2);
  assert.equal(result.hasEnoughSelectedCourts, false);
  assert.equal(result.selectEnoughCourtsLabel, "Chọn tất cả 4 sân hoạt động");
});

test("buildStartValidationErrors returns expected messages", () => {
  const errors = buildStartValidationErrors({
    selectedPlayersCount: 3,
    selectedActiveCourtsCount: 0,
    selectedCourtCount: 0,
    requiredCourts: 1,
    maxPlayers: 16,
  });

  assert.equal(errors.length, 3);
  assert.ok(errors.some((item) => item.includes("ít nhất 4 người")));
  assert.ok(errors.some((item) => item.includes("ít nhất 1 sân")));
});

test("recomputeCourt updates team totals and diff", () => {
  const court = recomputeCourt({
    teamA: [{ id: "a1", level: 3 }, { id: "a2", level: 4 }],
    teamB: [{ id: "b1", level: 2.5 }, { id: "b2", level: 2.5 }],
  });

  assert.equal(court.teamATotal, 7);
  assert.equal(court.teamBTotal, 5);
  assert.equal(court.diff, 2);
});

test("swapTeamsInResult swaps players and recalculates totals", () => {
  const result = {
    courts: [
      {
        court: 1,
        teamA: [{ id: "a1", level: 3 }, { id: "a2", level: 3 }],
        teamB: [{ id: "b1", level: 4 }, { id: "b2", level: 4 }],
      },
    ],
  };

  const next = swapTeamsInResult(result, 1);

  assert.deepEqual(
    next.courts[0].teamA.map((p) => p.id),
    ["b1", "b2"]
  );
  assert.deepEqual(
    next.courts[0].teamB.map((p) => p.id),
    ["a1", "a2"]
  );
  assert.equal(next.courts[0].teamATotal, 8);
  assert.equal(next.courts[0].teamBTotal, 6);
});

test("movePlayerInResult moves player between teams when valid", () => {
  const result = {
    courts: [
      {
        court: 1,
        teamA: [{ id: "a1", level: 3 }, { id: "a2", level: 3 }],
        teamB: [{ id: "b1", level: 4 }],
      },
    ],
  };

  const next = movePlayerInResult(result, 1, "A", "a1");

  assert.deepEqual(
    next.courts[0].teamA.map((p) => p.id),
    ["a2"]
  );
  assert.deepEqual(
    next.courts[0].teamB.map((p) => p.id),
    ["b1", "a1"]
  );
  assert.equal(next.courts[0].teamATotal, 3);
  assert.equal(next.courts[0].teamBTotal, 7);
});

test("movePlayerInResult is no-op when target team is full", () => {
  const result = {
    courts: [
      {
        court: 1,
        teamA: [{ id: "a1", level: 3 }, { id: "a2", level: 3 }],
        teamB: [{ id: "b1", level: 4 }, { id: "b2", level: 4 }],
      },
    ],
  };

  const next = movePlayerInResult(result, 1, "A", "a1");

  assert.deepEqual(next, result);
});

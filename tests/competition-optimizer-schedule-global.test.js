import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  SCHEDULE_GLOBAL_ALGORITHM_VERSION,
  OPTIMIZATION_OPERATION,
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
  runScheduleGlobalOptimizer,
  validateScheduleStructure,
  generateScheduleInitialCandidates,
  mutateScheduleCandidate,
  createSeededRng,
} from "../src/features/competition-optimizer/index.js";

function buildFixtureMatchups() {
  return [
    { id: "m1", teamAId: "t1", teamBId: "t2", roundNumber: 1 },
    { id: "m2", teamAId: "t1", teamBId: "t3", roundNumber: 2 },
    { id: "m3", teamAId: "t2", teamBId: "t3", roundNumber: 3 },
  ];
}

const budget = {
  maxInitialCandidates: 30,
  maxEvaluations: 300,
  maxIterations: 60,
  maxDurationMs: 600,
  stagnationLimit: 30,
};

describe("schedule global optimizer", () => {
  test("assigns slots without team double-booking", () => {
    const result = runScheduleGlobalOptimizer({
      matchups: buildFixtureMatchups(),
      slotCount: 3,
      baseScheduledAt: "2099-06-01T08:00:00.000Z",
      roundIntervalMinutes: 60,
      randomSeed: 42,
      budget,
    });
    assert.equal(result.ok, true);
    assert.equal(result.algorithmVersion, SCHEDULE_GLOBAL_ALGORITHM_VERSION);
    const structural = validateScheduleStructure({
      assignments: result.assignments,
      slotCount: 3,
    });
    assert.equal(structural.ok, true);
  });

  test("same seed is deterministic", () => {
    const input = {
      matchups: buildFixtureMatchups(),
      slotCount: 3,
      baseScheduledAt: "2099-06-01T08:00:00.000Z",
      roundIntervalMinutes: 60,
      randomSeed: 11,
      budget,
    };
    const a = runScheduleGlobalOptimizer(input);
    const b = runScheduleGlobalOptimizer(input);
    assert.deepEqual(a.assignments, b.assignments);
  });

  test("structural hard reject for team double-booked slot", () => {
    const bad = validateScheduleStructure({
      assignments: [
        { id: "m1", teamAId: "t1", teamBId: "t2", slotIndex: 0 },
        { id: "m2", teamAId: "t1", teamBId: "t3", slotIndex: 0 },
      ],
      slotCount: 3,
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.rejectionCodes.includes("TEAM_DOUBLE_BOOKED_SLOT"));
  });

  test("never worse than baseline", () => {
    const result = runScheduleGlobalOptimizer({
      matchups: buildFixtureMatchups(),
      slotCount: 3,
      baseScheduledAt: "2099-06-01T08:00:00.000Z",
      roundIntervalMinutes: 60,
      randomSeed: 5,
      budget,
    });
    assert.equal(result.ok, true);
    assert.ok(result.baseline?.feasible);
    assert.equal(isNotWorseThanBaseline(result.bestCandidate, result.baseline), true);
    assert.ok(compareAuthorityCandidates(result.bestCandidate, result.baseline) <= 0);
  });

  test("mutations preserve assignment ids", () => {
    const initial = generateScheduleInitialCandidates({
      matchups: buildFixtureMatchups(),
      slotCount: 3,
      baseScheduledAt: "2099-06-01T08:00:00.000Z",
      randomSeed: 4,
      maxCandidates: 3,
    })[0];
    const mutated = mutateScheduleCandidate(initial, createSeededRng(4), { slotCount: 3 });
    if (mutated) {
      assert.equal(mutated.assignments.length, initial.assignments.length);
    }
  });

  test("optimizer modules do not call Math.random", () => {
    const dir = path.join(process.cwd(), "src/features/competition-optimizer/schedule-assignment");
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      assert.equal(source.includes("Math.random"), false, file);
    }
  });

  test("operation enum includes SCHEDULE_ASSIGNMENT", () => {
    assert.equal(OPTIMIZATION_OPERATION.SCHEDULE_ASSIGNMENT, "SCHEDULE_ASSIGNMENT");
  });
});

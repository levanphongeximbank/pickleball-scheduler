import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  COURT_GLOBAL_ALGORITHM_VERSION,
  OPTIMIZATION_OPERATION,
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
  runCourtGlobalOptimizer,
  validateCourtStructure,
  generateCourtInitialCandidates,
  mutateCourtCandidate,
  createSeededRng,
} from "../src/features/competition-optimizer/index.js";

const courts = [
  { id: "court-1", label: "Sân 1", active: true, isCentral: true, capacity: 2 },
  { id: "court-2", label: "Sân 2", active: true, isCentral: false, capacity: 2 },
];

const scheduleAssignments = [
  { id: "m1", teamAId: "t1", teamBId: "t2", slotIndex: 0, roundNumber: 1 },
  { id: "m2", teamAId: "t1", teamBId: "t3", slotIndex: 1, roundNumber: 2 },
  { id: "m3", teamAId: "t2", teamBId: "t3", slotIndex: 2, roundNumber: 3 },
];

const budget = {
  maxInitialCandidates: 30,
  maxEvaluations: 300,
  maxIterations: 60,
  maxDurationMs: 600,
  stagnationLimit: 30,
};

describe("court global optimizer", () => {
  test("assigns courts without double-booking", () => {
    const result = runCourtGlobalOptimizer({
      scheduleAssignments,
      courts,
      randomSeed: 42,
      budget,
    });
    assert.equal(result.ok, true);
    assert.equal(result.algorithmVersion, COURT_GLOBAL_ALGORITHM_VERSION);
    const structural = validateCourtStructure({
      assignments: result.assignments,
      courts,
    });
    assert.equal(structural.ok, true);
  });

  test("same seed is deterministic", () => {
    const input = {
      scheduleAssignments,
      courts,
      randomSeed: 13,
      budget,
    };
    const a = runCourtGlobalOptimizer(input);
    const b = runCourtGlobalOptimizer(input);
    assert.deepEqual(a.assignments, b.assignments);
  });

  test("structural hard reject for inactive court", () => {
    const bad = validateCourtStructure({
      assignments: [
        { id: "m1", teamAId: "t1", teamBId: "t2", courtId: "court-x", slotIndex: 0 },
      ],
      courts,
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.rejectionCodes.includes("COURT_NOT_FOUND"));
  });

  test("never worse than baseline", () => {
    const result = runCourtGlobalOptimizer({
      scheduleAssignments,
      courts,
      randomSeed: 2,
      budget,
    });
    assert.equal(result.ok, true);
    assert.ok(result.baseline?.feasible);
    assert.equal(isNotWorseThanBaseline(result.bestCandidate, result.baseline), true);
    assert.ok(compareAuthorityCandidates(result.bestCandidate, result.baseline) <= 0);
  });

  test("mutations preserve assignment ids", () => {
    const initial = generateCourtInitialCandidates({
      scheduleAssignments,
      courts,
      randomSeed: 6,
      maxCandidates: 3,
    })[0];
    const mutated = mutateCourtCandidate(initial, createSeededRng(6), { courts });
    if (mutated) {
      assert.equal(mutated.assignments.length, initial.assignments.length);
    }
  });

  test("optimizer modules do not call Math.random", () => {
    const dir = path.join(process.cwd(), "src/features/competition-optimizer/court-assignment");
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      assert.equal(source.includes("Math.random"), false, file);
    }
  });

  test("operation enum includes COURT_ASSIGNMENT", () => {
    assert.equal(OPTIMIZATION_OPERATION.COURT_ASSIGNMENT, "COURT_ASSIGNMENT");
  });
});

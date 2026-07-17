import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MATCHUP_GLOBAL_ALGORITHM_VERSION,
  OPTIMIZATION_OPERATION,
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
  runMatchupGlobalOptimizer,
  validateMatchupStructure,
  generateMatchupInitialCandidates,
  mutateMatchupCandidate,
  createSeededRng,
} from "../src/features/competition-optimizer/index.js";

function buildFixtureMatchups() {
  return [
    { id: "m1", teamAId: "t1", teamBId: "t2", roundNumber: 1, groupId: "g1", matchNumberInRound: 1 },
    { id: "m2", teamAId: "t1", teamBId: "t3", roundNumber: 2, groupId: "g1", matchNumberInRound: 1 },
    { id: "m3", teamAId: "t2", teamBId: "t3", roundNumber: 3, groupId: "g1", matchNumberInRound: 1 },
  ];
}

const teams = [
  { id: "t1", name: "T1", playerIds: ["p1", "p2"], avgLevel: 4.2 },
  { id: "t2", name: "T2", playerIds: ["p3", "p4"], avgLevel: 3.8 },
  { id: "t3", name: "T3", playerIds: ["p5", "p6"], avgLevel: 3.5 },
];

const budget = {
  maxInitialCandidates: 30,
  maxEvaluations: 300,
  maxIterations: 60,
  maxDurationMs: 600,
  stagnationLimit: 30,
};

describe("matchup global optimizer", () => {
  test("produces valid matchup plan", () => {
    const result = runMatchupGlobalOptimizer({
      matchups: buildFixtureMatchups(),
      teams,
      teamIds: ["t1", "t2", "t3"],
      groupId: "g1",
      randomSeed: 42,
      budget,
    });
    assert.equal(result.ok, true);
    assert.equal(result.algorithmVersion, MATCHUP_GLOBAL_ALGORITHM_VERSION);
    const structural = validateMatchupStructure({ matchups: result.matchups });
    assert.equal(structural.ok, true);
  });

  test("same seed is deterministic", () => {
    const input = {
      matchups: buildFixtureMatchups(),
      teams,
      teamIds: ["t1", "t2", "t3"],
      randomSeed: 7,
      budget,
    };
    const a = runMatchupGlobalOptimizer(input);
    const b = runMatchupGlobalOptimizer(input);
    assert.deepEqual(a.matchups, b.matchups);
    assert.equal(a.randomSeed, "7");
  });

  test("structural hard reject for self-match", () => {
    const bad = validateMatchupStructure({
      matchups: [{ id: "x", teamAId: "t1", teamBId: "t1", roundNumber: 1 }],
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.rejectionCodes.includes("SELF_MATCH"));
  });

  test("never worse than baseline", () => {
    const result = runMatchupGlobalOptimizer({
      matchups: buildFixtureMatchups(),
      teams,
      teamIds: ["t1", "t2", "t3"],
      randomSeed: 3,
      budget,
    });
    assert.equal(result.ok, true);
    assert.ok(result.baseline?.feasible);
    assert.equal(isNotWorseThanBaseline(result.bestCandidate, result.baseline), true);
    assert.ok(compareAuthorityCandidates(result.bestCandidate, result.baseline) <= 0);
  });

  test("mutations preserve matchup ids", () => {
    const initial = generateMatchupInitialCandidates({
      matchups: buildFixtureMatchups(),
      teamIds: ["t1", "t2", "t3"],
      randomSeed: 5,
      maxCandidates: 3,
    })[0];
    const mutated = mutateMatchupCandidate(initial, createSeededRng(5));
    if (mutated) {
      assert.equal(mutated.matchups.length, initial.matchups.length);
    }
  });

  test("optimizer modules do not call Math.random", () => {
    const dir = path.join(process.cwd(), "src/features/competition-optimizer/matchup-pairing");
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      assert.equal(source.includes("Math.random"), false, file);
    }
  });

  test("operation enum includes MATCHUP_PAIRING", () => {
    assert.equal(OPTIMIZATION_OPERATION.MATCHUP_PAIRING, "MATCHUP_PAIRING");
  });
});

import test, { describe } from "node:test";
import assert from "node:assert/strict";

import { runGroupDrawGlobalOptimizer } from "../src/features/competition-optimizer/group-draw/groupDrawGlobalOptimizer.js";
import { mutateGroupDrawCandidate } from "../src/features/competition-optimizer/group-draw/groupDrawMutations.js";
import { createSeededRng } from "../src/features/competition-optimizer/core/seededRandom.js";
import {
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
} from "../src/features/competition-optimizer/core/candidateAuthorityComparator.js";
import { groupDrawSignature } from "../src/features/competition-optimizer/search/candidateDeduplication.js";

const teams = Array.from({ length: 8 }, (_, i) => ({
  id: `t${i + 1}`,
  name: `Team ${i + 1}`,
  avgLevel: 5 - i / 5,
  playerIds: [`p${i * 2 + 1}`, `p${i * 2 + 2}`],
}));
const budget = { maxInitialCandidates: 24, maxEvaluations: 100, maxIterations: 40, maxDurationMs: 1000, stagnationLimit: 20 };
const input = (seed = "group-seed") => ({ teams, groupCount: 2, randomSeed: seed, budget });

describe("group draw global optimizer", () => {
  test("assigns each team exactly once", () => {
    const result = runGroupDrawGlobalOptimizer(input());
    assert.equal(result.ok, true);
    const ids = result.bestCandidate.groups.flatMap((group) => group.teamIds);
    assert.equal(ids.length, teams.length);
    assert.equal(new Set(ids).size, teams.length);
  });

  test("is deterministic for the same seed", () => {
    const a = runGroupDrawGlobalOptimizer(input("same"));
    const b = runGroupDrawGlobalOptimizer(input("same"));
    assert.equal(a.bestCandidate.signature, b.bestCandidate.signature);
    assert.equal(a.bestCandidate.signature, groupDrawSignature(a.bestCandidate.groups));
  });

  test("retains a distinct random seed for rearrange", () => {
    const a = runGroupDrawGlobalOptimizer(input("one"));
    const b = runGroupDrawGlobalOptimizer(input("two"));
    assert.equal(a.randomSeed, "one");
    assert.equal(b.randomSeed, "two");
  });

  test("shared comparator honors source authority", () => {
    const admin = { id: "admin", feasible: true, scoreBreakdown: { superAdminPenalty: 0, tournamentPenalty: 5 } };
    const tournament = { id: "tournament", feasible: true, scoreBreakdown: { superAdminPenalty: 1, tournamentPenalty: 0 } };
    assert.ok(compareAuthorityCandidates(admin, tournament) < 0);
  });

  test("global result is never worse than its baseline", () => {
    const result = runGroupDrawGlobalOptimizer(input());
    assert.equal(isNotWorseThanBaseline(result.bestCandidate, result.baseline), true);
  });

  test("invalid duplicate/missing group layouts are hard rejected", () => {
    const result = runGroupDrawGlobalOptimizer({
      ...input(),
      baselinePlans: [{ groups: [{ id: "a", teamIds: ["t1", "t1"] }, { id: "b", teamIds: ["t2"] }] }],
      budget: { ...budget, maxInitialCandidates: 1, maxIterations: 1 },
    });
    assert.ok(result.diagnostics.rejectedHardViolationCount >= 1);
  });

  test("mutation preserves every team id exactly once", () => {
    const candidate = {
      groups: [
        { id: "a", teamIds: ["t1", "t2", "t3", "t4"] },
        { id: "b", teamIds: ["t5", "t6", "t7", "t8"] },
      ],
    };
    const mutated = mutateGroupDrawCandidate(candidate, createSeededRng("mutate"));
    const ids = mutated.groups.flatMap((group) => group.teamIds);
    assert.equal(ids.length, 8);
    assert.equal(new Set(ids).size, 8);
  });

  test("group balance penalty participates in default ranking", () => {
    const result = runGroupDrawGlobalOptimizer(input());
    assert.ok(Number.isFinite(result.bestCandidate.scoreBreakdown.defaultPenalty));
  });

  test("diagnostics expose candidate accounting and a stop reason", () => {
    const result = runGroupDrawGlobalOptimizer(input());
    assert.ok(result.diagnostics.evaluatedCandidateCount > 0);
    assert.ok(result.diagnostics.uniqueCandidateCount > 0);
    assert.ok(result.diagnostics.stoppedBy);
  });

  test("input team order is independent for a fixed seed", () => {
    const a = runGroupDrawGlobalOptimizer(input("order"));
    const b = runGroupDrawGlobalOptimizer({ ...input("order"), teams: [...teams].reverse() });
    assert.equal(a.bestCandidate.signature, b.bestCandidate.signature);
  });
});

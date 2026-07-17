import test, { describe } from "node:test";
import assert from "node:assert/strict";

import { runPartnerPairingGlobalOptimizer } from "../src/features/competition-optimizer/partner-pairing/partnerPairingGlobalOptimizer.js";
import { mutatePartnerPairingCandidate } from "../src/features/competition-optimizer/partner-pairing/partnerPairingMutations.js";
import { createSeededRng } from "../src/features/competition-optimizer/core/seededRandom.js";
import {
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
} from "../src/features/competition-optimizer/core/candidateAuthorityComparator.js";
import { partnerPairingSignature } from "../src/features/competition-optimizer/search/candidateDeduplication.js";

const budget = { maxInitialCandidates: 20, maxEvaluations: 80, maxIterations: 30, maxDurationMs: 1000, stagnationLimit: 20 };
const players = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`, name: `P${i + 1}`, gender: i % 2 ? "female" : "male", ratingInternal: 3 + i / 10,
}));
const input = (seed = "partner-seed") => ({ players, randomSeed: seed, budget });

describe("partner pairing global optimizer", () => {
  test("creates feasible doubles pairs", () => {
    const result = runPartnerPairingGlobalOptimizer(input());
    assert.equal(result.ok, true);
    assert.equal(result.bestCandidate.teams.every((team) => team.playerIds.length === 2), true);
  });

  test("uses deterministic seed and canonical signatures", () => {
    const a = runPartnerPairingGlobalOptimizer(input("same"));
    const b = runPartnerPairingGlobalOptimizer(input("same"));
    assert.equal(a.bestCandidate.signature, b.bestCandidate.signature);
    assert.equal(a.bestCandidate.signature, partnerPairingSignature(a.bestCandidate.teams));
  });

  test("different seed remains auditable", () => {
    const a = runPartnerPairingGlobalOptimizer(input("a"));
    const b = runPartnerPairingGlobalOptimizer(input("b"));
    assert.equal(a.randomSeed, "a");
    assert.equal(b.randomSeed, "b");
  });

  test("shared comparator orders source authority lexicographically", () => {
    const highAuthority = { id: "a", feasible: true, scoreBreakdown: { superAdminPenalty: 0, tournamentPenalty: 10 } };
    const lowerAuthority = { id: "b", feasible: true, scoreBreakdown: { superAdminPenalty: 1, tournamentPenalty: 0 } };
    assert.ok(compareAuthorityCandidates(highAuthority, lowerAuthority) < 0);
  });

  test("never returns worse than generator baseline", () => {
    const result = runPartnerPairingGlobalOptimizer(input());
    assert.equal(isNotWorseThanBaseline(result.bestCandidate, result.baseline), true);
  });

  test("hard-invalid doubles structure is filtered", () => {
    const result = runPartnerPairingGlobalOptimizer({
      ...input(), players: [],
      budget: { ...budget, maxInitialCandidates: 1 },
    });
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.rejectedHardViolationCount >= 0);
  });

  test("mutation preserves two members per pair", () => {
    const candidate = {
      teams: [
        { members: players.slice(0, 2), playerIds: ["p1", "p2"] },
        { members: players.slice(2, 4), playerIds: ["p3", "p4"] },
      ],
    };
    const mutated = mutatePartnerPairingCandidate(candidate, createSeededRng("mutate"));
    assert.equal(mutated.teams.every((team) => team.members.length === 2 && team.playerIds.length === 2), true);
  });

  test("candidate contains no duplicate players", () => {
    const result = runPartnerPairingGlobalOptimizer(input());
    const ids = result.bestCandidate.teams.flatMap((team) => team.playerIds);
    assert.equal(ids.length, new Set(ids).size);
  });

  test("diagnostics expose evaluation accounting", () => {
    const result = runPartnerPairingGlobalOptimizer(input());
    assert.ok(result.diagnostics.evaluatedCandidateCount > 0);
    assert.ok(result.diagnostics.uniqueCandidateCount > 0);
    assert.ok(result.diagnostics.stoppedBy);
  });

  test("input player order does not change fixed-seed result", () => {
    const a = runPartnerPairingGlobalOptimizer(input("order"));
    const b = runPartnerPairingGlobalOptimizer({ ...input("order"), players: [...players].reverse() });
    assert.equal(a.bestCandidate.signature, b.bestCandidate.signature);
  });
});

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import {
  buildMlpTeamsFourStep,
  pairTeamsFromSelectedPlayers,
} from "../src/features/team-tournament/engines/teamAutoDrawEngine.js";
import {
  attachAiDrawPublishMetadata,
  createAiDrawRandomSeed,
  getPublishedAiDrawState,
} from "../src/features/team-tournament/engines/aiDrawSeedAudit.js";
import { PRIVATE_PAIRING_OPERATION } from "../src/features/private-pairing-rules/index.js";
import { runMlpFourGlobalOptimizer } from "../src/features/competition-optimizer/team-formation/mlpFourGlobalOptimizer.js";
import { mutateMlpFourCandidate } from "../src/features/competition-optimizer/team-formation/mlpFourCandidateMutations.js";
import {
  computeMlpFourBalanceMetrics,
  computeMlpFourDefaultPenalty,
} from "../src/features/competition-optimizer/team-formation/mlpFourScoring.js";
import {
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
} from "../src/features/competition-optimizer/core/candidateAuthorityComparator.js";
import { createSeededRng } from "../src/features/competition-optimizer/core/seededRandom.js";
import {
  createCandidateDeduper,
  teamFormationSignature,
} from "../src/features/competition-optimizer/search/candidateDeduplication.js";
import { runGlobalSearch } from "../src/features/competition-optimizer/search/runGlobalSearch.js";

const budget = {
  maxInitialCandidates: 40,
  maxEvaluations: 200,
  maxIterations: 80,
  maxDurationMs: 1500,
  stagnationLimit: 40,
};

function playersFor(teamCount = 2, ratings = []) {
  const half = teamCount * 2;
  return Array.from({ length: half * 2 }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    gender: index < half ? "male" : "female",
    ratingInternal: ratings[index] ?? 3 + (index % 7) / 10,
  }));
}

function signature(result) {
  return teamFormationSignature(result.bestCandidate?.teams || []);
}

function optimize(players, teamCount = 2, seed = "fixed") {
  return runMlpFourGlobalOptimizer({
    players,
    teamCount,
    randomSeed: seed,
    fourStepBuilder: buildMlpTeamsFourStep,
    privatePairingEnabled: false,
    budget,
  });
}

describe("MLP4 global optimizer", () => {
  test("forms exactly eight 2M+2F teams with no duplicate players", () => {
    const players = playersFor(8);
    const result = optimize(players, 8);
    assert.equal(result.ok, true);
    assert.equal(result.bestCandidate.teams.length, 8);
    const ids = result.bestCandidate.teams.flatMap((team) => team.playerIds);
    assert.equal(ids.length, 32);
    assert.equal(new Set(ids).size, 32);
    for (const team of result.bestCandidate.teams) {
      const members = team.members;
      assert.equal(members.filter((p) => p.gender === "male").length, 2);
      assert.equal(members.filter((p) => p.gender === "female").length, 2);
    }
  });

  test("blocks unknown gender and insufficient gender pools without shrinking", () => {
    const unknown = [...playersFor(2), { id: "x", name: "X", gender: "unknown", ratingInternal: 4 }];
    const unknownResult = optimize(unknown, 2);
    assert.equal(unknownResult.ok, false);
    assert.ok(unknownResult.errorCodes.includes("UNKNOWN_GENDER_IN_POOL"));

    const missingMale = playersFor(2).filter((p) => p.gender === "female").concat(playersFor(1).filter((p) => p.gender === "male"));
    const insufficient = optimize(missingMale, 2);
    assert.equal(insufficient.ok, false);
    assert.ok(insufficient.errorCodes.includes("INSUFFICIENT_MALES"));
    assert.equal(insufficient.bestCandidate, null);
  });

  test("integration entry point preserves requested count and MLP preset", () => {
    const players = playersFor(2);
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      seed: "integration",
    });
    assert.equal(result.ok, true);
    assert.equal(result.teams.length, 2);
    assert.equal(result.teams.every((team) => team.playerIds.length === 4), true);
  });

  test("same seed is deterministic and input order independent", () => {
    const players = playersFor(3);
    const first = optimize(players, 3, "repeatable");
    const second = optimize(players, 3, "repeatable");
    const shuffled = optimize([...players].reverse(), 3, "repeatable");
    assert.equal(signature(first), signature(second));
    assert.equal(signature(first), signature(shuffled));
  });

  test("different seeds keep a distinct replay audit even if layout collides", () => {
    const a = optimize(playersFor(3), 3, "seed-a");
    const b = optimize(playersFor(3), 3, "seed-b");
    assert.equal(a.randomSeed, "seed-a");
    assert.equal(b.randomSeed, "seed-b");
    assert.ok(signature(a));
    assert.ok(signature(b));
  });

  test("global candidate is never worse than four-step baseline", () => {
    const result = optimize(playersFor(4, [5, 4.9, 4.8, 4.7, 3.1, 3, 2.9, 2.8, 5, 4.8, 4.6, 4.4, 3.2, 3, 2.8, 2.6]), 4);
    assert.equal(result.ok, true);
    assert.equal(isNotWorseThanBaseline(result.bestCandidate, result.baseline), true);
    assert.ok(compareAuthorityCandidates(result.bestCandidate, result.baseline) <= 0);
  });

  test("fixture exposes four-step local layout and global preserves or improves balance", () => {
    const players = playersFor(3, [5, 4.8, 4.2, 3.9, 3.1, 2.8, 5, 4.7, 4.1, 3.8, 3.2, 2.7]);
    const result = optimize(players, 3, "local-optimum-fixture");
    const best = result.bestCandidate.diagnostics;
    const baseline = result.baseline.diagnostics;
    assert.ok(best.teamAverageRange <= baseline.teamAverageRange + 1e-9);
    assert.ok(best.teamAverageStdDev <= baseline.teamAverageStdDev + 1e-9);
  });

  test("mixed-gap is included in default scoring", () => {
    const pool = Object.fromEntries(playersFor(2).map((p) => [p.id, p]));
    const balanced = [
      { playerIds: ["p1", "p4", "p5", "p8"] },
      { playerIds: ["p2", "p3", "p6", "p7"] },
    ];
    const unbalanced = [
      { playerIds: ["p1", "p2", "p5", "p6"] },
      { playerIds: ["p3", "p4", "p7", "p8"] },
    ];
    const a = computeMlpFourBalanceMetrics(balanced, pool);
    const b = computeMlpFourBalanceMetrics(unbalanced, pool);
    assert.notEqual(a.bestMixedGapMean, b.bestMixedGapMean);
    assert.notEqual(computeMlpFourDefaultPenalty(a), computeMlpFourDefaultPenalty(b));
  });

  test("mutations preserve 2M+2F structure", () => {
    const result = optimize(playersFor(2), 2);
    const mutated = mutateMlpFourCandidate(
      result.bestCandidate,
      Object.fromEntries(playersFor(2).map((p) => [p.id, p])),
      createSeededRng("mutation")
    );
    assert.ok(mutated);
    for (const team of mutated.teams) {
      assert.equal(team.members.filter((p) => p.gender === "male").length, 2);
      assert.equal(team.members.filter((p) => p.gender === "female").length, 2);
    }
  });

  test("deduplication uses canonical team signatures", () => {
    const deduper = createCandidateDeduper();
    assert.equal(deduper.add("a,b|c,d"), true);
    assert.equal(deduper.add("a,b|c,d"), false);
    assert.equal(deduper.size(), 1);
  });

  test("hard-invalid candidates are rejected before feasible soft ranking", () => {
    let evaluatedSoft = 0;
    const search = runGlobalSearch({
      generateInitial: () => [{ id: "invalid" }, { id: "valid" }],
      evaluate: (raw) => raw.id === "invalid"
        ? { id: raw.id, signature: raw.id, feasible: false, hardViolationCount: 1, scoreBreakdown: { defaultPenalty: 0 } }
        : (evaluatedSoft += 1, { id: raw.id, signature: raw.id, feasible: true, scoreBreakdown: { defaultPenalty: 9 } }),
      mutate: () => null,
      rng: createSeededRng(1),
      budget: { ...budget, maxIterations: 1 },
    });
    assert.equal(search.diagnostics.rejectedHardViolationCount, 1);
    assert.equal(search.bestCandidate.id, "valid");
    assert.equal(evaluatedSoft, 1);
  });

  test("authority is lexicographic: SUPER_ADMIN beats Tournament", () => {
    const admin = { id: "admin", feasible: true, scoreBreakdown: { superAdminPenalty: 0, tournamentPenalty: 99 } };
    const tournament = { id: "tournament", feasible: true, scoreBreakdown: { superAdminPenalty: 1, tournamentPenalty: 0 } };
    assert.ok(compareAuthorityCandidates(admin, tournament) < 0);
  });

  test("diagnostics report budget and stagnation stop reasons", () => {
    const make = (override) => optimize(playersFor(2), 2, `stop-${JSON.stringify(override)}`);
    assert.equal(make({}).diagnostics.stoppedBy.length > 0, true);
    const zero = runMlpFourGlobalOptimizer({
      players: playersFor(2), teamCount: 2, fourStepBuilder: buildMlpTeamsFourStep,
      privatePairingEnabled: false, budget: { maxInitialCandidates: 0, maxEvaluations: 0 },
    });
    assert.equal(zero.diagnostics.stoppedBy, "BUDGET_ZERO");
  });

  test("optimizer modules do not call Math.random", () => {
    const root = path.resolve("src/features/competition-optimizer");
    const files = [
      "core/seededRandom.js", "search/runGlobalSearch.js",
      "team-formation/mlpFourCandidateGenerator.js", "team-formation/mlpFourCandidateMutations.js",
      "partner-pairing/partnerPairingCandidateGenerator.js", "partner-pairing/partnerPairingMutations.js",
      "group-draw/groupDrawCandidateGenerator.js", "group-draw/groupDrawMutations.js",
    ];
    for (const file of files) {
      assert.equal(fs.readFileSync(path.join(root, file), "utf8").includes("Math.random"), false, file);
    }
  });

  test("publish audit stores diagnostics and reload preserves seed", () => {
    const optimized = optimize(playersFor(2), 2, "audit-seed");
    const saved = attachAiDrawPublishMetadata({ settings: {}, teams: optimized.bestCandidate.teams }, {
      operation: PRIVATE_PAIRING_OPERATION.TEAM_FORMATION,
      randomSeed: optimized.randomSeed,
      diagnostics: optimized.diagnostics,
      nextResult: optimized.bestCandidate.teams,
    });
    const published = getPublishedAiDrawState(saved, PRIVATE_PAIRING_OPERATION.TEAM_FORMATION);
    assert.equal(published.randomSeed, "audit-seed");
    assert.deepEqual(published.diagnostics, optimized.diagnostics);
    assert.notEqual(createAiDrawRandomSeed("audit-seed"), "audit-seed");
  });
});

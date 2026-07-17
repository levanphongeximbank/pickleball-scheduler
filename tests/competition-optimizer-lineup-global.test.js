import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  LINEUP_GLOBAL_ALGORITHM_VERSION,
  OPTIMIZATION_OPERATION,
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
  runLineupGlobalOptimizer,
  validateLineupStructure,
  generateLineupInitialCandidates,
  mutateLineupCandidate,
  createSeededRng,
} from "../src/features/competition-optimizer/index.js";
import { randomizeMissingLineups } from "../src/features/team-tournament/engines/lineupRandomEngine.js";
import {
  GENDER_REQUIREMENT,
  FORMAT_PRESET,
  MISSING_LINEUP_POLICY,
  LINEUP_STATUS,
} from "../src/features/team-tournament/constants.js";
import { normalizeTeamData } from "../src/features/team-tournament/models/index.js";

function buildFixture() {
  const disciplines = [
    {
      id: "d-md",
      name: "Đôi nam",
      playerCount: 2,
      genderRequirement: GENDER_REQUIREMENT.MALE,
    },
    {
      id: "d-wd",
      name: "Đôi nữ",
      playerCount: 2,
      genderRequirement: GENDER_REQUIREMENT.FEMALE,
    },
    {
      id: "d-xd",
      name: "Mix",
      playerCount: 2,
      genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR,
    },
  ];
  const players = [
    { id: "m1", name: "M1", gender: "male", ratingInternal: 4.8 },
    { id: "m2", name: "M2", gender: "male", ratingInternal: 4.2 },
    { id: "m3", name: "M3", gender: "male", ratingInternal: 3.6 },
    { id: "m4", name: "M4", gender: "male", ratingInternal: 3.1 },
    { id: "f1", name: "F1", gender: "female", ratingInternal: 4.7 },
    { id: "f2", name: "F2", gender: "female", ratingInternal: 4.1 },
    { id: "f3", name: "F3", gender: "female", ratingInternal: 3.5 },
    { id: "f4", name: "F4", gender: "female", ratingInternal: 3.0 },
  ];
  const team = {
    id: "team-a",
    name: "Team A",
    playerIds: ["m1", "m2", "m3", "m4", "f1", "f2", "f3", "f4"],
  };
  const teamData = normalizeTeamData({
    settings: {
      formatPreset: FORMAT_PRESET.MLP_4,
      missingLineupPolicy: MISSING_LINEUP_POLICY.RANDOM,
      allowPlayerReusePerMatchup: false,
    },
    disciplines,
    teams: [team, { id: "team-b", name: "Team B", playerIds: [] }],
    matchups: [
      {
        id: "mu-1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "LINEUP_OPEN",
        lineupLockAt: new Date(Date.now() - 60_000).toISOString(),
      },
    ],
    lineups: {},
  });
  return { disciplines, players, team, teamData };
}

describe("lineup global optimizer", () => {
  test("forms valid gender/count lineup with no duplicate slots", () => {
    const { team, disciplines, players } = buildFixture();
    const result = runLineupGlobalOptimizer({
      team,
      disciplines,
      players,
      randomSeed: 42,
      budget: {
        maxInitialCandidates: 40,
        maxEvaluations: 400,
        maxIterations: 80,
        maxDurationMs: 800,
        stagnationLimit: 40,
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.algorithmVersion, LINEUP_GLOBAL_ALGORITHM_VERSION);
    const structural = validateLineupStructure({
      selections: result.selections,
      disciplines,
      team,
      playersById: Object.fromEntries(players.map((p) => [p.id, p])),
      allowReuse: false,
    });
    assert.equal(structural.ok, true);
  });

  test("same seed is deterministic; different seed can differ", () => {
    const { team, disciplines, players } = buildFixture();
    const budget = {
      maxInitialCandidates: 30,
      maxEvaluations: 300,
      maxIterations: 60,
      maxDurationMs: 600,
      stagnationLimit: 30,
    };
    const a = runLineupGlobalOptimizer({
      team,
      disciplines,
      players,
      randomSeed: 7,
      budget,
    });
    const b = runLineupGlobalOptimizer({
      team,
      disciplines,
      players,
      randomSeed: 7,
      budget,
    });
    const c = runLineupGlobalOptimizer({
      team,
      disciplines,
      players,
      randomSeed: 99,
      budget,
    });
    assert.deepEqual(a.selections, b.selections);
    assert.equal(a.randomSeed, "7");
    // Different seed may collide on tiny search space; allow either differ or equal.
    assert.ok(c.ok);
  });

  test("input player order does not change fixed-seed result", () => {
    const { team, disciplines, players } = buildFixture();
    const budget = {
      maxInitialCandidates: 24,
      maxEvaluations: 240,
      maxIterations: 50,
      maxDurationMs: 500,
      stagnationLimit: 24,
    };
    const forward = runLineupGlobalOptimizer({
      team,
      disciplines,
      players,
      randomSeed: 11,
      budget,
    });
    const reversed = runLineupGlobalOptimizer({
      team,
      disciplines,
      players: [...players].reverse(),
      randomSeed: 11,
      budget,
    });
    assert.deepEqual(forward.selections, reversed.selections);
  });

  test("hard-invalid gender selection is rejected", () => {
    const { team, disciplines, players } = buildFixture();
    const bad = validateLineupStructure({
      selections: {
        "d-md": ["f1", "f2"],
        "d-wd": ["m1", "m2"],
        "d-xd": ["m3", "f3"],
      },
      disciplines,
      team,
      playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.rejectionCodes.includes("GENDER_MISMATCH"));
  });

  test("global result is never worse than baseline", () => {
    const { team, disciplines, players } = buildFixture();
    const result = runLineupGlobalOptimizer({
      team,
      disciplines,
      players,
      randomSeed: 3,
      budget: {
        maxInitialCandidates: 50,
        maxEvaluations: 500,
        maxIterations: 100,
        maxDurationMs: 900,
        stagnationLimit: 50,
      },
    });
    assert.equal(result.ok, true);
    assert.ok(result.baseline?.feasible);
    assert.equal(isNotWorseThanBaseline(result.bestCandidate, result.baseline), true);
    assert.ok(compareAuthorityCandidates(result.bestCandidate, result.baseline) <= 0);
  });

  test("mutations preserve selection keys", () => {
    const { team, disciplines, players } = buildFixture();
    const initial = generateLineupInitialCandidates({
      team,
      disciplines,
      playersById: Object.fromEntries(players.map((p) => [p.id, p])),
      randomSeed: 5,
      maxCandidates: 5,
    })[0];
    assert.ok(initial);
    const mutated = mutateLineupCandidate(initial, createSeededRng(5), {
      team,
      allowReuse: false,
    });
    if (mutated) {
      assert.deepEqual(Object.keys(mutated.selections).sort(), Object.keys(initial.selections).sort());
    }
  });

  test("optimizer modules do not call Math.random", () => {
    const dir = path.join(
      process.cwd(),
      "src/features/competition-optimizer/lineup-formation"
    );
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      assert.equal(source.includes("Math.random"), false, file);
    }
  });

  test("auto-deadline path uses full lineup global optimizer", () => {
    const { teamData, players } = buildFixture();
    const result = randomizeMissingLineups(teamData, {
      matchupId: "mu-1",
      teamId: "team-a",
      players,
      clubId: "club-1",
      tournamentId: "t-1",
      randomSeed: "seed-lineup-1",
      budget: {
        maxInitialCandidates: 30,
        maxEvaluations: 300,
        maxIterations: 60,
        maxDurationMs: 600,
        stagnationLimit: 30,
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.algorithmVersion, LINEUP_GLOBAL_ALGORITHM_VERSION);
    assert.equal(result.lineup.status, LINEUP_STATUS.LOCKED);
    const audit =
      result.teamData.settings.competitionOptimizationAudit.byOperation
        .LINEUP_FORMATION;
    assert.equal(audit.algorithmVersion, LINEUP_GLOBAL_ALGORITHM_VERSION);
    assert.ok((audit.diagnostics?.evaluatedCandidateCount || 0) >= 1);
  });

  test("operation enum includes LINEUP_FORMATION", () => {
    assert.equal(OPTIMIZATION_OPERATION.LINEUP_FORMATION, "LINEUP_FORMATION");
  });
});

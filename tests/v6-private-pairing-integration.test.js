import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  PRIVATE_PAIRING_OPERATION,
  derivePrivatePairingOperations,
  ruleMatchesOperation,
  resolveActivePrivatePairingRules,
  normalizePrivatePairingRule,
  buildScoreBreakdown,
  compareOptimizationCandidates,
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_SCOPE,
  RELATION_MODE,
  RULE_PRIORITY,
} from "../src/features/private-pairing-rules/index.js";
import {
  buildV6PrivatePairingResolveContext,
  resolveV6PrivatePairing,
  createV6SeededRng,
  mintV6OptimizationSeed,
  attachV6CompetitionOptimizationAudit,
  snapshotLineupSelections,
  V6_OPTIMIZATION_ACTION,
} from "../src/features/team-tournament/private-pairing/index.js";
import { randomizeMissingLineups } from "../src/features/team-tournament/engines/lineupRandomEngine.js";
import {
  lockMatchupLineups,
  publishMatchupLineups,
  submitLineup,
} from "../src/features/team-tournament/engines/lineupEngine.js";
import { assignSeedsWithPrivatePairing } from "../src/features/team-tournament/engines/teamGroupSeedEngine.js";
import {
  LINEUP_STATUS,
  LINEUP_SOURCE,
  GENDER_REQUIREMENT,
  MISSING_LINEUP_POLICY,
  FORMAT_PRESET,
} from "../src/features/team-tournament/constants.js";
import { normalizeTeamData } from "../src/features/team-tournament/models/index.js";

function makeRule(overrides = {}) {
  return normalizePrivatePairingRule({
    id: overrides.id || "rule-1",
    constraintType:
      overrides.constraintType || PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER,
    relationMode: overrides.relationMode || RELATION_MODE.HARD,
    scopeType: overrides.scopeType || PRIVATE_PAIRING_SCOPE.TOURNAMENT,
    scopeId: overrides.scopeId || "t1",
    priority: overrides.priority || RULE_PRIORITY.HIGH,
    primaryAthleteId: overrides.primaryAthleteId || "p1",
    targetAthleteIds: overrides.targetAthleteIds || ["p2"],
    operations: overrides.operations,
    enabled: true,
    ...overrides,
  });
}

function buildMlpTeamData() {
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
    { id: "m1", name: "M1", gender: "male", ratingInternal: 4.5 },
    { id: "m2", name: "M2", gender: "male", ratingInternal: 4.0 },
    { id: "m3", name: "M3", gender: "male", ratingInternal: 3.5 },
    { id: "m4", name: "M4", gender: "male", ratingInternal: 3.0 },
    { id: "f1", name: "F1", gender: "female", ratingInternal: 4.4 },
    { id: "f2", name: "F2", gender: "female", ratingInternal: 3.9 },
    { id: "f3", name: "F3", gender: "female", ratingInternal: 3.4 },
    { id: "f4", name: "F4", gender: "female", ratingInternal: 3.1 },
  ];

  const teamData = normalizeTeamData({
    settings: {
      formatPreset: FORMAT_PRESET.MLP_4,
      missingLineupPolicy: MISSING_LINEUP_POLICY.RANDOM,
      allowPlayerReusePerMatchup: false,
    },
    disciplines,
    teams: [
      {
        id: "team-a",
        name: "Team A",
        playerIds: ["m1", "m2", "f1", "f2"],
      },
      {
        id: "team-b",
        name: "Team B",
        playerIds: ["m3", "m4", "f3", "f4"],
      },
    ],
    matchups: [
      {
        id: "mu-1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "LINEUP_OPEN",
        lineupLockAt: new Date(Date.now() - 60_000).toISOString(),
        scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    ],
    lineups: {},
  });

  return { teamData, players };
}

describe("V6 private pairing operations", () => {
  test("exposes V6 operations on shared PRIVATE_PAIRING_OPERATION", () => {
    assert.equal(PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION, "LINEUP_FORMATION");
    assert.equal(PRIVATE_PAIRING_OPERATION.MATCHUP_PAIRING, "MATCHUP_PAIRING");
    assert.equal(PRIVATE_PAIRING_OPERATION.SCHEDULE_ASSIGNMENT, "SCHEDULE_ASSIGNMENT");
    assert.equal(PRIVATE_PAIRING_OPERATION.COURT_ASSIGNMENT, "COURT_ASSIGNMENT");
    assert.equal(PRIVATE_PAIRING_OPERATION.SEED_ASSIGNMENT, "SEED_ASSIGNMENT");
  });

  test("partner constraint derives TEAM_FORMATION and LINEUP_FORMATION", () => {
    const ops = derivePrivatePairingOperations(
      PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER
    );
    assert.ok(ops.includes(PRIVATE_PAIRING_OPERATION.TEAM_FORMATION));
    assert.ok(ops.includes(PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION));
  });

  test("opponent constraint derives MATCHUP_PAIRING", () => {
    const ops = derivePrivatePairingOperations(
      PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT
    );
    assert.ok(ops.includes(PRIVATE_PAIRING_OPERATION.MATCHUP_PAIRING));
  });

  test("WRONG_OPERATION ignores group rule for LINEUP_FORMATION", () => {
    const rule = makeRule({
      id: "g1",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
      primaryAthleteId: "m1",
      targetAthleteIds: ["m2"],
    });
    assert.equal(
      ruleMatchesOperation(rule, PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION),
      false
    );

    const resolved = resolveActivePrivatePairingRules({
      rules: [rule],
      context: buildV6PrivatePairingResolveContext({
        tournamentId: "t1",
        operation: PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION,
      }),
    });
    assert.ok(
      (resolved.ignoredRules || []).some(
        (item) =>
          item.ruleId === "g1" && item.reason === "WRONG_OPERATION"
      )
    );
  });

  test("ALL operation matches any rule", () => {
    const rule = makeRule();
    assert.equal(ruleMatchesOperation(rule, PRIVATE_PAIRING_OPERATION.ALL), true);
  });
});

describe("V6 adapter + score breakdown", () => {
  test("buildV6PrivatePairingResolveContext maps real fields", () => {
    const ctx = buildV6PrivatePairingResolveContext({
      tournamentId: "tour-1",
      clubId: "club-1",
      teamId: "team-a",
      matchupId: "mu-1",
      operation: PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION,
    });
    assert.equal(ctx.tournamentId, "tour-1");
    assert.equal(ctx.matchId, "mu-1");
    assert.equal(ctx.operation, PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION);
  });

  test("v6FormatPenalty participates in lexicographic order before default", () => {
    const a = {
      id: "a",
      feasible: true,
      scoreBreakdown: buildScoreBreakdown({
        v6FormatPenalty: 1,
        defaultPenalty: 0,
      }),
    };
    const b = {
      id: "b",
      feasible: true,
      scoreBreakdown: buildScoreBreakdown({
        v6FormatPenalty: 0,
        defaultPenalty: 100,
      }),
    };
    assert.ok(compareOptimizationCandidates(b, a) < 0);
  });

  test("resolveV6PrivatePairing uses shared resolver", () => {
    const result = resolveV6PrivatePairing({
      operation: PRIVATE_PAIRING_OPERATION.SEED_ASSIGNMENT,
      tournamentId: "t1",
      privatePairingRules: [],
    });
    assert.equal(result.ok, true);
    assert.ok(result.resolved);
  });
});

describe("LINEUP_FORMATION auto-random", () => {
  test("submitLineup rejects private rules without real context", () => {
    const players = [
      { id: "p1", name: "P1", gender: "male" },
      { id: "p2", name: "P2", gender: "male" },
    ];
    const teamData = normalizeTeamData({
      disciplines: [
        {
          id: "d-open",
          name: "Open",
          playerCount: 2,
          genderRequirement: GENDER_REQUIREMENT.ANY,
        },
      ],
      teams: [
        { id: "team-a", name: "Team A", playerIds: ["p1", "p2"] },
        { id: "team-b", name: "Team B", playerIds: [] },
      ],
      matchups: [{ id: "mu-1", teamAId: "team-a", teamBId: "team-b" }],
    });
    const result = submitLineup(teamData, {
      matchupId: "mu-1",
      teamId: "team-a",
      players,
      selections: { "d-open": ["p1", "p2"] },
      privatePairingRules: [makeRule({ primaryAthleteId: "p1", targetAthleteIds: ["p2"] })],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "PRIVATE_PAIRING_CONTEXT_REQUIRED");
  });

  test("auto-random rejects private rules without real context", () => {
    const { teamData, players } = buildMlpTeamData();
    const result = randomizeMissingLineups(teamData, {
      matchupId: "mu-1",
      teamId: "team-a",
      players,
      privatePairingRules: [makeRule({ primaryAthleteId: "m1", targetAthleteIds: ["m2"] })],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "PRIVATE_PAIRING_CONTEXT_REQUIRED");
  });

  test("same seed yields same lineup; different seed can differ", () => {
    const { teamData, players } = buildMlpTeamData();
    const a = randomizeMissingLineups(teamData, {
      matchupId: "mu-1",
      teamId: "team-a",
      players,
      randomSeed: "lineup-seed-fixed",
    });
    const b = randomizeMissingLineups(teamData, {
      matchupId: "mu-1",
      teamId: "team-a",
      players,
      randomSeed: "lineup-seed-fixed",
    });
    assert.equal(a.ok, true);
    assert.deepEqual(a.lineup.selections, b.lineup.selections);
    assert.equal(a.randomSeed, "lineup-seed-fixed");

    const c = randomizeMissingLineups(teamData, {
      matchupId: "mu-1",
      teamId: "team-a",
      players,
      randomSeed: "lineup-seed-other",
    });
    assert.equal(c.ok, true);
    // May or may not differ; still must be deterministic for that seed
    const c2 = randomizeMissingLineups(teamData, {
      matchupId: "mu-1",
      teamId: "team-a",
      players,
      randomSeed: "lineup-seed-other",
    });
    assert.deepEqual(c.lineup.selections, c2.lineup.selections);
  });

  test("auto-random writes competitionOptimizationAudit metadata", () => {
    const { teamData, players } = buildMlpTeamData();
    const result = randomizeMissingLineups(teamData, {
      matchupId: "mu-1",
      teamId: "team-a",
      players,
      randomSeed: "audit-seed",
      actorId: "organizer-1",
    });
    assert.equal(result.ok, true);
    const audit =
      result.teamData.settings.competitionOptimizationAudit.byOperation
        .LINEUP_FORMATION;
    assert.equal(audit.randomSeed, "audit-seed");
    assert.equal(
      result.teamData.settings.competitionOptimizationAudit.last.action,
      V6_OPTIMIZATION_ACTION.AUTO_DEADLINE_GENERATE
    );
    assert.ok(audit.resultSnapshot);
  });

  test("lineupRandomEngine source has no Math.random", () => {
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/features/team-tournament/engines/lineupRandomEngine.js"
      ),
      "utf8"
    );
    assert.equal(file.includes("Math.random"), false);
  });

  test("lockMatchupLineups uses seeded auto-random for missing lineups", () => {
    const { teamData, players } = buildMlpTeamData();
    const locked = lockMatchupLineups(teamData, {
      matchupId: "mu-1",
      players,
      randomSeed: "lock-seed-1",
    });
    assert.equal(locked.ok, true);
    const lineupA = locked.teamData.lineups["mu-1::team-a"];
    const lineupB = locked.teamData.lineups["mu-1::team-b"];
    assert.equal(lineupA?.status, LINEUP_STATUS.LOCKED);
    assert.equal(lineupB?.status, LINEUP_STATUS.LOCKED);
    assert.equal(lineupA?.source, LINEUP_SOURCE.RANDOM);
  });

  test("locked lineup is not changed by publish", () => {
    const { teamData, players } = buildMlpTeamData();
    const locked = lockMatchupLineups(teamData, {
      matchupId: "mu-1",
      players,
      randomSeed: "lock-seed-2",
    });
    const before = snapshotLineupSelections(
      locked.teamData.lineups["mu-1::team-a"]
    );
    const published = publishMatchupLineups(locked.teamData, {
      matchupId: "mu-1",
    });
    assert.equal(published.ok, true);
    const after = snapshotLineupSelections(
      published.teamData.lineups["mu-1::team-a"]
    );
    assert.deepEqual(after.selections, before.selections);
  });
});

describe("UI/service call-site wiring", () => {
  test("captain portal submit loads and forwards private pairing options", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/pages/tournament/TeamPortal.jsx"),
      "utf8"
    );
    assert.match(source, /prepareLivePrivatePairingOptions/);
    assert.match(source, /method:\s*"submitLineup"/);
    assert.match(source, /privatePairingRules:\s*prepared\.pairingOptions\?\.privatePairingRules/);
    assert.match(source, /competitionClass:\s*COMPETITION_CLASS\.INTERNAL/);
  });

  test("setup lock and randomize load rules, seed, and forward context", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/pages/tournament/TeamTournamentSetup.jsx"),
      "utf8"
    );
    assert.match(source, /method:\s*"lockLineup"/);
    assert.match(source, /method:\s*"randomizeLineup"/);
    assert.match(source, /prepareLivePrivatePairingOptions/);
    assert.match(source, /randomSeed:\s*mintV6OptimizationSeed\(\)/);
    assert.match(source, /privatePairingRules:\s*prepared\.pairingOptions\?\.privatePairingRules/);
  });

  test("teamTournamentService enriches submit and lock payload context", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/features/team-tournament/services/teamTournamentService.js"
      ),
      "utf8"
    );
    assert.match(source, /const enrichedPayload = \{/);
    assert.match(source, /submitLineup\(getTeamData\(tournament\), enrichedPayload\)/);
    assert.match(source, /lockMatchupLineups\(getTeamData\(tournament\), enrichedPayload\)/);
    assert.match(source, /competitionClass:\s*payload\.competitionClass \|\| COMPETITION_CLASS\.INTERNAL/);
  });
});

describe("SEED / MATCHUP adapter seams", () => {
  test("assignSeedsWithPrivatePairing returns deterministic seeds", () => {
    const teams = [
      { id: "t1", playerIds: ["m1", "m2"], avgLevel: 4.2 },
      { id: "t2", playerIds: ["m3", "m4"], avgLevel: 3.5 },
      { id: "t3", playerIds: ["f1", "f2"], avgLevel: 3.9 },
    ];
    const players = [
      { id: "m1", ratingInternal: 4.5 },
      { id: "m2", ratingInternal: 3.9 },
      { id: "m3", ratingInternal: 3.6 },
      { id: "m4", ratingInternal: 3.4 },
      { id: "f1", ratingInternal: 4.1 },
      { id: "f2", ratingInternal: 3.7 },
    ];
    const a = assignSeedsWithPrivatePairing(teams, players, {
      tournamentId: "t1",
      privatePairingRules: [],
    });
    const b = assignSeedsWithPrivatePairing(teams, players, {
      tournamentId: "t1",
      privatePairingRules: [],
    });
    assert.equal(a.ok, true);
    assert.deepEqual(
      a.teams.map((t) => ({ id: t.id, seed: t.seed })),
      b.teams.map((t) => ({ id: t.id, seed: t.seed }))
    );
  });

  test("mintV6OptimizationSeed creates distinct seeds", () => {
    const s1 = mintV6OptimizationSeed();
    const s2 = mintV6OptimizationSeed(s1);
    assert.notEqual(s1, s2);
  });

  test("createV6SeededRng is deterministic", () => {
    const a = createV6SeededRng("x");
    const b = createV6SeededRng("x");
    assert.equal(a(), b());
  });

  test("attachV6CompetitionOptimizationAudit persists without DB columns", () => {
    const next = attachV6CompetitionOptimizationAudit(
      { settings: {} },
      {
        operation: PRIVATE_PAIRING_OPERATION.COURT_ASSIGNMENT,
        randomSeed: "c1",
        action: V6_OPTIMIZATION_ACTION.INITIAL_GENERATE,
        resultSnapshot: [{ id: "m1", courtLabel: "Sân 1" }],
      }
    );
    assert.equal(
      next.settings.competitionOptimizationAudit.byOperation.COURT_ASSIGNMENT
        .randomSeed,
      "c1"
    );
  });
});

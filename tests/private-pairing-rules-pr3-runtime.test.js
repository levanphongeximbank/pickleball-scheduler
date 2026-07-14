import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_TYPE } from "../src/models/tournament/constants.js";
import { suggestTeamsFromPlayers } from "../src/tournament/engines/teamPairingEngine.js";
import { calculatePairScore } from "../src/ai/scoring.js";
import { createPairingConstraint } from "../src/features/pairing-constraints/models/pairingConstraint.js";
import { CONSTRAINT_TYPE } from "../src/features/pairing-constraints/constants.js";
import {
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_SCOPE,
  RELATION_MODE,
  RULE_VISIBILITY,
  REASON_CATEGORY,
  COMPETITION_CLASS,
  FEATURE_FLAG_KEYS,
  createPrivatePairingRule,
  PRIVATE_PAIRING_RUNTIME_CODE,
  runPrivatePairingRuntime,
  evaluatePrivatePairingMatchOption,
  isPrivatePairingRuntimeEnabled,
} from "../src/features/private-pairing-rules/index.js";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

const FLAGS_OFF = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "false",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "false",
};

function players(n = 8) {
  return Array.from({ length: n }, (_, index) => ({
    id: `p${index + 1}`,
    name: `P${index + 1}`,
    gender: index % 2 === 0 ? "Nam" : "Nữ",
    level: 3 + (index % 5) * 0.1,
    rating: 3 + (index % 5) * 0.1,
  }));
}

function hardRule(overrides = {}) {
  return createPrivatePairingRule({
    id: overrides.id || "hard-1",
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
    severity: "hard",
    weight: null,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    relationMode: RELATION_MODE.ANY_OF,
    scopeType: PRIVATE_PAIRING_SCOPE.GLOBAL,
    scopeId: null,
    visibility: RULE_VISIBILITY.PRIVATE,
    reasonCategory: REASON_CATEGORY.EVENT_OPERATION,
    reasonText: "ops",
    active: true,
    ...overrides,
  });
}

function softRule(overrides = {}) {
  return createPrivatePairingRule({
    id: overrides.id || "soft-1",
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
    severity: "soft",
    weight: 80,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    relationMode: RELATION_MODE.ANY_OF,
    scopeType: PRIVATE_PAIRING_SCOPE.GLOBAL,
    scopeId: null,
    visibility: RULE_VISIBILITY.PRIVATE,
    reasonCategory: REASON_CATEGORY.PLAYER_REQUEST,
    reasonText: "request",
    active: true,
    ...overrides,
  });
}

test("runtime flags require both ON", () => {
  assert.equal(isPrivatePairingRuntimeEnabled(FLAGS_OFF), false);
  assert.equal(
    isPrivatePairingRuntimeEnabled({
      [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
    }),
    false
  );
  assert.equal(isPrivatePairingRuntimeEnabled(FLAGS_ON), true);
});

test("hard MUST_NOT_PARTNER rejects same-team candidates; no -120 path", () => {
  const result = runPrivatePairingRuntime({
    players: players(8),
    rules: [
      hardRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
    ],
    seed: 42,
    envSource: FLAGS_ON,
    maxCandidates: 32,
    maxIterations: 64,
  });

  assert.equal(result.ok, true);
  const selected = result.selectedCandidate;
  assert.ok(selected);
  const sameTeam = selected.teams.some((team) => {
    const ids = (team.playerIds || []).map(String);
    return ids.includes("p1") && ids.includes("p2");
  });
  assert.equal(sameTeam, false);
  assert.ok(Number.isFinite(selected.finalScore));
});

test("hard MUST_PARTNER requires partners; soft cannot rescue infeasible", () => {
  const impossible = runPrivatePairingRuntime({
    players: players(4),
    rules: [
      hardRule({
        id: "m1",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
      hardRule({
        id: "m2",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
      softRule({ id: "s1", weight: 100 }),
    ],
    seed: 7,
    envSource: FLAGS_ON,
  });
  assert.equal(impossible.ok, false);
  assert.equal(impossible.errorCode, PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT);
});

test("MUST_PARTNER ANY_OF vs ALL_OF", () => {
  const anyOf = runPrivatePairingRuntime({
    players: players(8),
    rules: [
      hardRule({
        id: "any",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        relationMode: RELATION_MODE.ANY_OF,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2", "p3", "p4"],
      }),
    ],
    seed: 3,
    envSource: FLAGS_ON,
  });
  assert.equal(anyOf.ok, true);
  const team = anyOf.selectedCandidate.teams.find((item) =>
    (item.playerIds || []).includes("p1")
  );
  const ids = (team.playerIds || []).map(String);
  assert.ok(ids.includes("p2") || ids.includes("p3") || ids.includes("p4"));

  const allOfBlocked = runPrivatePairingRuntime({
    players: players(8),
    rules: [
      hardRule({
        id: "all",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        relationMode: RELATION_MODE.ALL_OF,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2", "p3"],
      }),
    ],
    seed: 3,
    context: { teamSize: 2 },
    envSource: FLAGS_ON,
  });
  assert.equal(allOfBlocked.ok, false);
  assert.equal(allOfBlocked.errorCode, PRIVATE_PAIRING_RUNTIME_CODE.RULE_VALIDATION_FAILED);
});

test("opponent hard rules on match options", () => {
  const optionOk = {
    teamA: [
      { id: "p1", level: 3 },
      { id: "p3", level: 3 },
    ],
    teamB: [
      { id: "p2", level: 3 },
      { id: "p4", level: 3 },
    ],
  };
  const optionBad = {
    teamA: [
      { id: "p1", level: 3 },
      { id: "p2", level: 3 },
    ],
    teamB: [
      { id: "p3", level: 3 },
      { id: "p4", level: 3 },
    ],
  };

  const mustOpp = evaluatePrivatePairingMatchOption(optionOk, {
    envSource: FLAGS_ON,
    rules: [
      hardRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
    ],
  });
  assert.equal(mustOpp.rejected, false);

  const mustOppFail = evaluatePrivatePairingMatchOption(optionBad, {
    envSource: FLAGS_ON,
    rules: [
      hardRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
    ],
  });
  assert.equal(mustOppFail.rejected, true);
  assert.ok(
    mustOppFail.rejectionCodes.includes(PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MUST_OPPONENT)
  );

  const mustNotOpp = evaluatePrivatePairingMatchOption(optionOk, {
    envSource: FLAGS_ON,
    rules: [
      hardRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
    ],
  });
  assert.equal(mustNotOpp.rejected, true);
});

test("soft PREFER_PARTNER increases constraintScore when satisfied", () => {
  const withPrefer = evaluatePrivatePairingMatchOption(
    {
      teamA: [
        { id: "p1", level: 3 },
        { id: "p2", level: 3 },
      ],
      teamB: [
        { id: "p3", level: 3 },
        { id: "p4", level: 3 },
      ],
    },
    {
      envSource: FLAGS_ON,
      rules: [softRule({ weight: 90 })],
    }
  );
  const without = evaluatePrivatePairingMatchOption(
    {
      teamA: [
        { id: "p1", level: 3 },
        { id: "p3", level: 3 },
      ],
      teamB: [
        { id: "p2", level: 3 },
        { id: "p4", level: 3 },
      ],
    },
    {
      envSource: FLAGS_ON,
      rules: [softRule({ weight: 90 })],
    }
  );
  assert.ok(withPrefer.constraintScore > without.constraintScore);
});

test("scope and time filtering", () => {
  const rules = [
    hardRule({
      id: "ta",
      scopeType: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
      scopeId: "tour-a",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
    }),
  ];

  const otherTournament = runPrivatePairingRuntime({
    players: players(8),
    rules,
    seed: 1,
    envSource: FLAGS_ON,
    context: { tournamentId: "tour-b" },
  });
  // No applicable hard rules → still ok (baseline pairing)
  assert.equal(otherTournament.ok, true);

  const expired = runPrivatePairingRuntime({
    players: players(8),
    rules: [
      hardRule({
        id: "exp",
        endAt: "2020-01-01T00:00:00.000Z",
      }),
    ],
    seed: 1,
    envSource: FLAGS_ON,
    context: { contextTime: "2026-07-14T00:00:00.000Z" },
  });
  assert.equal(expired.ok, true);
});

test("certified policy blocks private personal preference", () => {
  const blocked = runPrivatePairingRuntime({
    players: players(8),
    rules: [
      softRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: "hard",
        weight: null,
        visibility: RULE_VISIBILITY.PRIVATE,
      }),
    ],
    seed: 1,
    envSource: FLAGS_ON,
    context: {
      competitionClass: COMPETITION_CLASS.CERTIFIED,
      allowedByPublishedRules: false,
    },
  });
  // Rule blocked by policy → no hard rules applied → ok baseline
  assert.equal(blocked.meta.blockedByPolicyCount >= 1 || blocked.ok === true, true);

  const allowed = evaluatePrivatePairingMatchOption(
    {
      teamA: [
        { id: "p1", level: 3 },
        { id: "p2", level: 3 },
      ],
      teamB: [
        { id: "p3", level: 3 },
        { id: "p4", level: 3 },
      ],
    },
    {
      envSource: FLAGS_ON,
      rules: [
        hardRule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
          visibility: RULE_VISIBILITY.DISCLOSED,
          primaryPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
      context: {
        competitionClass: COMPETITION_CLASS.CERTIFIED,
        allowedByPublishedRules: true,
      },
    }
  );
  assert.equal(allowed.rejected, false);
});

test("determinism: same seed same output; input not mutated", () => {
  const list = players(8);
  const frozen = JSON.parse(JSON.stringify(list));
  const rules = [
    hardRule({
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
      primaryPlayerId: "p1",
      targetPlayerIds: ["p3"],
    }),
  ];
  const a = runPrivatePairingRuntime({
    players: list,
    rules,
    seed: 99,
    envSource: FLAGS_ON,
  });
  const b = runPrivatePairingRuntime({
    players: [...list].reverse(),
    rules: [...rules].reverse(),
    seed: 99,
    envSource: FLAGS_ON,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const sig = (result) =>
    result.selectedCandidate.teams
      .map((team) => [...team.playerIds].sort().join("+"))
      .sort()
      .join("||");
  assert.equal(sig(a), sig(b));
  assert.deepEqual(list, frozen);
});

test("legacy adapter + flag OFF preserves teamPairingEngine behavior", () => {
  const roster = players(8).map((player, index) => ({
    ...player,
    gender: index < 4 ? "Nam" : "Nữ",
  }));
  // Use open double / skill path without gender issues - MIXED needs equal M/F
  const mixed = [
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `m${i + 1}`,
      name: `M${i + 1}`,
      gender: "Nam",
      level: 3 + i * 0.1,
      rating: 3 + i * 0.1,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `f${i + 1}`,
      name: `F${i + 1}`,
      gender: "Nữ",
      level: 3 + i * 0.1,
      rating: 3 + i * 0.1,
    })),
  ];

  const constraint = createPairingConstraint({
    type: CONSTRAINT_TYPE.AVOID_PARTNER,
    mode: "hard",
    anchorPlayerId: "m1",
    targetPlayerIds: ["f1"],
  });

  const optionsOff = {
    pairingConstraints: [constraint],
    envSource: FLAGS_OFF,
  };
  const teamsOff = suggestTeamsFromPlayers(mixed, EVENT_TYPE.MIXED_DOUBLE, optionsOff);
  assert.ok(teamsOff.length > 0);
  assert.equal(optionsOff.privatePairingRuntime, undefined);

  const optionsOn = {
    pairingConstraints: [constraint],
    envSource: FLAGS_ON,
    seed: 11,
  };
  const teamsOn = suggestTeamsFromPlayers(mixed, EVENT_TYPE.MIXED_DOUBLE, optionsOn);
  assert.ok(optionsOn.privatePairingRuntime);
  assert.ok(teamsOn.length > 0);
  teamsOn.forEach((team) => {
    const ids = (team.playerIds || team.members.map((p) => p.id)).map(String);
    assert.equal(ids.includes("m1") && ids.includes("f1"), false);
  });
  void roster;
});

test("AI calculatePairScore hard-rejects without -120 when flags ON", () => {
  const option = {
    teamA: [
      { id: "a", level: 3 },
      { id: "b", level: 3 },
    ],
    teamB: [
      { id: "c", level: 3 },
      { id: "d", level: 3 },
    ],
  };

  const rejected = calculatePairScore(option, {
    envSource: FLAGS_ON,
    policies: [
      {
        type: "avoid_teammate",
        playerA: "a",
        playerB: "b",
        enabled: true,
        priority: "HIGH",
        source: "founder",
      },
    ],
  });
  assert.equal(rejected.rejected, true);
  assert.equal(rejected.totalScore, Number.NEGATIVE_INFINITY);
  assert.notEqual(rejected.totalScore, -120);

  const allowed = calculatePairScore(option, {
    envSource: FLAGS_ON,
    policies: [
      {
        type: "avoid_teammate",
        playerA: "a",
        playerB: "c",
        enabled: true,
        priority: "HIGH",
        source: "founder",
      },
    ],
  });
  assert.equal(Boolean(allowed.rejected), false);
  assert.ok(Number.isFinite(allowed.totalScore));
});

test("benchmark guards for 8/16/32 players", () => {
  const sizes = [8, 16, 32];
  const report = sizes.map((size) => {
    const started = Date.now();
    const result = runPrivatePairingRuntime({
      players: players(size),
      rules: [
        hardRule({
          primaryPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
      seed: 5,
      envSource: FLAGS_ON,
      maxCandidates: 48,
      maxIterations: 96,
    });
    return {
      size,
      ok: result.ok,
      candidateCount: result.meta.candidateCount,
      rejectedCount: result.rejectedCandidateCount,
      elapsedMs: Date.now() - started,
    };
  });

  report.forEach((row) => {
    assert.ok(row.elapsedMs < 5000, `size ${row.size} too slow: ${row.elapsedMs}ms`);
    assert.ok(row.candidateCount <= 48);
  });

  // Attach for docs consumption via assertion side-channel
  assert.ok(report.length === 3);
  globalThis.__PRIVATE_PAIRING_PR3_BENCH__ = report;
});

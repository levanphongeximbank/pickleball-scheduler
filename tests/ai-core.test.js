import test from "node:test";
import assert from "node:assert/strict";

import { normalizeScheduleInput, validateScheduleInput } from "../src/ai/normalize.js";
import { calculatePairScore, calculateAIScore } from "../src/ai/scoring.js";
import { buildCourtExplanation } from "../src/ai/explain.js";

test("normalizeScheduleInput converts raw UI input into a stable model", () => {
  const input = {
    players: [
      { id: 1, name: "Anna", level: 3.5, active: true },
      { id: 2, name: "Ben", level: 2.5 },
    ],
    courts: [
      { id: 1, name: "Sân 1", active: true },
      { id: 2, name: "VIP", number: 2, active: false },
    ],
    selectedPlayerIds: [1, 2],
    selectedCourtIds: [1],
    lockedCourts: [1],
    lockedPlayers: [2],
  };

  const result = normalizeScheduleInput(input);

  assert.equal(result.players.length, 2);
  assert.equal(result.courts.length, 2);
  assert.equal(result.players[0].id, 1);
  assert.equal(result.players[0].level, 3.5);
  assert.equal(result.courts[0].name, "Sân 1");
  assert.equal(result.selectedCourtIds[0], 1);
  assert.deepEqual(result.lockedCourts, [1]);
  assert.deepEqual(result.lockedPlayers, [2]);
});

test("normalizeScheduleInput does not use raw court id as display name fallback", () => {
  const input = {
    players: [
      { id: 1, name: "Anna", level: 3.5, active: true },
      { id: 2, name: "Ben", level: 2.5, active: true },
      { id: 3, name: "Cara", level: 3.0, active: true },
      { id: 4, name: "Dan", level: 3.0, active: true },
    ],
    courts: [{ id: 1782395609019, active: true }],
    selectedPlayerIds: [1, 2, 3, 4],
    selectedCourtIds: [1782395609019],
  };

  const result = normalizeScheduleInput(input);

  assert.equal(result.courts[0].name, "Sân 1");
});

test("calculatePairScore uses history and policy context to penalize bad combinations", () => {
  const option = {
    teamA: [{ id: "p1", level: 3.5 }, { id: "p3", level: 3.0 }],
    teamB: [{ id: "p2", level: 3.5 }, { id: "p4", level: 3.0 }],
  };

  const context = {
    history: {
      p1: { games: 3, partners: { p2: 2 }, opponents: { p3: 2 } },
      p2: { games: 3, partners: { p1: 2 }, opponents: { p4: 1 } },
      p3: { games: 5, partners: {}, opponents: { p1: 2 } },
      p4: { games: 4, partners: {}, opponents: { p2: 1 } },
    },
    policies: [{ type: "prefer_teammate", playerA: "p1", playerB: "p2", enabled: true }],
  };

  const result = calculatePairScore(option, context);

  assert.ok(result.totalScore < 100);
  assert.ok(result.policyScore < 0);
  assert.equal(result.levelScore, 100);
});

test("calculatePairScore rewards prefer_teammate when players are in the same team", () => {
  const option = {
    teamA: [{ id: "p1", level: 3.0 }, { id: "p2", level: 3.0 }],
    teamB: [{ id: "p3", level: 3.0 }, { id: "p4", level: 3.0 }],
  };

  const context = {
    history: {},
    policies: [{ type: "prefer_teammate", playerA: "p1", playerB: "p2", enabled: true }],
  };

  const result = calculatePairScore(option, context);

  assert.ok(result.policyScore > 0);
});

test("calculatePairScore applies custom club rules to ruleScore", () => {
  const option = {
    teamA: [{ id: "p1", level: 3.5 }, { id: "p2", level: 3.0 }],
    teamB: [{ id: "p3", level: 3.0 }, { id: "p4", level: 3.0 }],
  };

  const context = {
    history: {
      p1: { games: 3, partners: { p2: 3 }, opponents: {} },
      p2: { games: 3, partners: { p1: 3 }, opponents: {} },
      p3: { games: 3, partners: {}, opponents: {} },
      p4: { games: 3, partners: {}, opponents: {} },
    },
    policies: [],
    rules: [
      {
        type: "max_partner_repeat",
        maxTimes: 1,
        penalty: 20,
        enabled: true,
      },
    ],
  };

  const result = calculatePairScore(option, context);

  assert.ok(result.ruleScore < 100);
});

test("calculateAIScore returns detailed metric breakdown and waiting score", () => {
  const courts = [
    {
      score: 90,
      detailScore: {
        levelScore: 92,
        historyScore: 85,
        ruleScore: 100,
        policyScore: -10,
        waitingScore: 80,
      },
    },
    {
      score: 70,
      detailScore: {
        levelScore: 76,
        historyScore: 60,
        ruleScore: 100,
        policyScore: 0,
        waitingScore: 70,
      },
    },
  ];

  const aiScore = calculateAIScore(courts, 2);

  assert.equal(aiScore.total, 80);
  assert.equal(aiScore.balance, 84);
  assert.equal(aiScore.history, 73);
  assert.equal(aiScore.rules, 100);
  assert.equal(aiScore.policy, 95);
  assert.equal(aiScore.waiting, 75);
});

test("validateScheduleInput rejects missing players or courts", () => {
  const result = validateScheduleInput({
    players: [],
    courts: [],
    selectedPlayerIds: [],
    selectedCourtIds: [],
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.includes("players")));
  assert.ok(result.errors.some((error) => error.includes("courts")));
});

test("buildCourtExplanation produces human-readable reasoning", () => {
  const explanation = buildCourtExplanation({ diff: 0.2, score: 90 }, { policies: [{ enabled: true }] });

  assert.match(explanation, /cân bằng/i);
  assert.match(explanation, /policy/i);
});

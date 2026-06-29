import test from "node:test";
import assert from "node:assert/strict";

import { calculatePairScore, calculateAIScore } from "../src/ai/scoring.js";

test("calculatePairScore returns hard penalty when level diff exceeds threshold", () => {
  const result = calculatePairScore({
    teamA: [{ id: "a1", level: 5.5 }, { id: "a2", level: 5.5 }],
    teamB: [{ id: "b1", level: 2.0 }, { id: "b2", level: 2.0 }],
  });

  assert.ok(result.totalScore < 0);
  assert.equal(result.levelScore, 0);
  assert.equal(result.historyScore, 0);
  assert.equal(result.ruleScore, 0);
});

test("calculatePairScore applies max_opponent_repeat penalty from rules", () => {
  const option = {
    teamA: [{ id: "p1", level: 3.0 }, { id: "p2", level: 3.0 }],
    teamB: [{ id: "p3", level: 3.0 }, { id: "p4", level: 3.0 }],
  };

  const context = {
    history: {
      p1: { games: 5, partners: {}, opponents: { p3: 4, p4: 3 } },
      p2: { games: 5, partners: {}, opponents: { p3: 2, p4: 2 } },
      p3: { games: 5, partners: {}, opponents: { p1: 4, p2: 2 } },
      p4: { games: 5, partners: {}, opponents: { p1: 3, p2: 2 } },
    },
    rules: [
      {
        type: "max_opponent_repeat",
        maxTimes: 1,
        penalty: 10,
        enabled: true,
      },
    ],
  };

  const result = calculatePairScore(option, context);

  assert.ok(result.ruleScore < 100);
});

test("calculatePairScore ignores disabled rules", () => {
  const option = {
    teamA: [{ id: "p1", level: 3.0 }, { id: "p2", level: 3.0 }],
    teamB: [{ id: "p3", level: 3.0 }, { id: "p4", level: 3.0 }],
  };

  const context = {
    history: {
      p1: { games: 5, partners: { p2: 10 }, opponents: {} },
      p2: { games: 5, partners: { p1: 10 }, opponents: {} },
      p3: { games: 5, partners: {}, opponents: {} },
      p4: { games: 5, partners: {}, opponents: {} },
    },
    rules: [
      {
        type: "max_partner_repeat",
        maxTimes: 0,
        penalty: 100,
        enabled: false,
      },
    ],
  };

  const result = calculatePairScore(option, context);

  assert.equal(result.ruleScore, 100);
});

test("calculateAIScore returns zeros for empty courts", () => {
  const aiScore = calculateAIScore([], 5);

  assert.deepEqual(aiScore, {
    total: 0,
    balance: 0,
    history: 0,
    waiting: 0,
    rules: 0,
    policy: 0,
    competition: 0,
  });
});

test("calculateAIScore clamps policy and waiting metrics into [0, 100]", () => {
  const courts = [
    {
      score: 80,
      detailScore: {
        levelScore: 80,
        historyScore: 80,
        ruleScore: 80,
        policyScore: 500,
        waitingScore: 0,
      },
    },
  ];

  const aiScore = calculateAIScore(courts, 50);

  assert.equal(aiScore.policy, 100);
  assert.equal(aiScore.waiting, 0);
});

test("calculatePairScore rewards players with higher waitCount", () => {
  const option = {
    teamA: [{ id: "p1", level: 3.0 }, { id: "p2", level: 3.0 }],
    teamB: [{ id: "p3", level: 3.0 }, { id: "p4", level: 3.0 }],
  };

  const highWait = calculatePairScore(option, {
    waitingSnapshot: {
      p1: { waitCount: 5, playCount: 0 },
      p2: { waitCount: 5, playCount: 0 },
      p3: { waitCount: 5, playCount: 0 },
      p4: { waitCount: 5, playCount: 0 },
    },
  });

  const lowWait = calculatePairScore(option, {
    waitingSnapshot: {
      p1: { waitCount: 0, playCount: 5 },
      p2: { waitCount: 0, playCount: 5 },
      p3: { waitCount: 0, playCount: 5 },
      p4: { waitCount: 0, playCount: 5 },
    },
  });

  assert.ok(highWait.waitingScore > lowWait.waitingScore);
});

test("calculateAIScore uses waitingScore from court detailScore", () => {
  const aiScore = calculateAIScore([
    {
      score: 80,
      detailScore: {
        waitingScore: 90,
      },
    },
  ], 0);

  assert.equal(aiScore.waiting, 90);
});

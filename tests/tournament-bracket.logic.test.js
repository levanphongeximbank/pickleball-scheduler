import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKnockoutProgress,
  buildFirstKnockoutRound,
  buildTournamentBracket,
  isKnockoutRoundLocked,
  resolveKnockoutRounds,
  sanitizeKnockoutWinners,
} from "../src/pages/tournament.bracket.logic.js";

function createGroup(group, count = 4) {
  return {
    group,
    standing: Array.from({ length: count }, (_, index) => ({
      id: `${group}-${index + 1}`,
      name: `${group}-${index + 1}`,
      points: count - index,
    })),
  };
}

test("buildFirstKnockoutRound maps A1-B2 and A2-B1 for 4 groups", () => {
  const groups = [createGroup("A"), createGroup("B"), createGroup("C"), createGroup("D")];
  const round = buildFirstKnockoutRound(groups);

  assert.equal(round.name, "Tu ket");
  assert.equal(round.matches.length, 4);

  assert.equal(round.matches[0].homeSeed, "A1");
  assert.equal(round.matches[0].awaySeed, "B2");
  assert.equal(round.matches[1].homeSeed, "A2");
  assert.equal(round.matches[1].awaySeed, "B1");

  assert.equal(round.matches[2].homeSeed, "C1");
  assert.equal(round.matches[2].awaySeed, "D2");
  assert.equal(round.matches[3].homeSeed, "C2");
  assert.equal(round.matches[3].awaySeed, "D1");
});

test("buildTournamentBracket builds Round of 16 to final for 8 groups", () => {
  const groups = [
    createGroup("A"),
    createGroup("B"),
    createGroup("C"),
    createGroup("D"),
    createGroup("E"),
    createGroup("F"),
    createGroup("G"),
    createGroup("H"),
  ];

  const rounds = buildTournamentBracket(groups);

  assert.equal(rounds.length, 4);
  assert.equal(rounds[0].name, "Vong 1/8");
  assert.equal(rounds[0].matches.length, 8);
  assert.equal(rounds[1].name, "Tu ket");
  assert.equal(rounds[1].matches.length, 4);
  assert.equal(rounds[2].name, "Ban ket");
  assert.equal(rounds[2].matches.length, 2);
  assert.equal(rounds[3].name, "Chung ket");
  assert.equal(rounds[3].matches.length, 1);
});

test("buildTournamentBracket builds 32-team path for 16 groups", () => {
  const groups = Array.from({ length: 16 }, (_, index) =>
    createGroup(String.fromCharCode(65 + index))
  );

  const rounds = buildTournamentBracket(groups);

  assert.equal(rounds[0].name, "Vong 1/16");
  assert.equal(rounds[0].matches.length, 16);
  assert.equal(rounds[1].name, "Vong 1/8");
  assert.equal(rounds[2].name, "Tu ket");
  assert.equal(rounds[3].name, "Ban ket");
  assert.equal(rounds[4].name, "Chung ket");
});

test("resolveKnockoutRounds propagates selected winners to next rounds", () => {
  const groups = [createGroup("A"), createGroup("B"), createGroup("C"), createGroup("D")];
  const rounds = buildTournamentBracket(groups);

  const resolved = resolveKnockoutRounds(rounds, {
    "R1-M1": "home",
    "R1-M2": "away",
    "R1-M3": "home",
    "R1-M4": "away",
  });

  assert.equal(resolved[1].matches.length, 2);
  assert.equal(resolved[1].matches[0].homeSeed, "W(R1-M1)");
  assert.equal(resolved[1].matches[0].awaySeed, "W(R1-M2)");
  assert.equal(resolved[1].matches[0].home?.name, "A-1");
  assert.equal(resolved[1].matches[0].away?.name, "B-1");
});

test("buildKnockoutProgress marks round completion and champion", () => {
  const groups = [createGroup("A"), createGroup("B"), createGroup("C"), createGroup("D")];
  const rounds = buildTournamentBracket(groups);

  const progress = buildKnockoutProgress(rounds, {
    "R1-M1": "home",
    "R1-M2": "away",
    "R1-M3": "home",
    "R1-M4": "away",
    "R2-M1": "home",
    "R2-M2": "away",
    "R3-M1": "home",
  });

  assert.equal(progress.totalRounds, 3);
  assert.equal(progress.completedRounds, 3);
  assert.equal(progress.rounds[0].completed, true);
  assert.equal(progress.rounds[1].completed, true);
  assert.equal(progress.rounds[2].completed, true);
  assert.equal(progress.champion?.name, "A-1");
});

test("sanitizeKnockoutWinners removes impossible selections", () => {
  const groups = [createGroup("A"), createGroup("B"), createGroup("C"), createGroup("D")];
  const rounds = buildTournamentBracket(groups);

  const sanitized = sanitizeKnockoutWinners(rounds, {
    "R1-M1": "home",
    "R2-M1": "away",
  });

  assert.equal(sanitized["R1-M1"], "home");
  assert.equal(sanitized["R2-M1"], undefined);
});

test("isKnockoutRoundLocked locks completed rounds unless manually unlocked", () => {
  const completedRound = { name: "Tu ket", completed: true };
  const inProgressRound = { name: "Ban ket", completed: false };

  assert.equal(isKnockoutRoundLocked(completedRound, {}), true);
  assert.equal(isKnockoutRoundLocked(completedRound, { "Tu ket": true }), false);
  assert.equal(isKnockoutRoundLocked(inProgressRound, {}), false);
});

/**
 * AI pairing reveal session adapter — names must render, no engine re-run.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildAiPairingRevealSession } from "../src/features/team-tournament/showcase/buildAiPairingRevealSession.js";
import {
  buildShowcaseTeamRevealSteps,
  assertTeamRevealParity,
  selectRevealedTeamState,
} from "../src/features/team-tournament/showcase/showcaseRevealSteps.js";

test("AI pairing reveal session annotates athlete display names", () => {
  const players = [
    { id: "p1", name: "TT32-NAM-01", gender: "Nam", rating: 3.8 },
    { id: "p2", name: "TT32-NU-01", gender: "Nữ", rating: 3.5 },
    { id: "p3", name: "TT32-NAM-02", gender: "Nam", rating: 3.6 },
    { id: "p4", name: "TT32-NU-02", gender: "Nữ", rating: 3.4 },
  ];
  const teams = [
    {
      id: "t1",
      name: "Đội 1",
      playerIds: ["p1", "p2", "p3", "p4"],
      seed: 1,
    },
  ];
  const built = buildAiPairingRevealSession({ teams, players });
  assert.equal(built.ok, true);
  assert.equal(built.session.teamCards[0].athletes[0].name, "TT32-NAM-01");
  assert.equal(built.session.teamCards[0].athletes[1].name, "TT32-NU-01");
  assert.ok(built.session.teamCards[0].athletes.every((a) => a.name));
});

test("AI pairing reveal falls back when name missing but never blank", () => {
  const players = [{ id: "p1", gender: "Nam", rating: 3 }];
  const teams = [{ id: "t1", name: "Đội 1", playerIds: ["p1"] }];
  const built = buildAiPairingRevealSession({ teams, players });
  assert.equal(built.ok, true);
  assert.equal(built.session.teamCards[0].athletes[0].name, "VĐV p1");
});

test("AI pairing reveal steps queue athletes top-to-bottom per team", () => {
  const players = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Athlete ${i + 1}`,
    gender: i % 2 === 0 ? "Nam" : "Nữ",
    rating: 3 + i * 0.1,
  }));
  const teams = [
    { id: "t1", name: "Đội 1", playerIds: ["p1", "p2", "p3", "p4"], seed: 1 },
    { id: "t2", name: "Đội 2", playerIds: ["p5", "p6", "p7", "p8"], seed: 2 },
  ];
  const session = buildAiPairingRevealSession({ teams, players }).session;
  const steps = buildShowcaseTeamRevealSteps(session);
  assert.equal(steps.ok, true);
  assert.equal(steps.steps.length, 8);
  assert.equal(assertTeamRevealParity(session, steps), true);

  const midway = selectRevealedTeamState(steps, 3);
  assert.equal(midway.teams[0].revealedAthletes.length, 3);
  assert.equal(midway.teams[0].revealedAthletes[0].name, "Athlete 1");
  assert.equal(midway.teams[0].revealedAthletes[2].name, "Athlete 3");
  assert.equal(midway.teams[1].revealedAthletes.length, 0);
  assert.equal(midway.activeTeamIndex, 0);
});

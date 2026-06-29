import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData, saveClubData } from "../src/domain/clubStorage.js";
import {
  approveSkillLevelProposal,
  generateMonthlySkillLevelProposals,
  listPendingSkillLevelProposals,
  rejectSkillLevelProposal,
} from "../src/domain/skillLevelService.js";
import { applyEloFromMatchRecord } from "../src/domain/eloService.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  saveClubData(DEFAULT_CLUB.id, {
    ...loadClubData(DEFAULT_CLUB.id),
    players: [
      {
        id: 1,
        name: "An",
        gender: "Nam",
        level: 3.5,
        rating: 3.5,
        ratingInternal: 4.1,
        skillMeta: { lastPublicLevelReviewAt: "2026-05-01T00:00:00.000Z" },
      },
    ],
  });
});

afterEach(() => {
  globalThis.localStorage = undefined;
});

test("generateMonthlySkillLevelProposals creates pending proposal without changing level", () => {
  const result = generateMonthlySkillLevelProposals(DEFAULT_CLUB.id, {
    now: new Date("2026-06-05T10:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  assert.equal(result.proposalCount, 1);

  const data = loadClubData(DEFAULT_CLUB.id);
  assert.equal(data.players[0].level, 3.5);
  assert.equal(listPendingSkillLevelProposals(DEFAULT_CLUB.id).length, 1);
});

test("approveSkillLevelProposal updates public level only after admin approval", () => {
  const generated = generateMonthlySkillLevelProposals(DEFAULT_CLUB.id, {
    now: new Date("2026-06-05T10:00:00.000Z"),
  });
  const proposalId = generated.proposals[0].id;

  const approved = approveSkillLevelProposal(DEFAULT_CLUB.id, proposalId, {
    now: new Date("2026-06-06T10:00:00.000Z"),
  });

  assert.equal(approved.ok, true);

  const data = loadClubData(DEFAULT_CLUB.id);
  assert.equal(data.players[0].level, 4);
  assert.equal(data.players[0].rating, 4);
  assert.equal(data.players[0].ratingInternal, 4.1);
  assert.equal(listPendingSkillLevelProposals(DEFAULT_CLUB.id).length, 0);
});

test("rejectSkillLevelProposal keeps public level unchanged", () => {
  const generated = generateMonthlySkillLevelProposals(DEFAULT_CLUB.id, {
    now: new Date("2026-06-05T10:00:00.000Z"),
  });
  const proposalId = generated.proposals[0].id;

  const rejected = rejectSkillLevelProposal(DEFAULT_CLUB.id, proposalId, {
    now: new Date("2026-06-06T10:00:00.000Z"),
  });

  assert.equal(rejected.ok, true);

  const data = loadClubData(DEFAULT_CLUB.id);
  assert.equal(data.players[0].level, 3.5);
  assert.equal(data.players[0].rating, 3.5);
});

test("applyEloFromMatchRecord does not change public level after match", () => {
  const record = {
    id: "m1",
    teamAPlayerIds: ["1"],
    teamBPlayerIds: ["2"],
    scoreA: 11,
    scoreB: 3,
  };

  saveClubData(DEFAULT_CLUB.id, {
    ...loadClubData(DEFAULT_CLUB.id),
    players: [
      { id: 1, name: "A", level: 3.5, rating: 3.5, ratingInternal: 3.5 },
      { id: 2, name: "B", level: 3.5, rating: 3.5, ratingInternal: 3.5 },
    ],
  });

  applyEloFromMatchRecord(DEFAULT_CLUB.id, record);
  const data = loadClubData(DEFAULT_CLUB.id);
  const winner = data.players.find((player) => String(player.id) === "1");

  assert.ok(winner.ratingInternal > 3.5);
  assert.equal(winner.level, 3.5);
  assert.equal(winner.rating, 3.5);
});

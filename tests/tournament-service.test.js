import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
} from "../src/models/tournament/index.js";
import {
  createTournament,
  deleteTournament,
  getTournament,
  listTournaments,
  purgeOpenTournaments,
  setTournamentStatus,
  advanceTournamentStatus,
  updateTournament,
  validateTournamentStatusChange,
} from "../src/domain/tournamentService.js";
import { loadClubData, saveClubData } from "../src/domain/clubStorage.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";

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

let originalDateNow;

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  originalDateNow = Date.now;
  Date.now = () => 12345;
  setActiveClubId(DEFAULT_CLUB.id);
});

afterEach(() => {
  Date.now = originalDateNow;
});

test("createTournament saves tournament in club blob", () => {
  const result = createTournament(DEFAULT_CLUB.id, {
    name: "Chơi vui thứ 7",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });

  assert.equal(result.ok, true);
  assert.equal(result.tournament.name, "Chơi vui thứ 7");
  assert.equal(result.tournament.mode, TOURNAMENT_MODE.DAILY_PLAY);
  assert.equal(result.tournament.status, TOURNAMENT_STATUS.DRAFT);

  const data = loadClubData(DEFAULT_CLUB.id);
  assert.equal(data.tournaments.length, 1);
  assert.equal(data.tournaments[0].id, result.tournament.id);
});

test("createTournament rejects empty name", () => {
  const result = createTournament(DEFAULT_CLUB.id, { name: "   " });
  assert.equal(result.ok, false);
});

test("listTournaments filters by mode and status", () => {
  createTournament(DEFAULT_CLUB.id, {
    name: "Daily A",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });
  createTournament(DEFAULT_CLUB.id, {
    name: "Internal B",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
  });

  const daily = listTournaments(DEFAULT_CLUB.id, {
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });
  assert.equal(daily.length, 1);
  assert.equal(daily[0].name, "Daily A");
});

test("getTournament returns saved record", () => {
  const created = createTournament(DEFAULT_CLUB.id, {
    name: "Open Cup",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.AI_BALANCE,
  });

  const found = getTournament(DEFAULT_CLUB.id, created.tournament.id);
  assert.equal(found.officialMode, OFFICIAL_MODE.AI_BALANCE);
});

test("updateTournament patches fields without changing id", () => {
  const created = createTournament(DEFAULT_CLUB.id, {
    name: "Giải nội bộ",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
  });

  const updated = updateTournament(DEFAULT_CLUB.id, created.tournament.id, {
    hostClubName: "CLB Tam Bình",
    status: TOURNAMENT_STATUS.REGISTRATION,
  });

  assert.equal(updated.ok, true);
  assert.equal(updated.tournament.hostClubName, "CLB Tam Bình");
  assert.equal(updated.tournament.status, TOURNAMENT_STATUS.REGISTRATION);
});

test("validateTournamentStatusChange blocks invalid transition", () => {
  const tournament = {
    status: TOURNAMENT_STATUS.DRAFT,
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    events: [],
  };

  const invalid = validateTournamentStatusChange(
    tournament,
    TOURNAMENT_STATUS.ACTIVE
  );
  assert.equal(invalid.ok, false);

  const valid = validateTournamentStatusChange(
    tournament,
    TOURNAMENT_STATUS.REGISTRATION
  );
  assert.equal(valid.ok, true);
});

test("advanceTournamentStatus walks draft to ready through registration", () => {
  const created = createTournament(DEFAULT_CLUB.id, {
    name: "Giải nội bộ",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
  });

  const result = advanceTournamentStatus(
    DEFAULT_CLUB.id,
    created.tournament.id,
    TOURNAMENT_STATUS.READY,
    {
      events: [
        {
          id: "e1",
          tournamentId: created.tournament.id,
          eventType: "mixed_double",
          entries: [],
          groups: [{ id: "g1", label: "A", entryIds: [] }],
          matches: [],
        },
      ],
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.tournament.status, TOURNAMENT_STATUS.READY);
  assert.equal(result.tournament.events[0].groups.length, 1);
});

test("setTournamentStatus blocks active when no groups for internal tournament", () => {
  const created = createTournament(DEFAULT_CLUB.id, {
    name: "Giải nội bộ",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
  });

  setTournamentStatus(
    DEFAULT_CLUB.id,
    created.tournament.id,
    TOURNAMENT_STATUS.REGISTRATION
  );
  setTournamentStatus(DEFAULT_CLUB.id, created.tournament.id, TOURNAMENT_STATUS.READY);

  const active = setTournamentStatus(
    DEFAULT_CLUB.id,
    created.tournament.id,
    TOURNAMENT_STATUS.ACTIVE
  );

  assert.equal(active.ok, false);
});

test("setTournamentStatus allows active for daily play without groups", () => {
  const created = createTournament(DEFAULT_CLUB.id, {
    name: "Chơi vui",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });

  setTournamentStatus(
    DEFAULT_CLUB.id,
    created.tournament.id,
    TOURNAMENT_STATUS.REGISTRATION
  );
  setTournamentStatus(DEFAULT_CLUB.id, created.tournament.id, TOURNAMENT_STATUS.READY);

  const active = setTournamentStatus(
    DEFAULT_CLUB.id,
    created.tournament.id,
    TOURNAMENT_STATUS.ACTIVE
  );

  assert.equal(active.ok, true);
});

test("deleteTournament only removes draft or cancelled tournaments", () => {
  const created = createTournament(DEFAULT_CLUB.id, {
    name: "Giải tạm",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });

  const removed = deleteTournament(DEFAULT_CLUB.id, created.tournament.id);
  assert.equal(removed.ok, true);
  assert.equal(getTournament(DEFAULT_CLUB.id, created.tournament.id), null);

  const created2 = createTournament(DEFAULT_CLUB.id, {
    name: "Giải đang chạy",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });

  setTournamentStatus(
    DEFAULT_CLUB.id,
    created2.tournament.id,
    TOURNAMENT_STATUS.REGISTRATION
  );

  const blocked = deleteTournament(DEFAULT_CLUB.id, created2.tournament.id);
  assert.equal(blocked.ok, false);
});

test("purgeOpenTournaments removes all non-completed and non-cancelled tournaments", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [];
  saveClubData(DEFAULT_CLUB.id, data);

  const draft = createTournament(DEFAULT_CLUB.id, {
    id: "tournament-draft",
    name: "Giải nháp",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });
  const active = createTournament(DEFAULT_CLUB.id, {
    id: "tournament-active",
    name: "Giải đang chạy",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });
  const activeReady = advanceTournamentStatus(
    DEFAULT_CLUB.id,
    active.tournament.id,
    TOURNAMENT_STATUS.READY
  );
  assert.equal(activeReady.ok, true);
  const activeDone = setTournamentStatus(
    DEFAULT_CLUB.id,
    active.tournament.id,
    TOURNAMENT_STATUS.ACTIVE
  );
  assert.equal(activeDone.ok, true);

  const completed = createTournament(DEFAULT_CLUB.id, {
    id: "tournament-completed",
    name: "Giải xong",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });
  const completedReady = advanceTournamentStatus(
    DEFAULT_CLUB.id,
    completed.tournament.id,
    TOURNAMENT_STATUS.READY
  );
  assert.equal(completedReady.ok, true);
  const completedActive = setTournamentStatus(
    DEFAULT_CLUB.id,
    completed.tournament.id,
    TOURNAMENT_STATUS.ACTIVE
  );
  assert.equal(completedActive.ok, true);
  const completedDone = setTournamentStatus(
    DEFAULT_CLUB.id,
    completed.tournament.id,
    TOURNAMENT_STATUS.COMPLETED,
    { force: true }
  );
  assert.equal(completedDone.ok, true);

  const cancelled = createTournament(DEFAULT_CLUB.id, {
    id: "tournament-cancelled",
    name: "Giải hủy",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });
  const cancelledDone = setTournamentStatus(
    DEFAULT_CLUB.id,
    cancelled.tournament.id,
    TOURNAMENT_STATUS.CANCELLED
  );
  assert.equal(cancelledDone.ok, true);

  const result = purgeOpenTournaments(DEFAULT_CLUB.id);
  assert.equal(result.ok, true);
  assert.equal(result.removedCount, 2);

  const remaining = listTournaments(DEFAULT_CLUB.id);
  assert.equal(remaining.length, 2);
  assert.ok(remaining.some((tournament) => tournament.id === completed.tournament.id));
  assert.ok(remaining.some((tournament) => tournament.id === cancelled.tournament.id));
  assert.equal(getTournament(DEFAULT_CLUB.id, draft.tournament.id), null);
  assert.equal(getTournament(DEFAULT_CLUB.id, active.tournament.id), null);
});

test("legacy club data remains intact after tournament CRUD", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  data.players = [{ id: 1, name: "A", gender: "Nam", level: 3.5, active: true }];
  data.rounds = [{ id: "r1", name: "Vòng 1" }];
  data.sessions = [{ id: 99, date: "2026-01-01", courts: [], waiting: [], meta: {} }];
  saveClubData(DEFAULT_CLUB.id, data);

  createTournament(DEFAULT_CLUB.id, {
    name: "Giải mới",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });

  const after = loadClubData(DEFAULT_CLUB.id);
  assert.equal(after.players.length, 1);
  assert.ok(after.rounds.length >= 1);
  assert.equal(after.sessions.length, 1);
  assert.equal(after.tournaments.length, 1);
  assert.ok(after.tournaments[0].roundId);
});

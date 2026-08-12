import test, { afterEach, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  DAILY_MATCH_TYPE,
  DAILY_GENDER_FILTER,
  toggleDailyCheckIn,
  getBusyPlayerIdsFromDailyMatches,
  resolveDailyCompetitionType,
  partitionDailyMatches,
  createFairDailyMatches,
  assignDailyMatchToCourt,
  submitDailyPlayMatchScore,
  getDefaultDailyPlaySettings,
} from "../src/tournament/engines/dailyPlayEngine.js";
import { MATCH_STATUS } from "../src/models/tournament/index.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";
import {
  DAILY_PLAY_CODE,
  DAILY_PLAY_MESSAGES,
  DAILY_PLAY_RPC,
  createDailyPlayCanonicalService,
  createInMemoryDailyPlayAuthority,
  createSeededDailyPlayTournament,
  resolveCreateMatchCount,
  validateScoreInput,
  __setDailyPlayCanonicalServiceForTests,
  __resetDailyPlayCanonicalServiceForTests,
} from "../src/features/daily-play/canonical/index.js";
import { hasEffectPrelude } from "../src/components/tournament/animation/shared/effectPreludeConfig.js";
import { ANIMATION_MODES } from "../src/components/tournament/animation/animationUtils.js";

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

const players = [
  { id: 1, name: "Nam 1", gender: "Nam", level: 4 },
  { id: 2, name: "Nam 2", gender: "Nam", level: 3.5 },
  { id: 3, name: "Nam 3", gender: "Nam", level: 3 },
  { id: 4, name: "Nam 4", gender: "Nam", level: 2.5 },
  { id: 5, name: "Nu 1", gender: "Nữ", level: 4 },
  { id: 6, name: "Nu 2", gender: "Nữ", level: 3.5 },
  { id: 7, name: "Nu 3", gender: "Nữ", level: 3 },
  { id: 8, name: "Nu 4", gender: "Nữ", level: 2.5 },
];

const TENANT = "tenant-daily-01";
const CLUB = "club-1";
const TID = "11111111-1111-4111-8111-111111111111";

const canonicalPlayers = [
  { id: "1", name: "Nam 1", gender: "Nam", level: 4 },
  { id: "2", name: "Nam 2", gender: "Nam", level: 3.5 },
  { id: "3", name: "Nam 3", gender: "Nam", level: 3 },
  { id: "4", name: "Nam 4", gender: "Nam", level: 2.5 },
  { id: "5", name: "Nu 1", gender: "Nữ", level: 4 },
  { id: "6", name: "Nu 2", gender: "Nữ", level: 3.5 },
  { id: "7", name: "Nu 3", gender: "Nữ", level: 3 },
  { id: "8", name: "Nu 4", gender: "Nữ", level: 2.5 },
];

function seedAuthority({ courts = [], dailyPlay = null, permissions } = {}) {
  const authority = createInMemoryDailyPlayAuthority({
    tenantId: TENANT,
    permissions,
  });
  authority.__seedTournament(
    createSeededDailyPlayTournament({
      id: TID,
      tenantId: TENANT,
      clubId: CLUB,
      dailyPlay: dailyPlay || {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: canonicalPlayers.map((p) => p.id),
        revision: 0,
      },
    })
  );
  authority.__setClubCourts(CLUB, courts);
  const service = createDailyPlayCanonicalService({ rpc: authority.rpc });
  __setDailyPlayCanonicalServiceForTests(service);
  return { authority, service };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  loadClubData(DEFAULT_CLUB.id);
  __resetDailyPlayCanonicalServiceForTests();
});

afterEach(() => {
  __resetDailyPlayCanonicalServiceForTests();
});

test("toggleDailyCheckIn adds and removes player", () => {
  let settings = getDefaultDailyPlaySettings();
  settings = toggleDailyCheckIn(settings, 1);
  assert.deepEqual(settings.checkedInPlayerIds, ["1"]);
  settings = toggleDailyCheckIn(settings, 1);
  assert.deepEqual(settings.checkedInPlayerIds, []);
});

test("resolveDailyCompetitionType auto picks mixed when enough genders", () => {
  const type = resolveDailyCompetitionType(DAILY_MATCH_TYPE.AUTO, players);
  assert.equal(type, "doubles_mixed");
});

test("getBusyPlayerIdsFromDailyMatches tracks active players", () => {
  const busy = getBusyPlayerIdsFromDailyMatches([
    {
      status: MATCH_STATUS.PLAYING,
      teamAPlayerIds: ["1", "2"],
      teamBPlayerIds: ["3", "4"],
    },
    {
      status: MATCH_STATUS.COMPLETED,
      teamAPlayerIds: ["5", "6"],
      teamBPlayerIds: ["7", "8"],
    },
  ]);

  assert.equal(busy.has("1"), true);
  assert.equal(busy.has("5"), false);
});

test("createFairDailyMatches builds waiting matches for mixed doubles", async () => {
  const settings = {
    ...getDefaultDailyPlaySettings(),
    checkedInPlayerIds: players.map((player) => String(player.id)),
    matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    genderFilter: DAILY_GENDER_FILTER.ALL,
  };

  const result = await createFairDailyMatches({
    players,
    settings,
    tournamentId: "t1",
    matchCount: 1,
    skipPrivatePairingPrepare: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].status, MATCH_STATUS.WAITING);
  assert.equal(result.matches[0].teamAPlayerIds.length, 2);
  assert.equal(result.matches[0].teamBPlayerIds.length, 2);
});

test("createFairDailyMatches does not reuse busy players", async () => {
  const settings = {
    ...getDefaultDailyPlaySettings(),
    checkedInPlayerIds: players.map((player) => String(player.id)),
    matchType: DAILY_MATCH_TYPE.MEN_DOUBLE,
    matches: [
      {
        id: "m-busy",
        status: MATCH_STATUS.PLAYING,
        teamAPlayerIds: ["1", "2"],
        teamBPlayerIds: ["3", "4"],
      },
    ],
  };

  const result = await createFairDailyMatches({
    players,
    settings,
    tournamentId: "t1",
    matchCount: 1,
    skipPrivatePairingPrepare: true,
  });

  assert.equal(result.ok, false);
});

test("createFairDailyMatches refuses matchCount 0", async () => {
  const result = await createFairDailyMatches({
    players,
    settings: {
      ...getDefaultDailyPlaySettings(),
      checkedInPlayerIds: players.map((player) => String(player.id)),
    },
    matchCount: 0,
    skipPrivatePairingPrepare: true,
  });
  assert.equal(result.ok, false);
});

test("assignDailyMatchToCourt puts waiting match on available court", () => {
  const settings = {
    ...getDefaultDailyPlaySettings(),
    matches: [
      {
        id: "m1",
        status: MATCH_STATUS.WAITING,
        teamAPlayerIds: ["1", "2"],
        teamBPlayerIds: ["3", "4"],
        teamALabel: "A",
        teamBLabel: "B",
      },
    ],
  };

  const result = assignDailyMatchToCourt({
    settings,
    courts: [{ id: 10, name: "San 1", active: true }],
    matchId: "m1",
    lockedCourtIds: [],
  });

  assert.equal(result.ok, true);
  const assigned = result.settings.matches.find((item) => item.id === "m1");
  assert.equal(assigned.courtId, "10");
  assert.equal(assigned.status, MATCH_STATUS.PLAYING);
});

test("submitDailyPlayMatchScore completes match", () => {
  const settings = {
    ...getDefaultDailyPlaySettings(),
    matches: [
      {
        id: "m1",
        status: MATCH_STATUS.PLAYING,
        courtId: 10,
        teamAPlayerIds: ["1", "2"],
        teamBPlayerIds: ["3", "4"],
      },
    ],
  };

  const result = submitDailyPlayMatchScore(settings, "m1", { scoreA: 11, scoreB: 6 });
  assert.equal(result.ok, true);
  assert.equal(result.match.status, MATCH_STATUS.COMPLETED);
  assert.equal(result.match.winnerSide, "A");
});

test("partitionDailyMatches splits lists", () => {
  const grouped = partitionDailyMatches([
    { id: "1", status: MATCH_STATUS.WAITING },
    { id: "2", status: MATCH_STATUS.PLAYING },
    { id: "3", status: MATCH_STATUS.COMPLETED },
    { id: "4", status: "cancelled" },
  ]);

  assert.equal(grouped.waiting.length, 1);
  assert.equal(grouped.playing.length, 1);
  assert.equal(grouped.completed.length, 2);
});

describe("Daily Play canonical — court capability + create", () => {
  test("no canonical courts → no match created (DP-01)", async () => {
    const { service } = seedAuthority({ courts: [] });
    const plan = resolveCreateMatchCount({
      enabledCourts: [],
      availableCourts: [],
      eligiblePlayerCount: 16,
    });
    assert.equal(plan.ok, false);
    assert.equal(plan.code, DAILY_PLAY_CODE.NO_COURT_CAPABILITY);

    const create = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matches: [
          {
            id: "m1",
            teamAPlayerIds: ["1", "5"],
            teamBPlayerIds: ["2", "6"],
            status: "waiting",
          },
        ],
        expectedVersion: 0,
        eligiblePlayerCount: 8,
        idempotencyKey: "create-no-court",
      }
    );
    assert.equal(create.ok, false);
    assert.equal(create.code, DAILY_PLAY_CODE.NO_COURT_CAPABILITY);
  });

  test("courts exist but busy → waiting create allowed", () => {
    const courts = [
      { id: "c1", name: "S1", active: true },
      { id: "c2", name: "S2", active: true },
    ];
    const plan = resolveCreateMatchCount({
      enabledCourts: courts,
      availableCourts: [],
      eligiblePlayerCount: 8,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.waitingForCourt, true);
    assert.match(plan.message, /chờ sân/i);
  });

  test("canonical court load returns server courts (F5 semantics)", async () => {
    const { service } = seedAuthority({
      courts: [
        { id: "court-a", name: "Sân A", active: true },
        { id: "court-b", name: "Sân B", active: true, status: "maintenance" },
      ],
    });
    const state = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(state.ok, true);
    assert.equal(state.courts.length, 1);
    assert.equal(state.courts[0].id, "court-a");
    assert.equal(state.hasCourtCapability, true);
  });
});

describe("Daily Play canonical — concurrency invariants", () => {
  test("same court concurrent assignment → one succeeds one rejects", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
      dailyPlay: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: ["1", "2", "3", "4", "5", "6", "7", "8"],
        revision: 0,
        matches: [
          {
            id: "m1",
            status: "waiting",
            teamAPlayerIds: ["1", "5"],
            teamBPlayerIds: ["2", "6"],
          },
          {
            id: "m2",
            status: "waiting",
            teamAPlayerIds: ["3", "7"],
            teamBPlayerIds: ["4", "8"],
          },
        ],
      },
    });

    const first = await service.assignCourt(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { matchId: "m1", courtId: "c1", expectedVersion: 0, idempotencyKey: "a1" }
    );
    assert.equal(first.ok, true);
    const second = await service.assignCourt(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m2",
        courtId: "c1",
        expectedVersion: first.revision,
        idempotencyKey: "a2",
      }
    );
    assert.equal(second.ok, false);
    assert.equal(second.code, DAILY_PLAY_CODE.COURT_ALREADY_LEASED);
  });

  test("same player double-active rejected on create", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
      dailyPlay: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: ["1", "2", "3", "4", "5", "6", "7", "8"],
        revision: 0,
        matches: [
          {
            id: "m-active",
            status: "playing",
            courtId: "c1",
            teamAPlayerIds: ["1", "5"],
            teamBPlayerIds: ["2", "6"],
          },
        ],
      },
    });
    const create = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matches: [
          {
            id: "m-dup",
            teamAPlayerIds: ["1", "7"],
            teamBPlayerIds: ["3", "8"],
            status: "waiting",
          },
        ],
        expectedVersion: 0,
        idempotencyKey: "dup-player",
      }
    );
    assert.equal(create.ok, false);
    assert.equal(create.code, DAILY_PLAY_CODE.PLAYER_ALREADY_ACTIVE);
  });

  test("stale expectedVersion → VERSION_CONFLICT", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
    });
    await service.checkIn(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { playerId: "99", expectedVersion: 0, idempotencyKey: "ci-1" }
    );
    const stale = await service.checkIn(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { playerId: "100", expectedVersion: 0, idempotencyKey: "ci-2" }
    );
    assert.equal(stale.ok, false);
    assert.equal(stale.code, DAILY_PLAY_CODE.VERSION_CONFLICT);
  });
});

describe("Daily Play canonical — idempotency + score + cancel + change court", () => {
  test("duplicate create idempotency replays", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
    });
    const args = {
      matches: [
        {
          id: "m-idem",
          teamAPlayerIds: ["1", "5"],
          teamBPlayerIds: ["2", "6"],
          status: "waiting",
        },
      ],
      expectedVersion: 0,
      idempotencyKey: "create-once",
    };
    const first = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      args
    );
    assert.equal(first.ok, true);
    const second = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { ...args, expectedVersion: 0 }
    );
    assert.equal(second.ok, true);
  });

  test("score finalize identical retry + conflicting reject", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
      dailyPlay: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: ["1", "2", "3", "4"],
        revision: 0,
        matches: [
          {
            id: "m-score",
            status: "playing",
            courtId: "c1",
            teamAPlayerIds: ["1", "2"],
            teamBPlayerIds: ["3", "4"],
          },
        ],
      },
    });
    const first = await service.submitScore(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-score",
        scoreA: 11,
        scoreB: 5,
        expectedVersion: 0,
        idempotencyKey: "score-1",
      }
    );
    assert.equal(first.ok, true);
    assert.equal(first.ratingVprApplied, false);

    const replay = await service.submitScore(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-score",
        scoreA: 11,
        scoreB: 5,
        expectedVersion: first.revision,
        idempotencyKey: "score-1b",
      }
    );
    assert.equal(replay.ok, true);
    assert.equal(replay.replay, true);

    const conflict = await service.submitScore(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-score",
        scoreA: 11,
        scoreB: 7,
        expectedVersion: first.revision,
        idempotencyKey: "score-2",
      }
    );
    assert.equal(conflict.ok, false);
    assert.equal(conflict.code, DAILY_PLAY_CODE.SCORE_CONFLICT);
  });

  test("cancel releases court/player; change court atomic", async () => {
    const { service } = seedAuthority({
      courts: [
        { id: "c1", name: "S1", active: true },
        { id: "c2", name: "S2", active: true },
      ],
      dailyPlay: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: canonicalPlayers.map((p) => p.id),
        revision: 0,
        matches: [
          {
            id: "m1",
            status: "playing",
            courtId: "c1",
            teamAPlayerIds: ["1", "5"],
            teamBPlayerIds: ["2", "6"],
          },
          {
            id: "m2",
            status: "playing",
            courtId: "c2",
            teamAPlayerIds: ["3", "7"],
            teamBPlayerIds: ["4", "8"],
          },
        ],
      },
    });

    const changeFail = await service.changeCourt(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m1",
        courtId: "c2",
        expectedVersion: 0,
        idempotencyKey: "chg-fail",
      }
    );
    assert.equal(changeFail.ok, false);
    assert.equal(changeFail.code, DAILY_PLAY_CODE.COURT_ALREADY_LEASED);

    const cancelled = await service.cancelMatch(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { matchId: "m2", expectedVersion: 0, idempotencyKey: "cancel-m2" }
    );
    assert.equal(cancelled.ok, true);

    const changeOk = await service.changeCourt(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m1",
        courtId: "c2",
        expectedVersion: cancelled.revision,
        idempotencyKey: "chg-ok",
      }
    );
    assert.equal(changeOk.ok, true);
  });

  test("check-out active player rejected", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
      dailyPlay: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: ["1", "2", "3", "4"],
        revision: 0,
        matches: [
          {
            id: "m1",
            status: "playing",
            courtId: "c1",
            teamAPlayerIds: ["1", "2"],
            teamBPlayerIds: ["3", "4"],
          },
        ],
      },
    });
    const result = await service.checkOut(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { playerId: "1", expectedVersion: 0, idempotencyKey: "out-1" }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, DAILY_PLAY_CODE.CHECKOUT_PLAYER_ACTIVE);
  });
});

describe("Daily Play canonical — auth/tenant + static guards", () => {
  test("tenant isolation + unauthorized mutation rejected", async () => {
    const authority = createInMemoryDailyPlayAuthority({
      tenantId: TENANT,
      permissions: ["tournament.view"],
    });
    authority.__seedTournament(
      createSeededDailyPlayTournament({
        id: TID,
        tenantId: TENANT,
        clubId: CLUB,
      })
    );
    authority.__setClubCourts(CLUB, [{ id: "c1", active: true }]);
    const service = createDailyPlayCanonicalService({ rpc: authority.rpc });

    const forbidden = await service.checkIn(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { playerId: "1", expectedVersion: 0, idempotencyKey: "f1" }
    );
    assert.equal(forbidden.ok, false);
    assert.equal(forbidden.code, DAILY_PLAY_CODE.FORBIDDEN);

    const crossTenant = await service.getState({
      tenantId: "other-tenant",
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(crossTenant.ok, false);
    assert.equal(crossTenant.code, DAILY_PLAY_CODE.TENANT_FORBIDDEN);
  });

  test("fair animation has one presentation path (no prelude)", () => {
    assert.equal(hasEffectPrelude(ANIMATION_MODES.DAILY_FAIR_MATCH), false);
  });

  test("score validation rejects draws", () => {
    assert.equal(validateScoreInput(11, 11).ok, false);
    assert.equal(validateScoreInput(11, 5).ok, true);
  });

  test("DailyPlaySetup does not use blob court authority", () => {
    const setupPath = path.resolve("src/pages/tournament/DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.equal(source.includes("loadCourtsForClub"), false);
    assert.equal(source.includes("getDirectorState"), false);
    assert.equal(source.includes("lockCourt"), false);
    assert.equal(source.includes("localStorage"), false);
    assert.match(source, /useDailyPlayCanonicalSession/);
    assert.match(source, /createMatches/);
  });

  test("NO_COURT_CAPABILITY message is Vietnamese domain copy", () => {
    assert.match(
      DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_CAPABILITY],
      /Chưa có sân/
    );
  });
});

describe("Daily Play RPC name contract", () => {
  test("exports stable RPC names matching SQL package", () => {
    assert.equal(DAILY_PLAY_RPC.GET_STATE, "daily_play_get_state");
    assert.equal(DAILY_PLAY_RPC.CREATE_MATCHES, "daily_play_create_matches");
    assert.equal(DAILY_PLAY_RPC.ASSIGN_COURT, "daily_play_assign_court");
    assert.equal(DAILY_PLAY_RPC.SUBMIT_SCORE, "daily_play_submit_score");
    assert.equal(DAILY_PLAY_RPC.CANCEL_MATCH, "daily_play_cancel_match");
    assert.equal(DAILY_PLAY_RPC.CHANGE_COURT, "daily_play_change_court");
  });
});

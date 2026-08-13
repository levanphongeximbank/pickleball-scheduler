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
  normalizeDailyPlayServerSnapshot,
  isFullDailyPlaySnapshot,
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

function seedAuthority({
  courts = [],
  dailyPlay = null,
  permissions,
  eligibleIds = null,
} = {}) {
  const authority = createInMemoryDailyPlayAuthority({
    tenantId: TENANT,
    permissions,
  });
  const eligible =
    eligibleIds ||
    [
      ...canonicalPlayers.map((p) => p.id),
      "99",
      "100",
      ...(dailyPlay?.checkedInPlayerIds || []),
    ];
  authority.__setEligibleAthletes(TENANT, CLUB, eligible);
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
  assert.equal(assigned.status, MATCH_STATUS.ASSIGNED);
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

test("partitionDailyMatches splits waiting/assigned/playing", () => {
  const grouped = partitionDailyMatches([
    { id: "1", status: MATCH_STATUS.WAITING },
    { id: "2", status: MATCH_STATUS.ASSIGNED },
    { id: "3", status: MATCH_STATUS.PLAYING },
    { id: "4", status: MATCH_STATUS.COMPLETED },
    { id: "5", status: "cancelled" },
  ]);

  assert.equal(grouped.waiting.length, 1);
  assert.equal(grouped.assigned.length, 1);
  assert.equal(grouped.playing.length, 1);
  assert.equal(grouped.completed.length, 2);
  assert.equal(grouped.playing[0].id, "3");
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
    const afterChange = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(afterChange.ok, true);
    assert.equal(
      afterChange.dailyPlay.matches.find((m) => m.id === "m1").status,
      "playing"
    );
    assert.equal(
      afterChange.dailyPlay.matches.find((m) => m.id === "m1").courtId,
      "c2"
    );
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
    assert.equal(DAILY_PLAY_RPC.START_MATCH, "daily_play_start_match");
    assert.equal(DAILY_PLAY_RPC.SUBMIT_SCORE, "daily_play_submit_score");
    assert.equal(DAILY_PLAY_RPC.CANCEL_MATCH, "daily_play_cancel_match");
    assert.equal(DAILY_PLAY_RPC.CHANGE_COURT, "daily_play_change_court");
  });
});

describe("Daily Play lifecycle hardening — waiting→assigned→playing→completed", () => {
  test("create stays waiting without lease; assign then start then score", async () => {
    const { service } = seedAuthority({
      courts: [
        { id: "c1", name: "S1", active: true },
        { id: "c2", name: "S2", active: true },
      ],
    });

    const created = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matches: [
          {
            id: "m-life",
            teamAPlayerIds: ["1", "5"],
            teamBPlayerIds: ["2", "6"],
            status: "waiting",
          },
        ],
        expectedVersion: 0,
        idempotencyKey: "life-create",
      }
    );
    assert.equal(created.ok, true);
    assert.equal(created.matches[0].status, "waiting");
    assert.equal(created.matches[0].courtId, null);

    const assigned = await service.assignCourt(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-life",
        courtId: "c1",
        expectedVersion: created.revision,
        idempotencyKey: "life-assign",
      }
    );
    assert.equal(assigned.ok, true);
    assert.equal(assigned.dailyPlay.matches.find((m) => m.id === "m-life").status, "assigned");
    const partAfterAssign = partitionDailyMatches(assigned.dailyPlay.matches);
    assert.equal(partAfterAssign.assigned.length, 1);
    assert.equal(partAfterAssign.playing.length, 0);

    const started = await service.startMatch(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-life",
        expectedVersion: assigned.revision,
        idempotencyKey: "life-start",
      }
    );
    assert.equal(started.ok, true);
    assert.equal(started.dailyPlay.matches.find((m) => m.id === "m-life").status, "playing");
    const partAfterStart = partitionDailyMatches(started.dailyPlay.matches);
    assert.equal(partAfterStart.playing.length, 1);
    assert.equal(partAfterStart.assigned.length, 0);

    const scored = await service.submitScore(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-life",
        scoreA: 11,
        scoreB: 4,
        expectedVersion: started.revision,
        idempotencyKey: "life-score",
      }
    );
    assert.equal(scored.ok, true);
    assert.equal(scored.match.status, "completed");
  });

  test("score waiting and assigned rejected with MATCH_NOT_PLAYING", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
      dailyPlay: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: ["1", "2", "3", "4"],
        revision: 0,
        matches: [
          {
            id: "m-wait",
            status: "waiting",
            teamAPlayerIds: ["1", "2"],
            teamBPlayerIds: ["3", "4"],
          },
        ],
      },
    });

    const waitingScore = await service.submitScore(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-wait",
        scoreA: 11,
        scoreB: 5,
        expectedVersion: 0,
        idempotencyKey: "score-wait",
      }
    );
    assert.equal(waitingScore.ok, false);
    assert.equal(waitingScore.code, DAILY_PLAY_CODE.MATCH_NOT_PLAYING);

    const assigned = await service.assignCourt(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-wait",
        courtId: "c1",
        expectedVersion: 0,
        idempotencyKey: "assign-for-score-reject",
      }
    );
    assert.equal(assigned.ok, true);
    assert.equal(assigned.dailyPlay.matches[0].status, "assigned");

    const assignedScore = await service.submitScore(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-wait",
        scoreA: 11,
        scoreB: 5,
        expectedVersion: assigned.revision,
        idempotencyKey: "score-assigned",
      }
    );
    assert.equal(assignedScore.ok, false);
    assert.equal(assignedScore.code, DAILY_PLAY_CODE.MATCH_NOT_PLAYING);
  });

  test("random / non-canonical check-in rejected", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
      eligibleIds: ["1", "2", "3", "4"],
      dailyPlay: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: [],
        revision: 0,
      },
    });

    const rejected = await service.checkIn(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        playerId: "random-athlete-xyz",
        expectedVersion: 0,
        idempotencyKey: "ci-random",
      }
    );
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, DAILY_PLAY_CODE.PLAYER_NOT_ELIGIBLE);
  });

  test("malformed 2/3-player doubles rejected; valid 4 accepted", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
    });

    const two = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matches: [
          {
            id: "m-2p",
            teamAPlayerIds: ["1"],
            teamBPlayerIds: ["2"],
            status: "waiting",
          },
        ],
        expectedVersion: 0,
        idempotencyKey: "shape-2",
      }
    );
    assert.equal(two.ok, false);
    assert.equal(two.code, DAILY_PLAY_CODE.INVALID_MATCH_SHAPE);

    const three = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matches: [
          {
            id: "m-3p",
            teamAPlayerIds: ["1", "5"],
            teamBPlayerIds: ["2"],
            status: "waiting",
          },
        ],
        expectedVersion: 0,
        idempotencyKey: "shape-3",
      }
    );
    assert.equal(three.ok, false);
    assert.equal(three.code, DAILY_PLAY_CODE.INVALID_MATCH_SHAPE);

    const four = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matches: [
          {
            id: "m-4p",
            teamAPlayerIds: ["1", "5"],
            teamBPlayerIds: ["2", "6"],
            status: "waiting",
          },
        ],
        expectedVersion: 0,
        idempotencyKey: "shape-4",
      }
    );
    assert.equal(four.ok, true);
    assert.equal(four.matches[0].status, "waiting");
  });

  test("cross-club athlete rejected on check-in", async () => {
    const { authority, service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
      eligibleIds: ["1", "2", "3", "4"],
      dailyPlay: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: [],
        revision: 0,
      },
    });
    authority.__setEligibleAthletes(TENANT, "other-club", ["99"]);

    const rejected = await service.checkIn(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { playerId: "99", expectedVersion: 0, idempotencyKey: "ci-xclub" }
    );
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, DAILY_PLAY_CODE.PLAYER_NOT_ELIGIBLE);
  });

  test("cancel waiting/assigned/playing releases reservation", async () => {
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
            id: "m-w",
            status: "waiting",
            teamAPlayerIds: ["1", "5"],
            teamBPlayerIds: ["2", "6"],
          },
        ],
      },
    });

    const cancelWaiting = await service.cancelMatch(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { matchId: "m-w", expectedVersion: 0, idempotencyKey: "cancel-w" }
    );
    assert.equal(cancelWaiting.ok, true);

    const createAfter = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matches: [
          {
            id: "m-reuse",
            teamAPlayerIds: ["1", "5"],
            teamBPlayerIds: ["2", "6"],
            status: "waiting",
          },
        ],
        expectedVersion: cancelWaiting.revision,
        idempotencyKey: "reuse-after-cancel",
      }
    );
    assert.equal(createAfter.ok, true);
  });
});

describe("Daily Play SQL package contract parity", () => {
  const applyPath = path.resolve(
    "docs/v5/migrations/daily-play-end-to-end-canonical-01/02_APPLY.sql"
  );
  const verifyPath = path.resolve(
    "docs/v5/migrations/daily-play-end-to-end-canonical-01/03_VERIFY.sql"
  );
  const applySql = fs.readFileSync(applyPath, "utf8");
  const verifySql = fs.readFileSync(verifyPath, "utf8");

  test("create_matches forces waiting and does not insert leases", () => {
    const createFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_create_matches"),
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_assign_court")
    );
    assert.match(createFn, /\{status\}','"waiting"'/);
    assert.match(createFn, /\{courtId\}','null'/);
    assert.equal(createFn.includes("INSERT INTO public.daily_play_court_leases"), false);
    assert.match(createFn, /jsonb_array_length\(v_players\)<>4/);
    assert.match(createFn, /PLAYER_NOT_ELIGIBLE/);
    assert.match(createFn, /INVALID_MATCH_SHAPE/);
  });

  test("assign_court is waiting→assigned with lease insert", () => {
    const assignFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_assign_court"),
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_start_match")
    );
    assert.match(assignFn, /MATCH_NOT_WAITING/);
    assert.match(assignFn, /\{status\}','"assigned"'/);
    assert.match(assignFn, /INSERT INTO public\.daily_play_court_leases/);
  });

  test("start_match is assigned→playing and requires active lease", () => {
    assert.match(applySql, /CREATE OR REPLACE FUNCTION public\.daily_play_start_match/);
    const startFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_start_match"),
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_submit_score")
    );
    assert.match(startFn, /MATCH_NOT_ASSIGNED/);
    assert.match(startFn, /COURT_LEASE_NOT_ACTIVE/);
    assert.match(startFn, /\{status\}','"playing"'/);
    assert.match(verifySql, /daily_play_start_match/);
  });

  test("submit_score requires playing (MATCH_NOT_PLAYING)", () => {
    const scoreFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_submit_score"),
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_cancel_match")
    );
    assert.match(scoreFn, /MATCH_NOT_PLAYING/);
    assert.match(scoreFn, /IS DISTINCT FROM 'playing'/);
  });

  test("change_court preserves status (no forced assigned)", () => {
    const changeFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_change_court"),
      applySql.indexOf("-- Helpers are internal")
    );
    assert.match(changeFn, /NOT IN \('assigned','playing'\)/);
    assert.equal(changeFn.includes("jsonb_set(v_m,'{status}','\"assigned\"'"), false);
    assert.match(changeFn, /INSERT INTO public\.daily_play_court_leases/);
  });

  test("athlete eligibility helper reuses athletes + club_members", () => {
    assert.match(applySql, /daily_play_athlete_eligible_for_club/);
    assert.match(applySql, /FROM public\.athletes a/);
    assert.match(applySql, /JOIN public\.club_members cm/);
    assert.match(applySql, /REVOKE ALL ON FUNCTION public\.daily_play_athlete_eligible_for_club/);
  });

  test("setup UI wires startMatch and does not treat assigned as playing bucket", () => {
    const setupPath = path.resolve("src/pages/tournament/DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.match(source, /startMatch/);
    assert.match(source, /Bắt đầu trận/);
    assert.match(source, /waitingQueue/);
    assert.match(source, /match\.status === "assigned"/);
    assert.match(source, /matches=\{playing\}/);
  });
});

describe("Daily Play SQL response-contract adapter (DP-03/DP-04)", () => {
  test("SQL-like get_state normalizes state/activeLeases into client contract", () => {
    const normalized = normalizeDailyPlayServerSnapshot({
      ok: true,
      tournamentId: TID,
      state: {
        revision: 7,
        checkedInPlayerIds: ["athlete-1"],
        matches: [],
      },
      courts: [{ id: "court-1", name: "Sân 1", active: true }],
      activeLeases: [],
    });

    assert.equal(normalized.ok, true);
    assert.equal(normalized.revision, 7);
    assert.deepEqual(normalized.dailyPlay.checkedInPlayerIds, ["athlete-1"]);
    assert.equal(normalized.courts.length, 1);
    assert.equal(normalized.hasCourtCapability, true);
    assert.equal(normalized.availableCourts.length, 1);
    assert.equal(normalized.leases.length, 0);
    assert.equal(normalized.courtStates.length, 1);
  });

  test("service getState maps SQL shape and expectedVersion follows revision", async () => {
    let lastExpected = null;
    const sqlState = {
      ok: true,
      tournamentId: TID,
      state: {
        revision: 7,
        checkedInPlayerIds: ["athlete-1"],
        matches: [],
      },
      courts: [{ id: "court-1", name: "Sân 1", active: true }],
      activeLeases: [],
    };
    const service = createDailyPlayCanonicalService({
      async rpc(name, args) {
        if (name === DAILY_PLAY_RPC.GET_STATE) return sqlState;
        if (name === DAILY_PLAY_RPC.CHECK_IN) {
          lastExpected = args.p_expected_version;
          return {
            ok: true,
            revision: 8,
            state: {
              revision: 8,
              checkedInPlayerIds: ["athlete-1", "athlete-2"],
              matches: [],
            },
          };
        }
        return { ok: false, code: "UNEXPECTED" };
      },
    });

    const state = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(state.revision, 7);
    assert.equal(state.hasCourtCapability, true);
    assert.equal(isFullDailyPlaySnapshot(state), true);

    const compact = await service.checkIn(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { playerId: "athlete-2", expectedVersion: state.revision, idempotencyKey: "ci-sql" }
    );
    assert.equal(lastExpected, 7);
    assert.equal(compact.ok, true);
    assert.equal(isFullDailyPlaySnapshot(compact), false);
    assert.equal(Array.isArray(compact.courts), false);
  });

  test("activeLeases mark court unavailable", () => {
    const normalized = normalizeDailyPlayServerSnapshot({
      ok: true,
      tournamentId: TID,
      state: {
        revision: 2,
        checkedInPlayerIds: [],
        matches: [
          {
            id: "m1",
            status: "assigned",
            courtId: "court-1",
            teamAPlayerIds: ["1", "2"],
            teamBPlayerIds: ["3", "4"],
          },
        ],
      },
      courts: [
        { id: "court-1", name: "S1", active: true },
        { id: "court-2", name: "S2", active: true },
      ],
      activeLeases: [{ matchId: "m1", courtId: "court-1", leasedAt: "2026-08-12T00:00:00Z" }],
    });

    assert.equal(normalized.leases[0].status, "active");
    assert.equal(normalized.availableCourts.map((c) => c.id).join(","), "court-2");
    assert.equal(normalized.hasCourtCapability, true);
  });

  test("empty courts => hasCourtCapability false", () => {
    const normalized = normalizeDailyPlayServerSnapshot({
      ok: true,
      tournamentId: TID,
      state: { revision: 1, checkedInPlayerIds: [], matches: [] },
      courts: [],
      activeLeases: [],
    });
    assert.equal(normalized.hasCourtCapability, false);
    assert.equal(normalized.availableCourts.length, 0);
  });

  test("in-memory rich snapshot remains compatible after normalize", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
    });
    const state = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(state.ok, true);
    assert.equal(state.hasCourtCapability, true);
    assert.ok(state.dailyPlay);
    assert.equal(typeof state.revision, "number");
    assert.equal(Array.isArray(state.courtStates), true);
  });

  test("SQL package get_state returns state + activeLeases keys", () => {
    const applyPath = path.resolve(
      "docs/v5/migrations/daily-play-end-to-end-canonical-01/02_APPLY.sql"
    );
    const applySql = fs.readFileSync(applyPath, "utf8");
    const snapFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_snapshot"),
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_get_state")
    );
    assert.match(snapFn, /'state'/);
    assert.match(snapFn, /'activeLeases'/);
    assert.match(snapFn, /'courts'/);
    assert.equal(snapFn.includes("'dailyPlay'"), false);
    assert.equal(snapFn.includes("'hasCourtCapability'"), false);
  });

  test("session hook uses background poll + mutation get_state readback", () => {
    const hookPath = path.resolve(
      "src/features/daily-play/canonical/useDailyPlayCanonicalSession.js"
    );
    const source = fs.readFileSync(hookPath, "utf8");
    assert.match(source, /normalizeDailyPlayServerSnapshot/);
    assert.match(source, /refresh\(\{\s*background:\s*true\s*\}\)/);
    assert.match(source, /setRefreshing/);
    assert.match(source, /READBACK_FAILED/);
    assert.match(source, /mutationCommitted:\s*true/);
    // Must not apply compact mutation payloads as session snapshots.
    assert.equal(/if \(result\?\.ok\) \{\s*applySnapshot\(result\)/.test(source), false);
    assert.match(source, /pollMs/);
    assert.match(source, /background && hasSnapshotRef/);
  });

  test("VERSION_CONFLICT triggers background refresh path", () => {
    const hookPath = path.resolve(
      "src/features/daily-play/canonical/useDailyPlayCanonicalSession.js"
    );
    const source = fs.readFileSync(hookPath, "utf8");
    assert.match(source, /VERSION_CONFLICT/);
    assert.match(
      source,
      /VERSION_CONFLICT[\s\S]*refresh\(\{\s*background:\s*true\s*\}\)/
    );
  });
});

describe("Daily Play Owner browser UX remediation (DP-05..DP-09)", () => {
  test("setup does not reload tournament/clubs after Daily session mutations (DP-05)", () => {
    const setupPath = path.resolve("src/pages/tournament/DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.equal(source.includes("afterMutation"), false);
    assert.equal(source.includes("setLocalRevision"), false);
    assert.equal(source.includes("refreshClubs"), false);
    assert.match(source, /useCanonicalTournament\([^,]+,\s*tournamentId,\s*0\)/);
    assert.match(source, /revision:\s*0/);
    assert.equal(/revision:\s*localRevision\s*\+\s*\(session\.revision/.test(source), false);
    assert.equal(/revision:\s*.*session\.revision/.test(source), false);
  });

  test("candidate pool is not invalidated by Daily session.revision (DP-05/G)", () => {
    const setupPath = path.resolve("src/pages/tournament/DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.match(source, /useClubPairingCandidatePool\(activeClubId,\s*\{\s*revision:\s*0,\s*\}\)/);
  });

  test("session hook keeps live revisionRef and bulk CAS chain (DP-06/E/F)", () => {
    const hookPath = path.resolve(
      "src/features/daily-play/canonical/useDailyPlayCanonicalSession.js"
    );
    const source = fs.readFileSync(hookPath, "utf8");
    assert.match(source, /revisionRef/);
    assert.match(source, /revisionRef\.current\s*=\s*Number\(normalized\.revision/);
    assert.match(source, /expectedVersion:\s*revisionRef\.current/);
    assert.match(source, /checkInMany/);
    assert.match(source, /checkOutMany/);
    assert.match(source, /runBulkPresence/);
    assert.equal(source.includes("Promise.all"), false);
    assert.match(source, /for \(const playerId of ids\)/);
    assert.match(source, /expected = Number\(result\.revision\)/);
    assert.match(source, /refresh\(\{\s*background:\s*true\s*\}\)/);
  });

  test("Select All / Clear All use bulk helpers with pending labels (DP-06)", () => {
    const setupPath = path.resolve("src/pages/tournament/DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.match(source, /checkInMany/);
    assert.match(source, /checkOutMany/);
    assert.match(source, /Đang chọn\.\.\./);
    assert.match(source, /Đang bỏ chọn\.\.\./);
    assert.equal(
      /for \(const player of players\)[\s\S]*session\.checkIn\(player\.id\)/.test(source),
      false
    );
  });

  test("sequential check-in of 8 athletes chains revision without stale conflict (DP-06)", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
      dailyPlay: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: [],
        revision: 0,
      },
    });
    const scope = { tenantId: TENANT, clubId: CLUB, tournamentId: TID };
    let expected = (await service.getState(scope)).revision;
    const targets = canonicalPlayers.map((player) => player.id);
    assert.equal(targets.length, 8);

    const expectedVersions = [];
    for (const playerId of targets) {
      expectedVersions.push(expected);
      const result = await service.checkIn(scope, {
        playerId,
        expectedVersion: expected,
        idempotencyKey: `bulk-${playerId}-${expected}`,
      });
      assert.equal(result.ok, true, `check-in ${playerId} failed: ${result.error || result.code}`);
      expected = Number(result.revision);
    }

    assert.deepEqual(expectedVersions, [0, 1, 2, 3, 4, 5, 6, 7]);
    const finalState = await service.getState(scope);
    assert.equal(finalState.dailyPlay.checkedInPlayerIds.length, 8);
    assert.equal(finalState.revision, 8);
  });

  test("stale expectedVersion still VERSION_CONFLICT (CAS preserved)", async () => {
    const { service } = seedAuthority({
      courts: [{ id: "c1", name: "S1", active: true }],
      dailyPlay: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: [],
        revision: 0,
      },
    });
    const scope = { tenantId: TENANT, clubId: CLUB, tournamentId: TID };
    const first = await service.checkIn(scope, {
      playerId: "1",
      expectedVersion: 0,
      idempotencyKey: "ci-1",
    });
    assert.equal(first.ok, true);
    const stale = await service.checkIn(scope, {
      playerId: "2",
      expectedVersion: 0,
      idempotencyKey: "ci-2-stale",
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, DAILY_PLAY_CODE.VERSION_CONFLICT);
  });

  test("initial loading gate keeps shell once snapshot exists (DP-05/D)", () => {
    const setupPath = path.resolve("src/pages/tournament/DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.match(
      source,
      /\(tournamentLoading && !tournament\) \|\| \(session\.loading && !session\.state\)/
    );
    assert.equal(
      /if \(tournamentLoading \|\| session\.loading\) \{/.test(source),
      false
    );
  });

  test("error banner ownership does not sticky-mirror session.error (DP-08)", () => {
    const setupPath = path.resolve("src/pages/tournament/DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.match(source, /displayError/);
    assert.match(source, /actionError/);
    assert.equal(
      /useEffect\(\(\) => \{\s*if \(session\.error\) \{\s*setError\(session\.error\)/.test(
        source
      ),
      false
    );
    assert.equal(
      /useEffect\(\(\) => \{\s*if \(tournamentLoadError\) \{\s*setError\(tournamentLoadError\)/.test(
        source
      ),
      false
    );
  });

  test("referee roster uses async persist + free-text contract (DP-07/I)", () => {
    const setupPath = path.resolve("src/pages/tournament/DailyPlaySetup.jsx");
    const panelPath = path.resolve("src/components/tournament/RefereeRosterPanel.jsx");
    const setup = fs.readFileSync(setupPath, "utf8");
    const panel = fs.readFileSync(panelPath, "utf8");
    assert.match(setup, /handleRefereeRosterChange/);
    assert.match(setup, /return \{ ok: true/);
    assert.match(setup, /listEligibleCanonicalReferees/);
    assert.match(setup, /enableCanonicalDirectory/);
    assert.match(panel, /Promise\.resolve\(onChange/);
    assert.match(panel, /Đang lưu\.\.\./);
    assert.match(panel, /Tài khoản trọng tài/);
    assert.match(panel, /Trọng tài khách \/ nhập tay/);
    assert.match(panel, /if \(ok\) \{\s*setName\(""\);\s*setPhone\(""\);/);
    assert.match(panel, /addCanonicalRefereeToRoster/);
  });

  test("manual referee roster entries still normalize (DP-07 backward compat)", async () => {
    const { getRefereeSettings } = await import(
      "../src/tournament/engines/refereeEngine.js"
    );
    const tournament = {
      settings: {
        refereeRoster: [{ id: "r-manual", name: "Lan Manual", phone: "090" }],
      },
    };
    const roster = getRefereeSettings(tournament).roster;
    assert.equal(roster.length, 1);
    assert.equal(roster[0].name, "Lan Manual");
    assert.equal(roster[0].source, "manual");
  });

  test("canonical referee candidate filtering (DP-07 directory)", async () => {
    const {
      filterCanonicalRefereeCandidates,
      normalizeCanonicalRefereeCandidate,
      annotateRosterEligibility,
    } = await import("../src/features/daily-play/services/refereeDirectoryService.js");
    const {
      addCanonicalRefereeToRoster,
      createRefereeRosterEntry,
      findRosterEntryByCanonicalUserId,
      normalizeRefereeRoster,
    } = await import("../src/models/tournament/refereeRoster.js");

    const rows = [
      {
        id: "u-ref-1",
        display_name: "TT Lan",
        email: "lan@venue.local",
        phone: "0901",
        role: "REFEREE",
        venue_id: "tenant-a",
        club_id: "club-a",
        status: "active",
      },
      {
        id: "u-player",
        display_name: "Player",
        role: "PLAYER",
        venue_id: "tenant-a",
        status: "active",
      },
      {
        id: "u-ref-other-tenant",
        display_name: "Other TT",
        role: "REFEREE",
        venue_id: "tenant-b",
        status: "active",
      },
      {
        id: "u-ref-inactive",
        display_name: "Inactive TT",
        role: "REFEREE",
        venue_id: "tenant-a",
        status: "suspended",
      },
      {
        id: "u-ref-other-club",
        display_name: "Other Club TT",
        role: "REFEREE",
        venue_id: "tenant-a",
        club_id: "club-b",
        status: "active",
      },
      {
        id: "u-ref-venue-wide",
        display_name: "Venue Wide TT",
        email: "wide@venue.local",
        role: "REFEREE",
        venue_id: "tenant-a",
        club_id: null,
        status: "active",
      },
    ];

    const filtered = filterCanonicalRefereeCandidates(rows, {
      tenantId: "tenant-a",
      clubId: "club-a",
    });
    assert.equal(filtered.some((r) => r.userId === "u-ref-1"), true);
    assert.equal(filtered.some((r) => r.userId === "u-ref-venue-wide"), true);
    assert.equal(filtered.some((r) => r.userId === "u-player"), false);
    assert.equal(filtered.some((r) => r.userId === "u-ref-other-tenant"), false);
    assert.equal(filtered.some((r) => r.userId === "u-ref-inactive"), false);
    assert.equal(filtered.some((r) => r.userId === "u-ref-other-club"), false);

    const candidate = normalizeCanonicalRefereeCandidate(rows[0], "tenant-a");
    assert.equal(candidate.role, "REFEREE");
    assert.equal(candidate.hasAccount, true);
    assert.equal("password" in candidate, false);
    assert.equal("token" in candidate, false);

    let roster = [];
    const add1 = addCanonicalRefereeToRoster(roster, candidate);
    assert.equal(add1.ok, true);
    roster = add1.roster;
    assert.equal(roster[0].canonicalUserId, "u-ref-1");
    assert.equal(roster[0].source, "canonical_account");

    const dup = addCanonicalRefereeToRoster(roster, candidate);
    assert.equal(dup.ok, false);
    assert.equal(dup.code, "DUPLICATE");

    const manual = createRefereeRosterEntry({ name: "Khách TT", phone: "091" });
    roster = normalizeRefereeRoster([...roster, manual]);
    assert.equal(roster.length, 2);
    assert.ok(findRosterEntryByCanonicalUserId(roster, "u-ref-1"));

    const annotated = annotateRosterEligibility(roster, [
      { userId: "someone-else" },
    ]);
    assert.equal(
      annotated.find((e) => e.canonicalUserId === "u-ref-1").eligibility,
      "unavailable"
    );
  });

  test("listEligibleCanonicalReferees auth + tenant guards (DP-07)", async () => {
    const { listEligibleCanonicalReferees } =
      await import("../src/features/daily-play/services/refereeDirectoryService.js");

    const anon = await listEligibleCanonicalReferees({
      tenantId: "tenant-a",
      actor: null,
    });
    assert.equal(anon.ok, false);
    assert.equal(anon.code, "NOT_AUTHENTICATED");

    const cross = await listEligibleCanonicalReferees({
      tenantId: "tenant-b",
      actor: {
        id: "owner-1",
        role: "COURT_OWNER",
        venueId: "tenant-a",
        tenantId: "tenant-a",
      },
      client: {
        from() {
          throw new Error("should not query cross-tenant");
        },
      },
    });
    assert.equal(cross.ok, false);
    assert.equal(cross.code, "CROSS_TENANT_DENIED");

    const rows = [
      {
        id: "u-ref-1",
        email: "lan@venue.local",
        display_name: "TT Lan",
        phone: "0901",
        role: "REFEREE",
        venue_id: "tenant-a",
        club_id: null,
        status: "active",
      },
      {
        id: "u-player",
        email: "p@venue.local",
        display_name: "Player",
        role: "PLAYER",
        venue_id: "tenant-a",
        status: "active",
      },
    ];

    const chain = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    const mockClient = {
      from() {
        return chain;
      },
    };

    const listed = await listEligibleCanonicalReferees({
      tenantId: "tenant-a",
      clubId: "club-a",
      actor: {
        id: "owner-1",
        role: "COURT_OWNER",
        venueId: "tenant-a",
        tenantId: "tenant-a",
      },
      client: mockClient,
    });
    assert.equal(listed.ok, true);
    assert.equal(listed.referees.length, 1);
    assert.equal(listed.referees[0].userId, "u-ref-1");
    assert.equal(listed.referees[0].displayName, "TT Lan");
  });

  test("Director Mode still consumes roster name/id shape (DP-07 compat)", async () => {
    const { getRefereeSettings, assignRefereeToMatch } = await import(
      "../src/tournament/engines/refereeEngine.js"
    );
    const tournament = {
      settings: {
        refereeRoster: [
          {
            id: "ref-canon-u-ref",
            name: "TT Lan",
            phone: "0901",
            email: "lan@venue.local",
            source: "canonical_account",
            canonicalUserId: "u-ref-1",
          },
          { id: "r-manual", name: "Khách", phone: "091" },
        ],
      },
    };
    const roster = getRefereeSettings(tournament).roster;
    assert.equal(roster.length, 2);
    assert.ok(roster.every((entry) => entry.id && entry.name));

    const match = assignRefereeToMatch(
      { id: "m1", status: "ready" },
      roster[0].name,
      { rosterId: roster[0].id }
    );
    assert.equal(match.referee.rosterId, roster[0].id);
    assert.equal(match.referee.name, "TT Lan");
    assert.ok(match.referee.token);
  });
});

describe("Daily Play interaction polish (DP-10)", () => {
  test("athlete rows disable only the pending player, not session.mutating globally", () => {
    const setupPath = path.resolve("src/pages/tournament/DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.match(source, /pendingPlayerId/);
    assert.match(source, /playerMutationLockRef/);
    assert.match(source, /setPendingPlayerId\(String\(playerId\)\)/);
    assert.match(source, /disabled=\{isPending\}/);
    const rosterBlock = source.slice(
      source.indexOf("Check-in hôm nay"),
      source.indexOf("Sân đang dùng")
    );
    assert.match(rosterBlock, /disabled=\{isPending\}/);
    assert.equal(
      /disabled=\{session\.mutating\}/.test(rosterBlock),
      false,
      "roster must not disable every row via session.mutating"
    );
    assert.match(rosterBlock, /CircularProgress/);
    assert.match(source, /playerMutationLockRef\.current/);
    // Candidate pool still revision:0 — no check-in invalidation.
    assert.match(source, /useClubPairingCandidatePool\(activeClubId,\s*\{\s*revision:\s*0,\s*\}\)/);
  });

  test("bulk check-in helpers remain for Select All (DP-06 regression)", () => {
    const setupPath = path.resolve("src/pages/tournament/DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.match(source, /checkInMany/);
    assert.match(source, /checkOutMany/);
    assert.match(source, /bulkPending/);
    assert.match(source, /Đang chọn\.\.\./);
  });
});

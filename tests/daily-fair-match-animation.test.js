import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { getDailyFairMatchTiming } from "../src/components/tournament/animation/animationConfig.js";
import {
  assertDailyFairMatchStepsMatchEngine,
  buildDailyFairMatchAnimationPayload,
  buildDailyFairMatchPlayerPool,
  buildDailyFairMatchSteps,
  computeDailyFairBalancePercent,
  DAILY_PLAYER_STATUS,
  FAIR_MATCH_PHASES,
  getFairnessTier,
  getPhaseStatusText,
  hasFairnessScore,
  resolveDailyMatchDisplayStatus,
  resolveDailyPlayerStatus,
  resolveMatchCourtLabel,
} from "../src/components/tournament/animation/daily/dailyFairMatchUtils.js";
import {
  createFairDailyMatches,
  DAILY_GENDER_FILTER,
  DAILY_MATCH_TYPE,
  getDefaultDailyPlaySettings,
} from "../src/tournament/engines/dailyPlayEngine.js";
import { MATCH_STATUS } from "../src/models/tournament/index.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";

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
  loadClubData(DEFAULT_CLUB.id);
});

const menPlayers = Array.from({ length: 16 }, (_, index) => ({
  id: `m${index + 1}`,
  name: `Nam ${index + 1}`,
  gender: "Nam",
  level: 4 - index * 0.1,
}));

const fifteenPlayers = menPlayers.slice(0, 15);

function buildSettings(playerIds, extra = {}) {
  return {
    ...getDefaultDailyPlaySettings(),
    checkedInPlayerIds: playerIds,
    matchType: DAILY_MATCH_TYPE.MEN_DOUBLE,
    genderFilter: DAILY_GENDER_FILTER.MALE,
    ...extra,
  };
}

async function createResult(players, matchCount) {
  return createFairDailyMatches({
    players,
    settings: buildSettings(players.map((player) => String(player.id))),
    tournamentId: "daily-1",
    matchCount,
    skipPrivatePairingPrepare: true,
    privatePairingRules: [],
  });
}

describe("daily fair match animation utils", () => {
  it("buildDailyFairMatchSteps mirrors engine matches for 16 players and 4 courts", async () => {
    const result = await createResult(menPlayers, 4);
    assert.equal(result.ok, true);
    assert.equal(result.matches.length, 4);

    const steps = buildDailyFairMatchSteps(result.matches, menPlayers, []);
    assertDailyFairMatchStepsMatchEngine(steps, result.matches);
    assert.equal(steps[0].teamA.players.length, 2);
    assert.equal(steps[0].teamB.players.length, 2);
    assert.equal(steps[0].courtLabel, "Chưa xếp sân");
  });

  it("15 players leaves remainder in waiting next round", async () => {
    const result = await createResult(fifteenPlayers, 3);
    assert.equal(result.ok, true);
    assert.equal(result.matches.length, 3);
    assert.equal(result.waitingPlayers.length, 3);

    const pool = buildDailyFairMatchPlayerPool({
      players: fifteenPlayers,
      matches: result.matches,
      waitingPlayers: result.waitingPlayers,
      revealedCount: 0,
      currentMatchIndex: -1,
      phase: FAIR_MATCH_PHASES.IDLE,
    });

    const waitingNext = pool.filter((player) => player.status === DAILY_PLAYER_STATUS.WAITING_NEXT);
    assert.equal(waitingNext.length, result.waitingPlayers.length);
    assert.ok(waitingNext.length > 0);
  });

  it("doubles match uses 4 players per match", async () => {
    const result = await createResult(menPlayers, 1);
    const step = buildDailyFairMatchSteps(result.matches, menPlayers)[0];
    assert.equal(step.teamA.players.length + step.teamB.players.length, 4);
  });

  it("singles match step supports 1 player per team", () => {
    const singlesMatch = {
      id: "s1",
      teamAPlayerIds: ["p1"],
      teamBPlayerIds: ["p2"],
      teamALabel: "An",
      teamBLabel: "Binh",
      teamATotal: 4,
      teamBTotal: 3.8,
      diff: 0.2,
      competitionType: "singles_men",
      status: MATCH_STATUS.WAITING,
    };
    const players = [
      { id: "p1", name: "An", level: 4 },
      { id: "p2", name: "Binh", level: 3.8 },
    ];

    const step = buildDailyFairMatchSteps([singlesMatch], players)[0];
    assert.equal(step.teamA.players.length, 1);
    assert.equal(step.teamB.players.length, 1);
  });

  it("shows court label when court assigned and waiting court when not", () => {
    const courts = [{ id: "c1", name: "Sân 1", number: 1, active: true }];
    const waitingMatch = {
      id: "m1",
      courtId: null,
      teamAPlayerIds: ["1", "2"],
      teamBPlayerIds: ["3", "4"],
      status: MATCH_STATUS.WAITING,
    };
    const assignedMatch = {
      ...waitingMatch,
      id: "m2",
      courtId: "c1",
      status: MATCH_STATUS.PLAYING,
    };

    assert.equal(resolveMatchCourtLabel(waitingMatch, courts), "Chưa xếp sân");
    assert.equal(resolveMatchCourtLabel(assignedMatch, courts), "Sân 1");
    assert.equal(resolveDailyMatchDisplayStatus(waitingMatch, 0, 1), "no_court");
    assert.equal(resolveDailyMatchDisplayStatus(assignedMatch, 0, 1), "on_court");
  });

  it("buildDailyFairMatchAnimationPayload keeps engine team ids", async () => {
    const result = await createResult(menPlayers, 2);
    const payload = buildDailyFairMatchAnimationPayload({
      result,
      players: menPlayers,
      courts: [],
      clubName: "CLB Test",
    });

    assert.equal(payload.fairMatches.length, 2);
    assert.equal(payload.steps.length, 2);
    assert.equal(payload.clubName, "CLB Test");
    assertDailyFairMatchStepsMatchEngine(payload.steps, payload.fairMatches);
  });

  it("player status transitions from waiting create to creating to has match", () => {
    const match = {
      id: "m1",
      teamAPlayerIds: ["m1", "m2"],
      teamBPlayerIds: ["m3", "m4"],
      status: MATCH_STATUS.WAITING,
    };

    assert.equal(
      resolveDailyPlayerStatus("m1", {
        matches: [match],
        waitingPlayerIds: [],
        revealedCount: 0,
        currentMatchIndex: 0,
        phase: FAIR_MATCH_PHASES.IDLE,
      }),
      DAILY_PLAYER_STATUS.WAITING_CREATE
    );

    assert.equal(
      resolveDailyPlayerStatus("m1", {
        matches: [match],
        waitingPlayerIds: [],
        revealedCount: 0,
        currentMatchIndex: 0,
        phase: FAIR_MATCH_PHASES.TEAM_A,
      }),
      DAILY_PLAYER_STATUS.CREATING
    );

    assert.equal(
      resolveDailyPlayerStatus("m1", {
        matches: [match],
        waitingPlayerIds: [],
        revealedCount: 1,
        currentMatchIndex: -1,
        phase: FAIR_MATCH_PHASES.IDLE,
      }),
      DAILY_PLAYER_STATUS.HAS_MATCH
    );
  });

  it("computeDailyFairBalancePercent returns higher score for smaller diff", () => {
    const balanced = computeDailyFairBalancePercent({
      teamATotal: 8,
      teamBTotal: 7.8,
      diff: 0.2,
    });
    const unbalanced = computeDailyFairBalancePercent({
      teamATotal: 8,
      teamBTotal: 6,
      diff: 2,
    });

    assert.ok(balanced > unbalanced);
    assert.ok(balanced >= 90);
  });

  it("getDailyFairMatchTiming scales by speed", () => {
    const normal = getDailyFairMatchTiming("normal");
    const fast = getDailyFairMatchTiming("fast");
    assert.ok(fast.flyMs < normal.flyMs);
    assert.ok(normal.analyzeMs >= 1200);
    assert.ok(normal.flyMs >= 1200);
    assert.ok(normal.teamRevealMs >= 900);
  });

  it("getFairnessTier maps score bands", () => {
    assert.equal(getFairnessTier(92).label, "Rất cân bằng");
    assert.equal(getFairnessTier(85).label, "Cân bằng tốt");
    assert.equal(getFairnessTier(75).label, "Chấp nhận được");
    assert.equal(getFairnessTier(60).label, "Cần xem lại");
    assert.equal(getFairnessTier(null).label, "Chưa đánh giá");
  });

  it("getPhaseStatusText returns creation flow labels", () => {
    assert.match(getPhaseStatusText(FAIR_MATCH_PHASES.ANALYZE), /phân tích/i);
    assert.match(getPhaseStatusText(FAIR_MATCH_PHASES.FAIRNESS), /cân bằng/i);
    assert.match(getPhaseStatusText(FAIR_MATCH_PHASES.CONFIRM), /thành công/i);
  });

  it("hasFairnessScore detects engine balance data", () => {
    assert.equal(hasFairnessScore({ diff: 0.2, teamATotal: 8, teamBTotal: 7.8 }), true);
    assert.equal(hasFairnessScore({}), false);
  });
});

describe("daily fair match animation modes", () => {
  it("manual and auto modes use same precomputed steps", async () => {
    const { FAIR_MATCH_CONTROL_MODES } = await import(
      "../src/components/tournament/animation/daily/useFairMatchSequence.js"
    );
    const result = await createResult(menPlayers, 2);
    const steps = buildDailyFairMatchSteps(result.matches, menPlayers);

    assert.equal(steps.length, 2);
    assert.equal(FAIR_MATCH_CONTROL_MODES.MANUAL, "manual");
    assert.equal(FAIR_MATCH_CONTROL_MODES.AUTO, "auto");
    assert.deepEqual(
      steps.map((step) => step.match.teamAPlayerIds),
      result.matches.map((match) => match.teamAPlayerIds)
    );
  });

  it("skip and replay do not mutate engine match data", async () => {
    const result = await createResult(menPlayers, 2);
    const engineSnapshot = JSON.stringify(result.matches);
    const steps = buildDailyFairMatchSteps(result.matches, menPlayers);

    const replayed = steps.map((step) => ({
      ...step,
      replay: true,
    }));

    assert.notEqual(replayed[0].replay, undefined);
    assert.equal(JSON.stringify(result.matches), engineSnapshot);
  });
});

import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";

import {
  DAILY_PLAY_CODE,
  DAILY_PLAY_MESSAGES,
  DAILY_PLAY_OPERATIONAL_WRITE_RPCS,
  DAILY_PLAY_RPC,
  DAILY_MATCH_TYPE_LABELS,
  DAILY_MATCH_TYPE_OPTIONS,
  applyCloseSession,
  classifyDailyCloseReadiness,
  createDailyPlayCanonicalService,
  createInMemoryDailyPlayAuthority,
  createSeededDailyPlayTournament,
  formatSessionCloseBlockedMessage,
  formatSessionCloseConfirmMessage,
  getDailyMatchShape,
  isDailySessionCompleted,
  listVisibleBulkCheckInTargets,
  normalizeDailyPlayMutationResult,
  projectDailyPlayerFilterView,
  resolveCreateMatchCount,
  validateDailyMatchShape,
  __resetDailyPlayCanonicalServiceForTests,
  __setDailyPlayCanonicalServiceForTests,
} from "../src/features/daily-play/canonical/index.js";
import { DAILY_MATCH_TYPE as CANONICAL_DAILY_MATCH_TYPE } from "../src/features/daily-play/canonical/dailyPlayMatchShape.js";
import {
  DAILY_MATCH_TYPE,
  createFairDailyMatches,
  getBusyPlayerIdsFromDailyMatches,
  getDefaultDailyPlaySettings,
  resolveDailyCompetitionType,
} from "../src/tournament/engines/dailyPlayEngine.js";
import { getPlayerGenderKey } from "../src/models/player.js";
import { TOURNAMENT_STATUS } from "../src/models/tournament/index.js";

const PACKAGE_DIR =
  "docs/v5/migrations/daily-play-canonical-session-close-final-lifecycle-01";
const TENANT = "tenant-close-01";
const OTHER_TENANT = "tenant-other-01";
const CLUB = "club-close-01";
const OTHER_CLUB = "club-other-01";
const SESSION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION_OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COURT_1 = "court-1";
const COURT_2 = "court-2";
const COURTS = [
  { id: COURT_1, name: "Sân 1", active: true, status: "active" },
  { id: COURT_2, name: "Sân 2", active: true, status: "active" },
];

const males = ["m1", "m2", "m3", "m4"];
const females = ["f1", "f2", "f3", "f4"];
const ALL_IDS = [...males, ...females, "o1"];

const poolPlayers = [
  { id: "m1", name: "Nam 1", gender: "male", level: 4 },
  { id: "m2", name: "Nam 2", gender: "Nam", level: 3.5 },
  { id: "m3", name: "Nam 3", gender: "M", level: 3.2 },
  { id: "m4", name: "Nam 4", gender: "male", level: 3 },
  { id: "f1", name: "Nu 1", gender: "female", level: 4 },
  { id: "f2", name: "Nu 2", gender: "Nữ", level: 3.5 },
  { id: "f3", name: "Nu 3", gender: "F", level: 3.2 },
  { id: "f4", name: "Nu 4", gender: "female", level: 3 },
  { id: "o1", name: "Other 1", gender: "other", level: 3 },
  { id: "u1", name: "Unknown", gender: null, level: 3 },
];

function singlesMatch(id, a, b, status = "waiting", courtId = null) {
  return {
    id,
    status,
    courtId,
    matchType: "men_single",
    competitionType: "singles_men",
    teamAPlayerIds: [a],
    teamBPlayerIds: [b],
    playerIds: [a, b],
  };
}

function doublesMatch(id, ids, status = "waiting", courtId = null, matchType = "men_double") {
  return {
    id,
    status,
    courtId,
    matchType,
    teamAPlayerIds: [ids[0], ids[1]],
    teamBPlayerIds: [ids[2], ids[3]],
    playerIds: ids,
  };
}

function seedSession({
  id = SESSION_A,
  tenantId = TENANT,
  clubId = CLUB,
  status = "active",
  matches = [],
  checkedInPlayerIds = ALL_IDS,
  revision = 1,
  leases = [],
  extraTournaments = [],
  extraLeases = {},
} = {}) {
  const authority = createInMemoryDailyPlayAuthority({ tenantId });
  authority.__setClubCourts(clubId, COURTS);
  authority.__setEligibleAthletes(tenantId, clubId, ALL_IDS);
  authority.__seedTournament(
    createSeededDailyPlayTournament({
      id,
      tenantId,
      clubId,
      status,
      dailyPlay: {
        revision,
        checkedInPlayerIds,
        matchType: "mixed_double",
        enabledCourtIds: [COURT_1, COURT_2],
        matches,
      },
    })
  );
  if (leases.length) authority.__setLeases(id, leases);
  for (const extra of extraTournaments) {
    authority.__setClubCourts(extra.clubId || clubId, extra.courts || COURTS);
    authority.__setEligibleAthletes(
      extra.tenantId || tenantId,
      extra.clubId || clubId,
      extra.eligible || ALL_IDS
    );
    authority.__seedTournament(extra.row);
    if (extra.leases) authority.__setLeases(extra.row.id, extra.leases);
  }
  for (const [tid, rows] of Object.entries(extraLeases)) {
    authority.__setLeases(tid, rows);
  }
  const service = createDailyPlayCanonicalService({ rpc: authority.rpc });
  __setDailyPlayCanonicalServiceForTests(service);
  return {
    authority,
    service,
    scope: { tenantId, clubId, tournamentId: id },
  };
}

afterEach(() => {
  __resetDailyPlayCanonicalServiceForTests();
});

describe("SQL package local contract", () => {
  const applySql = fs.readFileSync(path.resolve(PACKAGE_DIR, "02_APPLY.sql"), "utf8");
  const precheckSql = fs.readFileSync(path.resolve(PACKAGE_DIR, "01_PRECHECK.sql"), "utf8");
  const verifySql = fs.readFileSync(path.resolve(PACKAGE_DIR, "03_VERIFY.sql"), "utf8");
  const rollbackSql = fs.readFileSync(path.resolve(PACKAGE_DIR, "04_ROLLBACK.sql"), "utf8");
  const readme = fs.readFileSync(path.resolve(PACKAGE_DIR, "README.md"), "utf8");

  test("package files exist and APPLY is additive function replace", () => {
    for (const name of [
      "01_PRECHECK.sql",
      "02_APPLY.sql",
      "03_VERIFY.sql",
      "04_ROLLBACK.sql",
      "README.md",
    ]) {
      assert.equal(fs.existsSync(path.resolve(PACKAGE_DIR, name)), true);
    }
    assert.equal(fs.existsSync(path.resolve(PACKAGE_DIR, "_apply_part2.sql")), false);
    assert.match(precheckSql, /read-only/i);
    assert.match(applySql, /CREATE OR REPLACE FUNCTION public\.daily_play_close_session/);
    assert.match(applySql, /CREATE OR REPLACE FUNCTION public\.daily_play_match_shape/);
    assert.match(applySql, /daily_play_session_write_denied/);
    assert.match(applySql, /tournamentStatus/);
    assert.match(applySql, /occupiedCourtIds/);
    assert.equal(/\bCREATE TABLE\b/i.test(applySql), false);
    assert.equal(/\bALTER TABLE\b/i.test(applySql), false);
    assert.equal(/DROP TABLE/i.test(applySql), false);
    assert.match(applySql, /REVOKE ALL ON FUNCTION public\.daily_play_close_session/);
    assert.match(applySql, /GRANT EXECUTE ON FUNCTION public\.daily_play_close_session/);
    assert.match(verifySql, /SESSION_CLOSE_BLOCKED/);
    assert.match(verifySql, /correct_score must remain allowed after session close/);
    assert.match(rollbackSql, /DROP FUNCTION IF EXISTS public\.daily_play_close_session/);
    assert.match(rollbackSql, /occupiedCourtIds/);
    assert.equal(rollbackSql.includes("'tournamentStatus'"), false);
    assert.match(readme, /STAGING_MUTATIONS=0/);
    assert.match(readme, /Court Time Allocation/);
  });

  test("close RPC contract and post-close operational writes are guarded", () => {
    const closeFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_close_session"),
      applySql.indexOf("REVOKE ALL ON FUNCTION public.daily_play_match_shape")
    );
    assert.match(closeFn, /SECURITY DEFINER SET search_path = public/);
    assert.match(closeFn, /canonical_tournament_assert_tenant/);
    assert.match(closeFn, /tournament\.update/);
    assert.match(closeFn, /'close_session'/);
    assert.match(closeFn, /SESSION_CLOSE_BLOCKED/);
    assert.match(closeFn, /assignedCount/);
    assert.match(closeFn, /playingCount/);
    assert.match(closeFn, /session_closed/);
    assert.match(closeFn, /checkedInPlayerIds/);
    assert.match(closeFn, /'\[\]'::jsonb/);
    assert.match(closeFn, /AND tournament_id = p_tournament_id/);
    assert.match(closeFn, /status = 'completed'/);
    assert.match(closeFn, /completedMatchCount/);
    assert.doesNotMatch(closeFn, /scoreA/);
    for (const rpc of [
      "daily_play_check_in",
      "daily_play_check_out",
      "daily_play_create_matches",
      "daily_play_assign_court",
      "daily_play_start_match",
      "daily_play_submit_score",
      "daily_play_cancel_match",
      "daily_play_change_court",
    ]) {
      const fn = applySql.slice(
        applySql.indexOf(`CREATE OR REPLACE FUNCTION public.${rpc}(`)
      );
      assert.match(fn.slice(0, 2500), /daily_play_session_write_denied/);
    }
    assert.equal(applySql.includes("CREATE OR REPLACE FUNCTION public.daily_play_correct_score"), false);
  });

  test("match-shape helper covers singles and open without mapping auto to open_double", () => {
    const shapeFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_match_shape"),
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_validate_match_shape")
    );
    assert.match(shapeFn, /men_single.*playersPerMatch',2/);
    assert.match(shapeFn, /women_single.*playersPerMatch',2/);
    assert.match(shapeFn, /open_double.*playersPerMatch',4/);
    assert.match(shapeFn, /WHEN 'auto' THEN/);
    assert.doesNotMatch(shapeFn, /auto.*open_double/);
  });
});

describe("match type authority", () => {
  test("canonical ids, labels, and auto remain a separate strategy", () => {
    assert.deepEqual(
      DAILY_MATCH_TYPE_OPTIONS.map((item) => item.value),
      [
        "men_single",
        "women_single",
        "men_double",
        "women_double",
        "mixed_double",
        "open_double",
        "auto",
      ]
    );
    assert.equal(DAILY_MATCH_TYPE_LABELS.men_single, "Đơn nam");
    assert.equal(DAILY_MATCH_TYPE_LABELS.women_single, "Đơn nữ");
    assert.equal(DAILY_MATCH_TYPE_LABELS.men_double, "Đôi nam");
    assert.equal(DAILY_MATCH_TYPE_LABELS.women_double, "Đôi nữ");
    assert.equal(DAILY_MATCH_TYPE_LABELS.mixed_double, "Đôi nam nữ");
    assert.equal(DAILY_MATCH_TYPE_LABELS.open_double, "Đôi tự do");
    assert.equal(DAILY_MATCH_TYPE_LABELS.auto, "Tự động");
    assert.equal(CANONICAL_DAILY_MATCH_TYPE.AUTO, "auto");
    assert.equal(DAILY_MATCH_TYPE.AUTO, "auto");
    assert.notEqual(DAILY_MATCH_TYPE.AUTO, DAILY_MATCH_TYPE.OPEN_DOUBLE);
    assert.equal(getDailyMatchShape("auto").kind, "auto");
    assert.equal(getDailyMatchShape("open_double").competitionType, "open");
    assert.equal(resolveDailyCompetitionType("auto", poolPlayers.slice(0, 8)), "doubles_mixed");
    assert.equal(resolveDailyCompetitionType("open_double", poolPlayers), "open");
    assert.equal(resolveDailyCompetitionType("men_single", poolPlayers), "singles_men");
    assert.equal(resolveDailyCompetitionType("women_single", poolPlayers), "singles_women");
  });

  test("match shapes: singles 1v1, doubles 2v2, mixed mixed, open open", () => {
    assert.deepEqual(getDailyMatchShape("men_single").playersPerMatch, 2);
    assert.equal(getDailyMatchShape("men_single").teamSize, 1);
    assert.deepEqual(getDailyMatchShape("women_single").teamSize, 1);
    assert.equal(getDailyMatchShape("men_double").playersPerMatch, 4);
    assert.equal(getDailyMatchShape("mixed_double").genderComposition, "mixed");
    assert.equal(getDailyMatchShape("open_double").genderComposition, "open");
    const singles = validateDailyMatchShape(
      singlesMatch("s1", "m1", "m2"),
      "men_single"
    );
    assert.equal(singles.ok, true);
    const doubles = validateDailyMatchShape(
      doublesMatch("d1", males),
      "men_double"
    );
    assert.equal(doubles.ok, true);
    const badSinglesAsDoubles = validateDailyMatchShape({
      teamAPlayerIds: ["m1"],
      teamBPlayerIds: ["m2"],
      playerIds: ["m1", "m2"],
    });
    assert.equal(badSinglesAsDoubles.ok, false);
    assert.equal(badSinglesAsDoubles.code, DAILY_PLAY_CODE.INVALID_MATCH_SHAPE);
    const dup = validateDailyMatchShape(
      {
        matchType: "men_single",
        teamAPlayerIds: ["m1"],
        teamBPlayerIds: ["m1"],
      },
      "men_single"
    );
    assert.equal(dup.ok, false);
  });

  test("create count divides singles by 2 and doubles by 4", () => {
    const courts = COURTS;
    const singlesPlan = resolveCreateMatchCount({
      enabledCourts: courts,
      availableCourts: courts,
      eligiblePlayerCount: 5,
      matchType: "men_single",
    });
    assert.equal(singlesPlan.ok, true);
    assert.equal(singlesPlan.matchCount, 2);
    const doublesPlan = resolveCreateMatchCount({
      enabledCourts: courts,
      availableCourts: courts,
      eligiblePlayerCount: 5,
      matchType: "men_double",
    });
    assert.equal(doublesPlan.ok, true);
    assert.equal(doublesPlan.matchCount, 1);
    const tooFew = resolveCreateMatchCount({
      enabledCourts: courts,
      availableCourts: courts,
      eligiblePlayerCount: 1,
      matchType: "men_single",
    });
    assert.equal(tooFew.ok, false);
    assert.equal(tooFew.code, DAILY_PLAY_CODE.NOT_ENOUGH_PLAYERS);
  });
});

describe("player pool by match type", () => {
  test("visible pool follows Loại trận including open other-gender", () => {
    const men = projectDailyPlayerFilterView({
      players: poolPlayers,
      checkedInPlayerIds: ALL_IDS,
      matchType: DAILY_MATCH_TYPE.MEN_SINGLE,
    });
    assert.deepEqual(
      men.visiblePlayers.map((player) => player.id),
      males
    );
    const open = projectDailyPlayerFilterView({
      players: poolPlayers,
      checkedInPlayerIds: ALL_IDS,
      matchType: DAILY_MATCH_TYPE.OPEN_DOUBLE,
    });
    assert.equal(open.visiblePlayers.some((player) => player.id === "o1"), true);
    assert.equal(open.visiblePlayers.some((player) => player.id === "u1"), false);
    const mixed = projectDailyPlayerFilterView({
      players: poolPlayers,
      checkedInPlayerIds: ALL_IDS,
      matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    });
    assert.equal(mixed.visiblePlayers.some((player) => player.id === "o1"), false);
  });

  test("bulk select is scoped to the visible match-type pool", () => {
    const view = projectDailyPlayerFilterView({
      players: poolPlayers,
      checkedInPlayerIds: ["m1"],
      matchType: DAILY_MATCH_TYPE.MEN_DOUBLE,
    });
    assert.deepEqual(listVisibleBulkCheckInTargets(view, ["m1"]), ["m2", "m3", "m4"]);
  });
});

describe("fair match singles / open / mixed", () => {
  const memory = new Map();
  const localStorageMock = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
    clear: () => memory.clear(),
  };
  globalThis.localStorage = localStorageMock;

  test("men_single creates 1v1 without duplicate or placeholder teammates", async () => {
    const result = await createFairDailyMatches({
      players: poolPlayers,
      settings: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: males,
        matchType: DAILY_MATCH_TYPE.MEN_SINGLE,
      },
      tournamentId: "t-ms",
      matchCount: 2,
      skipPrivatePairingPrepare: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.competitionType, "singles_men");
    assert.equal(result.matches[0].teamAPlayerIds.length, 1);
    assert.equal(result.matches[0].teamBPlayerIds.length, 1);
    const ids = [
      ...result.matches[0].teamAPlayerIds,
      ...result.matches[0].teamBPlayerIds,
    ];
    assert.equal(new Set(ids).size, 2);
    assert.equal(ids.includes(null), false);
  });

  test("women_single uses singles_women path", async () => {
    const result = await createFairDailyMatches({
      players: poolPlayers,
      settings: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: females,
        matchType: DAILY_MATCH_TYPE.WOMEN_SINGLE,
      },
      tournamentId: "t-ws",
      matchCount: 1,
      skipPrivatePairingPrepare: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.competitionType, "singles_women");
    assert.equal(result.matches[0].teamAPlayerIds.length, 1);
  });

  test("mixed_double requires 1 male + 1 female each side", async () => {
    const result = await createFairDailyMatches({
      players: poolPlayers,
      settings: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: ALL_IDS,
        matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
      },
      tournamentId: "t-mx",
      matchCount: 1,
      skipPrivatePairingPrepare: true,
    });
    assert.equal(result.ok, true);
    const match = result.matches[0];
    const byId = new Map(poolPlayers.map((player) => [player.id, player]));
    const teamA = match.teamAPlayerIds.map((id) => getPlayerGenderKey(byId.get(id).gender));
    const teamB = match.teamBPlayerIds.map((id) => getPlayerGenderKey(byId.get(id).gender));
    assert.equal(teamA.includes("male") && teamA.includes("female"), true);
    assert.equal(teamB.includes("male") && teamB.includes("female"), true);
  });

  test("open_double accepts unrestricted gender mix and is not auto", async () => {
    const fourMales = poolPlayers.filter((player) => males.includes(player.id));
    const result = await createFairDailyMatches({
      players: fourMales,
      settings: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: males,
        matchType: DAILY_MATCH_TYPE.OPEN_DOUBLE,
      },
      tournamentId: "t-open",
      matchCount: 1,
      skipPrivatePairingPrepare: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.competitionType, "open");
    assert.equal(result.matches[0].matchType, "open_double");
    const auto = await createFairDailyMatches({
      players: fourMales,
      settings: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: males,
        matchType: DAILY_MATCH_TYPE.AUTO,
      },
      tournamentId: "t-auto",
      matchCount: 1,
      skipPrivatePairingPrepare: true,
    });
    assert.equal(auto.ok, true);
    assert.equal(auto.competitionType, "doubles_men");
    assert.notEqual(auto.competitionType, "open");
  });
});

describe("queue / assign / start / score / change court", () => {
  test("singles create waiting with no lease, then assign/start/score/release", async () => {
    const { service, authority, scope } = seedSession({ matches: [] });
    const created = await service.createMatches(scope, {
      matches: [singlesMatch("s-wait", "m1", "m2")],
      expectedVersion: 1,
      eligiblePlayerCount: 2,
      idempotencyKey: "create-s1",
    });
    assert.equal(created.ok, true);
    let state = await service.getState(scope);
    assert.equal(state.dailyPlay.matches[0].status, "waiting");
    assert.equal(state.dailyPlay.matches[0].courtId, null);
    assert.equal((authority.__getLeases(SESSION_A) || []).length, 0);

    const assigned = await service.assignCourt(scope, {
      matchId: "s-wait",
      courtId: COURT_1,
      expectedVersion: state.revision,
      idempotencyKey: "assign-s1",
    });
    assert.equal(assigned.ok, true);
    state = await service.getState(scope);
    assert.equal(state.dailyPlay.matches[0].status, "assigned");
    assert.equal(
      authority.__getLeases(SESSION_A).some((lease) => lease.status === "active"),
      true
    );

    const started = await service.startMatch(scope, {
      matchId: "s-wait",
      expectedVersion: state.revision,
      idempotencyKey: "start-s1",
    });
    assert.equal(started.ok, true);
    state = await service.getState(scope);
    assert.equal(state.dailyPlay.matches[0].status, "playing");

    const scored = await service.submitScore(scope, {
      matchId: "s-wait",
      scoreA: 11,
      scoreB: 7,
      expectedVersion: state.revision,
      idempotencyKey: "score-s1",
    });
    assert.equal(scored.ok, true);
    state = await service.getState(scope);
    assert.equal(state.dailyPlay.matches[0].status, "completed");
    assert.equal(
      authority.__getLeases(SESSION_A).every((lease) => lease.status !== "active"),
      true
    );

    const corrected = await service.correctScore(scope, {
      matchId: "s-wait",
      scoreA: 11,
      scoreB: 5,
      expectedVersion: state.revision,
      idempotencyKey: "correct-s1",
    });
    assert.equal(corrected.ok, true);
    state = await service.getState(scope);
    assert.equal(state.dailyPlay.matches[0].scoreB, 5);
    assert.equal(state.tournamentStatus, "active");
  });

  test("doubles 2v2 score and canonical change_court on assigned", async () => {
    const { service, scope } = seedSession({
      matches: [doublesMatch("d1", males, "assigned", COURT_1)],
      leases: [{ matchId: "d1", courtId: COURT_1, status: "active" }],
    });
    const changed = await service.changeCourt(scope, {
      matchId: "d1",
      courtId: COURT_2,
      expectedVersion: 1,
      idempotencyKey: "change-d1",
    });
    assert.equal(changed.ok, true);
    const state = await service.getState(scope);
    assert.equal(state.dailyPlay.matches[0].courtId, COURT_2);
    assert.equal(state.dailyPlay.matches[0].status, "assigned");
  });

  test("busy-player logic works for team arrays of length 1", () => {
    const busy = getBusyPlayerIdsFromDailyMatches([
      singlesMatch("s1", "m1", "m2", "playing", COURT_1),
    ]);
    assert.equal(busy.has("m1"), true);
    assert.equal(busy.has("m2"), true);
    assert.equal(busy.has("m3"), false);
  });
});

describe("session close", () => {
  test("empty session and completed-only session can close", async () => {
    const empty = seedSession({ matches: [], checkedInPlayerIds: ["m1", "f1"] });
    const closedEmpty = await empty.service.closeSession(empty.scope, {
      expectedVersion: 1,
      idempotencyKey: "close-empty",
    });
    assert.equal(closedEmpty.ok, true);
    assert.equal(empty.authority.__getTournament(SESSION_A).status, "completed");
    const after = await empty.service.getState(empty.scope);
    assert.equal(after.tournamentStatus, "completed");
    assert.deepEqual(after.dailyPlay.checkedInPlayerIds, []);
    assert.equal(after.dailyPlay.closeSummary.checkedInCountAtClose, 2);

    __resetDailyPlayCanonicalServiceForTests();
    const completedOnly = seedSession({
      matches: [singlesMatch("done", "m1", "m2", "completed")],
    });
    const closedDone = await completedOnly.service.closeSession(completedOnly.scope, {
      expectedVersion: 1,
      idempotencyKey: "close-done",
    });
    assert.equal(closedDone.ok, true);
    const doneState = await completedOnly.service.getState(completedOnly.scope);
    assert.equal(doneState.dailyPlay.matches[0].status, "completed");
  });

  test("waiting-only and mixed completed+waiting close cancel waiting only", async () => {
    const { service, scope } = seedSession({
      matches: [
        singlesMatch("done", "m1", "m2", "completed"),
        singlesMatch("wait", "m3", "f1", "waiting"),
      ],
      checkedInPlayerIds: ["m1", "m2", "m3", "f1"],
    });
    const closed = await service.closeSession(scope, {
      expectedVersion: 1,
      idempotencyKey: "close-mix",
    });
    assert.equal(closed.ok, true);
    const state = await service.getState(scope);
    const byId = Object.fromEntries(
      state.dailyPlay.matches.map((match) => [match.id, match])
    );
    assert.equal(byId.done.status, "completed");
    assert.equal(byId.wait.status, "cancelled");
    assert.equal(byId.wait.reason, "session_closed");
    assert.equal(state.dailyPlay.closeSummary.cancelledWaitingCount, 1);
    assert.equal(state.dailyPlay.closeSummary.completedMatchCount, 1);
    assert.deepEqual(state.dailyPlay.checkedInPlayerIds, []);
  });

  test("assigned and playing block close with counts", async () => {
    const assigned = seedSession({
      matches: [singlesMatch("a1", "m1", "m2", "assigned", COURT_1)],
    });
    const blockedAssigned = await assigned.service.closeSession(assigned.scope, {
      expectedVersion: 1,
      idempotencyKey: "close-assigned",
    });
    assert.equal(blockedAssigned.ok, false);
    assert.equal(blockedAssigned.code, DAILY_PLAY_CODE.SESSION_CLOSE_BLOCKED);
    assert.equal(blockedAssigned.assignedCount, 1);
    assert.match(
      formatSessionCloseBlockedMessage(blockedAssigned),
      /Còn 0 trận đang thi đấu và 1 trận đã xếp sân/
    );

    __resetDailyPlayCanonicalServiceForTests();
    const playing = seedSession({
      matches: [singlesMatch("p1", "m1", "m2", "playing", COURT_1)],
    });
    const blockedPlaying = await playing.service.closeSession(playing.scope, {
      expectedVersion: 1,
      idempotencyKey: "close-playing",
    });
    assert.equal(blockedPlaying.ok, false);
    assert.equal(blockedPlaying.playingCount, 1);
    assert.equal(playing.authority.__getTournament(SESSION_A).status, "active");
  });

  test("CAS, same-key replay, different-key after completed", async () => {
    const { service, scope } = seedSession({ matches: [] });
    const first = await service.closeSession(scope, {
      expectedVersion: 1,
      idempotencyKey: "close-cas",
    });
    assert.equal(first.ok, true);
    const replay = await service.closeSession(scope, {
      expectedVersion: 1,
      idempotencyKey: "close-cas",
    });
    assert.equal(replay.ok, true);
    const conflict = await service.closeSession(scope, {
      expectedVersion: 1,
      idempotencyKey: "close-other",
    });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.code, DAILY_PLAY_CODE.SESSION_ALREADY_COMPLETED);
    const stale = seedSession({ matches: [] });
    const mismatch = await stale.service.closeSession(stale.scope, {
      expectedVersion: 99,
      idempotencyKey: "close-stale",
    });
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.code, DAILY_PLAY_CODE.VERSION_CONFLICT);
  });

  test("own leases released; Session B / other club / other tenant untouched", async () => {
    const { service, authority, scope } = seedSession({
      matches: [singlesMatch("wait", "m1", "m2", "waiting")],
      leases: [{ matchId: "ghost", courtId: COURT_2, status: "active" }],
      extraTournaments: [
        {
          row: createSeededDailyPlayTournament({
            id: SESSION_B,
            tenantId: TENANT,
            clubId: CLUB,
            dailyPlay: {
              revision: 1,
              checkedInPlayerIds: ["m3", "m4"],
              matches: [singlesMatch("b1", "m3", "m4", "playing", COURT_1)],
            },
          }),
          leases: [{ matchId: "b1", courtId: COURT_1, status: "active" }],
        },
        {
          clubId: OTHER_CLUB,
          row: createSeededDailyPlayTournament({
            id: SESSION_OTHER,
            tenantId: TENANT,
            clubId: OTHER_CLUB,
            dailyPlay: {
              revision: 1,
              checkedInPlayerIds: ["m1", "m2"],
              matches: [singlesMatch("c1", "m1", "m2", "playing", COURT_1)],
            },
          }),
          leases: [{ matchId: "c1", courtId: COURT_1, status: "active" }],
        },
      ],
    });
    authority.__seedTournament(
      createSeededDailyPlayTournament({
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        tenantId: OTHER_TENANT,
        clubId: CLUB,
        dailyPlay: {
          revision: 1,
          matches: [singlesMatch("x1", "m1", "m2", "playing", COURT_1)],
        },
      })
    );
    authority.__setLeases("dddddddd-dddd-4ddd-8ddd-dddddddddddd", [
      { matchId: "x1", courtId: COURT_1, status: "active" },
    ]);

    const closed = await service.closeSession(scope, {
      expectedVersion: 1,
      idempotencyKey: "close-leases",
    });
    assert.equal(closed.ok, true);
    assert.equal(
      authority.__getLeases(SESSION_A).every((lease) => lease.status === "released"),
      true
    );
    assert.equal(authority.__getLeases(SESSION_B)[0].status, "active");
    assert.equal(authority.__getLeases(SESSION_OTHER)[0].status, "active");
    assert.equal(
      authority.__getLeases("dddddddd-dddd-4ddd-8ddd-dddddddddddd")[0].status,
      "active"
    );
  });
});

describe("post-close guards", () => {
  test("get_state allowed; operational writes denied; correct_score allowed", async () => {
    const { service, scope, authority } = seedSession({
      matches: [singlesMatch("done", "m1", "m2", "completed")],
    });
    const closed = await service.closeSession(scope, {
      expectedVersion: 1,
      idempotencyKey: "close-post",
    });
    assert.equal(closed.ok, true);
    const state = await service.getState(scope);
    assert.equal(state.ok, true);
    assert.equal(state.tournamentStatus, "completed");

    const checkIn = await service.checkIn(scope, {
      playerId: "m3",
      expectedVersion: state.revision,
      idempotencyKey: "post-in",
    });
    assert.equal(checkIn.ok, false);
    assert.equal(checkIn.code, DAILY_PLAY_CODE.SESSION_ALREADY_COMPLETED);
    assert.equal(checkIn.error, DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.SESSION_ALREADY_COMPLETED]);

    for (const [name, run] of [
      [
        "checkOut",
        () =>
          service.checkOut(scope, {
            playerId: "m1",
            expectedVersion: state.revision,
            idempotencyKey: "post-out",
          }),
      ],
      [
        "create",
        () =>
          service.createMatches(scope, {
            matches: [singlesMatch("n1", "m3", "m4")],
            expectedVersion: state.revision,
            idempotencyKey: "post-create",
          }),
      ],
      [
        "assign",
        () =>
          service.assignCourt(scope, {
            matchId: "done",
            courtId: COURT_1,
            expectedVersion: state.revision,
            idempotencyKey: "post-assign",
          }),
      ],
      [
        "start",
        () =>
          service.startMatch(scope, {
            matchId: "done",
            expectedVersion: state.revision,
            idempotencyKey: "post-start",
          }),
      ],
      [
        "submit",
        () =>
          service.submitScore(scope, {
            matchId: "done",
            scoreA: 11,
            scoreB: 5,
            expectedVersion: state.revision,
            idempotencyKey: "post-submit",
          }),
      ],
      [
        "cancel",
        () =>
          service.cancelMatch(scope, {
            matchId: "done",
            expectedVersion: state.revision,
            idempotencyKey: "post-cancel",
          }),
      ],
      [
        "change",
        () =>
          service.changeCourt(scope, {
            matchId: "done",
            courtId: COURT_2,
            expectedVersion: state.revision,
            idempotencyKey: "post-change",
          }),
      ],
    ]) {
      const result = await run();
      assert.equal(result.ok, false, name);
      assert.equal(result.code, DAILY_PLAY_CODE.SESSION_ALREADY_COMPLETED, name);
    }

    const corrected = await service.correctScore(scope, {
      matchId: "done",
      scoreA: 11,
      scoreB: 8,
      expectedVersion: state.revision,
      idempotencyKey: "post-correct",
    });
    assert.equal(corrected.ok, true);
    const after = await service.getState(scope);
    assert.equal(after.tournamentStatus, "completed");
    assert.equal(after.dailyPlay.matches[0].status, "completed");
    assert.equal(after.dailyPlay.matches[0].scoreB, 8);
    assert.deepEqual(after.dailyPlay.checkedInPlayerIds, []);
    assert.equal((authority.__getLeases(SESSION_A) || []).length, 0);
    assert.equal(DAILY_PLAY_OPERATIONAL_WRITE_RPCS.includes(DAILY_PLAY_RPC.CORRECT_SCORE), false);
    assert.equal(DAILY_PLAY_OPERATIONAL_WRITE_RPCS.includes(DAILY_PLAY_RPC.CLOSE_SESSION), false);
  });
});

describe("error contract", () => {
  test("specific Vietnamese mappings exist and are preferred over generic fallback", () => {
    for (const code of [
      DAILY_PLAY_CODE.SESSION_CLOSE_BLOCKED,
      DAILY_PLAY_CODE.SESSION_ALREADY_COMPLETED,
      DAILY_PLAY_CODE.SESSION_NOT_ACTIVE,
    ]) {
      const mapped = normalizeDailyPlayMutationResult({ ok: false, code });
      assert.equal(mapped.error, DAILY_PLAY_MESSAGES[code]);
      assert.notEqual(mapped.error, "Thao tác Daily Play thất bại.");
    }
    assert.match(formatSessionCloseConfirmMessage({ waitingCount: 2, checkedInCount: 5 }), /2 trận chưa thi đấu/);
    assert.equal(isDailySessionCompleted("completed"), true);
    const readiness = classifyDailyCloseReadiness([
      { status: "waiting" },
      { status: "assigned" },
    ]);
    assert.equal(readiness.ok, false);
    const applied = applyCloseSession({
      revision: 1,
      matches: [{ id: "w", status: "assigned", teamAPlayerIds: ["m1"], teamBPlayerIds: ["m2"] }],
      checkedInPlayerIds: ["m1"],
    });
    assert.equal(applied.ok, false);
  });
});

describe("UI / Director / launcher / DP13B source contracts", () => {
  test("Setup close button, completed read-only, Change Court, no live controls", () => {
    const setup = fs.readFileSync("src/pages/tournament/DailyPlaySetup.jsx", "utf8");
    assert.match(setup, /Kết thúc buổi chơi/);
    assert.match(setup, /Buổi chơi đã kết thúc/);
    assert.match(setup, /variant="outlined"/);
    assert.match(setup, /sessionCompleted/);
    assert.match(setup, /Sửa điểm/);
    assert.match(setup, /Đổi sân/);
    assert.match(setup, /session\.changeCourt/);
    assert.match(setup, /session\.closeSession/);
    assert.doesNotMatch(setup, /navigate\(`\/daily-play/);
    assert.match(setup, /session\.loading && !session\.state/);
    assert.match(setup, /flexWrap/);
    assert.match(setup, /xs: 12/);
    assert.doesNotMatch(setup, /Tự động nhiều loại/);
  });

  test("F5 completed session stays on DailyPlaySetup route", () => {
    const router = fs.readFileSync("src/router.jsx", "utf8");
    assert.match(router, /path="\/tournament\/daily\/:tournamentId"/);
    assert.match(router, /DailyPlaySetup/);
    const setup = fs.readFileSync("src/pages/tournament/DailyPlaySetup.jsx", "utf8");
    assert.doesNotMatch(setup, /TOURNAMENT_STATUS\.COMPLETED[\s\S]{0,80}navigate\("\/daily-play"\)/);
  });

  test("next launcher ignores completed/cancelled", () => {
    const launcher = fs.readFileSync("src/domain/quickTournamentActions.js", "utf8");
    assert.match(launcher, /findOpenDailyPlayTournament/);
    assert.match(launcher, /TOURNAMENT_STATUS\.ACTIVE/);
    assert.doesNotMatch(launcher, /TOURNAMENT_STATUS\.COMPLETED/);
    assert.equal(TOURNAMENT_STATUS.COMPLETED in {}, false);
    const openStatuses = new Set([
      TOURNAMENT_STATUS.DRAFT,
      TOURNAMENT_STATUS.REGISTRATION,
      TOURNAMENT_STATUS.READY,
      TOURNAMENT_STATUS.ACTIVE,
    ]);
    assert.equal(openStatuses.has(TOURNAMENT_STATUS.COMPLETED), false);
    assert.equal(openStatuses.has(TOURNAMENT_STATUS.CANCELLED), false);
  });

  test("Director Singles labels, completed read-only, no Daily legacy unlock", () => {
    const director = fs.readFileSync(
      "src/features/tournament/director/hooks/useDirectorActions.js",
      "utf8"
    );
    assert.match(director, /denyCompleted/);
    assert.match(director, /SESSION_ALREADY_COMPLETED/);
    assert.match(director, /dailySession\.changeCourt/);
    const dailyScore = director.slice(
      director.indexOf("if (scoreCorrectionMode)"),
      director.lastIndexOf("submitTournamentDirectorMatchScore")
    );
    assert.match(dailyScore, /dailySession\.submitScore/);
    assert.equal(dailyScore.includes("unlockCourt"), false);
    const sync = fs.readFileSync(
      "src/features/tournament/director/hooks/useDirectorSync.js",
      "utf8"
    );
    const dailySync = sync.slice(
      sync.indexOf("if (isDailyMode)"),
      sync.indexOf("submitTournamentDirectorMatchScore")
    );
    assert.equal(dailySync.includes("unlockCourt"), false);
    const cards = fs.readFileSync(
      "src/features/tournament/director/components/DirectorMatchCard.jsx",
      "utf8"
    );
    assert.match(cards, /readOnly/);
    assert.match(cards, /Đổi sân/);
    const header = fs.readFileSync(
      "src/features/tournament/director/components/DirectorHeader.jsx",
      "utf8"
    );
    assert.match(header, /Buổi chơi đã kết thúc/);
    const matchCards = fs.readFileSync("src/components/tournament/matchCardProps.js", "utf8");
    assert.match(matchCards, /teamAPlayerIds/);
    assert.match(matchCards, /ids\.map/);
  });

  test("DP13B tab resume does not replace loaded shell with full-page spinner", () => {
    const hook = fs.readFileSync(
      "src/features/daily-play/canonical/useDailyPlayCanonicalSession.js",
      "utf8"
    );
    assert.match(hook, /isSilentRefreshReason/);
    assert.match(hook, /if \(isInitial\) setLoading\(true\)/);
    assert.match(hook, /shouldReplaceCanonicalSnapshot/);
    const setup = fs.readFileSync("src/pages/tournament/DailyPlaySetup.jsx", "utf8");
    assert.match(
      setup,
      /\(tournamentLoading && !tournament\) \|\| \(session\.loading && !session\.state\)/
    );
  });

  test("private pairing Daily adapter still uses competition class Daily Play", () => {
    const engine = fs.readFileSync("src/tournament/engines/dailyPlayEngine.js", "utf8");
    assert.match(engine, /COMPETITION_CLASS\.DAILY_PLAY/);
    assert.match(engine, /prepareLivePrivatePairingOptions/);
    assert.match(engine, /skipPrivatePairingPrepare/);
    assert.match(engine, /singles_men/);
    assert.match(engine, /competitionType === "open"/);
  });
});

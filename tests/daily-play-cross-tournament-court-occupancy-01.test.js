import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  DAILY_PLAY_CODE,
  DAILY_PLAY_MESSAGES,
  buildCanonicalSnapshotSignature,
  buildCourtRuntimeView,
  createDailyPlayCanonicalService,
  createInMemoryDailyPlayAuthority,
  createSeededDailyPlayTournament,
  dailyPlayCourtRuntimeLabel,
  listAvailableCourts,
  normalizeDailyPlayServerSnapshot,
  resolveCreateMatchCount,
  sanitizeOccupiedCourtIds,
  shouldReplaceCanonicalSnapshot,
  __resetDailyPlayCanonicalServiceForTests,
  __setDailyPlayCanonicalServiceForTests,
} from "../src/features/daily-play/canonical/index.js";

const TENANT = "venue-staging-a";
const OTHER_TENANT = "venue-other";
const CLUB = "club-ecebf64c78f948ccb2b59842441eb26c";
const OTHER_CLUB = "club-other";
const TOURNAMENT_A = "0f542a16-6859-466e-b7c0-ffd8796cea2b";
const TOURNAMENT_B = "6e988252-ac6f-4b71-9763-b6fc3dd6cae5";
const COURT_1 = "tt412-court-01";
const COURT_2 = "tt412-court-02";

const PACKAGE_DIR = "docs/v5/migrations/daily-play-cross-tournament-court-occupancy-01";
const E2E_APPLY = "docs/v5/migrations/daily-play-end-to-end-canonical-01/02_APPLY.sql";

const COURTS = [
  { id: COURT_1, name: "TT412 Sân 1", active: true, status: "active" },
  { id: COURT_2, name: "TT412 Sân 2", active: true, status: "active" },
];

function players(prefix) {
  return [`${prefix}-1`, `${prefix}-2`, `${prefix}-3`, `${prefix}-4`];
}

function mixedGenders(prefixes) {
  const genders = {};
  for (const prefix of prefixes) {
    genders[`${prefix}-1`] = "male";
    genders[`${prefix}-2`] = "female";
    genders[`${prefix}-3`] = "male";
    genders[`${prefix}-4`] = "female";
  }
  return genders;
}

function doublesMatch(id, status, courtId, prefix) {
  const ids = players(prefix);
  return {
    id,
    status,
    courtId,
    teamAPlayerIds: [ids[0], ids[1]],
    teamBPlayerIds: [ids[2], ids[3]],
    playerIds: ids,
  };
}

function seedPair({
  tenantId = TENANT,
  clubId = CLUB,
  authenticated = true,
  permissions,
} = {}) {
  const aPlayers = players("a");
  const bPlayers = players("b");
  const authority = createInMemoryDailyPlayAuthority({
    tenantId,
    authenticated,
    permissions,
  });
  authority.__setClubCourts(clubId, COURTS);
  authority.__setEligibleAthletes(tenantId, clubId, [...aPlayers, ...bPlayers]);
  authority.__setAthleteGenders(mixedGenders(["a", "b", "c"]));
  authority.__seedTournament(
    createSeededDailyPlayTournament({
      id: TOURNAMENT_A,
      tenantId,
      clubId,
      dailyPlay: {
        revision: 1,
        checkedInPlayerIds: aPlayers,
        matches: [
          doublesMatch("daily-a-1", "playing", COURT_1, "a"),
        ],
      },
    })
  );
  authority.__setLeases(TOURNAMENT_A, [
    {
      id: "lease-a-1",
      matchId: "daily-a-1",
      courtId: COURT_1,
      status: "active",
      leasedAt: "2026-08-13T13:29:07.934Z",
    },
  ]);
  authority.__seedTournament(
    createSeededDailyPlayTournament({
      id: TOURNAMENT_B,
      tenantId,
      clubId,
      dailyPlay: {
        revision: 2,
        checkedInPlayerIds: bPlayers,
        matches: [doublesMatch("daily-b-1", "waiting", null, "b")],
      },
    })
  );
  const service = createDailyPlayCanonicalService({ rpc: authority.rpc });
  __setDailyPlayCanonicalServiceForTests(service);
  return { authority, service, scopeA: { tenantId, clubId, tournamentId: TOURNAMENT_A }, scopeB: { tenantId, clubId, tournamentId: TOURNAMENT_B } };
}

afterEach(() => {
  __resetDailyPlayCanonicalServiceForTests();
});

describe("cross-tournament court occupancy SQL package", () => {
  const applySql = fs.readFileSync(path.resolve(PACKAGE_DIR, "02_APPLY.sql"), "utf8");
  const precheckSql = fs.readFileSync(path.resolve(PACKAGE_DIR, "01_PRECHECK.sql"), "utf8");
  const verifySql = fs.readFileSync(path.resolve(PACKAGE_DIR, "03_VERIFY.sql"), "utf8");
  const rollbackSql = fs.readFileSync(path.resolve(PACKAGE_DIR, "04_ROLLBACK.sql"), "utf8");
  const e2eSql = fs.readFileSync(path.resolve(E2E_APPLY), "utf8");

  test("package files exist and APPLY is additive snapshot-only", () => {
    for (const name of ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql", "README.md"]) {
      assert.equal(fs.existsSync(path.resolve(PACKAGE_DIR, name)), true);
    }
    assert.match(precheckSql, /READ-ONLY|read-only/i);
    assert.match(applySql, /occupiedCourtIds/);
    assert.match(applySql, /CREATE OR REPLACE FUNCTION public\.daily_play_snapshot/);
    assert.equal(applySql.includes("CREATE OR REPLACE FUNCTION public.daily_play_get_state"), false);
    assert.equal(/\bINSERT\s+INTO\b/i.test(applySql), false);
    assert.equal(/\bUPDATE\s+public\./i.test(applySql), false);
    assert.equal(/\bDELETE\s+FROM\b/i.test(applySql), false);
    assert.equal(/DROP\s+INDEX/i.test(applySql), false);
    assert.equal(/CREATE\s+UNIQUE\s+INDEX/i.test(applySql), false);
  });

  test("snapshot occupancy is club-wide court IDs only", () => {
    const snapFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_snapshot"),
      applySql.indexOf("REVOKE ALL ON FUNCTION public.daily_play_snapshot")
    );
    assert.match(snapFn, /jsonb_agg\(l\.court_id ORDER BY l\.court_id\)/);
    assert.match(snapFn, /'occupiedCourtIds'/);
    assert.match(snapFn, /'activeLeases'/);
    assert.equal((snapFn.match(/l\.tournament_id = p_tournament_id/g) || []).length, 1);
    assert.match(snapFn, /AND l\.status = 'active'/);
    assert.equal(snapFn.includes("playerIds"), false);
    assert.equal(snapFn.includes("scoreA"), false);
  });

  test("rollback restores prior snapshot without occupancy field", () => {
    assert.match(rollbackSql, /ROLLBACK_FAIL: later snapshot schema version detected/);
    const rolled = rollbackSql.slice(
      rollbackSql.lastIndexOf("CREATE OR REPLACE FUNCTION public.daily_play_snapshot")
    );
    assert.equal(rolled.includes("'occupiedCourtIds'"), false);
    assert.match(rolled, /'activeLeases'/);
    assert.match(verifySql, /occupiedCourtIds/);
  });

  test("submit_score and cancel_match still release leases", () => {
    const submit = e2eSql.slice(
      e2eSql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_submit_score"),
      e2eSql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_cancel_match")
    );
    const cancel = e2eSql.slice(
      e2eSql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_cancel_match"),
      e2eSql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_change_court")
    );
    assert.match(submit, /status='released'/);
    assert.match(cancel, /status='released'/);
    assert.match(verifySql, /submit_score no longer releases/);
    assert.match(verifySql, /cancel_match no longer releases/);
  });
});

describe("Scenario A — other tournament active lease hides court", () => {
  test("Tournament B get_state does not show Court 1 as available", async () => {
    const { service, scopeB } = seedPair();
    const state = await service.getState(scopeB);
    assert.equal(state.ok, true);
    assert.deepEqual(state.occupiedCourtIds, [COURT_1]);
    assert.equal(state.availableCourts.some((court) => court.id === COURT_1), false);
    const court1 = state.courtStates.find((court) => court.id === COURT_1);
    assert.equal(court1.status, "occupied");
    assert.equal(court1.currentMatchId, null);
    assert.equal(state.leases.length, 0);
    assert.equal(dailyPlayCourtRuntimeLabel(court1.status), "đang dùng");
  });
});

describe("Scenario B — release restores availability", () => {
  test("Tournament A submit_score releases Court 1 for Tournament B", async () => {
    const { service, scopeA, scopeB } = seedPair();
    const before = await service.getState(scopeB);
    assert.equal(before.availableCourts.some((court) => court.id === COURT_1), false);

    const scored = await service.submitScore(scopeA, {
      matchId: "daily-a-1",
      scoreA: 11,
      scoreB: 7,
      expectedVersion: 1,
      idempotencyKey: "score-a-1",
    });
    assert.equal(scored.ok, true);

    const after = await service.getState(scopeB);
    assert.equal(after.occupiedCourtIds.includes(COURT_1), false);
    assert.equal(after.availableCourts.some((court) => court.id === COURT_1), true);
    assert.equal(after.courtStates.find((court) => court.id === COURT_1).status, "available");
  });
});

describe("Scenario C — assign is blocked by other tournament lease", () => {
  test("same tenant/club different tournament cannot assign occupied court", async () => {
    const { service, scopeB } = seedPair();
    const assigned = await service.assignCourt(scopeB, {
      matchId: "daily-b-1",
      courtId: COURT_1,
      expectedVersion: 2,
      idempotencyKey: "assign-b-1",
    });
    assert.equal(assigned.ok, false);
    assert.equal(assigned.code, DAILY_PLAY_CODE.COURT_ALREADY_LEASED);
    const state = await service.getState(scopeB);
    assert.equal(state.dailyPlay.matches[0].status, "waiting");
    assert.equal(state.dailyPlay.matches[0].courtId, null);
  });
});

describe("Scenario D — different club same textual court ID does not cross-block", () => {
  test("other club occupancy is isolated", async () => {
    const { authority, service, scopeB } = seedPair();
    authority.__setClubCourts(OTHER_CLUB, COURTS);
    authority.__setEligibleAthletes(TENANT, OTHER_CLUB, players("c"));
    authority.__seedTournament(
      createSeededDailyPlayTournament({
        id: "tour-other-club",
        tenantId: TENANT,
        clubId: OTHER_CLUB,
        dailyPlay: {
          revision: 1,
          checkedInPlayerIds: players("c"),
          matches: [doublesMatch("daily-c-1", "waiting", null, "c")],
        },
      })
    );
    const state = await service.getState({
      tenantId: TENANT,
      clubId: OTHER_CLUB,
      tournamentId: "tour-other-club",
    });
    assert.equal(state.ok, true);
    assert.equal(state.occupiedCourtIds.includes(COURT_1), false);
    assert.equal(state.availableCourts.some((court) => court.id === COURT_1), true);
    const blocked = await service.getState(scopeB);
    assert.equal(blocked.occupiedCourtIds.includes(COURT_1), true);
  });
});

describe("Scenario E — different tenant remains isolated", () => {
  test("cross-tenant get_state is denied", async () => {
    const { service } = seedPair();
    const denied = await service.getState({
      tenantId: OTHER_TENANT,
      clubId: CLUB,
      tournamentId: TOURNAMENT_B,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, DAILY_PLAY_CODE.TENANT_FORBIDDEN);
  });

  test("anon is denied", async () => {
    const { service } = seedPair({ authenticated: false });
    const denied = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TOURNAMENT_B,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, DAILY_PLAY_CODE.NOT_AUTHENTICATED);
  });
});

describe("Scenario F — current tournament own lease still occupied", () => {
  test("Tournament A sees its own playing court as playing, not available", async () => {
    const { service, scopeA } = seedPair();
    const state = await service.getState(scopeA);
    assert.equal(state.occupiedCourtIds.includes(COURT_1), true);
    const court1 = state.courtStates.find((court) => court.id === COURT_1);
    assert.equal(court1.status, "playing");
    assert.equal(court1.currentMatchId, "daily-a-1");
    assert.equal(state.availableCourts.some((court) => court.id === COURT_1), false);
    assert.equal(state.leases.length, 1);
    assert.equal(state.leases[0].matchId, "daily-a-1");
  });
});

describe("Scenario G — sanitized occupancy does not leak metadata", () => {
  test("occupiedCourtIds keeps court IDs only even if raw occupancy objects leak", () => {
    const normalized = normalizeDailyPlayServerSnapshot({
      ok: true,
      tournamentId: TOURNAMENT_B,
      state: {
        revision: 2,
        checkedInPlayerIds: players("b"),
        matches: [doublesMatch("daily-b-1", "waiting", null, "b")],
      },
      courts: COURTS,
      activeLeases: [],
      occupiedCourtIds: [
        {
          courtId: COURT_1,
          matchId: "secret-match",
          tournamentId: TOURNAMENT_A,
          tournamentName: "Chơi hằng ngày 13/8/2026",
          playerIds: players("a"),
          scoreA: 11,
        },
      ],
    });
    assert.deepEqual(normalized.occupiedCourtIds, [COURT_1]);
    assert.equal(JSON.stringify(normalized.occupiedCourtIds).includes("secret-match"), false);
    assert.equal(JSON.stringify(normalized.courtStates).includes("secret-match"), false);
    assert.equal(JSON.stringify(normalized.courtStates).includes("Chơi hằng ngày"), false);
    assert.equal(JSON.stringify(normalized.leases).includes("secret-match"), false);
    const court1 = normalized.courtStates.find((court) => court.id === COURT_1);
    assert.equal(court1.status, "occupied");
    assert.equal(court1.currentMatchId, null);
    assert.equal(court1.tournamentId, undefined);
    assert.equal(sanitizeOccupiedCourtIds([{ matchId: "x", name: "leak" }]).length, 0);
  });
});

describe("queue-first create and waiting copy with global occupancy", () => {
  test("create remains waiting and globally busy courts produce waiting note", async () => {
    const { authority, service } = seedPair();
    authority.__setLeases(TOURNAMENT_A, [
      {
        id: "lease-a-1",
        matchId: "daily-a-1",
        courtId: COURT_1,
        status: "active",
      },
      {
        id: "lease-a-2",
        matchId: "daily-a-2",
        courtId: COURT_2,
        status: "active",
      },
    ]);
    const createId = "tour-create-waiting";
    authority.__setEligibleAthletes(TENANT, CLUB, [...players("a"), ...players("b"), ...players("c")]);
    authority.__seedTournament(
      createSeededDailyPlayTournament({
        id: createId,
        tenantId: TENANT,
        clubId: CLUB,
        dailyPlay: {
          revision: 1,
          checkedInPlayerIds: players("c"),
          matches: [],
        },
      })
    );
    const scopeCreate = { tenantId: TENANT, clubId: CLUB, tournamentId: createId };
    const state = await service.getState(scopeCreate);
    assert.equal(state.availableCourts.length, 0);
    const plan = resolveCreateMatchCount({
      enabledCourts: state.courts,
      availableCourts: state.availableCourts,
      eligiblePlayerCount: 8,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.waitingForCourt, true);
    assert.equal(plan.message, DAILY_PLAY_MESSAGES.COURTS_BUSY_WAITING);

    const created = await service.createMatches(scopeCreate, {
      matches: [doublesMatch("daily-c-1", "waiting", COURT_1, "c")],
      expectedVersion: 1,
      eligiblePlayerCount: 8,
      idempotencyKey: "create-c-1",
    });
    assert.equal(created.ok, true);
    assert.equal(created.waitingForCourt, true);
    assert.equal(created.matches[0].status, "waiting");
    assert.equal(created.matches[0].courtId, null);
  });
});

describe("cancel release visibility", () => {
  test("cancel_match on Tournament A frees Court 1 for Tournament B", async () => {
    const { service, scopeA, scopeB } = seedPair();
    const cancelled = await service.cancelMatch(scopeA, {
      matchId: "daily-a-1",
      expectedVersion: 1,
      idempotencyKey: "cancel-a-1",
    });
    assert.equal(cancelled.ok, true);
    const after = await service.getState(scopeB);
    assert.equal(after.availableCourts.some((court) => court.id === COURT_1), true);
    assert.equal(after.occupiedCourtIds.includes(COURT_1), false);
  });
});

describe("refresh signature includes club-wide occupancy", () => {
  test("occupiedCourtIds change replaces snapshot without current-tournament revision change", () => {
    const base = normalizeDailyPlayServerSnapshot({
      ok: true,
      tournamentId: TOURNAMENT_B,
      state: { revision: 2, checkedInPlayerIds: [], matches: [] },
      courts: COURTS,
      activeLeases: [],
      occupiedCourtIds: [COURT_1],
    });
    const signature = buildCanonicalSnapshotSignature(base);
    const same = shouldReplaceCanonicalSnapshot(signature, {
      ...base,
      occupiedCourtIds: [COURT_1],
    });
    assert.equal(same.replace, false);
    const released = shouldReplaceCanonicalSnapshot(signature, {
      ...base,
      occupiedCourtIds: [],
      availableCourts: COURTS,
      courtStates: buildCourtRuntimeView({
        courts: COURTS,
        matches: [],
        leases: [],
        occupiedCourtIds: [],
      }),
    });
    assert.equal(released.replace, true);
  });
});

describe("legacy snapshot without occupiedCourtIds still uses current leases", () => {
  test("activeLeases continue to mark current-tournament courts unavailable", () => {
    const normalized = normalizeDailyPlayServerSnapshot({
      ok: true,
      tournamentId: TOURNAMENT_A,
      state: {
        revision: 2,
        checkedInPlayerIds: [],
        matches: [doublesMatch("daily-a-1", "assigned", COURT_1, "a")],
      },
      courts: COURTS,
      activeLeases: [{ matchId: "daily-a-1", courtId: COURT_1, leasedAt: "2026-08-13T00:00:00Z" }],
    });
    assert.equal(normalized.occupiedCourtIds.includes(COURT_1), true);
    assert.equal(normalized.availableCourts.map((court) => court.id).join(","), COURT_2);
    assert.equal(normalized.courtStates.find((court) => court.id === COURT_1).status, "playing");
  });
});

describe("direct occupancy helpers", () => {
  test("listAvailableCourts subtracts club-wide occupiedCourtIds", () => {
    const available = listAvailableCourts({
      courts: COURTS,
      matches: [],
      leases: [],
      occupiedCourtIds: [COURT_1],
    });
    assert.deepEqual(available.map((court) => court.id), [COURT_2]);
  });
});

describe("UI and regression locks", () => {
  test("DailyPlaySetup renders runtime occupancy label not raw available", () => {
    const source = fs.readFileSync(
      path.resolve("src/pages/tournament/DailyPlaySetup.jsx"),
      "utf8"
    );
    assert.match(source, /dailyPlayCourtRuntimeLabel/);
    assert.equal(source.includes("{court.status}"), false);
  });

  test("DP13B silent refresh helpers remain", () => {
    const hook = fs.readFileSync(
      path.resolve("src/features/daily-play/canonical/useDailyPlayCanonicalSession.js"),
      "utf8"
    );
    assert.match(hook, /shouldReplaceCanonicalSnapshot/);
    assert.match(hook, /VISIBILITY_RESUME/);
    assert.equal(hook.includes("setRefreshing"), false);
  });

  test("DP15 presence override helpers remain imported by setup", () => {
    const source = fs.readFileSync(
      path.resolve("src/pages/tournament/DailyPlaySetup.jsx"),
      "utf8"
    );
    assert.match(source, /beginPresenceOverride/);
    assert.match(source, /resolvePresentedCheckedSet/);
  });

  test("Fair Match queue-first create remains", () => {
    const applySql = fs.readFileSync(path.resolve(E2E_APPLY), "utf8");
    const createFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_create_matches"),
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_assign_court")
    );
    assert.match(createFn, /queue-only/);
    assert.match(createFn, /'"waiting"'/);
    assert.equal(createFn.includes("INSERT INTO public.daily_play_court_leases"), false);
  });

  test("assign unique_violation remains COURT_ALREADY_LEASED", () => {
    const applySql = fs.readFileSync(path.resolve(E2E_APPLY), "utf8");
    const assignFn = applySql.slice(
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_assign_court"),
      applySql.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_start_match")
    );
    assert.match(assignFn, /unique_violation/);
    assert.match(assignFn, /COURT_ALREADY_LEASED/);
  });
});

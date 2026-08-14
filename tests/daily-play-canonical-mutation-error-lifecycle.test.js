/**
 * PR #422 TEST 4 — generic/stale Daily mutation error with available courts.
 */

import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  DAILY_PLAY_CODE,
  DAILY_PLAY_GENERIC_ACTION_ERROR,
  DAILY_PLAY_MESSAGES,
  DAILY_PLAY_REFRESH_REASON,
  __resetDailyPlayCanonicalServiceForTests,
  createDailyPlayCanonicalService,
  createInMemoryDailyPlayAuthority,
  createSeededDailyPlayTournament,
  isObsoleteNoCourtAvailabilityError,
  normalizeDailyPlayMutationResult,
  normalizeDailyPlayServerSnapshot,
  resolveAssignCourtId,
  resolveCreateCourtWaitingNote,
  resolveCreateMatchCount,
  resolveSessionErrorAfterSnapshot,
  selectEnabledCourts,
  shouldClearSessionErrorAfterSnapshot,
  shouldShowNoCourtWaitingWarning,
} from "../src/features/daily-play/canonical/index.js";
import { getDefaultDailyPlaySettings as defaultDailySettings } from "../src/tournament/engines/dailyPlayEngine.js";

const TENANT = "tenant-daily-error-01";
const CLUB = "club-error-01";
const TID = "22222222-2222-4222-8222-222222222222";
const COURTS = [
  { id: "tt412-1", name: "TT412 Sân 1", active: true, status: "active" },
  { id: "tt412-2", name: "TT412 Sân 2", active: true, status: "active" },
];
const CHECKED_IN = ["1", "2", "3", "4", "5", "6", "7", "8"];

function seedService({ courts = COURTS, dailyPlay = null } = {}) {
  const authority = createInMemoryDailyPlayAuthority({ tenantId: TENANT });
  authority.__setEligibleAthletes(TENANT, CLUB, CHECKED_IN);
  authority.__setAthleteGenders({
    1: "male",
    2: "female",
    3: "male",
    4: "female",
    5: "male",
    6: "female",
    7: "male",
    8: "female",
  });
  authority.__seedTournament(
    createSeededDailyPlayTournament({
      id: TID,
      tenantId: TENANT,
      clubId: CLUB,
      dailyPlay: dailyPlay || {
        ...defaultDailySettings(),
        checkedInPlayerIds: CHECKED_IN,
        revision: 0,
        matches: [],
      },
    })
  );
  authority.__setClubCourts(CLUB, courts);
  const service = createDailyPlayCanonicalService({ rpc: authority.rpc });
  return { authority, service };
}

function waitingMatch(id, players) {
  return {
    id,
    status: "waiting",
    courtId: null,
    teamAPlayerIds: players.slice(0, 2),
    teamBPlayerIds: players.slice(2, 4),
  };
}

afterEach(() => {
  __resetDailyPlayCanonicalServiceForTests();
});

describe("Daily mutation error contract", () => {
  test("service RPC failure preserves code", async () => {
    const service = createDailyPlayCanonicalService({
      rpc: async () => ({ ok: false, code: "PLAYER_NOT_CHECKED_IN" }),
    });
    const result = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { matches: [waitingMatch("m1", ["1", "2", "3", "4"])], expectedVersion: 0 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "PLAYER_NOT_CHECKED_IN");
  });

  test("service RPC failure preserves error message", async () => {
    const service = createDailyPlayCanonicalService({
      rpc: async () => ({
        ok: false,
        code: "PLAYER_NOT_CHECKED_IN",
        error: "VĐV chưa check-in.",
      }),
    });
    const result = await service.assignCourt(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      { matchId: "m1", courtId: null, expectedVersion: 0 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "PLAYER_NOT_CHECKED_IN");
    assert.equal(result.error, "VĐV chưa check-in.");
  });

  test("SQL-shaped ok:false without error maps to a specific domain message", () => {
    const result = normalizeDailyPlayMutationResult({
      ok: false,
      code: "NO_COURT_AVAILABLE",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, DAILY_PLAY_CODE.NO_COURT_AVAILABLE);
    assert.equal(result.error, DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_AVAILABLE]);
    assert.notEqual(result.error, DAILY_PLAY_GENERIC_ACTION_ERROR);
  });

  test("unknown failure alone uses generic fallback and keeps diagnostic", () => {
    const result = normalizeDailyPlayMutationResult({ ok: false });
    assert.equal(result.ok, false);
    assert.equal(result.error, DAILY_PLAY_GENERIC_ACTION_ERROR);
    assert.equal(result.unknownFault, true);
    assert.ok(result.diagnostic);
  });

  test("null / empty ok:false object is not left ambiguous", () => {
    const empty = normalizeDailyPlayMutationResult({ ok: false });
    assert.equal(empty.code, DAILY_PLAY_CODE.VALIDATION);
    assert.equal(Boolean(empty.error), true);
    const missing = normalizeDailyPlayMutationResult(null);
    assert.equal(missing.ok, false);
    assert.equal(missing.error, DAILY_PLAY_GENERIC_ACTION_ERROR);
  });
});

describe("Successful mutation clears stale session.error", () => {
  test("create_matches success clears prior stale session.error", () => {
    const prior = DAILY_PLAY_GENERIC_ACTION_ERROR;
    const next = resolveSessionErrorAfterSnapshot({
      currentError: prior,
      snapshotOk: true,
      replaced: true,
      reason: DAILY_PLAY_REFRESH_REASON.MUTATION,
    });
    assert.equal(next, null);
  });

  test("identical successful readback clears obsolete error", () => {
    assert.equal(
      shouldClearSessionErrorAfterSnapshot({
        snapshotOk: true,
        replaced: false,
        reason: DAILY_PLAY_REFRESH_REASON.MUTATION,
      }),
      true
    );
    assert.equal(
      resolveSessionErrorAfterSnapshot({
        currentError: DAILY_PLAY_GENERIC_ACTION_ERROR,
        snapshotOk: true,
        replaced: false,
        reason: DAILY_PLAY_REFRESH_REASON.MUTATION,
      }),
      null
    );
  });

  test("identical silent poll does not hide a current domain error", () => {
    assert.equal(
      shouldClearSessionErrorAfterSnapshot({
        snapshotOk: true,
        replaced: false,
        reason: DAILY_PLAY_REFRESH_REASON.POLL,
      }),
      false
    );
    assert.equal(
      resolveSessionErrorAfterSnapshot({
        currentError: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.COURT_ALREADY_LEASED],
        snapshotOk: true,
        replaced: false,
        reason: DAILY_PLAY_REFRESH_REASON.POLL,
      }),
      DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.COURT_ALREADY_LEASED]
    );
  });

  test("successful create never shows generic failure", async () => {
    const { service } = seedService();
    const created = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matches: [
          waitingMatch("m-fair-1", ["1", "2", "3", "4"]),
          waitingMatch("m-fair-2", ["5", "6", "7", "8"]),
        ],
        expectedVersion: 0,
        eligiblePlayerCount: 8,
      }
    );
    assert.equal(created.ok, true);
    assert.equal(created.error, undefined);
    const normalized = normalizeDailyPlayMutationResult(created);
    assert.equal(normalized.ok, true);
    assert.notEqual(normalized.error, DAILY_PLAY_GENERIC_ACTION_ERROR);
    assert.equal(created.matches.length, 2);
    assert.equal(created.matches.every((match) => match.status === "waiting"), true);
  });
});

describe("Queue-first create with available courts", () => {
  test("canonical courts available + no leases + create → waiting success", async () => {
    const { service } = seedService();
    const before = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(before.ok, true);
    assert.equal(before.courts.length, 2);
    assert.equal(before.availableCourts.length, 2);
    assert.equal((before.leases || []).filter((lease) => lease.status === "active").length, 0);

    const plan = resolveCreateMatchCount({
      enabledCourts: before.courts,
      availableCourts: before.availableCourts,
      eligiblePlayerCount: 8,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.waitingForCourt, false);

    const created = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matches: [
          waitingMatch("m-q1", ["1", "2", "3", "4"]),
          waitingMatch("m-q2", ["5", "6", "7", "8"]),
        ],
        expectedVersion: before.revision,
      }
    );
    assert.equal(created.ok, true);
    assert.equal(created.matches[0].status, "waiting");
    assert.equal(created.matches[0].courtId, null);
    assert.equal(created.matches[1].status, "waiting");
    assert.equal(created.matches[1].courtId, null);

    const after = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(after.hasCourtCapability, true);
    assert.equal(after.availableCourts.length, 2);
    assert.equal((after.leases || []).filter((lease) => lease.status === "active").length, 0);
    assert.equal(after.dailyPlay.matches.every((match) => match.status === "waiting"), true);
  });

  test("no false NO_COURT warning when courts available", () => {
    const snapshot = normalizeDailyPlayServerSnapshot({
      ok: true,
      tournamentId: TID,
      state: {
        revision: 2,
        checkedInPlayerIds: CHECKED_IN,
        matches: [
          waitingMatch("m-q1", ["1", "2", "3", "4"]),
          waitingMatch("m-q2", ["5", "6", "7", "8"]),
        ],
      },
      courts: COURTS,
      activeLeases: [],
    });
    assert.equal(snapshot.hasCourtCapability, true);
    assert.equal(snapshot.availableCourts.length, 2);
    const plan = resolveCreateMatchCount({
      enabledCourts: snapshot.courts,
      availableCourts: snapshot.availableCourts,
      eligiblePlayerCount: 8,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.waitingForCourt, false);
    assert.notEqual(plan.code, DAILY_PLAY_CODE.NO_COURT_CAPABILITY);
  });
});

describe("Assign court contract", () => {
  test("waiting match + available court → assign succeeds with courtId null auto-select", async () => {
    const { service } = seedService({
      dailyPlay: {
        ...defaultDailySettings(),
        checkedInPlayerIds: CHECKED_IN,
        revision: 1,
        matches: [waitingMatch("m-wait", ["1", "2", "3", "4"])],
      },
    });
    const before = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(before.availableCourts.length, 2);

    const assigned = await service.assignCourt(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-wait",
        courtId: null,
        expectedVersion: before.revision,
        idempotencyKey: "assign-auto",
      }
    );
    assert.equal(assigned.ok, true);
    const match = assigned.dailyPlay.matches.find((item) => item.id === "m-wait");
    assert.equal(match.status, "assigned");
    assert.ok(match.courtId);
    const after = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(after.availableCourts.length, 1);
    assert.equal(
      (after.leases || after.activeLeases || []).filter((lease) => lease.status === "active")
        .length,
      1
    );
  });

  test("assign failure produces specific domain message, not empty generic object", async () => {
    const { service } = seedService({
      dailyPlay: {
        ...defaultDailySettings(),
        checkedInPlayerIds: CHECKED_IN,
        revision: 1,
        matches: [waitingMatch("m-wait", ["1", "2", "3", "4"])],
      },
    });
    const missing = await service.assignCourt(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "missing-match",
        courtId: "tt412-1",
        expectedVersion: 1,
        idempotencyKey: "assign-missing",
      }
    );
    assert.equal(missing.ok, false);
    assert.ok(missing.code);
    assert.ok(missing.error);
    assert.notEqual(missing.error, DAILY_PLAY_GENERIC_ACTION_ERROR);
    assert.notEqual(JSON.stringify(missing), JSON.stringify({ ok: false }));
  });
});

describe("Hook and setup error lifecycle source contracts", () => {
  test("successful mutation readback clears error even when signature is identical", () => {
    const hook = fs.readFileSync(
      path.resolve("src/features/daily-play/canonical/useDailyPlayCanonicalSession.js"),
      "utf8"
    );
    assert.match(hook, /shouldClearSessionErrorAfterSnapshot/);
    assert.match(hook, /normalizeDailyPlayMutationResult/);
    assert.match(hook, /DAILY_PLAY_GENERIC_ACTION_ERROR/);
    assert.match(hook, /isObsoleteNoCourtAvailabilityError/);
    assert.match(hook, /resolveAssignCourtId/);
    assert.match(
      hook,
      /if \(!readback\?\.ok\) \{[\s\S]*setErrorState\(failure\.error\)[\s\S]*setErrorState\(null\)/
    );
  });

  test("create success clears actionError and session.error", () => {
    const setup = fs.readFileSync(
      path.resolve("src/pages/tournament/DailyPlaySetup.jsx"),
      "utf8"
    );
    const createFn = setup.slice(
      setup.indexOf("const handleCreateMatches"),
      setup.indexOf("const handleAssignCourt")
    );
    assert.match(createFn, /setActionError\(null\)/);
    assert.match(createFn, /session\.setError\?\.\(null\)/);
    assert.match(createFn, /resolveCreateCourtWaitingNote/);
    assert.match(createFn, /Đã tạo/);
    assert.equal(createFn.includes("session.assignCourt"), false);
  });

  test("assignCourt UI keeps auto-select null courtId and maps domain failures", () => {
    const setup = fs.readFileSync(
      path.resolve("src/pages/tournament/DailyPlaySetup.jsx"),
      "utf8"
    );
    const assignFn = setup.slice(
      setup.indexOf("const handleAssignCourt"),
      setup.indexOf("const handleStartMatch")
    );
    assert.match(assignFn, /session\.assignCourt\(match\.id\)/);
    assert.equal(assignFn.includes("courtId:"), false);
    assert.match(assignFn, /DAILY_PLAY_MESSAGES\[result\?\.code\]/);
    const hook = fs.readFileSync(
      path.resolve("src/features/daily-play/canonical/useDailyPlayCanonicalSession.js"),
      "utf8"
    );
    assert.match(hook, /resolveAssignCourtId\(courtId, availableCourtsRef\.current\)/);
  });
});

describe("Waiting vs available-court semantics", () => {
  test("enabledCourtIds=[] means all usable canonical courts", () => {
    const selected = selectEnabledCourts(COURTS, []);
    assert.equal(selected.length, 2);
    assert.equal(selected.map((court) => court.id).join(","), "tt412-1,tt412-2");
  });

  test("2 available courts + 0 leases → countPlan.waitingForCourt=false", () => {
    const plan = resolveCreateMatchCount({
      enabledCourts: COURTS,
      availableCourts: COURTS,
      eligiblePlayerCount: 8,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.waitingForCourt, false);
    assert.equal(shouldShowNoCourtWaitingWarning(2), false);
    assert.equal(resolveCreateCourtWaitingNote({ availableCourtCount: 2, waitingForCourt: true }), "");
  });

  test("queue-first create with available courts → no no-court warning and no lease", async () => {
    const { service } = seedService();
    const created = await service.createMatches(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matches: [
          waitingMatch("m-q1", ["1", "2", "3", "4"]),
          waitingMatch("m-q2", ["5", "6", "7", "8"]),
        ],
        expectedVersion: 0,
      }
    );
    assert.equal(created.ok, true);
    assert.equal(created.waitingForCourt, false);
    assert.equal(created.matches[0].status, "waiting");
    const after = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(after.availableCourts.length, 2);
    assert.equal((after.leases || []).filter((lease) => lease.status === "active").length, 0);
    assert.equal(isObsoleteNoCourtAvailabilityError(DAILY_PLAY_MESSAGES.COURTS_BUSY_WAITING, 2), true);
    assert.equal(
      resolveCreateCourtWaitingNote({
        availableCourtCount: after.availableCourts.length,
        waitingForCourt: created.waitingForCourt,
      }),
      ""
    );
  });

  test("all courts busy → waiting warning allowed", () => {
    const plan = resolveCreateMatchCount({
      enabledCourts: COURTS,
      availableCourts: [],
      eligiblePlayerCount: 8,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.waitingForCourt, true);
    assert.equal(shouldShowNoCourtWaitingWarning(0), true);
    assert.equal(
      resolveCreateCourtWaitingNote({ availableCourtCount: 0, waitingForCourt: true }),
      DAILY_PLAY_MESSAGES.COURTS_BUSY_WAITING
    );
  });

  test("assign auto-select respects empty enabledCourtIds = all courts", async () => {
    const { service } = seedService({
      dailyPlay: {
        ...defaultDailySettings(),
        checkedInPlayerIds: CHECKED_IN,
        enabledCourtIds: [],
        revision: 1,
        matches: [waitingMatch("m-wait", ["1", "2", "3", "4"])],
      },
    });
    const assigned = await service.assignCourt(
      { tenantId: TENANT, clubId: CLUB, tournamentId: TID },
      {
        matchId: "m-wait",
        courtId: resolveAssignCourtId(null, COURTS),
        expectedVersion: 1,
        idempotencyKey: "assign-empty-enabled",
      }
    );
    assert.equal(assigned.ok, true);
    const match = assigned.dailyPlay.matches.find((item) => item.id === "m-wait");
    assert.equal(match.status, "assigned");
    assert.equal(match.courtId, "tt412-1");
    const after = await service.getState({
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: TID,
    });
    assert.equal(
      (after.leases || []).filter((lease) => lease.status === "active").length,
      1
    );
  });

  test("false NO_COURT_AVAILABLE cannot occur while canonical availableCourtCount>0", () => {
    assert.equal(
      isObsoleteNoCourtAvailabilityError(
        DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_AVAILABLE],
        2
      ),
      true
    );
    const setup = fs.readFileSync(
      path.resolve("src/pages/tournament/DailyPlaySetup.jsx"),
      "utf8"
    );
    assert.match(setup, /isObsoleteNoCourtAvailabilityError/);
    assert.match(setup, /noCourtWaitingNotice/);
    assert.match(setup, /severity="warning"/);
  });

  test("stale no-court error clears after successful canonical readback", () => {
    assert.equal(
      isObsoleteNoCourtAvailabilityError(DAILY_PLAY_MESSAGES.COURTS_BUSY_WAITING, 2),
      true
    );
    assert.equal(
      shouldClearSessionErrorAfterSnapshot({
        snapshotOk: true,
        replaced: false,
        reason: DAILY_PLAY_REFRESH_REASON.MUTATION,
      }),
      true
    );
    const hook = fs.readFileSync(
      path.resolve("src/features/daily-play/canonical/useDailyPlayCanonicalSession.js"),
      "utf8"
    );
    assert.match(hook, /isObsoleteNoCourtAvailabilityError/);
  });
});

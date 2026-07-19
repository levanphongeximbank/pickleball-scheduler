/**
 * Phase 2B Owner follow-up — fail-closed Competition availability wiring.
 *
 * LEGACY callers in other suites must pass `{ legacyAvailability: true }`.
 * This file covers REQUIRED (production) behavior and cache-key isolation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MATCH_STATUS } from "../src/models/tournament/constants.js";
import { generateSchedule } from "../src/features/tournament-engine/engines/scheduleEngine.js";
import { assignCourts } from "../src/features/tournament-engine/engines/courtAssignmentEngine.js";
import { assignTournamentMatchToAvailableCourt } from "../src/tournament/engines/tournamentDirectorEngine.js";
import { createMatchRecord } from "../src/models/tournament/index.js";
import {
  AVAILABILITY_ERROR_CODE,
  AVAILABILITY_MODE,
  __resetCompetitionAvailabilityGuardDepsForTests,
  __setCompetitionAvailabilityGuardDepsForTests,
  buildAvailabilityCacheKey,
  createCompetitionAvailabilityChecker,
  resolveAvailabilityMode,
  resolveDirectorAssignWindow,
  resolveScheduleConfigWindow,
} from "../src/features/tournament-engine/services/competitionAvailabilityGuard.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test.afterEach(() => {
  __resetCompetitionAvailabilityGuardDepsForTests();
});

test("resolveAvailabilityMode defaults to REQUIRED (fail-closed)", () => {
  assert.equal(resolveAvailabilityMode({}, {}), AVAILABILITY_MODE.REQUIRED);
  assert.equal(
    resolveAvailabilityMode({ legacyAvailability: true }, {}),
    AVAILABILITY_MODE.LEGACY
  );
});

test("cache key includes club/venue/date/window/courts/cluster/context", () => {
  const a = buildAvailabilityCacheKey({
    clubId: "club-a",
    venueId: "venue-1",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "11:00",
    courtIds: ["c1", "c2"],
    clusterId: "cl-1",
    context: { excludeBookingId: "b1" },
  });
  const b = buildAvailabilityCacheKey({
    clubId: "club-b",
    venueId: "venue-1",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "11:00",
    courtIds: ["c1", "c2"],
    clusterId: "cl-1",
    context: { excludeBookingId: "b1" },
  });
  const c = buildAvailabilityCacheKey({
    clubId: "club-a",
    venueId: "venue-1",
    date: "2026-07-18",
    startTime: "12:00",
    endTime: "13:00",
    courtIds: ["c1", "c2"],
    clusterId: "cl-1",
    context: { excludeBookingId: "b1" },
  });
  assert.match(a, /club:club-a/);
  assert.match(a, /venue:venue-1/);
  assert.match(a, /date:2026-07-18/);
  assert.match(a, /start:10:00/);
  assert.match(a, /end:11:00/);
  assert.match(a, /courts:c1,c2/);
  assert.match(a, /cluster:cl-1/);
  assert.match(a, /ex:b1/);
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test("checker cache does not reuse another window or club result", () => {
  const calls = [];
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability(options) {
      calls.push({ ...options });
      return {
        availableCourtIds: options.startTime === "10:00" ? ["c1"] : ["c2"],
        unavailableCourts: [],
      };
    },
  });

  const checker = createCompetitionAvailabilityChecker({
    clubId: "club-1",
    courtIds: ["c1", "c2"],
    mode: AVAILABILITY_MODE.REQUIRED,
  });

  assert.equal(checker.isCourtAvailable("c1", "2026-07-18", "10:00", "11:00"), true);
  assert.equal(checker.isCourtAvailable("c2", "2026-07-18", "10:00", "11:00"), false);
  assert.equal(checker.isCourtAvailable("c2", "2026-07-18", "12:00", "13:00"), true);
  assert.equal(calls.length, 2);

  const keys = [...checker.cache.keys()];
  assert.equal(keys.length, 2);
  assert.ok(keys.every((k) => k.includes("club:club-1")));
  assert.notEqual(keys[0], keys[1]);
});

test("REQUIRED generateSchedule fails closed without clubId", () => {
  let called = false;
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability() {
      called = true;
      return { availableCourtIds: ["c1"], unavailableCourts: [] };
    },
  });

  const result = generateSchedule({
    tournamentId: "t1",
    matches: [
      { id: "m1", entryAId: "p1", entryBId: "p2", status: MATCH_STATUS.WAITING },
    ],
    courts: [{ id: "c1", name: "Sân 1" }],
    scheduleConfig: {
      date: "2026-07-18",
      startTime: "08:00",
      endTime: "22:00",
      averageMatchMinutes: 20,
      bufferMinutes: 5,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_ERROR_CODE.CLUB_SCOPE_MISSING);
  assert.equal(called, false);
});

test("REQUIRED generateSchedule fails closed without civil window", () => {
  const result = generateSchedule({
    tournamentId: "t1",
    clubId: "club-1",
    timezone: "Asia/Ho_Chi_Minh",
    matches: [
      { id: "m1", entryAId: "p1", entryBId: "p2", status: MATCH_STATUS.WAITING },
    ],
    courts: [{ id: "c1", name: "Sân 1" }],
    scheduleConfig: {
      startTime: "08:00",
      endTime: "22:00",
      averageMatchMinutes: 20,
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_ERROR_CODE.SCHEDULE_WINDOW_MISSING);
});

test("production-shaped generateSchedule passes clubId+window and invokes adapter", () => {
  let calls = 0;
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability(options) {
      calls += 1;
      assert.equal(options.clubId, "club-runtime");
      assert.equal(options.date, "2026-07-18");
      assert.ok(options.startTime);
      assert.ok(options.endTime);
      return {
        availableCourtIds: ["c2"],
        unavailableCourts: [
          { courtId: "c1", available: false, reasons: ["BOOKING_CONFLICT"], conflicts: [] },
        ],
      };
    },
  });

  const result = generateSchedule({
    tournamentId: "t1",
    clubId: "club-runtime",
    timezone: "Asia/Ho_Chi_Minh",
    matches: [
      {
        id: "m1",
        entryAId: "p1",
        entryBId: "p2",
        round: 1,
        status: MATCH_STATUS.WAITING,
      },
    ],
    courts: [
      { id: "c1", name: "Sân 1", priority: 10 },
      { id: "c2", name: "Sân 2", priority: 1 },
    ],
    scheduleConfig: {
      date: "2026-07-18",
      startTime: "08:00",
      endTime: "22:00",
      averageMatchMinutes: 20,
      bufferMinutes: 5,
    },
  });

  assert.equal(result.ok, true);
  assert.ok(calls >= 1);
  assert.equal(result.data.matches.find((m) => m.id === "m1").courtId, "c2");
});

test("REQUIRED generateSchedule DATA_UNAVAILABLE cannot fall back to legacy", () => {
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability() {
      throw Object.assign(new Error("blob missing"), { code: "DATA_UNAVAILABLE" });
    },
  });

  const result = generateSchedule({
    tournamentId: "t1",
    clubId: "club-1",
    timezone: "Asia/Ho_Chi_Minh",
    matches: [
      { id: "m1", entryAId: "p1", entryBId: "p2", status: MATCH_STATUS.WAITING },
    ],
    courts: [{ id: "c1", name: "Sân 1" }],
    scheduleConfig: {
      date: "2026-07-18",
      startTime: "08:00",
      endTime: "22:00",
      averageMatchMinutes: 20,
      bufferMinutes: 5,
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /DATA_UNAVAILABLE/);
});

test("REQUIRED assignCourts fails closed without clubId", () => {
  const result = assignCourts({
    matches: [{ id: "m1", entryAId: "a", entryBId: "b", status: MATCH_STATUS.WAITING }],
    courts: [{ id: "c1", name: "Sân 1" }],
    scheduleConfig: {
      date: "2026-07-18",
      startTime: "08:00",
      endTime: "22:00",
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_ERROR_CODE.CLUB_SCOPE_MISSING);
});

test("REQUIRED assignCourts skips unavailable courts for match window", () => {
  // 10:00–10:25 Asia/Ho_Chi_Minh on 2026-07-18
  const startIso = new Date(Date.UTC(2026, 6, 18, 3, 0, 0)).toISOString();
  const endIso = new Date(Date.UTC(2026, 6, 18, 3, 25, 0)).toISOString();

  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability(options) {
      assert.equal(options.clubId, "club-1");
      assert.equal(options.date, "2026-07-18");
      return {
        availableCourtIds: ["c2"],
        unavailableCourts: [
          { courtId: "c1", available: false, reasons: ["COURT_MAINTENANCE"], conflicts: [] },
        ],
      };
    },
  });

  const result = assignCourts({
    clubId: "club-1",
    timezone: "Asia/Ho_Chi_Minh",
    scheduleConfig: {
      date: "2026-07-18",
      startTime: "08:00",
      endTime: "22:00",
    },
    matches: [
      {
        id: "m1",
        entryAId: "a",
        entryBId: "b",
        status: MATCH_STATUS.WAITING,
        scheduledStart: startIso,
        scheduledEnd: endIso,
      },
    ],
    courts: [
      { id: "c1", name: "Sân 1", priority: 10 },
      { id: "c2", name: "Sân 2", priority: 1 },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.assignments[0].courtId, "c2");
});

test("Director REQUIRED fails closed without clubId", () => {
  const result = assignTournamentMatchToAvailableCourt({
    matches: [
      createMatchRecord({
        id: "m1",
        entryAId: "e1",
        entryBId: "e2",
        status: MATCH_STATUS.WAITING,
      }),
    ],
    courts: [{ id: "1", name: "San 1", active: true }],
    matchId: "m1",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "11:00",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_ERROR_CODE.CLUB_SCOPE_MISSING);
});

test("Director REQUIRED fails closed without civil window", () => {
  const result = assignTournamentMatchToAvailableCourt({
    matches: [
      createMatchRecord({
        id: "m1",
        entryAId: "e1",
        entryBId: "e2",
        status: MATCH_STATUS.WAITING,
      }),
    ],
    courts: [{ id: "1", name: "San 1", active: true }],
    matchId: "m1",
    clubId: "club-1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, AVAILABILITY_ERROR_CODE.SCHEDULE_WINDOW_MISSING);
});

test("Director production-shaped caller passes clubId+window and invokes adapter", () => {
  let called = false;
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability(options) {
      called = true;
      assert.equal(options.clubId, "club-director");
      assert.equal(options.date, "2026-07-18");
      assert.equal(options.startTime, "10:00");
      assert.equal(options.endTime, "11:00");
      return {
        availableCourtIds: ["2"],
        unavailableCourts: [
          { courtId: "1", available: false, reasons: ["BOOKING_CONFLICT"], conflicts: [] },
        ],
      };
    },
  });

  const result = assignTournamentMatchToAvailableCourt({
    matches: [
      createMatchRecord({
        id: "m1",
        entryAId: "e1",
        entryBId: "e2",
        status: MATCH_STATUS.WAITING,
      }),
    ],
    courts: [
      { id: "1", name: "San 1", active: true },
      { id: "2", name: "San 2", active: true },
    ],
    matchId: "m1",
    clubId: "club-director",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "11:00",
  });

  assert.equal(result.ok, true);
  assert.equal(called, true);
  assert.equal(result.courtId, "2");
});

test("Director DATA_UNAVAILABLE cannot fall back to legacy assignment", () => {
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability() {
      throw Object.assign(new Error("load fail"), { code: "DATA_UNAVAILABLE" });
    },
  });

  const result = assignTournamentMatchToAvailableCourt({
    matches: [
      createMatchRecord({
        id: "m1",
        entryAId: "e1",
        entryBId: "e2",
        status: MATCH_STATUS.WAITING,
      }),
    ],
    courts: [{ id: "1", name: "San 1", active: true }],
    matchId: "m1",
    clubId: "club-1",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "11:00",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "DATA_UNAVAILABLE");
});

test("LEGACY-only Director path remains isolated when opted in", () => {
  let called = false;
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability() {
      called = true;
      return { availableCourtIds: [], unavailableCourts: [] };
    },
  });

  const result = assignTournamentMatchToAvailableCourt({
    matches: [
      createMatchRecord({
        id: "m1",
        entryAId: "e1",
        entryBId: "e2",
        status: MATCH_STATUS.WAITING,
      }),
    ],
    courts: [{ id: "1", name: "San 1", active: true }],
    matchId: "m1",
    legacyAvailability: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.courtId, "1");
  assert.equal(called, false);
});

test("resolveDirectorAssignWindow prefers match ISO on civil date", () => {
  const timezone = "Asia/Ho_Chi_Minh";
  // 09:00–09:30 venue-local on 2026-07-18
  const startIso = new Date(
    Date.UTC(2026, 6, 18, 2, 0, 0)
  ).toISOString(); // 09:00 HCM
  const endIso = new Date(Date.UTC(2026, 6, 18, 2, 30, 0)).toISOString();
  const window = resolveDirectorAssignWindow({
    match: {
      scheduledStart: startIso,
      scheduledEnd: endIso,
    },
    date: "2026-07-18",
    startTime: "08:00",
    endTime: "22:00",
    timezone,
  });
  assert.deepEqual(window, {
    date: "2026-07-18",
    startTime: "09:00",
    endTime: "09:30",
  });
});

test("static: production Director caller wires clubId + courtSchedule window", () => {
  const source = readFileSync(
    path.join(root, "src/features/tournament/director/hooks/useDirectorActions.js"),
    "utf8"
  );
  assert.match(source, /clubId:\s*activeClubId/);
  assert.match(source, /courtSchedule\.date/);
  assert.match(source, /courtSchedule\.startTime/);
  assert.match(source, /courtSchedule\.endTime/);
  assert.match(source, /Thiếu clubId/);
});

test("static: PublishSchedule + Engine hooks require clubId and courtSchedule.date", () => {
  const publish = readFileSync(
    path.join(root, "src/pages/tournament/TournamentPublishSchedulePage.jsx"),
    "utf8"
  );
  const hook = readFileSync(
    path.join(root, "src/features/tournament-engine/hooks/useTournamentEngine.js"),
    "utf8"
  );
  assert.match(publish, /clubId:\s*activeClubId/);
  assert.match(publish, /courtSchedule\.date/);
  assert.doesNotMatch(publish, /toISOString\(\)\.slice\(0,\s*10\)/);
  assert.match(hook, /clubId:\s*activeClubId/);
  assert.match(hook, /SCHEDULE_WINDOW_MISSING/);
});

test("resolveScheduleConfigWindow rejects incomplete config", () => {
  assert.equal(resolveScheduleConfigWindow({ startTime: "08:00", endTime: "22:00" }), null);
  assert.deepEqual(
    resolveScheduleConfigWindow({
      date: "2026-07-18",
      startTime: "08:00",
      endTime: "22:00",
    }),
    { date: "2026-07-18", startTime: "08:00", endTime: "22:00" }
  );
});

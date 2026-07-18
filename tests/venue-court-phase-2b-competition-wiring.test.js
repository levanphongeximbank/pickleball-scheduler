import test from "node:test";
import assert from "node:assert/strict";

import { MATCH_STATUS } from "../src/models/tournament/constants.js";
import { generateSchedule } from "../src/features/tournament-engine/engines/scheduleEngine.js";
import { assignCourts } from "../src/features/tournament-engine/engines/courtAssignmentEngine.js";
import { assignTournamentMatchToAvailableCourt } from "../src/tournament/engines/tournamentDirectorEngine.js";
import { createMatchRecord } from "../src/models/tournament/index.js";
import {
  __resetCompetitionAvailabilityGuardDepsForTests,
  __setCompetitionAvailabilityGuardDepsForTests,
  createCompetitionAvailabilityChecker,
  filterCourtsForScheduleWindow,
  isoToCivilHhmm,
  resolveMatchCivilWindow,
  resolveScheduleConfigWindow,
} from "../src/features/tournament-engine/services/competitionAvailabilityGuard.js";

test.afterEach(() => {
  __resetCompetitionAvailabilityGuardDepsForTests();
});

test("isoToCivilHhmm uses local midnight basis for civil HH:mm", () => {
  const date = "2026-07-18";
  const iso = new Date(`${date}T00:00:00`);
  iso.setMinutes(9 * 60 + 30);
  assert.equal(isoToCivilHhmm(iso.toISOString(), date), "09:30");
});

test("resolveScheduleConfigWindow reads date/start/end", () => {
  assert.deepEqual(
    resolveScheduleConfigWindow({
      date: "2026-07-18",
      startTime: "08:00",
      endTime: "22:00",
    }),
    { date: "2026-07-18", startTime: "08:00", endTime: "22:00" }
  );
  assert.equal(resolveScheduleConfigWindow({ startTime: "08:00", endTime: "22:00" }), null);
});

test("resolveMatchCivilWindow from ISO scheduled range", () => {
  const start = new Date("2026-07-18T00:00:00");
  start.setMinutes(10 * 60);
  const end = new Date("2026-07-18T00:00:00");
  end.setMinutes(10 * 60 + 25);
  const window = resolveMatchCivilWindow({
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
  });
  assert.deepEqual(window, {
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "10:25",
  });
});

test("checker skips when clubId missing (legacy path)", () => {
  const checker = createCompetitionAvailabilityChecker({ clubId: null });
  assert.equal(checker.enabled, false);
  assert.equal(checker.isCourtAvailable("c1", "2026-07-18", "10:00", "11:00"), true);
});

test("checker filters courts via getCompetitionCourtAvailability", () => {
  let calls = 0;
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability(options) {
      calls += 1;
      assert.equal(options.clubId, "club-1");
      assert.equal(options.date, "2026-07-18");
      assert.equal(options.startTime, "10:00");
      assert.equal(options.endTime, "11:00");
      return {
        availableCourtIds: ["c2"],
        unavailableCourts: [
          { courtId: "c1", available: false, reasons: ["BOOKING_CONFLICT"], conflicts: [] },
        ],
      };
    },
  });

  const checker = createCompetitionAvailabilityChecker({
    clubId: "club-1",
    courtIds: ["c1", "c2"],
  });
  assert.equal(checker.enabled, true);
  assert.equal(checker.isCourtAvailable("c1", "2026-07-18", "10:00", "11:00"), false);
  assert.equal(checker.isCourtAvailable("c2", "2026-07-18", "10:00", "11:00"), true);
  // cached
  assert.equal(checker.isCourtAvailable("c2", "2026-07-18", "10:00", "11:00"), true);
  assert.equal(calls, 1);

  const filtered = checker.filterCourts(
    [
      { id: "c1", name: "A" },
      { id: "c2", name: "B" },
    ],
    "2026-07-18",
    "10:00",
    "11:00"
  );
  assert.equal(filtered.ok, true);
  assert.deepEqual(
    filtered.courts.map((c) => c.id),
    ["c2"]
  );
});

test("filterCourtsForScheduleWindow surfaces DATA_UNAVAILABLE", () => {
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability() {
      throw Object.assign(new Error("load failed"), { code: "DATA_UNAVAILABLE" });
    },
  });

  const result = filterCourtsForScheduleWindow({
    clubId: "club-1",
    courts: [{ id: "c1", name: "Sân 1" }],
    scheduleConfig: {
      date: "2026-07-18",
      startTime: "08:00",
      endTime: "22:00",
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /DATA_UNAVAILABLE/);
});

test("generateSchedule without clubId keeps legacy behavior", () => {
  let called = false;
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability() {
      called = true;
      return { availableCourtIds: [], unavailableCourts: [] };
    },
  });

  const result = generateSchedule({
    tournamentId: "t1",
    matches: [
      {
        id: "m1",
        entryAId: "p1",
        entryBId: "p2",
        round: 1,
        status: MATCH_STATUS.WAITING,
      },
    ],
    courts: [{ id: "c1", name: "Sân 1" }],
    scheduleConfig: {
      startTime: "08:00",
      endTime: "22:00",
      averageMatchMinutes: 20,
      bufferMinutes: 5,
      date: "2026-07-18",
    },
  });
  assert.equal(result.ok, true);
  assert.equal(called, false);
  assert.equal(result.data.matches.find((m) => m.id === "m1").courtId, "c1");
});

test("generateSchedule skips booked court when clubId present", () => {
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability(options) {
      // c1 unavailable for any slot; c2 available
      const available = options.courtIds?.includes("c2") ? ["c2"] : [];
      return {
        availableCourtIds: available.filter((id) => id !== "c1"),
        unavailableCourts: [
          { courtId: "c1", available: false, reasons: ["BOOKING_CONFLICT"], conflicts: [] },
        ],
      };
    },
  });

  const result = generateSchedule({
    tournamentId: "t1",
    clubId: "club-1",
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
      startTime: "08:00",
      endTime: "22:00",
      averageMatchMinutes: 20,
      bufferMinutes: 5,
      date: "2026-07-18",
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.matches.find((m) => m.id === "m1").courtId, "c2");
});

test("generateSchedule fails hard on DATA_UNAVAILABLE", () => {
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability() {
      throw Object.assign(new Error("blob missing"), { code: "DATA_UNAVAILABLE" });
    },
  });

  const result = generateSchedule({
    tournamentId: "t1",
    clubId: "club-1",
    matches: [
      {
        id: "m1",
        entryAId: "p1",
        entryBId: "p2",
        round: 1,
        status: MATCH_STATUS.WAITING,
      },
    ],
    courts: [{ id: "c1", name: "Sân 1" }],
    scheduleConfig: {
      startTime: "08:00",
      endTime: "22:00",
      averageMatchMinutes: 20,
      bufferMinutes: 5,
      date: "2026-07-18",
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /DATA_UNAVAILABLE/);
});

test("assignCourts skips unavailable court for match window", () => {
  const start = new Date("2026-07-18T00:00:00");
  start.setMinutes(10 * 60);
  const end = new Date("2026-07-18T00:00:00");
  end.setMinutes(10 * 60 + 25);

  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability() {
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
    matches: [
      {
        id: "m1",
        entryAId: "a",
        entryBId: "b",
        status: MATCH_STATUS.WAITING,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
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

test("assignCourts without clubId ignores Venue & Court gate", () => {
  let called = false;
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability() {
      called = true;
      return { availableCourtIds: [], unavailableCourts: [] };
    },
  });

  const result = assignCourts({
    matches: [{ id: "m1", entryAId: "a", entryBId: "b", status: MATCH_STATUS.WAITING }],
    courts: [
      { id: "c1", name: "Sân 1", locked: true, priority: 10 },
      { id: "c2", name: "Sân 2", locked: false, priority: 5 },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.assignments[0].courtId, "c2");
  assert.equal(called, false);
});

test("Director assign filters by Venue & Court when clubId + window provided", () => {
  __setCompetitionAvailabilityGuardDepsForTests({
    getCompetitionCourtAvailability() {
      return {
        availableCourtIds: ["2"],
        unavailableCourts: [
          { courtId: "1", available: false, reasons: ["BOOKING_CONFLICT"], conflicts: [] },
        ],
      };
    },
  });

  const courts = [
    { id: "1", name: "San 1", active: true },
    { id: "2", name: "San 2", active: true },
  ];
  const matches = [
    createMatchRecord({
      id: "m1",
      entryAId: "e1",
      entryBId: "e2",
      status: MATCH_STATUS.WAITING,
    }),
  ];

  const result = assignTournamentMatchToAvailableCourt({
    matches,
    courts,
    matchId: "m1",
    clubId: "club-1",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "11:00",
  });

  assert.equal(result.ok, true);
  assert.equal(result.courtId, "2");
});

test("Director assign without clubId keeps first free runtime court", () => {
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
  });
  assert.equal(result.ok, true);
  assert.equal(result.courtId, "1");
  assert.equal(called, false);
});

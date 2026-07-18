/**
 * Phase 2D — Court Engine availability guard (fail-closed).
 *
 * LEGACY callers in other suites must pass `{ legacyAvailability: true }`.
 * This file covers REQUIRED (production) behavior.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PLAY_MODE } from "../src/features/court-engine/constants/playModes.js";
import { createCourtSession } from "../src/features/court-engine/models/courtSession.js";
import {
  checkInPlayer,
} from "../src/features/court-engine/services/checkInService.js";
import {
  addToQueue,
  getActiveQueueEntries,
} from "../src/features/court-engine/services/queueService.js";
import {
  generateCourtAssignments,
  confirmAssignments,
} from "../src/features/court-engine/engines/autoCourtAssignmentEngine.js";
import { transferAssignment } from "../src/features/court-engine/services/courtTransferService.js";
import {
  ASSIGNMENT_STATUS,
  COURT_RUNTIME_STATUS,
} from "../src/features/court-engine/constants/statuses.js";
import {
  AVAILABILITY_REASON,
} from "../src/features/venue-court/services/courtAvailabilityService.js";
import {
  CE_AVAILABILITY_ERROR,
  CE_AVAILABILITY_MODE,
  __resetCourtEngineAvailabilityGuardDepsForTests,
  __setCourtEngineAvailabilityGuardDepsForTests,
  buildCeAvailabilityCacheKey,
  buildLocalCivilWindow,
  mapVenueReasonToCeError,
  resolveCeAvailabilityMode,
  validateCourtsForCourtEngine,
} from "../src/features/court-engine/services/courtEngineAvailabilityGuard.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const players = [
  { id: "p1", name: "A", rating: 4.0, gender: "Nam" },
  { id: "p2", name: "B", rating: 4.1, gender: "Nam" },
  { id: "p3", name: "C", rating: 3.9, gender: "Nữ" },
  { id: "p4", name: "D", rating: 4.0, gender: "Nữ" },
];

const courts = [
  { id: "c1", name: "Sân 1", active: true },
  { id: "c2", name: "Sân 2", active: true },
];

const WINDOW = {
  clubId: "club-1",
  date: "2026-07-18",
  startTime: "10:00",
  endTime: "10:20",
};

function buildSessionWithQueue(playerIds) {
  let session = createCourtSession({ clubId: "club-1", name: "Phase2D" });
  playerIds.forEach((playerId) => {
    session = checkInPlayer(session, playerId).session;
    session = addToQueue(session, playerId).session;
  });
  return session;
}

function mockAvailability(byCourtId) {
  return {
    getCourtAvailability(options) {
      const ids = options.courtIds || Object.keys(byCourtId);
      return {
        courts: ids.map((courtId) => {
          const row = byCourtId[String(courtId)] || {
            available: false,
            conflicts: [{ code: AVAILABILITY_REASON.COURT_NOT_FOUND, message: "missing" }],
          };
          return {
            courtId: String(courtId),
            available: Boolean(row.available),
            reasons: row.reasons || (row.conflicts || []).map((c) => c.message),
            conflicts: row.conflicts || [],
          };
        }),
      };
    },
  };
}

function allAvailable(courtIds = ["c1", "c2"]) {
  const by = {};
  for (const id of courtIds) {
    by[id] = { available: true, conflicts: [] };
  }
  return mockAvailability(by);
}

function unavailable(code, message = code) {
  return {
    available: false,
    conflicts: [{ code, message }],
  };
}

test.afterEach(() => {
  __resetCourtEngineAvailabilityGuardDepsForTests();
});

test("resolveCeAvailabilityMode defaults to REQUIRED", () => {
  assert.equal(resolveCeAvailabilityMode({}), CE_AVAILABILITY_MODE.REQUIRED);
  assert.equal(
    resolveCeAvailabilityMode({ legacyAvailability: true }),
    CE_AVAILABILITY_MODE.LEGACY
  );
});

test("cache key includes club/venue/date/window/courts/cluster/exclude", () => {
  const a = buildCeAvailabilityCacheKey({
    clubId: "club-a",
    venueId: "v1",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "10:20",
    courtIds: ["c1", "c2"],
    clusterId: "cl-1",
    context: { excludeBookingId: "b1" },
  });
  const b = buildCeAvailabilityCacheKey({
    clubId: "club-b",
    venueId: "v1",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "10:20",
    courtIds: ["c1", "c2"],
    clusterId: "cl-1",
    context: { excludeBookingId: "b1" },
  });
  assert.match(a, /club:club-a/);
  assert.match(a, /ex:b1/);
  assert.notEqual(a, b);
});

test("reason mapping preserves Venue & Court codes", () => {
  assert.equal(
    mapVenueReasonToCeError(AVAILABILITY_REASON.BOOKING_CONFLICT),
    CE_AVAILABILITY_ERROR.BOOKING_CONFLICT
  );
  assert.equal(
    mapVenueReasonToCeError(AVAILABILITY_REASON.OUTSIDE_VENUE_HOURS),
    CE_AVAILABILITY_ERROR.OUTSIDE_OPERATING_HOURS
  );
  assert.equal(
    mapVenueReasonToCeError(AVAILABILITY_REASON.COURT_MAINTENANCE),
    CE_AVAILABILITY_ERROR.MAINTENANCE
  );
  assert.equal(
    mapVenueReasonToCeError(AVAILABILITY_REASON.COURT_LOCKED),
    CE_AVAILABILITY_ERROR.COURT_LOCKED
  );
  assert.equal(
    mapVenueReasonToCeError(AVAILABILITY_REASON.COURT_INACTIVE),
    CE_AVAILABILITY_ERROR.COURT_INACTIVE
  );
});

test("1. available court can be confirmed", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(allAvailable(["c1"]));
  const session = buildSessionWithQueue(["p1", "p2", "p3", "p4"]);
  const preview = generateCourtAssignments({
    ...WINDOW,
    courts: [courts[0]],
    queueEntries: getActiveQueueEntries(session),
    players,
    config: { playMode: PLAY_MODE.DOUBLES },
  });
  assert.equal(preview.assignments.length, 1);

  const confirmed = confirmAssignments(session, preview.assignments, { ...WINDOW });
  assert.equal(confirmed.ok, true);
  assert.equal(String(confirmed.session.assignments[0].courtId), "c1");
});

test("2. booking-conflicted court cannot be confirmed", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(
    mockAvailability({
      c1: unavailable(AVAILABILITY_REASON.BOOKING_CONFLICT, "booked"),
    })
  );
  const session = buildSessionWithQueue(["p1", "p2", "p3", "p4"]);
  const proposals = [
    {
      id: "a1",
      courtId: "c1",
      players: ["p1", "p2", "p3", "p4"],
      status: ASSIGNMENT_STATUS.ASSIGNED,
    },
  ];
  const confirmed = confirmAssignments(session, proposals, { ...WINDOW });
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.BOOKING_CONFLICT);
  assert.equal((session.assignments || []).length, 0);
});

test("3. maintenance court cannot be confirmed", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(
    mockAvailability({
      c1: unavailable(AVAILABILITY_REASON.COURT_MAINTENANCE),
    })
  );
  const session = buildSessionWithQueue(["p1", "p2", "p3", "p4"]);
  const confirmed = confirmAssignments(
    session,
    [{ id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] }],
    { ...WINDOW }
  );
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.MAINTENANCE);
});

test("4. outside-hours court cannot be confirmed", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(
    mockAvailability({
      c1: unavailable(AVAILABILITY_REASON.OUTSIDE_VENUE_HOURS),
    })
  );
  const session = createCourtSession({ clubId: "club-1" });
  const confirmed = confirmAssignments(
    session,
    [{ id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] }],
    { ...WINDOW }
  );
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.OUTSIDE_OPERATING_HOURS);
});

test("5. locked/inactive master court cannot be confirmed", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(
    mockAvailability({
      c1: unavailable(AVAILABILITY_REASON.COURT_LOCKED),
    })
  );
  let session = createCourtSession({ clubId: "club-1" });
  let confirmed = confirmAssignments(
    session,
    [{ id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] }],
    { ...WINDOW }
  );
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.COURT_LOCKED);

  __setCourtEngineAvailabilityGuardDepsForTests(
    mockAvailability({
      c1: unavailable(AVAILABILITY_REASON.COURT_INACTIVE),
    })
  );
  confirmed = confirmAssignments(
    session,
    [{ id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] }],
    { ...WINDOW }
  );
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.COURT_INACTIVE);
});

test("6. missing clubId fails closed", () => {
  let called = false;
  __setCourtEngineAvailabilityGuardDepsForTests({
    getCourtAvailability() {
      called = true;
      return { courts: [] };
    },
  });
  const session = createCourtSession({ clubId: null });
  session.clubId = null;
  const confirmed = confirmAssignments(
    session,
    [{ id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] }],
    { date: WINDOW.date, startTime: WINDOW.startTime, endTime: WINDOW.endTime }
  );
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.CLUB_REQUIRED);
  assert.equal(called, false);
});

test("7. missing or invalid time window fails closed", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(allAvailable(["c1"]));
  const session = createCourtSession({ clubId: "club-1" });

  const badDate = confirmAssignments(
    session,
    [{ id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] }],
    { clubId: "club-1", date: "bad", startTime: "10:00", endTime: "10:20" }
  );
  assert.equal(badDate.ok, false);
  assert.equal(badDate.code, CE_AVAILABILITY_ERROR.INVALID_TIME_WINDOW);

  const inverted = validateCourtsForCourtEngine({
    clubId: "club-1",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "09:00",
    courtIds: ["c1"],
  });
  assert.equal(inverted.ok, false);
  assert.equal(inverted.code, CE_AVAILABILITY_ERROR.INVALID_TIME_WINDOW);

  const overnight = buildLocalCivilWindow(120, new Date(2026, 6, 18, 23, 30, 0));
  assert.equal(overnight.ok, false);
  assert.equal(overnight.code, CE_AVAILABILITY_ERROR.INVALID_TIME_WINDOW);
});

test("8. DATA_UNAVAILABLE fails closed", () => {
  __setCourtEngineAvailabilityGuardDepsForTests({
    getCourtAvailability() {
      const err = new Error("load failed");
      err.code = AVAILABILITY_REASON.DATA_UNAVAILABLE;
      throw err;
    },
  });
  const session = createCourtSession({ clubId: "club-1" });
  const confirmed = confirmAssignments(
    session,
    [{ id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] }],
    { ...WINDOW }
  );
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.DATA_UNAVAILABLE);
});

test("9-10. confirmation re-checks; court unavailable after preview is rejected", () => {
  let calls = 0;
  __setCourtEngineAvailabilityGuardDepsForTests({
    getCourtAvailability() {
      calls += 1;
      if (calls === 1) {
        return {
          courts: [{ courtId: "c1", available: true, reasons: [], conflicts: [] }],
        };
      }
      return {
        courts: [
          {
            courtId: "c1",
            available: false,
            reasons: ["booked after preview"],
            conflicts: [
              {
                code: AVAILABILITY_REASON.BOOKING_CONFLICT,
                message: "booked after preview",
              },
            ],
          },
        ],
      };
    },
  });

  const session = buildSessionWithQueue(["p1", "p2", "p3", "p4"]);
  const preview = generateCourtAssignments({
    ...WINDOW,
    courts: [courts[0]],
    queueEntries: getActiveQueueEntries(session),
    players,
    config: { playMode: PLAY_MODE.DOUBLES },
  });
  assert.equal(preview.assignments.length, 1);
  assert.ok(calls >= 1);

  const confirmed = confirmAssignments(session, preview.assignments, { ...WINDOW });
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.BOOKING_CONFLICT);
  assert.ok(calls >= 2);
  assert.equal((session.assignments || []).length, 0);
});

test("11-12. transfer validates destination before source; failed transfer preserves source", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(
    mockAvailability({
      c2: unavailable(AVAILABILITY_REASON.BOOKING_CONFLICT, "dest booked"),
    })
  );

  const startedAt = new Date(Date.now() - 10 * 60000).toISOString();
  let session = createCourtSession({ clubId: "club-1" });
  session = {
    ...session,
    assignments: [
      {
        id: "a1",
        courtId: "c1",
        status: ASSIGNMENT_STATUS.PLAYING,
        startedAt,
        players: ["p1", "p2", "p3", "p4"],
      },
    ],
    courtStates: {
      c1: { status: COURT_RUNTIME_STATUS.PLAYING, currentMatchId: "a1" },
      c2: { status: COURT_RUNTIME_STATUS.EMPTY },
    },
  };

  const snapshot = JSON.stringify(session.assignments);
  const result = transferAssignment(session, "a1", "c2", {
    reason: "Đổi sân",
    ...WINDOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, CE_AVAILABILITY_ERROR.BOOKING_CONFLICT);
  assert.equal(JSON.stringify(result.session.assignments), snapshot);
  assert.equal(result.session.assignments[0].courtId, "c1");
  assert.equal(result.session.courtStates.c1.currentMatchId, "a1");
});

test("13-14. batch confirmation validates all courts; one unavailable blocks all", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(
    mockAvailability({
      c1: { available: true, conflicts: [] },
      c2: unavailable(AVAILABILITY_REASON.MAINTENANCE_BOOKING, "maint"),
    })
  );

  const session = createCourtSession({ clubId: "club-1" });
  const proposals = [
    { id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] },
    { id: "a2", courtId: "c2", players: ["p5", "p6", "p7", "p8"] },
  ];
  const confirmed = confirmAssignments(session, proposals, { ...WINDOW });
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.MAINTENANCE);
  assert.equal((session.assignments || []).length, 0);
});

test("batch rejects duplicate court in same window", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(allAvailable(["c1"]));
  const session = createCourtSession({ clubId: "club-1" });
  const confirmed = confirmAssignments(
    session,
    [
      { id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] },
      { id: "a2", courtId: "c1", players: ["p5", "p6", "p7", "p8"] },
    ],
    { ...WINDOW }
  );
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.DUPLICATE_COURT);
});

test("15. Court Engine session-locked court remains blocked", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(allAvailable(["c1"]));
  const session = {
    ...createCourtSession({ clubId: "club-1" }),
    courtStates: {
      c1: { status: COURT_RUNTIME_STATUS.LOCKED, locked: true },
    },
  };
  const confirmed = confirmAssignments(
    session,
    [{ id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] }],
    { ...WINDOW }
  );
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.COURT_LOCKED);
});

test("16. Court Engine active assignment rules remain enforced", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(allAvailable(["c1"]));
  const session = {
    ...createCourtSession({ clubId: "club-1" }),
    assignments: [
      {
        id: "existing",
        courtId: "c1",
        status: ASSIGNMENT_STATUS.PLAYING,
        players: ["x1", "x2", "x3", "x4"],
      },
    ],
    courtStates: {
      c1: { status: COURT_RUNTIME_STATUS.PLAYING, currentMatchId: "existing" },
    },
  };
  const confirmed = confirmAssignments(
    session,
    [{ id: "a1", courtId: "c1", players: ["p1", "p2", "p3", "p4"] }],
    { ...WINDOW }
  );
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.code, CE_AVAILABILITY_ERROR.SESSION_COURT_BUSY);
});

test("17. no direct import of booking or operating-hours repositories from CE guard paths", () => {
  const guardSrc = readFileSync(
    path.join(root, "src/features/court-engine/services/courtEngineAvailabilityGuard.js"),
    "utf8"
  );
  const engineSrc = readFileSync(
    path.join(root, "src/features/court-engine/engines/autoCourtAssignmentEngine.js"),
    "utf8"
  );
  const transferSrc = readFileSync(
    path.join(root, "src/features/court-engine/services/courtTransferService.js"),
    "utf8"
  );
  const serviceSrc = readFileSync(
    path.join(root, "src/features/court-engine/services/courtEngineService.js"),
    "utf8"
  );

  for (const src of [guardSrc, engineSrc, transferSrc, serviceSrc]) {
    assert.equal(src.includes("bookingService"), false);
    assert.equal(src.includes("loadBookingsForClub"), false);
    assert.equal(src.includes("courtManagementSettings"), false);
    assert.equal(src.includes("club_data_v3"), false);
  }

  assert.match(guardSrc, /from ["']\.\.\/\.\.\/venue-court\/index\.js["']/);
});

test("18. no booking write symbols in Court Engine occupy paths", () => {
  const files = [
    "src/features/court-engine/services/courtEngineAvailabilityGuard.js",
    "src/features/court-engine/engines/autoCourtAssignmentEngine.js",
    "src/features/court-engine/services/courtTransferService.js",
    "src/features/court-engine/services/courtEngineService.js",
  ];
  for (const rel of files) {
    const src = readFileSync(path.join(root, rel), "utf8");
    assert.equal(src.includes("createBooking"), false);
    assert.equal(src.includes("saveBooking"), false);
    assert.equal(src.includes("updateBookingStatus"), false);
    assert.equal(src.includes("setTournamentCourtSchedule"), false);
  }
});

test("19. LEGACY mode is explicit and skips Venue & Court", () => {
  let called = false;
  __setCourtEngineAvailabilityGuardDepsForTests({
    getCourtAvailability() {
      called = true;
      return { courts: [] };
    },
  });
  const gate = validateCourtsForCourtEngine({
    clubId: null,
    courtIds: ["c1"],
    options: { legacyAvailability: true },
  });
  assert.equal(gate.ok, true);
  assert.equal(gate.skipped, true);
  assert.equal(called, false);
});

test("successful transfer after destination available", () => {
  __setCourtEngineAvailabilityGuardDepsForTests(allAvailable(["c2"]));
  const startedAt = new Date(Date.now() - 5 * 60000).toISOString();
  let session = createCourtSession({ clubId: "club-1" });
  session = {
    ...session,
    assignments: [
      {
        id: "a1",
        courtId: "c1",
        status: ASSIGNMENT_STATUS.PLAYING,
        startedAt,
        players: ["p1", "p2", "p3", "p4"],
      },
    ],
    courtStates: {
      c1: { status: COURT_RUNTIME_STATUS.PLAYING, currentMatchId: "a1" },
      c2: { status: COURT_RUNTIME_STATUS.EMPTY },
    },
  };

  const result = transferAssignment(session, "a1", "c2", {
    reason: "OK",
    ...WINDOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.session.assignments[0].courtId, "c2");
  assert.equal(result.session.assignments[0].startedAt, startedAt);
});

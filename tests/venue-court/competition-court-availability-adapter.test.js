import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../../src/data/club.js";
import {
  saveCourtsForClub,
  saveBookingsForClub,
} from "../../src/domain/clubStorage.js";
import { saveCourtManagementSettings } from "../../src/domain/courtManagementSettings.js";
import { normalizeCourt } from "../../src/models/court.js";
import { createBookingRecord } from "../../src/models/booking.js";
import {
  getCompetitionCourtAvailability,
  __resetCompetitionCourtAvailabilityAdapterDepsForTests,
  __setCompetitionCourtAvailabilityAdapterDepsForTests,
} from "../../src/features/venue-court/adapters/competitionCourtAvailabilityAdapter.js";
import { getCompetitionCourtAvailability as getFromIndex } from "../../src/features/venue-court/index.js";
import { AVAILABILITY_REASON } from "../../src/features/venue-court/services/courtAvailabilityService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adapterPath = path.join(
  root,
  "src/features/venue-court/adapters/competitionCourtAvailabilityAdapter.js"
);

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

function seedBase() {
  saveClubs([{ id: "club-a", name: "CLB A", venueId: "venue-a" }]);
  saveCourtsForClub(
    [
      normalizeCourt({
        id: "c1",
        name: "Sân 1",
        number: 1,
        active: true,
        status: "active",
        tenantId: "venue-a",
        clusterId: "cluster-a",
      }),
      normalizeCourt({
        id: "c2",
        name: "Sân 2",
        number: 2,
        active: true,
        status: "active",
        tenantId: "venue-a",
        clusterId: "cluster-a",
      }),
      normalizeCourt({
        id: "c-inactive",
        name: "Sân Inactive",
        number: 3,
        active: false,
        status: "locked",
        tenantId: "venue-a",
      }),
    ],
    "club-a"
  );
  saveBookingsForClub([], "club-a");
  saveCourtManagementSettings("club-a", { openHour: 6, closeHour: 22 });
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  __resetCompetitionCourtAvailabilityAdapterDepsForTests();
  seedBase();
});

afterEach(() => {
  __resetCompetitionCourtAvailabilityAdapterDepsForTests();
  delete globalThis.localStorage;
});

const windowOk = {
  clubId: "club-a",
  venueId: "venue-a",
  date: "2026-07-18",
  startTime: "10:00",
  endTime: "11:00",
};

test("public facade exports getCompetitionCourtAvailability", () => {
  assert.equal(typeof getFromIndex, "function");
});

test("adapter delegates to getCourtAvailability with explicit clubId", () => {
  const calls = [];
  __setCompetitionCourtAvailabilityAdapterDepsForTests({
    getCourtAvailability(options) {
      calls.push(options);
      return {
        clubId: options.clubId,
        venueId: options.venueId || null,
        checkedRange: {
          date: options.date,
          startTime: options.startTime,
          endTime: options.endTime,
        },
        courts: [
          {
            available: true,
            courtId: "c1",
            reasons: [],
            conflicts: [],
          },
        ],
      };
    },
  });

  const result = getCompetitionCourtAvailability({
    ...windowOk,
    courtIds: ["c1"],
    clusterId: "cluster-a",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].clubId, "club-a");
  assert.equal(calls[0].venueId, "venue-a");
  assert.equal(calls[0].date, "2026-07-18");
  assert.equal(calls[0].startTime, "10:00");
  assert.equal(calls[0].endTime, "11:00");
  assert.deepEqual(calls[0].courtIds, ["c1"]);
  assert.equal(calls[0].clusterId, "cluster-a");
  assert.equal(calls[0].includeUnavailable, true);
  assert.deepEqual(result.availableCourtIds, ["c1"]);
});

test("venueId is validated through canonical service", () => {
  assert.throws(
    () => getCompetitionCourtAvailability({ ...windowOk, venueId: "venue-other" }),
    (error) => error.code === AVAILABILITY_REASON.VENUE_MISMATCH
  );
});

test("date and time fields are passed without timezone guessing", () => {
  const calls = [];
  __setCompetitionCourtAvailabilityAdapterDepsForTests({
    getCourtAvailability(options) {
      calls.push(options);
      return {
        clubId: options.clubId,
        venueId: null,
        checkedRange: {
          date: options.date,
          startTime: options.startTime,
          endTime: options.endTime,
        },
        courts: [],
      };
    },
  });

  getCompetitionCourtAvailability({
    clubId: "club-a",
    date: "2026-07-18",
    startTime: "09:30",
    endTime: "10:45",
  });

  assert.equal(calls[0].date, "2026-07-18");
  assert.equal(calls[0].startTime, "09:30");
  assert.equal(calls[0].endTime, "10:45");
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], "startAt"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], "endAt"), false);
});

test("available courts produce deterministic availableCourtIds", () => {
  const result = getCompetitionCourtAvailability(windowOk);
  assert.deepEqual(result.availableCourtIds, ["c1", "c2"]);
  assert.equal(result.date, "2026-07-18");
  assert.equal(result.startTime, "10:00");
  assert.equal(result.endTime, "11:00");
});

test("adapter output ordering is deterministic across calls", () => {
  const a = getCompetitionCourtAvailability(windowOk);
  const b = getCompetitionCourtAvailability(windowOk);
  assert.deepEqual(a.availableCourtIds, b.availableCourtIds);
  assert.deepEqual(
    a.unavailableCourts.map((item) => item.courtId),
    b.unavailableCourts.map((item) => item.courtId)
  );
});

test("unavailable courts are excluded from available IDs", () => {
  const result = getCompetitionCourtAvailability(windowOk);
  assert.equal(result.availableCourtIds.includes("c-inactive"), false);
  assert.ok(result.unavailableCourts.some((item) => item.courtId === "c-inactive"));
});

test("unavailable reasons are preserved in adapter output", () => {
  const result = getCompetitionCourtAvailability({
    ...windowOk,
    courtIds: ["c-inactive"],
  });
  assert.deepEqual(result.availableCourtIds, []);
  assert.equal(result.unavailableCourts.length, 1);
  assert.equal(result.unavailableCourts[0].courtId, "c-inactive");
  assert.equal(
    result.unavailableCourts[0].conflicts[0].code,
    AVAILABILITY_REASON.COURT_INACTIVE
  );
  assert.ok(result.unavailableCourts[0].reasons.length >= 1);
});

test("includeUnavailable=false returns empty unavailableCourts", () => {
  const result = getCompetitionCourtAvailability({
    ...windowOk,
    includeUnavailable: false,
  });
  assert.deepEqual(result.availableCourtIds, ["c1", "c2"]);
  assert.deepEqual(result.unavailableCourts, []);
});

test("empty availability returns availableCourtIds: []", () => {
  saveBookingsForClub(
    [
      createBookingRecord({
        id: "b1",
        courtId: "c1",
        date: "2026-07-18",
        startTime: "10:00",
        endTime: "11:00",
        bookingStatus: "confirmed",
      }),
      createBookingRecord({
        id: "b2",
        courtId: "c2",
        date: "2026-07-18",
        startTime: "10:00",
        endTime: "11:00",
        bookingStatus: "confirmed",
      }),
    ],
    "club-a"
  );

  const result = getCompetitionCourtAvailability({
    ...windowOk,
    courtIds: ["c1", "c2"],
    includeUnavailable: false,
  });
  assert.deepEqual(result.availableCourtIds, []);
  assert.deepEqual(result.unavailableCourts, []);
});

test("data load failure is surfaced", () => {
  __setCompetitionCourtAvailabilityAdapterDepsForTests({
    getCourtAvailability() {
      const error = new Error("blob down");
      error.code = AVAILABILITY_REASON.DATA_UNAVAILABLE;
      throw error;
    },
  });
  assert.throws(
    () => getCompetitionCourtAvailability(windowOk),
    (error) => error.code === AVAILABILITY_REASON.DATA_UNAVAILABLE
  );
});

test("invalid time validation is surfaced", () => {
  assert.throws(
    () =>
      getCompetitionCourtAvailability({
        ...windowOk,
        startTime: "10:00",
        endTime: "10:00",
      }),
    (error) => error.code === AVAILABILITY_REASON.INVALID_TIME_RANGE
  );
});

test("scope mismatch is surfaced", () => {
  assert.throws(
    () => getCompetitionCourtAvailability({ ...windowOk, venueId: "venue-other" }),
    (error) => error.code === AVAILABILITY_REASON.VENUE_MISMATCH
  );
});

test("unknown/out-of-scope court IDs do not leak", () => {
  const result = getCompetitionCourtAvailability({
    ...windowOk,
    courtIds: ["missing-court"],
  });
  assert.deepEqual(result.availableCourtIds, []);
  assert.equal(result.unavailableCourts[0].courtId, "missing-court");
  assert.equal(
    result.unavailableCourts[0].conflicts[0].code,
    AVAILABILITY_REASON.COURT_NOT_FOUND
  );
  assert.equal(result.unavailableCourts[0].court, undefined);
});

test("adapter does not mutate canonical results", () => {
  const canonicalCourts = [
    {
      available: true,
      courtId: "c1",
      reasons: ["ok"],
      conflicts: [{ code: "X" }],
    },
    {
      available: false,
      courtId: "c-inactive",
      reasons: ["inactive"],
      conflicts: [{ code: AVAILABILITY_REASON.COURT_INACTIVE }],
    },
  ];
  __setCompetitionCourtAvailabilityAdapterDepsForTests({
    getCourtAvailability() {
      return {
        clubId: "club-a",
        venueId: "venue-a",
        checkedRange: {
          date: "2026-07-18",
          startTime: "10:00",
          endTime: "11:00",
        },
        courts: canonicalCourts,
      };
    },
  });

  const result = getCompetitionCourtAvailability(windowOk);
  result.availableCourtIds.push("hack");
  result.unavailableCourts[0].reasons.push("hack");
  result.unavailableCourts[0].conflicts[0].code = "HACK";

  assert.deepEqual(canonicalCourts[0].reasons, ["ok"]);
  assert.equal(canonicalCourts[1].conflicts[0].code, AVAILABILITY_REASON.COURT_INACTIVE);
});

test("adapter does not mutate caller input", () => {
  const input = {
    ...windowOk,
    courtIds: ["c1", "c2"],
  };
  const courtIdsBefore = [...input.courtIds];
  getCompetitionCourtAvailability(input);
  assert.deepEqual(input.courtIds, courtIdsBefore);
  assert.equal(input.clubId, "club-a");
});

test("no write method is invoked", () => {
  const writes = [];
  __setCompetitionCourtAvailabilityAdapterDepsForTests({
    getCourtAvailability() {
      return {
        clubId: "club-a",
        venueId: "venue-a",
        checkedRange: {
          date: "2026-07-18",
          startTime: "10:00",
          endTime: "11:00",
        },
        courts: [{ available: true, courtId: "c1", reasons: [], conflicts: [] }],
      };
    },
    saveBookingsForClub: () => writes.push("bookings"),
    createBooking: () => writes.push("create"),
    updateBooking: () => writes.push("update"),
    deleteBooking: () => writes.push("delete"),
    assignCourt: () => writes.push("assign"),
    lockCourt: () => writes.push("lock"),
    unlockCourt: () => writes.push("unlock"),
  });

  getCompetitionCourtAvailability(windowOk);
  assert.deepEqual(writes, []);
});

test("courtIds order is preserved in availableCourtIds", () => {
  const result = getCompetitionCourtAvailability({
    ...windowOk,
    courtIds: ["c2", "c1"],
  });
  assert.deepEqual(result.availableCourtIds, ["c2", "c1"]);
});

test("static: no Competition/Court Engine/AI/storage/persistence access", () => {
  const source = readFileSync(adapterPath, "utf8");
  assert.doesNotMatch(source, /competition-core|tournament-engine|court-engine/);
  assert.doesNotMatch(source, /from ["'].*\/ai\/|loadAIData/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|setItem|removeItem/);
  assert.doesNotMatch(
    source,
    /saveBookings|createBooking|updateBooking|deleteBooking|assignCourt|lockCourt|unlockCourt/
  );
});

test("static: no runtime Competition file was modified in Phase 1F", () => {
  // Adapter lives only under venue-court; Competition paths remain untouched.
  const source = readFileSync(adapterPath, "utf8");
  assert.match(source, /getCourtAvailability/);
  assert.doesNotMatch(source, /generateSchedule|assignCourts|assignTournamentMatch/);
});

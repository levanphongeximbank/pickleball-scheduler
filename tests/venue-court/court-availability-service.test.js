import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../../src/data/club.js";
import {
  saveCourtsForClub,
  saveBookingsForClub,
  loadCourtsForClub,
} from "../../src/domain/clubStorage.js";
import { saveCourtManagementSettings } from "../../src/domain/courtManagementSettings.js";
import { normalizeCourt } from "../../src/models/court.js";
import { createBookingRecord } from "../../src/models/booking.js";
import {
  getCourtAvailability,
  AVAILABILITY_REASON,
  __resetCourtAvailabilityDepsForTests,
  __setCourtAvailabilityDepsForTests,
} from "../../src/features/venue-court/services/courtAvailabilityService.js";
import { getCourtAvailability as getFromIndex } from "../../src/features/venue-court/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const servicePath = path.join(
  root,
  "src/features/venue-court/services/courtAvailabilityService.js"
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
        id: "c-inactive",
        name: "Sân Inactive",
        number: 2,
        active: false,
        status: "locked",
        tenantId: "venue-a",
      }),
      normalizeCourt({
        id: "c-locked",
        name: "Sân Locked",
        number: 3,
        active: true,
        status: "locked",
        tenantId: "venue-a",
      }),
      normalizeCourt({
        id: "c-maint",
        name: "Sân Maint",
        number: 4,
        active: true,
        status: "maintenance",
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
  __resetCourtAvailabilityDepsForTests();
  seedBase();
});

afterEach(() => {
  __resetCourtAvailabilityDepsForTests();
  delete globalThis.localStorage;
});

const windowOk = {
  clubId: "club-a",
  venueId: "venue-a",
  date: "2026-07-18",
  startTime: "10:00",
  endTime: "11:00",
};

test("public facade exports getCourtAvailability", () => {
  assert.equal(typeof getFromIndex, "function");
});

test("available active court with no conflicts", () => {
  const result = getCourtAvailability({ ...windowOk, courtId: "c1" });
  assert.equal(result.courts.length, 1);
  assert.equal(result.courts[0].available, true);
  assert.equal(result.courts[0].courtId, "c1");
  assert.deepEqual(result.courts[0].conflicts, []);
});

test("booking overlap blocks the court", () => {
  saveBookingsForClub(
    [
      createBookingRecord({
        id: "b1",
        courtId: "c1",
        date: "2026-07-18",
        startTime: "10:30",
        endTime: "11:30",
        bookingStatus: "confirmed",
        bookingType: "single",
      }),
    ],
    "club-a"
  );

  const result = getCourtAvailability({ ...windowOk, courtId: "c1" });
  assert.equal(result.courts[0].available, false);
  assert.equal(result.courts[0].conflicts[0].code, AVAILABILITY_REASON.BOOKING_CONFLICT);
});

test("adjacent booking ending at request start does not block", () => {
  saveBookingsForClub(
    [
      createBookingRecord({
        id: "b1",
        courtId: "c1",
        date: "2026-07-18",
        startTime: "09:00",
        endTime: "10:00",
        bookingStatus: "confirmed",
      }),
    ],
    "club-a"
  );
  const result = getCourtAvailability({ ...windowOk, courtId: "c1" });
  assert.equal(result.courts[0].available, true);
});

test("adjacent booking starting at request end does not block", () => {
  saveBookingsForClub(
    [
      createBookingRecord({
        id: "b1",
        courtId: "c1",
        date: "2026-07-18",
        startTime: "11:00",
        endTime: "12:00",
        bookingStatus: "confirmed",
      }),
    ],
    "club-a"
  );
  const result = getCourtAvailability({ ...windowOk, courtId: "c1" });
  assert.equal(result.courts[0].available, true);
});

test("cancelled booking does not block", () => {
  saveBookingsForClub(
    [
      createBookingRecord({
        id: "b1",
        courtId: "c1",
        date: "2026-07-18",
        startTime: "10:00",
        endTime: "11:00",
        bookingStatus: "cancelled",
      }),
    ],
    "club-a"
  );
  assert.equal(getCourtAvailability({ ...windowOk, courtId: "c1" }).courts[0].available, true);
});

test("pending booking status does block", () => {
  saveBookingsForClub(
    [
      createBookingRecord({
        id: "b1",
        courtId: "c1",
        date: "2026-07-18",
        startTime: "10:00",
        endTime: "11:00",
        bookingStatus: "pending",
      }),
    ],
    "club-a"
  );
  assert.equal(getCourtAvailability({ ...windowOk, courtId: "c1" }).courts[0].available, false);
});

test("inactive court is unavailable", () => {
  const result = getCourtAvailability({ ...windowOk, courtId: "c-inactive" });
  assert.equal(result.courts[0].available, false);
  assert.equal(result.courts[0].conflicts[0].code, AVAILABILITY_REASON.COURT_INACTIVE);
});

test("locked court is unavailable", () => {
  const result = getCourtAvailability({ ...windowOk, courtId: "c-locked" });
  assert.equal(result.courts[0].available, false);
  assert.equal(result.courts[0].conflicts[0].code, AVAILABILITY_REASON.COURT_LOCKED);
});

test("master maintenance makes court unavailable", () => {
  const result = getCourtAvailability({ ...windowOk, courtId: "c-maint" });
  assert.equal(result.courts[0].available, false);
  assert.equal(result.courts[0].conflicts[0].code, AVAILABILITY_REASON.COURT_MAINTENANCE);
});

test("maintenance booking overlap makes court unavailable", () => {
  saveBookingsForClub(
    [
      createBookingRecord({
        id: "bm",
        courtId: "c1",
        date: "2026-07-18",
        startTime: "10:00",
        endTime: "11:00",
        bookingStatus: "confirmed",
        bookingType: "maintenance",
      }),
    ],
    "club-a"
  );
  const result = getCourtAvailability({ ...windowOk, courtId: "c1" });
  assert.equal(result.courts[0].conflicts[0].code, AVAILABILITY_REASON.MAINTENANCE_BOOKING);
});

test("maintenance booking outside the request does not block", () => {
  saveBookingsForClub(
    [
      createBookingRecord({
        id: "bm",
        courtId: "c1",
        date: "2026-07-18",
        startTime: "14:00",
        endTime: "15:00",
        bookingStatus: "confirmed",
        bookingType: "maintenance",
      }),
    ],
    "club-a"
  );
  assert.equal(getCourtAvailability({ ...windowOk, courtId: "c1" }).courts[0].available, true);
});

test("outside operating hours is unavailable", () => {
  const result = getCourtAvailability({
    ...windowOk,
    courtId: "c1",
    startTime: "05:00",
    endTime: "06:00",
  });
  assert.equal(result.courts[0].available, false);
  assert.equal(result.courts[0].conflicts[0].code, AVAILABILITY_REASON.OUTSIDE_VENUE_HOURS);
});

test("invalid start/end rejected", () => {
  assert.throws(
    () => getCourtAvailability({ ...windowOk, startTime: "10", endTime: "11:00" }),
    (error) => error.code === AVAILABILITY_REASON.INVALID_TIME_RANGE
  );
});

test("startAt equal to endAt rejected", () => {
  assert.throws(
    () => getCourtAvailability({ ...windowOk, startTime: "10:00", endTime: "10:00" }),
    (error) => error.code === AVAILABILITY_REASON.INVALID_TIME_RANGE
  );
});

test("overnight/cross-day request rejected", () => {
  assert.throws(
    () => getCourtAvailability({ ...windowOk, startTime: "22:00", endTime: "06:00" }),
    (error) => error.code === AVAILABILITY_REASON.INVALID_TIME_RANGE
  );
});

test("unknown courtId does not leak another scope", () => {
  const result = getCourtAvailability({ ...windowOk, courtId: "missing" });
  assert.equal(result.courts[0].available, false);
  assert.equal(result.courts[0].conflicts[0].code, AVAILABILITY_REASON.COURT_NOT_FOUND);
  assert.equal(result.courts[0].court, null);
});

test("club/venue mismatch rejected", () => {
  assert.throws(
    () => getCourtAvailability({ ...windowOk, venueId: "venue-other" }),
    (error) => error.code === AVAILABILITY_REASON.VENUE_MISMATCH
  );
});

test("empty scoped inventory returns success with empty courts", () => {
  saveCourtsForClub([], "club-a");
  const result = getCourtAvailability(windowOk);
  assert.deepEqual(result.courts, []);
  assert.equal(result.clubId, "club-a");
});

test("data-loading failure is surfaced", () => {
  __setCourtAvailabilityDepsForTests({
    listCourts() {
      throw new Error("blob down");
    },
  });
  assert.throws(
    () => getCourtAvailability(windowOk),
    (error) => {
      assert.equal(error.code, AVAILABILITY_REASON.DATA_UNAVAILABLE);
      assert.equal(error.cause?.message, "blob down");
      return true;
    }
  );
});

test("returned objects cannot mutate source data", () => {
  const result = getCourtAvailability({ ...windowOk, courtId: "c1" });
  result.courts[0].court.name = "HACK";
  result.checkedRange.startTime = "00:00";
  const again = getCourtAvailability({ ...windowOk, courtId: "c1" });
  assert.equal(again.courts[0].court.name, "Sân 1");
  assert.equal(again.checkedRange.startTime, "10:00");
});

test("no write method is invoked", () => {
  const writes = [];
  __setCourtAvailabilityDepsForTests({
    listCourts: () => [
      normalizeCourt({ id: "c1", name: "Sân 1", active: true, status: "active" }),
    ],
    loadBookingsForClub: () => [],
    loadCourtManagementSettings: () => ({ openHour: 6, closeHour: 22 }),
    loadClubs: () => [{ id: "club-a", venueId: "venue-a" }],
    checkBookingConflict: () => null,
    saveBookingsForClub: () => writes.push("bookings"),
    saveCourtsForClub: () => writes.push("courts"),
    saveCourtManagementSettings: () => writes.push("settings"),
  });

  getCourtAvailability({ ...windowOk, courtId: "c1" });
  assert.deepEqual(writes, []);
});

test("cluster mismatch reported for wrong clusterId", () => {
  const result = getCourtAvailability({
    ...windowOk,
    courtId: "c1",
    clusterId: "cluster-other",
  });
  assert.equal(result.courts[0].conflicts[0].code, AVAILABILITY_REASON.CLUSTER_MISMATCH);
});

test("tournament booking conflict uses dedicated code", () => {
  saveBookingsForClub(
    [
      createBookingRecord({
        id: "bt",
        courtId: "c1",
        date: "2026-07-18",
        startTime: "10:00",
        endTime: "11:00",
        bookingStatus: "confirmed",
        bookingType: "tournament",
      }),
    ],
    "club-a"
  );
  const result = getCourtAvailability({ ...windowOk, courtId: "c1" });
  assert.equal(
    result.courts[0].conflicts[0].code,
    AVAILABILITY_REASON.TOURNAMENT_BOOKING_CONFLICT
  );
});

test("excludeBookingId allows edit-in-place", () => {
  saveBookingsForClub(
    [
      createBookingRecord({
        id: "b-self",
        courtId: "c1",
        date: "2026-07-18",
        startTime: "10:00",
        endTime: "11:00",
        bookingStatus: "confirmed",
      }),
    ],
    "club-a"
  );
  const result = getCourtAvailability({
    ...windowOk,
    courtId: "c1",
    context: { excludeBookingId: "b-self" },
  });
  assert.equal(result.courts[0].available, true);
});

test("missing clubId rejected", () => {
  assert.throws(
    () =>
      getCourtAvailability({
        date: "2026-07-18",
        startTime: "10:00",
        endTime: "11:00",
      }),
    (error) => error.code === AVAILABILITY_REASON.CLUB_SCOPE_MISSING
  );
});

test("static: no AI/CE/Competition/storage/legacy hours access", () => {
  const source = readFileSync(servicePath, "utf8");
  assert.doesNotMatch(source, /loadAIData|from ["'].*\/ai\//);
  assert.doesNotMatch(source, /court-engine|competition-core|tournament-engine/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|pickleball-venue-hours-v1/);
  assert.doesNotMatch(source, /saveBookingsForClub|saveCourtsForClub|saveCourtManagementSettings/);
});

test("omitted includeUnavailable defaults to true", () => {
  const result = getCourtAvailability(windowOk);
  assert.ok(result.courts.length > 1);
  assert.ok(result.courts.some((item) => item.available === true));
  assert.ok(result.courts.some((item) => item.available === false));
});

test("includeUnavailable=true returns available and unavailable courts", () => {
  const result = getCourtAvailability({ ...windowOk, includeUnavailable: true });
  assert.ok(result.courts.some((item) => item.available === true));
  assert.ok(result.courts.some((item) => item.available === false));
  assert.equal(
    result.courts.length,
    getCourtAvailability(windowOk).courts.length
  );
});

test("includeUnavailable=false returns only available courts", () => {
  const result = getCourtAvailability({ ...windowOk, includeUnavailable: false });
  assert.ok(result.courts.length >= 1);
  assert.ok(result.courts.every((item) => item.available === true));
  assert.ok(result.courts.some((item) => item.courtId === "c1"));
  assert.equal(
    result.courts.some((item) => item.courtId === "c-inactive"),
    false
  );
});

test("includeUnavailable=false with all courts unavailable returns courts: []", () => {
  const result = getCourtAvailability({
    ...windowOk,
    courtIds: ["c-inactive", "c-locked", "c-maint"],
    includeUnavailable: false,
  });
  assert.deepEqual(result.courts, []);
  assert.equal(result.clubId, "club-a");
});

test("includeUnavailable filtering does not mutate source court records", () => {
  const before = loadCourtsForClub("club-a");
  const beforeInactive = before.find((court) => court.id === "c-inactive");
  assert.ok(beforeInactive);

  const result = getCourtAvailability({ ...windowOk, includeUnavailable: false });
  if (result.courts[0]?.court) {
    result.courts[0].court.name = "HACK-FILTER";
  }

  const after = loadCourtsForClub("club-a");
  assert.equal(after.length, before.length);
  assert.equal(
    after.find((court) => court.id === "c-inactive")?.name,
    beforeInactive.name
  );
  assert.equal(after.find((court) => court.id === "c1")?.name, "Sân 1");
});

test("includeUnavailable=false does not bypass invalid-time validation", () => {
  assert.throws(
    () =>
      getCourtAvailability({
        ...windowOk,
        includeUnavailable: false,
        startTime: "10:00",
        endTime: "10:00",
      }),
    (error) => error.code === AVAILABILITY_REASON.INVALID_TIME_RANGE
  );
});

test("includeUnavailable=false does not bypass venue mismatch validation", () => {
  assert.throws(
    () =>
      getCourtAvailability({
        ...windowOk,
        includeUnavailable: false,
        venueId: "venue-other",
      }),
    (error) => error.code === AVAILABILITY_REASON.VENUE_MISMATCH
  );
});

test("includeUnavailable=false does not convert data-load failure into empty result", () => {
  __setCourtAvailabilityDepsForTests({
    listCourts() {
      throw new Error("blob down");
    },
  });
  assert.throws(
    () => getCourtAvailability({ ...windowOk, includeUnavailable: false }),
    (error) => {
      assert.equal(error.code, AVAILABILITY_REASON.DATA_UNAVAILABLE);
      assert.equal(error.cause?.message, "blob down");
      return true;
    }
  );
});

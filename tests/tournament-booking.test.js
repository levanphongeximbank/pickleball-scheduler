import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createBooking } from "../src/domain/bookingService.js";
import {
  cancelTournamentCourtBookings,
  buildTournamentCourtBookings,
} from "../src/domain/tournamentBookingService.js";
import { setTournamentCourtSchedule } from "../src/domain/tournamentService.js";
import {
  loadBookingsForClub,
  saveClubData,
  getDefaultClubData,
} from "../src/domain/clubStorage.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { normalizeCourt } from "../src/models/court.js";
import { createTournamentRecord } from "../src/models/tournament/index.js";

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

let originalDateNow;

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  originalDateNow = Date.now;
  Date.now = () => 1700000000000;
  setActiveClubId(DEFAULT_CLUB.id);

  const data = getDefaultClubData(DEFAULT_CLUB.id);
  data.courts = [
    normalizeCourt({ id: 1, name: "Sân 1", number: 1, active: true }),
    normalizeCourt({ id: 2, name: "Sân 2", number: 2, active: true }),
  ];
  data.tournaments = [
    createTournamentRecord(DEFAULT_CLUB.id, {
      id: "tournament-test-1",
      name: "Giải Open Tháng 8",
    }),
  ];
  saveClubData(DEFAULT_CLUB.id, data);
});

afterEach(() => {
  Date.now = originalDateNow;
});

test("buildTournamentCourtBookings creates tournament type bookings", () => {
  const tournament = createTournamentRecord(DEFAULT_CLUB.id, {
    id: "t1",
    name: "Giải test",
    courtSchedule: {
      date: "2026-08-10",
      startTime: "07:00",
      endTime: "12:00",
      courtIds: [1, 2],
    },
  });

  const bookings = buildTournamentCourtBookings(tournament, [
    normalizeCourt({ id: 1, name: "Sân 1" }),
    normalizeCourt({ id: 2, name: "Sân 2" }),
  ]);

  assert.equal(bookings.length, 2);
  assert.equal(bookings[0].bookingType, "tournament");
  assert.equal(bookings[0].tournamentId, "t1");
});

test("setTournamentCourtSchedule locks courts on booking calendar", () => {
  const result = setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1, 2],
  });

  assert.equal(result.ok, true);
  assert.equal(result.created.length, 2);

  const bookings = loadBookingsForClub(DEFAULT_CLUB.id);
  assert.equal(bookings.filter((item) => item.bookingType === "tournament").length, 2);
});

test("setTournamentCourtSchedule blocks duplicate customer booking", () => {
  createBooking(
    {
      courtId: 1,
      date: "2026-08-10",
      startTime: "08:00",
      endTime: "10:00",
      customerName: "Khách A",
      totalAmount: 200000,
    },
    DEFAULT_CLUB.id
  );

  const result = setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1, 2],
  });

  assert.equal(result.ok, true);
  assert.equal(result.created.length, 1);
  assert.equal(result.failed.length, 1);
});

test("cancelTournamentCourtBookings cancels tournament bookings", () => {
  setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1],
  });

  cancelTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1");

  const bookings = loadBookingsForClub(DEFAULT_CLUB.id);
  assert.equal(bookings[0].bookingStatus, "cancelled");
});

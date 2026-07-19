import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBooking } from "../src/domain/bookingService.js";
import {
  cancelTournamentCourtBookings,
  buildTournamentBookingId,
  buildTournamentCourtBookings,
  getActiveTournamentCourtBookings,
  TOURNAMENT_BOOKING_BRIDGE_CODE,
} from "../src/domain/tournamentBookingService.js";
import {
  clearTournamentCourtSchedule,
  setTournamentCourtSchedule,
} from "../src/domain/tournamentService.js";
import {
  loadBookingsForClub,
  loadClubData,
  saveClubData,
  getDefaultClubData,
} from "../src/domain/clubStorage.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { normalizeCourt } from "../src/models/court.js";
import { createTournamentRecord } from "../src/models/tournament/index.js";
import { getCourtAvailability } from "../src/features/venue-court/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function seedClub() {
  const data = getDefaultClubData(DEFAULT_CLUB.id);
  data.courts = [
    normalizeCourt({ id: 1, name: "Sân 1", number: 1, active: true }),
    normalizeCourt({ id: 2, name: "Sân 2", number: 2, active: true }),
    normalizeCourt({ id: 3, name: "Sân 3", number: 3, active: true }),
  ];
  data.courtManagement = {
    ...(data.courtManagement || {}),
    openHour: 6,
    closeHour: 22,
  };
  data.tournaments = [
    createTournamentRecord(DEFAULT_CLUB.id, {
      id: "tournament-test-1",
      name: "Giải Open Tháng 8",
    }),
    createTournamentRecord(DEFAULT_CLUB.id, {
      id: "tournament-test-2",
      name: "Giải khác",
    }),
  ];
  saveClubData(DEFAULT_CLUB.id, data);
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  originalDateNow = Date.now;
  Date.now = () => 1700000000000;
  setActiveClubId(DEFAULT_CLUB.id);
  seedClub();
});

afterEach(() => {
  Date.now = originalDateNow;
});

test("buildTournamentCourtBookings uses deterministic tournament booking ids", () => {
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
  assert.equal(bookings[0].id, buildTournamentBookingId("t1", 1, "2026-08-10"));
});

test("1. first sync creates expected tournament bookings", () => {
  const result = setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1, 2],
  });

  assert.equal(result.ok, true);
  assert.equal(result.created.length, 2);
  assert.equal(getActiveTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1").length, 2);
});

test("2. repeating identical sync creates no duplicates", () => {
  const input = {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1, 2],
  };
  assert.equal(setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", input).ok, true);
  const second = setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", input);

  assert.equal(second.ok, true);
  assert.equal(second.created.length, 0);
  assert.equal(second.updated.length, 2);
  const active = getActiveTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1");
  assert.equal(active.length, 2);
  assert.equal(new Set(active.map((item) => item.id)).size, 2);
});

test("3. adding a court creates only the missing booking", () => {
  setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1],
  });
  const result = setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1, 2],
  });

  assert.equal(result.ok, true);
  assert.equal(result.created.length, 1);
  assert.equal(String(result.created[0].courtId), "2");
  assert.equal(result.updated.length, 1);
  assert.equal(getActiveTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1").length, 2);
});

test("4. removing a court removes only the obsolete tournament booking", () => {
  setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1, 2],
  });
  const result = setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1],
  });

  assert.equal(result.ok, true);
  assert.equal(result.cancelled.length, 1);
  assert.equal(String(result.cancelled[0].courtId), "2");
  const active = getActiveTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1");
  assert.equal(active.length, 1);
  assert.equal(String(active[0].courtId), "1");
});

test("5. changing time reconciles owned booking set in place", () => {
  setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1],
  });
  const result = setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "08:00",
    endTime: "14:00",
    courtIds: [1],
  });

  assert.equal(result.ok, true);
  assert.equal(result.updated.length, 1);
  assert.equal(result.created.length, 0);
  const active = getActiveTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1");
  assert.equal(active.length, 1);
  assert.equal(active[0].startTime, "08:00");
  assert.equal(active[0].endTime, "14:00");
});

test("6. clearing schedule removes only tournament-owned bookings", () => {
  setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1, 2],
  });
  const result = clearTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1");
  assert.equal(result.ok, true);
  assert.equal(result.tournament.courtSchedule, null);
  assert.equal(getActiveTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1").length, 0);
});

test("7. unrelated user booking is preserved on clear", () => {
  createBooking(
    {
      courtId: 1,
      date: "2026-08-11",
      startTime: "09:00",
      endTime: "10:00",
      customerName: "Khách B",
      totalAmount: 100000,
    },
    DEFAULT_CLUB.id
  );
  setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [2],
  });
  clearTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1");

  const userBooking = loadBookingsForClub(DEFAULT_CLUB.id).find(
    (item) => item.customerName === "Khách B"
  );
  assert.ok(userBooking);
  assert.notEqual(userBooking.bookingStatus, "cancelled");
});

test("8. maintenance booking is preserved", () => {
  createBooking(
    {
      courtId: 3,
      date: "2026-08-10",
      startTime: "10:00",
      endTime: "11:00",
      customerName: "Bảo trì",
      bookingType: "maintenance",
      totalAmount: 0,
    },
    DEFAULT_CLUB.id
  );
  setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1],
  });
  cancelTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1");

  const maintenance = loadBookingsForClub(DEFAULT_CLUB.id).find(
    (item) => item.bookingType === "maintenance"
  );
  assert.ok(maintenance);
  assert.notEqual(maintenance.bookingStatus, "cancelled");
});

test("9. another tournament booking is preserved", () => {
  assert.equal(
    setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-2", {
      date: "2026-08-10",
      startTime: "07:00",
      endTime: "12:00",
      courtIds: [2],
    }).ok,
    true
  );
  assert.equal(
    setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
      date: "2026-08-10",
      startTime: "07:00",
      endTime: "12:00",
      courtIds: [1],
    }).ok,
    true
  );
  clearTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1");
  assert.equal(getActiveTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-2").length, 1);
});

test("10. conflict causes fail-closed behavior", () => {
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

  assert.equal(result.ok, false);
  assert.equal(result.code, TOURNAMENT_BOOKING_BRIDGE_CODE.BOOKING_CONFLICT);
  assert.equal(getActiveTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1").length, 0);

  const tournament = loadClubData(DEFAULT_CLUB.id).tournaments.find(
    (item) => item.id === "tournament-test-1"
  );
  assert.equal(tournament.courtSchedule, null);
});

test("11. static: bridge does not write club bookings directly; Competition does not either", () => {
  const bridge = readFileSync(
    path.join(root, "src/domain/tournamentBookingService.js"),
    "utf8"
  );
  assert.doesNotMatch(bridge, /saveBookingsForClub/);
  assert.match(bridge, /from ["'].*bookingService/);

  const teAssign = readFileSync(
    path.join(root, "src/features/tournament-engine/engines/courtAssignmentEngine.js"),
    "utf8"
  );
  const teSchedule = readFileSync(
    path.join(root, "src/features/tournament-engine/engines/scheduleEngine.js"),
    "utf8"
  );
  assert.doesNotMatch(teAssign, /saveBookingsForClub|createBooking\(/);
  assert.doesNotMatch(teSchedule, /saveBookingsForClub|createBooking\(/);
});

test("12. successful sync blocks canonical availability", () => {
  assert.equal(
    setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
      date: "2026-08-10",
      startTime: "07:00",
      endTime: "12:00",
      courtIds: [1],
    }).ok,
    true
  );

  const availability = getCourtAvailability({
    clubId: DEFAULT_CLUB.id,
    date: "2026-08-10",
    startTime: "08:00",
    endTime: "09:00",
    courtId: 1,
  });
  assert.equal(availability.courts[0].available, false);
  assert.ok(
    availability.courts[0].conflicts?.some(
      (conflict) =>
        conflict.code === "TOURNAMENT_BOOKING_CONFLICT" ||
        conflict.code === "BOOKING_CONFLICT"
    ) ||
      availability.courts[0].reasons?.some((reason) =>
        String(reason).toLowerCase().includes("tournament")
      )
  );
});

test("13. cancellation restores availability", () => {
  setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1],
  });
  clearTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1");

  const availability = getCourtAvailability({
    clubId: DEFAULT_CLUB.id,
    date: "2026-08-10",
    startTime: "08:00",
    endTime: "09:00",
    courtId: 1,
  });
  assert.equal(availability.courts[0].available, true);
});

test("14. cancelTournamentCourtBookings only targets owned bridge rows", () => {
  setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-1", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [1],
  });
  setTournamentCourtSchedule(DEFAULT_CLUB.id, "tournament-test-2", {
    date: "2026-08-10",
    startTime: "07:00",
    endTime: "12:00",
    courtIds: [2],
  });

  const result = cancelTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1");
  assert.equal(result.ok, true);
  assert.equal(result.cancelled.length, 1);
  assert.equal(getActiveTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-1").length, 0);
  assert.equal(getActiveTournamentCourtBookings(DEFAULT_CLUB.id, "tournament-test-2").length, 1);
});

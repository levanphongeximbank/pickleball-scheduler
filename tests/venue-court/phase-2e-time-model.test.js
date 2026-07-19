/**
 * Phase 2E remediation — IANA timezone-required civil time model.
 */
import assert from "node:assert/strict";
import { beforeEach, afterEach, describe, test } from "node:test";

import {
  CIVIL_TIME_ERROR,
  absoluteToCivilDate,
  absoluteToCivilMinutes,
  absoluteToCivilParts,
  addDaysToCivilDate,
  assertCivilWindow,
  buildVenueCivilWindow,
  civilDateTimeToUtcMs,
  civilTimeToMinutes,
  isValidCivilDate,
  isValidCivilTime,
  isoToCivilHhmmOnDate,
  listCivilDatesForWeekday,
  minutesToCivilTime,
  normalizeCivilWindow,
  parseCivilDateStrict,
  parseCivilTimeStrict,
  resolveVenueTimezoneForClub,
} from "../../src/domain/civilTime.js";
import {
  autoCompletePastBookings,
  autoStartDueBookings,
  createBooking,
} from "../../src/domain/bookingService.js";
import { getUpcomingReminders } from "../../src/domain/bookingReminderService.js";
import {
  expandRecurringSeriesToBookings,
  createRecurringBookingSeries,
  listDatesForWeekday,
} from "../../src/domain/recurringBookingService.js";
import { getCurrentBookingForCourt } from "../../src/domain/courtBookingEngine.js";
import { saveCourtManagementSettings } from "../../src/domain/courtManagementSettings.js";
import {
  loadBookingsForClub,
  saveClubData,
  getDefaultClubData,
} from "../../src/domain/clubStorage.js";
import { isoToCivilHhmm } from "../../src/features/tournament-engine/services/competitionAvailabilityGuard.js";
import { buildLocalCivilWindow as ceBuildLocalCivilWindow } from "../../src/features/court-engine/services/courtEngineAvailabilityGuard.js";
import { getCourtAvailability } from "../../src/features/venue-court/index.js";
import { todayIsoDate } from "../../src/pages/courtManagement/courtManagement.constants.js";
import { setActiveClubId, DEFAULT_CLUB, loadClubs, saveClubs } from "../../src/data/club.js";
import { saveVenues } from "../../src/data/venue.js";
import { normalizeCourt } from "../../src/models/court.js";
import { createVenueRecord } from "../../src/models/venue.js";
import { buildTournamentCourtBookings } from "../../src/domain/tournamentBookingService.js";

const CLUB_ID = DEFAULT_CLUB.id;
const VENUE_ID = "venue-phase-2e";
const VENUE_TZ = "Asia/Ho_Chi_Minh";
const TZ_OPTS = { timezone: VENUE_TZ };

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
  setActiveClubId(CLUB_ID);

  const venue = createVenueRecord("Venue 2E", {
    id: VENUE_ID,
    timezone: VENUE_TZ,
  });
  saveVenues([venue]);

  const clubs = loadClubs().map((club) =>
    club.id === CLUB_ID ? { ...club, venueId: VENUE_ID, tenantId: VENUE_ID } : club
  );
  if (!clubs.some((c) => c.id === CLUB_ID)) {
    clubs.unshift({ ...DEFAULT_CLUB, venueId: VENUE_ID, tenantId: VENUE_ID });
  }
  saveClubs(clubs);

  const data = getDefaultClubData(CLUB_ID);
  data.courts = [
    normalizeCourt({ id: 1, name: "Sân 1", number: 1, active: true }),
    normalizeCourt({ id: 2, name: "Sân 2", number: 2, active: true }),
  ];
  saveClubData(CLUB_ID, data);
});

afterEach(() => {
  Date.now = originalDateNow;
});

describe("Phase 2E civil-input helpers", () => {
  test("strict YYYY-MM-DD valid/invalid", () => {
    assert.equal(isValidCivilDate("2026-07-19"), true);
    assert.equal(isValidCivilDate("2026-02-31"), false);
    assert.throws(() => parseCivilDateStrict("nope"), (err) => err.code === CIVIL_TIME_ERROR.INVALID_DATE);
  });

  test("strict HH:mm valid/invalid", () => {
    assert.equal(isValidCivilTime("23:59"), true);
    assert.equal(isValidCivilTime("24:00"), false);
    assert.throws(() => parseCivilTimeStrict("25:00"), (err) => err.code === CIVIL_TIME_ERROR.INVALID_TIME);
  });

  test("civil time to minutes and back", () => {
    assert.equal(civilTimeToMinutes("18:30"), 18 * 60 + 30);
    assert.equal(minutesToCivilTime(18 * 60 + 30), "18:30");
  });

  test("overnight windows rejected", () => {
    assert.equal(
      normalizeCivilWindow({ date: "2026-06-28", startTime: "22:00", endTime: "02:00" }),
      null
    );
    assert.throws(
      () => assertCivilWindow({ date: "2026-06-28", startTime: "22:00", endTime: "02:00" }),
      (err) => err.code === CIVIL_TIME_ERROR.INVALID_TIME_WINDOW
    );
  });

  test("weekday listing is host-TZ independent", () => {
    assert.deepEqual(
      listCivilDatesForWeekday("2026-06-01", "2026-06-15", 1),
      listDatesForWeekday("2026-06-01", "2026-06-15", 1)
    );
    assert.equal(addDaysToCivilDate("2026-06-28", 7), "2026-07-05");
  });
});

describe("Phase 2E absolute→civil IANA determinism", () => {
  // 2026-06-28 00:30 Asia/Ho_Chi_Minh = 2026-06-27T17:30:00.000Z
  const hcmNearMidnight = new Date("2026-06-27T17:30:00.000Z");

  test("same instant + venue TZ yields same civil across host environments", () => {
    const instant = new Date("2026-06-28T17:00:00.000Z");
    const expected = {
      UTC: { date: "2026-06-28", time: "17:00", minutes: 17 * 60 },
      "Asia/Ho_Chi_Minh": { date: "2026-06-29", time: "00:00", minutes: 0 },
      "America/Los_Angeles": { date: "2026-06-28", time: "10:00", minutes: 10 * 60 },
    };

    for (const [tz, want] of Object.entries(expected)) {
      const parts = absoluteToCivilParts(instant, tz);
      assert.equal(parts.date, want.date, tz);
      assert.equal(parts.time, want.time, tz);
      assert.equal(parts.minutes, want.minutes, tz);
      assert.equal(absoluteToCivilDate(instant, tz), want.date);
      assert.equal(absoluteToCivilMinutes(instant, tz), want.minutes);
    }
  });

  test("Asia/Ho_Chi_Minh near-midnight conversion produces correct civil date", () => {
    assert.equal(absoluteToCivilDate(hcmNearMidnight, VENUE_TZ), "2026-06-28");
    assert.equal(absoluteToCivilMinutes(hcmNearMidnight, VENUE_TZ), 30);
    assert.notEqual(hcmNearMidnight.toISOString().slice(0, 10), "2026-06-28");
  });

  test("missing timezone causes TIMEZONE_REQUIRED", () => {
    assert.throws(
      () => absoluteToCivilDate(hcmNearMidnight, ""),
      (err) => err.code === CIVIL_TIME_ERROR.TIMEZONE_REQUIRED
    );
    assert.throws(
      () => isoToCivilHhmmOnDate(hcmNearMidnight.toISOString(), "2026-06-28", {}),
      (err) => err.code === CIVIL_TIME_ERROR.TIMEZONE_REQUIRED
    );
    assert.throws(
      () => isoToCivilHhmm(hcmNearMidnight.toISOString(), "2026-06-28", {}),
      (err) => err.code === CIVIL_TIME_ERROR.TIMEZONE_REQUIRED
    );
  });

  test("civilDateTimeToUtcMs round-trips in multiple zones", () => {
    for (const tz of ["UTC", "Asia/Ho_Chi_Minh", "America/Los_Angeles"]) {
      const ms = civilDateTimeToUtcMs("2026-06-28", 9 * 60, tz);
      const parts = absoluteToCivilParts(ms, tz);
      assert.equal(parts.date, "2026-06-28");
      assert.equal(parts.minutes, 9 * 60);
    }
  });

  test("resolveVenueTimezoneForClub prefers venue.timezone; fails without venue", () => {
    const ok = resolveVenueTimezoneForClub(CLUB_ID);
    assert.equal(ok.ok, true);
    assert.equal(ok.timezone, VENUE_TZ);
    assert.equal(ok.source, "venue.timezone");

    const missing = resolveVenueTimezoneForClub("no-such-club");
    assert.equal(missing.ok, false);
    assert.equal(missing.code, CIVIL_TIME_ERROR.TIMEZONE_REQUIRED);

    const explicit = resolveVenueTimezoneForClub(CLUB_ID, {
      timezone: "America/Los_Angeles",
    });
    assert.equal(explicit.ok, true);
    assert.equal(explicit.timezone, "America/Los_Angeles");
    assert.equal(explicit.source, "explicit");
  });
});

describe("Phase 2E booking automation (host-TZ independent)", () => {
  test("booking near venue midnight uses venue civil date", () => {
    createBooking(
      {
        courtId: 1,
        date: "2026-06-28",
        startTime: "00:15",
        endTime: "01:15",
        customerName: "Midnight",
        totalAmount: 100000,
        bookingStatus: "confirmed",
      },
      CLUB_ID
    );
    const now = new Date("2026-06-27T17:30:00.000Z"); // 00:30 HCM
    const current = getCurrentBookingForCourt(
      { id: 1 },
      loadBookingsForClub(CLUB_ID),
      null,
      now,
      TZ_OPTS
    );
    assert.equal(current?.customerName, "Midnight");
  });

  test("auto-start uses venue timezone not host TZ", () => {
    createBooking(
      {
        courtId: 1,
        date: "2026-06-28",
        startTime: "00:10",
        endTime: "01:00",
        customerName: "AutoStart",
        totalAmount: 100000,
        bookingStatus: "confirmed",
      },
      CLUB_ID
    );
    const now = new Date("2026-06-27T17:20:00.000Z"); // 00:20 HCM
    const result = autoStartDueBookings(CLUB_ID, now);
    assert.equal(result.ok, true);
    assert.equal(result.updatedCount, 1);
    assert.equal(loadBookingsForClub(CLUB_ID)[0].bookingStatus, "playing");
  });

  test("auto-complete uses venue timezone not host TZ", () => {
    createBooking(
      {
        courtId: 1,
        date: "2026-06-28",
        startTime: "00:00",
        endTime: "00:30",
        customerName: "AutoComplete",
        totalAmount: 100000,
        bookingStatus: "playing",
      },
      CLUB_ID
    );
    const now = new Date("2026-06-27T17:45:00.000Z"); // 00:45 HCM
    const result = autoCompletePastBookings(CLUB_ID, now);
    assert.equal(result.ok, true);
    assert.equal(result.updatedCount, 1);
  });

  test("auto-start fails closed without venue timezone", () => {
    saveClubs([{ ...DEFAULT_CLUB, venueId: null, tenantId: null }]);
    const result = autoStartDueBookings(CLUB_ID, new Date(), {});
    assert.equal(result.ok, false);
    assert.equal(result.code, CIVIL_TIME_ERROR.TIMEZONE_REQUIRED);
  });

  test("reminder scheduling uses venue civil date", () => {
    saveCourtManagementSettings(CLUB_ID, {
      notificationSettings: { enabled: true, minutesBefore: 60 },
    });
    createBooking(
      {
        courtId: 1,
        date: "2026-06-28",
        startTime: "00:45",
        endTime: "01:45",
        customerName: "Reminder",
        totalAmount: 100000,
      },
      CLUB_ID
    );
    const now = new Date("2026-06-27T17:15:00.000Z"); // 00:15 HCM
    const reminders = getUpcomingReminders(CLUB_ID, now);
    assert.equal(reminders.length, 1);
  });

  test("recurring generation preserves civil date/time", () => {
    const series = createRecurringBookingSeries({
      id: "rec-2e",
      courtId: 1,
      startTime: "18:00",
      endTime: "20:00",
      weekday: 1,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      customerName: "Recurring",
    });
    const bookings = expandRecurringSeriesToBookings(series);
    assert.ok(bookings.length > 0);
    for (const booking of bookings) {
      assert.equal(booking.startTime, "18:00");
      const [y, m, d] = booking.date.split("-").map(Number);
      assert.equal(new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(), 1);
    }
  });
});

describe("Phase 2E integration boundaries", () => {
  test("Court Engine guard requires timezone for derived window", () => {
    const now = new Date("2026-06-28T03:15:00.000Z"); // 10:15 HCM
    assert.equal(ceBuildLocalCivilWindow(20, now).ok, false);
    assert.equal(ceBuildLocalCivilWindow(20, now).code, "TIMEZONE_REQUIRED");

    const built = ceBuildLocalCivilWindow(20, now, VENUE_TZ);
    assert.equal(built.ok, true);
    assert.equal(built.date, "2026-06-28");
    assert.equal(built.startTime, "10:15");
    assert.equal(built.endTime, "10:35");
  });

  test("buildVenueCivilWindow overnight near end of day rejected", () => {
    const now = new Date("2026-06-28T16:30:00.000Z"); // 23:30 HCM
    const built = buildVenueCivilWindow(120, now, VENUE_TZ);
    assert.equal(built.ok, false);
    assert.equal(built.code, CIVIL_TIME_ERROR.INVALID_TIME_WINDOW);
  });

  test("Phase 2C tournament booking sync retains civil shape", () => {
    const rows = buildTournamentCourtBookings(
      {
        id: "t-1",
        name: "Open",
        courtSchedule: {
          date: "2026-06-28",
          startTime: "08:00",
          endTime: "18:00",
          courtIds: [1],
        },
      },
      [{ id: 1, name: "Sân 1", number: 1 }]
    );
    assert.equal(rows[0].date, "2026-06-28");
    assert.equal(rows[0].startTime, "08:00");
  });

  test("getCourtAvailability still accepts civil contract", () => {
    assert.throws(
      () =>
        getCourtAvailability({
          clubId: CLUB_ID,
          date: "bad",
          startTime: "09:00",
          endTime: "10:00",
        }),
      (err) => err.code === "INVALID_TIME_RANGE"
    );
  });

  test("todayIsoDate with timezone is venue-safe; bare call is display-only", () => {
    const instant = new Date("2026-06-27T17:30:00.000Z");
    assert.equal(todayIsoDate({ timezone: VENUE_TZ, now: instant }), "2026-06-28");
    assert.match(todayIsoDate({ allowBrowserLocal: true, now: instant }), /^\d{4}-\d{2}-\d{2}$/);
  });

  test("ISO→civil with timezone is explicit", () => {
    const iso = civilDateTimeToUtcMs("2026-06-28", 12 * 60, VENUE_TZ);
    assert.equal(
      isoToCivilHhmm(new Date(iso).toISOString(), "2026-06-28", { timezone: VENUE_TZ }),
      "12:00"
    );
  });
});

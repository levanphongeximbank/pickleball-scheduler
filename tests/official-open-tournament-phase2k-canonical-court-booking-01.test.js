/**
 * Phase 2K — Official canonical court booking / occupancy closure.
 * Split-brain: canonical club_data_v3 courts visible, legacy localStorage courts empty.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";

import { createBooking, saveBooking } from "../src/domain/bookingService.js";
import {
  buildTournamentBookingId,
  syncTournamentCourtBookings,
  TOURNAMENT_BOOKING_BRIDGE_CODE,
} from "../src/domain/tournamentBookingService.js";
import {
  authorizeProvidedTournamentCourts,
  PROVIDED_COURT_AUTH_CODE,
} from "../src/features/tournament/services/tournamentCommands.js";
import {
  extractBookingsFromClubDataV3Payload,
  extractClubBlobFromClubDataV3Payload,
  readCanonicalClubCourtBookingSnapshot,
  __setCanonicalClubCourtInventoryDepsForTests,
  __resetCanonicalClubCourtInventoryDepsForTests,
} from "../src/features/team-tournament/services/canonicalClubCourtInventory.js";
import {
  getDefaultClubData,
  loadBookingsForClub,
  loadCourtsForClub,
  saveClubData,
} from "../src/domain/clubStorage.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { createTournamentRecord } from "../src/models/tournament/index.js";

function src(path) {
  return readFileSync(path, "utf8");
}

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

const CLUB_ID = DEFAULT_CLUB.id;
const TENANT_ID = "tenant-a";
const TOURNAMENT_ID = "993484d2-bb8d-412e-b7f2-a1ff59979c8a";

const CANONICAL_COURTS = [
  {
    id: "tt412-court-01",
    name: "TT412 Sân 1",
    number: 1,
    active: true,
    status: "active",
    clubId: CLUB_ID,
    tenantId: TENANT_ID,
  },
  {
    id: "tt412-court-02",
    name: "TT412 Sân 2",
    number: 2,
    active: true,
    status: "active",
    clubId: CLUB_ID,
    tenantId: TENANT_ID,
  },
];

function seedEmptyLocalCourts() {
  const data = getDefaultClubData(CLUB_ID);
  data.courts = [];
  data.bookings = [];
  saveClubData(CLUB_ID, data);
}

function officialTournament(courtIds = ["tt412-court-01", "tt412-court-02"]) {
  return createTournamentRecord(CLUB_ID, {
    id: TOURNAMENT_ID,
    name: "Official Open TT412",
    tenantId: TENANT_ID,
    courtSchedule: {
      date: "2026-08-14",
      startTime: "13:00",
      endTime: "17:00",
      courtIds,
    },
  });
}

function canonicalSyncOptions(overrides = {}) {
  return {
    canonicalOccupancy: true,
    occupancyBookings: [],
    persistSnapshot: {
      schemaVersion: 3.5,
      clubId: CLUB_ID,
      courts: CANONICAL_COURTS,
      bookings: [],
    },
    authorizedCourts: CANONICAL_COURTS,
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(CLUB_ID);
  seedEmptyLocalCourts();
});

afterEach(() => {
  __resetCanonicalClubCourtInventoryDepsForTests();
});

describe("official-open-tournament-phase2k-canonical-court-booking-01", () => {
  it("A. split-brain: canonical courts present, localStorage courts empty, booking does not return Không tìm thấy sân", async () => {
    assert.equal(loadCourtsForClub(CLUB_ID).length, 0);

    const legacy = saveBooking(
      {
        id: "tournament-booking-legacy-miss",
        bookingType: "tournament",
        tournamentId: TOURNAMENT_ID,
        courtId: "tt412-court-01",
        courtName: "TT412 Sân 1",
        date: "2026-08-14",
        startTime: "13:00",
        endTime: "17:00",
        totalAmount: 0,
        depositAmount: 0,
        paidAmount: 0,
        bookingStatus: "confirmed",
      },
      CLUB_ID
    );
    assert.equal(legacy.ok, false);
    assert.equal(legacy.message, "Không tìm thấy sân.");

    const canonical = await createBooking(
      {
        id: buildTournamentBookingId(TOURNAMENT_ID, "tt412-court-01", "2026-08-14"),
        bookingType: "tournament",
        tournamentId: TOURNAMENT_ID,
        courtId: "tt412-court-01",
        courtName: "TT412 Sân 1",
        date: "2026-08-14",
        startTime: "13:00",
        endTime: "17:00",
        totalAmount: 0,
        depositAmount: 0,
        paidAmount: 0,
        bookingStatus: "confirmed",
      },
      CLUB_ID,
      { authorizedCourts: CANONICAL_COURTS }
    );
    assert.equal(canonical.ok, true, canonical.message);
    assert.notEqual(canonical.message, "Không tìm thấy sân.");
    assert.equal(canonical.booking.courtId, "tt412-court-01");
  });

  it("B. free canonical courts → Official reservation succeeds without legacy court lookup", async () => {
    assert.equal(loadCourtsForClub(CLUB_ID).length, 0);
    const result = await syncTournamentCourtBookings(
      officialTournament(),
      CLUB_ID,
      CANONICAL_COURTS,
      canonicalSyncOptions()
    );
    assert.equal(result.ok, true, result.message);
    assert.notEqual(result.message, "Không tìm thấy sân.");
    assert.equal(result.created.length, 2);
    const stored = loadBookingsForClub(CLUB_ID).filter(
      (booking) => booking.bookingType === "tournament"
    );
    assert.equal(stored.length, 2);
    assert.equal(
      stored.some((booking) => booking.courtId === "tt412-court-01"),
      true
    );
    assert.equal(
      stored.some((booking) => booking.courtId === "tt412-court-02"),
      true
    );
  });

  it("C. overlapping canonical occupancy is blocked", async () => {
    const foreign = {
      id: "normal-booking-1",
      bookingType: "single",
      courtId: "tt412-court-01",
      courtName: "TT412 Sân 1",
      date: "2026-08-14",
      startTime: "14:00",
      endTime: "16:00",
      bookingStatus: "confirmed",
    };
    const result = await syncTournamentCourtBookings(
      officialTournament(),
      CLUB_ID,
      CANONICAL_COURTS,
      canonicalSyncOptions({ occupancyBookings: [foreign] })
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, TOURNAMENT_BOOKING_BRIDGE_CODE.BOOKING_CONFLICT);
    assert.match(result.message, /trùng/);
    assert.equal(loadBookingsForClub(CLUB_ID).length, 0);
  });

  it("D. wrong-tenant provided court is blocked", () => {
    const result = authorizeProvidedTournamentCourts(
      [
        {
          ...CANONICAL_COURTS[0],
          tenantId: "other-tenant",
        },
      ],
      { clubId: CLUB_ID, tenantId: TENANT_ID },
      ["tt412-court-01"]
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, PROVIDED_COURT_AUTH_CODE.COURT_TENANT_FORBIDDEN);
  });

  it("E. court removed between read and write fails closed with zero mutation", async () => {
    const result = await syncTournamentCourtBookings(
      officialTournament(["tt412-court-01", "tt412-court-02"]),
      CLUB_ID,
      [CANONICAL_COURTS[1]],
      canonicalSyncOptions({ authorizedCourts: [CANONICAL_COURTS[1]] })
    );
    assert.equal(result.ok, false);
    assert.equal(
      result.code,
      TOURNAMENT_BOOKING_BRIDGE_CODE.COURT_NOT_IN_AUTHORIZED_SET
    );
    assert.equal(result.message, "Sân không còn thuộc đơn vị hiện tại.");
    assert.equal(loadBookingsForClub(CLUB_ID).length, 0);
  });

  it("F. repeat same Official reservation is idempotent", async () => {
    const first = await syncTournamentCourtBookings(
      officialTournament(),
      CLUB_ID,
      CANONICAL_COURTS,
      canonicalSyncOptions()
    );
    assert.equal(first.ok, true, first.message);
    const occupancy = loadBookingsForClub(CLUB_ID);
    const second = await syncTournamentCourtBookings(
      officialTournament(),
      CLUB_ID,
      CANONICAL_COURTS,
      canonicalSyncOptions({ occupancyBookings: occupancy })
    );
    assert.equal(second.ok, true, second.message);
    assert.equal(second.created.length, 0);
    assert.equal(second.updated.length, 2);
    const stored = loadBookingsForClub(CLUB_ID).filter(
      (booking) =>
        booking.bookingType === "tournament" &&
        booking.bookingStatus !== "cancelled"
    );
    assert.equal(stored.length, 2);
    assert.equal(new Set(stored.map((item) => item.id)).size, 2);
  });

  it("G. no selected courts → zero mutation", async () => {
    const result = await syncTournamentCourtBookings(
      officialTournament([]),
      CLUB_ID,
      CANONICAL_COURTS,
      canonicalSyncOptions()
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, TOURNAMENT_BOOKING_BRIDGE_CODE.SCHEDULE_MISSING);
    assert.equal(loadBookingsForClub(CLUB_ID).length, 0);
  });

  it("H. missing canonical occupancy snapshot fails closed", async () => {
    const result = await syncTournamentCourtBookings(
      officialTournament(),
      CLUB_ID,
      CANONICAL_COURTS,
      { canonicalOccupancy: true }
    );
    assert.equal(result.ok, false);
    assert.equal(
      result.code,
      TOURNAMENT_BOOKING_BRIDGE_CODE.CANONICAL_OCCUPANCY_UNAVAILABLE
    );
    assert.equal(
      result.message,
      "Chưa thể xác minh xung đột lịch sân từ nguồn canonical."
    );
    assert.equal(loadBookingsForClub(CLUB_ID).length, 0);
  });

  it("I. inactive canonical court fails closed", async () => {
    const inactive = [{ ...CANONICAL_COURTS[0], active: false }, CANONICAL_COURTS[1]];
    const result = await syncTournamentCourtBookings(
      officialTournament(["tt412-court-01"]),
      CLUB_ID,
      inactive,
      canonicalSyncOptions({
        persistSnapshot: {
          schemaVersion: 3.5,
          clubId: CLUB_ID,
          courts: inactive,
          bookings: [],
        },
        authorizedCourts: inactive,
      })
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, TOURNAMENT_BOOKING_BRIDGE_CODE.COURT_INACTIVE);
    assert.equal(result.message, "Sân đã bị vô hiệu hóa.");
    assert.equal(loadBookingsForClub(CLUB_ID).length, 0);
  });

  it("J. F5-equivalent: persisted canonical bookings reload from club blob", async () => {
    const result = await syncTournamentCourtBookings(
      officialTournament(),
      CLUB_ID,
      CANONICAL_COURTS,
      canonicalSyncOptions()
    );
    assert.equal(result.ok, true, result.message);
    const reloaded = loadBookingsForClub(CLUB_ID);
    assert.equal(reloaded.length, 2);
    assert.equal(
      reloaded.every((booking) => booking.tournamentId === TOURNAMENT_ID),
      true
    );
  });

  it("K. club_data_v3 snapshot extracts bookings from the same blob as courts", async () => {
    const payload = {
      schemaVersion: 3.5,
      clubId: CLUB_ID,
      courts: CANONICAL_COURTS,
      bookings: [
        {
          id: "b1",
          courtId: "tt412-court-01",
          date: "2026-08-14",
          startTime: "08:00",
          endTime: "09:00",
        },
      ],
    };
    assert.equal(extractClubBlobFromClubDataV3Payload(payload).courts.length, 2);
    assert.equal(extractBookingsFromClubDataV3Payload(payload).length, 1);

    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => ({
        from() {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            limit() {
              return Promise.resolve({
                data: [{ data: payload, venue_id: TENANT_ID, version: 4 }],
                error: null,
              });
            },
          };
        },
      }),
    });

    const snapshot = await readCanonicalClubCourtBookingSnapshot({
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
    });
    assert.equal(snapshot.ok, true, snapshot.error);
    assert.equal(snapshot.source, "club_data_v3");
    assert.equal(snapshot.courts.length, 2);
    assert.equal(snapshot.bookings.length, 1);
    assert.equal(snapshot.clubData.courts.length, 2);
  });

  it("L. Official provided-courts command revalidates canonical snapshot and never loadCourtsForClub", () => {
    const commandSrc = src("src/features/tournament/services/tournamentCommands.js");
    assert.match(commandSrc, /TOURNAMENT_MODE.OFFICIAL_TOURNAMENT/);
    assert.doesNotMatch(
      commandSrc.slice(
        commandSrc.indexOf("loaded.tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT"),
        commandSrc.indexOf("loaded.tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT") + 1200
      ),
      /reserveOfficialTournamentCourtsCommand/
    );
    const officialStart = commandSrc.indexOf(
      "loaded.tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT"
    );
    const officialBranch = commandSrc.slice(officialStart, officialStart + 900);
    assert.doesNotMatch(officialBranch, /loadCourtsForClub/);
    assert.doesNotMatch(officialBranch, /syncClubToCloud/);
    const providedStart = commandSrc.indexOf("if (courtsProvided)");
    const providedEnd = commandSrc.indexOf("} else {", providedStart);
    const providedBranch = commandSrc.slice(providedStart, providedEnd);
    assert.match(providedBranch, /readCanonicalClubCourtBookingSnapshot/);
    assert.match(providedBranch, /authorizeProvidedTournamentCourts/);
    assert.doesNotMatch(providedBranch, /loadCourtsForClub/);
  });

  it("M. Official booking writer does not look up legacy localStorage courts", () => {
    const bookingSrc = src("src/domain/bookingService.js");
    assert.match(bookingSrc, /authorizedCourts/);
    assert.match(bookingSrc, /Sân không còn thuộc đơn vị hiện tại/);
    const bridgeSrc = src("src/domain/tournamentBookingService.js");
    assert.match(bridgeSrc, /canonicalOccupancy/);
    assert.match(bridgeSrc, /persistCanonicalClubBookings/);
    assert.doesNotMatch(
      bridgeSrc,
      /from ["'].*daily-play/
    );
    assert.doesNotMatch(
      src("src/pages/tournament/OfficialTournamentSetup.jsx"),
      /loadCourtsForClub/
    );
  });

  it("N. maintenance occupancy in canonical bookings blocks Official reservation", async () => {
    const maintenance = {
      id: "maint-1",
      bookingType: "maintenance",
      courtId: "tt412-court-02",
      courtName: "TT412 Sân 2",
      date: "2026-08-14",
      startTime: "13:00",
      endTime: "15:00",
      bookingStatus: "confirmed",
    };
    const result = await syncTournamentCourtBookings(
      officialTournament(),
      CLUB_ID,
      CANONICAL_COURTS,
      canonicalSyncOptions({ occupancyBookings: [maintenance] })
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, TOURNAMENT_BOOKING_BRIDGE_CODE.BOOKING_CONFLICT);
    assert.equal(loadBookingsForClub(CLUB_ID).length, 0);
  });
});

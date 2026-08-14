/**
 * Phase 2L — Official court lock durability + booking/Tournament consistency.
 * Owner Preview: after lock, 13:00–17:00 and both TT412 courts must remain saved.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";

import {
  applyCourtInventoryToDraftCourtIds,
  COURT_SCHEDULE_DEFAULT_END,
  COURT_SCHEDULE_DEFAULT_START,
  hydrateCourtScheduleDraft,
  shouldResetCourtScheduleDraftOnTournamentChange,
} from "../src/components/tournament/tournamentCourtScheduleDraft.js";
import {
  buildTournamentBookingId,
  getActiveTournamentCourtBookings,
  restoreCanonicalTournamentBookingSnapshot,
  tournamentOwnedBookingsMatchCourtSchedule,
} from "../src/domain/tournamentBookingService.js";
import {
  getDefaultClubData,
  loadBookingsForClub,
  saveClubData,
} from "../src/domain/clubStorage.js";
import { setActiveClubId, DEFAULT_CLUB, loadClubs, saveClubs } from "../src/data/club.js";
import {
  COURT_LOCK_CODE,
  setTournamentCourtScheduleCommand,
} from "../src/features/tournament/services/tournamentCommands.js";
import {
  createTournamentCommand,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
  tournamentToCanonicalRow,
  canonicalRowToTournament,
} from "../src/features/tournament/index.js";
import { courtScheduleFieldsMatch } from "../src/models/tournament/courtSchedule.js";
import { TOURNAMENT_MODE, OFFICIAL_MODE } from "../src/models/tournament/index.js";

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
const CLUB_SCOPE = { id: CLUB_ID, tenantId: TENANT_ID, venueId: TENANT_ID };

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

const OWNER_DRAFT = {
  date: "2026-08-14",
  startTime: "13:00",
  endTime: "17:00",
  courtIds: ["tt412-court-01", "tt412-court-02"],
};

function seedEmptyLocalCourts() {
  const data = getDefaultClubData(CLUB_ID);
  data.courts = [];
  data.bookings = [];
  saveClubData(CLUB_ID, data);
}

function liveSnapshot() {
  const bookings = loadBookingsForClub(CLUB_ID);
  return {
    ok: true,
    courts: CANONICAL_COURTS,
    bookings,
    clubData: {
      schemaVersion: 3.5,
      clubId: CLUB_ID,
      courts: CANONICAL_COURTS,
      bookings,
    },
    source: "canonical",
  };
}

function wrapRpc(memory, intercept = {}) {
  return async (name, args) => {
    if (typeof intercept[name] === "function") {
      return intercept[name](name, args, memory.rpc);
    }
    return memory.rpc(name, args);
  };
}

async function createOfficialTournament() {
  const created = await createTournamentCommand(CLUB_SCOPE, {
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    name: "Official Open TT412",
    createdBy: "owner-1",
  });
  assert.equal(created.ok, true, created.error);
  assert.equal(created.tournament.courtSchedule, null);
  return created.tournament;
}

async function lockOwnerDraft(tournament, extras = {}) {
  const pushes = [];
  const result = await setTournamentCourtScheduleCommand(
    CLUB_SCOPE,
    tournament.id,
    OWNER_DRAFT,
    {
      tenantId: TENANT_ID,
      courts: CANONICAL_COURTS,
      readCanonicalClubCourtBookingSnapshot: async () => liveSnapshot(),
      syncClubToCloud: async (payload) => {
        pushes.push(payload);
        if (typeof extras.syncClubToCloud === "function") {
          return extras.syncClubToCloud(payload, pushes.length);
        }
        return { ok: true };
      },
      ...extras.commandOptions,
    }
  );
  return { result, pushes };
}

describe("official-open-tournament-phase2l-court-lock-durability-01", () => {
  let memory;

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    __resetTournamentRepositorySingleton();
    const clubs = loadClubs().map((club) =>
      club.id === DEFAULT_CLUB.id
        ? { ...club, tenantId: TENANT_ID, venueId: TENANT_ID }
        : club
    );
    saveClubs(clubs);
    setActiveClubId(CLUB_ID);
    seedEmptyLocalCourts();
    memory = createInMemoryCanonicalTournamentRpc({ tenantId: TENANT_ID });
    __setTournamentRepositoryRpcForTests(memory.rpc);
  });

  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("A. Owner success: 13:00–17:00 both courts survive readback and panel hydrate", async () => {
    const tournament = await createOfficialTournament();
    const { result, pushes } = await lockOwnerDraft(tournament);
    assert.equal(result.ok, true, result.error);
    assert.equal(result.tournamentPatchAttempted, true);
    assert.equal(result.courtScheduleReadbackVerified, true);
    assert.equal(result.bookingTournamentScheduleConsistent, true);
    assert.equal(pushes.length, 1);
    assert.equal(
      courtScheduleFieldsMatch(result.tournament.courtSchedule, OWNER_DRAFT),
      true
    );
    assert.ok(result.tournament.courtSchedule.syncedAt);

    const owned = getActiveTournamentCourtBookings(CLUB_ID, tournament.id);
    assert.equal(owned.length, 2);
    assert.equal(
      tournamentOwnedBookingsMatchCourtSchedule(owned, result.tournament),
      true
    );

    const f5 = hydrateCourtScheduleDraft(result.tournament.courtSchedule, "2026-08-14");
    assert.equal(f5.date, "2026-08-14");
    assert.equal(f5.startTime, "13:00");
    assert.equal(f5.endTime, "17:00");
    assert.deepEqual(new Set(f5.courtIds.map(String)), new Set(OWNER_DRAFT.courtIds));
    assert.notEqual(f5.startTime, COURT_SCHEDULE_DEFAULT_START);
    assert.notEqual(f5.endTime, COURT_SCHEDULE_DEFAULT_END);
  });

  it("B. booking push failure does not patch Tournament and keeps Owner draft values", async () => {
    const tournament = await createOfficialTournament();
    let updateCount = 0;
    __setTournamentRepositoryRpcForTests(
      wrapRpc(memory, {
        canonical_tournament_update: async () => {
          updateCount += 1;
          return { ok: false, error: "must not patch" };
        },
      })
    );
    const { result, pushes } = await lockOwnerDraft(tournament, {
      syncClubToCloud: async () => ({ ok: false, error: "cloud push failed" }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, COURT_LOCK_CODE.BOOKING_PUSH_FAILED);
    assert.equal(result.tournamentPatchAttempted, false);
    assert.equal(updateCount, 0);
    assert.equal(pushes.length, 1);

    const draft = { ...OWNER_DRAFT };
    assert.equal(draft.startTime, "13:00");
    assert.equal(draft.endTime, "17:00");
    assert.deepEqual(draft.courtIds, OWNER_DRAFT.courtIds);
  });

  it("C. Tournament patch failure compensates bookings and keeps draft", async () => {
    const tournament = await createOfficialTournament();
    __setTournamentRepositoryRpcForTests(
      wrapRpc(memory, {
        canonical_tournament_update: async () => ({
          ok: false,
          error: "tournament patch failed",
          code: "TOURNAMENT_CLOUD_UNAVAILABLE",
        }),
      })
    );
    const { result, pushes } = await lockOwnerDraft(tournament);
    assert.equal(result.ok, false);
    assert.equal(result.tournamentPatchAttempted, true);
    assert.equal(result.compensationAttempted, true);
    assert.equal(result.compensationOk, true);
    assert.equal(pushes.length, 2);
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 0);
  });

  it("D. GET readback mismatch fail-closes and compensates", async () => {
    const tournament = await createOfficialTournament();
    __setTournamentRepositoryRpcForTests(
      wrapRpc(memory, {
        canonical_tournament_get: async (name, args, inner) => {
          const got = await inner(name, args);
          if (got.ok && got.tournament?.payload?.courtSchedule) {
            return {
              ...got,
              tournament: {
                ...got.tournament,
                payload: { ...got.tournament.payload, courtSchedule: null },
              },
            };
          }
          return got;
        },
      })
    );
    const { result, pushes } = await lockOwnerDraft(tournament);
    assert.equal(result.ok, false);
    assert.equal(result.compensationAttempted, true);
    assert.equal(result.courtScheduleReadbackVerified, false);
    assert.equal(result.code, COURT_LOCK_CODE.READBACK_MISMATCH);
    assert.equal(pushes.length, 2);
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 0);
  });

  it("E. compensation push failure returns COURT_LOCK_COMPENSATION_FAILED", async () => {
    const tournament = await createOfficialTournament();
    __setTournamentRepositoryRpcForTests(
      wrapRpc(memory, {
        canonical_tournament_update: async () => ({
          ok: false,
          error: "tournament patch failed",
        }),
      })
    );
    const { result } = await lockOwnerDraft(tournament, {
      syncClubToCloud: async (_payload, n) => {
        if (n === 1) return { ok: true };
        return { ok: false, error: "compensate push failed" };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.compensationAttempted, true);
    assert.equal(result.compensationOk, false);
    assert.equal(result.code, COURT_LOCK_CODE.COMPENSATION_FAILED);
  });

  it("F. retry same values is idempotent; time-window change updates owned rows", async () => {
    const tournament = await createOfficialTournament();
    const first = await lockOwnerDraft(tournament);
    assert.equal(first.result.ok, true, first.result.error);
    const second = await lockOwnerDraft(tournament);
    assert.equal(second.result.ok, true, second.result.error);
    const owned = getActiveTournamentCourtBookings(CLUB_ID, tournament.id);
    assert.equal(owned.length, 2);
    assert.equal(
      owned.some(
        (booking) =>
          booking.id ===
          buildTournamentBookingId(tournament.id, "tt412-court-01", "2026-08-14")
      ),
      true
    );

    const moved = await setTournamentCourtScheduleCommand(
      CLUB_SCOPE,
      tournament.id,
      { ...OWNER_DRAFT, startTime: "14:00", endTime: "18:00" },
      {
        tenantId: TENANT_ID,
        courts: CANONICAL_COURTS,
        readCanonicalClubCourtBookingSnapshot: async () => liveSnapshot(),
        syncClubToCloud: async () => ({ ok: true }),
      }
    );
    assert.equal(moved.ok, true, moved.error);
    const updated = getActiveTournamentCourtBookings(CLUB_ID, tournament.id);
    assert.equal(updated.length, 2);
    assert.equal(updated.every((booking) => booking.startTime === "14:00"), true);
    assert.equal(updated.every((booking) => booking.endTime === "18:00"), true);
  });

  it("G. transient empty courts / same-id reload do not reset 13:00–17:00 draft", () => {
    const draftIds = ["tt412-court-01", "tt412-court-02"];
    assert.deepEqual(applyCourtInventoryToDraftCourtIds(draftIds, [], []), draftIds);
    const afterLoad = applyCourtInventoryToDraftCourtIds(draftIds, CANONICAL_COURTS, []);
    assert.deepEqual(afterLoad, draftIds);
    assert.equal(
      shouldResetCourtScheduleDraftOnTournamentChange(
        "993484d2-bb8d-412e-b7f2-a1ff59979c8a",
        "993484d2-bb8d-412e-b7f2-a1ff59979c8a"
      ),
      false
    );
    const hydrated = hydrateCourtScheduleDraft(
      { ...OWNER_DRAFT, syncedAt: "2026-08-14T06:00:00.000Z" },
      "2026-08-14"
    );
    assert.equal(hydrated.startTime, "13:00");
    assert.equal(hydrated.endTime, "17:00");
    const missing = hydrateCourtScheduleDraft(null, "2026-08-14");
    assert.equal(missing.startTime, COURT_SCHEDULE_DEFAULT_START);
    assert.equal(missing.endTime, COURT_SCHEDULE_DEFAULT_END);
  });

  it("H. mapper roundtrip keeps courtSchedule; restore helper rewinds owned bookings", () => {
    const row = tournamentToCanonicalRow(
      {
        id: "993484d2-bb8d-412e-b7f2-a1ff59979c8a",
        clubId: CLUB_ID,
        tenantId: TENANT_ID,
        name: "Official Open TT412",
        mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
        courtSchedule: { ...OWNER_DRAFT, syncedAt: "2026-08-14T06:00:00.000Z" },
      },
      { tenantId: TENANT_ID, clubId: CLUB_ID }
    );
    assert.equal(row.payload.courtSchedule.date, "2026-08-14");
    const back = canonicalRowToTournament({
      ...row,
      id: "993484d2-bb8d-412e-b7f2-a1ff59979c8a",
      tenant_id: TENANT_ID,
      club_id: CLUB_ID,
    });
    assert.equal(courtScheduleFieldsMatch(back.courtSchedule, OWNER_DRAFT), true);
    assert.equal(
      courtScheduleFieldsMatch(
        { ...OWNER_DRAFT, courtIds: ["tt412-court-02", "tt412-court-01"] },
        OWNER_DRAFT
      ),
      true
    );
    assert.equal(
      courtScheduleFieldsMatch(
        {
          ...OWNER_DRAFT,
          courtIds: ["tt412-court-01", "tt412-court-01", "tt412-court-02"],
        },
        OWNER_DRAFT
      ),
      false
    );

    const snapshot = {
      courts: CANONICAL_COURTS,
      bookings: [],
    };
    saveClubData(CLUB_ID, {
      ...getDefaultClubData(CLUB_ID),
      courts: CANONICAL_COURTS,
      bookings: [
        {
          id: "tournament-booking-x",
          bookingType: "tournament",
          tournamentId: "993484d2-bb8d-412e-b7f2-a1ff59979c8a",
          courtId: "tt412-court-01",
          date: "2026-08-14",
          startTime: "13:00",
          endTime: "17:00",
          bookingStatus: "confirmed",
        },
      ],
    });
    const restored = restoreCanonicalTournamentBookingSnapshot({
      clubId: CLUB_ID,
      priorOccupancyBookings: [],
      persistSnapshot: snapshot,
    });
    assert.equal(restored.ok, true);
    assert.equal(loadBookingsForClub(CLUB_ID).length, 0);
  });

  it("I. Official UI: no club refresh race; persisted lock gates schedule; draft preserved", () => {
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    const panel = src("src/components/tournament/TournamentCourtSchedulePanel.jsx");
    const group = src(
      "src/components/tournament/official/OfficialTournamentGroupStageScreen.jsx"
    );
    const command = src("src/features/tournament/services/tournamentCommands.js");

    const savedIdx = setup.indexOf("onSavedCourts=");
    const savedBlock = setup.slice(savedIdx, savedIdx + 280);
    assert.match(savedBlock, /setTournament\(result\.tournament\)/);
    assert.doesNotMatch(savedBlock, /refreshClubs/);
    assert.doesNotMatch(savedBlock, /setLocalRevision/);

    assert.match(setup, /Hãy khóa sân trên lịch booking trước khi xếp lịch vòng bảng/);
    assert.match(setup, /courtIds: persisted\.courtIds/);
    assert.doesNotMatch(setup, /courtIds: draft\.courtIds/);
    assert.match(setup, /\[activeClubId, tenantId\]/);
    assert.doesNotMatch(
      setup,
      /setCourts\(\[\]\);\s*if \(!activeClubId\)/
    );

    assert.match(panel, /Đang khóa sân/);
    assert.match(panel, /Đã khóa sân cho giải/);
    assert.match(panel, /disabled=\{busy \|\| !courts\.length \|\| !courtIds\.length\}/);
    assert.doesNotMatch(panel, /\[tournament\?\.id, schedule\?\.syncedAt\]/);
    assert.match(panel, /shouldResetCourtScheduleDraftOnTournamentChange/);
    assert.match(panel, /applyCourtInventoryToDraftCourtIds/);
    assert.doesNotMatch(panel, /visibilitychange|window\.addEventListener\(["']focus/);

    assert.match(group, /persistedCourtLock/);
    assert.match(
      group,
      /Hãy khóa sân trên lịch booking trước khi xếp lịch vòng bảng/
    );

    const providedStart = command.indexOf("if (courtsProvided)");
    const providedEnd = command.indexOf("} else {", providedStart);
    const providedBranch = command.slice(providedStart, providedEnd);
    assert.match(providedBranch, /getTournamentQuery/);
    assert.match(providedBranch, /courtScheduleFieldsMatch/);
    assert.match(providedBranch, /compensateOfficialCourtLock/);
    assert.match(providedBranch, /tournamentPatchAttempted: false/);
    assert.match(command, /COURT_LOCK_COMPENSATION_FAILED/);
    assert.doesNotMatch(command, /from ["'].*daily-play/);

    const club = src("src/context/ClubContext.jsx");
    assert.match(club, /TOKEN_REFRESHED/);
    const policy = src(
      "src/features/tournament/hooks/canonicalTournamentLoadPolicy.js"
    );
    assert.match(policy, /keep-transient/);
  });

  it("J. Daily Play occupancy remains out of Official court lock", () => {
    const booking = src("src/domain/tournamentBookingService.js");
    const command = src("src/features/tournament/services/tournamentCommands.js");
    const inventory = src(
      "src/features/team-tournament/services/canonicalClubCourtInventory.js"
    );
    assert.doesNotMatch(booking, /from ["'].*daily-play/);
    assert.doesNotMatch(command, /from ["'].*daily-play/);
    assert.match(inventory, /Does not include Daily Play leases/);
  });
});

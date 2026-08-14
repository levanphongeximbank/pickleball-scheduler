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
  getActiveTournamentCourtBookings,
  restoreCanonicalTournamentBookingSnapshot,
} from "../src/domain/tournamentBookingService.js";
import {
  getDefaultClubData,
  loadBookingsForClub,
  saveClubData,
} from "../src/domain/clubStorage.js";
import { markClubDataSynced } from "../src/domain/clubSyncMetadata.js";
import { setActiveClubId, DEFAULT_CLUB, loadClubs, saveClubs } from "../src/data/club.js";
import {
  setTournamentCourtScheduleCommand,
} from "../src/features/tournament/services/tournamentCommands.js";
import {
  createTournamentCommand,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
  createInMemoryOfficialCourtAuthority,
  __setOfficialCourtReservationRpcForTests,
  __resetOfficialCourtReservationRpcForTests,
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

function installOfficialReservationRpc(memory, extras = {}) {
  const courtAuth = createInMemoryOfficialCourtAuthority({
    rows: memory.rows,
    tenantId: TENANT_ID,
    now: "2026-08-14T00:00:00.000Z",
    clubCourts: { [CLUB_ID]: CANONICAL_COURTS },
    blobBookingsByClub: extras.blobBookingsByClub || {},
    dailyLeases: extras.dailyLeases || [],
  });
  const rpc = async (name, args) => {
    if (String(name).startsWith("official_tournament_")) {
      return courtAuth.rpc(name, args);
    }
    return memory.rpc(name, args);
  };
  __setTournamentRepositoryRpcForTests(rpc);
  __setOfficialCourtReservationRpcForTests(rpc);
  return { courtAuth, rpc };
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
  const result = await setTournamentCourtScheduleCommand(
    CLUB_SCOPE,
    tournament.id,
    extras.schedule || OWNER_DRAFT,
    {
      tenantId: TENANT_ID,
      timezone: "Asia/Ho_Chi_Minh",
      expectedVersion: extras.expectedVersion ?? tournament.version ?? 1,
      idempotencyKey: extras.idempotencyKey,
      rpc: extras.rpc,
      ...extras.commandOptions,
    }
  );
  return { result };
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
    markClubDataSynced(CLUB_ID, { pull: true });
    memory = createInMemoryCanonicalTournamentRpc({ tenantId: TENANT_ID });
    installOfficialReservationRpc(memory);
  });

  afterEach(() => {
    __resetTournamentRepositorySingleton();
    __resetOfficialCourtReservationRpcForTests();
  });

  it("A. Owner success: 13:00–17:00 both courts survive canonical readback and panel hydrate", async () => {
    const tournament = await createOfficialTournament();
    const { result } = await lockOwnerDraft(tournament, { idempotencyKey: "2l-a" });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.cloudWriteCount, 1);
    assert.equal(
      courtScheduleFieldsMatch(result.tournament.courtSchedule, OWNER_DRAFT),
      true
    );
    assert.ok(result.tournament.courtSchedule.syncedAt);
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 0);

    const f5 = hydrateCourtScheduleDraft(result.tournament.courtSchedule, "2026-08-14");
    assert.equal(f5.date, "2026-08-14");
    assert.equal(f5.startTime, "13:00");
    assert.equal(f5.endTime, "17:00");
    assert.deepEqual(new Set(f5.courtIds.map(String)), new Set(OWNER_DRAFT.courtIds));
    assert.notEqual(f5.startTime, COURT_SCHEDULE_DEFAULT_START);
    assert.notEqual(f5.endTime, COURT_SCHEDULE_DEFAULT_END);
  });

  it("B. reservation RPC failure does not write Club bookings", async () => {
    const tournament = await createOfficialTournament();
    const { result } = await lockOwnerDraft(tournament, {
      idempotencyKey: "2l-b",
      rpc: async () => ({ ok: false, code: "CLOUD_UNAVAILABLE", error: "rpc down" }),
    });
    assert.equal(result.ok, false);
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 0);
    assert.equal(result.tournamentPatchAttempted, false);
  });

  it("C. Official lock is one server command — no client compensation path", () => {
    const command = src("src/features/tournament/services/tournamentCommands.js");
    const officialStart = command.indexOf("loaded.tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT");
    assert.ok(officialStart >= 0);
    const officialBranch = command.slice(officialStart, officialStart + 800);
    assert.match(officialBranch, /reserveOfficialTournamentCourtsCommand/);
    assert.doesNotMatch(officialBranch, /compensateOfficialCourtLock/);
    assert.doesNotMatch(officialBranch, /syncClubToCloud/);
  });

  it("D. canonical GET courtSchedule is UI authority — no Club booking readback", async () => {
    const tournament = await createOfficialTournament();
    const { result } = await lockOwnerDraft(tournament, { idempotencyKey: "2l-d" });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.courtScheduleReadbackVerified, true);
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 0);
  });

  it("E. version conflict does not mutate reservations", async () => {
    const tournament = await createOfficialTournament();
    const { result } = await lockOwnerDraft(tournament, {
      expectedVersion: 99,
      idempotencyKey: "2l-e",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "VERSION_CONFLICT");
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 0);
  });

  it("F. retry same values is idempotent; time-window change updates canonical schedule", async () => {
    const tournament = await createOfficialTournament();
    const first = await lockOwnerDraft(tournament, { idempotencyKey: "2l-f1" });
    assert.equal(first.result.ok, true, first.result.error);
    const second = await lockOwnerDraft(tournament, {
      expectedVersion: first.result.version,
      idempotencyKey: "2l-f1",
    });
    assert.equal(second.result.ok, true, second.result.error);
    assert.equal(second.result.replay || second.result.ok, true);

    const moved = await lockOwnerDraft(
      { ...tournament, version: first.result.version },
      {
        schedule: { ...OWNER_DRAFT, startTime: "14:00", endTime: "18:00" },
        expectedVersion: first.result.version,
        idempotencyKey: "2l-f2",
      }
    );
    assert.equal(moved.result.ok, true, moved.result.error);
    assert.equal(moved.result.tournament.courtSchedule.startTime, "14:00");
    assert.equal(moved.result.tournament.courtSchedule.endTime, "18:00");
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 0);
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
    assert.match(setup, /resolveTournamentCourtInventoryScope/);
    assert.match(setup, /courtInventoryScope\.venueId/);
    assert.match(setup, /courtInventoryScope\.clubId/);
    assert.match(setup, /courtInventoryScope\.tenantId/);
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

    assert.match(setup, /commitOfficialGroupScheduleCommand/);
    assert.match(command, /reserveOfficialTournamentCourtsCommand/);
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

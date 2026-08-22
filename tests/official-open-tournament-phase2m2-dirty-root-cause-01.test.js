/**
 * Phase 2M.2 — dirty-state root cause: hydration / abandoned Official persist / stale flag.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";

import { buildTournamentBookingId } from "../src/domain/tournamentBookingService.js";
import { loadClubData, saveClubData, setClubCloudVersion } from "../src/domain/clubStorage.js";
import {
  getClubDirtyProvenance,
  isClubDataDirty,
  markClubDataDirty,
  markClubDataSynced,
} from "../src/domain/clubSyncMetadata.js";
import { hydrateClubPlayersPickVnRatings } from "../src/features/pick-vn-rating/services/pickVnClubSyncService.js";
import {
  __resetClubCloudPushScheduleCountForTests,
  __getClubCloudPushScheduleCountForTests,
} from "../src/ai/clubCloudPush.js";
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
} from "../src/features/tournament/index.js";
import { TOURNAMENT_MODE, OFFICIAL_MODE } from "../src/models/tournament/index.js";
import { setActiveClubId, DEFAULT_CLUB, loadClubs, saveClubs } from "../src/data/club.js";

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

function freshRemoteClubData(overrides = {}) {
  return {
    schemaVersion: 3.5,
    clubId: CLUB_ID,
    players: [{ id: "cloud-player-v7", name: "Cloud Player V7" }],
    customers: [{ id: "cloud-customer-v7", name: "Cloud Customer V7" }],
    courtManagement: { openHour: 7, closeHour: 22, slotMinutes: 60 },
    courts: CANONICAL_COURTS,
    bookings: [],
    ...overrides,
  };
}

function snapshotFrom(remote) {
  const clubData = {
    ...(remote.clubData || {}),
    courts: remote.clubData?.courts || remote.courts,
    bookings: remote.clubData?.bookings ?? remote.bookings,
  };
  return {
    ok: true,
    version: remote.version,
    courts: clubData.courts,
    bookings: clubData.bookings,
    clubData,
    source: "canonical",
  };
}

function seedHydratedFromCloud(remoteClubData) {
  saveClubData(CLUB_ID, remoteClubData, { source: "cloud" });
  markClubDataSynced(CLUB_ID, { pull: true, version: 7 });
  setClubCloudVersion(CLUB_ID, 7);
}

async function createOfficialTournament() {
  const created = await createTournamentCommand(CLUB_SCOPE, {
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    name: "Official Open TT412",
    createdBy: "owner-1",
  });
  assert.equal(created.ok, true, created.error);
  return created.tournament;
}

async function lockOwnerDraft(tournament, extras = {}) {
  const pushes = [];
  const remote = extras.remote;
  const result = await setTournamentCourtScheduleCommand(
    CLUB_SCOPE,
    tournament.id,
    OWNER_DRAFT,
    {
      tenantId: TENANT_ID,
      timezone: "Asia/Ho_Chi_Minh",
      courts: CANONICAL_COURTS,
      readCanonicalClubCourtBookingSnapshot:
        extras.readCanonicalClubCourtBookingSnapshot ||
        (async () => snapshotFrom(remote)),
      syncClubToCloud: async (payload) => {
        pushes.push({ ...payload });
        if (typeof extras.syncClubToCloud === "function") {
          return extras.syncClubToCloud(payload, pushes.length, remote);
        }
        const expected = Number(payload?.expectedVersion);
        if (!remote || expected !== remote.version) {
          return {
            ok: false,
            code: "VERSION_CONFLICT",
            error: "Dữ liệu CLB đã được cập nhật bởi người khác — tải lại.",
          };
        }
        const local = loadClubData(CLUB_ID);
        remote.version = expected + 1;
        remote.clubData = local;
        remote.bookings = local.bookings || [];
        setClubCloudVersion(CLUB_ID, remote.version);
        markClubDataSynced(CLUB_ID, { push: true, version: remote.version });
        return { ok: true, version: remote.version };
      },
      ...extras.commandOptions,
    }
  );
  return { result, pushes };
}

describe("official-open-tournament-phase2m2-dirty-root-cause-01", () => {
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
    seedHydratedFromCloud(freshRemoteClubData());
    __resetClubCloudPushScheduleCountForTests();
    memory = createInMemoryCanonicalTournamentRpc({ tenantId: TENANT_ID });
    const courtAuth = createInMemoryOfficialCourtAuthority({
      rows: memory.rows,
      tenantId: TENANT_ID,
      now: "2026-08-14T00:00:00.000Z",
      clubCourts: { [CLUB_ID]: CANONICAL_COURTS },
    });
    const rpc = async (name, args) => {
      if (String(name).startsWith("official_tournament_")) return courtAuth.rpc(name, args);
      return memory.rpc(name, args);
    };
    __setTournamentRepositoryRpcForTests(rpc);
    __setOfficialCourtReservationRpcForTests(rpc);
  });

  afterEach(() => {
    __resetClubCloudPushScheduleCountForTests();
    __resetTournamentRepositorySingleton();
    __resetOfficialCourtReservationRpcForTests();
  });

  it("A. provenance records dirty source/operation; cloud hydrate does not dirty", () => {
    assert.equal(isClubDataDirty(CLUB_ID), false);
    saveClubData(CLUB_ID, loadClubData(CLUB_ID), {
      operation: "canonical-booking-persist",
      dirtyReason: "club-blob-write",
    });
    const provenance = getClubDirtyProvenance(CLUB_ID);
    assert.equal(provenance.dirty, true);
    assert.equal(provenance.dirtySource, "local");
    assert.equal(provenance.dirtyOperation, "canonical-booking-persist");
    assert.ok(provenance.dirtyGeneration >= 1);

    markClubDataSynced(CLUB_ID, { pull: true, version: 7 });
    saveClubData(CLUB_ID, loadClubData(CLUB_ID), { source: "cloud" });
    assert.equal(isClubDataDirty(CLUB_ID), false);
  });

  it("B. Pick VN hydrate does not persist club blob or mark dirty", async () => {
    saveClubData(
      CLUB_ID,
      {
        ...loadClubData(CLUB_ID),
        players: [
          {
            id: "p1",
            name: "A",
            authUserId: "auth-1",
          },
        ],
      },
      { source: "cloud" }
    );
    markClubDataSynced(CLUB_ID, { pull: true });
    const hydrated = await hydrateClubPlayersPickVnRatings(CLUB_ID);
    assert.equal(hydrated.ok, true);
    assert.equal(hydrated.persistedClubBlob, false);
    assert.equal(isClubDataDirty(CLUB_ID), false);
  });









  it("C–I replaced: Official lock does not janitor blob bookings or require club dirty flush", async () => {
    const tournament = await createOfficialTournament();
    const leftover = {
      id: buildTournamentBookingId(tournament.id, "tt412-court-01", "2026-08-14"),
      bookingType: "tournament",
      tournamentId: tournament.id,
      courtId: "tt412-court-01",
      date: "2026-08-14",
      startTime: "13:00",
      endTime: "17:00",
      bookingStatus: "confirmed",
    };
    saveClubData(CLUB_ID, { ...loadClubData(CLUB_ID), bookings: [leftover] });
    markClubDataDirty(CLUB_ID, { source: "test", operation: "leftover" });
    const { result } = await lockOwnerDraft(tournament);
    assert.equal(result.ok, true, result.error);
    assert.equal(loadClubData(CLUB_ID).bookings.length, 1);
  });

  it("G. source: Official UI/token/focus/hydrate must not mark club dirty", () => {
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    const panel = src("src/components/tournament/TournamentCourtSchedulePanel.jsx");
    const club = src("src/context/ClubContext.jsx");
    const pickVn = src("src/features/pick-vn-rating/services/pickVnClubSyncService.js");
    const storage = src("src/ai/storage.js");
    assert.doesNotMatch(setup, /saveClubData\(/);
    assert.doesNotMatch(panel, /saveClubData\(/);
    assert.doesNotMatch(panel, /markClubDataDirty/);
    assert.match(club, /TOKEN_REFRESHED must not clear clubs/);
    assert.doesNotMatch(club, /saveClubData\(/);
    assert.doesNotMatch(pickVn, /saveClubData\(/);
    // Current saveAIData signature forwards options into saveClubData (dirty policy).
    assert.match(storage, /saveClubData\(\s*resolvedClubId,\s*next,\s*options\s*\)/);
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 0);
  });




});

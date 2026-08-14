/**
 * Phase 2M — Official court lock club_data_v3 version / self-race / CAS retry.
 * Owner Preview: VERSION_CONFLICT while locking TT412 14/08/2026 13:00–17:00.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import {
  getActiveTournamentCourtBookings,
} from "../src/domain/tournamentBookingService.js";
import {
  getDefaultClubData,
  loadClubData,
  saveClubData,
  setClubCloudVersion,
} from "../src/domain/clubStorage.js";
import { markClubDataSynced } from "../src/domain/clubSyncMetadata.js";
import {
  __getClubCloudPushScheduleCountForTests,
  __getPendingClubCloudPushCountForTests,
  __resetClubCloudPushScheduleCountForTests,
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

const CLOUD_PLAYER = { id: "cloud-player-v7", name: "Cloud Player V7" };
const CLOUD_CUSTOMER = { id: "cloud-customer-v7", name: "Cloud Customer V7" };

function freshRemoteClubData(overrides = {}) {
  return {
    schemaVersion: 3.5,
    clubId: CLUB_ID,
    players: [CLOUD_PLAYER],
    customers: [CLOUD_CUSTOMER],
    courtManagement: { openHour: 7, closeHour: 22, slotMinutes: 60 },
    courts: CANONICAL_COURTS,
    bookings: [],
    ...overrides,
  };
}

function seedStaleLocalBlob() {
  saveClubData(CLUB_ID, {
    ...getDefaultClubData(CLUB_ID),
    players: [],
    customers: [],
    courts: [],
    bookings: [],
    courtManagement: { openHour: 6, closeHour: 21, slotMinutes: 30 },
  });
}

function snapshotFrom(remote) {
  const clubData = {
    ...remote.clubData,
    courts: remote.courts,
    bookings: remote.bookings,
  };
  return {
    ok: true,
    version: remote.version,
    courts: remote.courts,
    bookings: remote.bookings,
    clubData,
    source: "canonical",
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
        if (!remote || !Number.isFinite(expected) || expected !== remote.version) {
          return {
            ok: false,
            code: "VERSION_CONFLICT",
            error: "Dữ liệu CLB đã được cập nhật bởi người khác — tải lại.",
            remoteVersion: remote?.version,
          };
        }
        const local = loadClubData(CLUB_ID);
        remote.version = expected + 1;
        remote.clubData = local;
        remote.bookings = local.bookings || [];
        remote.courts = local.courts?.length ? local.courts : remote.courts;
        setClubCloudVersion(CLUB_ID, remote.version);
        markClubDataSynced(CLUB_ID, { push: true });
        return { ok: true, version: remote.version };
      },
      ...extras.commandOptions,
    }
  );
  return { result, pushes };
}

describe("official-open-tournament-phase2m-club-version-cas-retry-01", () => {
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
    seedStaleLocalBlob();
    setClubCloudVersion(CLUB_ID, 3);
    markClubDataSynced(CLUB_ID, { pull: true });
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



  it("B. controlled save schedules zero background push; normal save still schedules", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    __resetClubCloudPushScheduleCountForTests();
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 0);
    assert.equal(__getPendingClubCloudPushCountForTests(), 0);
    await delay(1600);
    assert.equal(pushes.length, 0);
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 0);
    assert.equal(__getPendingClubCloudPushCountForTests(), 0);

    saveClubData(CLUB_ID, loadClubData(CLUB_ID));
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 1);
  });

  it("A/C–J replaced: Official lock is tournament RPC CAS, not club blob CAS", async () => {
    const tournament = await createOfficialTournament();
    const { result, pushes } = await lockOwnerDraft(tournament, {
      remote: {
        version: 7,
        courts: CANONICAL_COURTS,
        bookings: [],
        clubData: freshRemoteClubData(),
      },
    });
    assert.equal(result.ok, true, result.error);
    assert.equal(pushes.length, 0);
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 0);
    assert.equal(Number(result.tournament.version) > 1, true);
    const command = src("src/features/tournament/services/tournamentCommands.js");
    const officialStart = command.indexOf(
      "loaded.tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT"
    );
    const officialBranch = command.slice(officialStart, officialStart + 900);
    assert.doesNotMatch(officialBranch, /compensateOfficialCourtLock/);
    assert.doesNotMatch(officialBranch, /syncClubToCloud/);
  });

















  it("K. source contract: Official lock uses tournament CAS, not club blob version", () => {
    const command = src("src/features/tournament/services/tournamentCommands.js");
    const officialStart = command.indexOf(
      "loaded.tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT"
    );
    const officialBranch = command.slice(officialStart, officialStart + 900);
    assert.match(officialBranch, /reserveOfficialTournamentCourtsCommand/);
    assert.match(officialBranch, /expectedVersion/);
    assert.doesNotMatch(officialBranch, /syncClubToCloud/);
    assert.doesNotMatch(officialBranch, /compensateOfficialCourtLock/);
    assert.doesNotMatch(command, /from ["'].*daily-play/);
  });
});

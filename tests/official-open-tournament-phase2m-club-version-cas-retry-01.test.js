/**
 * Phase 2M — Official court lock club_data_v3 version / self-race / CAS retry.
 * Owner Preview: VERSION_CONFLICT while locking TT412 14/08/2026 13:00–17:00.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { hydrateCourtScheduleDraft } from "../src/components/tournament/tournamentCourtScheduleDraft.js";
import {
  getActiveTournamentCourtBookings,
  TOURNAMENT_BOOKING_BRIDGE_CODE,
} from "../src/domain/tournamentBookingService.js";
import {
  getClubCloudVersion,
  getDefaultClubData,
  loadBookingsForClub,
  loadClubData,
  saveClubData,
  setClubCloudVersion,
} from "../src/domain/clubStorage.js";
import { isClubDataDirty, markClubDataSynced } from "../src/domain/clubSyncMetadata.js";
import {
  __getClubCloudPushScheduleCountForTests,
  __getPendingClubCloudPushCountForTests,
  __resetClubCloudPushScheduleCountForTests,
} from "../src/ai/clubCloudPush.js";
import {
  COURT_LOCK_CODE,
  setTournamentCourtScheduleCommand,
} from "../src/features/tournament/services/tournamentCommands.js";
import {
  createTournamentCommand,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
} from "../src/features/tournament/index.js";
import { courtScheduleFieldsMatch } from "../src/models/tournament/courtSchedule.js";
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
const V8_CUSTOMER = { id: "cloud-customer-v8", name: "Cloud Customer V8" };

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
    __setTournamentRepositoryRpcForTests(memory.rpc);
  });

  afterEach(() => {
    __resetClubCloudPushScheduleCountForTests();
    __resetTournamentRepositorySingleton();
  });

  it("A. stale local V3 / remote V7 / no concurrency → expectedVersion=7 success", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    assert.equal(getClubCloudVersion(CLUB_ID), 3);
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.firstPushExpectedVersion, 7);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].expectedVersion, 7);
    assert.notEqual(pushes[0].expectedVersion, 3);
    assert.equal(getClubCloudVersion(CLUB_ID), 8);
    assert.equal(result.courtScheduleReadbackVerified, true);
    assert.equal(result.bookingTournamentScheduleConsistent, true);
    assert.equal(isClubDataDirty(CLUB_ID), false);
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
    assert.equal(pushes.length, 1);
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 0);
    assert.equal(__getPendingClubCloudPushCountForTests(), 0);

    saveClubData(CLUB_ID, loadClubData(CLUB_ID));
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 1);
  });

  it("C. genuine V7→V8 unrelated update → one rebase, metadata preserved, Tournament patch once", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    let updateCount = 0;
    __setTournamentRepositoryRpcForTests(
      wrapRpc(memory, {
        canonical_tournament_update: async (name, args, inner) => {
          updateCount += 1;
          return inner(name, args);
        },
      })
    );
    const { result, pushes } = await lockOwnerDraft(tournament, {
      remote,
      syncClubToCloud: async (payload, n, live) => {
        if (n === 1) {
          live.version = 8;
          live.clubData = freshRemoteClubData({
            customers: [CLOUD_CUSTOMER, V8_CUSTOMER],
            courtManagement: { openHour: 8, closeHour: 23, slotMinutes: 45 },
          });
          live.bookings = [];
          return {
            ok: false,
            code: "VERSION_CONFLICT",
            error: "Dữ liệu CLB đã được cập nhật bởi người khác — tải lại.",
            remoteVersion: 8,
          };
        }
        assert.equal(payload.expectedVersion, 8);
        const local = loadClubData(CLUB_ID);
        live.version = 9;
        live.clubData = local;
        live.bookings = local.bookings || [];
        setClubCloudVersion(CLUB_ID, 9);
        markClubDataSynced(CLUB_ID, { push: true });
        return { ok: true, version: 9 };
      },
    });
    assert.equal(result.ok, true, result.error);
    assert.equal(pushes.length, 2);
    assert.equal(pushes[0].expectedVersion, 7);
    assert.equal(pushes[1].expectedVersion, 8);
    assert.equal(updateCount, 1);
    const stored = loadClubData(CLUB_ID);
    assert.equal(
      stored.customers.some((customer) => customer.id === "cloud-customer-v8"),
      true
    );
    assert.equal(stored.courtManagement.openHour, 8);
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 2);
  });

  it("D. V8 introduces booking overlap → blocked, no overwrite, no Tournament patch", async () => {
    const tournament = await createOfficialTournament();
    const overlap = {
      id: "foreign-overlap-v8",
      bookingType: "single",
      courtId: "tt412-court-01",
      courtName: "TT412 Sân 1",
      date: "2026-08-14",
      startTime: "14:00",
      endTime: "15:00",
      bookingStatus: "confirmed",
    };
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
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
      remote,
      syncClubToCloud: async (_payload, n, live) => {
        if (n === 1) {
          live.version = 8;
          live.bookings = [overlap];
          live.clubData = freshRemoteClubData({ bookings: [overlap] });
          return {
            ok: false,
            code: "VERSION_CONFLICT",
            error: "Dữ liệu CLB đã được cập nhật bởi người khác — tải lại.",
          };
        }
        return { ok: true, version: 9 };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, TOURNAMENT_BOOKING_BRIDGE_CODE.BOOKING_CONFLICT);
    assert.equal(result.tournamentPatchAttempted, false);
    assert.equal(updateCount, 0);
    assert.equal(pushes.length, 1);
    assert.equal(
      loadBookingsForClub(CLUB_ID).some((booking) => booking.id === overlap.id),
      true
    );
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 0);
  });

  it("E. second VERSION_CONFLICT fail-closes and keeps Owner draft", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
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
      remote,
      syncClubToCloud: async () => ({
        ok: false,
        code: "VERSION_CONFLICT",
        error: "Dữ liệu CLB đã được cập nhật bởi người khác — tải lại.",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, COURT_LOCK_CODE.VERSION_CONFLICT_RETRY_EXHAUSTED);
    assert.equal(result.error, "Dữ liệu lịch sân vừa thay đổi. Vui lòng thử khóa sân lại.");
    assert.equal(result.tournamentPatchAttempted, false);
    assert.equal(updateCount, 0);
    assert.equal(pushes.length, 2);
    assert.equal(isClubDataDirty(CLUB_ID), true);
    const draft = { ...OWNER_DRAFT };
    assert.equal(draft.date, "2026-08-14");
    assert.equal(draft.startTime, "13:00");
    assert.equal(draft.endTime, "17:00");
    assert.deepEqual(draft.courtIds, OWNER_DRAFT.courtIds);
    assert.equal(tournament.courtSchedule, null);
    const hydrated = hydrateCourtScheduleDraft(null, "2026-08-14");
    assert.equal(hydrated.date, "2026-08-14");
  });

  it("F. fresh remote unrelated fields are preserved over stale local blob", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    const { result } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    const stored = loadClubData(CLUB_ID);
    assert.equal(
      stored.players.some((player) => player.id === "cloud-player-v7"),
      true
    );
    assert.equal(
      stored.customers.some((customer) => customer.id === "cloud-customer-v7"),
      true
    );
    assert.equal(stored.courtManagement.openHour, 7);
    assert.equal(stored.courts.length, 2);
  });

  it("G. compensation uses post-push version, not the original snapshot version", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    __setTournamentRepositoryRpcForTests(
      wrapRpc(memory, {
        canonical_tournament_update: async () => ({
          ok: false,
          error: "tournament patch failed",
          code: "TOURNAMENT_CLOUD_UNAVAILABLE",
        }),
      })
    );
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, false);
    assert.equal(result.compensationAttempted, true);
    assert.equal(result.compensationOk, true);
    assert.equal(pushes.length, 2);
    assert.equal(pushes[0].expectedVersion, 7);
    assert.equal(pushes[1].expectedVersion, 8);
    assert.notEqual(pushes[1].expectedVersion, 7);
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, tournament.id).length, 0);
  });

  it("H. no Tournament patch before booking push success", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
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
      remote,
      syncClubToCloud: async () => ({
        ok: false,
        error: "cloud push failed",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, COURT_LOCK_CODE.BOOKING_PUSH_FAILED);
    assert.equal(result.tournamentPatchAttempted, false);
    assert.equal(updateCount, 0);
    assert.equal(pushes.length, 1);
    assert.equal(isClubDataDirty(CLUB_ID), true);
  });

  it("I. success still requires dual canonical proof", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    assert.equal(pushes.length, 1);
    assert.equal(result.tournamentPatchAttempted, true);
    assert.equal(result.courtScheduleReadbackVerified, true);
    assert.equal(result.bookingTournamentScheduleConsistent, true);
    assert.equal(
      courtScheduleFieldsMatch(result.tournament.courtSchedule, OWNER_DRAFT),
      true
    );
    const owned = getActiveTournamentCourtBookings(CLUB_ID, tournament.id);
    assert.equal(owned.length, 2);
    const f5 = hydrateCourtScheduleDraft(result.tournament.courtSchedule, "2026-08-14");
    assert.equal(f5.startTime, "13:00");
    assert.equal(f5.endTime, "17:00");
    assert.deepEqual(new Set(f5.courtIds.map(String)), new Set(OWNER_DRAFT.courtIds));
  });

  it("J. VERSION_CONFLICT / retry failure keeps Owner draft values", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    const { result } = await lockOwnerDraft(tournament, {
      remote,
      syncClubToCloud: async () => ({
        ok: false,
        code: "VERSION_CONFLICT",
        error: "Dữ liệu CLB đã được cập nhật bởi người khác — tải lại.",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "Dữ liệu lịch sân vừa thay đổi. Vui lòng thử khóa sân lại.");
    assert.equal(OWNER_DRAFT.date, "2026-08-14");
    assert.equal(OWNER_DRAFT.startTime, "13:00");
    assert.equal(OWNER_DRAFT.endTime, "17:00");
    assert.deepEqual(OWNER_DRAFT.courtIds, ["tt412-court-01", "tt412-court-02"]);
    const panel = src("src/components/tournament/TournamentCourtSchedulePanel.jsx");
    assert.match(panel, /Đã khóa sân cho giải/);
    assert.match(panel, /setError\(result\.error/);
    assert.doesNotMatch(panel, /\[tournament\?\.id, schedule\?\.syncedAt\]/);
  });

  it("K. source contract: snapshot version, opt-in suppress, no preemptive version force", () => {
    const command = src("src/features/tournament/services/tournamentCommands.js");
    const storage = src("src/domain/clubStorage.js");
    const booking = src("src/domain/tournamentBookingService.js");
    const push = src("src/ai/clubCloudPush.js");
    const cloud = src("src/ai/cloudSync.js");

    const providedStart = command.indexOf("if (courtsProvided)");
    const providedEnd = command.indexOf("} else {", providedStart);
    const providedBranch = command.slice(providedStart, providedEnd);
    assert.match(providedBranch, /expectedVersion/);
    assert.match(providedBranch, /suppressCloudPush:\s*true/);
    assert.match(providedBranch, /persistSnapshot:\s*working\.clubData/);
    assert.match(providedBranch, /VERSION_CONFLICT_MAX_RETRY_COUNT/);
    assert.match(command, /VERSION_CONFLICT_MAX_RETRY_COUNT = 1/);
    assert.match(command, /Dữ liệu lịch sân vừa thay đổi\. Vui lòng thử khóa sân lại\./);
    assert.doesNotMatch(command, /setClubCloudVersion/);
    assert.doesNotMatch(command, /markClubDataSynced/);
    assert.doesNotMatch(command, /from ["'].*daily-play/);

    assert.match(storage, /options\.suppressCloudPush !== true/);
    assert.match(booking, /useFreshSnapshot \? \{ \.\.\.snapshotClubData \} : loadClubData/);
    assert.match(cloud, /remote\.version > expectedVersion/);
    assert.match(cloud, /Dữ liệu CLB đã được cập nhật bởi người khác — tải lại\./);
    assert.match(push, /expectedVersion: getClubCloudVersion\(id\)/);
  });
});

/**
 * Phase 2M.1 — pre-existing cloud push + dirty-local safety for Official court lock.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { hydrateCourtScheduleDraft } from "../src/components/tournament/tournamentCourtScheduleDraft.js";
import {
  getClubCloudVersion,
  getDefaultClubData,
  loadClubData,
  saveClubData,
  setClubCloudVersion,
} from "../src/domain/clubStorage.js";
import { isClubDataDirty, markClubDataSynced } from "../src/domain/clubSyncMetadata.js";
import {
  __armPendingClubCloudPushForTests,
  __getClubCloudPushScheduleCountForTests,
  __resetClubCloudPushScheduleCountForTests,
  hasPendingClubCloudPush,
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
const LOCAL_CUSTOMER = { id: "local-unsynced-customer", name: "LOCAL_NEW_VALUE" };

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

function seedCleanLocalBlob() {
  saveClubData(CLUB_ID, {
    ...getDefaultClubData(CLUB_ID),
    players: [],
    customers: [],
    courts: [],
    bookings: [],
  });
  markClubDataSynced(CLUB_ID, { pull: true });
}

function snapshotFrom(remote) {
  return {
    ok: true,
    version: remote.version,
    courts: remote.courts,
    bookings: remote.bookings,
    clubData: {
      ...remote.clubData,
      courts: remote.courts,
      bookings: remote.bookings,
    },
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
        markClubDataSynced(CLUB_ID, { push: true });
        return { ok: true, version: remote.version };
      },
      ...extras.commandOptions,
    }
  );
  return { result, pushes };
}

describe("official-open-tournament-phase2m1-dirty-pending-push-01", () => {
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
    seedCleanLocalBlob();
    setClubCloudVersion(CLUB_ID, 3);
    __resetClubCloudPushScheduleCountForTests();
    memory = createInMemoryCanonicalTournamentRpc({ tenantId: TENANT_ID });
    __setTournamentRepositoryRpcForTests(memory.rpc);
  });

  afterEach(() => {
    __resetClubCloudPushScheduleCountForTests();
    __resetTournamentRepositorySingleton();
  });

  it("A. source:cloud save does not schedule a redundant push-back", () => {
    __resetClubCloudPushScheduleCountForTests();
    saveClubData(CLUB_ID, loadClubData(CLUB_ID), { source: "cloud" });
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 0);
    assert.equal(isClubDataDirty(CLUB_ID), false);
  });

  it("B. ordinary local save still schedules one push", () => {
    __resetClubCloudPushScheduleCountForTests();
    saveClubData(CLUB_ID, loadClubData(CLUB_ID));
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 1);
    assert.equal(isClubDataDirty(CLUB_ID), true);
  });

  it("C. pre-existing dirty local state fail-closes and preserves unsynced fields", async () => {
    const tournament = await createOfficialTournament();
    saveClubData(CLUB_ID, {
      ...loadClubData(CLUB_ID),
      customers: [LOCAL_CUSTOMER],
    });
    assert.equal(isClubDataDirty(CLUB_ID), true);
    let timerFired = 0;
    __armPendingClubCloudPushForTests(CLUB_ID, {
      delayMs: 400,
      onFire: () => {
        timerFired += 1;
      },
    });
    assert.equal(hasPendingClubCloudPush(CLUB_ID), true);

    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, false);
    assert.equal(result.code, COURT_LOCK_CODE.LOCAL_DIRTY_PENDING_SYNC);
    assert.match(result.error, /chưa đồng bộ/);
    assert.equal(result.tournamentPatchAttempted, false);
    assert.equal(pushes.length, 0);
    assert.equal(hasPendingClubCloudPush(CLUB_ID), true);
    assert.equal(
      loadClubData(CLUB_ID).customers.some((customer) => customer.id === LOCAL_CUSTOMER.id),
      true
    );
    assert.equal(OWNER_DRAFT.startTime, "13:00");
    assert.equal(OWNER_DRAFT.endTime, "17:00");
    assert.deepEqual(OWNER_DRAFT.courtIds, ["tt412-court-01", "tt412-court-02"]);
    const hydrated = hydrateCourtScheduleDraft(null, "2026-08-14");
    assert.equal(hydrated.date, "2026-08-14");
    await delay(500);
    assert.equal(timerFired, 1);
  });

  it("D. clean local + historical redundant timer is cancelled; no extra version bump", async () => {
    const tournament = await createOfficialTournament();
    assert.equal(isClubDataDirty(CLUB_ID), false);
    let timerFired = 0;
    __armPendingClubCloudPushForTests(CLUB_ID, {
      delayMs: 400,
      onFire: () => {
        timerFired += 1;
      },
    });
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].expectedVersion, 7);
    assert.equal(hasPendingClubCloudPush(CLUB_ID), false);
    await delay(1600);
    assert.equal(timerFired, 0);
    assert.equal(pushes.length, 1);
    assert.equal(getClubCloudVersion(CLUB_ID), 8);
    assert.equal(isClubDataDirty(CLUB_ID), false);
    assert.equal(
      loadClubData(CLUB_ID).players.some((player) => player.id === "cloud-player-v7"),
      true
    );
  });

  it("E. remote V7 / local V3 clean state uses snapshot expectedVersion=7", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    assert.equal(getClubCloudVersion(CLUB_ID), 3);
    assert.equal(isClubDataDirty(CLUB_ID), false);
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    assert.equal(pushes[0].expectedVersion, 7);
    assert.notEqual(pushes[0].expectedVersion, 3);
  });

  it("J. success clears dirty; K. failed push does not mark synced", async () => {
    const tournament = await createOfficialTournament();
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    const success = await lockOwnerDraft(tournament, { remote });
    assert.equal(success.result.ok, true, success.result.error);
    assert.equal(isClubDataDirty(CLUB_ID), false);

    const second = await createOfficialTournament();
    const failRemote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    markClubDataSynced(CLUB_ID, { pull: true });
    const failed = await lockOwnerDraft(second, {
      remote: failRemote,
      syncClubToCloud: async () => ({ ok: false, error: "cloud push failed" }),
    });
    assert.equal(failed.result.ok, false);
    assert.equal(failed.result.code, COURT_LOCK_CODE.BOOKING_PUSH_FAILED);
    assert.equal(isClubDataDirty(CLUB_ID), true);
  });

  it("L. source contract: cloud-source skip, dirty check before staging, no data-loss flush", () => {
    const storage = src("src/domain/clubStorage.js");
    const command = src("src/features/tournament/services/tournamentCommands.js");
    const push = src("src/ai/clubCloudPush.js");
    assert.match(storage, /options\.source !== "cloud"/);
    assert.match(storage, /shouldScheduleCloudPush/);
    const providedStart = command.indexOf("if (courtsProvided)");
    const snapshotRead = command.indexOf("readCanonicalClubCourtBookingSnapshot", providedStart);
    const dirtyIdx = command.indexOf("isClubDataDirty", providedStart);
    const stageIdx = command.indexOf("syncTournamentCourtBookings", providedStart);
    assert.ok(dirtyIdx > providedStart && dirtyIdx < snapshotRead);
    assert.ok(dirtyIdx < stageIdx);
    assert.match(command, /CLUB_LOCAL_DIRTY_PENDING_SYNC/);
    assert.match(command, /cancelRedundantClubCloudPush/);
    assert.doesNotMatch(command, /flushClubCloudPushForTests/);
    assert.match(push, /cancelRedundantClubCloudPush/);
    assert.doesNotMatch(command, /from ["'].*daily-play/);
  });
});

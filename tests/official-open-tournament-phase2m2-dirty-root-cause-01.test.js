/**
 * Phase 2M.2 — dirty-state root cause: hydration / abandoned Official persist / stale flag.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";

import { hydrateCourtScheduleDraft } from "../src/components/tournament/tournamentCourtScheduleDraft.js";
import { buildTournamentBookingId } from "../src/domain/tournamentBookingService.js";
import { diffClubBlobSemantic } from "../src/domain/clubBlobSemanticDiff.js";
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
    __setTournamentRepositoryRpcForTests(memory.rpc);
  });

  afterEach(() => {
    __resetClubCloudPushScheduleCountForTests();
    __resetTournamentRepositorySingleton();
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

  it("C. abandoned Official bookings + stale dirty flag → lock succeeds", async () => {
    const tournament = await createOfficialTournament();
    const hydrated = loadClubData(CLUB_ID);
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
    saveClubData(CLUB_ID, { ...hydrated, bookings: [leftover] });
    assert.equal(isClubDataDirty(CLUB_ID), true);
    const remoteClub = { ...hydrated, bookings: [] };
    assert.deepEqual(diffClubBlobSemantic(loadClubData(CLUB_ID), remoteClub), ["bookings"]);

    const remote = {
      version: 7,
      courts: remoteClub.courts,
      bookings: remoteClub.bookings || [],
      clubData: remoteClub,
    };
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].expectedVersion, 7);
    assert.equal(isClubDataDirty(CLUB_ID), false);
  });

  it("D. stale dirty with equal local/cloud content is cleared at snapshot reconcile, not by janitor-only", async () => {
    const tournament = await createOfficialTournament();
    const remoteClub = loadClubData(CLUB_ID);
    markClubDataDirty(CLUB_ID, { reason: "stale-flag", operation: "rewind" });
    assert.equal(isClubDataDirty(CLUB_ID), true);
    assert.deepEqual(diffClubBlobSemantic(loadClubData(CLUB_ID), remoteClub), []);

    const remote = {
      version: 7,
      courts: remoteClub.courts,
      bookings: remoteClub.bookings || [],
      clubData: remoteClub,
    };
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    assert.equal(pushes.length, 1);
    assert.equal(isClubDataDirty(CLUB_ID), false);
  });

  it("E. normal Group Stage draft does not dirty; lock uses snapshot version", async () => {
    const tournament = await createOfficialTournament();
    assert.equal(isClubDataDirty(CLUB_ID), false);
    const draft = { ...OWNER_DRAFT, startTime: "13:00", endTime: "17:00" };
    assert.equal(draft.startTime, "13:00");
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
    const f5 = hydrateCourtScheduleDraft(result.tournament.courtSchedule, "2026-08-14");
    assert.equal(f5.startTime, "13:00");
    assert.equal(f5.endTime, "17:00");
  });

  it("F. real unsynced customers behind cloud version fail closed and keep local value", async () => {
    const tournament = await createOfficialTournament();
    setClubCloudVersion(CLUB_ID, 3);
    saveClubData(CLUB_ID, {
      ...loadClubData(CLUB_ID),
      customers: [{ id: "local-unsynced-customer", name: "LOCAL_NEW_VALUE" }],
    });
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, false);
    assert.equal(result.code, COURT_LOCK_CODE.LOCAL_DIRTY_PENDING_SYNC);
    assert.equal(pushes.length, 0);
    assert.equal(isClubDataDirty(CLUB_ID), true);
    assert.equal(
      loadClubData(CLUB_ID).customers.some((c) => c.id === "local-unsynced-customer"),
      true
    );
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
    assert.match(storage, /saveClubData\(clubId, next, options\)/);
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 0);
  });

  it("H. real unsynced at same version flushes then court-locks", async () => {
    const tournament = await createOfficialTournament();
    saveClubData(CLUB_ID, {
      ...loadClubData(CLUB_ID),
      customers: [{ id: "local-unsynced-customer", name: "LOCAL_NEW_VALUE" }],
    });
    assert.equal(isClubDataDirty(CLUB_ID), true);
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    assert.equal(pushes.length, 2);
    assert.equal(pushes[0].expectedVersion, 7);
    assert.equal(pushes[1].expectedVersion, 8);
    assert.equal(
      loadClubData(CLUB_ID).customers.some((c) => c.id === "local-unsynced-customer"),
      true
    );
    assert.equal(isClubDataDirty(CLUB_ID), false);
  });

  it("I. failed prelock flush keeps dirty; no booking write; no tournament patch", async () => {
    const tournament = await createOfficialTournament();
    saveClubData(CLUB_ID, {
      ...loadClubData(CLUB_ID),
      customers: [{ id: "local-unsynced-customer", name: "LOCAL_NEW_VALUE" }],
    });
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: freshRemoteClubData(),
    };
    const { result, pushes } = await lockOwnerDraft(tournament, {
      remote,
      syncClubToCloud: async () => ({
        ok: false,
        code: "SYNC_UNAVAILABLE",
        error: "sync failed",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, COURT_LOCK_CODE.LOCAL_DIRTY_PENDING_SYNC);
    assert.equal(result.tournamentPatchAttempted, false);
    assert.equal(pushes.length, 1);
    assert.equal(isClubDataDirty(CLUB_ID), true);
    assert.equal(
      (loadClubData(CLUB_ID).bookings || []).some((b) => b.bookingType === "tournament"),
      false
    );
    assert.equal(
      loadClubData(CLUB_ID).customers.some((c) => c.id === "local-unsynced-customer"),
      true
    );
  });
});

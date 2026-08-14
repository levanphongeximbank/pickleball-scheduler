/**
 * Phase 2M.3 — local-vs-cloud semantic diff: defaults/missing vs real pending mutation.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  ARRAY_ORDER_SEMANTIC_MATRIX,
  diffClubBlobSemantic,
  inspectClubBlobSemanticDiff,
  summarizeClubBlobField,
} from "../src/domain/clubBlobSemanticDiff.js";
import { reconcileStaleClubDirtyWithSnapshot } from "../src/domain/clubDirtyReconcile.js";
import { buildTournamentBookingId } from "../src/domain/tournamentBookingService.js";
import { loadClubData, saveClubData, setClubCloudVersion } from "../src/domain/clubStorage.js";
import {
  isClubDataDirty,
  markClubDataDirty,
  markClubDataSynced,
} from "../src/domain/clubSyncMetadata.js";
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
    clubId: CLUB_ID,
    tenantId: TENANT_ID,
  },
  {
    id: "tt412-court-02",
    name: "TT412 Sân 2",
    number: 2,
    active: true,
    clubId: CLUB_ID,
    tenantId: TENANT_ID,
  },
];

function rawCloudBlob(overrides = {}) {
  return {
    schemaVersion: 3.5,
    clubId: CLUB_ID,
    players: [{ id: "cloud-player-v7", name: "Cloud Player V7" }],
    customers: [{ id: "cloud-customer-v7", name: "Cloud Customer V7" }],
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

const OWNER_DRAFT = {
  date: "2026-08-14",
  startTime: "13:00",
  endTime: "17:00",
  courtIds: ["tt412-court-01", "tt412-court-02"],
};

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
    }
  );
  return { result, pushes };
}

describe("official-open-tournament-phase2m3-semantic-diff-01", () => {
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
    __resetClubCloudPushScheduleCountForTests();
    __setTournamentRepositoryRpcForTests(
      createInMemoryCanonicalTournamentRpc({ tenantId: TENANT_ID }).rpc
    );
  });

  afterEach(() => {
    __resetClubCloudPushScheduleCountForTests();
    __resetTournamentRepositorySingleton();
  });

  it("A. undefined vs [] where domain equivalent → no pending diff", () => {
    const local = { seasons: [], leagues: [], founderPairingConstraints: [], skillLevelProposals: [] };
    const remote = {};
    assert.deepEqual(diffClubBlobSemantic(local, remote), []);
  });

  it("B. undefined vs {} where domain equivalent → no pending diff", () => {
    const local = { seasonStandings: {}, director: { lockedCourts: [], lockedPlayers: [] } };
    const remote = {};
    const inspected = inspectClubBlobSemanticDiff(local, remote);
    assert.equal(inspected.details.find((row) => row.path === "seasonStandings").normalizedEqual, true);
    assert.equal(inspected.realPendingPaths.includes("seasonStandings"), false);
    assert.equal(inspected.realPendingPaths.includes("director"), false);
  });

  it("C. true business difference → pending diff", () => {
    const local = { customers: [{ id: "local-1", name: "LOCAL_NEW_VALUE" }] };
    const remote = { customers: [{ id: "cloud-1", name: "Cloud" }] };
    assert.deepEqual(diffClubBlobSemantic(local, remote), ["customers"]);
  });

  it("D. order-insensitive collection reordered → no pending diff", () => {
    const local = { courts: [CANONICAL_COURTS[1], CANONICAL_COURTS[0]] };
    const remote = { courts: CANONICAL_COURTS };
    assert.equal(ARRAY_ORDER_SEMANTIC_MATRIX.courts, "identity-id-insensitive");
    assert.deepEqual(diffClubBlobSemantic(local, remote), []);
  });

  it("E. order-sensitive field reordered → pending diff", () => {
    const local = { founderPairingConstraints: [{ a: "first" }, { a: "second" }] };
    const remote = { founderPairingConstraints: [{ a: "second" }, { a: "first" }] };
    assert.equal(ARRAY_ORDER_SEMANTIC_MATRIX.founderPairingConstraints, "identity-id-else-order-sensitive");
    assert.deepEqual(diffClubBlobSemantic(local, remote), ["founderPairingConstraints"]);
  });

  it("F. stale cloud-authority local court stamps cannot overwrite remote", () => {
    const local = {
      courts: CANONICAL_COURTS.map((court) => ({
        ...court,
        status: "active",
        courtType: "outdoor",
        defaultHourlyRate: 0,
        note: "",
      })),
    };
    const remote = { courts: CANONICAL_COURTS };
    const courts = inspectClubBlobSemanticDiff(local, remote).details.find((row) => row.path === "courts");
    assert.equal(courts.normalizedEqual, true);
    assert.equal(courts.shouldBlockCourtLock, false);
    assert.deepEqual(diffClubBlobSemantic(local, remote), []);
  });

  it("G. real unsynced local customers stay blocking", () => {
    const local = { customers: [{ id: "local-unsynced-customer", name: "LOCAL_NEW_VALUE" }] };
    const remote = { customers: [{ id: "cloud-customer-v7", name: "Cloud Customer V7" }] };
    assert.deepEqual(diffClubBlobSemantic(local, remote), ["customers"]);
  });

  it("H. screenshot multi-field case: only leftover bookings are real pending", () => {
    saveClubData(CLUB_ID, rawCloudBlob(), { source: "cloud" });
    markClubDataSynced(CLUB_ID, { pull: true, version: 7 });
    const leftover = {
      id: "booking-abandoned-official",
      bookingType: "tournament",
      tournamentId: "t-screenshot",
      courtId: "tt412-court-01",
      date: "2026-08-14",
      startTime: "13:00",
      endTime: "17:00",
      bookingStatus: "confirmed",
    };
    saveClubData(CLUB_ID, { ...loadClubData(CLUB_ID), bookings: [leftover] });
    const local = loadClubData(CLUB_ID);
    const remote = rawCloudBlob();
    const inspected = inspectClubBlobSemanticDiff(local, remote);
    [
      "courts",
      "courtManagement",
      "seasons",
      "leagues",
      "founderPairingConstraints",
      "seasonStandings",
      "skillLevel",
      "skillLevelProposals",
      "skillLevelChangeRequests",
      "ai",
      "active",
      "director",
    ].forEach((path) => {
      const row = inspected.details.find((item) => item.path === path);
      assert.equal(row.shouldBlockCourtLock, false, `${path} ${row.classification}`);
      void summarizeClubBlobField(local, path);
      void summarizeClubBlobField(remote, path);
    });
    assert.deepEqual(inspected.realPendingPaths, ["bookings"]);
  });

  it("I. abandoned current Tournament booking cleanup preserves unrelated bookings", async () => {
    const tournament = await createOfficialTournament();
    saveClubData(CLUB_ID, rawCloudBlob(), { source: "cloud" });
    markClubDataSynced(CLUB_ID, { pull: true, version: 7 });
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
    const other = {
      id: "maintenance-keep",
      bookingType: "maintenance",
      courtId: "tt412-court-02",
      date: "2026-08-14",
      startTime: "08:00",
      endTime: "09:00",
      bookingStatus: "confirmed",
    };
    saveClubData(CLUB_ID, { ...loadClubData(CLUB_ID), bookings: [leftover, other] });
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [other],
      clubData: rawCloudBlob({ bookings: [other] }),
    };
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    assert.equal(pushes.length, 1);
    assert.equal(
      loadClubData(CLUB_ID).bookings.some((booking) => booking.id === "maintenance-keep"),
      true
    );
  });

  it("J. fresh hydrate does not dirty or echo-push", () => {
    __resetClubCloudPushScheduleCountForTests();
    saveClubData(CLUB_ID, rawCloudBlob(), { source: "cloud" });
    markClubDataSynced(CLUB_ID, { pull: true, version: 7 });
    assert.equal(isClubDataDirty(CLUB_ID), false);
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 0);
  });

  it("H2. screenshot lock: representation fields do not fail-close when local version is behind", async () => {
    const tournament = await createOfficialTournament();
    saveClubData(CLUB_ID, rawCloudBlob(), { source: "cloud" });
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
    setClubCloudVersion(CLUB_ID, 3);
    const inspected = inspectClubBlobSemanticDiff(loadClubData(CLUB_ID), rawCloudBlob());
    assert.deepEqual(inspected.realPendingPaths, ["bookings"]);
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: rawCloudBlob(),
    };
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, true, result.error);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].expectedVersion, 7);
    assert.equal(isClubDataDirty(CLUB_ID), false);
  });

  it("G2. real unsynced behind cloud still fail-closes and preserves the field", async () => {
    const tournament = await createOfficialTournament();
    saveClubData(CLUB_ID, rawCloudBlob(), { source: "cloud" });
    setClubCloudVersion(CLUB_ID, 3);
    saveClubData(CLUB_ID, {
      ...loadClubData(CLUB_ID),
      customers: [{ id: "local-unsynced-customer", name: "LOCAL_NEW_VALUE" }],
    });
    const remote = {
      version: 7,
      courts: CANONICAL_COURTS,
      bookings: [],
      clubData: rawCloudBlob(),
    };
    const { result, pushes } = await lockOwnerDraft(tournament, { remote });
    assert.equal(result.ok, false);
    assert.equal(result.code, COURT_LOCK_CODE.LOCAL_DIRTY_PENDING_SYNC);
    assert.match(result.error, /customers/);
    assert.doesNotMatch(result.error, /skillLevelProposals/);
    assert.equal(pushes.length, 0);
    assert.equal(
      loadClubData(CLUB_ID).customers.some((customer) => customer.id === "local-unsynced-customer"),
      true
    );
  });

  it("stale representation reconcile clears dirty without pushing", () => {
    saveClubData(CLUB_ID, rawCloudBlob(), { source: "cloud" });
    markClubDataDirty(CLUB_ID, { operation: "canonical-booking-persist" });
    const result = reconcileStaleClubDirtyWithSnapshot(CLUB_ID, rawCloudBlob());
    assert.equal(result.ok, true);
    assert.equal(isClubDataDirty(CLUB_ID), false);
    assert.equal(__getClubCloudPushScheduleCountForTests(CLUB_ID), 0);
  });
});

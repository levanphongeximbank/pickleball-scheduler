import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as foundation from "../src/features/player-rating/foundation/index.js";
import {
  PLAYER_RATING_FOUNDATION_ERROR_CODE,
  PLAYER_RATING_HISTORY_SNAPSHOT_PHASE,
  PLAYER_RATING_SOURCE_SCALE,
  PLAYER_RATING_SOURCE_TYPE,
  PLAYER_ID_RESOLUTION_STATUS,
  PlayerRatingFoundationError,
  appendRatingHistory,
  buildStoredHistoryEntry,
  createCurrentStateCandidate,
  createInMemoryRatingHistoryAdapter,
  createInMemoryRatingSnapshotAdapter,
  createRatingCurrentStateContract,
  createRatingSnapshot,
  getRatingHistoryByEventId,
  getRatingSnapshotById,
  listRatingHistory,
  listRatingSnapshots,
} from "../src/features/player-rating/foundation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_SNAPSHOT_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation/history-snapshot"
);
const FOUNDATION_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation"
);

const SCOPE = Object.freeze({ kind: "tenant", tenantId: "tenant-1" });
const SCOPE_OTHER = Object.freeze({ kind: "tenant", tenantId: "tenant-2" });
const T0 = "2026-07-20T00:00:00.000Z";
const T1 = "2026-07-21T00:00:00.000Z";
const T2 = "2026-07-22T00:00:00.000Z";
const T3 = "2026-07-23T00:00:00.000Z";

function expectCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof PlayerRatingFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

async function expectCodeAsync(fn, code) {
  await assert.rejects(fn, (err) => {
    assert.ok(err instanceof PlayerRatingFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

function readAllJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAllJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function baseHistory(overrides = {}) {
  return {
    eventId: "evt-1",
    playerId: "player-1",
    scope: SCOPE,
    eventType: "PLAYER_RATING_SELF_ASSESSED",
    beforeState: { status: "draft", ratingMode: "overall" },
    afterState: { status: "provisional", ratingMode: "overall", value: 3.5 },
    effectiveAt: T1,
    recordedAt: T2,
    ratingMode: "overall",
    ...overrides,
  };
}

test("foundation public exports include Phase 1D history/snapshot API", () => {
  const required = [
    "PLAYER_RATING_HISTORY_SNAPSHOT_PHASE",
    "appendRatingHistory",
    "createRatingSnapshot",
    "createInMemoryRatingHistoryAdapter",
    "createInMemoryRatingSnapshotAdapter",
    "compareHistoryEntriesAscending",
    "compareSnapshotsAscending",
    "listRatingHistory",
    "listRatingSnapshots",
  ];
  for (const name of required) {
    assert.ok(name in foundation, `missing export: ${name}`);
  }
  assert.equal(PLAYER_RATING_HISTORY_SNAPSHOT_PHASE.id, "1D");
  assert.equal(PLAYER_RATING_HISTORY_SNAPSHOT_PHASE.isProductionPersistence, false);
  assert.equal(PLAYER_RATING_HISTORY_SNAPSHOT_PHASE.convertsScales, false);
  assert.equal(PLAYER_RATING_HISTORY_SNAPSHOT_PHASE.selectsRuntimeSsot, false);
  assert.equal(PLAYER_RATING_HISTORY_SNAPSHOT_PHASE.mutatesCurrentRating, false);
  assert.equal(
    PLAYER_RATING_HISTORY_SNAPSHOT_PHASE.generatesIdsOrTimestamps,
    false
  );
});

test("history append and retrieve by eventId", async () => {
  const history = createInMemoryRatingHistoryAdapter();
  const entry = await history.appendHistoryEntry(baseHistory());
  assert.equal(entry.eventId, "evt-1");
  assert.equal(entry.playerId, "player-1");
  assert.deepEqual(entry.beforeState, {
    status: "draft",
    ratingMode: "overall",
  });
  assert.deepEqual(entry.afterState, {
    status: "provisional",
    ratingMode: "overall",
    value: 3.5,
  });
  assert.equal(entry.effectiveAt, T1);
  assert.equal(entry.recordedAt, T2);

  const found = await history.getHistoryEntry("evt-1");
  assert.equal(found.eventId, "evt-1");
});

test("history deterministic ascending order by effectiveAt, recordedAt, eventId", async () => {
  const history = createInMemoryRatingHistoryAdapter();
  await history.appendHistoryEntry(
    baseHistory({
      eventId: "evt-c",
      effectiveAt: T1,
      recordedAt: T3,
    })
  );
  await history.appendHistoryEntry(
    baseHistory({
      eventId: "evt-a",
      effectiveAt: T0,
      recordedAt: T1,
    })
  );
  await history.appendHistoryEntry(
    baseHistory({
      eventId: "evt-b",
      effectiveAt: T1,
      recordedAt: T2,
    })
  );
  await history.appendHistoryEntry(
    baseHistory({
      eventId: "evt-d",
      effectiveAt: T1,
      recordedAt: T3,
    })
  );

  const listed = await history.listHistory("player-1", SCOPE);
  assert.deepEqual(
    listed.map((e) => e.eventId),
    ["evt-a", "evt-b", "evt-c", "evt-d"]
  );
});

test("history filters by playerId, scope, and ratingMode", async () => {
  const history = createInMemoryRatingHistoryAdapter();
  await history.appendHistoryEntry(baseHistory({ eventId: "h1", ratingMode: "overall" }));
  await history.appendHistoryEntry(
    baseHistory({
      eventId: "h2",
      ratingMode: "singles",
      afterState: { status: "provisional", ratingMode: "singles" },
    })
  );
  await history.appendHistoryEntry(
    baseHistory({
      eventId: "h3",
      playerId: "player-2",
      ratingMode: "overall",
    })
  );
  await history.appendHistoryEntry(
    baseHistory({
      eventId: "h4",
      scope: SCOPE_OTHER,
      ratingMode: "overall",
    })
  );

  const byPlayer = await history.listHistory("player-1", SCOPE);
  assert.deepEqual(
    byPlayer.map((e) => e.eventId),
    ["h1", "h2"]
  );

  const singles = await history.listHistory("player-1", SCOPE, {
    ratingMode: "singles",
  });
  assert.deepEqual(
    singles.map((e) => e.eventId),
    ["h2"]
  );
});

test("history rejects duplicate eventId", async () => {
  const history = createInMemoryRatingHistoryAdapter();
  await history.appendHistoryEntry(baseHistory());
  await expectCodeAsync(
    () => history.appendHistoryEntry(baseHistory()),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_ENTRY_DUPLICATE
  );
});

test("history rejects update and delete mutations", async () => {
  const history = createInMemoryRatingHistoryAdapter();
  await history.appendHistoryEntry(baseHistory());
  await expectCodeAsync(
    () => history.updateHistoryEntry("evt-1", { afterState: {} }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_MUTATION_FORBIDDEN
  );
  await expectCodeAsync(
    () => history.deleteHistoryEntry("evt-1"),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_MUTATION_FORBIDDEN
  );
});

test("history rejects missing playerId and malformed scope", () => {
  expectCode(
    () =>
      buildStoredHistoryEntry(
        baseHistory({ playerId: "", eventId: "missing-player" })
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED
  );
  expectCode(
    () =>
      buildStoredHistoryEntry(
        baseHistory({
          eventId: "missing-scope",
          scope: null,
          tenantId: undefined,
        })
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED
  );
  expectCode(
    () =>
      buildStoredHistoryEntry(
        baseHistory({
          eventId: "bad-scope",
          scope: { kind: "tenant", tenantId: "" },
        })
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );
});

test("history results are deeply immutable and preserve caller ids/timestamps", async () => {
  const history = createInMemoryRatingHistoryAdapter();
  const entry = await history.appendHistoryEntry(
    baseHistory({
      eventId: "immutable-h",
      effectiveAt: T1,
      recordedAt: T2,
      afterState: { nested: { value: 1 } },
    })
  );
  assert.ok(Object.isFrozen(entry));
  assert.ok(Object.isFrozen(entry.afterState));
  assert.ok(Object.isFrozen(/** @type {any} */ (entry.afterState).nested));
  assert.throws(() => {
    /** @type {any} */ (entry).eventId = "mutated";
  });
  assert.throws(() => {
    /** @type {any} */ (entry.afterState).nested.value = 99;
  });
  assert.equal(entry.eventId, "immutable-h");
  assert.equal(entry.effectiveAt, T1);
  assert.equal(entry.recordedAt, T2);
});

test("history does not generate ids or timestamps", () => {
  const before = Date.now();
  expectCode(
    () =>
      buildStoredHistoryEntry({
        playerId: "player-1",
        scope: SCOPE,
        eventType: "PLAYER_RATING_SELF_ASSESSED",
        afterState: { status: "provisional" },
        effectiveAt: T1,
        recordedAt: T2,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );
  expectCode(
    () =>
      buildStoredHistoryEntry({
        eventId: "no-time",
        playerId: "player-1",
        scope: SCOPE,
        eventType: "PLAYER_RATING_SELF_ASSESSED",
        afterState: { status: "provisional" },
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );
  const after = Date.now();
  const store = { byEventId: new Map() };
  const entry = appendRatingHistory(
    store,
    baseHistory({ eventId: "supplied-only", effectiveAt: T0, recordedAt: T1 })
  );
  assert.equal(entry.eventId, "supplied-only");
  assert.equal(entry.effectiveAt, T0);
  assert.equal(entry.recordedAt, T1);
  assert.ok(!String(entry.eventId).includes(String(before)));
  assert.ok(!String(entry.eventId).includes(String(after)));
});

test("snapshot create and retrieve", async () => {
  const snapshots = createInMemoryRatingSnapshotAdapter();
  const snap = await snapshots.createSnapshot({
    snapshotId: "snap-1",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 3.5,
    sourceStateVersion: "state-v1",
    effectiveAt: T1,
    createdAt: T2,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0,
  });
  assert.equal(snap.snapshotId, "snap-1");
  assert.equal(snap.sourceScale, PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0);

  const found = await snapshots.getSnapshot("snap-1", SCOPE);
  assert.equal(found.snapshotId, "snap-1");
});

test("snapshot create from valid Phase 1B current state", async () => {
  const snapshots = createInMemoryRatingSnapshotAdapter();
  const currentState = createRatingCurrentStateContract({
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "doubles",
    selfAssessedRating: 3.0,
    provisionalRating: 3.2,
    verifiedRating: 3.5,
    status: "verified",
    source: "verification",
    effectiveAt: T1,
    algorithmVersion: "algo-1",
    lastEventId: "evt-last",
  });

  const snap = await snapshots.createSnapshot({
    snapshotId: "snap-from-state",
    createdAt: T2,
    currentState,
    sourceStateVersion: "from-last-event",
  });

  assert.equal(snap.playerId, "player-1");
  assert.equal(snap.ratingMode, "doubles");
  assert.equal(snap.sourceStateVersion, "from-last-event");
  assert.equal(snap.effectiveAt, T1);
  assert.equal(snap.createdAt, T2);
  assert.ok(snap.projectedState);
  assert.equal(
    /** @type {any} */ (snap.projectedState).verifiedRating,
    3.5
  );
  assert.equal(
    /** @type {any} */ (snap.projectedState).selfAssessedRating,
    3.0
  );
  assert.equal(snap.authoritativeForPublicPlayerRating, false);
  assert.ok(snap.sourceMetadata);
  assert.equal(/** @type {any} */ (snap.sourceMetadata).source, "verification");
});

test("snapshot create from valid Phase 1C candidate preserves scale without conversion", async () => {
  const snapshots = createInMemoryRatingSnapshotAdapter();
  const candidate = createCurrentStateCandidate({
    sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
    sourceRecordId: "v2-99",
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
    ratingMode: "overall",
    playerId: "player-1",
    playerIdResolutionStatus: PLAYER_ID_RESOLUTION_STATUS.RESOLVED,
    selfAssessedRating: 7.5,
    displayRating: 7.5,
    status: "provisional",
    effectiveAt: T1,
    scope: SCOPE,
    tenantId: "tenant-1",
    rawSourceMetadata: { originalScale: "1.0-8.0", note: "no-convert" },
    authoritativeForPublicPlayerRating: false,
  });

  const snap = await snapshots.createSnapshot({
    snapshotId: "snap-from-candidate",
    createdAt: T3,
    candidate,
  });

  assert.equal(
    snap.sourceScale,
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0
  );
  assert.notEqual(
    snap.sourceScale,
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0
  );
  assert.equal(
    /** @type {any} */ (snap.projectedState).selfAssessedRating,
    7.5
  );
  assert.equal(
    /** @type {any} */ (snap.sourceMetadata).originalScale,
    "1.0-8.0"
  );
  assert.equal(snap.sourceStateVersion, candidate.candidateId);
});

test("snapshot deterministic ascending order by effectiveAt, createdAt, snapshotId", async () => {
  const snapshots = createInMemoryRatingSnapshotAdapter();
  await snapshots.createSnapshot({
    snapshotId: "snap-c",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 1,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T3,
  });
  await snapshots.createSnapshot({
    snapshotId: "snap-a",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 1,
    sourceStateVersion: "v",
    effectiveAt: T0,
    createdAt: T1,
  });
  await snapshots.createSnapshot({
    snapshotId: "snap-b",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 1,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T2,
  });
  await snapshots.createSnapshot({
    snapshotId: "snap-d",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 1,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T3,
  });

  const listed = await snapshots.listSnapshots("player-1", SCOPE);
  assert.deepEqual(
    listed.map((s) => s.snapshotId),
    ["snap-a", "snap-b", "snap-c", "snap-d"]
  );
});

test("snapshot filters by playerId, scope, and ratingMode", async () => {
  const snapshots = createInMemoryRatingSnapshotAdapter();
  await snapshots.createSnapshot({
    snapshotId: "s1",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 1,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T1,
  });
  await snapshots.createSnapshot({
    snapshotId: "s2",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "singles",
    ratingValue: 2,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T2,
  });
  await snapshots.createSnapshot({
    snapshotId: "s3",
    playerId: "player-2",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 3,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T3,
  });
  await snapshots.createSnapshot({
    snapshotId: "s4",
    playerId: "player-1",
    scope: SCOPE_OTHER,
    ratingMode: "overall",
    ratingValue: 4,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T3,
  });

  const listed = await snapshots.listSnapshots("player-1", SCOPE);
  assert.deepEqual(
    listed.map((s) => s.snapshotId),
    ["s1", "s2"]
  );
  const singles = await snapshots.listSnapshots("player-1", SCOPE, {
    ratingMode: "singles",
  });
  assert.deepEqual(
    singles.map((s) => s.snapshotId),
    ["s2"]
  );
});

test("snapshot rejects duplicate snapshotId", async () => {
  const snapshots = createInMemoryRatingSnapshotAdapter();
  const payload = {
    snapshotId: "dup",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 1,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T1,
  };
  await snapshots.createSnapshot(payload);
  await expectCodeAsync(
    () => snapshots.createSnapshot(payload),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_DUPLICATE
  );
});

test("snapshot rejects update and delete mutations", async () => {
  const snapshots = createInMemoryRatingSnapshotAdapter();
  await snapshots.createSnapshot({
    snapshotId: "locked",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 1,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T1,
  });
  await expectCodeAsync(
    () => snapshots.updateSnapshot("locked", { ratingValue: 9 }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_MUTATION_FORBIDDEN
  );
  await expectCodeAsync(
    () => snapshots.deleteSnapshot("locked"),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_MUTATION_FORBIDDEN
  );
});

test("snapshot rejects missing canonical playerId and alias promotion", async () => {
  const snapshots = createInMemoryRatingSnapshotAdapter();
  await expectCodeAsync(
    () =>
      snapshots.createSnapshot({
        snapshotId: "no-player",
        scope: SCOPE,
        ratingMode: "overall",
        ratingValue: 1,
        sourceStateVersion: "v",
        effectiveAt: T1,
        createdAt: T1,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED
  );

  const aliasCandidate = createCurrentStateCandidate({
    sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
    sourceRecordId: "alias-1",
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
    ratingMode: "overall",
    playerId: null,
    playerIdResolutionStatus: PLAYER_ID_RESOLUTION_STATUS.ALIAS_ONLY,
    aliases: [{ kind: "auth_user_id", value: "auth-xyz" }],
    selfAssessedRating: 4,
    status: "provisional",
    effectiveAt: T1,
    scope: SCOPE,
  });

  await expectCodeAsync(
    () =>
      snapshots.createSnapshot({
        snapshotId: "alias-snap",
        createdAt: T2,
        candidate: aliasCandidate,
        scope: SCOPE,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED
  );

  await expectCodeAsync(
    () =>
      snapshots.createSnapshot({
        snapshotId: "alias-status",
        playerId: "auth-xyz",
        playerIdResolutionStatus: PLAYER_ID_RESOLUTION_STATUS.ALIAS_ONLY,
        scope: SCOPE,
        ratingMode: "overall",
        ratingValue: 1,
        sourceStateVersion: "v",
        effectiveAt: T1,
        createdAt: T1,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED
  );
});

test("snapshot results are deeply immutable and do not auto-select current rating", async () => {
  const snapshots = createInMemoryRatingSnapshotAdapter();
  const snap = await snapshots.createSnapshot({
    snapshotId: "imm-snap",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    projectedState: {
      selfAssessedRating: 2,
      provisionalRating: 3,
      verifiedRating: 4,
      nested: { keep: true },
    },
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T2,
  });
  assert.ok(Object.isFrozen(snap));
  assert.ok(Object.isFrozen(snap.projectedState));
  assert.ok(Object.isFrozen(/** @type {any} */ (snap.projectedState).nested));
  assert.throws(() => {
    /** @type {any} */ (snap).ratingValue = 99;
  });
  assert.equal(snap.authoritativeForPublicPlayerRating, false);
  assert.equal("ratingValue" in snap, false);
  assert.deepEqual(
    [
      /** @type {any} */ (snap.projectedState).selfAssessedRating,
      /** @type {any} */ (snap.projectedState).provisionalRating,
      /** @type {any} */ (snap.projectedState).verifiedRating,
    ],
    [2, 3, 4]
  );
});

test("snapshot does not generate ids or timestamps", async () => {
  const snapshots = createInMemoryRatingSnapshotAdapter();
  await expectCodeAsync(
    () =>
      snapshots.createSnapshot({
        playerId: "player-1",
        scope: SCOPE,
        ratingMode: "overall",
        ratingValue: 1,
        sourceStateVersion: "v",
        effectiveAt: T1,
        createdAt: T1,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );
  await expectCodeAsync(
    () =>
      snapshots.createSnapshot({
        snapshotId: "no-created-at",
        playerId: "player-1",
        scope: SCOPE,
        ratingMode: "overall",
        ratingValue: 1,
        sourceStateVersion: "v",
        effectiveAt: T1,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );

  const before = Date.now();
  const snap = await snapshots.createSnapshot({
    snapshotId: "caller-id",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 1,
    sourceStateVersion: "v",
    effectiveAt: T0,
    createdAt: T1,
  });
  const after = Date.now();
  assert.equal(snap.snapshotId, "caller-id");
  assert.equal(snap.effectiveAt, T0);
  assert.equal(snap.createdAt, T1);
  assert.ok(!String(snap.snapshotId).includes(String(before)));
  assert.ok(!String(snap.snapshotId).includes(String(after)));
});

test("in-memory adapter instances have isolated state", async () => {
  const h1 = createInMemoryRatingHistoryAdapter();
  const h2 = createInMemoryRatingHistoryAdapter();
  await h1.appendHistoryEntry(baseHistory({ eventId: "iso-h" }));
  const listed2 = await h2.listHistory("player-1", SCOPE);
  assert.equal(listed2.length, 0);
  await expectCodeAsync(
    () => h2.getHistoryEntry("iso-h"),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_ENTRY_NOT_FOUND
  );

  const s1 = createInMemoryRatingSnapshotAdapter();
  const s2 = createInMemoryRatingSnapshotAdapter();
  await s1.createSnapshot({
    snapshotId: "iso-s",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 1,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T1,
  });
  assert.equal((await s2.listSnapshots("player-1", SCOPE)).length, 0);
});

test("service helpers work against isolated stores", () => {
  const historyStore = { byEventId: new Map() };
  const snapshotStore = { bySnapshotId: new Map() };
  appendRatingHistory(historyStore, baseHistory({ eventId: "svc-h" }));
  assert.equal(getRatingHistoryByEventId(historyStore, "svc-h").eventId, "svc-h");
  assert.equal(listRatingHistory(historyStore, "player-1", SCOPE).length, 1);

  createRatingSnapshot(snapshotStore, {
    snapshotId: "svc-s",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 2,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T1,
  });
  assert.equal(getRatingSnapshotById(snapshotStore, "svc-s").snapshotId, "svc-s");
  assert.equal(listRatingSnapshots(snapshotStore, "player-1", SCOPE).length, 1);
});

test("history-snapshot has no Supabase, localStorage, Competition Engine, Ranking, or Club runtime imports", () => {
  const files = readAllJsFiles(HISTORY_SNAPSHOT_ROOT);
  assert.ok(files.length > 0);
  const forbidden = [
    "competition-core",
    "vpr-ranking",
    "features/club/",
    "@supabase",
    "supabase/",
    "localStorage",
    "pick-vn-rating-v5",
    "pick-vn-rating/",
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert.ok(
        !text.includes(needle),
        `${path.relative(FOUNDATION_ROOT, file)} contains forbidden marker: ${needle}`
      );
    }
    assert.ok(
      !/\bDate\.now\s*\(/.test(text),
      `${path.relative(FOUNDATION_ROOT, file)} uses Date.now()`
    );
    assert.ok(
      !/\bMath\.random\s*\(/.test(text),
      `${path.relative(FOUNDATION_ROOT, file)} uses Math.random()`
    );
    assert.ok(
      !/randomUUID|crypto\.random/.test(text),
      `${path.relative(FOUNDATION_ROOT, file)} generates random ids`
    );
  }
});

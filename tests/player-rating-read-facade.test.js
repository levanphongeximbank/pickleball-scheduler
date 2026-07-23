import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as foundation from "../src/features/player-rating/foundation/index.js";
import {
  PLAYER_RATING_FOUNDATION_ERROR_CODE,
  PLAYER_RATING_READ_FACADE_PHASE,
  PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS,
  PLAYER_RATING_READ_MODEL_ERROR_CODE,
  PLAYER_RATING_SOURCE_SCALE,
  PLAYER_RATING_SOURCE_TYPE,
  PlayerRatingFoundationError,
  createInMemoryRatingHistoryAdapter,
  createInMemoryRatingSnapshotAdapter,
  createPlayerRatingReadFacade,
} from "../src/features/player-rating/foundation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const READ_FACADE_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation/read-facade"
);
const FOUNDATION_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation"
);

const SCOPE = Object.freeze({ kind: "tenant", tenantId: "tenant-1" });
const FIXED_AT = "2026-07-23T08:00:00.000Z";
const T0 = "2026-07-20T00:00:00.000Z";
const T1 = "2026-07-21T00:00:00.000Z";
const T2 = "2026-07-22T00:00:00.000Z";

const READ_METHODS = Object.freeze([
  "collectCandidates",
  "getCandidate",
  "listCandidates",
  "listHistory",
  "getHistoryEntry",
  "listSnapshots",
  "getSnapshot",
  "getPlayerRatingOverview",
]);

const FORBIDDEN_WRITE_METHODS = Object.freeze([
  "verify",
  "adjust",
  "update",
  "save",
  "append",
  "createSnapshot",
  "delete",
  "applyResult",
  "reverseResult",
  "appendHistoryEntry",
  "verifyPlayerRating",
  "adjustPlayerRating",
]);

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

function createFacade() {
  return createPlayerRatingReadFacade({
    historyPort: createInMemoryRatingHistoryAdapter(),
    snapshotPort: createInMemoryRatingSnapshotAdapter(),
  });
}

function v2Source(overrides = {}) {
  const { record: recordOverrides, ...rest } = overrides;
  return {
    sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
    canonicalPlayerId: "player-1",
    record: {
      id: "v2-1",
      auth_user_id: "auth-abc",
      self_declared_rating: 4.5,
      provisional_rating: 4.0,
      verified_rating: 5.0,
      current_rating: 5.0,
      rating_status: "provisional",
      last_rating_updated_at: FIXED_AT,
      ...recordOverrides,
    },
    ...rest,
  };
}

function v5Source(overrides = {}) {
  const { record: recordOverrides, ...rest } = overrides;
  return {
    sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5,
    canonicalPlayerId: "player-1",
    record: {
      id: "v5-1",
      tenant_id: "tenant-1",
      player_id: "11111111-1111-1111-1111-111111111111",
      rating_mode: "overall",
      provisional_rating: 3.25,
      open_rating_mean: 3.4,
      verified_rating_mean: 3.6,
      display_rating: 3.6,
      rating_status: "provisional",
      last_rated_at: FIXED_AT,
      ...recordOverrides,
    },
    ...rest,
  };
}

function legacySource(overrides = {}) {
  const { record: recordOverrides, ...rest } = overrides;
  return {
    sourceType: PLAYER_RATING_SOURCE_TYPE.LEGACY_ASSESSMENT,
    canonicalPlayerId: "player-1",
    record: {
      id: "legacy-1",
      playerId: "player-1",
      skillLevel: 4.0,
      assessedAt: FIXED_AT,
      ...recordOverrides,
    },
    ...rest,
  };
}

async function seedHistoryAndSnapshots(historyPort, snapshotPort) {
  await historyPort.appendHistoryEntry({
    eventId: "evt-b",
    playerId: "player-1",
    scope: SCOPE,
    eventType: "PLAYER_RATING_SELF_ASSESSED",
    beforeState: { status: "draft", ratingMode: "overall" },
    afterState: { status: "provisional", ratingMode: "overall", value: 3.5 },
    effectiveAt: T1,
    recordedAt: T2,
    ratingMode: "overall",
  });
  await historyPort.appendHistoryEntry({
    eventId: "evt-a",
    playerId: "player-1",
    scope: SCOPE,
    eventType: "PLAYER_RATING_VERIFIED",
    beforeState: { status: "provisional", ratingMode: "overall", value: 3.5 },
    afterState: { status: "verified", ratingMode: "overall", value: 4.0 },
    effectiveAt: T0,
    recordedAt: T1,
    ratingMode: "overall",
  });

  await snapshotPort.createSnapshot({
    snapshotId: "snap-b",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 4.0,
    sourceStateVersion: "v",
    effectiveAt: T2,
    createdAt: T2,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
  });
  await snapshotPort.createSnapshot({
    snapshotId: "snap-a",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 3.5,
    sourceStateVersion: "v",
    effectiveAt: T0,
    createdAt: T0,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
  });
}

test("foundation public exports include the read facade", () => {
  const required = [
    "PLAYER_RATING_READ_FACADE_PHASE",
    "PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS",
    "createPlayerRatingReadFacade",
    "buildPlayerRatingOverview",
  ];
  for (const name of required) {
    assert.ok(name in foundation, `missing export: ${name}`);
  }
  assert.equal(PLAYER_RATING_READ_FACADE_PHASE.id, "1H");
  assert.equal(PLAYER_RATING_READ_FACADE_PHASE.exposesWriteApi, false);
  assert.equal(PLAYER_RATING_READ_FACADE_PHASE.selectsPreferredCandidate, false);
  assert.equal(PLAYER_RATING_READ_FACADE_PHASE.convertsScales, false);
  assert.equal(PLAYER_RATING_READ_FACADE_PHASE.selectsRuntimeSsot, false);
  assert.equal(PLAYER_RATING_READ_FACADE_PHASE.generatesIdsOrTimestamps, false);
});

test("facade exposes read methods only and no write methods", () => {
  const facade = createFacade();
  for (const name of READ_METHODS) {
    assert.equal(typeof facade[name], "function", `missing read method: ${name}`);
  }
  for (const name of FORBIDDEN_WRITE_METHODS) {
    assert.equal(facade[name], undefined, `write method exposed: ${name}`);
  }
  assert.deepEqual(Object.keys(facade).sort(), [...READ_METHODS].sort());
});

test("V2, V5, and legacy candidate collection are preserved without winner or conversion", () => {
  const facade = createFacade();
  const collection = facade.collectCandidates(
    [v2Source(), v5Source(), legacySource()],
    { scope: SCOPE }
  );

  assert.equal(collection.candidates.length, 3);
  assert.equal(collection.candidateCount ?? collection.candidates.length, 3);
  const types = collection.candidates.map((c) => c.sourceType).sort();
  assert.deepEqual(types, [
    PLAYER_RATING_SOURCE_TYPE.LEGACY_ASSESSMENT,
    PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
    PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5,
  ].sort());

  const scales = new Set(collection.candidates.map((c) => c.sourceScale));
  assert.ok(scales.has(PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0));
  assert.ok(scales.has(PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0));
  assert.equal(collection.scaleConflicts.length, 1);
  assert.equal("preferredCandidate" in collection, false);
  assert.equal("authoritativeRating" in collection, false);
  assert.equal("displayRating" in collection, false);
});

test("listCandidates and getCandidate preserve deterministic ordering and no auto-winner", () => {
  const facade = createFacade();
  const sourcesAsc = [v2Source(), v5Source({ record: { id: "v5-z" } }), legacySource()];
  const sourcesDesc = [...sourcesAsc].reverse();

  const a = facade.listCandidates(sourcesAsc, { scope: SCOPE });
  const b = facade.listCandidates(sourcesDesc, { scope: SCOPE });
  assert.deepEqual(
    a.map((c) => c.candidateId),
    b.map((c) => c.candidateId)
  );

  const mid = a[1];
  const found = facade.getCandidate(mid.candidateId, sourcesDesc, { scope: SCOPE });
  assert.equal(found.candidateId, mid.candidateId);
  assert.equal(found.sourceScale, mid.sourceScale);
  assert.equal(facade.getCandidate("missing-id", sourcesAsc, { scope: SCOPE }), null);
});

test("history and snapshot ordering preserved through facade", async () => {
  const historyPort = createInMemoryRatingHistoryAdapter();
  const snapshotPort = createInMemoryRatingSnapshotAdapter();
  await seedHistoryAndSnapshots(historyPort, snapshotPort);
  const facade = createPlayerRatingReadFacade({ historyPort, snapshotPort });

  const history = await facade.listHistory({
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
  });
  assert.deepEqual(
    history.map((e) => e.eventId),
    ["evt-a", "evt-b"]
  );
  const entry = await facade.getHistoryEntry("evt-a");
  assert.equal(entry.eventId, "evt-a");

  const snapshots = await facade.listSnapshots({
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
  });
  assert.deepEqual(
    snapshots.map((s) => s.snapshotId),
    ["snap-a", "snap-b"]
  );
  const snap = await facade.getSnapshot("snap-a");
  assert.equal(snap.snapshotId, "snap-a");
});

test("overview counts, source summary, conflicts, and rejected records are visible", async () => {
  const historyPort = createInMemoryRatingHistoryAdapter();
  const snapshotPort = createInMemoryRatingSnapshotAdapter();
  await seedHistoryAndSnapshots(historyPort, snapshotPort);
  const facade = createPlayerRatingReadFacade({ historyPort, snapshotPort });

  const overview = await facade.getPlayerRatingOverview({
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    sourceRecords: [
      v2Source(),
      v5Source({ record: { rating_mode: "doubles" } }),
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.COMPETITION_ELO_SIGNAL,
        record: { elo: 1500 },
      },
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
        canonicalPlayerId: "player-1",
        record: { id: "bad", current_rating: "not-a-number" },
      },
    ],
  });

  assert.equal(overview.playerId, "player-1");
  assert.equal(overview.candidateCount, overview.candidates.length);
  assert.equal(overview.historyCount, 2);
  assert.equal(overview.snapshotCount, 2);
  assert.ok(overview.candidateCount >= 2);
  assert.ok(overview.sourceSummary[PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2] >= 1);
  assert.ok(overview.sourceSummary[PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5] >= 1);
  assert.ok(overview.scaleConflicts.length >= 1);
  assert.ok(overview.modeConflicts.length >= 1);
  assert.ok(overview.rejectedRecords.length >= 1);
  assert.ok(
    overview.rejectedRecords.some(
      (r) =>
        r.reason === "NON_AUTHORITATIVE_SIGNAL_NOT_PUBLIC_PLAYER_RATING" ||
        r.reason === "NORMALIZATION_FAILED"
    )
  );
  assert.equal(
    overview.availabilityStatus,
    PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS.PARTIAL_DATA
  );
  assert.equal("preferredCandidate" in overview, false);
  assert.equal("authoritativeRating" in overview, false);
});

test("identity conflict is visible when fail-closed is disabled", async () => {
  const facade = createFacade();
  const overview = await facade.getPlayerRatingOverview({
    playerId: "player-1",
    scope: SCOPE,
    failClosedOnIdentityConflict: false,
    sourceRecords: [
      v2Source({ canonicalPlayerId: "player-1" }),
      v5Source({ canonicalPlayerId: "player-2" }),
    ],
  });
  assert.ok(overview.identityConflicts.length >= 1);
  assert.equal(
    overview.availabilityStatus,
    PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS.IDENTITY_CONFLICT
  );
});

test("identity conflict fails closed by default", async () => {
  const facade = createFacade();
  await expectCodeAsync(
    () =>
      facade.getPlayerRatingOverview({
        playerId: "player-1",
        scope: SCOPE,
        sourceRecords: [
          v2Source({ canonicalPlayerId: "player-1" }),
          v5Source({ canonicalPlayerId: "player-2" }),
        ],
      }),
    PLAYER_RATING_READ_MODEL_ERROR_CODE.CANONICAL_PLAYER_ID_CONFLICT
  );
});

test("missing rating data and partial data statuses", async () => {
  const facade = createFacade();
  const empty = await facade.getPlayerRatingOverview({
    playerId: "player-1",
    scope: SCOPE,
    sourceRecords: [],
  });
  assert.equal(
    empty.availabilityStatus,
    PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS.NO_RATING_DATA
  );
  assert.equal(empty.candidateCount, 0);
  assert.equal(empty.historyCount, 0);
  assert.equal(empty.snapshotCount, 0);

  const historyPort = createInMemoryRatingHistoryAdapter();
  const snapshotPort = createInMemoryRatingSnapshotAdapter();
  await historyPort.appendHistoryEntry({
    eventId: "evt-only",
    playerId: "player-1",
    scope: SCOPE,
    eventType: "PLAYER_RATING_SELF_ASSESSED",
    afterState: { status: "provisional", ratingMode: "overall", value: 3.5 },
    effectiveAt: T1,
    recordedAt: T2,
    ratingMode: "overall",
  });
  const facade2 = createPlayerRatingReadFacade({ historyPort, snapshotPort });
  const partial = await facade2.getPlayerRatingOverview({
    playerId: "player-1",
    scope: SCOPE,
    sourceRecords: [],
  });
  assert.equal(
    partial.availabilityStatus,
    PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS.PARTIAL_DATA
  );
});

test("missing scope and unsupported mode are rejected", async () => {
  const facade = createFacade();
  expectCode(
    () => facade.collectCandidates([v2Source()], {}),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED
  );
  await expectCodeAsync(
    () =>
      facade.getPlayerRatingOverview({
        playerId: "player-1",
        sourceRecords: [v2Source()],
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED
  );
  await expectCodeAsync(
    () =>
      facade.listHistory({
        playerId: "player-1",
        scope: SCOPE,
        ratingMode: "mixed_doubles",
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNSUPPORTED_RATING_MODE
  );
  await expectCodeAsync(
    () =>
      facade.getPlayerRatingOverview({
        playerId: "player-1",
        scope: SCOPE,
        ratingMode: "team",
        sourceRecords: [],
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNSUPPORTED_RATING_MODE
  );
});

test("overview output is immutable and does not generate IDs or timestamps", async () => {
  const facade = createFacade();
  const overview = await facade.getPlayerRatingOverview({
    playerId: "player-1",
    scope: SCOPE,
    sourceRecords: [v2Source()],
  });

  assert.ok(Object.isFrozen(overview));
  assert.ok(Object.isFrozen(overview.candidates));
  assert.ok(Object.isFrozen(overview.history));
  assert.ok(Object.isFrozen(overview.snapshots));
  assert.throws(() => {
    /** @type {any} */ (overview).candidateCount = 99;
  });
  assert.throws(() => {
    /** @type {any} */ (overview.candidates).push({});
  });

  const json = JSON.stringify(overview);
  assert.equal(json.includes("Date.now"), false);
  assert.equal("generatedAt" in overview, false);
  assert.equal("createdAt" in overview, false);
  assert.equal("id" in overview, false);
  assert.equal(typeof overview.playerId, "string");
  assert.equal(overview.playerId, "player-1");
});

test("available status when clean candidates exist without conflicts or rejections", async () => {
  const facade = createFacade();
  const overview = await facade.getPlayerRatingOverview({
    playerId: "player-1",
    scope: SCOPE,
    sourceRecords: [
      v2Source(),
      v2Source({
        record: {
          id: "v2-2",
          current_rating: 5.1,
          last_rating_updated_at: FIXED_AT,
        },
      }),
    ],
  });
  assert.equal(overview.scaleConflicts.length, 0);
  assert.equal(overview.modeConflicts.length, 0);
  assert.equal(overview.rejectedRecords.length, 0);
  assert.ok(overview.candidateCount >= 1);
  assert.equal(
    overview.availabilityStatus,
    PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS.AVAILABLE
  );
});

test("read facade has no forbidden runtime imports", () => {
  const files = readAllJsFiles(READ_FACADE_ROOT);
  assert.ok(files.length >= 4);
  const forbidden = [
    /from\s+['"][^'"]*supabase[^'"]*['"]/i,
    /require\(['"][^'"]*supabase[^'"]*['"]\)/i,
    /from\s+['"][^'"]*competition-core[^'"]*['"]/,
    /from\s+['"][^'"]*vpr-ranking[^'"]*['"]/,
    /from\s+['"][^'"]*features\/club[^'"]*['"]/,
    /from\s+['"][^'"]*features\/player\/[^'"]*['"]/,
    /from\s+['"][^'"]*pages\/[^'"]*['"]/,
    /from\s+['"]@mui\//,
    /localStorage/,
    /Date\.now\s*\(/,
    /Math\.random\s*\(/,
    /crypto\.randomUUID/,
  ];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(
        pattern.test(src),
        false,
        `${path.relative(FOUNDATION_ROOT, file)} matched ${pattern}`
      );
    }
  }
});

test("factory rejects ports missing required read operations", () => {
  expectCode(
    () =>
      createPlayerRatingReadFacade({
        historyPort: { listHistory: async () => [] },
        snapshotPort: createInMemoryRatingSnapshotAdapter(),
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  expectCode(
    () =>
      createPlayerRatingReadFacade({
        historyPort: createInMemoryRatingHistoryAdapter(),
        snapshotPort: { getSnapshot: async () => null },
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
});

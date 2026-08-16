/**
 * Batch 7 — Competition / Daily Play live projection + court engine ownership.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  __resetCanonicalCourtLiveRuntimeForTests,
  __setCanonicalCourtLiveRuntimeForTests,
  COURT_OCCUPANCY_STATE,
  COURT_LIVE_RUNTIME_MATCH_LIFECYCLE_AUTHORITY,
  COURT_LIVE_RUNTIME_SCORING_AUTHORITY,
} from "../src/features/court-resource/constants/canonicalLiveRuntime.js";
import {
  __resetCanonicalLiveRuntimeRpcClientForTests,
  __setCanonicalLiveRuntimeRpcClientForTests,
} from "../src/features/court-resource/services/canonicalLiveRuntimeClient.js";
import {
  projectCompetitionMatchLiveBegin,
  projectCompetitionMatchLiveEnd,
  COMPETITION_LIVE_INTEGRATION_MODEL,
} from "../src/features/court-resource/projections/courtLiveResourceUseProjection.js";
import { getCourtLiveState } from "../src/features/court-resource/services/courtOperationsLiveRuntimeApplication.js";
import {
  createIsolatedDailyPlayCourtOrchestrator,
  DAILY_PLAY_LEASE_IS_CAPACITY_SSOT,
  DAILY_PLAY_LEASE_IS_PROJECTION,
} from "../src/features/competition-engine/integration/court-adapters/index.js";
import { createCanonicalLiveRuntimeFakeStore } from "./helpers/canonicalLiveRuntimeFakeStore.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COURT_A = "11111111-1111-4111-8111-111111111111";
const HEAD_A_CONTRACT_SHA256 =
  "B9F7FE3F36786383A7A1C2027E5D1B93D4917BA9365CA98F88DE96529C4C6B1C";
const CERTIFIED_D4 = {
  "01_PRECHECK.sql": "5C5DF3B7B6C63AF3DA3C25A85A5A2C9CDE09938CA0B29BF035D0EE677A978D09",
  "02_APPLY.sql": "C2C998F3D0BDAEB605AB004E231FFE3AFCE45E2EB6278509BE3F284E68BBE986",
  "03_VERIFY.sql": "93678A8EE2F8DF0F66D4ADAA0E8A5E2F0EBD17034C0473D69AE0DBF992AC2845",
  "04_ROLLBACK.sql": "166F7B8105CCBE695AF584BB59FBC6D448A0DC37A26EDB9AEBAC8E029AEEFB9B",
};

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function sha256File(rel) {
  return createHash("sha256").update(readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n"), "utf8").digest("hex").toUpperCase();
}

function setup() {
  __setCanonicalCourtLiveRuntimeForTests(true);
  const store = createCanonicalLiveRuntimeFakeStore();
  __setCanonicalLiveRuntimeRpcClientForTests(store.rpcClient());
  return store;
}

function teardown() {
  __resetCanonicalLiveRuntimeRpcClientForTests();
  __resetCanonicalCourtLiveRuntimeForTests();
}

test("U Competition match start projection → Court Live occupancy updates", async () => {
  setup();
  try {
    const begun = await projectCompetitionMatchLiveBegin({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      matchId: "match-u-1",
      capacityClaimValid: true,
      requestId: "comp-begin-u",
      forceCanonical: true,
    });
    assert.equal(begun.ok, true);
    assert.equal(begun.occupancyState, COURT_OCCUPANCY_STATE.OCCUPIED);
    assert.equal(begun.activeSession.sourceType, "competition");
    assert.equal(begun.activeSession.sourceId, "match-u-1");
    assert.equal(begun.matchLifecycleMutated, false);
    assert.equal(begun.scoreMutated, false);
    assert.equal(begun.headABypassed, false);
  } finally {
    teardown();
  }
});

test("V Competition match end projection → occupancy clears", async () => {
  setup();
  try {
    await projectCompetitionMatchLiveBegin({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      matchId: "match-v-1",
      capacityClaimValid: true,
      requestId: "comp-begin-v",
      forceCanonical: true,
    });
    const ended = await projectCompetitionMatchLiveEnd({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      matchId: "match-v-1",
      requestId: "comp-end-v",
      forceCanonical: true,
    });
    assert.equal(ended.ok, true);
    assert.equal(ended.occupancyState, COURT_OCCUPANCY_STATE.FREE);
    assert.equal(ended.reservationReleased, false);
  } finally {
    teardown();
  }
});

test("W/X/Y Live Runtime never changes match lifecycle or score; opaque source only", async () => {
  assert.equal(COURT_LIVE_RUNTIME_MATCH_LIFECYCLE_AUTHORITY, "NO");
  assert.equal(COURT_LIVE_RUNTIME_SCORING_AUTHORITY, "NO");
  const liveApp = read(
    "src/features/court-resource/services/courtOperationsLiveRuntimeApplication.js"
  );
  assert.doesNotMatch(liveApp, /assignMatchCourt|MATCH_STATUS|scoreA|scoreB|winner/);
  const projection = read(
    "src/features/court-resource/projections/courtLiveResourceUseProjection.js"
  );
  assert.match(projection, /opaque/);
  assert.equal(COMPETITION_LIVE_INTEGRATION_MODEL, "GENERIC_LIVE_RESOURCE_USE_PROJECTION_ONE_WAY");
});

test("Z Competition capacity remains Adapter B → Head A; Head A unchanged", async () => {
  assert.equal(
    sha256File("src/features/competition-core/contracts/competitionCourtAdapterContract.js"),
    HEAD_A_CONTRACT_SHA256
  );
  const headA = read("src/features/competition-core/contracts/competitionCourtAdapterContract.js");
  assert.doesNotMatch(headA, /beginResourceSession|endResourceSession|occupancy/);
});

test("AA Daily Play live usage can project into Court Live Runtime", async () => {
  setup();
  try {
    const orch = createIsolatedDailyPlayCourtOrchestrator();
    const begun = await orch.beginLiveUseProjection({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      matchId: "dp-match-1",
      capacityClaimValid: true,
      requestId: "dp-live-begin",
      forceCanonical: true,
    });
    assert.equal(begun.ok, true);
    assert.equal(begun.occupancyState, COURT_OCCUPANCY_STATE.OCCUPIED);
    assert.equal(begun.activeSession.sourceType, "daily_play");
    const state = await getCourtLiveState({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      forceCanonical: true,
    });
    assert.equal(state.occupancyState, COURT_OCCUPANCY_STATE.OCCUPIED);
  } finally {
    teardown();
  }
});

test("AB/AC Daily Play lease remains projection; no double occupancy authority", async () => {
  assert.equal(DAILY_PLAY_LEASE_IS_CAPACITY_SSOT, false);
  assert.equal(DAILY_PLAY_LEASE_IS_PROJECTION, true);
  const orchSource = read(
    "src/features/competition-engine/integration/court-adapters/dailyPlayCourtOrchestrator.js"
  );
  assert.match(orchSource, /beginLiveUseProjection/);
  assert.match(orchSource, /Live Runtime is the canonical current occupancy authority/);
  assert.match(orchSource, /lease remains projection/i);
});

test("AD D4 certified SQL unchanged", () => {
  const dir = "docs/v5/migrations/court-resource-phase3b-daily-play-interval-authority-01";
  for (const [name, hash] of Object.entries(CERTIFIED_D4)) {
    assert.equal(sha256File(path.posix.join(dir, name)), hash, name);
  }
});

test("AE Daily Play Capacity remains Batch6 B→A path", async () => {
  const orchSource = read(
    "src/features/competition-engine/integration/court-adapters/dailyPlayCourtOrchestrator.js"
  );
  assert.match(orchSource, /adapter\.reserveCourts/);
  assert.doesNotMatch(orchSource, /court_resource_daily_play_acquire/);
});

test("Court Engine ownership split documented; legacy path retained", () => {
  const source = read("src/tournament/engines/courtEngine.js");
  assert.match(source, /LEGACY_COMPATIBILITY/);
  assert.match(source, /2\.2 Court Operations/);
  assert.match(source, /2\.13 Competition Engine/);
  assert.match(source, /assignMatchCourt/);
  assert.match(source, /currentMatchId/);
  assert.match(source, /COURT_ENGINE_OCCUPANCY_MATCH_LIFECYCLE_MIXED_ON_CANONICAL_PATH=NO/);
});

test("AJ legacy court.status not authority on canonical path", () => {
  const board = read("src/pages/courtManagement/CourtStatusBoard.jsx");
  assert.match(board, /isCanonicalCourtLiveRuntime/);
  assert.match(board, /setCurrentOperationalState/);
  // legacy retained only when canonical path unavailable
  assert.match(board, /setCourtOperationalStatus/);
});

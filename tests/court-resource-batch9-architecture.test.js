/**
 * Batch 9 — architecture locks for shared capacity / physicalCourtId domain.
 * Static only. Does not mutate Staging or Production.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { COMPETITION_COURT_ADAPTER_CAPABILITY, COMPETITION_COURT_ADAPTER_CONTRACT_VERSION } from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT,
  DAILY_PLAY_CAPACITY_AUTHORITY,
  DAILY_PLAY_LEASE_IS_CAPACITY_SSOT,
  DAILY_PLAY_LEASE_IS_PROJECTION,
  MODE_COURT_ADAPTER_B_OWNER,
} from "../src/features/competition-engine/integration/court-adapters/index.js";
import { CANONICAL_BOOKING_LIFECYCLE_DEFAULT } from "../src/features/court-resource/constants/canonicalBooking.js";
import { CANONICAL_COURT_LIVE_RUNTIME_DEFAULT } from "../src/features/court-resource/constants/canonicalLiveRuntime.js";
import {
  CANONICAL_OWNER_TYPE,
  CANONICAL_RESERVATION_CUTOVER_DEFAULT,
  CANONICAL_RESERVATION_TABLE,
} from "../src/features/court-resource/constants/canonicalReservation.js";
import { CANONICAL_RESOURCE_BLOCKS_DEFAULT } from "../src/features/court-resource/constants/canonicalResourceBlock.js";
import {
  CANONICAL_BOOKING_BUSINESS_TABLE,
  CANONICAL_RESOURCE_BLOCK_BUSINESS_TABLE,
  COURT_CLUSTERS_TENANT_SEMANTICS_EXPLICIT,
  COURT_CLUSTERS_VENUE_SEMANTICS_EXPLICIT,
  TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION,
} from "../src/features/court-resource/constants/courtOperationsOwnership.js";
import {
  CERTIFIED_PACKAGE_HASHES,
  HEAD_A_CONTRACT_SHA256,
  PKG,
} from "./helpers/court-resource-batch9-postgres.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function sha256File(rel) {
  return createHash("sha256").update(readFileSync(path.join(ROOT, rel))).digest("hex").toUpperCase();
}

function assertCertified(relDir, expected) {
  for (const [name, hash] of Object.entries(expected)) {
    assert.equal(sha256File(path.posix.join(relDir, name)), hash, `${relDir}/${name}`);
  }
}

function importedModules(source) {
  return [...source.matchAll(/(?:import|export)\s+[^'"\n]*from\s+["']([^"']+)["']/g)].map(
    (match) => match[1]
  );
}

function listJs(relDir) {
  const absolute = path.join(ROOT, relDir);
  return readdirSync(absolute)
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.posix.join(relDir, name));
}

const CANONICAL_MODULES = [
  "src/features/court-resource/services/courtOperationsBookingApplication.js",
  "src/features/court-resource/services/canonicalBookingClient.js",
  "src/features/court-resource/services/courtOperationsResourceBlockApplication.js",
  "src/features/court-resource/services/canonicalResourceBlockClient.js",
  "src/features/court-resource/services/courtOperationsLiveRuntimeApplication.js",
  "src/features/court-resource/services/canonicalLiveRuntimeClient.js",
  "src/features/court-resource/services/canonicalCourtInventoryService.js",
  "src/features/court-resource/runtime/canonicalReservationRuntime.js",
  "src/features/competition-engine/integration/court-adapters/createModeCourtAdapterB.js",
  "src/features/competition-engine/integration/court-adapters/DailyPlayCourtAdapter.js",
  "src/features/competition-engine/integration/court-adapters/InternalTournamentCourtAdapter.js",
  "src/features/competition-engine/integration/court-adapters/OfficialTournamentCourtAdapter.js",
  "src/features/competition-engine/integration/court-adapters/TeamTournamentCourtAdapter.js",
  "src/features/competition-engine/integration/court-adapters/dailyPlayCourtOrchestrator.js",
  "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js",
];

test("B9-ARCH-01 defaults remain OFF; Head A V1 frozen at 5 capabilities", () => {
  assert.equal(CANONICAL_RESERVATION_CUTOVER_DEFAULT, false);
  assert.equal(CANONICAL_BOOKING_LIFECYCLE_DEFAULT, false);
  assert.equal(CANONICAL_RESOURCE_BLOCKS_DEFAULT, false);
  assert.equal(CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT, false);
  assert.equal(CANONICAL_COURT_LIVE_RUNTIME_DEFAULT, false);
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.equal(Object.keys(COMPETITION_COURT_ADAPTER_CAPABILITY).length, 5);
  assert.equal(Object.values(COMPETITION_COURT_ADAPTER_CAPABILITY).length, 5);
  assert.deepEqual(Object.values(COMPETITION_COURT_ADAPTER_CAPABILITY).sort(), [
    "getCourtAvailability",
    "listEligibleCourts",
    "releaseCourts",
    "reserveCourts",
    "validateMatchAssignment",
  ]);
  assert.equal(
    sha256File("src/features/competition-core/contracts/competitionCourtAdapterContract.js"),
    HEAD_A_CONTRACT_SHA256
  );
});

test("B9-ARCH-02 same physical id domain and capacity SSOT", () => {
  assert.equal(CANONICAL_RESERVATION_TABLE, "court_resource_reservations");
  assert.equal(CANONICAL_BOOKING_BUSINESS_TABLE, "court_operations_bookings");
  assert.equal(CANONICAL_RESOURCE_BLOCK_BUSINESS_TABLE, "court_operations_resource_blocks");
  assert.equal(DAILY_PLAY_CAPACITY_AUTHORITY, "court_resource_reservations");
  assert.equal(DAILY_PLAY_LEASE_IS_CAPACITY_SSOT, false);
  assert.equal(DAILY_PLAY_LEASE_IS_PROJECTION, true);
  assert.deepEqual(
    Object.values(CANONICAL_OWNER_TYPE).sort(),
    ["booking", "competition", "daily_play", "maintenance", "operations"]
  );
  const ownership = read("src/features/court-resource/OWNERSHIP.md");
  assert.match(ownership, /Durable reservation \/ capacity \| `public\.court_resource_reservations`/);
  assert.match(ownership, /physicalCourtId/);
  assert.equal(TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION, "NO");
  assert.equal(COURT_CLUSTERS_TENANT_SEMANTICS_EXPLICIT, "YES");
  assert.equal(COURT_CLUSTERS_VENUE_SEMANTICS_EXPLICIT, "YES");
});

test("B9-ARCH-03 certified SQL packages unchanged (Batch1–8 + 3A/3B/D4)", () => {
  assertCertified(PKG.phase3a, CERTIFIED_PACKAGE_HASHES.phase3a);
  assertCertified(PKG.phase3b, CERTIFIED_PACKAGE_HASHES.phase3b);
  assertCertified(PKG.d4, CERTIFIED_PACKAGE_HASHES.d4);
  assertCertified(PKG.batch1, CERTIFIED_PACKAGE_HASHES.batch1);
  assertCertified(PKG.batch2, CERTIFIED_PACKAGE_HASHES.batch2);
  assertCertified(PKG.batch3, CERTIFIED_PACKAGE_HASHES.batch3);
  assertCertified(PKG.batch4, CERTIFIED_PACKAGE_HASHES.batch4);
  assertCertified(PKG.batch7, CERTIFIED_PACKAGE_HASHES.batch7);
  assertCertified(PKG.batch8, CERTIFIED_PACKAGE_HASHES.batch8);
});

test("B9-ARCH-03b pre-Staging identity-guard package is additive and present", () => {
  assert.equal(
    PKG.identityGuard,
    "docs/v5/migrations/court-operations-pre-staging-identity-guard-01"
  );
  for (const name of [
    "01_PRECHECK.sql",
    "02_APPLY.sql",
    "03_VERIFY.sql",
    "04_ROLLBACK.sql",
    "README.md",
  ]) {
    assert.equal(existsSync(path.join(ROOT, PKG.identityGuard, name)), true, name);
  }
  assertCertified(PKG.identityGuard, CERTIFIED_PACKAGE_HASHES.identityGuard);
  const apply = read(`${PKG.identityGuard}/02_APPLY.sql`);
  assert.match(apply, /CREATE OR REPLACE FUNCTION public\.court_resource_identity_guard/);
  assert.match(apply, /SELECT cc\.tenant_id INTO v_scope_tenant/);
  assert.doesNotMatch(
    apply,
    /SELECT venue_id INTO v_scope_tenant FROM public\.court_clusters/
  );
  assert.match(apply, /COURT_RESOURCE_UNKNOWN_CLUSTER/);
  const readme = read(`${PKG.identityGuard}/README.md`);
  assert.match(readme, /ROLLBACK_DEPENDENCY=/);
  assert.match(readme, /Batch8/);
});

test("B9-ARCH-04 Mode Adapter B cannot import Gateway / legacy / D4 acquire", () => {
  assert.equal(MODE_COURT_ADAPTER_B_OWNER, "2.13_COMPETITION_ENGINE");
  const adapterRoot = "src/features/competition-engine/integration/court-adapters";
  const forbidden =
    /(?:import|export)\s+[^;]*\b(?:clubStorage|loadCourtsForClub|loadBookingsForClub|legacyCourtIdentityMapping|courtResourceGateway|canonicalBookingClient|canonicalResourceBlockClient)\b|club_data_v3|court_resource_daily_play_acquire/;
  for (const file of listJs(adapterRoot)) {
    const source = read(file);
    assert.doesNotMatch(source, forbidden, file);
    assert.doesNotMatch(source, /tenantId\s*\|\|\s*venueId/, file);
    assert.doesNotMatch(source, /venueId\s*\|\|\s*tenantId/, file);
  }
  const factory = read(`${adapterRoot}/createModeCourtAdapterB.js`);
  assert.match(factory, /createCourtResourceCompetitionAdapter/);
  assert.doesNotMatch(factory, /from ["'].*courtResourceGateway/);
});

test("B9-ARCH-05 canonical modules remain legacy-authority-free", () => {
  for (const rel of CANONICAL_MODULES) {
    assert.equal(existsSync(path.join(ROOT, rel)), true, rel);
    const source = read(rel);
    for (const spec of importedModules(source)) {
      assert.doesNotMatch(spec, /clubStorage|legacyCourtIdentityMapping/, rel);
    }
    assert.doesNotMatch(source, /\bloadCourtsForClub\s*\(/, rel);
    assert.doesNotMatch(source, /\bloadBookingsForClub\s*\(/, rel);
    assert.doesNotMatch(source, /court_resource_daily_play_acquire/, rel);
    assert.doesNotMatch(source, /INSERT INTO public\.court_resource_reservations/, rel);
  }
});

test("B9-ARCH-06 Head A provider is the only Gateway hop; no mode DB writes", () => {
  const provider = read("src/features/competition-core/adapters/courtResourceCompetitionAdapter.js");
  assert.match(provider, /from ["'].*court-resource\/index\.js["']/);
  assert.doesNotMatch(provider, /from ["'].*DailyPlayCourtAdapter/);
  assert.doesNotMatch(provider, /from ["'].*InternalTournamentCourtAdapter/);
  assert.doesNotMatch(provider, /court_resource_reserve/);
  assert.doesNotMatch(provider, /club_data_v3/);
  const bookingSql = read(`${PKG.batch3}/02_APPLY.sql`);
  assert.match(bookingSql, /court_resource_reserve_core/);
  assert.doesNotMatch(bookingSql, /INSERT INTO public\.court_resource_reservations/);
  const blockSql = read(`${PKG.batch4}/02_APPLY.sql`);
  assert.match(blockSql, /court_resource_reserve_core/);
  assert.doesNotMatch(blockSql, /INSERT INTO public\.court_resource_reservations/);
  const liveSql = read(`${PKG.batch7}/02_APPLY.sql`);
  assert.doesNotMatch(liveSql, /INSERT INTO public\.court_resource_reservations/);
  assert.doesNotMatch(liveSql, /UPDATE public\.court_resource_reservations/);
  assert.match(liveSql, /reservationWriteCount', 0/);
});

test("B9-ARCH-07 identity authority is physicalCourtId UUID across consumers", () => {
  const phase3b = read(`${PKG.phase3b}/02_APPLY.sql`);
  assert.match(phase3b, /physical_court_id uuid/);
  assert.match(phase3b, /tstzrange\(starts_at, ends_at, '\[\)'\)/);
  for (const rel of [
    `${PKG.batch3}/02_APPLY.sql`,
    `${PKG.batch4}/02_APPLY.sql`,
    `${PKG.batch7}/02_APPLY.sql`,
  ]) {
    const sql = read(rel);
    assert.match(sql, /physical_court_id uuid/, rel);
    assert.match(sql, /identityAuthority.*physicalCourtId/, rel);
  }
});

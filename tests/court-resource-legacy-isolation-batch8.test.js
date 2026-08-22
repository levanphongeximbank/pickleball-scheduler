import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COURT_CLUSTERS_TENANT_SEMANTICS_EXPLICIT,
  COURT_CLUSTERS_VENUE_SEMANTICS_EXPLICIT,
  COURT_CLUSTERS_VENUE_ID_ORG_PARENT_DEBT_ON_CANONICAL_PATH,
  COURT_CLUSTERS_VENUE_ID_SEMANTICS,
  LEGACY_COMPATIBILITY_BOUNDARY_EXPLICIT,
  LEGACY_BOUNDARY_LOCATION,
  TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION,
} from "../src/features/court-resource/constants/courtOperationsOwnership.js";
import {
  CANONICAL_BOOKING_LIFECYCLE_DEFAULT,
} from "../src/features/court-resource/constants/canonicalBooking.js";
import {
  CANONICAL_RESOURCE_BLOCKS_DEFAULT,
} from "../src/features/court-resource/constants/canonicalResourceBlock.js";
import {
  CANONICAL_COURT_LIVE_RUNTIME_DEFAULT,
} from "../src/features/court-resource/constants/canonicalLiveRuntime.js";
import {
  CANONICAL_RESERVATION_CUTOVER_DEFAULT,
} from "../src/features/court-resource/constants/canonicalReservation.js";
import {
  CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT,
} from "../src/features/competition-engine/integration/court-adapters/canonicalCompetitionCourtAdapters.js";
import {
  LEGACY_COMPATIBILITY_BOUNDARY_EXPLICIT as BOUNDARY_FLAG,
  LEGACY_BOUNDARY_LOCATION as BOUNDARY_PATH,
  CURRENTMATCHID_CANONICAL_AUTHORITY,
  LEGACY_COURT_STATUS_AUTHORITY_ON_CANONICAL_PATH,
  LEGACY_COURT_ENGINE_OCCUPANCY_AUTHORITY_ON_CANONICAL_PATH,
  D4_VENUE_AS_TENANT_ON_CANONICAL_PATH,
  STALE_EPHEMERAL_STATE_AUTO_MIGRATED,
  planLegacyLiveStateMigrationDryRun,
  planLegacyMaintenanceMigrationDryRun,
} from "../src/features/court-resource/legacy/index.js";
import { planLegacyBookingMigrationDryRun } from "../src/features/court-resource/services/legacyBookingMigrationDryRun.js";
import { COMPETITION_COURT_ADAPTER_CONTRACT_VERSION } from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import { COURT_RESOURCE_CODE } from "../src/features/court-resource/constants/courtResourceContract.js";
import {
  createCanonicalInventoryReader,
  listEligiblePhysicalCourts,
} from "../src/features/court-resource/services/canonicalCourtInventoryService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = "docs/v5/migrations/court-operations-legacy-isolation-01";
const HEAD_A_CONTRACT_SHA256 =
  "B9F7FE3F36786383A7A1C2027E5D1B93D4917BA9365CA98F88DE96529C4C6B1C";

const CERTIFIED_3A = {
  "01_PRECHECK.sql": "369DA901AEBA717A85883998CAEDB0EE6ED0E605B9AD9C31BA78D2DEB0A34E98",
  "02_APPLY.sql": "FAF9CFD0F00164316AE57A8FF48AC22117F30E332400B8C0C89B4125473FD9BA",
  "03_VERIFY.sql": "ABE90B9455C019A382D1EA2FFA637C0746B62BEA9A95A762E53D98F9BB319171",
  "04_ROLLBACK.sql": "332C54F17C5AFA5EA44B48E99001191E340F53FD2DC50451F18856A5B8DA4E18",
};
const CERTIFIED_3B = {
  "01_PRECHECK.sql": "D3C64598EDA13A7823194FACBBC4B6A81F1095682E30E929486C033F0D08E6E8",
  "02_APPLY.sql": "4425311AD18A4F8496E4ED1B024007538FA3E63E9BD7F5F788489406362CB5AE",
  "03_VERIFY.sql": "79C32FF510634314B2E21885352B9F26FBD0B5B942E794C2D06681904E701A20",
  "04_ROLLBACK.sql": "43E39245D3698ED21565AE43C2322A64A474122E51730BAABA7B9A5AAC280898",
};
const CERTIFIED_D4 = {
  "01_PRECHECK.sql": "5C5DF3B7B6C63AF3DA3C25A85A5A2C9CDE09938CA0B29BF035D0EE677A978D09",
  "02_APPLY.sql": "C2C998F3D0BDAEB605AB004E231FFE3AFCE45E2EB6278509BE3F284E68BBE986",
  "03_VERIFY.sql": "93678A8EE2F8DF0F66D4ADAA0E8A5E2F0EBD17034C0473D69AE0DBF992AC2845",
  "04_ROLLBACK.sql": "166F7B8105CCBE695AF584BB59FBC6D448A0DC37A26EDB9AEBAC8E029AEEFB9B",
};

const COURT = "11111111-1111-4111-8111-111111111111";
const TENANT = "tenant-a";
const VENUE = "venue-a";
const CLUB = "club-a";
const CLUSTER = "cluster-a";

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function sha256File(rel) {
  return createHash("sha256").update(readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n"), "utf8").digest("hex").toUpperCase();
}

function assertCertified(dir, expected) {
  for (const [name, hash] of Object.entries(expected)) {
    assert.equal(sha256File(path.posix.join(dir, name)), hash, name);
  }
}

function importedModules(source) {
  return [...source.matchAll(/(?:import|export)\s+[^'"\n]*from\s+["']([^"']+)["']/g)].map(
    (match) => match[1]
  );
}

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing function ${name}`);
  let i = source.indexOf("{", start);
  let depth = 0;
  for (; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

const CANONICAL_MODULES = [
  "src/features/court-resource/services/courtOperationsBookingApplication.js",
  "src/features/court-resource/services/canonicalBookingClient.js",
  "src/features/court-resource/services/courtOperationsResourceBlockApplication.js",
  "src/features/court-resource/services/canonicalResourceBlockClient.js",
  "src/features/court-resource/services/courtOperationsLiveRuntimeApplication.js",
  "src/features/court-resource/services/canonicalLiveRuntimeClient.js",
  "src/features/court-resource/services/canonicalCourtInventoryService.js",
  "src/features/court-resource/services/canonicalCourtInventoryClient.js",
  "src/features/court-resource/runtime/canonicalReservationRuntime.js",
  "src/features/court-resource/projections/courtLiveResourceUseProjection.js",
  "src/features/competition-engine/integration/court-adapters/createModeCourtAdapterB.js",
  "src/features/competition-engine/integration/court-adapters/DailyPlayCourtAdapter.js",
  "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js",
];

test("Batch 8 legacy boundary flags and defaults remain OFF", () => {
  assert.equal(LEGACY_COMPATIBILITY_BOUNDARY_EXPLICIT, "YES");
  assert.equal(BOUNDARY_FLAG, "YES");
  assert.equal(LEGACY_BOUNDARY_LOCATION, "src/features/court-resource/legacy/");
  assert.equal(BOUNDARY_PATH, "src/features/court-resource/legacy/");
  assert.equal(COURT_CLUSTERS_TENANT_SEMANTICS_EXPLICIT, "YES");
  assert.equal(COURT_CLUSTERS_VENUE_SEMANTICS_EXPLICIT, "YES");
  assert.equal(COURT_CLUSTERS_VENUE_ID_ORG_PARENT_DEBT_ON_CANONICAL_PATH, "NO");
  assert.equal(COURT_CLUSTERS_VENUE_ID_SEMANTICS, "canonical_venue_id");
  assert.equal(TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION, "NO");
  assert.equal(CURRENTMATCHID_CANONICAL_AUTHORITY, "NO");
  assert.equal(LEGACY_COURT_STATUS_AUTHORITY_ON_CANONICAL_PATH, "NO");
  assert.equal(LEGACY_COURT_ENGINE_OCCUPANCY_AUTHORITY_ON_CANONICAL_PATH, "NO");
  assert.equal(D4_VENUE_AS_TENANT_ON_CANONICAL_PATH, "NO");
  assert.equal(STALE_EPHEMERAL_STATE_AUTO_MIGRATED, "NO");
  assert.equal(CANONICAL_RESERVATION_CUTOVER_DEFAULT, false);
  assert.equal(CANONICAL_BOOKING_LIFECYCLE_DEFAULT, false);
  assert.equal(CANONICAL_RESOURCE_BLOCKS_DEFAULT, false);
  assert.equal(CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT, false);
  assert.equal(CANONICAL_COURT_LIVE_RUNTIME_DEFAULT, false);
  assert.equal(existsSync(path.join(root, "src/features/court-resource/legacy/LEGACY_BOUNDARY.md")), true);
  assert.equal(
    existsSync(path.join(root, "src/features/court-resource/legacy/LEGACY_RETIREMENT_MANIFEST.md")),
    true
  );
});

test("Phase 3A / 3B / D4 certified SQL unchanged (CERTIFIED_SQL_CHANGED_COUNT=0)", () => {
  assertCertified("docs/v5/migrations/court-resource-post427-canonical-reconciliation-01", CERTIFIED_3A);
  assertCertified("docs/v5/migrations/court-resource-phase3b-canonical-reservation-01", CERTIFIED_3B);
  assertCertified(
    "docs/v5/migrations/court-resource-phase3b-daily-play-interval-authority-01",
    CERTIFIED_D4
  );
});

test("HEAD_A_V1 unchanged", () => {
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.equal(
    sha256File("src/features/competition-core/contracts/competitionCourtAdapterContract.js"),
    HEAD_A_CONTRACT_SHA256
  );
});

test("Batch 8 SQL package authored and additive", () => {
  for (const name of [
    "01_PRECHECK.sql",
    "02_APPLY.sql",
    "03_VERIFY.sql",
    "04_ROLLBACK.sql",
    "README.md",
    "MIGRATION_IDENTITY.txt",
  ]) {
    assert.equal(existsSync(path.join(root, PKG, name)), true, name);
  }
  const apply = read(`${PKG}/02_APPLY.sql`);
  assert.match(apply, /ADD COLUMN IF NOT EXISTS tenant_id/);
  assert.match(apply, /tenant_id = cc\.venue_id/);
  assert.match(apply, /UNRESOLVED_CLUSTER_TENANT_MAPPING/);
  assert.match(apply, /SELECT cc\.tenant_id INTO v_cluster_tenant/);
  assert.doesNotMatch(apply, /DROP COLUMN.*venue_id/i);
  assert.match(apply, /NOT APPLIED|LOCAL AUTHORING/i);
  const identity = read(`${PKG}/MIGRATION_IDENTITY.txt`);
  assert.match(identity, /STAGING_APPLY=NO/);
  assert.match(identity, /PRODUCTION_APPLY=NO/);
});

test("A–I. canonical modules have zero raw legacy authority imports", () => {
  for (const rel of CANONICAL_MODULES) {
    const source = read(rel);
    for (const spec of importedModules(source)) {
      assert.doesNotMatch(spec, /clubStorage|legacyCourtIdentityMapping/, rel);
      assert.doesNotMatch(spec, /club_data_v3|pickleball-club-data-v3/, rel);
    }
    assert.doesNotMatch(source, /\bloadCourtsForClub\s*\(/, rel);
    assert.doesNotMatch(source, /\bloadBookingsForClub\s*\(/, rel);
    assert.doesNotMatch(source, /\bloadCourtsFromLegacy\s*\(/, rel);
    assert.doesNotMatch(source, /court_resource_daily_play_acquire/, rel);
    assert.doesNotMatch(source, /tenantId\s*\|\|\s*venueId/, rel);
    assert.doesNotMatch(source, /venueId\s*\|\|\s*tenantId/, rel);
  }
});

test("I. Gateway canonical branches never call legacy substrate", () => {
  const gateway = read("src/features/court-resource/services/courtResourceGateway.js");
  assert.match(gateway, /legacy\/gatewayLegacyDeps/);
  assert.doesNotMatch(gateway, /from ["'].*domain\/clubStorage/);
  assert.doesNotMatch(gateway, /from ["'].*legacyCourtIdentityMapping/);
  for (const name of [
    "resolvePhysicalIdsForCanonical",
    "resolveCanonicalPhysicalIds",
    "reserveCourtsCanonical",
    "releaseCourtsCanonical",
    "getCourtAvailabilityCanonical",
    "listOwnerReservationsCanonical",
    "listEligibleCourts",
  ]) {
    const fn = extractNamedFunction(gateway, name);
    assert.doesNotMatch(fn, /resolveLegacyPhysicalCourt/, name);
    assert.doesNotMatch(fn, /resolveLegacyCourtIdentity/, name);
    assert.doesNotMatch(fn, /loadBookingsForClub/, name);
    assert.doesNotMatch(fn, /createMaintenanceBooking/, name);
    assert.doesNotMatch(fn, /syncLegacyTournamentReservations/, name);
    assert.doesNotMatch(fn, /listLegacyTournamentReservations/, name);
  }
});

test("E. Daily / Mode Adapter B never call D4 legacy capacity path", () => {
  const files = [
    "src/features/competition-engine/integration/court-adapters/DailyPlayCourtAdapter.js",
    "src/features/competition-engine/integration/court-adapters/createModeCourtAdapterB.js",
    "src/features/competition-engine/integration/court-adapters/dailyPlayCourtOrchestrator.js",
  ];
  for (const rel of files) {
    if (!existsSync(path.join(root, rel))) continue;
    const source = read(rel);
    assert.doesNotMatch(source, /court_resource_daily_play_acquire/);
    assert.doesNotMatch(source, /loadCourtsForClub/);
    assert.doesNotMatch(source, /clubStorage/);
    assert.doesNotMatch(source, /legacyCourtIdentityMapping/);
  }
});

test("J. legacy compatibility path remains explicit and flag-gated", () => {
  const gateway = read("src/features/court-resource/services/courtResourceGateway.js");
  assert.match(gateway, /shouldUseCanonicalReservationPath/);
  assert.match(gateway, /EXPLICIT_LEGACY|legacy\/gatewayLegacyDeps|Legacy OFF path/i);
  const legacyDeps = read("src/features/court-resource/legacy/gatewayLegacyDeps.js");
  assert.match(legacyDeps, /EXPLICIT_LEGACY_RUNTIME/);
  assert.match(legacyDeps, /loadBookingsForClub/);
});

test("K–O. identity rules on canonical inventory / gateway", () => {
  const reader = createCanonicalInventoryReader({
    clubs: [{ id: CLUB, tenantId: TENANT }],
    clusters: [{ id: CLUSTER, tenantId: TENANT, venueId: VENUE }],
    physicalCourts: [
      {
        physicalCourtId: COURT,
        tenantId: TENANT,
        clusterId: CLUSTER,
        displayName: "Sân 1",
        displayCode: "C1",
        displayNumber: "1",
        sortOrder: 1,
        lifecycleStatus: "active",
      },
    ],
    clubOperationalAccess: [
      { tenantId: TENANT, clubId: CLUB, physicalCourtId: COURT, status: "enabled" },
    ],
  });

  // K — native UUID selectedCourtIds are compatibility projection, not separate authority
  const bySelected = reader({
    tenantId: TENANT,
    clubId: CLUB,
    selectedCourtIds: [COURT],
  });
  assert.equal(bySelected.ok, true);
  assert.equal(bySelected.courts[0].physicalCourtId, COURT);
  assert.equal(bySelected.courts[0].identityAuthority, "physicalCourtId");

  // L — legacy court id cannot impersonate physicalCourtId
  const legacyImpersonate = reader({
    tenantId: TENANT,
    clubId: CLUB,
    selectedCourtIds: ["NL_C01"],
  });
  assert.equal(legacyImpersonate.ok, false);
  assert.equal(legacyImpersonate.code, COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED);

  // M — display label cannot become identity
  const label = listEligiblePhysicalCourts(
    { tenantId: TENANT, clubId: CLUB, courtLabel: "Sân 1" },
    {
      clubs: [{ id: CLUB, tenantId: TENANT }],
      clusters: [{ id: CLUSTER, tenantId: TENANT, venueId: VENUE }],
      physicalCourts: [],
      clubOperationalAccess: [],
    }
  );
  assert.equal(label.ok === false || (label.courts || []).length === 0, true);

  // N — clusterId cannot become physical court identity
  const clusterAsCourt = reader({
    tenantId: TENANT,
    clubId: CLUB,
    clusterId: CLUSTER,
    selectedCourtIds: [CLUSTER],
  });
  assert.equal(clusterAsCourt.ok, false);

  // O covered: UUID selectedCourtIds resolved as physicalCourtId projection above
});

test("P–T. tenant / venue / cluster fail-closed", () => {
  const sources = {
    clubs: [{ id: CLUB, tenantId: TENANT }],
    clusters: [{ id: CLUSTER, tenantId: TENANT, venueId: VENUE }],
    physicalCourts: [
      {
        physicalCourtId: COURT,
        tenantId: TENANT,
        clusterId: CLUSTER,
        displayName: "Sân 1",
        displayCode: "C1",
        displayNumber: "1",
        sortOrder: 1,
        lifecycleStatus: "active",
      },
    ],
    clubOperationalAccess: [
      { tenantId: TENANT, clubId: CLUB, physicalCourtId: COURT, status: "enabled" },
    ],
  };

  // P — distinct tenant + venue PASS
  const ok = listEligiblePhysicalCourts(
    { tenantId: TENANT, venueId: VENUE, clubId: CLUB, clusterId: CLUSTER },
    sources
  );
  assert.equal(ok.ok, true);

  // Q — venueId as tenant substitute FAIL
  const collapse = listEligiblePhysicalCourts({ venueId: VENUE, clubId: CLUB }, sources);
  assert.equal(collapse.ok, false);
  assert.equal(collapse.code, COURT_RESOURCE_CODE.TENANT_VENUE_COLLAPSE_DENIED);

  // R — foreign tenant cluster FAIL
  const foreignTenant = listEligiblePhysicalCourts(
    { tenantId: TENANT, clubId: CLUB, clusterId: CLUSTER },
    {
      ...sources,
      clusters: [{ id: CLUSTER, tenantId: "other-tenant", venueId: VENUE }],
    }
  );
  assert.equal(foreignTenant.ok, false);
  assert.equal(foreignTenant.code, COURT_RESOURCE_CODE.TENANT_MISMATCH);

  // S — foreign venue context FAIL
  const foreignVenue = listEligiblePhysicalCourts(
    { tenantId: TENANT, venueId: "other-venue", clubId: CLUB, clusterId: CLUSTER },
    sources
  );
  assert.equal(foreignVenue.ok, false);
  assert.equal(foreignVenue.code, COURT_RESOURCE_CODE.VENUE_MISMATCH);

  // T — unresolved cluster tenant mapping FAIL
  const unresolved = listEligiblePhysicalCourts(
    { tenantId: TENANT, clubId: CLUB, clusterId: CLUSTER },
    {
      ...sources,
      clusters: [{ id: CLUSTER, venueId: VENUE }],
    }
  );
  assert.equal(unresolved.ok, false);
  assert.equal(unresolved.unresolvedClusterMapping, true);
});

test("U–X. legacy live state never becomes canonical authority", () => {
  const plan = planLegacyLiveStateMigrationDryRun({
    courtEngineOccupancyBlobs: [{ courtId: "NL_1", currentMatchId: "m1" }],
    legacyCourtStatusRows: [{ courtId: "NL_1", status: "maintenance" }],
    currentMatchIdRows: [{ currentMatchId: "m1" }],
    dailyPlayLeaseRows: [{ leaseId: "lease-1" }],
    canonicalBusinessProjections: [{ physicalCourtId: COURT, sourceType: "competition", sourceId: "m2" }],
  });
  assert.equal(plan.execute, false);
  assert.equal(plan.autoPromoteEphemeralOccupancy, false);
  assert.equal(plan.staleEphemeralStateAutoMigrated, false);
  assert.equal(plan.planned.length, 1);
  assert.equal(plan.planned[0].fromLegacyBlob, false);
  assert.ok(plan.rejected.some((r) => r.reason === "STALE_EPHEMERAL_OCCUPANCY_NOT_PROMOTED"));
  assert.ok(plan.rejected.some((r) => r.reason === "COURT_STATUS_NOT_LIVE_RUNTIME_AUTHORITY"));
  assert.ok(plan.rejected.some((r) => r.reason === "CURRENTMATCHID_NOT_OCCUPANCY_AUTHORITY"));
  assert.ok(plan.rejected.some((r) => r.reason === "DAILY_PLAY_LEASE_NOT_OCCUPANCY_SSOT"));
});

test("Y–AC. migration dry-run safety", () => {
  // Y — verified mapping plans deterministically
  const mapped = planLegacyBookingMigrationDryRun({
    tenantId: TENANT,
    clubId: CLUB,
    courtMappings: [{ legacyCourtId: "NL_1", physicalCourtId: COURT }],
    legacyBookings: [
      {
        id: "b1",
        courtId: "NL_1",
        date: "2026-08-16",
        startTime: "08:00",
        endTime: "09:00",
      },
    ],
  });
  assert.equal(mapped.execute, false);
  assert.equal(mapped.fabricateCapacity, false);
  assert.equal(mapped.planned.length, 1);
  assert.equal(mapped.planned[0].physicalCourtId, COURT);

  // Z — unmapped fail closed
  const unmapped = planLegacyBookingMigrationDryRun({
    tenantId: TENANT,
    clubId: CLUB,
    courtMappings: [],
    legacyBookings: [{ id: "b2", courtId: "NL_X", date: "2026-08-16", startTime: "08:00", endTime: "09:00" }],
  });
  assert.equal(unmapped.planned.length, 0);
  assert.ok(unmapped.rejected.length >= 1);

  // AA — explicit interval maintenance migratable
  const maint = planLegacyMaintenanceMigrationDryRun({
    tenantId: TENANT,
    clubId: CLUB,
    courtMappings: [{ legacyCourtId: "NL_1", physicalCourtId: COURT }],
    legacyMaintenanceBookings: [
      {
        id: "m1",
        bookingType: "maintenance",
        courtId: "NL_1",
        date: "2026-08-16",
        startTime: "10:00",
        endTime: "12:00",
      },
    ],
  });
  assert.equal(maint.planned.length, 1);
  assert.equal(maint.autoConvertCourtStatus, false);

  // AB — unbounded court.status NOT converted
  const status = planLegacyMaintenanceMigrationDryRun({
    tenantId: TENANT,
    clubId: CLUB,
    unboundedCourtStatusRows: [{ courtId: "NL_1", status: "maintenance" }],
  });
  assert.equal(status.planned.length, 0);
  assert.ok(status.rejected.some((r) => r.reason === "COURT_STATUS_NOT_RESOURCE_BLOCK"));

  // AC — stale occupancy not auto-promoted
  assert.equal(STALE_EPHEMERAL_STATE_AUTO_MIGRATED, "NO");
});

test("Gateway does not import clubStorage directly — legacy boundary only", () => {
  const gateway = read("src/features/court-resource/services/courtResourceGateway.js");
  for (const spec of importedModules(gateway)) {
    assert.doesNotMatch(spec, /clubStorage/);
    assert.doesNotMatch(spec, /legacyCourtIdentityMapping/);
    assert.doesNotMatch(spec, /legacyBookingMigrationDryRun/);
  }
  // Browser-safe reservation helpers may come from the adapter leaf;
  // Node-only migration dry-run must never enter this graph.
  assert.match(gateway, /from ["']\.\.\/(?:legacy\/|adapters\/)/);
  assert.doesNotMatch(gateway, /legacyBookingMigrationDryRun/);
});

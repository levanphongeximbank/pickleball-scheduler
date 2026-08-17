import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  COURT_CLUSTERS_TENANT_COLUMN_STATE,
  PRODUCTION_PRECHECK_EVIDENCE_2026_08,
  classifyCourtClustersTenantColumnState,
  collectWave3PrecheckBlockers,
  alignClusterTenantFromParentVenue,
  identitiesRemainDistinct,
  simulateWave3PackageSequence,
} from "./helpers/wave3-cluster-tenant-precheck.js";

const SQL_DIR = path.join(
  process.cwd(),
  "docs/platform-core-wave3-tenant-venue-separation/sql"
);
const README = path.join(
  process.cwd(),
  "docs/platform-core-wave3-tenant-venue-separation/README.md"
);

function readSql(name) {
  return fs.readFileSync(path.join(SQL_DIR, name), "utf8");
}

test("CASE 1: pre-schema DB where court_clusters.tenant_id already exists is PRESENT_COMPATIBLE", () => {
  const column = classifyCourtClustersTenantColumnState({
    exists: true,
    dataType: "text",
  });
  assert.equal(column.state, COURT_CLUSTERS_TENANT_COLUMN_STATE.PRESENT_COMPATIBLE);
  assert.equal(column.dataCorruption, false);
  assert.equal(column.blocker, false);

  const result = collectWave3PrecheckBlockers({
    courtClustersTenantIdExists: true,
    clusterTenantDataType: "text",
    venuesTenantIdExists: false,
    clusterOrphanParentVenues: 0,
    clusterTenantParentBootstrapMismatches: 0,
    slugCollisions: 0,
    profileHomeVenueOrphans: 0,
    clubTenantBootstrapOrphans: 0,
    subscriptionTenantBootstrapOrphans: 0,
  });
  assert.equal(result.blocked, false);
  assert.equal(result.columnState, "PRESENT_COMPATIBLE");
});

test("CASE 2: pre-schema DB where court_clusters.tenant_id is absent is EXPECTED_PRE_SCHEMA", () => {
  const column = classifyCourtClustersTenantColumnState({ exists: false });
  assert.equal(
    column.state,
    COURT_CLUSTERS_TENANT_COLUMN_STATE.ABSENT_EXPECTED_TO_BE_CREATED_BY_02
  );
  assert.equal(column.dataCorruption, false);
  assert.deepEqual(column.pipeline, [
    "EXPECTED_PRE_SCHEMA",
    "CREATED_BY_02",
    "BACKFILLED_BY_03",
    "VERIFIED_BY_05",
  ]);

  const result = collectWave3PrecheckBlockers({
    courtClustersTenantIdExists: false,
    clusterOrphanParentVenues: 0,
    slugCollisions: 0,
    profileHomeVenueOrphans: 0,
    clubTenantBootstrapOrphans: 0,
    subscriptionTenantBootstrapOrphans: 0,
  });
  assert.equal(result.blocked, false);
  assert.equal(result.dataCorruption, false);
});

test("CASE 3: cluster with orphan venue_id is a precheck BLOCK", () => {
  const result = collectWave3PrecheckBlockers({
    courtClustersTenantIdExists: false,
    clusterOrphanParentVenues: 1,
  });
  assert.equal(result.blocked, true);
  assert.ok(result.blockers.includes("CLUSTER_ORPHAN_PARENT_VENUES"));
  assert.equal(
    result.columnState,
    "ABSENT_EXPECTED_TO_BE_CREATED_BY_02"
  );
});

test("CASE 4: existing cluster tenant_id mismatches parent Venue tenant is a BLOCK", () => {
  const result = collectWave3PrecheckBlockers({
    courtClustersTenantIdExists: true,
    clusterTenantDataType: "text",
    venuesTenantIdExists: true,
    clusterTenantParentBootstrapMismatches: 1,
  });
  assert.equal(result.blocked, true);
  assert.ok(result.blockers.includes("CLUSTER_TENANT_PARENT_MISMATCH"));

  const aligned = alignClusterTenantFromParentVenue(
    [{ id: "cluster-1", venueId: "venue-1", tenantId: "tenant-OTHER" }],
    [{ id: "venue-1", tenantId: "tenant-1" }]
  );
  assert.equal(aligned[0].mismatch, true);
  assert.equal(aligned[0].tenantId, "tenant-OTHER");
});

test("CASE 5: clean Production-like 1 Venue / 1 Cluster package sequence is structurally valid", () => {
  const simulated = simulateWave3PackageSequence({
    clusterTenantColumnExists: false,
    venues: [{ id: "venue-prod-1", name: "Nam Long" }],
    clusters: [{ id: "cluster-prod-1", venueId: "venue-prod-1", tenantId: null }],
  });
  assert.equal(simulated.after02.clusterTenantColumnExists, true);
  assert.equal(simulated.after02.createdBy02, true);
  assert.equal(simulated.ok, true);
  assert.equal(simulated.aligned[0].tenantId, "venue-prod-1");
  assert.deepEqual(simulated.verify, {
    COURT_CLUSTERS_TENANT_ID_EXISTS: "YES",
    CLUSTERS_MISSING_TENANT: 0,
    CLUSTERS_ORPHAN_VENUE: 0,
    CLUSTERS_TENANT_MISMATCH_PARENT_VENUE: 0,
    COURT_CLUSTERS_TENANT_FK: "VALID",
    COURT_CLUSTERS_TENANT_INDEX: "VALID",
  });
});

test("CASE 6: Tenant → Venue 1:N remains supported; cluster tenant derives from parent Venue", () => {
  const tenantId = "tenant-shared";
  const simulated = simulateWave3PackageSequence({
    clusterTenantColumnExists: true,
    venues: [
      { id: "venue-1", tenantId },
      { id: "venue-2", tenantId },
    ],
    clusters: [
      { id: "cluster-1", venueId: "venue-1", tenantId: null },
      { id: "cluster-2", venueId: "venue-2", tenantId: null },
    ],
  });
  assert.equal(simulated.ok, true);
  assert.equal(simulated.aligned[0].tenantId, tenantId);
  assert.equal(simulated.aligned[1].tenantId, tenantId);
  assert.notEqual(simulated.aligned[0].id, simulated.aligned[0].tenantId);
  assert.notEqual(simulated.aligned[0].id, simulated.aligned[0].venueId);
  assert.notEqual(tenantId, "venue-1");
  assert.notEqual(tenantId, "venue-2");
  assert.notEqual("cluster-1", "venue-1");

  const distinct = identitiesRemainDistinct({
    tenantId,
    venueId: "venue-1",
    clusterId: "cluster-1",
    courtId: "court-1",
  });
  assert.equal(distinct.tenantEqualsVenue, false);
  assert.equal(distinct.venueEqualsCluster, false);
  assert.equal(distinct.clusterEqualsCourt, false);
});

test("Production precheck evidence: COURT_CLUSTERS_TENANT_ID_EXISTS=NO is not data corruption", () => {
  const result = collectWave3PrecheckBlockers(PRODUCTION_PRECHECK_EVIDENCE_2026_08);
  assert.equal(
    result.columnState,
    "ABSENT_EXPECTED_TO_BE_CREATED_BY_02"
  );
  assert.equal(result.blocked, false);
  assert.equal(result.dataCorruption, false);
  assert.deepEqual(result.column.pipeline, [
    "EXPECTED_PRE_SCHEMA",
    "CREATED_BY_02",
    "BACKFILLED_BY_03",
    "VERIFIED_BY_05",
  ]);
  assert.equal(result.productionBackupGate, "STILL_REQUIRED");
  assert.equal(PRODUCTION_PRECHECK_EVIDENCE_2026_08.restoreReadiness, "UNKNOWN");
});

test("incompatible existing cluster tenant type or FK is PRESENT_INCOMPATIBLE BLOCK", () => {
  const badType = collectWave3PrecheckBlockers({
    courtClustersTenantIdExists: true,
    clusterTenantDataType: "uuid",
  });
  assert.equal(badType.columnState, "PRESENT_INCOMPATIBLE");
  assert.equal(badType.blocked, true);

  const badFk = collectWave3PrecheckBlockers({
    courtClustersTenantIdExists: true,
    clusterTenantDataType: "text",
    clusterTenantFkTable: "venues",
  });
  assert.equal(badFk.columnState, "PRESENT_INCOMPATIBLE");
  assert.equal(badFk.blocked, true);
});

test("SQL package: 02 creates court_clusters.tenant_id text idempotently", () => {
  const apply = readSql("02_APPLY_platform_tenants_and_venue_fk.sql");
  assert.match(
    apply,
    /ALTER TABLE public\.court_clusters\s+ADD COLUMN IF NOT EXISTS tenant_id text/s
  );
  assert.match(apply, /tenant_id must resolve from the parent Venue/);
  assert.match(apply, /Never infer Venue identity from Tenant identity/);
  assert.match(apply, /Physical parent remains court_clusters\.venue_id/);
  assert.doesNotMatch(apply, /ENABLE ROW LEVEL SECURITY/);
});

test("SQL package: 03 aligns cluster tenant from parent venue then enforces NOT NULL/FK/index", () => {
  const backfill = readSql("03_BACKFILL.sql");
  const clusterUpdate = backfill.match(
    /UPDATE public\.court_clusters cc[\s\S]*?WHERE cc\.venue_id = v\.id/
  );
  assert.ok(clusterUpdate, "cluster parent-venue UPDATE missing");
  assert.match(clusterUpdate[0], /SET tenant_id = v\.tenant_id/);
  assert.doesNotMatch(clusterUpdate[0], /SET tenant_id = cc\.id/);
  assert.doesNotMatch(clusterUpdate[0], /SET tenant_id = v\.id/);
  assert.doesNotMatch(backfill, /SET venue_id = .*tenant_id/);
  assert.match(backfill, /WAVE3_CLUSTER_ORPHAN_VENUE/);
  assert.match(backfill, /WAVE3_CLUSTER_TENANT_MISMATCH_PARENT_VENUE/);
  assert.match(backfill, /ALTER TABLE public\.court_clusters\s+ALTER COLUMN tenant_id SET NOT NULL/);
  assert.match(backfill, /court_clusters_tenant_id_fkey/);
  assert.match(
    backfill,
    /FOREIGN KEY \(tenant_id\) REFERENCES public\.platform_tenants\(id\)/
  );
  assert.match(backfill, /CREATE INDEX IF NOT EXISTS court_clusters_tenant_id_idx/);
});

test("SQL package: 01 classifies absent and present cluster tenant column; 05 proves post-state", () => {
  const precheck = readSql("01_PRECHECK.sql");
  assert.match(precheck, /ABSENT_EXPECTED_TO_BE_CREATED_BY_02/);
  assert.match(precheck, /PRESENT_COMPATIBLE/);
  assert.match(precheck, /PRESENT_INCOMPATIBLE/);
  assert.match(precheck, /EXPECTED_PRE_SCHEMA/);
  assert.match(precheck, /CREATED_BY_02/);
  assert.match(precheck, /not data corruption/);
  assert.match(precheck, /CLUSTER_ORPHAN_PARENT_VENUES/);
  assert.match(precheck, /CLUSTER_TENANT_PARENT_MISMATCH/);
  assert.match(precheck, /PROFILE_HOME_VENUE_ORPHANS/);
  assert.match(precheck, /CLUB_TENANT_BOOTSTRAP_ORPHANS/);
  assert.match(precheck, /SUBSCRIPTION_TENANT_BOOTSTRAP_ORPHANS/);
  assert.doesNotMatch(precheck, /INSERT INTO/);
  assert.doesNotMatch(precheck, /UPDATE public\./);
  assert.doesNotMatch(precheck, /ALTER TABLE/);

  const verify = readSql("05_VERIFY.sql");
  assert.match(verify, /COURT_CLUSTERS_TENANT_ID_EXISTS/);
  assert.match(verify, /CLUSTERS_MISSING_TENANT/);
  assert.match(verify, /CLUSTERS_ORPHAN_VENUE/);
  assert.match(verify, /CLUSTERS_TENANT_MISMATCH_PARENT_VENUE/);
  assert.match(verify, /COURT_CLUSTERS_TENANT_FK/);
  assert.match(verify, /COURT_CLUSTERS_TENANT_INDEX/);
  assert.match(verify, /READ-ONLY/);
  assert.doesNotMatch(verify, /INSERT INTO/);
  assert.doesNotMatch(verify, /UPDATE public\./);
  assert.doesNotMatch(verify, /ALTER TABLE/);
});

test("docs record two pre-migration shapes and do not assume tenant_id everywhere", () => {
  const owner = readSql("00_OWNER_README.md");
  assert.doesNotMatch(owner, /already has both `venue_id` and `tenant_id` \(good\)/);
  assert.match(owner, /Two legitimate pre-migration shapes/);
  assert.match(owner, /EXPECTED_PRE_SCHEMA/);
  assert.match(owner, /PRODUCTION_BACKUP_GATE=STILL_REQUIRED/);

  const readme = fs.readFileSync(README, "utf8");
  assert.match(readme, /Staging/);
  assert.match(readme, /Production/);
  assert.match(readme, /Absent \(Phase 23/);

  const rollback = readSql("99_ROLLBACK.md");
  assert.match(rollback, /court_clusters_tenant_id_fkey/);
  assert.match(rollback, /court_clusters_tenant_id_idx/);
  assert.match(rollback, /full Wave 3[\s\S]*database rollback/);
  assert.match(rollback, /Venue remains the physical parent/);
  assert.match(rollback, /Prefer restore from a Production backup/);
});

test("frozen contracts and Organization remain untouched by this remediation", () => {
  const contract02 = fs.readFileSync(
    path.join(process.cwd(), "src/core/platform/contracts/platformScope.js"),
    "utf8"
  );
  const contract07 = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/features/competition-core/contracts/competitionCourtAdapterContract.js"
    ),
    "utf8"
  );
  assert.match(contract02, /PlatformScope|PLATFORM_SCOPE|platformScope/);
  assert.match(contract07, /COMPETITION_COURT_ADAPTER_CONTRACT_VERSION/);
  const apply = readSql("02_APPLY_platform_tenants_and_venue_fk.sql");
  assert.doesNotMatch(apply, /CREATE TABLE.*organization/i);
  assert.match(apply, /Does NOT implement Organization/);
});

/**
 * Batch 5 — Architecture locks for canonical tenant/venue/club boundaries.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CLUB_ID_OWNER,
  CLUB_OPERATIONAL_COURT_ACCESS_OWNER,
  CLUSTER_ID_OWNER,
  COURT_CLUSTERS_VENUE_ID_SEMANTICS,
  D4_VENUE_BOUNDARY_STATUS,
  NEW_DUPLICATE_IDENTITY_CONTRACTS_CREATED,
  NEW_SQL_REQUIRED,
  PHYSICAL_COURT_ID_OWNER,
  TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION,
  TENANT_ID_OWNER,
  VENUE_ID_OWNER,
} from "../src/features/court-resource/constants/courtOperationsOwnership.js";
import { COMPETITION_COURT_ADAPTER_CONTRACT_VERSION } from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CERTIFIED_3A = {
  "01_PRECHECK.sql": "872E0CEC98FEEB442572C70E9C2602FADF0C835C030BCEBBE3E6CEBB020F1637",
  "02_APPLY.sql": "53C6A9EF7EE88FA9A90B3684D15CDF2B91BEB183FCA6D73306BFC0D4DCB265FA",
  "03_VERIFY.sql": "BDE5342AD6CAE44B7482F9B80C9392B3794F762B2665CDB7D885E9CC12B85996",
  "04_ROLLBACK.sql": "93ABA92D6883874DDFEF0F7600238ECD8D5BCD8B83716CF887235B0801A47FA6",
};
const CERTIFIED_3B = {
  "01_PRECHECK.sql": "528A482CC77EDEA38DC35B9A5323E00B82C4C25894D06B15A27B1E422FE8B13C",
  "02_APPLY.sql": "61418ABABBB6B12CF1E956822573154D7588D59C14B9D9603A867C464A87B032",
  "03_VERIFY.sql": "7766F80784EE0724626C7D7BF6C4EFF5185D7F1CC59C42F0113DC25400C18934",
  "04_ROLLBACK.sql": "43E39245D3698ED21565AE43C2322A64A474122E51730BAABA7B9A5AAC280898",
};
const CERTIFIED_D4 = {
  "01_PRECHECK.sql": "29011AE97747835174CD47B3E5DAC2F4C25E89A1ECF620C3781475B0DAA64478",
  "02_APPLY.sql": "15BA263207B2EE871C3860CFD61F0E810A591D31AFB4A5B3D95FA3C13A166F0B",
  "03_VERIFY.sql": "73E30440FB61E63DF87A1D036B28B69FC3F68C75BA491C798B9722DD6BC6B580",
  "04_ROLLBACK.sql": "7E537191E6B3F4EFA8D13BEA1F22B5B2F12BFEEFF2A00F375BAD6F9AAF7DF8CB",
};
const CERTIFIED_BATCH1 = {
  "01_PRECHECK.sql": "C4BE47CA6E2C43A15780334900BC656C7F2214886190DBA7B8FE8E19A01A0A42",
  "02_APPLY.sql": "8CBA799C88FE9F7FD8B33CDD7DE9B623A054A4644E0E83353D28CB357318CDE1",
  "03_VERIFY.sql": "DA8EBA268697EE75FA4B6BB0088635CA9486EB908C55E05D9903961251609177",
  "04_ROLLBACK.sql": "5B97DE5664CEEE974D870D326524BE3AB69F0BB600C2347FC0384F02B60A6A8D",
};
const CERTIFIED_BATCH2 = {
  "01_PRECHECK.sql": "4A3858932D8E4990459505101C7BB8BEFE63D4C68AADF2D8475C6146778DEC21",
  "02_APPLY.sql": "9B13B0A976E5264B9AFCD5F02BCD53AB8F060E211ACF90CCB44D34A961321C92",
  "03_VERIFY.sql": "1306CBCDB5EE3FA5290E4FF39DFD1BD0673738979A689DB3CC947F11B5B60F0D",
  "04_ROLLBACK.sql": "C9B5F56FBBA96C41526E75637E96A79C8F16E3BFA8A0F4B46A0A8886951EF52E",
};
const CERTIFIED_BATCH3 = {
  "01_PRECHECK.sql": "B028499D1869EDF2EBF00ADF5BF294D301D03DC66E03B6C41085E1A68B0825B2",
  "02_APPLY.sql": "ACDFC0A7EEC0D4DC07C810CDC4C5D7927120C07AB3B0394D649D83BBCB5C288B",
  "03_VERIFY.sql": "35286678926B73F6E1DC6C494391147D7FB34DB260B404414BEDADC661ABA0E0",
  "04_ROLLBACK.sql": "357F3BF6FFF4F17E53E9E88C173AD799CD41D542AF18243D7BB868EFE997A51F",
};
const CERTIFIED_BATCH4 = {
  "01_PRECHECK.sql": "46BF059A42656F1C7A5C9ED6F612C42DB7A31DD6AB16A82BEAD7E5DD21D742BC",
  "02_APPLY.sql": "E887EADD6462CFEAA8977F0376B86DFF21ACEDE741EE4E3EFC83B793E50F267A",
  "03_VERIFY.sql": "0FAEC984F70884DEC002F438D07DD569265C439F9AD78E974765606DD6488C0E",
  "04_ROLLBACK.sql": "F7C05B207BA385DD2D2832C71DA47743DDB8C75D93836771317009FC9DBFFAD1",
};

const HEAD_A_CONTRACT_SHA256 =
  "B3DC18602C5AEE63CD565622FFADD6388F3DFBA38A21056570F3BD7526BB5CE6";

const CANONICAL_PATH_FILES = [
  "src/features/court-resource/services/courtResourceGateway.js",
  "src/features/court-resource/services/canonicalCourtInventoryService.js",
  "src/features/court-resource/services/courtOperationsBookingApplication.js",
  "src/features/court-resource/services/courtOperationsResourceBlockApplication.js",
  "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js",
  "src/features/court-resource/scope/courtOperationsScope.js",
];

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function sha256File(rel) {
  return createHash("sha256").update(readFileSync(path.join(root, rel))).digest("hex").toUpperCase();
}

function assertCertified(dir, expected) {
  for (const [name, hash] of Object.entries(expected)) {
    assert.equal(sha256File(path.posix.join(dir, name)), hash, `${dir}/${name}`);
  }
}

function importedModules(source) {
  return [...source.matchAll(/(?:import|export)\s+[^'"\n]*from\s+["']([^"']+)["']/g)].map(
    (match) => match[1]
  );
}

test("Batch 5 ownership constants and honesty markers", () => {
  assert.equal(TENANT_ID_OWNER, "PLATFORM_CANONICAL_ORGANIZATION");
  assert.equal(VENUE_ID_OWNER, "2.1_VENUE_MANAGEMENT");
  assert.equal(CLUB_ID_OWNER, "2.3_CLUB_MANAGEMENT");
  assert.equal(CLUSTER_ID_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(PHYSICAL_COURT_ID_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(CLUB_OPERATIONAL_COURT_ACCESS_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION, "NO");
  assert.equal(COURT_CLUSTERS_VENUE_ID_SEMANTICS, "organization_parent_id_debt");
  assert.equal(D4_VENUE_BOUNDARY_STATUS, "COUPLED_TO_VENUES_AS_TENANT_OUT_OF_SCOPE");
  assert.equal(NEW_SQL_REQUIRED, "NO");
  assert.equal(NEW_DUPLICATE_IDENTITY_CONTRACTS_CREATED, "NO");

  const ownership = read("src/features/court-resource/OWNERSHIP.md");
  assert.match(ownership, /Frozen for Batch 5/i);
  assert.match(ownership, /TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION=NO/);
  assert.match(ownership, /COURT_CLUSTERS_VENUE_ID_SEMANTICS=organization_parent_id_debt/);
  assert.match(ownership, /D4_VENUE_BOUNDARY_STATUS=COUPLED_TO_VENUES_AS_TENANT_OUT_OF_SCOPE/);
  assert.match(ownership, /NEW_SQL_REQUIRED=NO/);
  assert.match(ownership, /CANONICAL_RESOURCE_BLOCKS_DEFAULT=false/);
  assert.match(ownership, /DAILY_PLAY_RUNTIME_RESOURCE_BLOCK_CERTIFICATION_DEFERRED=YES/);
  assert.match(ownership, /ClubContext \/ active club selection is \*\*UI selection only\*\*/i);
  assert.match(ownership, /Club Management does not own court access/i);
  assert.match(ownership, /Venue Management does not own Physical Court identity/i);
});

test("Phase 3A / 3B / D4 / Batch1–4 certified SQL unchanged", () => {
  assertCertified("docs/v5/migrations/court-resource-post427-canonical-reconciliation-01", CERTIFIED_3A);
  assertCertified("docs/v5/migrations/court-resource-phase3b-canonical-reservation-01", CERTIFIED_3B);
  assertCertified(
    "docs/v5/migrations/court-resource-phase3b-daily-play-interval-authority-01",
    CERTIFIED_D4
  );
  assertCertified("docs/v5/migrations/court-resource-canonical-inventory-read-01", CERTIFIED_BATCH1);
  assertCertified(
    "docs/v5/migrations/court-resource-canonical-owner-reservation-read-01",
    CERTIFIED_BATCH2
  );
  assertCertified(
    "docs/v5/migrations/court-resource-canonical-booking-lifecycle-01",
    CERTIFIED_BATCH3
  );
  assertCertified(
    "docs/v5/migrations/court-resource-canonical-resource-blocks-01",
    CERTIFIED_BATCH4
  );
});

test("HEAD_A_V1 contract unchanged", () => {
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.equal(
    sha256File("src/features/competition-core/contracts/competitionCourtAdapterContract.js"),
    HEAD_A_CONTRACT_SHA256
  );
});

test("canonical paths do not invent tenantId from venueId", () => {
  for (const rel of CANONICAL_PATH_FILES) {
    const source = read(rel);
    assert.doesNotMatch(source, /tenantId\s*\|\|\s*venueId/, rel);
    assert.doesNotMatch(source, /venueId\s*\|\|\s*tenantId/, rel);
    assert.doesNotMatch(source, /tenant_id\s*\|\|\s*venue_id/, rel);
    assert.doesNotMatch(source, /venue_id\s*\|\|\s*tenant_id/, rel);
  }
});

test("canonical paths do not use clubStorage / loadCourtsForClub / club_data_v3 as identity authority", () => {
  const locked = [
    "src/features/court-resource/services/canonicalCourtInventoryService.js",
    "src/features/court-resource/services/courtOperationsBookingApplication.js",
    "src/features/court-resource/services/courtOperationsResourceBlockApplication.js",
    "src/features/court-resource/scope/courtOperationsScope.js",
    "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js",
  ];
  for (const rel of locked) {
    const source = read(rel);
    for (const spec of importedModules(source)) {
      assert.doesNotMatch(spec, /clubStorage|club_data_v3/, rel);
    }
    assert.doesNotMatch(source, /\bloadCourtsForClub\s*\(/, rel);
    assert.doesNotMatch(source, /\bloadClubData\s*\(/, rel);
    assert.doesNotMatch(source, /registered_cluster_id/, rel);
  }
});

test("NEW_DUPLICATE_IDENTITY_CONTRACTS_CREATED=NO", () => {
  assert.equal(
    existsSync(path.join(root, "src/features/court-resource/contracts/CourtOperationsTenantContract.js")),
    false
  );
  assert.equal(
    existsSync(path.join(root, "src/features/court-resource/contracts/CourtOperationsClubContract.js")),
    false
  );
  assert.equal(
    existsSync(path.join(root, "src/features/court-resource/contracts/VenueContractV2.js")),
    false
  );
  assert.equal(existsSync(path.join(root, "src/features/court-resource/scope/courtOperationsScope.js")), true);
  assert.equal(
    existsSync(path.join(root, "src/features/court-resource/platform/courtResourcePlatformAdapter.js")),
    true
  );
  assert.equal(
    existsSync(path.join(root, "src/features/court-resource/contracts/canonicalClubBoundary.js")),
    true
  );
  assert.equal(
    existsSync(path.join(root, "src/features/court-resource/contracts/canonicalVenueBoundary.js")),
    true
  );
  const scope = read("src/features/court-resource/scope/courtOperationsScope.js");
  assert.match(scope, /projectCourtOperationsClubScope|projectClubScope/);
  assert.match(scope, /TENANT_VENUE_COLLAPSE_DENIED|MISSING_TENANT_ID/);
});

test("no Batch 5 SQL package authored", () => {
  assert.equal(
    existsSync(path.join(root, "docs/v5/migrations/court-resource-canonical-tenant-venue-club-01")),
    false
  );
  assert.equal(NEW_SQL_REQUIRED, "NO");
});

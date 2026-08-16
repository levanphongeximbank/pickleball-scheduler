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
const CERTIFIED_BATCH1 = {
  "01_PRECHECK.sql": "BD908D2570E30D91501336F03CA2FFA985CF68009C16888317404E226BACEA3E",
  "02_APPLY.sql": "5DAE46DD4F0415509A73063F084F7AE14E47F6EF9AA6CBEDA3F48D07D529AEE6",
  "03_VERIFY.sql": "93E9FB7A4B2E13852358D2F0B6DEA725B55331330688750B835E2E703F119264",
  "04_ROLLBACK.sql": "564A4788DFF53E213802CF6E2AD1AEF7A3C0C106B1BB6FC16F880EE5E1F26D9E",
};
const CERTIFIED_BATCH2 = {
  "01_PRECHECK.sql": "B803F8185F7545B39566B146D0A85D5A21CAA4ADDEC48026F7E305D162F46392",
  "02_APPLY.sql": "21B37EE93ED8078707E6CD4B7BDF0EC19628C2ADBC1E0CC06D21DD9A541B116A",
  "03_VERIFY.sql": "8360CBA29100DA17CDD11DE439BE1AD57394265F5B048FCD070E80ACDD98E7C8",
  "04_ROLLBACK.sql": "6F3F19C551B7612BDDC2B438A2A08CCAE393A9E3EADCD5B5BCC97188011DE944",
};
const CERTIFIED_BATCH3 = {
  "01_PRECHECK.sql": "B028499D1869EDF2EBF00ADF5BF294D301D03DC66E03B6C41085E1A68B0825B2",
  "02_APPLY.sql": "ACDFC0A7EEC0D4DC07C810CDC4C5D7927120C07AB3B0394D649D83BBCB5C288B",
  "03_VERIFY.sql": "35286678926B73F6E1DC6C494391147D7FB34DB260B404414BEDADC661ABA0E0",
  "04_ROLLBACK.sql": "357F3BF6FFF4F17E53E9E88C173AD799CD41D542AF18243D7BB868EFE997A51F",
};
const CERTIFIED_BATCH4 = {
  "01_PRECHECK.sql": "0E44A37ED5F25C775155799BA990CCC0EBEBA83C308134CAB3DA9BF558B01915",
  "02_APPLY.sql": "6F18980CFA37EE9D6A9DBF418915FD99EFC34BD53ED9F664492961A82212DB2E",
  "03_VERIFY.sql": "70DFF23E9A6CD92B1D67514314E61FBF2AB0FD7611A91EF0DAC2711AE724AEE6",
  "04_ROLLBACK.sql": "6F83EFFB1BDA34E85B55159F4D585B522DF298074B1F33E5471AAFD1F1C1F6C4",
};

const HEAD_A_CONTRACT_SHA256 =
  "B9F7FE3F36786383A7A1C2027E5D1B93D4917BA9365CA98F88DE96529C4C6B1C";

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
  return createHash("sha256").update(readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n"), "utf8").digest("hex").toUpperCase();
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

test("Batch 5/8 ownership constants and honesty markers", () => {
  assert.equal(TENANT_ID_OWNER, "PLATFORM_CANONICAL_ORGANIZATION");
  assert.equal(VENUE_ID_OWNER, "2.1_VENUE_MANAGEMENT");
  assert.equal(CLUB_ID_OWNER, "2.3_CLUB_MANAGEMENT");
  assert.equal(CLUSTER_ID_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(PHYSICAL_COURT_ID_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(CLUB_OPERATIONAL_COURT_ACCESS_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION, "NO");
  assert.equal(COURT_CLUSTERS_VENUE_ID_SEMANTICS, "canonical_venue_id");
  assert.equal(D4_VENUE_BOUNDARY_STATUS, "COUPLED_TO_VENUES_AS_TENANT_OFF_PATH_ONLY");
  // Batch 8 authored cluster tenant/venue SQL; prior certified packages unchanged.
  assert.equal(NEW_SQL_REQUIRED, "YES");
  assert.equal(NEW_DUPLICATE_IDENTITY_CONTRACTS_CREATED, "NO");

  const ownership = read("src/features/court-resource/OWNERSHIP.md");
  assert.match(ownership, /Frozen for Batch 8/i);
  assert.match(ownership, /TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION=NO/);
  assert.match(ownership, /COURT_CLUSTERS_VENUE_ID_SEMANTICS=canonical_venue_id/);
  assert.match(ownership, /COURT_CLUSTERS_VENUE_ID_ORG_PARENT_DEBT_ON_CANONICAL_PATH=NO/);
  assert.match(ownership, /D4_VENUE_BOUNDARY_STATUS=COUPLED_TO_VENUES_AS_TENANT_OFF_PATH_ONLY/);
  assert.match(ownership, /NEW_SQL_REQUIRED=YES/);
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

test("no Batch 5 identity SQL package authored (Batch 7 live SQL is separate)", () => {
  assert.equal(
    existsSync(path.join(root, "docs/v5/migrations/court-resource-canonical-tenant-venue-club-01")),
    false
  );
  assert.equal(NEW_DUPLICATE_IDENTITY_CONTRACTS_CREATED, "NO");
  assert.equal(
    existsSync(path.join(root, "docs/v5/migrations/court-operations-live-resource-runtime-01")),
    true
  );
});

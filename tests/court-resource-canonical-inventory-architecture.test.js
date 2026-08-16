import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COURT_ACCESS_AUTHORITY_OWNER,
  COURT_ACCESS_AUTHORITY_TABLE,
  COURT_CLUSTER_TOPOLOGY_TABLE,
  COURT_COUNT_IS_IDENTITY,
  COURT_MASTER_OWNER,
  COURT_MASTER_TABLE,
  COURT_RESOURCE_GATEWAY_OWNER,
  COURT_RESOURCE_OWNER,
  CLUSTER_ID_IS_IDENTITY,
  COMPETITION_PROVIDER_BINDING_OWNER,
  DISPLAY_LABEL_IS_IDENTITY,
  PHYSICAL_COURT_ID_IS_IDENTITY,
  CANONICAL_LIST_ELIGIBLE_RPC,
  CANONICAL_LIST_OWNER_RESERVATIONS_RPC,
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

const HEAD_A_CONTRACT_SHA256 =
  "B3DC18602C5AEE63CD565622FFADD6388F3DFBA38A21056570F3BD7526BB5CE6";

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function sha256File(rel) {
  return createHash("sha256").update(readFileSync(path.join(root, rel))).digest("hex").toUpperCase();
}

function extractNamedFunction(source, name) {
  const needles = [
    `export async function ${name}`,
    `export function ${name}`,
    `async function ${name}`,
    `function ${name}`,
  ];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.notEqual(start, -1, `missing function ${name}`);
  const signatureEnd = source.indexOf(")", start);
  const brace = source.indexOf("{", signatureEnd);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed function ${name}`);
}

function extractExportedFunction(source, name) {
  return extractNamedFunction(source, name);
}

function importedModules(source) {
  return [...source.matchAll(/(?:import|export)\s+[^'"\n]*from\s+["']([^"']+)["']/g)].map(
    (match) => match[1]
  );
}

function assertCertified(dir, expected) {
  for (const [name, hash] of Object.entries(expected)) {
    assert.equal(sha256File(path.posix.join(dir, name)), hash, name);
  }
}

test("Court Resource ownership is frozen to 2.2 Court Operations", () => {
  assert.equal(COURT_RESOURCE_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(COURT_RESOURCE_GATEWAY_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(COURT_MASTER_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(COURT_ACCESS_AUTHORITY_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(COMPETITION_PROVIDER_BINDING_OWNER, "2.2_COURT_OPERATIONS");
  const ownership = read("src/features/court-resource/OWNERSHIP.md");
  assert.match(ownership, /COURT_RESOURCE_OWNER=2\.2_COURT_OPERATIONS/);
  assert.match(ownership, /Club Management does not own court access/i);
  assert.match(ownership, /Venue Management does not own Physical Court identity/i);
  assert.equal(PHYSICAL_COURT_ID_IS_IDENTITY, true);
  assert.equal(CLUSTER_ID_IS_IDENTITY, false);
  assert.equal(COURT_COUNT_IS_IDENTITY, false);
  assert.equal(DISPLAY_LABEL_IS_IDENTITY, false);
});

test("canonical inventory service cannot import legacy club inventory", () => {
  const source = read("src/features/court-resource/services/canonicalCourtInventoryService.js");
  for (const spec of importedModules(source)) {
    assert.doesNotMatch(spec, /clubStorage|club_data_v3|legacyCourtIdentityMapping|venue-court/);
  }
  assert.doesNotMatch(source, /\bloadCourtsForClub\s*\(/);
  assert.doesNotMatch(source, /\bloadClubData\s*\(/);
  assert.doesNotMatch(source, /\bloadCourtsFromLegacy\s*\(/);
  assert.doesNotMatch(source, /\blocalStorage\b/);
  assert.doesNotMatch(source, /features\/competition-core/);
  assert.match(source, /evaluateClubOperationalAccess/);
  assert.match(source, /COURT_MASTER_TABLE/);
  assert.match(source, /COURT_ACCESS_AUTHORITY_TABLE/);
});

test("canonical inventory client cannot fall back to club blob storage", () => {
  const source = read("src/features/court-resource/services/canonicalCourtInventoryClient.js");
  for (const spec of importedModules(source)) {
    assert.doesNotMatch(spec, /clubStorage|club_data_v3|legacyCourtIdentityMapping|venue-court/);
  }
  assert.doesNotMatch(source, /\bloadCourtsForClub\s*\(/);
  assert.doesNotMatch(source, /\bloadClubData\s*\(/);
  assert.doesNotMatch(source, /\bloadCourtsFromLegacy\s*\(/);
  assert.doesNotMatch(source, /\blocalStorage\b/);
  assert.match(source, /client\.rpc\(CANONICAL_LIST_ELIGIBLE_RPC/);
});

test("CourtResourceGateway.listEligibleCourts is bound to canonical inventory", () => {
  const gateway = read("src/features/court-resource/services/courtResourceGateway.js");
  const fn = extractExportedFunction(gateway, "listEligibleCourts");
  assert.doesNotMatch(fn, /deps\.listCourts/);
  assert.doesNotMatch(fn, /loadCourtsFromLegacy/);
  assert.doesNotMatch(fn, /loadCourtsForClub/);
  assert.doesNotMatch(fn, /loadClubData/);
  assert.doesNotMatch(fn, /clubStorage/);
  assert.doesNotMatch(fn, /localStorage/);
  assert.doesNotMatch(fn, /club_data_v3/);
  assert.doesNotMatch(fn, /resolveLegacyCourtIdentity/);
  assert.match(fn, /deps\.listEligiblePhysicalCourts/);
  assert.match(gateway, /listEligiblePhysicalCourts:\s*productionListEligiblePhysicalCourts/);
  assert.match(gateway, /tenantId is required/);
});

test("identity rules: physicalCourtId is authority; cluster/count/label are not", () => {
  const service = read("src/features/court-resource/services/canonicalCourtInventoryService.js");
  assert.match(service, /identityAuthority: "physicalCourtId"/);
  assert.match(service, /clusterRole: "filter_topology_only"/);
  assert.match(service, /courtCountIsIdentity: false/);
  assert.match(service, /displayLabelIsIdentity: false/);
  assert.equal(COURT_MASTER_TABLE, "court_resource_physical_courts");
  assert.equal(COURT_ACCESS_AUTHORITY_TABLE, "court_resource_club_operational_access");
  assert.equal(COURT_CLUSTER_TOPOLOGY_TABLE, "court_clusters");
  assert.equal(CANONICAL_LIST_ELIGIBLE_RPC, "court_resource_list_eligible_courts");
});

test("additive inventory SQL is Court Operations-owned and fail closed", () => {
  const apply = read("docs/v5/migrations/court-resource-canonical-inventory-read-01/02_APPLY.sql");
  const precheck = read("docs/v5/migrations/court-resource-canonical-inventory-read-01/01_PRECHECK.sql");
  const verify = read("docs/v5/migrations/court-resource-canonical-inventory-read-01/03_VERIFY.sql");
  const rollback = read("docs/v5/migrations/court-resource-canonical-inventory-read-01/04_ROLLBACK.sql");
  const readme = read("docs/v5/migrations/court-resource-canonical-inventory-read-01/README.md");
  assert.match(apply, /CREATE FUNCTION public\.court_resource_list_eligible_courts/);
  assert.match(apply, /SECURITY DEFINER/);
  assert.match(apply, /auth\.uid\(\) IS NULL/);
  assert.match(apply, /court_resource_physical_courts/);
  assert.match(apply, /court_resource_club_operational_access/);
  assert.match(apply, /a\.status = 'enabled'/);
  assert.match(apply, /court_clusters/);
  assert.match(apply, /REVOKE ALL ON FUNCTION public\.court_resource_list_eligible_courts/);
  assert.match(apply, /GRANT EXECUTE ON FUNCTION public\.court_resource_list_eligible_courts/);
  assert.doesNotMatch(apply, /GRANT SELECT/);
  assert.doesNotMatch(apply, /club_data_v3/);
  assert.doesNotMatch(apply, /tournament_match|competition_/);
  assert.match(precheck, /STAGING_APPLY[\s\S]*NO/);
  assert.match(verify, /direct client table privilege exists/);
  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.court_resource_list_eligible_courts/);
  assert.doesNotMatch(rollback, /DROP TABLE/);
  assert.match(readme, /STAGING_APPLY=NO/);
  assert.match(readme, /PRODUCTION_APPLY=NO/);
});

test("Phase 3A / 3B / D4 certified SQL is unchanged", () => {
  assertCertified("docs/v5/migrations/court-resource-post427-canonical-reconciliation-01", CERTIFIED_3A);
  assertCertified("docs/v5/migrations/court-resource-phase3b-canonical-reservation-01", CERTIFIED_3B);
  assertCertified(
    "docs/v5/migrations/court-resource-phase3b-daily-play-interval-authority-01",
    CERTIFIED_D4
  );
});

test("Competition Court Contract A V1 is unchanged", () => {
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.equal(
    sha256File("src/features/competition-core/contracts/competitionCourtAdapterContract.js"),
    HEAD_A_CONTRACT_SHA256
  );
});

test("canonical provider passes native physicalCourtId and does not remap to legacy identity", () => {
  const adapter = read("src/features/competition-core/adapters/courtResourceCompetitionAdapter.js");
  assert.match(adapter, /2\.2 Court Operations/);
  assert.match(adapter, /PROVIDER_PHYSICAL_RELOCATION_DEFERRED=YES/);
  assert.match(adapter, /toGatewayPhysicalIdentity/);
  assert.match(adapter, /physicalCourtIds/);
  assert.doesNotMatch(adapter, /\bselectedCourtIds\b/);
  assert.doesNotMatch(adapter, /\blegacyCourtId\b/);
  assert.doesNotMatch(adapter, /\blegacyMappings\b/);
  assert.doesNotMatch(adapter, /\bresolveLegacyCourtIdentity\b/);
  assert.doesNotMatch(adapter, /\bclubStorage\b/);
  assert.doesNotMatch(adapter, /club_data_v3/);
  assert.doesNotMatch(adapter, /localStorage/);
  assert.doesNotMatch(adapter, /selectedCourtIds:\s*physicalCourtIds/);
  assert.doesNotMatch(adapter, /courtIds:\s*physicalCourtIds/);
  assert.doesNotMatch(adapter, /courtId:\s*physicalCourtId/);
});

test("canonical Gateway native physical IDs do not fall back to legacy resolver", () => {
  const gateway = read("src/features/court-resource/services/courtResourceGateway.js");
  const native = extractNamedFunction(gateway, "nativePhysicalCourtIdsOrFail");
  const resolveNative = extractNamedFunction(gateway, "resolvePhysicalIdsForCanonical");
  const resolveCompat = extractNamedFunction(gateway, "resolveCanonicalPhysicalIds");
  const reserve = extractNamedFunction(gateway, "reserveCourtsCanonical");
  const availability = extractNamedFunction(gateway, "getCourtAvailabilityCanonical");
  const release = extractNamedFunction(gateway, "releaseCourtsCanonical");
  const ownerRead = extractNamedFunction(gateway, "listOwnerReservationsCanonical");
  for (const fn of [native, resolveNative, resolveCompat, reserve, availability, release, ownerRead]) {
    assert.doesNotMatch(fn, /resolveLegacyCourtIdentity/);
    assert.doesNotMatch(fn, /resolveLegacyPhysicalCourt/);
    assert.doesNotMatch(fn, /loadBookingsForClub/);
    assert.doesNotMatch(fn, /loadCourtsForClub/);
    assert.doesNotMatch(fn, /clubStorage/);
    assert.doesNotMatch(fn, /club_data_v3/);
    assert.doesNotMatch(fn, /localStorage/);
    assert.doesNotMatch(fn, /legacyReservationAdapter/);
  }
  assert.doesNotMatch(native, /resolveLegacyPhysicalCourt/);
  assert.match(resolveNative, /hasNativePhysicalCourtIds/);
  assert.match(resolveNative, /nativePhysicalCourtIdsOrFail/);
  assert.match(gateway, /function shouldUseCanonicalReservationPath/);
  assert.match(gateway, /hasNativePhysicalCourtIds\(options\) \|\| canonicalCutoverEnabled/);
  assert.match(reserve, /resolvePhysicalIdsForCanonical/);
  assert.match(availability, /resolvePhysicalIdsForCanonical/);
  assert.match(ownerRead, /canonicalListOwnerReservations/);
  assert.doesNotMatch(ownerRead, /listLegacyTournamentReservations/);
  assert.match(gateway, /legacy\/gatewayLegacyDeps/);
});

test("additive owner-reservation SQL is Court Operations-owned and fail closed", () => {
  const apply = read("docs/v5/migrations/court-resource-canonical-owner-reservation-read-01/02_APPLY.sql");
  const precheck = read("docs/v5/migrations/court-resource-canonical-owner-reservation-read-01/01_PRECHECK.sql");
  const verify = read("docs/v5/migrations/court-resource-canonical-owner-reservation-read-01/03_VERIFY.sql");
  const rollback = read("docs/v5/migrations/court-resource-canonical-owner-reservation-read-01/04_ROLLBACK.sql");
  const readme = read("docs/v5/migrations/court-resource-canonical-owner-reservation-read-01/README.md");
  assert.equal(CANONICAL_LIST_OWNER_RESERVATIONS_RPC, "court_resource_list_owner_reservations");
  assert.match(apply, /CREATE FUNCTION public\.court_resource_list_owner_reservations/);
  assert.match(apply, /SECURITY DEFINER/);
  assert.match(apply, /auth\.uid\(\) IS NULL/);
  assert.match(apply, /court_resource_reservations/);
  assert.match(apply, /physicalCourtId/);
  assert.match(apply, /REVOKE ALL ON FUNCTION public\.court_resource_list_owner_reservations/);
  assert.match(apply, /GRANT EXECUTE ON FUNCTION public\.court_resource_list_owner_reservations/);
  assert.doesNotMatch(apply, /GRANT SELECT/);
  assert.doesNotMatch(apply, /club_data_v3/);
  assert.doesNotMatch(apply, /ALTER TABLE public\.court_resource_reservations/);
  assert.match(precheck, /STAGING_APPLY[\s\S]*NO/);
  assert.match(verify, /direct client table privilege exists/);
  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.court_resource_list_owner_reservations/);
  assert.doesNotMatch(rollback, /DROP TABLE/);
  assert.match(readme, /STAGING_APPLY=NO/);
  assert.match(readme, /PRODUCTION_APPLY=NO/);
});

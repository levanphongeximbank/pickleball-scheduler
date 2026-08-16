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

const HEAD_A_CONTRACT_SHA256 =
  "B9F7FE3F36786383A7A1C2027E5D1B93D4917BA9365CA98F88DE96529C4C6B1C";

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function sha256File(rel) {
  return createHash("sha256").update(readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n"), "utf8").digest("hex").toUpperCase();
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

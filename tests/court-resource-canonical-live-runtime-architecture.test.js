/**
 * Batch 7 architecture locks — Court Live Resource Runtime.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BOOKING_BUSINESS_OWNER,
  CANONICAL_BOOKING_BUSINESS_TABLE,
  CANONICAL_LIVE_BEGIN_SESSION_RPC,
  CANONICAL_LIVE_STATE_TABLE,
  CANONICAL_RESOURCE_BLOCK_BUSINESS_TABLE,
  CANONICAL_RESOURCE_SESSION_TABLE,
  COMPETITION_MATCH_ASSIGNMENT_OWNER,
  COMPETITION_MATCH_LIFECYCLE_OWNER,
  COMPETITION_SCORING_OWNER,
  COURT_LIVE_RESOURCE_RUNTIME_OWNER,
  COURT_RESOURCE_OWNER,
  RESOURCE_BLOCK_BUSINESS_OWNER,
} from "../src/features/court-resource/constants/courtOperationsOwnership.js";
import {
  CANONICAL_BOOKING_LIFECYCLE_DEFAULT,
} from "../src/features/court-resource/constants/canonicalBooking.js";
import {
  CANONICAL_RESOURCE_BLOCKS_DEFAULT,
} from "../src/features/court-resource/constants/canonicalResourceBlock.js";
import {
  CANONICAL_RESERVATION_CUTOVER_DEFAULT,
} from "../src/features/court-resource/constants/canonicalReservation.js";
import {
  CANONICAL_COURT_LIVE_RUNTIME_DEFAULT,
  COURT_LIVE_RUNTIME_IS_RESERVATION_SSOT,
  COURT_LIVE_RUNTIME_MATCH_LIFECYCLE_AUTHORITY,
  COURT_LIVE_RUNTIME_SCORING_AUTHORITY,
  LIVE_OCCUPANCY_USED_AS_RESERVATION_CONFLICT_AUTHORITY,
} from "../src/features/court-resource/constants/canonicalLiveRuntime.js";
import { CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT } from "../src/features/competition-engine/integration/court-adapters/canonicalCompetitionCourtAdapters.js";
import { COMPETITION_COURT_ADAPTER_CONTRACT_VERSION } from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import { COMPETITION_LIVE_INTEGRATION_MODEL } from "../src/features/court-resource/projections/courtLiveResourceUseProjection.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = "docs/v5/migrations/court-operations-live-resource-runtime-01";

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
const CERTIFIED_BATCH3 = {
  "01_PRECHECK.sql": "B028499D1869EDF2EBF00ADF5BF294D301D03DC66E03B6C41085E1A68B0825B2",
  "02_APPLY.sql": "ACDFC0A7EEC0D4DC07C810CDC4C5D7927120C07AB3B0394D649D83BBCB5C288B",
  "03_VERIFY.sql": "35286678926B73F6E1DC6C494391147D7FB34DB260B404414BEDADC661ABA0E0",
  "04_ROLLBACK.sql": "357F3BF6FFF4F17E53E9E88C173AD799CD41D542AF18243D7BB868EFE997A51F",
};

const HEAD_A_CONTRACT_SHA256 =
  "B9F7FE3F36786383A7A1C2027E5D1B93D4917BA9365CA98F88DE96529C4C6B1C";

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

function listJsFiles(relDir) {
  const absolute = path.join(root, relDir);
  return readdirSync(absolute)
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.posix.join(relDir, name));
}

test("Batch 7 live runtime ownership is Court Operations", () => {
  assert.equal(COURT_RESOURCE_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(COURT_LIVE_RESOURCE_RUNTIME_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(BOOKING_BUSINESS_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(RESOURCE_BLOCK_BUSINESS_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(COMPETITION_MATCH_ASSIGNMENT_OWNER, "2.13_COMPETITION_ENGINE");
  assert.equal(COMPETITION_MATCH_LIFECYCLE_OWNER, "2.13_COMPETITION_ENGINE");
  assert.equal(COMPETITION_SCORING_OWNER, "2.13_COMPETITION_ENGINE");
  assert.equal(CANONICAL_LIVE_STATE_TABLE, "court_operations_court_live_states");
  assert.equal(CANONICAL_RESOURCE_SESSION_TABLE, "court_operations_resource_sessions");
  assert.equal(CANONICAL_LIVE_BEGIN_SESSION_RPC, "court_operations_live_begin_resource_session");
  assert.equal(CANONICAL_BOOKING_BUSINESS_TABLE, "court_operations_bookings");
  assert.equal(CANONICAL_RESOURCE_BLOCK_BUSINESS_TABLE, "court_operations_resource_blocks");
  assert.equal(CANONICAL_COURT_LIVE_RUNTIME_DEFAULT, false);
  assert.equal(CANONICAL_BOOKING_LIFECYCLE_DEFAULT, false);
  assert.equal(CANONICAL_RESOURCE_BLOCKS_DEFAULT, false);
  assert.equal(CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT, false);
  assert.equal(CANONICAL_RESERVATION_CUTOVER_DEFAULT, false);
  assert.equal(COURT_LIVE_RUNTIME_IS_RESERVATION_SSOT, "NO");
  assert.equal(LIVE_OCCUPANCY_USED_AS_RESERVATION_CONFLICT_AUTHORITY, "NO");
  assert.equal(COURT_LIVE_RUNTIME_MATCH_LIFECYCLE_AUTHORITY, "NO");
  assert.equal(COURT_LIVE_RUNTIME_SCORING_AUTHORITY, "NO");
  assert.equal(
    COMPETITION_LIVE_INTEGRATION_MODEL,
    "GENERIC_LIVE_RESOURCE_USE_PROJECTION_ONE_WAY"
  );

  const ownership = read("src/features/court-resource/OWNERSHIP.md");
  assert.match(ownership, /COURT_LIVE_RESOURCE_RUNTIME_OWNER=2\.2_COURT_OPERATIONS/);
  assert.match(ownership, /COURT_LIVE_RUNTIME_IS_RESERVATION_SSOT=NO/);
  assert.match(ownership, /LIVE_RUNTIME_MATCH_LIFECYCLE_AUTHORITY=NO/);
  assert.match(ownership, /LIVE_RUNTIME_SCORING_AUTHORITY=NO/);
  assert.match(ownership, /CANONICAL_COURT_LIVE_RUNTIME_DEFAULT=false/);
  assert.match(ownership, /LIVE_RESOURCE_RUNTIME_REDESIGN_DEFERRED=NO/);
  assert.match(ownership, /current occupancy/);
  assert.match(ownership, /GENERIC_LIVE_RESOURCE_USE_PROJECTION_ONE_WAY/);
});

test("Phase 3A / 3B / D4 / Batch3 certified SQL unchanged", () => {
  assertCertified("docs/v5/migrations/court-resource-post427-canonical-reconciliation-01", CERTIFIED_3A);
  assertCertified("docs/v5/migrations/court-resource-phase3b-canonical-reservation-01", CERTIFIED_3B);
  assertCertified(
    "docs/v5/migrations/court-resource-phase3b-daily-play-interval-authority-01",
    CERTIFIED_D4
  );
  assertCertified(
    "docs/v5/migrations/court-resource-canonical-booking-lifecycle-01",
    CERTIFIED_BATCH3
  );
});

test("HEAD_A_V1 contract unchanged", () => {
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.equal(
    sha256File("src/features/competition-core/contracts/competitionCourtAdapterContract.js"),
    HEAD_A_CONTRACT_SHA256
  );
});

test("Batch 7 SQL package is additive and authored", () => {
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
  assert.match(apply, /CREATE TABLE public\.court_operations_court_live_states/);
  assert.match(apply, /CREATE TABLE public\.court_operations_resource_sessions/);
  assert.match(apply, /CREATE TABLE public\.court_operations_live_runtime_commands/);
  assert.match(apply, /court_operations_live_begin_resource_session/);
  assert.match(apply, /court_operations_live_end_resource_session/);
  assert.match(apply, /court_operations_live_set_operational_state/);
  assert.match(apply, /AVAILABLE|UNAVAILABLE_NOW|OUT_OF_SERVICE_NOW/);
  assert.match(apply, /status = 'active'/);
  assert.doesNotMatch(apply, /INSERT INTO public\.court_resource_reservations/);
  assert.doesNotMatch(apply, /UPDATE public\.court_resource_reservations/);
  assert.doesNotMatch(apply, /DELETE FROM public\.court_resource_reservations/);
  assert.doesNotMatch(apply, /ALTER TABLE public\.court_resource_reservations/);
  assert.doesNotMatch(apply, /\bscore\b|\bwinner\b|dreambreaker/i);
  assert.match(apply, /STAGING|LOCAL AUTHORING|NOT APPLIED/i);
  const identity = read(`${PKG}/MIGRATION_IDENTITY.txt`);
  assert.match(identity, /STAGING_APPLY=NO/);
  assert.match(identity, /PRODUCTION_APPLY=NO/);
  assert.match(identity, /20260816200000/);
});

test("live runtime application cannot import scoring / match / capacity writers", () => {
  const files = [
    "src/features/court-resource/services/courtOperationsLiveRuntimeApplication.js",
    "src/features/court-resource/services/canonicalLiveRuntimeClient.js",
    "src/features/court-resource/constants/canonicalLiveRuntime.js",
    "src/features/court-resource/projections/courtLiveResourceUseProjection.js",
  ];
  for (const rel of files) {
    const source = read(rel);
    for (const spec of importedModules(source)) {
      assert.doesNotMatch(
        spec,
        /clubStorage|courtBookingEngine|matchEngine|scoring|dreambreaker|bracket|referee/i,
        rel
      );
    }
    assert.doesNotMatch(source, /\.from\(\s*["']court_resource_reservations["']\s*\)/);
    assert.doesNotMatch(source, /reserveCourts\s*\(/);
    assert.doesNotMatch(source, /releaseCourts\s*\(/);
    assert.doesNotMatch(source, /assignMatchCourt\s*\(/);
    assert.doesNotMatch(source, /\blocalStorage\b/);
  }
});

test("getCourtAvailability does not use occupancy as conflict authority", () => {
  const gateway = read("src/features/court-resource/services/courtResourceGateway.js");
  assert.doesNotMatch(gateway, /beginResourceSession|occupancyState|court_operations_court_live/);
  assert.doesNotMatch(gateway, /LIVE_OCCUPANCY_USED_AS_RESERVATION_CONFLICT_AUTHORITY\s*=\s*YES/);
});

test("CourtStatusBoard canonical path uses Live Runtime; legacy retained", () => {
  const source = read("src/pages/courtManagement/CourtStatusBoard.jsx");
  assert.match(source, /isCanonicalCourtLiveRuntime/);
  assert.match(source, /setCurrentOperationalState/);
  assert.match(source, /setCourtOperationalStatus/);
  assert.match(source, /Current operational state \(NOW\)/);
  assert.match(source, /Schedule a resource block/);
  assert.doesNotMatch(source, /createResourceBlock/);
});

test("Mode Adapter B still capacity-only via Head A; no Gateway bypass in live projection", () => {
  for (const file of listJsFiles("src/features/competition-engine/integration/court-adapters")) {
    const source = read(file);
    assert.doesNotMatch(source, /courtResourceGateway/);
    assert.doesNotMatch(source, /from\s+["'].*courtResourceGateway/);
  }
  const projection = read(
    "src/features/court-resource/projections/courtLiveResourceUseProjection.js"
  );
  assert.match(projection, /GENERIC_LIVE_RESOURCE_USE_PROJECTION/);
  assert.match(projection, /headABypassed: false/);
  assert.doesNotMatch(projection, /reserveCourts|releaseCourts/);
});

test("new live runtime SQL package hashes are stable and reportable", () => {
  const hashes = {};
  for (const name of ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql"]) {
    hashes[name] = sha256File(`${PKG}/${name}`);
    assert.match(hashes[name], /^[0-9A-F]{64}$/);
  }
  assert.ok(hashes["02_APPLY.sql"]);
});

test("Batch4 resource block SQL package still present", () => {
  assert.equal(
    existsSync(path.join(root, "docs/v5/migrations/court-resource-canonical-resource-blocks-01/02_APPLY.sql")),
    true
  );
});

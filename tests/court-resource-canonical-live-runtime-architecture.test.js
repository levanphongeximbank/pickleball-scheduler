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
const CERTIFIED_BATCH3 = {
  "01_PRECHECK.sql": "B028499D1869EDF2EBF00ADF5BF294D301D03DC66E03B6C41085E1A68B0825B2",
  "02_APPLY.sql": "ACDFC0A7EEC0D4DC07C810CDC4C5D7927120C07AB3B0394D649D83BBCB5C288B",
  "03_VERIFY.sql": "35286678926B73F6E1DC6C494391147D7FB34DB260B404414BEDADC661ABA0E0",
  "04_ROLLBACK.sql": "357F3BF6FFF4F17E53E9E88C173AD799CD41D542AF18243D7BB868EFE997A51F",
};

const HEAD_A_CONTRACT_SHA256 =
  "B3DC18602C5AEE63CD565622FFADD6388F3DFBA38A21056570F3BD7526BB5CE6";

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

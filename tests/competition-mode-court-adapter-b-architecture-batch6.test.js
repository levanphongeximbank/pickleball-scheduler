/**
 * Batch 6 architecture locks for Mode Court Adapter B.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COMPETITION_COURT_ADAPTER_CONTRACT_VERSION } from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT,
  MODE_COURT_ADAPTER_B_OWNER,
} from "../src/features/competition-engine/integration/court-adapters/index.js";
import { CANONICAL_BOOKING_LIFECYCLE_DEFAULT } from "../src/features/court-resource/constants/canonicalBooking.js";
import { CANONICAL_RESOURCE_BLOCKS_DEFAULT } from "../src/features/court-resource/constants/canonicalResourceBlock.js";
import { CANONICAL_RESERVATION_CUTOVER_DEFAULT } from "../src/features/court-resource/constants/canonicalReservation.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADAPTER_ROOT = "src/features/competition-engine/integration/court-adapters";
const HEAD_A_CONTRACT =
  "src/features/competition-core/contracts/competitionCourtAdapterContract.js";
const HEAD_A_CONTRACT_SHA256 =
  "B3DC18602C5AEE63CD565622FFADD6388F3DFBA38A21056570F3BD7526BB5CE6";

const CERTIFIED_D4 = {
  "01_PRECHECK.sql": "29011AE97747835174CD47B3E5DAC2F4C25E89A1ECF620C3781475B0DAA64478",
  "02_APPLY.sql": "15BA263207B2EE871C3860CFD61F0E810A591D31AFB4A5B3D95FA3C13A166F0B",
  "03_VERIFY.sql": "73E30440FB61E63DF87A1D036B28B69FC3F68C75BA491C798B9722DD6BC6B580",
  "04_ROLLBACK.sql": "7E537191E6B3F4EFA8D13BEA1F22B5B2F12BFEEFF2A00F375BAD6F9AAF7DF8CB",
};

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function sha256File(rel) {
  return createHash("sha256").update(readFileSync(path.join(ROOT, rel))).digest("hex").toUpperCase();
}

function listJs(relDir) {
  const absolute = path.join(ROOT, relDir);
  return readdirSync(absolute)
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.posix.join(relDir, name));
}

test("Batch6 adoption defaults and ownership", () => {
  assert.equal(CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT, false);
  assert.equal(CANONICAL_BOOKING_LIFECYCLE_DEFAULT, false);
  assert.equal(CANONICAL_RESOURCE_BLOCKS_DEFAULT, false);
  assert.equal(CANONICAL_RESERVATION_CUTOVER_DEFAULT, false);
  assert.equal(MODE_COURT_ADAPTER_B_OWNER, "2.13_COMPETITION_ENGINE");
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.equal(sha256File(HEAD_A_CONTRACT), HEAD_A_CONTRACT_SHA256);
});

test("D4 certified SQL unchanged", () => {
  const dir = "docs/v5/migrations/court-resource-phase3b-daily-play-interval-authority-01";
  for (const [name, hash] of Object.entries(CERTIFIED_D4)) {
    assert.equal(sha256File(path.posix.join(dir, name)), hash, name);
  }
});

test("Mode Adapter B files present; no second Head A contract", () => {
  for (const name of [
    "DailyPlayCourtAdapter.js",
    "InternalTournamentCourtAdapter.js",
    "OfficialTournamentCourtAdapter.js",
    "TeamTournamentCourtAdapter.js",
  ]) {
    assert.equal(existsSync(path.join(ROOT, ADAPTER_ROOT, name)), true);
  }
  assert.equal(
    existsSync(path.join(ROOT, "src/features/competition-core/contracts/competitionCourtAdapterContractV2.js")),
    false
  );
});

test("Mode Adapter B cannot import forbidden court authorities", () => {
  const forbiddenImport =
    /(?:import|export)\s+[^;]*\b(?:clubStorage|loadCourtsForClub|legacyCourtIdentityMapping|courtResourceGateway|canonicalBookingClient|canonicalResourceBlockClient)\b|club_data_v3|court_resource_daily_play_acquire/;
  for (const file of listJs(ADAPTER_ROOT)) {
    const source = read(file);
    assert.doesNotMatch(source, forbiddenImport, file);
  }
});

test("Court Resource tree does not import Mode Adapter B (no reverse ownership)", () => {
  const courtRoot = path.join(ROOT, "src/features/court-resource");
  function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(absolute);
      return entry.isFile() && entry.name.endsWith(".js") ? [absolute] : [];
    });
  }
  for (const file of walk(courtRoot)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /DailyPlayCourtAdapter|InternalTournamentCourtAdapter|OfficialTournamentCourtAdapter|TeamTournamentCourtAdapter|createModeCourtAdapterB|court-adapters/
    );
  }
});

test("tournamentCommands canonical branch uses Adapter B without loadCourtsForClub", () => {
  const source = read("src/features/tournament/services/tournamentCommands.js");
  assert.match(source, /isCanonicalCompetitionCourtAdaptersEnabled/);
  assert.match(source, /syncCompetitionCourtScheduleViaAdapterB/);
  // Legacy branch may still loadCourtsForClub; canonical ON branch must not call it.
  const canonicalBlock = source.slice(
    source.indexOf("if (isCanonicalCompetitionCourtAdaptersEnabled())"),
    source.indexOf("} else {")
  );
  assert.doesNotMatch(canonicalBlock, /\bloadCourtsForClub\s*\(/);
  assert.doesNotMatch(canonicalBlock, /\bsyncTournamentCourtBookings\s*\(/);
});

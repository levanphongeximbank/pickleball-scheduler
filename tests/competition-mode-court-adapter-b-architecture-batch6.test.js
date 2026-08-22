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
  "B9F7FE3F36786383A7A1C2027E5D1B93D4917BA9365CA98F88DE96529C4C6B1C";

const CERTIFIED_D4 = {
  "01_PRECHECK.sql": "5C5DF3B7B6C63AF3DA3C25A85A5A2C9CDE09938CA0B29BF035D0EE677A978D09",
  "02_APPLY.sql": "C2C998F3D0BDAEB605AB004E231FFE3AFCE45E2EB6278509BE3F284E68BBE986",
  "03_VERIFY.sql": "93678A8EE2F8DF0F66D4ADAA0E8A5E2F0EBD17034C0473D69AE0DBF992AC2845",
  "04_ROLLBACK.sql": "166F7B8105CCBE695AF584BB59FBC6D448A0DC37A26EDB9AEBAC8E029AEEFB9B",
};

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function sha256File(rel) {
  return createHash("sha256").update(readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n"), "utf8").digest("hex").toUpperCase();
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
  // Canonical-ON block ends at the provided-courts else-if. Do not slice through
  // that branch: syncTournamentCourtBookings there is the authorized CI-R1 await
  // on the Adapter-B-OFF provided-courts path, not an inventory-authority bypass.
  const canonicalOnStart = source.indexOf(
    "if (isCanonicalCompetitionCourtAdaptersEnabled())"
  );
  const providedCourtsStart = source.indexOf(
    '} else if (Object.prototype.hasOwnProperty.call(options, "courts"))',
    canonicalOnStart
  );
  assert.ok(canonicalOnStart >= 0, "canonical Adapter B gate missing");
  assert.ok(providedCourtsStart > canonicalOnStart, "provided-courts branch missing");
  const canonicalOnBlock = source.slice(canonicalOnStart, providedCourtsStart);
  assert.match(canonicalOnBlock, /syncCompetitionCourtScheduleViaAdapterB/);
  assert.doesNotMatch(canonicalOnBlock, /\bloadCourtsForClub\s*\(/);
  assert.doesNotMatch(canonicalOnBlock, /\bsyncTournamentCourtBookings\s*\(/);
});

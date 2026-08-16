/**
 * Architecture lock for Competition Court Adapter Contract (ĐẦU A).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPETITION_COURT_ADAPTER_AUTHORITATIVE_IMPORT_PATH,
  COMPETITION_COURT_ADAPTER_CONTRACT_NAME,
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_ADAPTER_VERSIONING_POLICY,
  COMPETITION_COURT_FORBIDDEN_BYPASS,
  COMPETITION_COURT_IDENTITY_RULES,
  COMPETITION_COURT_RESOURCE_BINDING_PATH,
} from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listJs(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJs(absolute);
    return entry.isFile() && entry.name.endsWith(".js") ? [absolute] : [];
  });
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

const CONTRACT = path.join(ROOT, COMPETITION_COURT_ADAPTER_AUTHORITATIVE_IMPORT_PATH);
const BINDING = path.join(ROOT, COMPETITION_COURT_RESOURCE_BINDING_PATH);
const GATEWAY = path.join(ROOT, "src/features/court-resource/services/courtResourceGateway.js");
const COURT_RESOURCE_ROOT = path.join(ROOT, "src/features/court-resource");

const TOURNAMENT_BUSINESS = /team-tournament|individual-tournament|tournament-engine|InternalTournamentCourtAdapter|OfficialTournamentCourtAdapter|OpenTournamentCourtAdapter|TeamTournamentCourtAdapter/;
const STORAGE_BYPASS = /clubStorage|bookingService|courtBookingEngine|tournamentBookingService|club_data_v3/;
const COMPETITION_BUSINESS = /features[\\/]competition-core/;

test("one authoritative Competition Court Adapter Contract path", () => {
  assert.equal(existsSync(CONTRACT), true);
  assert.equal(existsSync(BINDING), true);
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_NAME, "Competition Court Adapter Contract");
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.equal(COMPETITION_COURT_ADAPTER_VERSIONING_POLICY.CURRENT_VERSION, 1);
  assert.equal(COMPETITION_COURT_ADAPTER_VERSIONING_POLICY.SILENT_IN_PLACE_BREAKING_CHANGE_FORBIDDEN, true);
  assert.equal(COMPETITION_COURT_ADAPTER_VERSIONING_POLICY.TOURNAMENT_MODULES_MAY_MODIFY, false);
  assert.equal(
    COMPETITION_COURT_ADAPTER_VERSIONING_POLICY.BREAKING_CHANGE_REQUIRES_OWNER_APPROVED_SHARED_CONTRACT_CHANGE,
    true
  );
  assert.equal(
    COMPETITION_COURT_ADAPTER_VERSIONING_POLICY.BREAKING_CHANGE_REQUIRES_EXPLICIT_CONTRACT_VERSION_DECISION,
    true
  );
  const contract = readFileSync(CONTRACT, "utf8");
  assert.match(contract, /COMPETITION_COURT_ADAPTER_CONTRACT_VERSION\s*=\s*1/);
  assert.equal(
    existsSync(path.join(ROOT, "src/features/competition-core/contracts/competitionCourtAdapterContract.js")),
    true
  );
  assert.equal(
    existsSync(path.join(ROOT, "src/features/venue-court/adapters/competitionCourtAdapter.js")),
    false,
    "legacy planned competitionCourtAdapter.js is not the Đầu A contract"
  );
});

test("canonical identity rules are locked", () => {
  assert.equal(COMPETITION_COURT_IDENTITY_RULES.PHYSICAL_COURT_ID_IS_AUTHORITY, true);
  assert.equal(COMPETITION_COURT_IDENTITY_RULES.COURT_LABEL_IS_DISPLAY_ONLY, true);
  assert.equal(COMPETITION_COURT_IDENTITY_RULES.COURT_COUNT_IS_CAPACITY_DEMAND_ONLY, true);
  assert.equal(COMPETITION_COURT_IDENTITY_RULES.CLUSTER_IS_NOT_A_RESERVABLE_UNIT, true);
});

function importedSpecs(source) {
  return [...source.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(
    (match) => match[1]
  );
}

test("neutral adapter calls CourtResourceGateway and does not import Tournament business", () => {
  const binding = readFileSync(BINDING, "utf8");
  const specs = importedSpecs(binding);
  assert.equal(
    specs.some((spec) => spec.endsWith("court-resource/index.js")),
    true
  );
  assert.match(binding, /\blistEligibleCourts\b/);
  assert.match(binding, /\bgetCourtAvailability\b/);
  assert.match(binding, /\breserveCourts\b/);
  assert.match(binding, /\breleaseCourts\b/);
  assert.match(binding, /\bvalidateCourtAssignment\b/);
  assert.match(binding, /physicalCourtIds/);
  assert.doesNotMatch(binding, /\bselectedCourtIds\b/);
  assert.doesNotMatch(binding, /\blegacyCourtId\b/);
  assert.doesNotMatch(binding, /\blegacyMappings\b/);
  assert.doesNotMatch(binding, /\bresolveLegacyCourtIdentity\b/);
  assert.doesNotMatch(binding, /\bclubStorage\b/);
  assert.doesNotMatch(binding, /club_data_v3/);
  for (const spec of specs) {
    assert.doesNotMatch(spec, TOURNAMENT_BUSINESS, spec);
    assert.doesNotMatch(spec, STORAGE_BYPASS, spec);
    assert.doesNotMatch(spec, /venue-court/, spec);
  }
});

test("CourtResourceGateway has no reverse Competition business dependency", () => {
  for (const file of listJs(COURT_RESOURCE_ROOT)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, COMPETITION_BUSINESS, rel(file));
    assert.doesNotMatch(source, TOURNAMENT_BUSINESS, rel(file));
  }
  const gateway = readFileSync(GATEWAY, "utf8");
  assert.match(gateway, /export function listEligibleCourts/);
  assert.doesNotMatch(gateway, /competition-core/);
});

test("Đầu B Mode Court adapters exist under Competition Engine and depend on Head A only", () => {
  const adapterRoot = path.join(
    ROOT,
    "src/features/competition-engine/integration/court-adapters"
  );
  const required = [
    "DailyPlayCourtAdapter.js",
    "InternalTournamentCourtAdapter.js",
    "OfficialTournamentCourtAdapter.js",
    "TeamTournamentCourtAdapter.js",
    "createModeCourtAdapterB.js",
  ];
  for (const name of required) {
    assert.equal(existsSync(path.join(adapterRoot, name)), true, name);
  }
  // Must not be dumped at src/features root (avoids fake Head A duplicates).
  for (const name of required.filter((n) => n.endsWith("CourtAdapter.js"))) {
    assert.equal(existsSync(path.join(ROOT, "src/features", name)), false, name);
  }

  const BYPASS_IMPORT =
    /(?:import|export)\s+[^;]*\b(?:clubStorage|loadCourtsForClub|legacyCourtIdentityMapping|courtResourceGateway)\b|club_data_v3|from\s+["'][^"']*courtResourceGateway/;
  for (const name of required) {
    const source = readFileSync(path.join(adapterRoot, name), "utf8");
    assert.doesNotMatch(source, BYPASS_IMPORT, name);
    if (name !== "createModeCourtAdapterB.js") {
      assert.match(source, /createModeCourtAdapterB|competitionType/);
    }
  }
  const shared = readFileSync(path.join(adapterRoot, "createModeCourtAdapterB.js"), "utf8");
  assert.match(shared, /createCourtResourceCompetitionAdapter/);
  assert.doesNotMatch(shared, /dreambreaker|stageTieBreak|seedBracket|drawEngine/i);
});

test("forbidden storage bypasses are documented", () => {
  assert.ok(COMPETITION_COURT_FORBIDDEN_BYPASS.includes("club_data_v3"));
  assert.ok(COMPETITION_COURT_FORBIDDEN_BYPASS.includes("court_reservations"));
  assert.ok(COMPETITION_COURT_FORBIDDEN_BYPASS.includes("Court Engine runtime storage"));
});

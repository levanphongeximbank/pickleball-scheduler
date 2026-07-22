/**
 * CORE-12 Phase 1D-B2 — authoritative descriptor source audit / lock tests.
 *
 * OPTION B outcome: inventory authority exists under Venue & Court, but no
 * stable public CanonicalCourtDescriptor contract is exposed. No production
 * Venue CAA provider is implemented in this phase.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AVAILABILITY_BRIDGE_CODE,
  createCanonicalCourtDescriptor,
  invokeAvailabilitySnapshotProvider,
  projectEligibleCourtsToAvailableInputs,
} from "../src/features/competition-core/court-assignment/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CA_ROOT = path.join(
  ROOT,
  "src/features/competition-core/court-assignment"
);
const AVAIL_ROOT = path.join(CA_ROOT, "adapters/availability");
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");
const CA_INDEX = path.join(CA_ROOT, "index.js");
const AVAIL_INDEX = path.join(AVAIL_ROOT, "index.js");
const DOC = path.join(
  ROOT,
  "docs/competition-engine/core-12/10_PHASE_1D_B2_VENUE_PROVIDER.md"
);
const VENUE_INDEX = path.join(ROOT, "src/features/venue-court/index.js");
const CAA = path.join(
  ROOT,
  "src/features/venue-court/adapters/competitionCourtAvailabilityAdapter.js"
);
const INVENTORY = path.join(
  ROOT,
  "src/features/venue-court/services/courtInventoryService.js"
);
const AVAIL_SVC = path.join(
  ROOT,
  "src/features/venue-court/services/courtAvailabilityService.js"
);
const COURT_MODEL = path.join(ROOT, "src/models/court.js");

const FORBIDDEN_PROVIDER_BASENAMES = Object.freeze([
  "createCompetitionCourtAvailabilityProvider.js",
  "createInjectedVenueCourtAvailabilityProvider.js",
  "createVenueCourtAvailabilityProvider.js",
  "VenueEligibilityProvider.js",
  "CanonicalCourtDescriptorProvider.js",
  "CourtAvailabilityBridgeProvider.js",
]);

function walkJsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkJsFiles(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function read(relOrAbs) {
  return readFileSync(relOrAbs, "utf8");
}

function assertNoMatch(source, pattern, label) {
  assert.equal(
    pattern.test(source),
    false,
    `${label} must not match ${pattern}`
  );
}

test("01 Phase 1D-B2 doc exists and selects OPTION B with public-contract block", () => {
  assert.equal(existsSync(DOC), true);
  const text = read(DOC);
  assert.match(text, /OPTION B/);
  assert.match(text, /BLOCKED_AUTHORITATIVE_DESCRIPTOR_PUBLIC_CONTRACT/);
  assert.match(text, /Not implemented/i);
  assert.match(text, /Exact required upstream public contract/i);
});

test("02 no production Venue provider modules under court-assignment", () => {
  const files = walkJsFiles(CA_ROOT).map((f) => path.basename(f));
  for (const banned of FORBIDDEN_PROVIDER_BASENAMES) {
    assert.equal(
      files.includes(banned),
      false,
      `unexpected production provider file: ${banned}`
    );
  }
});

test("03 production court-assignment index does not export Venue provider factories", () => {
  const src = read(CA_INDEX);
  assertNoMatch(src, /createInjectedVenue|createCompetitionCourtAvailabilityProvider|VenueEligibilityProvider|CanonicalCourtDescriptorProvider/, "CA index");
  assert.match(src, /invokeAvailabilitySnapshotProvider/);
  assert.match(src, /projectEligibleCourtsToAvailableInputs/);
  assert.match(src, /createCanonicalCourtDescriptor/);
});

test("04 availability adapter barrel does not export test doubles or Venue provider", () => {
  const src = read(AVAIL_INDEX);
  assertNoMatch(
    src,
    /export\s+\{[^}]*\b(createFixed|createAsync|createInjectedVenue)/s,
    "availability index named exports"
  );
  assertNoMatch(src, /from\s+["']\.\/testDoubles\.js["']/, "availability index testDoubles import");
  assertNoMatch(src, /from\s+["'][^"']*venue-court[^"']*["']/, "availability index venue import");
  assertNoMatch(src, /\blistCourts\b/, "availability index listCourts");
  assert.match(src, /invokeAvailabilitySnapshotProvider/);
  assert.match(src, /projectEligibleCourtsToAvailableInputs/);
});

test("05 root Competition Core barrel unchanged w.r.t. CORE-12 Phase 1D-B2 surface", () => {
  const src = read(ROOT_BARREL);
  assertNoMatch(
    src,
    /court-assignment|invokeAvailabilitySnapshotProvider|createCanonicalCourtDescriptor|createInjectedVenue/,
    "root barrel"
  );
});

test("06 court-assignment sources do not hard-import Venue repository or CAA", () => {
  const files = walkJsFiles(CA_ROOT);
  for (const file of files) {
    const src = read(file);
    const rel = path.relative(ROOT, file);
    assertNoMatch(src, /from\s+["'][^"']*venue-court[^"']*["']/, rel);
    assertNoMatch(src, /import\s*\{[^}]*getCompetitionCourtAvailability[^}]*\}\s*from/s, rel);
    assertNoMatch(src, /import\s*\{[^}]*\blistCourts\b[^}]*\}\s*from/s, rel);
    assertNoMatch(src, /from\s+["'][^"']*domain\/courtService[^"']*["']/, rel);
    assertNoMatch(src, /from\s+["'][^"']*domain\/clubStorage[^"']*["']/, rel);
  }
});

test("07 court-assignment sources do not import Supabase, TE, CORE-11 scheduling, or CORE-14", () => {
  const files = walkJsFiles(CA_ROOT);
  for (const file of files) {
    const src = read(file);
    const rel = path.relative(ROOT, file);
    assertNoMatch(src, /@supabase|createClient\(|from ["'].*supabase/, rel);
    assertNoMatch(src, /from ["'].*tournament-engine/, rel);
    assertNoMatch(src, /from ["'].*resource-conflict/, rel);
    // CORE-11 final public scheduled-match contract is absent; forbid scheduling engine deep imports
    assertNoMatch(src, /from ["'].*\/scheduling\/(?!.*court-assignment)/, rel);
  }
});

test("08 CAA remains eligibility-ID-only (not CanonicalCourtDescriptor)", () => {
  const src = read(CAA);
  assert.match(src, /availableCourtIds/);
  assertNoMatch(src, /capabilities/, "CAA");
  assertNoMatch(src, /descriptorAuthority/, "CAA");
  assertNoMatch(src, /sourceContractVersion/, "CAA");
  assertNoMatch(src, /CanonicalCourtDescriptor/, "CAA");
  assertNoMatch(src, /priority/, "CAA");
});

test("09 Venue inventory facade is not a CanonicalCourtDescriptor contract", () => {
  const inventory = read(INVENTORY);
  const model = read(COURT_MODEL);
  const avail = read(AVAIL_SVC);
  assert.match(inventory, /export function listCourts/);
  assert.match(inventory, /export function getCourtById/);
  assertNoMatch(inventory, /descriptorAuthority|sourceContractVersion|capabilities/, "inventory");
  assertNoMatch(model, /capabilities|descriptorAuthority|sourceContractVersion/, "court model");
  assert.match(avail, /function toCourtPublic/);
  assert.match(avail, /id: court\.id/);
  assert.match(avail, /active: court\.active/);
  assert.match(avail, /status: court\.status/);
  assertNoMatch(avail, /capabilities|descriptorAuthority|priority:/, "toCourtPublic path");
});

test("10 Venue public barrel exports inventory + CAA but not competition descriptor provider", () => {
  const src = read(VENUE_INDEX);
  assert.match(src, /listCourts/);
  assert.match(src, /getCourtById/);
  assert.match(src, /getCompetitionCourtAvailability/);
  assertNoMatch(
    src,
    /CanonicalCourtDescriptor|resolveCourtDescriptors|getCompetitionCourtDescriptors/,
    "venue index"
  );
});

test("11 structural createCanonicalCourtDescriptor still requires declared authority", () => {
  assert.throws(
    () =>
      createCanonicalCourtDescriptor({
        courtId: "c1",
        tenantId: "t1",
        clubId: "club-1",
        venueId: "v1",
        active: true,
        locked: false,
      }),
    (err) => err?.code === AVAILABILITY_BRIDGE_CODE.MISSING_DESCRIPTOR_AUTHORITY
  );
});

test("12 eligibility IDs alone are not inventory authority (projection still requires descriptors)", () => {
  assert.equal(
    typeof projectEligibleCourtsToAvailableInputs,
    "function"
  );
  assert.equal(typeof invokeAvailabilitySnapshotProvider, "function");
  // Documented Phase 1D-B1 behavior retained: missing descriptor fails closed.
  assert.equal(
    AVAILABILITY_BRIDGE_CODE.MISSING_CANONICAL_COURT_DESCRIPTOR,
    "MISSING_CANONICAL_COURT_DESCRIPTOR"
  );
  assert.equal(
    AVAILABILITY_BRIDGE_CODE.MISSING_DESCRIPTOR_AUTHORITY,
    "MISSING_DESCRIPTOR_AUTHORITY"
  );
});

test("13 no Date.now / Math.random / UUID fabrication helpers added for Phase 1D-B2 provider", () => {
  const files = walkJsFiles(AVAIL_ROOT);
  for (const file of files) {
    const src = read(file);
    const rel = path.relative(ROOT, file);
    assertNoMatch(src, /Date\.now\s*\(/, rel);
    assertNoMatch(src, /Math\.random\s*\(/, rel);
    assertNoMatch(src, /\brandomUUID\b|uuidv4|crypto\.randomUUID/, rel);
  }
});

test("14 no conflict markers in CORE-12 court-assignment or Phase 1D-B2 doc", () => {
  const targets = [...walkJsFiles(CA_ROOT), DOC];
  for (const file of targets) {
    const src = read(file);
    assert.equal(
      src.includes("<<<<<<<"),
      false,
      `conflict marker in ${path.relative(ROOT, file)}`
    );
  }
});

test("15 test doubles remain isolated from production barrels", () => {
  const ca = read(CA_INDEX);
  const avail = read(AVAIL_INDEX);
  assertNoMatch(ca, /from\s+["'][^"']*testDoubles\.js["']/, "CA index");
  assertNoMatch(ca, /createFixedEligibility|createAsyncEligibility/, "CA index symbols");
  assertNoMatch(avail, /from\s+["']\.\/testDoubles\.js["']/, "avail index");
  assertNoMatch(avail, /createFixedEligibility|createAsyncEligibility/, "avail index symbols");
  assert.equal(
    existsSync(path.join(AVAIL_ROOT, "testDoubles.js")),
    true,
    "Phase 1D-B1 test doubles file must remain available for tests only"
  );
});

test("16 Phase 1D-B2 does not add bridge codes for unimplemented provider paths", () => {
  // Existing Phase 1D-B1 codes already cover missing/rejected/malformed provider paths.
  // Do not invent duplicate codes until a production provider exists.
  const codes = Object.keys(AVAILABILITY_BRIDGE_CODE);
  assert.equal(codes.includes("MISSING_AVAILABILITY_PROVIDER"), true);
  assert.equal(codes.includes("PROVIDER_REJECTED"), true);
  assert.equal(codes.includes("PROVIDER_RESULT_INVALID"), true);
  assert.equal(codes.includes("MISSING_DESCRIPTOR_AUTHORITY"), true);
  assert.equal(
    codes.includes("MISSING_AUTHORITATIVE_DESCRIPTOR_PROVIDER"),
    false,
    "do not add placeholder production-provider codes before Option A"
  );
});

test("17 required upstream contract fields are documented for Owner review", () => {
  const text = read(DOC);
  for (const field of [
    "courtId",
    "tenantId",
    "clubId",
    "venueId",
    "active",
    "locked",
    "capabilities",
    "priority",
    "sourceContractVersion",
    "descriptorAuthority",
    "sourceSnapshotId",
  ]) {
    assert.match(text, new RegExp(field));
  }
});

test("18 architecture lock: no production provider means Option A not claimed", () => {
  const text = read(DOC);
  assert.doesNotMatch(text, /Selected option\*\* \| \*\*OPTION A\*\*/);
  assert.match(text, /\*\*OPTION B\*\*/);
  assert.match(text, /Production provider\*\* \| \*\*Not implemented\*\*/);
});

/**
 * Venue/Court Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  VENUE_COURT_PLATFORM_ADAPTER_ERROR,
  projectVenueCourtTenantScope,
  projectVenueCourtVenueScope,
  projectVenueCourtClubScope,
  projectVenueCourtActor,
  projectVenueCourtContractVersion,
  projectVenueCourtCapabilityDescriptor,
  projectVenueCourtErrorDescriptor,
  listCourts,
  SOURCE_CONTRACT_VERSION,
} from "../src/features/venue-court/index.js";
import {
  isOk,
  isFail,
  isActorReference,
  isPlatformScope,
  isContractVersion,
  isPlatformCapabilityDescriptor,
  isPlatformErrorDescriptor,
} from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_DIR = path.join(ROOT, "src/features/venue-court/platform");

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("venue-court platform imports only canonical public entry", () => {
  for (const { name, source } of readPlatformSources()) {
    if (name === "index.js") continue;
    assert.match(
      source,
      /from\s+["']\.\.\/\.\.\/\.\.\/core\/platform\/index\.js["']/,
      name
    );
    assert.equal(/core\/platform\/contracts\//.test(source), false, name);
    assert.equal(/core\/platform\/adapters\//.test(source), false, name);
  }
});

test("venue-court tenant scope requires explicit tenantId and does not infer venue", () => {
  const missing = projectVenueCourtTenantScope({ venueId: "v-1" });
  assert.equal(isFail(missing), true);
  assert.equal(
    missing.error.code,
    VENUE_COURT_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED
  );

  const okResult = projectVenueCourtTenantScope({ tenantId: "tenant-1" });
  assert.equal(isOk(okResult), true);
  assert.equal(isPlatformScope(okResult.value), true);
  assert.equal(okResult.value.tenantId, "tenant-1");
  assert.equal(Object.isFrozen(okResult.value), true);
});

test("venue-court venue scope does not equate venueId to tenantId", () => {
  const result = projectVenueCourtVenueScope({ venueId: "venue-9" });
  assert.equal(isOk(result), true);
  assert.equal(result.value.scopeType, "VENUE");
  assert.equal(result.value.scopeId, "venue-9");
  assert.equal("tenantId" in result.value, false);
});

test("venue-court club scope requires explicit clubId", () => {
  assert.equal(
    projectVenueCourtClubScope({}).error.code,
    VENUE_COURT_PLATFORM_ADAPTER_ERROR.CLUB_ID_REQUIRED
  );
  const result = projectVenueCourtClubScope({
    clubId: "club-1",
    tenantId: "tenant-1",
  });
  assert.equal(isOk(result), true);
  assert.equal(result.value.scopeId, "club-1");
  assert.equal(result.value.tenantId, "tenant-1");
});

test("venue-court actor requires explicit id and does not mutate input", () => {
  const input = Object.freeze({ userId: "user-1" });
  const result = projectVenueCourtActor(input);
  assert.equal(isOk(result), true);
  assert.equal(isActorReference(result.value), true);
  assert.equal(result.value.actorId, "user-1");
  assert.deepEqual(input, { userId: "user-1" });
});

test("venue-court contract version and capability projection", () => {
  const version = projectVenueCourtContractVersion({
    version: SOURCE_CONTRACT_VERSION,
  });
  assert.equal(isOk(version), true);
  assert.equal(isContractVersion(version.value), true);

  const capability = projectVenueCourtCapabilityDescriptor({
    capabilityCode: "VENUE_COURT_CANONICAL_DESCRIPTOR",
    version: SOURCE_CONTRACT_VERSION,
    status: "AVAILABLE",
  });
  assert.equal(isOk(capability), true);
  assert.equal(isPlatformCapabilityDescriptor(capability.value), true);
  assert.equal(capability.value.ownerModule, "venue-court");
});

test("venue-court error descriptor projection", () => {
  const result = projectVenueCourtErrorDescriptor({
    code: "VENUE_SCOPE_MISSING",
    message: "Venue scope missing",
    retryable: false,
  });
  assert.equal(isOk(result), true);
  assert.equal(isPlatformErrorDescriptor(result.value), true);
});

test("venue-court platform adapters generate no identifiers", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/crypto\.random/.test(source), false, name);
  }
});

test("venue-court platform adapters avoid persistence and environment", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/import\.meta\.env/.test(source), false, name);
  }
});

test("venue-court public exports remain compatible", () => {
  assert.equal(typeof listCourts, "function");
  assert.equal(typeof projectVenueCourtTenantScope, "function");
  assert.equal(typeof SOURCE_CONTRACT_VERSION, "string");
});

/**
 * Batch 5 — Canonical tenant / venue / club scope boundary matrix.
 */
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COURT_RESOURCE_CODE } from "../src/features/court-resource/constants/courtResourceContract.js";
import {
  COURT_ACCESS_AUTHORITY_TABLE,
  COURT_MASTER_TABLE,
} from "../src/features/court-resource/constants/courtOperationsOwnership.js";
import {
  COURT_OPERATIONS_SCOPE_CODE,
  normalizeCourtOperationsScope,
  requireCanonicalClubScope,
  requireCanonicalTenantId,
  assertNoTenantVenueFallback,
} from "../src/features/court-resource/scope/courtOperationsScope.js";
import { assertCanonicalClubBoundary } from "../src/features/court-resource/contracts/canonicalClubBoundary.js";
import { assertCanonicalVenueBoundary } from "../src/features/court-resource/contracts/canonicalVenueBoundary.js";
import {
  createCanonicalInventoryReader,
  listEligiblePhysicalCourts,
} from "../src/features/court-resource/services/canonicalCourtInventoryService.js";
import {
  __resetCourtResourceGatewayDepsForTests,
  __setCourtResourceGatewayDepsForTests,
  listEligibleCourts,
} from "../src/features/court-resource/services/courtResourceGateway.js";
import { createCourtResourceCompetitionAdapter } from "../src/features/competition-core/adapters/courtResourceCompetitionAdapter.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TENANT = "tenant-scope-a";
const VENUE = "venue-scope-a";
const OTHER_VENUE = "venue-foreign";
const CLUB = "club-scope-a";
const FOREIGN_CLUB = "club-foreign";
const CLUSTER = "CLUSTER_SCOPE";
const COURT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

afterEach(() => {
  __resetCourtResourceGatewayDepsForTests();
});

function court(overrides = {}) {
  return {
    physicalCourtId: COURT,
    tenantId: TENANT,
    clusterId: CLUSTER,
    displayName: "Sân 1",
    displayCode: "C01",
    displayNumber: "1",
    sortOrder: 1,
    lifecycleStatus: "active",
    ...overrides,
  };
}

function access(overrides = {}) {
  return {
    tenantId: TENANT,
    clubId: CLUB,
    physicalCourtId: COURT,
    status: "enabled",
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    clubs: [{ id: CLUB, tenantId: TENANT }],
    clusters: [{ id: CLUSTER, venueId: TENANT }],
    physicalCourts: [court()],
    clubOperationalAccess: [access()],
    legacyBlobCourts: [{ id: "blob-1", name: "Blob", clubId: CLUB }],
    ...overrides,
  };
}

function bindInventory(sources) {
  __setCourtResourceGatewayDepsForTests({
    listEligiblePhysicalCourts: createCanonicalInventoryReader(sources),
    listCourts() {
      throw new Error("legacy listCourts must not be called");
    },
  });
}

test("A. tenantId and venueId different values still work when both explicit", async () => {
  bindInventory(snapshot());
  const scope = normalizeCourtOperationsScope({
    tenantId: TENANT,
    venueId: VENUE,
    clubId: CLUB,
  });
  assert.equal(scope.ok, true);
  assert.equal(scope.scope.tenantId, TENANT);
  assert.equal(scope.scope.venueId, VENUE);
  assert.notEqual(scope.scope.tenantId, scope.scope.venueId);

  const listed = await listEligibleCourts({
    tenantId: TENANT,
    venueId: VENUE,
    clubId: CLUB,
  });
  assert.equal(listed.ok, true);
  assert.equal(listed.inventorySource, COURT_MASTER_TABLE);
  assert.equal(listed.accessAuthority, COURT_ACCESS_AUTHORITY_TABLE);
  assert.equal(listed.courts[0].physicalCourtId, COURT);
});

test("B. missing tenantId fail closed", () => {
  const missing = requireCanonicalTenantId({ clubId: CLUB });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, COURT_OPERATIONS_SCOPE_CODE.MISSING_TENANT_ID);

  const listed = listEligiblePhysicalCourts({ clubId: CLUB }, snapshot());
  assert.equal(listed.ok, false);
  assert.equal(listed.code, COURT_RESOURCE_CODE.MISSING_TENANT_ID);
});

test("C. venueId alone not accepted as tenant", async () => {
  const collapse = assertNoTenantVenueFallback({ venueId: VENUE, clubId: CLUB });
  assert.equal(collapse.ok, false);
  assert.equal(collapse.code, COURT_OPERATIONS_SCOPE_CODE.TENANT_VENUE_COLLAPSE_DENIED);

  bindInventory(snapshot());
  const listed = await listEligibleCourts({ venueId: TENANT, clubId: CLUB });
  assert.equal(listed.ok, false);
  assert.equal(listed.code, COURT_RESOURCE_CODE.TENANT_VENUE_COLLAPSE_DENIED);
});

test("D. foreign club framing rejects via injectable boundary", () => {
  const rejected = assertCanonicalClubBoundary(
    { tenantId: TENANT, clubId: FOREIGN_CLUB },
    {
      assertClubBelongsToTenant({ clubId }) {
        if (clubId === FOREIGN_CLUB) {
          return {
            ok: false,
            code: COURT_OPERATIONS_SCOPE_CODE.CLUB_SCOPE_REJECTED,
            error: "Foreign club framing rejected.",
          };
        }
        return { ok: true };
      },
    }
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, COURT_OPERATIONS_SCOPE_CODE.CLUB_SCOPE_REJECTED);
});

test("E. foreign venue framing rejects via injectable boundary", () => {
  const rejected = assertCanonicalVenueBoundary(
    { tenantId: TENANT, venueId: OTHER_VENUE },
    {
      assertVenueBelongsToTenant({ venueId }) {
        if (venueId === OTHER_VENUE) {
          return {
            ok: false,
            code: COURT_OPERATIONS_SCOPE_CODE.VENUE_SCOPE_REJECTED,
            error: "Foreign venue framing rejected.",
          };
        }
        return { ok: true };
      },
    }
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, COURT_OPERATIONS_SCOPE_CODE.VENUE_SCOPE_REJECTED);
});

test("F. valid club + enabled access returns court", async () => {
  bindInventory(snapshot());
  const result = await listEligibleCourts({ tenantId: TENANT, clubId: CLUB });
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.courts.map((row) => row.physicalCourtId),
    [COURT]
  );
});

test("G. disabled access excludes court", async () => {
  bindInventory(
    snapshot({
      clubOperationalAccess: [access({ status: "disabled" })],
    })
  );
  const result = await listEligibleCourts({ tenantId: TENANT, clubId: CLUB });
  assert.equal(result.ok, true);
  assert.deepEqual(result.courts, []);
});

test("H. blob court without access deny", async () => {
  bindInventory(
    snapshot({
      clubOperationalAccess: [],
      legacyBlobCourts: [{ id: COURT, name: "Blob Court", clubId: CLUB }],
    })
  );
  const result = await listEligibleCourts({ tenantId: TENANT, clubId: CLUB });
  assert.equal(result.ok, true);
  assert.equal(result.courts.some((row) => row.physicalCourtId === COURT), false);
});

test("I. rename stability — physicalCourtId unchanged", () => {
  const before = listEligiblePhysicalCourts({ tenantId: TENANT, clubId: CLUB }, snapshot());
  const after = listEligiblePhysicalCourts(
    { tenantId: TENANT, clubId: CLUB },
    snapshot({
      physicalCourts: [court({ displayName: "Centre Court", displayNumber: "99" })],
    })
  );
  assert.equal(before.courts[0].physicalCourtId, COURT);
  assert.equal(after.courts[0].physicalCourtId, COURT);
  assert.equal(after.courts[0].displayName, "Centre Court");
});

test("J. Booking application uses normalizeCourtOperationsScope / requireCanonicalClubScope", () => {
  const source = readFileSync(
    path.join(root, "src/features/court-resource/services/courtOperationsBookingApplication.js"),
    "utf8"
  );
  assert.match(source, /requireCanonicalClubScope/);
  assert.doesNotMatch(source, /tenantId\s*\|\|\s*venueId/);
  assert.doesNotMatch(source, /venueId\s*\|\|\s*tenantId/);
  assert.match(source, /no default-club/i);
});

test("K. Resource Block application uses requireCanonicalClubScope", () => {
  const source = readFileSync(
    path.join(
      root,
      "src/features/court-resource/services/courtOperationsResourceBlockApplication.js"
    ),
    "utf8"
  );
  assert.match(source, /requireCanonicalClubScope/);
  assert.doesNotMatch(source, /tenantId\s*\|\|\s*venueId/);
  assert.doesNotMatch(source, /venueId\s*\|\|\s*tenantId/);
});

test("L. Competition provider preserves tenantId — no venueId invent", async () => {
  const calls = [];
  const adapter = createCourtResourceCompetitionAdapter({
    async listEligibleCourts(input) {
      calls.push(input);
      return { ok: true, courts: [] };
    },
  });
  await adapter.listEligibleCourts({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "comp-1",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tenantId, TENANT);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], "venueId"), false);
  assert.notEqual(calls[0].venueId, TENANT);

  const source = readFileSync(
    path.join(
      root,
      "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js"
    ),
    "utf8"
  );
  assert.doesNotMatch(source, /venueId:\s*context\.tenantId/);
  assert.doesNotMatch(source, /tenantId\s*\|\|\s*venueId/);
});

test("M. default-club cannot mutate — missing clubId fail closed", () => {
  const scoped = requireCanonicalClubScope({ tenantId: TENANT });
  assert.equal(scoped.ok, false);
  assert.equal(scoped.code, COURT_OPERATIONS_SCOPE_CODE.MISSING_CLUB_ID);

  const bookingSource = readFileSync(
    path.join(root, "src/features/court-resource/services/courtOperationsBookingApplication.js"),
    "utf8"
  );
  assert.match(bookingSource, /no default-club/i);
});

test("N. same opaque string for tenantId and venueId allowed when both explicit", () => {
  const scope = normalizeCourtOperationsScope({
    tenantId: TENANT,
    venueId: TENANT,
    clubId: CLUB,
  });
  assert.equal(scope.ok, true);
  assert.equal(scope.scope.tenantId, TENANT);
  assert.equal(scope.scope.venueId, TENANT);
});

test("O. cluster filter compares org-parent to explicit tenantId only", () => {
  const ok = listEligiblePhysicalCourts(
    { tenantId: TENANT, clubId: CLUB, clusterId: CLUSTER },
    snapshot()
  );
  assert.equal(ok.ok, true);

  const mismatch = listEligiblePhysicalCourts(
    { tenantId: TENANT, clubId: CLUB, clusterId: CLUSTER },
    snapshot({
      clusters: [{ id: CLUSTER, venueId: "other-org-parent" }],
    })
  );
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, COURT_RESOURCE_CODE.TENANT_MISMATCH);
});

test("P. requireCanonicalClubScope projects club framing without invent", () => {
  const scoped = requireCanonicalClubScope({
    tenantId: TENANT,
    venueId: VENUE,
    clubId: CLUB,
  });
  assert.equal(scoped.ok, true);
  assert.equal(scoped.tenantId, TENANT);
  assert.equal(scoped.clubId, CLUB);
  assert.equal(scoped.scope.venueId, VENUE);
});

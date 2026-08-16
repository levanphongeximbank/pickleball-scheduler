import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { COURT_RESOURCE_CODE } from "../src/features/court-resource/constants/courtResourceContract.js";
import {
  COURT_ACCESS_AUTHORITY_TABLE,
  COURT_MASTER_TABLE,
} from "../src/features/court-resource/constants/courtOperationsOwnership.js";
import {
  createCanonicalInventoryReader,
  listEligiblePhysicalCourts,
} from "../src/features/court-resource/services/canonicalCourtInventoryService.js";
import {
  __resetCourtResourceGatewayDepsForTests,
  __setCourtResourceGatewayDepsForTests,
  listEligibleCourts,
} from "../src/features/court-resource/services/courtResourceGateway.js";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const CLUB_A = "club-a";
const CLUB_B = "club-b";
const CLUSTER_NL = "NAM_LONG";
const CLUSTER_OTHER = "OTHER_CLUSTER";
const COURT_1 = "11111111-1111-4111-8111-111111111111";
const COURT_2 = "22222222-2222-4222-8222-222222222222";
const COURT_3 = "33333333-3333-4333-8333-333333333333";

afterEach(() => {
  __resetCourtResourceGatewayDepsForTests();
});

function court(overrides = {}) {
  return {
    physicalCourtId: COURT_1,
    tenantId: TENANT_A,
    clusterId: CLUSTER_NL,
    displayName: "Sân 1",
    displayCode: "NL_C01",
    displayNumber: "1",
    sortOrder: 1,
    lifecycleStatus: "active",
    ...overrides,
  };
}

function access(overrides = {}) {
  return {
    tenantId: TENANT_A,
    clubId: CLUB_A,
    physicalCourtId: COURT_1,
    status: "enabled",
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    clubs: [
      { id: CLUB_A, tenantId: TENANT_A },
      { id: CLUB_B, tenantId: TENANT_A },
    ],
    clusters: [
      { id: CLUSTER_NL, venueId: TENANT_A },
      { id: CLUSTER_OTHER, venueId: TENANT_A },
    ],
    physicalCourts: [
      court(),
      court({
        physicalCourtId: COURT_2,
        displayName: "Sân 2",
        displayCode: "NL_C02",
        displayNumber: "2",
        sortOrder: 2,
      }),
      court({
        physicalCourtId: COURT_3,
        clusterId: CLUSTER_OTHER,
        displayName: "Sân 3",
        displayCode: "OT_C01",
        displayNumber: "3",
        sortOrder: 3,
      }),
    ],
    clubOperationalAccess: [
      access(),
      access({ physicalCourtId: COURT_2 }),
      access({ physicalCourtId: COURT_3 }),
      access({ clubId: CLUB_B }),
    ],
    legacyBlobCourts: [{ id: "NL_C01", name: "Blob Court", clubId: CLUB_A, number: 1 }],
    ...overrides,
  };
}

function bindInventory(sources) {
  __setCourtResourceGatewayDepsForTests({
    listEligiblePhysicalCourts: createCanonicalInventoryReader(sources),
    listCourts() {
      throw new Error("legacy listCourts must not be called");
    },
    loadBookingsForClub() {
      throw new Error("clubStorage must not be called");
    },
  });
}

test("A. tenant + club with enabled access returns canonical Physical Court", async () => {
  bindInventory(snapshot());
  const result = await listEligibleCourts({ tenantId: TENANT_A, clubId: CLUB_A });
  assert.equal(result.ok, true);
  assert.equal(result.inventorySource, COURT_MASTER_TABLE);
  assert.equal(result.accessAuthority, COURT_ACCESS_AUTHORITY_TABLE);
  const ids = result.courts.map((row) => row.physicalCourtId).sort();
  assert.deepEqual(ids, [COURT_1, COURT_2, COURT_3]);
  assert.equal(result.courts[0].physicalCourtId, result.courts[0].physicalCourtId);
  assert.equal(result.courts.every((row) => row.identityAuthority === "physicalCourtId"), true);
});

test("B. disabled operational access excludes the court", async () => {
  bindInventory(
    snapshot({
      clubOperationalAccess: [
        access({ status: "disabled" }),
        access({ physicalCourtId: COURT_2, status: "enabled" }),
      ],
    })
  );
  const result = await listEligibleCourts({ tenantId: TENANT_A, clubId: CLUB_A });
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.courts.map((row) => row.physicalCourtId),
    [COURT_2]
  );
});

test("C. wrong tenant fail closed", async () => {
  bindInventory(snapshot());
  const result = await listEligibleCourts({ tenantId: TENANT_B, clubId: CLUB_A });
  assert.equal(result.ok, false);
  assert.equal(result.code, COURT_RESOURCE_CODE.TENANT_MISMATCH);
  assert.deepEqual(result.courts, []);
});

test("D. unknown club/court scope fail closed", async () => {
  bindInventory(snapshot());
  const unknownClub = await listEligibleCourts({ tenantId: TENANT_A, clubId: "club-unknown" });
  assert.equal(unknownClub.ok, false);
  assert.equal(unknownClub.code, COURT_RESOURCE_CODE.OUT_OF_SCOPE);

  const unknownCourt = await listEligibleCourts({
    tenantId: TENANT_A,
    clubId: CLUB_A,
    physicalCourtIds: ["44444444-4444-4444-8444-444444444444"],
  });
  assert.equal(unknownCourt.ok, false);
  assert.equal(unknownCourt.code, COURT_RESOURCE_CODE.UNKNOWN_COURT);
});

test("E. optional cluster filter returns only courts in that cluster", async () => {
  bindInventory(snapshot());
  const result = await listEligibleCourts({
    tenantId: TENANT_A,
    clubId: CLUB_A,
    clusterId: CLUSTER_NL,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.courts.map((row) => row.physicalCourtId).sort(),
    [COURT_1, COURT_2]
  );
  assert.equal(result.courts.every((row) => row.clusterId === CLUSTER_NL), true);
});

test("F. cluster cannot be listed as a fake physical court", async () => {
  bindInventory(snapshot());
  const listed = await listEligibleCourts({
    tenantId: TENANT_A,
    clubId: CLUB_A,
    clusterId: CLUSTER_NL,
  });
  assert.equal(listed.courts.some((row) => row.physicalCourtId === CLUSTER_NL), false);
  assert.equal(listed.courts.some((row) => row.id === CLUSTER_NL), false);

  const asCourt = await listEligibleCourts({
    tenantId: TENANT_A,
    clubId: CLUB_A,
    clusterId: CLUSTER_NL,
    selectedCourtIds: [CLUSTER_NL],
  });
  assert.equal(asCourt.ok, false);
  assert.equal(asCourt.code, COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED);
});

test("G. same physical court accessible by Club A and Club B keeps one identity", async () => {
  bindInventory(snapshot());
  const a = await listEligibleCourts({ tenantId: TENANT_A, clubId: CLUB_A });
  const b = await listEligibleCourts({ tenantId: TENANT_A, clubId: CLUB_B });
  const fromA = a.courts.filter((row) => row.physicalCourtId === COURT_1);
  const fromB = b.courts.filter((row) => row.physicalCourtId === COURT_1);
  assert.equal(fromA.length, 1);
  assert.equal(fromB.length, 1);
  assert.equal(fromA[0].physicalCourtId, fromB[0].physicalCourtId);
  assert.equal(fromA[0].physicalCourtId, COURT_1);
});

test("H. display rename does not change physicalCourtId", async () => {
  const renamed = snapshot({
    physicalCourts: [
      court({ displayName: "Centre Court", displayCode: "CC", displayNumber: "99" }),
    ],
    clubOperationalAccess: [access()],
  });
  const before = listEligiblePhysicalCourts({ tenantId: TENANT_A, clubId: CLUB_A }, snapshot());
  const after = listEligiblePhysicalCourts({ tenantId: TENANT_A, clubId: CLUB_A }, renamed);
  assert.equal(before.courts[0].physicalCourtId, COURT_1);
  assert.equal(after.courts[0].physicalCourtId, COURT_1);
  assert.equal(after.courts[0].displayName, "Centre Court");
  assert.notEqual(after.courts[0].displayName, before.courts[0].displayName);
});

test("I. canonical listEligibleCourts has no club_data_v3/localStorage dependency", async () => {
  bindInventory(snapshot());
  const previous = globalThis.localStorage;
  let localStorageUsed = false;
  globalThis.localStorage = {
    getItem() {
      localStorageUsed = true;
      return JSON.stringify({ courts: [{ id: "blob-court" }] });
    },
    setItem() {
      localStorageUsed = true;
    },
  };
  try {
    const result = await listEligibleCourts({ tenantId: TENANT_A, clubId: CLUB_A });
    assert.equal(result.ok, true);
    assert.equal(localStorageUsed, false);
    assert.equal(result.courts.some((row) => row.physicalCourtId === "blob-court"), false);
  } finally {
    globalThis.localStorage = previous;
  }
});

test("J. physicalCourtId is returned natively", async () => {
  bindInventory(snapshot());
  const result = await listEligibleCourts({ tenantId: TENANT_A, clubId: CLUB_A });
  assert.equal(result.courts.length > 0, true);
  for (const row of result.courts) {
    assert.equal(typeof row.physicalCourtId, "string");
    assert.match(row.physicalCourtId, /^[0-9a-f-]{36}$/i);
    assert.equal(row.identityAuthority, "physicalCourtId");
  }
});

test("K. legacy court label/number cannot establish identity", async () => {
  bindInventory(snapshot());
  const byLabel = await listEligibleCourts({
    tenantId: TENANT_A,
    clubId: CLUB_A,
    courtLabel: "Sân 1",
  });
  assert.equal(byLabel.ok, false);
  assert.equal(byLabel.code, COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED);

  const byLegacyId = await listEligibleCourts({
    tenantId: TENANT_A,
    clubId: CLUB_A,
    selectedCourtIds: ["NL_C01"],
  });
  assert.equal(byLegacyId.ok, false);
  assert.equal(byLegacyId.code, COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED);
});

test("L. club possession of a legacy blob court does not establish canonical access", async () => {
  bindInventory(
    snapshot({
      clubOperationalAccess: [access({ clubId: CLUB_B })],
      legacyBlobCourts: [{ id: COURT_1, name: "Sân 1", clubId: CLUB_A, number: 1 }],
    })
  );
  const result = await listEligibleCourts({ tenantId: TENANT_A, clubId: CLUB_A });
  assert.equal(result.ok, true);
  assert.equal(result.courts.some((row) => row.physicalCourtId === COURT_1), false);
});

test("missing tenantId and clubId fail closed without inventory reads", async () => {
  bindInventory(snapshot());
  const noTenant = await listEligibleCourts({ clubId: CLUB_A });
  assert.equal(noTenant.ok, false);
  assert.equal(noTenant.code, COURT_RESOURCE_CODE.TENANT_MISMATCH);
  const noClub = await listEligibleCourts({ tenantId: TENANT_A });
  assert.equal(noClub.ok, false);
  assert.equal(noClub.code, COURT_RESOURCE_CODE.MISSING_CLUB_ID);
});

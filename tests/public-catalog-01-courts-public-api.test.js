/**
 * PUBLIC-CATALOG-01 — Courts public API contract tests.
 * Run: node --test tests/public-catalog-01-courts-public-api.test.js
 */
import assert from "node:assert/strict";
import test from "node:test";

import * as catalog from "../src/features/public-catalog/index.js";
import { isOk } from "../src/core/platform/contracts/result.js";

function seedCourts() {
  return [
    {
      id: "court-2",
      club_id: "club-a",
      venue_id: "venue-a",
      display_name: "Court B",
      court_type: "indoor",
      surface: "concrete",
      availability_descriptor: "06:00 – 22:00",
      publication_state: "published",
      operational_state: "active",
      is_publicly_listed: true,
      defaultHourlyRate: 999,
      note: "maintenance secret",
      peakHourlyRate: 1500,
    },
    {
      id: "court-1",
      club_id: "club-a",
      venue_id: "venue-a",
      display_name: "Court A",
      court_type: "outdoor",
      publication_state: "published",
      operational_state: "active",
      is_publicly_listed: true,
    },
    {
      id: "court-archived",
      club_id: "club-a",
      venue_id: "venue-a",
      display_name: "Archived Court",
      publication_state: "archived",
      operational_state: "active",
      is_publicly_listed: true,
    },
    {
      id: "court-private-club",
      club_id: "club-private",
      venue_id: "venue-p",
      display_name: "Hidden Court",
      publication_state: "published",
      operational_state: "active",
      is_publicly_listed: false,
    },
  ];
}

function createFacade() {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    courts: seedCourts(),
  });
  return catalog.createPublicCatalogFacade({ repository });
}

test("Courts: unauthenticated public read returns allowlisted DTO only", async () => {
  const facade = createFacade();
  const result = await facade.listPublicCourts({ limit: 10, offset: 0 });
  assert.equal(isOk(result), true);
  assert.equal(result.value.provenance, catalog.PUBLIC_CATALOG_PROVENANCE.LIVE);
  assert.equal(result.value.items.length, 2);

  for (const item of result.value.items) {
    const keys = Object.keys(item).sort();
    assert.deepEqual(keys, [...catalog.PUBLIC_COURT_DTO_KEYS].sort());
    for (const forbidden of catalog.PUBLIC_COURT_FORBIDDEN_KEYS) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(item, forbidden),
        false,
        `forbidden key leaked: ${forbidden}`
      );
    }
  }

  assert.equal(result.value.items[0].displayName, "Court A");
  assert.equal(result.value.items[1].displayName, "Court B");
});

test("Courts: private pricing / notes never appear", async () => {
  const facade = createFacade();
  const result = await facade.listPublicCourts();
  assert.equal(isOk(result), true);
  const json = JSON.stringify(result.value.items);
  assert.equal(json.includes("999"), false);
  assert.equal(json.includes("1500"), false);
  assert.equal(json.includes("maintenance secret"), false);
  assert.equal(json.includes("defaultHourlyRate"), false);
  assert.equal(json.includes("peakHourlyRate"), false);
});

test("Courts: archived and private-club courts excluded", async () => {
  const facade = createFacade();
  const result = await facade.listPublicCourts();
  assert.equal(isOk(result), true);
  const ids = result.value.items.map((c) => c.id);
  assert.equal(ids.includes("court-archived"), false);
  assert.equal(ids.includes("court-private-club"), false);
});

test("Courts: clubId filter works", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    courts: [
      ...seedCourts(),
      {
        id: "court-x",
        club_id: "club-b",
        venue_id: "venue-b",
        display_name: "Other Club Court",
        publication_state: "published",
        operational_state: "active",
        is_publicly_listed: true,
      },
    ],
  });
  const facade = catalog.createPublicCatalogFacade({ repository });
  const result = await facade.listPublicCourts({ clubId: "club-b" });
  assert.equal(isOk(result), true);
  assert.equal(result.value.items.length, 1);
  assert.equal(result.value.items[0].id, "court-x");
});

test("Courts: projector rejects non-active operational state", () => {
  assert.throws(
    () =>
      catalog.projectPublicCourt({
        id: "c1",
        club_id: "club-a",
        venue_id: "v1",
        display_name: "X",
        operational_state: "maintenance",
        publication_state: "published",
      }),
    (err) => err.code === catalog.PUBLIC_CATALOG_ERROR_CODE.ARCHIVED_OR_PRIVATE
  );
});

test("Courts: remote entrypoint works with injected repository", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    courts: seedCourts(),
  });
  const result = await catalog.listPublicCourtsRemote(
    { limit: 5 },
    { repository }
  );
  assert.equal(isOk(result), true);
  assert.equal(result.value.items.length, 2);
});

/**
 * PUBLIC-CATALOG-01 — Clubs public API contract tests.
 * Run: node --test tests/public-catalog-01-clubs-public-api.test.js
 */
import assert from "node:assert/strict";
import test from "node:test";

import * as catalog from "../src/features/public-catalog/index.js";
import { isOk } from "../src/core/platform/contracts/result.js";

function seedClubs() {
  return [
    {
      id: "club-b",
      name: "Beta Club",
      display_name: "Beta Club",
      description: "Public beta",
      public_slug: "beta-club",
      public_location_summary: "Hà Nội",
      public_logo_url: "https://cdn.example/logo-b.png",
      is_publicly_listed: true,
      status: "active",
      note: "SECRET NOTE",
      ownerEmail: "owner@secret.example",
      createdByUserId: "user-secret",
      governance: { ownerUserId: "u1" },
    },
    {
      id: "club-a",
      name: "Alpha Club",
      display_name: "Alpha Club",
      description: "Public alpha",
      public_slug: "alpha-club",
      is_publicly_listed: true,
      status: "active",
    },
    {
      id: "club-private",
      name: "Private Club",
      display_name: "Private Club",
      is_publicly_listed: false,
      status: "active",
      note: "should never leak",
    },
  ];
}

function createFacade(extra = {}) {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    clubs: seedClubs(),
    ...extra,
  });
  return {
    facade: catalog.createPublicCatalogFacade({ repository }),
    repository,
  };
}

test("Clubs: unauthenticated public read returns allowlisted DTO only", async () => {
  const { facade } = createFacade();
  const result = await facade.listPublicClubs({ limit: 10, offset: 0 });
  assert.equal(isOk(result), true);
  assert.equal(result.value.provenance, catalog.PUBLIC_CATALOG_PROVENANCE.LIVE);
  assert.equal(result.value.items.length, 2);

  for (const item of result.value.items) {
    const keys = Object.keys(item).sort();
    assert.deepEqual(keys, [...catalog.PUBLIC_CLUB_DTO_KEYS].sort());
    for (const forbidden of catalog.PUBLIC_CLUB_FORBIDDEN_KEYS) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(item, forbidden),
        false,
        `forbidden key leaked: ${forbidden}`
      );
    }
  }

  assert.equal(result.value.items[0].displayName, "Alpha Club");
  assert.equal(result.value.items[0].id, "club-a");
  assert.equal(result.value.items[1].displayName, "Beta Club");
});

test("Clubs: private fields never appear on projected DTO", async () => {
  const { facade } = createFacade();
  const result = await facade.listPublicClubs();
  assert.equal(isOk(result), true);
  const beta = result.value.items.find((c) => c.id === "club-b");
  assert.ok(beta);
  assert.equal(beta.note, undefined);
  assert.equal(beta.ownerEmail, undefined);
  assert.equal(beta.governance, undefined);
  assert.equal(beta.createdByUserId, undefined);
  assert.equal(JSON.stringify(beta).includes("SECRET"), false);
  assert.equal(JSON.stringify(beta).includes("owner@secret"), false);
});

test("Clubs: unpublished / private clubs excluded", async () => {
  const { facade } = createFacade();
  const result = await facade.listPublicClubs();
  assert.equal(isOk(result), true);
  assert.equal(
    result.value.items.some((c) => c.id === "club-private"),
    false
  );
});

test("Clubs: projector rejects inactive / deleted rows", () => {
  assert.throws(
    () =>
      catalog.projectPublicClub({
        id: "x",
        name: "X",
        status: "inactive",
        is_publicly_listed: true,
      }),
    (err) => err.code === catalog.PUBLIC_CATALOG_ERROR_CODE.ARCHIVED_OR_PRIVATE
  );
  assert.throws(
    () =>
      catalog.projectPublicClub({
        id: "x",
        name: "X",
        status: "active",
        is_publicly_listed: true,
        deleted_at: "2026-01-01T00:00:00Z",
      }),
    (err) => err.code === catalog.PUBLIC_CATALOG_ERROR_CODE.ARCHIVED_OR_PRIVATE
  );
});

test("Clubs: remote entrypoint works with injected repository", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    clubs: seedClubs(),
  });
  const result = await catalog.listPublicClubsRemote(
    { limit: 5 },
    { repository }
  );
  assert.equal(isOk(result), true);
  assert.equal(result.value.items.length, 2);
});

test("Clubs: no mutation methods on facade", () => {
  const { facade } = createFacade();
  assert.equal(typeof facade.create, "undefined");
  assert.equal(typeof facade.update, "undefined");
  assert.equal(typeof facade.delete, "undefined");
  assert.deepEqual(Object.keys(facade).sort(), [
    "listPublicClubs",
    "listPublicCourts",
    "listPublicRankings",
    "listPublicTournaments",
  ]);
});

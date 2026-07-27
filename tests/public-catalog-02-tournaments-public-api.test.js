/**
 * PUBLIC-CATALOG-02 — Tournaments public API contract tests.
 * Run: node --test tests/public-catalog-02-tournaments-public-api.test.js
 */
import assert from "node:assert/strict";
import test from "node:test";

import * as catalog from "../src/features/public-catalog/index.js";
import { isOk, isFail } from "../src/core/platform/contracts/result.js";

function seedTournaments() {
  return [
    {
      id: "t-b",
      display_name: "Beta Open",
      slug: "beta-open",
      sport: "pickleball",
      publication_state: "published",
      operational_status: "upcoming",
      start_date: "2026-08-01",
      location_summary: "Hà Nội",
      format_summary: "Single elimination",
      category_summary: "Men's Doubles",
      note: "SECRET INTERNAL NOTE",
      staff: [{ id: "ref-1" }],
      participants: [{ phone: "+84000000000" }],
    },
    {
      id: "t-a",
      display_name: "Alpha Cup",
      slug: "alpha-cup",
      sport: "pickleball",
      publication_state: "published",
      operational_status: "live",
      start_date: "2026-07-20",
      end_date: "2026-07-22",
      location_summary: "HCM",
    },
    {
      id: "t-private",
      display_name: "Private Draft",
      publication_state: "unpublished",
      operational_status: "upcoming",
      note: "must never leak",
    },
  ];
}

function createFacade(extra = {}) {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    tournaments: seedTournaments(),
    ...extra,
  });
  return {
    facade: catalog.createPublicCatalogFacade({ repository }),
    repository,
  };
}

test("Tournaments: unauthenticated public read returns allowlisted DTO only", async () => {
  const { facade } = createFacade();
  const result = await facade.listPublicTournaments({ limit: 10, offset: 0 });
  assert.equal(isOk(result), true);
  assert.equal(result.value.provenance, catalog.PUBLIC_CATALOG_PROVENANCE.LIVE);
  assert.equal(result.value.items.length, 2);

  for (const item of result.value.items) {
    assert.deepEqual(
      Object.keys(item).sort(),
      [...catalog.PUBLIC_TOURNAMENT_DTO_KEYS].sort()
    );
    for (const forbidden of catalog.PUBLIC_TOURNAMENT_FORBIDDEN_KEYS) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(item, forbidden),
        false,
        `forbidden key leaked: ${forbidden}`
      );
    }
  }

  assert.equal(result.value.items[0].displayName, "Alpha Cup");
  assert.equal(result.value.items[0].id, "t-a");
  assert.equal(result.value.items[1].displayName, "Beta Open");
});

test("Tournaments: private fields never appear on projected DTO", async () => {
  const { facade } = createFacade();
  const result = await facade.listPublicTournaments();
  assert.equal(isOk(result), true);
  const beta = result.value.items.find((t) => t.id === "t-b");
  assert.ok(beta);
  assert.equal(beta.note, undefined);
  assert.equal(beta.staff, undefined);
  assert.equal(beta.participants, undefined);
  assert.equal(JSON.stringify(beta).includes("SECRET"), false);
  assert.equal(JSON.stringify(beta).includes("+84000000000"), false);
});

test("Tournaments: unpublished rows excluded", async () => {
  const { facade } = createFacade();
  const result = await facade.listPublicTournaments();
  assert.equal(isOk(result), true);
  assert.equal(
    result.value.items.some((t) => t.id === "t-private"),
    false
  );
});

test("Tournaments: empty projection is LIVE with zero items", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    tournaments: [],
  });
  const facade = catalog.createPublicCatalogFacade({ repository });
  const result = await facade.listPublicTournaments();
  assert.equal(isOk(result), true);
  assert.equal(result.value.provenance, catalog.PUBLIC_CATALOG_PROVENANCE.LIVE);
  assert.deepEqual(result.value.items, []);
  assert.equal(result.value.pagination.total, 0);
});

test("Tournaments: projector rejects unpublished", () => {
  assert.throws(
    () =>
      catalog.projectPublicTournament({
        id: "x",
        display_name: "X",
        publication_state: "unpublished",
        operational_status: "upcoming",
      }),
    (err) => err.code === catalog.PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC
  );
});

test("Tournaments: remote entrypoint works with injected repository", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    tournaments: seedTournaments(),
  });
  const result = await catalog.listPublicTournamentsRemote(
    { limit: 5 },
    { repository }
  );
  assert.equal(isOk(result), true);
  assert.equal(result.value.items.length, 2);
});

test("Tournaments: RPC failure is typed fail, not empty LIVE", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    tournaments: seedTournaments(),
    failTournaments: new catalog.PublicCatalogError(
      catalog.PUBLIC_CATALOG_ERROR_CODE.NETWORK_FAILURE,
      "boom"
    ),
  });
  const facade = catalog.createPublicCatalogFacade({ repository });
  const result = await facade.listPublicTournaments();
  assert.equal(isFail(result), true);
  assert.equal(result.error.code, catalog.PUBLIC_CATALOG_ERROR_CODE.NETWORK_FAILURE);
});

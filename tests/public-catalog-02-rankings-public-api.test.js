/**
 * PUBLIC-CATALOG-02 — Rankings public API contract tests.
 * Run: node --test tests/public-catalog-02-rankings-public-api.test.js
 */
import assert from "node:assert/strict";
import test from "node:test";

import * as catalog from "../src/features/public-catalog/index.js";
import { isOk, isFail } from "../src/core/platform/contracts/result.js";

function seedRankings() {
  return [
    {
      id: "r-2",
      display_name: "Beta Athlete",
      club_name: "Club B",
      region: "Hà Nội",
      category: "men_single",
      gender: "male",
      rank: 2,
      total_points: 800,
      tournaments_count: 4,
      best_placement: "QF",
      publication_state: "published",
      phone: "+84999999999",
      email: "secret@example.com",
      memberId: "MEM-SECRET",
      adjustmentHistory: [{ delta: 10 }],
    },
    {
      id: "r-1",
      display_name: "Alpha Athlete",
      club_name: "Club A",
      region: "HCM",
      category: "men_single",
      gender: "male",
      rank: 1,
      total_points: 1200,
      tournaments_count: 6,
      best_placement: "Champion",
      publication_state: "published",
    },
    {
      id: "r-women",
      display_name: "Gamma Athlete",
      category: "women_single",
      rank: 1,
      total_points: 900,
      publication_state: "published",
    },
    {
      id: "r-private",
      display_name: "Hidden",
      category: "men_single",
      rank: 99,
      publication_state: "unpublished",
      phone: "must-not-leak",
    },
  ];
}

function createFacade(extra = {}) {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    rankings: seedRankings(),
    ...extra,
  });
  return {
    facade: catalog.createPublicCatalogFacade({ repository }),
    repository,
  };
}

test("Rankings: unauthenticated public read returns allowlisted DTO only", async () => {
  const { facade } = createFacade();
  const result = await facade.listPublicRankings({
    limit: 10,
    offset: 0,
    category: "men_single",
  });
  assert.equal(isOk(result), true);
  assert.equal(result.value.provenance, catalog.PUBLIC_CATALOG_PROVENANCE.LIVE);
  assert.equal(result.value.items.length, 2);

  for (const item of result.value.items) {
    assert.deepEqual(
      Object.keys(item).sort(),
      [...catalog.PUBLIC_RANKING_DTO_KEYS].sort()
    );
    for (const forbidden of catalog.PUBLIC_RANKING_FORBIDDEN_KEYS) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(item, forbidden),
        false,
        `forbidden key leaked: ${forbidden}`
      );
    }
  }

  assert.equal(result.value.items[0].rank, 1);
  assert.equal(result.value.items[0].id, "r-1");
  assert.equal(result.value.items[1].rank, 2);
});

test("Rankings: private identity fields never appear", async () => {
  const { facade } = createFacade();
  const result = await facade.listPublicRankings({ category: "men_single" });
  assert.equal(isOk(result), true);
  const beta = result.value.items.find((r) => r.id === "r-2");
  assert.ok(beta);
  assert.equal(beta.phone, undefined);
  assert.equal(beta.email, undefined);
  assert.equal(beta.memberId, undefined);
  assert.equal(beta.adjustmentHistory, undefined);
  assert.equal(JSON.stringify(beta).includes("secret@"), false);
  assert.equal(JSON.stringify(beta).includes("MEM-SECRET"), false);
});

test("Rankings: unpublished excluded; category filter works", async () => {
  const { facade } = createFacade();
  const men = await facade.listPublicRankings({ category: "men_single" });
  assert.equal(isOk(men), true);
  assert.equal(men.value.items.some((r) => r.id === "r-private"), false);
  assert.equal(men.value.items.some((r) => r.id === "r-women"), false);

  const women = await facade.listPublicRankings({ category: "women_single" });
  assert.equal(isOk(women), true);
  assert.equal(women.value.items.length, 1);
  assert.equal(women.value.items[0].id, "r-women");
});

test("Rankings: empty projection is LIVE with zero items", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    rankings: [],
  });
  const facade = catalog.createPublicCatalogFacade({ repository });
  const result = await facade.listPublicRankings();
  assert.equal(isOk(result), true);
  assert.equal(result.value.provenance, catalog.PUBLIC_CATALOG_PROVENANCE.LIVE);
  assert.deepEqual(result.value.items, []);
});

test("Rankings: projector rejects invalid rank / unpublished", () => {
  assert.throws(
    () =>
      catalog.projectPublicRanking({
        id: "x",
        display_name: "X",
        category: "men_single",
        rank: 0,
        publication_state: "published",
      }),
    (err) => err.code === catalog.PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC
  );
  assert.throws(
    () =>
      catalog.projectPublicRanking({
        id: "x",
        display_name: "X",
        category: "men_single",
        rank: 1,
        publication_state: "archived",
      }),
    (err) => err.code === catalog.PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC
  );
});

test("Rankings: remote entrypoint + failure path", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    rankings: seedRankings(),
  });
  const okResult = await catalog.listPublicRankingsRemote(
    { limit: 5, category: "men_single" },
    { repository }
  );
  assert.equal(isOk(okResult), true);
  assert.equal(okResult.value.items.length, 2);

  repository.setFailRankings(
    new catalog.PublicCatalogError(
      catalog.PUBLIC_CATALOG_ERROR_CODE.RPC_FAILURE,
      "rpc boom"
    )
  );
  const failResult = await catalog.listPublicRankingsRemote({}, { repository });
  assert.equal(isFail(failResult), true);
  assert.equal(
    failResult.error.code,
    catalog.PUBLIC_CATALOG_ERROR_CODE.RPC_FAILURE
  );
});

/**
 * PUBLIC-CATALOG-01 — Pagination / order / error tests.
 * Run: node --test tests/public-catalog-01-pagination-order-error.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as catalog from "../src/features/public-catalog/index.js";
import { isOk, isFail } from "../src/core/platform/contracts/result.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function manyClubs(n) {
  return Array.from({ length: n }, (_, i) => {
    const id = `club-${String(i).padStart(3, "0")}`;
    return {
      id,
      name: `Club ${String(i).padStart(3, "0")}`,
      display_name: `Club ${String(i).padStart(3, "0")}`,
      is_publicly_listed: true,
      status: "active",
    };
  });
}

test("Pagination: limit bounded; over-max rejected", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    clubs: manyClubs(60),
  });
  const facade = catalog.createPublicCatalogFacade({ repository });

  const okResult = await facade.listPublicClubs({ limit: 50, offset: 0 });
  assert.equal(isOk(okResult), true);
  assert.equal(okResult.value.items.length, 50);
  assert.equal(okResult.value.pagination.limit, 50);

  const bad = await facade.listPublicClubs({ limit: 51 });
  assert.equal(isFail(bad), true);
  assert.equal(bad.error.code, catalog.PUBLIC_CATALOG_ERROR_CODE.INVALID_PAGINATION);
});

test("Pagination: negative offset / non-integer rejected", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    clubs: manyClubs(3),
  });
  const facade = catalog.createPublicCatalogFacade({ repository });

  const neg = await facade.listPublicClubs({ offset: -1 });
  assert.equal(isFail(neg), true);
  assert.equal(neg.error.code, catalog.PUBLIC_CATALOG_ERROR_CODE.INVALID_PAGINATION);

  const float = await facade.listPublicClubs({ limit: 1.5 });
  assert.equal(isFail(float), true);
  assert.equal(float.error.code, catalog.PUBLIC_CATALOG_ERROR_CODE.INVALID_PAGINATION);
});

test("Ordering: deterministic name_asc by displayName then id", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    clubs: [
      { id: "b", name: "Same", display_name: "Same", is_publicly_listed: true, status: "active" },
      { id: "a", name: "Same", display_name: "Same", is_publicly_listed: true, status: "active" },
      { id: "c", name: "Zed", display_name: "Zed", is_publicly_listed: true, status: "active" },
    ],
  });
  const facade = catalog.createPublicCatalogFacade({ repository });
  const first = await facade.listPublicClubs();
  const second = await facade.listPublicClubs();
  assert.equal(isOk(first), true);
  assert.deepEqual(
    first.value.items.map((i) => i.id),
    ["a", "b", "c"]
  );
  assert.deepEqual(
    first.value.items.map((i) => i.id),
    second.value.items.map((i) => i.id)
  );
});

test("Error: network/RPC failure is typed fail, not empty success", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    clubs: manyClubs(2),
    failClubs: new catalog.PublicCatalogError(
      catalog.PUBLIC_CATALOG_ERROR_CODE.NETWORK_FAILURE,
      "boom"
    ),
  });
  const facade = catalog.createPublicCatalogFacade({ repository });
  const result = await facade.listPublicClubs();
  assert.equal(isFail(result), true);
  assert.equal(result.error.code, catalog.PUBLIC_CATALOG_ERROR_CODE.NETWORK_FAILURE);
  assert.equal(result.value, undefined);
});

test("Error: malformed repository payload is fail, not empty success", async () => {
  const repository = {
    async listPublicClubs() {
      return { rows: null, total: 0 };
    },
    async listPublicCourts() {
      return { rows: [], total: 0 };
    },
  };
  const facade = catalog.createPublicCatalogFacade({ repository });
  const result = await facade.listPublicClubs();
  assert.equal(isFail(result), true);
  assert.equal(
    result.error.code,
    catalog.PUBLIC_CATALOG_ERROR_CODE.MALFORMED_RESPONSE
  );
});

test("Error: unsupported sort rejected", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    clubs: manyClubs(1),
  });
  const facade = catalog.createPublicCatalogFacade({ repository });
  const result = await facade.listPublicClubs({ sort: "name_desc" });
  assert.equal(isFail(result), true);
  assert.equal(result.error.code, catalog.PUBLIC_CATALOG_ERROR_CODE.INVALID_SORT);
});

test("Error: Supabase client rpc error maps to fail", async () => {
  const client = {
    async rpc() {
      return { data: null, error: { message: "network timeout", code: "TIMEOUT" } };
    },
  };
  const repository = catalog.createSupabasePublicCatalogRepository({ client });
  const facade = catalog.createPublicCatalogFacade({ repository });
  const result = await facade.listPublicClubs({ limit: 5 });
  assert.equal(isFail(result), true);
  assert.ok(
    [
      catalog.PUBLIC_CATALOG_ERROR_CODE.NETWORK_FAILURE,
      catalog.PUBLIC_CATALOG_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
      catalog.PUBLIC_CATALOG_ERROR_CODE.RPC_FAILURE,
    ].includes(result.error.code)
  );
});

test("No mock fallback string in remote adapter / repository", () => {
  const remote = fs.readFileSync(
    path.join(ROOT, "src/features/public-catalog/remote/index.js"),
    "utf8"
  );
  const repo = fs.readFileSync(
    path.join(
      ROOT,
      "src/features/public-catalog/persistence/supabase/createSupabasePublicCatalogRepository.js"
    ),
    "utf8"
  );
  assert.doesNotMatch(remote, /MOCK_CLUBS|MOCK_COURTS|allowMockFallback/);
  assert.doesNotMatch(repo, /MOCK_CLUBS|MOCK_COURTS|allowMockFallback/);
  assert.match(repo, /public_catalog_list_clubs|PUBLIC_CATALOG_RPC\.LIST_CLUBS/);
});

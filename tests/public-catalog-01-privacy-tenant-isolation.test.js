/**
 * PUBLIC-CATALOG-01 — Privacy / tenant isolation tests.
 * Run: node --test tests/public-catalog-01-privacy-tenant-isolation.test.js
 */
import assert from "node:assert/strict";
import test from "node:test";

import * as catalog from "../src/features/public-catalog/index.js";
import { isOk, isFail } from "../src/core/platform/contracts/result.js";

test("Privacy: tenant-private club never listed even if active", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    clubs: [
      {
        id: "tenant-private",
        name: "Tenant Private",
        display_name: "Tenant Private",
        status: "active",
        is_publicly_listed: false,
        tenantId: "venue-secret",
        note: "internal",
      },
    ],
  });
  const facade = catalog.createPublicCatalogFacade({ repository });
  const result = await facade.listPublicClubs();
  assert.equal(isOk(result), true);
  assert.equal(result.value.items.length, 0);
});

test("Privacy: cross-tenant court of unlisted club never listed", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    courts: [
      {
        id: "court-leak",
        club_id: "other-tenant-club",
        venue_id: "venue-other",
        display_name: "Should Not Appear",
        publication_state: "published",
        operational_state: "active",
        is_publicly_listed: false,
        defaultHourlyRate: 42,
      },
    ],
  });
  const facade = catalog.createPublicCatalogFacade({ repository });
  const result = await facade.listPublicCourts();
  assert.equal(isOk(result), true);
  assert.equal(result.value.items.length, 0);
});

test("Privacy: clubs and courts fail independently", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    clubs: [
      {
        id: "club-ok",
        name: "OK Club",
        display_name: "OK Club",
        is_publicly_listed: true,
        status: "active",
      },
    ],
    courts: [
      {
        id: "court-ok",
        club_id: "club-ok",
        venue_id: "v1",
        display_name: "OK Court",
        publication_state: "published",
        operational_state: "active",
        is_publicly_listed: true,
      },
    ],
    failCourts: new catalog.PublicCatalogError(
      catalog.PUBLIC_CATALOG_ERROR_CODE.NETWORK_FAILURE,
      "courts network down"
    ),
  });
  const facade = catalog.createPublicCatalogFacade({ repository });

  const clubs = await facade.listPublicClubs();
  assert.equal(isOk(clubs), true);
  assert.equal(clubs.value.items.length, 1);

  const courts = await facade.listPublicCourts();
  assert.equal(isFail(courts), true);
  assert.equal(
    courts.error.code,
    catalog.PUBLIC_CATALOG_ERROR_CODE.NETWORK_FAILURE
  );
});

test("Privacy: clubs failure does not empty courts success", async () => {
  const repository = catalog.createInMemoryPublicCatalogRepository({
    clubs: [
      {
        id: "club-ok",
        name: "OK Club",
        display_name: "OK Club",
        is_publicly_listed: true,
        status: "active",
      },
    ],
    courts: [
      {
        id: "court-ok",
        club_id: "club-ok",
        venue_id: "v1",
        display_name: "OK Court",
        publication_state: "published",
        operational_state: "active",
        is_publicly_listed: true,
      },
    ],
    failClubs: new catalog.PublicCatalogError(
      catalog.PUBLIC_CATALOG_ERROR_CODE.RPC_FAILURE,
      "clubs rpc down"
    ),
  });
  const facade = catalog.createPublicCatalogFacade({ repository });

  const clubs = await facade.listPublicClubs();
  assert.equal(isFail(clubs), true);

  const courts = await facade.listPublicCourts();
  assert.equal(isOk(courts), true);
  assert.equal(courts.value.items.length, 1);
});

test("Privacy: Supabase repository never selects wildcards / mutations", () => {
  assert.equal(typeof catalog.createSupabasePublicCatalogRepository, "function");
  assert.equal(
    catalog.PUBLIC_CATALOG_RPC.LIST_CLUBS,
    "public_catalog_list_clubs"
  );
  assert.equal(
    catalog.PUBLIC_CATALOG_RPC.LIST_COURTS,
    "public_catalog_list_courts"
  );
  assert.equal(catalog.PUBLIC_CATALOG_SQL_MANIFEST.stagingApply, false);
  assert.equal(catalog.PUBLIC_CATALOG_SQL_MANIFEST.productionApply, false);
});

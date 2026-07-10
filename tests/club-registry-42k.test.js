import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import {
  CLUB_REGISTRY_SCOPE,
  buildClubRegistryCacheKey,
  invalidateClubRegistryCache,
  resetClubRegistryCacheForTests,
  writeClubRegistryCache,
  readClubRegistryCache,
} from "../src/features/club/registry/clubRegistryCache.js";
import {
  assertTenantRegistryAccess,
  assertPlatformRegistryAccess,
  filterRegistryRows,
  normalizeRegistryRow,
  paginateRegistryRows,
} from "../src/features/club/services/clubRegistryService.js";

describe("42K registry cache keys", () => {
  it("tenant cache keys are isolated per tenant", () => {
    const keyA = buildClubRegistryCacheKey(CLUB_REGISTRY_SCOPE.TENANT, "tenant-a", { search: "" });
    const keyB = buildClubRegistryCacheKey(CLUB_REGISTRY_SCOPE.TENANT, "tenant-b", { search: "" });
    assert.notEqual(keyA, keyB);
  });

  it("invalidate tenant cache does not clear other tenant", () => {
    resetClubRegistryCacheForTests();
    const keyA = buildClubRegistryCacheKey(CLUB_REGISTRY_SCOPE.TENANT, "tenant-a", {});
    const keyB = buildClubRegistryCacheKey(CLUB_REGISTRY_SCOPE.TENANT, "tenant-b", {});
    writeClubRegistryCache(keyA, [{ id: "c1" }]);
    writeClubRegistryCache(keyB, [{ id: "c2" }]);
    invalidateClubRegistryCache({ tenantId: "tenant-a", scope: CLUB_REGISTRY_SCOPE.TENANT });
    assert.equal(readClubRegistryCache(keyA), null);
    assert.ok(readClubRegistryCache(keyB));
  });
});

describe("42K ClubListPage V2 UI", () => {
  it("V2 path hides pending request column", () => {
    const src = readFileSync(
      new URL("../src/pages/clubs/ClubListPage.jsx", import.meta.url),
      "utf8"
    );
    const v2Block = src.slice(src.indexOf("if (storageV2) {"), src.indexOf("const clubs = getClubsVisibleToUser"));
    assert.doesNotMatch(v2Block, /Chờ duyệt/);
    assert.doesNotMatch(v2Block, /pendingRequestCount/);
  });
});

describe("42K registry read model", () => {
  it("normalizeRegistryRow maps canonical fields", () => {
    const row = normalizeRegistryRow({
      id: "club-1",
      tenant_id: "venue-a",
      name: "ACCC",
      code: "ACCC",
      status: "active",
      active_member_count: 12,
      owner_label: "Owner A",
      president_label: "Pres B",
    });
    assert.equal(row.id, "club-1");
    assert.equal(row.tenantId, "venue-a");
    assert.equal(row.memberCount, 12);
    assert.equal(row.ownerName, "Owner A");
  });

  it("filterRegistryRows scopes tenant A vs B", () => {
    const rows = [
      normalizeRegistryRow({ id: "1", tenant_id: "tenant-a", name: "A", status: "active" }),
      normalizeRegistryRow({ id: "2", tenant_id: "tenant-b", name: "B", status: "active" }),
    ];
    const onlyA = filterRegistryRows(rows, { tenantFilter: "tenant-a" });
    assert.equal(onlyA.length, 1);
    assert.equal(onlyA[0].tenantId, "tenant-a");
  });

  it("tenant user cannot access other tenant registry", () => {
    const user = { id: "u1", role: "COURT_OWNER", tenantId: "tenant-a" };
    const ok = assertTenantRegistryAccess(user, "tenant-a");
    const bad = assertTenantRegistryAccess(user, "tenant-b");
    assert.equal(ok.ok, true);
    assert.equal(bad.code, "TENANT_FORBIDDEN");
  });

  it("platform registry requires platform role", () => {
    const sa = assertPlatformRegistryAccess({ id: "1", role: "SUPER_ADMIN" });
    const player = assertPlatformRegistryAccess({ id: "2", role: "PLAYER" });
    assert.equal(sa.ok, true);
    assert.equal(player.code, "FORBIDDEN");
  });

  it("paginateRegistryRows", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}` }));
    const page = paginateRegistryRows(rows, { page: 2, pageSize: 10 });
    assert.equal(page.rows.length, 10);
    assert.equal(page.page, 2);
    assert.equal(page.total, 30);
  });
});

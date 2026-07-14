import test from "node:test";
import assert from "node:assert/strict";

import {
  createCanonicalClubRepository,
  LOCAL_DEFAULT_CLUB_ID,
} from "../src/features/club/repositories/index.js";
import { ACCC_FIXTURE } from "./fixtures/accc-cloud-only-club.js";

test("CanonicalClubRepository V2 ON reads registry RPC and excludes default-club", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async () => ({
      ok: true,
      clubs: [ACCC_FIXTURE.club, ACCC_FIXTURE.defaultClub, ACCC_FIXTURE.otherTenantClub],
    }),
    loadLocalClubs: () => [ACCC_FIXTURE.defaultClub],
  });

  const result = await repo.listClubsForTenant(ACCC_FIXTURE.tenantId, {
    userContext: { isPlatformAdmin: true },
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, "v2_registry");
  assert.ok(result.data.some((c) => c.id === ACCC_FIXTURE.club.id));
  assert.ok(!result.data.some((c) => c.id === LOCAL_DEFAULT_CLUB_ID));
  assert.ok(!result.data.some((c) => c.id === ACCC_FIXTURE.otherTenantClub.id));
  assert.equal(result.execution.independentOfClubContext, true);
});

test("CanonicalClubRepository V2 OFF uses legacy adapter with source legacy_blob", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => false,
    listLocalClubsForTenant: () => [
      { id: "club-a", name: "A", tenantId: "t1", status: "active" },
      { id: LOCAL_DEFAULT_CLUB_ID, name: "CLB Mặc định", isDefault: true, tenantId: "t1" },
    ],
  });
  const result = await repo.listClubsForTenant("t1", { excludeDefault: true });
  assert.equal(result.ok, true);
  assert.equal(result.source, "legacy_blob");
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, "club-a");
});

test("CanonicalClubRepository blocks cross-tenant access for non-admin", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async () => ({ ok: true, clubs: [ACCC_FIXTURE.club] }),
  });
  const result = await repo.listClubsForTenant(ACCC_FIXTURE.tenantId, {
    userContext: {
      rbacEnabled: true,
      user: { role: "CLUB_ADMIN", tenantId: "venue-other", venueId: "venue-other" },
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "TENANT_FORBIDDEN");
});

test("CanonicalClubRepository omits inactive clubs by default", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async ({ includeInactive }) => ({
      ok: true,
      clubs: [
        ACCC_FIXTURE.club,
        { ...ACCC_FIXTURE.club, id: "club-inactive", status: "inactive" },
      ].filter((c) => includeInactive || c.status === "active"),
    }),
  });
  const result = await repo.listClubsForTenant(ACCC_FIXTURE.tenantId, {
    userContext: { isPlatformAdmin: true },
  });
  assert.ok(!result.data.some((c) => c.id === "club-inactive"));
});

test("CanonicalClubRepository V2 still returns clubs when ClubContext/local registry empty", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async () => ({ ok: true, clubs: [ACCC_FIXTURE.club] }),
    loadLocalClubs: () => [],
  });
  const result = await repo.listClubsForTenant(ACCC_FIXTURE.tenantId, {
    userContext: { isPlatformAdmin: true },
  });
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, ACCC_FIXTURE.club.id);
});

test("getClubById rejects default-club under V2", async () => {
  const repo = createCanonicalClubRepository({ isV2Enabled: () => true });
  const result = await repo.getClubById(LOCAL_DEFAULT_CLUB_ID);
  assert.equal(result.ok, false);
  assert.equal(result.code, "DEFAULT_CLUB_NOT_ALLOWED");
});

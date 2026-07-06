import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  assertSameTenant,
  assertTenantOperational,
  filterByTenant,
  guardClubTenant,
  guardRecordTenant,
  resolveTenantIdForClub,
  stampWithTenantId,
} from "../src/features/tenant/guards/tenantGuard.js";
import {
  ensureDefaultTenantMigration,
  ensureMultiTenantSeed,
  SEED_TENANTS,
} from "../src/features/tenant/seed/multiTenantSeed.js";
import {
  getTenantStats,
  listTenants,
  setTenantStatus,
} from "../src/features/tenant/services/tenantService.js";
import { saveClubs } from "../src/data/club.js";
import { savePlayersForClub } from "../src/domain/clubStorage.js";
import { createTournament } from "../src/domain/tournamentService.js";
import {
  assertTournamentAccess,
  listTournaments,
} from "../src/domain/tournamentService.js";
import { enableRbac, signInAs, signOut } from "../src/auth/authService.js";
import { ROLES } from "../src/auth/roles.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe("tenant sprint 2", () => {

  it("migrates legacy clubs to default tenant", () => {
    saveClubs([
      {
        id: "default-club",
        name: "CLB Mac dinh",
        isDefault: true,
      },
    ]);

    const result = ensureDefaultTenantMigration();
    assert.equal(result.ok, true);
    assert.equal(result.migratedClubs, true);

    const tenantId = resolveTenantIdForClub("default-club");
    assert.equal(tenantId, "default-tenant");
  });

  it("seeds three demo tenants with isolated stats", () => {
    ensureMultiTenantSeed();

    const tenants = listTenants().filter((tenant) =>
      SEED_TENANTS.some((seed) => seed.id === tenant.id)
    );

    assert.equal(tenants.length, 3);

    const futureStats = getTenantStats("tenant-future-arena");
    assert.equal(futureStats.players, 20);
    assert.equal(futureStats.courts, 4);
    assert.equal(futureStats.tournaments, 2);

    const abcStats = getTenantStats("tenant-abc-pickleball");
    assert.equal(abcStats.players, 15);
    assert.equal(abcStats.courts, 3);
    assert.equal(abcStats.tournaments, 1);

    const eliteStats = getTenantStats("tenant-elite-club");
    assert.equal(eliteStats.players, 25);
    assert.equal(eliteStats.courts, 6);
    assert.equal(eliteStats.tournaments, 2);
  });

  it("blocks cross-tenant club access", () => {
    ensureMultiTenantSeed();

    const check = guardClubTenant("club-future-arena", "tenant-abc-pickleball");
    assert.equal(check.ok, false);
    assert.equal(check.code, "TENANT_FORBIDDEN");
  });

  it("allows platform admin cross-tenant club access", async () => {
    ensureMultiTenantSeed();
    enableRbac(true);
    signInAs({
      id: "dev-platform-admin",
      email: "admin@platform.local",
      role: ROLES.PLATFORM_ADMIN,
    });

    const check = guardClubTenant("club-future-arena", "tenant-abc-pickleball");
    assert.equal(check.ok, true);

    const created = createTournament("club-future-arena", { name: "Giải admin test" });
    assert.equal(created.ok, true);

    await signOut();
    enableRbac(false);
  });

  it("stamps tenantId when saving players", () => {
    ensureMultiTenantSeed();

    savePlayersForClub(
      [{ id: "new-player", name: "Test Player", level: 3.5 }],
      "club-future-arena"
    );

    const players = JSON.parse(
      localStorage.getItem("pickleball-club-data-v3::club-future-arena")
    ).players;

    assert.equal(players[0].tenantId, "tenant-future-arena");
  });

  it("filters records by tenant", () => {
    const items = [
      { id: "1", tenantId: "tenant-a" },
      { id: "2", tenantId: "tenant-b" },
      { id: "3" },
    ];

    const filtered = filterByTenant(items, "tenant-a");
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, "1");
    assert.equal(filtered[1].id, "3");
  });

  it("assertSameTenant rejects mismatched ids", () => {
    const ok = assertSameTenant("tenant-a", "tenant-a");
    assert.equal(ok.ok, true);

    const denied = assertSameTenant("tenant-a", "tenant-b");
    assert.equal(denied.ok, false);
  });

  it("stampWithTenantId injects tenant id", () => {
    const stamped = stampWithTenantId({ id: "x" }, "tenant-a");
    assert.equal(stamped.tenantId, "tenant-a");
  });

  it("createTournament stamps tenantId", () => {
    ensureMultiTenantSeed();
    const result = createTournament("club-future-arena", { name: "Giải test" });
    assert.equal(result.ok, true);
    assert.equal(result.tournament.tenantId, "tenant-future-arena");
  });

  it("assertTournamentAccess blocks cross-tenant tournament", async () => {
    ensureMultiTenantSeed();
    enableRbac(true);
    signInAs({
      id: "dev-abc-owner",
      email: "owner@abc.local",
      role: ROLES.COURT_OWNER,
      tenantId: "tenant-abc-pickleball",
      venueId: "tenant-abc-pickleball",
    });

    const denied = assertTournamentAccess(
      "club-future-arena",
      "future_arena-tournament-1",
      { tenantId: "tenant-abc-pickleball" }
    );
    assert.equal(denied.ok, false);

    await signOut();
    enableRbac(false);
  });

  it("assertTournamentAccess allows platform admin cross-tenant tournament", async () => {
    ensureMultiTenantSeed();
    enableRbac(true);
    signInAs({
      id: "dev-platform-admin",
      email: "admin@platform.local",
      role: ROLES.PLATFORM_ADMIN,
    });

    const allowed = assertTournamentAccess(
      "club-future-arena",
      "future_arena-tournament-1",
      { tenantId: "tenant-abc-pickleball" }
    );
    assert.equal(allowed.ok, true);
    assert.ok(allowed.tournament);

    const recordCheck = guardRecordTenant(
      allowed.tournament,
      "tenant-abc-pickleball"
    );
    assert.equal(recordCheck.ok, true);

    await signOut();
    enableRbac(false);
  });

  it("listTournaments returns empty for cross-tenant club when RBAC on", async () => {
    ensureMultiTenantSeed();
    enableRbac(true);
    signInAs({
      id: "dev-abc-owner",
      email: "owner@abc.local",
      role: ROLES.COURT_OWNER,
      tenantId: "tenant-abc-pickleball",
      venueId: "tenant-abc-pickleball",
    });

    const list = listTournaments("club-future-arena");
    assert.equal(list.length, 0);

    await signOut();
    enableRbac(false);
  });

  it("assertTenantOperational blocks suspended tenant", () => {
    ensureMultiTenantSeed();
    setTenantStatus("tenant-abc-pickleball", "suspended");
    const check = assertTenantOperational("tenant-abc-pickleball");
    assert.equal(check.ok, false);
    assert.equal(check.code, "TENANT_INACTIVE");
  });
});

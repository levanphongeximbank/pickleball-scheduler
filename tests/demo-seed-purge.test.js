import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { loadClubs } from "../src/data/club.js";
import { loadVenues } from "../src/data/venue.js";
import { loadClubData } from "../src/domain/clubStorage.js";
import { seedDemoClubsRoster } from "../src/demo/seed/demoClubsRosterSeed.js";
import {
  DEMO_SEED_DISABLED_KEY,
  isDemoSeedDisabled,
  isDemoSeedPlayer,
  MULTI_TENANT_SEED_MARKER,
} from "../src/demo/seed/demoSeedRegistry.js";
import { purgeDemoSeedData } from "../src/demo/seed/purgeDemoSeed.js";
import { getClubPlayersPlatformWide } from "../src/features/club/services/platformAthleteService.js";
import { ensureClubManagementSeed } from "../src/features/club/seed/clubManagementSeed.js";
import {
  ensureMultiTenantSeed,
  SEED_TENANTS,
} from "../src/features/tenant/seed/multiTenantSeed.js";
import { ensureTenantBootstrap } from "../src/features/tenant/services/tenantService.js";

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

test("purgeDemoSeedData — xóa multi-tenant seed và chặn auto-seed", () => {
  ensureTenantBootstrap();

  const beforeClubs = loadClubs().filter((club) =>
    SEED_TENANTS.some((seed) => seed.clubId === club.id)
  );
  assert.ok(beforeClubs.length >= 3);

  const result = purgeDemoSeedData();
  assert.equal(result.ok, true);
  assert.ok(result.removedClubIds.includes("club-abc-pickleball"));
  assert.ok(result.removedTenantIds.includes("tenant-abc-pickleball"));
  assert.equal(isDemoSeedDisabled(), true);

  const afterClubs = loadClubs().filter((club) =>
    SEED_TENANTS.some((seed) => seed.clubId === club.id)
  );
  assert.equal(afterClubs.length, 0);

  const afterVenues = loadVenues().filter((venue) =>
    SEED_TENANTS.some((seed) => seed.id === venue.id)
  );
  assert.equal(afterVenues.length, 0);

  assert.equal(localStorage.getItem(MULTI_TENANT_SEED_MARKER), null);
  assert.equal(localStorage.getItem(DEMO_SEED_DISABLED_KEY), "1");

  ensureMultiTenantSeed();
  ensureClubManagementSeed();

  const reseededClubs = loadClubs().filter((club) =>
    SEED_TENANTS.some((seed) => seed.clubId === club.id)
  );
  assert.equal(reseededClubs.length, 0);
});

test("isDemoSeedPlayer — nhận diện VĐV abc_pickleball", () => {
  assert.equal(
    isDemoSeedPlayer({ id: "abc_pickleball-player-1", name: "abc_pickleball VĐV 1" }, "club-abc-pickleball"),
    true
  );
  assert.equal(isDemoSeedPlayer({ id: "real-1", name: "Nguyễn Văn A" }, "club-nam-long"), false);
});

test("getClubPlayersPlatformWide — ẩn demo khi demo seed disabled", () => {
  ensureTenantBootstrap();
  localStorage.setItem(DEMO_SEED_DISABLED_KEY, "1");

  const players = getClubPlayersPlatformWide();
  assert.equal(players.some((player) => /abc_pickleball VĐV/.test(player.name || "")), false);
});

test("purgeDemoSeedData — xóa roster demo 4 CLB × 60 VĐV", () => {
  seedDemoClubsRoster({ playersPerClub: 60 });

  const result = purgeDemoSeedData();
  assert.equal(result.ok, true);
  assert.ok(result.removedClubIds.includes("demo-club-saigon"));

  const data = loadClubData("demo-club-saigon");
  assert.equal(data.players.length, 0);
});

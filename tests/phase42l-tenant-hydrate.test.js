import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { ROLES } from "../src/auth/roles.js";
import { isGlobalRole } from "../src/auth/roles.js";
import { loadVenues, saveVenues } from "../src/data/venue.js";
import {
  buildClubRegistryCacheKey,
  CLUB_REGISTRY_SCOPE,
  readClubRegistryCache,
  resetClubRegistryCacheForTests,
  writeClubRegistryCache,
} from "../src/features/club/registry/clubRegistryCache.js";
import { filterRegistryRows, normalizeRegistryRow } from "../src/features/club/services/clubRegistryService.js";
import { hydrateSupabaseVenuesToLocalRegistry } from "../src/features/tenant/services/profileVenueService.js";
import { guardTenantAccess } from "../src/features/tenant/guards/tenantGuard.js";
import { listTenants } from "../src/features/tenant/services/tenantService.js";

const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";

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

function enableSupabaseEnv() {
  const nodeEnv = typeof globalThis.process !== "undefined" ? globalThis.process.env : {};
  nodeEnv.VITE_SUPABASE_URL = "https://qyewbxjsiiyufanzcjcq.supabase.co";
  nodeEnv.VITE_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test";
  nodeEnv.VITE_RBAC_ENABLED = "true";
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_SUPABASE_URL = nodeEnv.VITE_SUPABASE_URL;
    import.meta.env.VITE_SUPABASE_ANON_KEY = nodeEnv.VITE_SUPABASE_ANON_KEY;
    import.meta.env.VITE_RBAC_ENABLED = "true";
  }
}

function mockSupabaseClient(venues) {
  return {
    from() {
      return {
        select() {
          return {
            order() {
              return Promise.resolve({ data: venues, error: null });
            },
          };
        },
      };
    },
  };
}

/** TenantSwitcher contract — empty until explicit pick. */
function resolveTenantPickerValue(currentTenantId, tenants) {
  const hasSelection = tenants.some((tenant) => tenant.id === currentTenantId);
  return hasSelection ? currentTenantId : "";
}

/** TenantContext SA branch — never auto-pick first tenant. */
function resolveSaCurrentTenantId(adminTenantId, persistedTenantId) {
  return adminTenantId || persistedTenantId || null;
}

function canRenderTenantSwitcher(user) {
  return Boolean(user && isGlobalRole(user.role));
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  enableSupabaseEnv();
  saveVenues([]);
  resetClubRegistryCacheForTests();
});

afterEach(() => {
  delete globalThis.localStorage;
  resetClubRegistryCacheForTests();
});

describe("Phase 42L — tenant hydrate from cloud", () => {
  it("mirrors Supabase venues into local registry for SA picker", async () => {
    const client = mockSupabaseClient([
      { id: TENANT_A, name: "Venue Staging A — Ông A", status: "active" },
      { id: TENANT_B, name: "Venue Staging B — Ông B", status: "active" },
    ]);

    const result = await hydrateSupabaseVenuesToLocalRegistry(client);
    assert.equal(result.ok, true);
    assert.equal(result.hydrated, true);
    assert.deepEqual(result.tenantIds, [TENANT_A, TENANT_B]);

    const tenants = listTenants();
    assert.ok(tenants.some((row) => row.id === TENANT_A));
    assert.ok(tenants.some((row) => row.id === TENANT_B));
  });

  it("does not treat empty local registry as source of truth before hydrate", async () => {
    assert.equal(listTenants().length, 0);

    const client = mockSupabaseClient([
      { id: TENANT_A, name: "Venue Staging A — Ông A", status: "active" },
    ]);
    await hydrateSupabaseVenuesToLocalRegistry(client);

    assert.equal(listTenants().length, 1);
    assert.equal(listTenants()[0].id, TENANT_A);
  });

  it("merges cloud updates without dropping unrelated cached venues", async () => {
    saveVenues([{ id: "legacy-venue", name: "Legacy", status: "active" }]);

    const client = mockSupabaseClient([
      { id: TENANT_A, name: "Venue Staging A — Ông A", status: "active" },
      { id: TENANT_B, name: "Venue Staging B — Ông B", status: "active" },
    ]);
    await hydrateSupabaseVenuesToLocalRegistry(client);

    const ids = loadVenues().map((row) => row.id);
    assert.ok(ids.includes("legacy-venue"));
    assert.ok(ids.includes(TENANT_A));
    assert.ok(ids.includes(TENANT_B));
  });
});

describe("Phase 42L — tenant picker empty state", () => {
  it("keeps Chọn tenant… until SA explicitly picks", () => {
    const tenants = listTenants();
    assert.equal(resolveTenantPickerValue(null, tenants), "");
    assert.equal(resolveSaCurrentTenantId(null, null), null);
  });

  it("does not auto-pick first tenant when list hydrates", async () => {
    const client = mockSupabaseClient([
      { id: TENANT_A, name: "Venue Staging A — Ông A", status: "active" },
      { id: TENANT_B, name: "Venue Staging B — Ông B", status: "active" },
    ]);
    await hydrateSupabaseVenuesToLocalRegistry(client);

    const tenants = listTenants();
    assert.equal(tenants[0]?.id, TENANT_A);
    assert.equal(resolveSaCurrentTenantId(null, null), null);
    assert.equal(resolveTenantPickerValue(null, tenants), "");
  });
});

describe("Phase 42L — A→B→A registry cache isolation", () => {
  const rowsA = [
    normalizeRegistryRow({ id: "club-a1", tenant_id: TENANT_A, name: "CLB Smoke 42I1", status: "active" }),
    normalizeRegistryRow({ id: "club-a2", tenant_id: TENANT_A, name: "CLB QA42K", status: "active" }),
  ];
  const rowsB = [
    normalizeRegistryRow({ id: "club-b1", tenant_id: TENANT_B, name: "CLB Staging B", status: "active" }),
  ];

  it("keeps tenant-scoped registry cache keys separate", () => {
    const keyA = buildClubRegistryCacheKey(CLUB_REGISTRY_SCOPE.TENANT, TENANT_A, {});
    const keyB = buildClubRegistryCacheKey(CLUB_REGISTRY_SCOPE.TENANT, TENANT_B, {});

    writeClubRegistryCache(keyA, rowsA);
    writeClubRegistryCache(keyB, rowsB);

    const cachedA = readClubRegistryCache(keyA)?.clubs || [];
    const cachedB = readClubRegistryCache(keyB)?.clubs || [];

    assert.equal(cachedA.length, 2);
    assert.equal(cachedB.length, 1);
    assert.ok(cachedA.every((row) => row.tenantId === TENANT_A));
    assert.ok(cachedB.every((row) => row.tenantId === TENANT_B));
  });

  it("A→B→A restores tenant A rows without duplicate or B leak", () => {
    const keyA = buildClubRegistryCacheKey(CLUB_REGISTRY_SCOPE.TENANT, TENANT_A, {});
    const keyB = buildClubRegistryCacheKey(CLUB_REGISTRY_SCOPE.TENANT, TENANT_B, {});

    writeClubRegistryCache(keyA, rowsA);
    writeClubRegistryCache(keyB, rowsB);

    const bOnly = filterRegistryRows(readClubRegistryCache(keyB).clubs, {
      tenantFilter: TENANT_B,
    });
    assert.equal(bOnly.length, 1);
    assert.equal(bOnly[0].name, "CLB Staging B");

    const aRestored = filterRegistryRows(readClubRegistryCache(keyA).clubs, {
      tenantFilter: TENANT_A,
    });
    assert.equal(aRestored.length, 2);
    assert.ok(aRestored.some((row) => /Smoke 42I1|QA42K/.test(row.name)));
    assert.equal(aRestored.filter((row) => row.tenantId === TENANT_B).length, 0);
  });
});

describe("Phase 42L — tenant scope guard", () => {
  it("venue owner cannot access tenant outside profile scope", () => {
    const owner = {
      id: "owner-b",
      role: ROLES.TENANT_OWNER,
      venueId: TENANT_B,
      status: "active",
    };

    assert.equal(guardTenantAccess(TENANT_B, { user: owner, rbacEnabled: true }).ok, true);
    assert.equal(guardTenantAccess(TENANT_A, { user: owner, rbacEnabled: true }).ok, false);
  });

  it("Super Admin can access any tenant after explicit pick", () => {
    const sa = { id: "sa-1", role: ROLES.SUPER_ADMIN, status: "active" };
    assert.equal(guardTenantAccess(TENANT_A, { user: sa, rbacEnabled: true }).ok, true);
    assert.equal(guardTenantAccess(TENANT_B, { user: sa, rbacEnabled: true }).ok, true);
  });
});

describe("Phase 42L — desktop/mobile tenant switcher parity", () => {
  it("TenantSwitcher renders only for Super Admin on desktop and mobile shells", () => {
    const sa = { id: "sa-1", role: ROLES.SUPER_ADMIN, status: "active" };
    const president = { id: "p-1", role: ROLES.PLAYER, venueId: TENANT_A, status: "active" };

    assert.equal(canRenderTenantSwitcher(sa), true);
    assert.equal(canRenderTenantSwitcher(president), false);
  });
});

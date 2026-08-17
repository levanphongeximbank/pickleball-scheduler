import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTenant } from "../src/models/tenant.js";
import {
  loadTenants,
  saveTenants,
  createLocalTenantCacheAdapter,
} from "../src/data/tenantRegistry.js";
import { createTenant, listTenants } from "../src/features/tenant/services/tenantService.js";
import {
  PLATFORM_TENANT_ERROR,
  PLATFORM_TENANT_MODE,
  PLATFORM_TENANTS_TABLE,
  LEGACY_PUBLIC_TENANTS_VIEW,
  __resetPlatformTenantAuthorityForTests,
  assertNotLegacyPublicTenantsView,
  bindPlatformTenantAuthority,
  classifyPlatformTenantQueryError,
  getPlatformTenantAuthoritySnapshot,
  isCloudCanonicalTenantAuthority,
  mapPlatformTenantRow,
  refreshPlatformTenantAuthority,
  upsertCanonicalPlatformTenant,
} from "../src/core/platform/app/platformTenantAuthority.js";

if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };
}

function reset() {
  __resetPlatformTenantAuthorityForTests();
  saveTenants([]);
}

test("Wave3 durable runtime: public.tenants is forbidden as Tenant authority", () => {
  const forbidden = assertNotLegacyPublicTenantsView(LEGACY_PUBLIC_TENANTS_VIEW);
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.code, PLATFORM_TENANT_ERROR.LEGACY_VIEW_FORBIDDEN);
  assert.equal(assertNotLegacyPublicTenantsView(PLATFORM_TENANTS_TABLE).ok, true);
});

test("Wave3 durable runtime: schema-absent and permission errors are classified honestly", () => {
  assert.equal(
    classifyPlatformTenantQueryError({
      code: "PGRST205",
      message: "Could not find the table 'public.platform_tenants' in the schema cache",
    }),
    PLATFORM_TENANT_ERROR.SCHEMA_ABSENT
  );
  assert.equal(
    classifyPlatformTenantQueryError({ code: "42501", message: "permission denied" }),
    PLATFORM_TENANT_ERROR.NOT_READABLE
  );
  assert.equal(
    classifyPlatformTenantQueryError({ code: "XX000", message: "boom" }),
    PLATFORM_TENANT_ERROR.QUERY_FAILED
  );
});

test("Wave3 durable runtime: unbound adapter is compatibility, not fake cloud success", async () => {
  reset();
  bindPlatformTenantAuthority({
    queryAdapter: null,
    cacheAdapter: createLocalTenantCacheAdapter(),
  });
  saveTenants([normalizeTenant({ id: "local-1", name: "Local" })]);
  const result = await refreshPlatformTenantAuthority();
  assert.equal(result.ok, true);
  assert.equal(result.claimedCloud, false);
  assert.equal(result.mode, PLATFORM_TENANT_MODE.COMPATIBILITY_PRE_SCHEMA);
  assert.equal(isCloudCanonicalTenantAuthority(), false);
  assert.equal(getPlatformTenantAuthoritySnapshot().dualAuthority, false);
  assert.equal(listTenants().some((row) => row.id === "local-1"), true);
});

test("Wave3 durable runtime: schema absent stays compatibility and does not claim cloud", async () => {
  reset();
  bindPlatformTenantAuthority({
    cacheAdapter: createLocalTenantCacheAdapter(),
    queryAdapter: {
      async probe() {
        return {
          ok: false,
          code: PLATFORM_TENANT_ERROR.SCHEMA_ABSENT,
          error: "missing table",
        };
      },
      async list() {
        throw new Error("list must not run when schema is absent");
      },
    },
  });
  const result = await refreshPlatformTenantAuthority();
  assert.equal(result.ok, true);
  assert.equal(result.claimedCloud, false);
  assert.equal(result.mode, PLATFORM_TENANT_MODE.COMPATIBILITY_PRE_SCHEMA);
});

test("Wave3 durable runtime: not-readable schema does not claim canonical success", async () => {
  reset();
  bindPlatformTenantAuthority({
    cacheAdapter: createLocalTenantCacheAdapter(),
    queryAdapter: {
      async probe() {
        return {
          ok: false,
          code: PLATFORM_TENANT_ERROR.NOT_READABLE,
          error: "permission denied",
        };
      },
    },
  });
  const result = await refreshPlatformTenantAuthority();
  assert.equal(result.ok, false);
  assert.equal(result.claimedCloud, false);
  assert.equal(result.mode, PLATFORM_TENANT_MODE.SCHEMA_PRESENT_NOT_READABLE);
});

test("Wave3 durable runtime: cloud list replaces cache and drops independent local identity", async () => {
  reset();
  saveTenants([
    normalizeTenant({ id: "local-only", name: "Should Drop" }),
    normalizeTenant({ id: "tenant-keep", name: "Stale Name" }),
  ]);
  bindPlatformTenantAuthority({
    cacheAdapter: createLocalTenantCacheAdapter(),
    queryAdapter: {
      async probe() {
        return { ok: true, present: true };
      },
      async list() {
        return {
          ok: true,
          tenants: [
            mapPlatformTenantRow({
              id: "tenant-keep",
              name: "Canonical Name",
              slug: "canonical-name",
              status: "active",
            }),
            mapPlatformTenantRow({
              id: "tenant-new",
              name: "From Cloud",
              slug: "from-cloud",
              status: "active",
            }),
          ],
        };
      },
    },
  });

  const result = await refreshPlatformTenantAuthority();
  assert.equal(result.ok, true);
  assert.equal(result.claimedCloud, true);
  assert.equal(result.mode, PLATFORM_TENANT_MODE.CLOUD_CANONICAL);
  assert.equal(isCloudCanonicalTenantAuthority(), true);

  const ids = listTenants().map((row) => row.id).sort();
  assert.deepEqual(ids, ["tenant-keep", "tenant-new"]);
  assert.equal(listTenants().find((row) => row.id === "tenant-keep")?.name, "Canonical Name");
  assert.equal(loadTenants().some((row) => row.id === "local-only"), false);
});

test("Wave3 durable runtime: local createTenant is refused once cloud canonical is bound", async () => {
  reset();
  bindPlatformTenantAuthority({
    cacheAdapter: createLocalTenantCacheAdapter(),
    queryAdapter: {
      async probe() {
        return { ok: true, present: true };
      },
      async list() {
        return { ok: true, tenants: [] };
      },
      async upsert() {
        throw new Error("sync createTenant must not write cloud");
      },
    },
  });
  await refreshPlatformTenantAuthority();
  const created = createTenant("New Org");
  assert.equal(created.ok, false);
  assert.equal(created.code, PLATFORM_TENANT_ERROR.CLOUD_WRITE_REQUIRED);
  assert.equal(listTenants().length, 0);
});

test("Wave3 durable runtime: canonical upsert failure is not fake success", async () => {
  reset();
  bindPlatformTenantAuthority({
    cacheAdapter: createLocalTenantCacheAdapter(),
    queryAdapter: {
      async probe() {
        return { ok: true, present: true };
      },
      async list() {
        return { ok: true, tenants: [] };
      },
      async upsert() {
        return { ok: false, code: PLATFORM_TENANT_ERROR.WRITE_FAILED, error: "rls" };
      },
    },
  });
  await refreshPlatformTenantAuthority();
  const result = await upsertCanonicalPlatformTenant({
    id: "t1",
    name: "T1",
    slug: "t1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, PLATFORM_TENANT_ERROR.WRITE_FAILED);
  assert.equal(listTenants().length, 0);
});

test("Wave3 durable runtime: query adapter never targets public.tenants", async () => {
  reset();
  const tables = [];
  bindPlatformTenantAuthority({
    cacheAdapter: createLocalTenantCacheAdapter(),
    queryAdapter: {
      tableName: PLATFORM_TENANTS_TABLE,
      async probe() {
        tables.push("probe");
        return { ok: true, present: true };
      },
      async list() {
        tables.push("list");
        return { ok: true, tenants: [] };
      },
    },
  });
  await refreshPlatformTenantAuthority();
  assert.deepEqual(tables, ["probe", "list"]);
  assert.equal(LEGACY_PUBLIC_TENANTS_VIEW, "tenants");
});

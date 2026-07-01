import test from "node:test";
import assert from "node:assert/strict";

import {
  createTenantService,
} from "../src/core/platform/services/index.js";
import {
  createPlatformPersistenceAdapter,
  migrateLegacyV4Tenant,
} from "../src/core/platform/persistence/index.js";

test("tenant services can share state through a persistence adapter", () => {
  const persistence = createPlatformPersistenceAdapter({ namespace: "core-platform-tests" });
  const tenantServiceA = createTenantService({ persistence });
  const tenantServiceB = createTenantService({ persistence });

  tenantServiceA.create({ name: "North Club", tenant_id: "tenant-001", plan: "starter" });

  const persistedTenant = tenantServiceB.getById("tenant-001");
  assert.equal(persistedTenant?.name, "North Club");
  assert.equal(tenantServiceB.list().length, 1);
});

test("legacy v4 tenant payloads are migrated into the canonical tenant schema", () => {
  const migrated = migrateLegacyV4Tenant({
    clubName: "South Club",
    clubId: "club-100",
    plan: "professional",
    status: "active",
  });

  assert.equal(migrated.name, "South Club");
  assert.equal(migrated.tenant_id, "club-100");
  assert.equal(migrated.plan, "professional");
});

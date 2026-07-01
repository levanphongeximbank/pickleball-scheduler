import test from "node:test";
import assert from "node:assert/strict";

import { createTenantEntity, createUserEntity, buildPhase2DomainSummary } from "./index.js";

test("domain layer creates canonical tenant and user entities", () => {
  const tenant = createTenantEntity({ name: "North Club", tenant_id: "tenant-200" });
  const user = createUserEntity({ email: "owner@example.com", role: "TENANT_OWNER", tenant_id: "tenant-200" });

  assert.equal(tenant.tenant_id, "tenant-200");
  assert.equal(user.role, "TENANT_OWNER");
  assert.equal(user.tenant_id, "tenant-200");
});

test("domain layer builds a phase 2 summary for runtime views", () => {
  const summary = buildPhase2DomainSummary({
    tenant: { tenant_id: "tenant-201", name: "East Club", plan: "starter", status: "active" },
    user: { role: "CLUB_OWNER" },
    subscription: { plan: "starter", status: "active" },
  });

  assert.equal(summary.tenantId, "tenant-201");
  assert.equal(summary.role, "CLUB_OWNER");
  assert.equal(summary.plan, "starter");
});

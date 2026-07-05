import test from "node:test";
import assert from "node:assert/strict";

import { createPlatformRuntime } from "../src/core/platform/app/index.js";
import {
  buildPageRuntimeAccessState,
  resolveRuntimeAccess,
} from "../src/core/platform/app/runtimeAccess.js";
import { ROLES } from "../src/auth/roles.js";
import { can } from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";

test("platform runtime can initialize a seed tenant and persist it", () => {
  const runtime = createPlatformRuntime({ namespace: "core-platform-runtime-tests" });
  const result = runtime.initializeSeed({
    tenantInput: {
      name: "North Club",
      tenant_id: "tenant-runtime-001",
      plan: "starter",
    },
    subscriptionInput: {
      tenant_id: "tenant-runtime-001",
      plan: "starter",
      feature_flags: { mobile: true, ai: false },
    },
  });

  assert.equal(result.tenant.tenant_id, "tenant-runtime-001");
  assert.equal(runtime.tenantService.getById("tenant-runtime-001")?.name, "North Club");
  assert.equal(runtime.subscriptionService.hasFeature("tenant-runtime-001", "mobile"), true);
});

test("platform runtime can ensure a seed tenant without duplicating it", () => {
  const runtime = createPlatformRuntime({ namespace: "core-platform-runtime-tests-ensure" });
  const first = runtime.ensureSeed({
    tenantInput: {
      name: "South Club",
      tenant_id: "tenant-runtime-002",
      plan: "pro",
    },
    subscriptionInput: {
      tenant_id: "tenant-runtime-002",
      plan: "pro",
      feature_flags: { mobile: true, ai: true },
    },
  });
  const second = runtime.ensureSeed({
    tenantInput: {
      name: "South Club",
      tenant_id: "tenant-runtime-002",
      plan: "pro",
    },
    subscriptionInput: {
      tenant_id: "tenant-runtime-002",
      plan: "pro",
      feature_flags: { mobile: true, ai: true },
    },
  });

  assert.equal(runtime.tenantService.list().length, 1);
  assert.equal(first.tenant.tenant_id, "tenant-runtime-002");
  assert.equal(second.tenant.tenant_id, "tenant-runtime-002");
  assert.equal(runtime.subscriptionService.hasFeature("tenant-runtime-002", "ai"), true);
});

test("platform runtime can log core audit events for the v5 layer", () => {
  const runtime = createPlatformRuntime({ namespace: "core-platform-runtime-tests-audit" });
  const entry = runtime.logAuditEvent({
    tenant_id: "tenant-runtime-003",
    actor_user_id: "user-runtime-001",
    action: "audit.view",
    target_id: "audit-page",
  });

  assert.equal(entry.action, "audit.view");
  assert.equal(runtime.auditService.list().length, 1);
  assert.equal(runtime.auditService.list()[0].tenant_id, "tenant-runtime-003");
});

test("platform runtime can evaluate access decisions for user management", () => {
  const runtime = createPlatformRuntime({ namespace: "core-platform-runtime-tests-access" });
  const decision = runtime.accessService.authorize(
    {
      user_id: "owner-001",
      tenant_id: "tenant-runtime-004",
      role: "SUPER_ADMIN",
    },
    { tenant_id: "tenant-runtime-004" },
    "user.manage"
  );

  assert.equal(decision.allowed, true);
  assert.equal(decision.permission, "user.manage");
});

test("resolveRuntimeAccess returns a normalized decision object", () => {
  const runtime = createPlatformRuntime({ namespace: "core-platform-runtime-tests-access-helper" });
  const decision = resolveRuntimeAccess(runtime, {
    user_id: "owner-002",
    tenant_id: "tenant-runtime-005",
    role: "SUPER_ADMIN",
  }, "tenant.manage", "tenant-runtime-005");

  assert.equal(decision.allowed, true);
  assert.equal(decision.permission, "tenant.manage");
  assert.equal(decision.code, undefined);
});

test("buildPageRuntimeAccessState — identity SUPER_ADMIN bypasses tournament.manage", () => {
  const runtime = createPlatformRuntime({ namespace: "core-platform-runtime-tests-identity" });
  const admin = createUserRecord({ role: ROLES.SUPER_ADMIN, id: "founder-1" });
  const RBAC_ON = { rbacEnabled: true };

  const state = buildPageRuntimeAccessState(
    runtime,
    { user_id: "founder-1", tenant_id: "venue-prod-main", role: "SUPER_ADMIN" },
    "tournament.manage",
    "venue-prod-main",
    {},
    {
      user: admin,
      rbacEnabled: true,
      can: (perm, scope) => can(admin, perm, scope, RBAC_ON),
      scope: { venueId: "venue-prod-main" },
    }
  );

  assert.equal(state.allowed, true);
});

test("buildPageRuntimeAccessState — COURT_OWNER tournament.manage via identity RBAC", () => {
  const runtime = createPlatformRuntime({ namespace: "core-platform-runtime-tests-owner" });
  const owner = createUserRecord({
    role: ROLES.COURT_OWNER,
    id: "owner-1",
    venueId: "venue-prod-main",
    clubId: "club-1",
  });
  const RBAC_ON = { rbacEnabled: true };
  const scope = { venueId: "venue-prod-main", clubId: "club-1" };

  const state = buildPageRuntimeAccessState(
    runtime,
    { user_id: "owner-1", tenant_id: "venue-other", role: "TENANT_OWNER" },
    "tournament.manage",
    "venue-other",
    {},
    {
      user: owner,
      rbacEnabled: true,
      can: (perm, s) => can(owner, perm, s, RBAC_ON),
      scope,
    }
  );

  assert.equal(state.allowed, true);
});

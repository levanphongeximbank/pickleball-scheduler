import test from "node:test";
import assert from "node:assert/strict";

import {
  createAuditEvent,
  createNotification,
  createSetting,
  createSubscription,
  createTenantRecord,
  createUserRecord,
  assertTenantAccess,
  canPerformAction,
  getPermissionMatrix,
  getRlsPolicyMatrix,
} from "../src/core/platform/index.js";

test("creates canonical tenant and user records with tenant_id boundaries", () => {
  const tenant = createTenantRecord({
    name: "North Club",
    tenant_id: "tenant-001",
    plan: "starter",
  });
  const user = createUserRecord({
    email: "owner@example.com",
    role: "TENANT_OWNER",
    tenant_id: "tenant-001",
  });

  assert.equal(tenant.tenant_id, "tenant-001");
  assert.equal(user.tenant_id, "tenant-001");
  assert.equal(assertTenantAccess(user, { tenant_id: "tenant-001" }).ok, true);
  assert.equal(assertTenantAccess(user, { tenant_id: "tenant-999" }).ok, false);
});

test("permission and RLS matrix expose the minimum v5 roles", () => {
  const permissions = getPermissionMatrix();
  const rls = getRlsPolicyMatrix();

  assert.ok(permissions["SUPER_ADMIN"].includes("tenant.manage"));
  assert.ok(permissions["PLAYER"].includes("player.view.self"));
  assert.ok(rls["TENANT_OWNER"].includes("tenant"));
  assert.ok(rls["PLAYER"].includes("self"));
});

test("audit and notification events preserve tenant and actor context", () => {
  const event = createAuditEvent({
    tenant_id: "tenant-001",
    actor_user_id: "user-001",
    action: "subscription.updated",
    entity_type: "subscription",
  });
  const notification = createNotification({
    tenant_id: "tenant-001",
    user_id: "user-001",
    channel: "in_app",
    title: "Plan updated",
  });

  assert.equal(event.tenant_id, "tenant-001");
  assert.equal(event.actor_user_id, "user-001");
  assert.equal(notification.tenant_id, "tenant-001");
  assert.equal(notification.user_id, "user-001");
});

test("subscription and settings enforce feature availability and tenant scoping", () => {
  const subscription = createSubscription({
    tenant_id: "tenant-001",
    plan: "trial",
    status: "active",
    feature_flags: { ai: false, mobile: true },
  });
  const setting = createSetting({
    tenant_id: "tenant-001",
    key: "branding.name",
    value: "North Club",
  });
  const action = canPerformAction({
    role: "TENANT_OWNER",
    tenant_id: "tenant-001",
  }, { tenant_id: "tenant-001" }, "tenant.manage");

  assert.equal(subscription.plan, "trial");
  assert.equal(setting.tenant_id, "tenant-001");
  assert.equal(action.ok, true);
  assert.equal(action.allowed, true);
});

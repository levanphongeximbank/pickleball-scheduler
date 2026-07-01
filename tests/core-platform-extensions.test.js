import test from "node:test";
import assert from "node:assert/strict";

import {
  createSubscriptionService,
  createPermissionService,
  createNotificationService,
  createSettingService,
  createAccessService,
} from "../src/core/platform/services/index.js";
import { createPlatformPersistenceAdapter, migrateLegacyV4Tenant } from "../src/core/platform/persistence/index.js";

test("subscription service exposes tenant-scoped feature access", () => {
  const subscriptionService = createSubscriptionService();
  subscriptionService.create({
    tenant_id: "tenant-001",
    plan: "starter",
    status: "active",
    feature_flags: { ai: false, mobile: true },
  });

  const tenantSubscription = subscriptionService.getByTenant("tenant-001");
  const hasMobile = subscriptionService.hasFeature("tenant-001", "mobile");
  const hasAi = subscriptionService.hasFeature("tenant-001", "ai");

  assert.equal(tenantSubscription.plan, "starter");
  assert.equal(hasMobile, true);
  assert.equal(hasAi, false);
});

test("permission service resolves role-based access for the core platform", () => {
  const permissionService = createPermissionService();

  assert.equal(permissionService.hasPermission("TENANT_OWNER", "tenant.manage"), true);
  assert.equal(permissionService.hasPermission("PLAYER", "tenant.manage"), false);
  assert.equal(permissionService.hasPermission("PLAYER", "booking.view.self"), true);
});

test("access service enforces role-based permission checks", () => {
  const accessService = createAccessService({ permissionService: createPermissionService() });
  const denied = accessService.authorize(
    { user_id: "user-001", tenant_id: "tenant-101", role: "PLAYER" },
    { tenant_id: "tenant-101" },
    "tenant.manage"
  );

  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "PERMISSION_DENIED");
});

test("notification and setting services persist tenant-scoped records", () => {
  const persistence = createPlatformPersistenceAdapter({ namespace: "core-platform-tenant-scope" });
  const notificationService = createNotificationService({ persistence, collection: "notifications" });
  const settingService = createSettingService({ persistence, collection: "settings" });

  notificationService.create({
    tenant_id: "tenant-102",
    user_id: "user-002",
    channel: "email",
    title: "Welcome",
    body: "Welcome to the platform",
  });

  settingService.set({ tenant_id: "tenant-102", key: "theme", value: "dark" });

  assert.equal(notificationService.list().length, 1);
  assert.equal(settingService.get("tenant-102", "theme")?.value, "dark");
});

test("legacy v4 tenant payloads can be migrated into the v5 tenant contract", () => {
  const migrated = migrateLegacyV4Tenant({ clubId: "club-777", clubName: "Legacy Club", plan: "starter" });

  assert.equal(migrated.tenant_id, "club-777");
  assert.equal(migrated.name, "Legacy Club");
  assert.equal(migrated.plan, "starter");
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  createTenantService,
  createAccessService,
  createAuditService,
  createNotificationService,
  createSettingService,
} from "../src/core/platform/services/index.js";

test("tenant service stores and lists tenant records with consistent tenant_id", () => {
  const tenantService = createTenantService();
  const created = tenantService.create({ name: "North Club", tenant_id: "tenant-001", plan: "starter" });

  assert.equal(created.tenant_id, "tenant-001");
  assert.equal(tenantService.getById("tenant-001").name, "North Club");
  assert.equal(tenantService.list().length, 1);
});

test("access service protects tenant boundaries for owner and player roles", () => {
  const accessService = createAccessService();
  const ownerDecision = accessService.authorize({ role: "TENANT_OWNER", tenant_id: "tenant-001" }, { tenant_id: "tenant-001" }, "tenant.manage");
  const playerDecision = accessService.authorize({ role: "PLAYER", tenant_id: "tenant-001" }, { tenant_id: "tenant-002" }, "player.view.self");

  assert.equal(ownerDecision.allowed, true);
  assert.equal(playerDecision.allowed, false);
  assert.equal(playerDecision.code, "TENANT_FORBIDDEN");
});

test("audit service captures actor, target, and tenant context", () => {
  const auditService = createAuditService();
  const entry = auditService.log({ tenant_id: "tenant-001", actor_user_id: "user-001", action: "subscription.updated", target_id: "sub-001" });

  assert.equal(entry.tenant_id, "tenant-001");
  assert.equal(entry.actor_user_id, "user-001");
  assert.equal(entry.action, "subscription.updated");
});

test("notification and setting services store tenant-scoped state", () => {
  const notificationService = createNotificationService();
  const settingService = createSettingService();

  const notification = notificationService.create({ tenant_id: "tenant-001", user_id: "user-001", title: "Welcome", channel: "in_app" });
  const setting = settingService.set({ tenant_id: "tenant-001", key: "branding.name", value: "North Club" });

  assert.equal(notification.tenant_id, "tenant-001");
  assert.equal(setting.tenant_id, "tenant-001");
  assert.equal(settingService.get("tenant-001", "branding.name").value, "North Club");
});

import test from "node:test";
import assert from "node:assert/strict";

import { createNotificationService } from "./index.js";

test("createNotificationService marks a specific notification as read", () => {
  const service = createNotificationService();
  const first = service.create({ title: "First workflow update" });
  service.create({ title: "Second workflow update" });

  const updated = service.markAsRead(first.id);
  const list = service.list();

  assert.equal(updated.read, true);
  assert.equal(updated.status, "read");
  assert.equal(list.find((item) => item.id === first.id)?.read, true);
  assert.equal(list.find((item) => item.id !== first.id)?.read, false);
});

test("createNotificationService marks all notifications as read", () => {
  const service = createNotificationService();
  service.create({ title: "First workflow update" });
  service.create({ title: "Second workflow update" });

  const updated = service.markAllAsRead();
  const list = service.list();

  assert.equal(updated.length, 2);
  assert.equal(list.every((item) => item.read === true), true);
});

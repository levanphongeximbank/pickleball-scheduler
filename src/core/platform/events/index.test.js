import test from "node:test";
import assert from "node:assert/strict";

import { createPlatformEvent, createEventStore, createPlatformEventDispatcher, EVENT_TYPES } from "./index.js";

test("createPlatformEvent builds a normalized event payload", () => {
  const event = createPlatformEvent({
    type: EVENT_TYPES.WORKFLOW_STARTED,
    action: "seed",
    entityType: "workflow",
    entityId: "workflow-1",
    metadata: { stage: "seed" },
  });

  assert.equal(event.type, EVENT_TYPES.WORKFLOW_STARTED);
  assert.equal(event.action, "seed");
  assert.equal(event.entityType, "workflow");
  assert.equal(event.entityId, "workflow-1");
  assert.ok(event.id);
  assert.ok(event.occurredAt);
  assert.deepEqual(event.metadata, { stage: "seed" });
});

test("createEventStore records, reads, and clears events", () => {
  const store = createEventStore();
  const first = store.add(createPlatformEvent({ action: "seed" }));
  const second = store.add(createPlatformEvent({ action: "draw" }));

  assert.equal(store.list().length, 2);
  assert.equal(store.latest()?.id, second.id);
  assert.equal(first.action, "seed");

  store.clear();
  assert.deepEqual(store.list(), []);
});

test("createPlatformEventDispatcher writes audit and notification entries", () => {
  const auditEntries = [];
  const notificationEntries = [];
  const dispatch = createPlatformEventDispatcher({
    auditService: {
      log(input) {
        const entry = { ...input };
        auditEntries.push(entry);
        return entry;
      },
    },
    notificationService: {
      create(input) {
        const entry = { ...input };
        notificationEntries.push(entry);
        return entry;
      },
    },
  });

  const event = createPlatformEvent({
    type: EVENT_TYPES.WORKFLOW_COMPLETED,
    action: "seed",
    entityType: "workflow",
    entityId: "workflow-1",
    metadata: { stage: "seed" },
  });

  const result = dispatch(event, { tenantId: "tenant-1", notify: true });

  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].action, "workflow.seed");
  assert.equal(auditEntries[0].tenant_id, "tenant-1");
  assert.equal(notificationEntries.length, 1);
  assert.equal(notificationEntries[0].title, "Workflow seed completed");
  assert.equal(result.auditEntry.action, "workflow.seed");
});

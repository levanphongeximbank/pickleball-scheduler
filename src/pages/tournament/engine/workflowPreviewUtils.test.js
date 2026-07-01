import test from "node:test";
import assert from "node:assert/strict";

import {
  getPlatformEventSummary,
  getPlatformNotificationSummary,
  getUnreadNotificationCount,
  getWorkflowNotificationMessage,
} from "./workflowPreviewUtils.js";

test("getPlatformEventSummary formats workflow events for the UI", () => {
  const summary = getPlatformEventSummary({
    action: "seed",
    metadata: {
      status: "success",
      detail: "Generated 8 seed entries",
    },
    occurredAt: "2026-07-01T10:00:00.000Z",
  });

  assert.equal(summary.title, "Seed");
  assert.equal(summary.status, "success");
  assert.equal(summary.detail, "Generated 8 seed entries");
  assert.equal(summary.timestamp, "2026-07-01T10:00:00.000Z");
});

test("getPlatformNotificationSummary formats workflow notifications for the UI", () => {
  const summary = getPlatformNotificationSummary({
    title: "Workflow seed completed",
    body: "Generated 8 seed entries",
    created_at: "2026-07-01T10:00:00.000Z",
    channel: "in_app",
  });

  assert.equal(summary.title, "Workflow seed completed");
  assert.equal(summary.detail, "Generated 8 seed entries");
  assert.equal(summary.channel, "in_app");
});

test("getWorkflowNotificationMessage formats a snackbar message from a workflow notification", () => {
  const message = getWorkflowNotificationMessage({
    title: "Workflow seed completed",
    body: "Generated 8 seed entries",
  });

  assert.equal(message, "Workflow seed completed: Generated 8 seed entries");
});

test("getUnreadNotificationCount counts unread notifications", () => {
  const count = getUnreadNotificationCount([
    { title: "First", read: false },
    { title: "Second", read: true },
    { title: "Third" },
  ]);

  assert.equal(count, 2);
});

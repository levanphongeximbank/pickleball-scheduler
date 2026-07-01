import test from "node:test";
import assert from "node:assert/strict";

import { appendWorkflowHistoryEntry, groupWorkflowHistoryByDate, resetWorkflowHistory } from "./workflowHistory.js";

test("resetWorkflowHistory returns an empty list", () => {
  assert.deepEqual(resetWorkflowHistory(), []);
});

test("groupWorkflowHistoryByDate groups entries by day", () => {
  const history = [
    { id: "1", action: "seed", status: "success", timestamp: "2026-07-01T10:00:00.000Z" },
    { id: "2", action: "draw", status: "success", timestamp: "2026-07-01T11:00:00.000Z" },
    { id: "3", action: "schedule", status: "success", timestamp: "2026-06-30T09:00:00.000Z" },
  ];

  const grouped = groupWorkflowHistoryByDate(history);

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].label, "01/07/2026");
  assert.equal(grouped[0].entries.length, 2);
  assert.equal(grouped[1].entries[0].action, "schedule");
});

test("appendWorkflowHistoryEntry records the latest run and keeps the list bounded", () => {
  const history = [{ id: "1", action: "seed", status: "success", timestamp: "2026-01-01T00:00:00.000Z" }];

  const next = appendWorkflowHistoryEntry(history, {
    action: "draw",
    status: "success",
    detail: "Generated groups",
  });

  assert.equal(next.length, 2);
  assert.equal(next[0].action, "draw");
  assert.equal(next[0].status, "success");
  assert.equal(next[0].detail, "Generated groups");
  assert.ok(next[0].timestamp);
});

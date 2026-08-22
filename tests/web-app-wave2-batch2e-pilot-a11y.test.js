/**
 * Wave 2 Batch 2E — pilot a11y contracts (source-level).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

test("batch2e a11y — AuthPageHeader heading semantics used by pilots", () => {
  const header = read("src/features/web-app-ui/AuthPageHeader.jsx");
  assert.equal(header.includes('component="h1"'), true);
  for (const rel of [
    "src/pages/Players.jsx",
    "src/features/dashboard-analytics/components/DashboardAnalyticsView.jsx",
    "src/pages/AuditLogPage.jsx",
    "src/pages/Courts.jsx",
  ]) {
    assert.equal(read(rel).includes("AuthPageHeader"), true, rel);
  }
});

test("batch2e a11y — confirm dialog accessible title + destructive tone on Players", () => {
  const dialog = read("src/features/web-app-ui/AuthConfirmDialog.jsx");
  assert.equal(dialog.includes("aria-labelledby"), true);
  const players = read("src/pages/Players.jsx");
  assert.equal(players.includes("AuthConfirmDialog"), true);
  assert.equal(players.includes('confirmTone="destructive"'), true);
});

test("batch2e a11y — snackbar live region + visible text on Audit", () => {
  const snack = read("src/features/web-app-ui/AppSnackbar.jsx");
  assert.equal(snack.includes("aria-live"), true);
  const audit = read("src/pages/AuditLogPage.jsx");
  assert.equal(audit.includes("AppSnackbar"), true);
  assert.equal(audit.includes("message.text"), true);
});

test("batch2e a11y — StatusToneChip not color-only (label required) on Audit", () => {
  const chip = read("src/features/web-app-ui/StatusToneChip.jsx");
  assert.equal(/label/.test(chip), true);
  const audit = read("src/pages/AuditLogPage.jsx");
  assert.equal(audit.includes("label={"), true);
});

test("batch2e a11y — responsive data mobile shows detail without nowrap ellipsis", () => {
  const audit = read("src/pages/AuditLogPage.jsx");
  assert.equal(audit.includes("AuthResponsiveDataView"), true);
  assert.equal(audit.includes("renderMobileRow"), true);
  assert.equal(audit.includes('whiteSpace: "nowrap"'), false);
  assert.equal(audit.includes("wordBreak"), true);
});

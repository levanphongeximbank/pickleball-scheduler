/**
 * Wave 2 Batch 2D — shared pattern a11y contracts (node-safe).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

test("batch2d a11y — page header exposes h1", () => {
  const src = read("src/features/web-app-ui/AuthPageHeader.jsx");
  assert.ok(src.includes('component="h1"'));
  assert.ok(src.includes("primaryAction"));
});

test("batch2d a11y — confirm dialog labelled and blocks dismiss while busy", () => {
  const src = read("src/features/web-app-ui/AuthConfirmDialog.jsx");
  assert.ok(src.includes("aria-labelledby"));
  assert.ok(src.includes("auth-confirm-dialog-title"));
  assert.ok(src.includes("onClose={busy ? undefined : onCancel}"));
  assert.ok(src.includes('confirmTone === "destructive"'));
});

test("batch2d a11y — empty/loading/error live regions", () => {
  assert.ok(read("src/features/web-app-ui/AuthEmptyState.jsx").includes('role="status"'));
  assert.ok(read("src/features/web-app-ui/AuthLoadingState.jsx").includes("aria-busy"));
  assert.ok(read("src/features/web-app-ui/AuthErrorState.jsx").includes('role="alert"'));
});

test("batch2d a11y — snackbar aria-live + visible message", () => {
  const src = read("src/features/web-app-ui/AppSnackbar.jsx");
  assert.ok(src.includes("aria-live"));
  assert.ok(src.includes("message"));
  assert.ok(src.includes("polite") || src.includes("assertive"));
});

test("batch2d a11y — responsive table column headers + filter landmark", () => {
  const table = read("src/features/web-app-ui/AuthResponsiveDataView.jsx");
  assert.ok(table.includes('scope="col"'));
  assert.ok(table.includes('component="table"'));
  const filter = read("src/features/web-app-ui/AuthFilterBar.jsx");
  assert.ok(filter.includes("aria-label"));
});

test("batch2d a11y — critical shared-pattern gaps in 2D scope = 0", () => {
  const checks = [
    read("src/features/web-app-ui/AuthPageHeader.jsx").includes('component="h1"'),
    read("src/features/web-app-ui/AuthConfirmDialog.jsx").includes("aria-labelledby"),
    read("src/features/web-app-ui/AuthEmptyState.jsx").includes('role="status"'),
    read("src/features/web-app-ui/AuthErrorState.jsx").includes('role="alert"'),
    read("src/features/web-app-ui/AppSnackbar.jsx").includes("aria-live"),
    read("src/features/web-app-ui/AuthResponsiveDataView.jsx").includes('scope="col"'),
    read("src/features/web-app-ui/AuthFilterBar.jsx").includes("aria-label"),
  ];
  assert.equal(checks.every(Boolean), true);
  assert.equal(checks.filter((c) => !c).length, 0);
});

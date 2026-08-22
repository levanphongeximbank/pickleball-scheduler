/**
 * Wave 2 Batch 2D — shared pattern contracts (node-safe).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

const PATTERN_FILES = [
  "AuthPageHeader.jsx",
  "AuthConfirmDialog.jsx",
  "AuthEmptyState.jsx",
  "AuthLoadingState.jsx",
  "AuthErrorState.jsx",
  "AuthResponsiveDataView.jsx",
  "AuthFilterBar.jsx",
  "AppSnackbar.jsx",
];

test("batch2d — shared pattern location exists (AUTHENTICATED_SHARED)", () => {
  assert.equal(existsSync(path.join(root, "src/features/web-app-ui/index.js")), true);
  for (const file of PATTERN_FILES) {
    assert.equal(existsSync(path.join(root, "src/features/web-app-ui", file)), true, file);
  }
});

test("batch2d — barrel exports Layer 2 patterns", () => {
  const src = read("src/features/web-app-ui/index.js");
  for (const name of [
    "AuthPageHeader",
    "AuthConfirmDialog",
    "AuthEmptyState",
    "AuthLoadingState",
    "AuthErrorState",
    "AuthResponsiveDataView",
    "AuthFilterBar",
    "AppSnackbar",
  ]) {
    assert.ok(src.includes(name), `missing export ${name}`);
  }
});

test("batch2d AuthPageHeader — heading semantics; no TopBar / domain imports", () => {
  const src = read("src/features/web-app-ui/AuthPageHeader.jsx");
  assert.ok(src.includes('component="h1"'));
  assert.ok(src.includes("primaryAction"));
  assert.ok(src.includes("secondaryActions"));
  assert.ok(src.includes('xs: "column"'));
  assert.equal(/^import\s+.*CanonicalTopBar/m.test(src), false);
  assert.equal(/^import\s+.*ExperiencePageHeader/m.test(src), false);
  assert.equal(/from\s+["'].*tournament/.test(src), false);
  assert.equal(/from\s+["'].*club\/ui/.test(src), false);
});

test("batch2d AuthConfirmDialog — destructive uses error; loading blocks dismiss", () => {
  const src = read("src/features/web-app-ui/AuthConfirmDialog.jsx");
  assert.ok(src.includes('confirmTone === "destructive"'));
  assert.ok(src.includes('return "error"'));
  assert.ok(src.includes("onClose={busy ? undefined : onCancel}"));
  assert.ok(src.includes("auth-confirm-dialog-title"));
  assert.equal(src.includes("window.confirm"), false);
  assert.equal(/from\s+["'].*club/.test(src), false);
});

test("batch2d state views — no hardcoded domain empty copy; no raw stack default", () => {
  const empty = read("src/features/web-app-ui/AuthEmptyState.jsx");
  assert.equal(empty.includes("Khong co giai dau"), false);
  assert.equal(empty.includes("Chua co CLB"), false);
  assert.ok(empty.includes('role="status"'));
  assert.ok(empty.includes("title"));

  const loading = read("src/features/web-app-ui/AuthLoadingState.jsx");
  assert.ok(loading.includes('role="status"'));
  assert.ok(loading.includes("aria-busy"));
  assert.ok(loading.includes("CircularProgress"));

  const error = read("src/features/web-app-ui/AuthErrorState.jsx");
  assert.ok(error.includes('role="alert"'));
  assert.ok(error.includes("onRetry"));
  assert.equal(/stack\s*trace|error\.stack|JSON\.stringify\(error\)/.test(error), false);
  assert.equal(error.includes("supabase"), false);
  assert.equal(error.includes("console.error"), false);
});

test("batch2d AuthResponsiveDataView — table/mobile; no DataGrid dep; owns loading/empty/error", () => {
  const src = read("src/features/web-app-ui/AuthResponsiveDataView.jsx");
  assert.ok(src.includes('component="table"'));
  assert.ok(src.includes("useMediaQuery"));
  assert.ok(src.includes("AuthEmptyState"));
  assert.ok(src.includes("AuthLoadingState"));
  assert.ok(src.includes("AuthErrorState"));
  assert.equal(src.includes("@mui/x-data-grid"), false);
  assert.equal(/from\s+["']@mui\/x-data-grid/.test(src), false);
  assert.equal(/from\s+["'].*ResponsiveDataView/.test(src), false);
  assert.equal(/CourtCalendarWeekMatrix|AuditLogPage/.test(src), false);
});

test("batch2d AuthFilterBar — composition only; no filter state manager", () => {
  const src = read("src/features/web-app-ui/AuthFilterBar.jsx");
  assert.ok(src.includes("search"));
  assert.ok(src.includes("filters"));
  assert.ok(src.includes("resultCount"));
  assert.ok(src.includes('xs: "column"'));
  assert.equal(src.includes("useState"), false);
  assert.equal(src.includes("useReducer"), false);
  assert.equal(src.includes("queryKey"), false);
});

test("batch2d AppSnackbar — tones + visible text + aria-live; not notification inbox", () => {
  const src = read("src/features/web-app-ui/AppSnackbar.jsx");
  assert.ok(src.includes("info"));
  assert.ok(src.includes("success"));
  assert.ok(src.includes("warning"));
  assert.ok(src.includes("error"));
  assert.ok(src.includes("aria-live"));
  assert.ok(src.includes("message"));
  assert.equal(/^import\s+.*CanonicalNotification/m.test(src), false);
  assert.equal(/from\s+["'].*notification/.test(src), false);
});

test("batch2d — freeze boundaries: no shell / public / tournament imports", () => {
  for (const file of PATTERN_FILES) {
    const src = read(`src/features/web-app-ui/${file}`);
    assert.equal(/^import\s+.*CanonicalAppShell/m.test(src), false, file);
    assert.equal(/^import\s+.*ExperiencePageHeader/m.test(src), false, file);
    assert.equal(/from\s+["'].*features\/public/.test(src), false, file);
    assert.equal(/from\s+["'].*experience-a1/.test(src), false, file);
  }
  assert.equal(existsSync(path.join(root, "src/features/canonical-shell")), true);
});

test("batch2d a11y contracts — critical pattern gaps covered in source", () => {
  const checks = [
    read("src/features/web-app-ui/AuthPageHeader.jsx").includes('component="h1"'),
    read("src/features/web-app-ui/AuthConfirmDialog.jsx").includes("aria-labelledby"),
    read("src/features/web-app-ui/AppSnackbar.jsx").includes("aria-live"),
    read("src/features/web-app-ui/AuthResponsiveDataView.jsx").includes('scope="col"'),
    read("src/features/web-app-ui/AuthFilterBar.jsx").includes("aria-label"),
    read("src/features/web-app-ui/AuthEmptyState.jsx").includes('role="status"'),
    read("src/features/web-app-ui/AuthErrorState.jsx").includes('role="alert"'),
  ];
  assert.equal(checks.every(Boolean), true);
  assert.equal(checks.filter((c) => !c).length, 0);
});
